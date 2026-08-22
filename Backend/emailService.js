import tls from "node:tls";

const smtpTimeoutMs = 15000;

function getMailProvider(env = process.env) {
    return (env.SMARTTRANSIT_EMAIL_PROVIDER ?? (env.SMARTTRANSIT_BREVO_API_KEY?.trim() ? "brevo" : "smtp")).trim().toLowerCase();
}

function requiredMailSettings(env = process.env) {
    const provider = getMailProvider(env);
    const base = [
        ["SMARTTRANSIT_MAIL_FROM", env.SMARTTRANSIT_MAIL_FROM],
        ["SMARTTRANSIT_OTP_SECRET", env.SMARTTRANSIT_OTP_SECRET],
    ];
    if (provider === "brevo") {
        return [
            ...base,
            ["SMARTTRANSIT_BREVO_API_KEY", env.SMARTTRANSIT_BREVO_API_KEY],
        ].filter(([, value]) => !value?.trim()).map(([key]) => key);
    }
    if (provider === "smtp") {
        return [
            ["SMARTTRANSIT_SMTP_HOST", env.SMARTTRANSIT_SMTP_HOST],
            ["SMARTTRANSIT_SMTP_USER", env.SMARTTRANSIT_SMTP_USER],
            ["SMARTTRANSIT_SMTP_PASS", env.SMARTTRANSIT_SMTP_PASS],
            ...base,
        ].filter(([, value]) => !value?.trim()).map(([key]) => key);
    }
    return ["SMARTTRANSIT_EMAIL_PROVIDER must be smtp or brevo"];
}

export function getMissingMailSettings(env = process.env) {
    return requiredMailSettings(env);
}

function getSmtpConfig(env = process.env) {
    const missing = requiredMailSettings({ ...env, SMARTTRANSIT_EMAIL_PROVIDER: "smtp" });
    if (missing.length) {
        throw new Error(`Email service is not configured. Missing: ${missing.join(", ")}.`);
    }
    const host = env.SMARTTRANSIT_SMTP_HOST.trim();
    const rawPassword = env.SMARTTRANSIT_SMTP_PASS;
    return {
        host,
        port: Number(env.SMARTTRANSIT_SMTP_PORT ?? 465),
        secure: env.SMARTTRANSIT_SMTP_SECURE !== "false",
        user: env.SMARTTRANSIT_SMTP_USER.trim(),
        pass: host === "smtp.gmail.com" ? rawPassword.replace(/\s+/g, "") : rawPassword,
        from: env.SMARTTRANSIT_MAIL_FROM.trim(),
    };
}

function getBrevoConfig(env = process.env) {
    const missing = requiredMailSettings({ ...env, SMARTTRANSIT_EMAIL_PROVIDER: "brevo" });
    if (missing.length) {
        throw new Error(`Email service is not configured. Missing: ${missing.join(", ")}.`);
    }
    return {
        apiKey: env.SMARTTRANSIT_BREVO_API_KEY.trim(),
        from: env.SMARTTRANSIT_MAIL_FROM.trim(),
    };
}

function encodeHeader(value) {
    return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function envelopeAddress(value) {
    const match = value.match(/<([^>]+)>/);
    return `<${(match?.[1] ?? value).trim()}>`;
}

function parseMailFrom(value) {
    const trimmed = value.trim();
    const match = trimmed.match(/^(.*?)<([^>]+)>$/);
    if (!match) {
        return { email: trimmed, name: "SmartTransit" };
    }
    const name = match[1].trim().replace(/^"|"$/g, "");
    return {
        email: match[2].trim(),
        name: name || "SmartTransit",
    };
}

function escapeDataLines(message) {
    return message.replace(/\r?\n/g, "\r\n").replace(/^\./gm, "..");
}

function buildMessage({ from, to, subject, text, html }) {
    const boundary = `smarttransit-${Date.now().toString(36)}`;
    const messageIdHost = from.match(/@([^>]+)>?$/)?.[1] ?? "smarttransit.local";
    return [
        `From: ${from}`,
        `To: ${to}`,
        `Subject: ${encodeHeader(subject)}`,
        "MIME-Version: 1.0",
        `Message-ID: <${Date.now()}.${Math.random().toString(36).slice(2)}@${messageIdHost}>`,
        `Date: ${new Date().toUTCString()}`,
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
        "",
        `--${boundary}`,
        "Content-Type: text/plain; charset=UTF-8",
        "Content-Transfer-Encoding: 8bit",
        "",
        text,
        "",
        `--${boundary}`,
        "Content-Type: text/html; charset=UTF-8",
        "Content-Transfer-Encoding: 8bit",
        "",
        html,
        "",
        `--${boundary}--`,
        "",
    ].join("\r\n");
}

function createSmtpClient(config) {
    const socket = tls.connect({
        host: config.host,
        port: config.port,
        servername: config.host,
        timeout: smtpTimeoutMs,
    });
    socket.setEncoding("utf8");

    let buffer = "";
    const waiters = [];

    socket.on("data", (chunk) => {
        buffer += chunk;
        flushWaiters();
    });

    socket.on("error", (error) => {
        while (waiters.length) {
            waiters.shift().reject(error);
        }
    });

    socket.on("timeout", () => {
        socket.destroy(new Error("SMTP request timed out."));
    });

    function parseResponse() {
        const lines = buffer.split(/\r?\n/);
        const completed = [];
        while (lines.length > 1) {
            const line = lines.shift();
            completed.push(line);
            if (/^\d{3}\s/.test(line)) {
                buffer = lines.join("\r\n");
                return completed.join("\n");
            }
        }
        return null;
    }

    function flushWaiters() {
        while (waiters.length) {
            const response = parseResponse();
            if (!response)
                return;
            waiters.shift().resolve(response);
        }
    }

    function readResponse() {
        const response = parseResponse();
        if (response)
            return Promise.resolve(response);
        return new Promise((resolve, reject) => {
            waiters.push({ resolve, reject });
        });
    }

    async function command(value, expectedCode) {
        socket.write(`${value}\r\n`);
        const response = await readResponse();
        if (!response.startsWith(String(expectedCode))) {
            throw new Error(`SMTP command failed with response: ${response}`);
        }
        return response;
    }

    return {
        async send(message) {
            try {
                const greeting = await readResponse();
                if (!greeting.startsWith("220")) {
                    throw new Error(`SMTP server rejected connection: ${greeting}`);
                }
                await command("EHLO smarttransit.local", 250);
                await command("AUTH LOGIN", 334);
                await command(Buffer.from(config.user).toString("base64"), 334);
                await command(Buffer.from(config.pass).toString("base64"), 235);
                await command(`MAIL FROM:${envelopeAddress(config.from)}`, 250);
                await command(`RCPT TO:<${message.to}>`, 250);
                await command("DATA", 354);
                socket.write(`${escapeDataLines(buildMessage({ ...message, from: config.from }))}\r\n.\r\n`);
                const accepted = await readResponse();
                if (!accepted.startsWith("250")) {
                    throw new Error(`SMTP message was not accepted: ${accepted}`);
                }
                await command("QUIT", 221).catch(() => undefined);
            }
            finally {
                socket.end();
            }
        },
    };
}

export async function sendSignupOtpEmail({ to, otp, expiresInMinutes }) {
    const subject = "Your SmartTransit signup OTP";
    const text = [
        `Your SmartTransit OTP is ${otp}.`,
        `It expires in ${expiresInMinutes} minutes.`,
        "If you did not request this, ignore this email.",
    ].join("\n");
    const html = [
        "<p>Your SmartTransit signup OTP is:</p>",
        `<p style="font-size:24px;font-weight:700;letter-spacing:4px">${otp}</p>`,
        `<p>This code expires in ${expiresInMinutes} minutes.</p>`,
        "<p>If you did not request this, ignore this email.</p>",
    ].join("");
    const message = { to, subject, text, html };
    const provider = getMailProvider();
    if (provider === "brevo") {
        await sendBrevoEmail(getBrevoConfig(), message);
        return;
    }
    if (provider === "smtp") {
        const client = createSmtpClient(getSmtpConfig());
        await client.send(message);
        return;
    }
    throw new Error("Email service is not configured. SMARTTRANSIT_EMAIL_PROVIDER must be smtp or brevo.");
}

async function sendBrevoEmail(config, message) {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
            accept: "application/json",
            "api-key": config.apiKey,
            "content-type": "application/json",
        },
        body: JSON.stringify({
            sender: parseMailFrom(config.from),
            to: [{ email: message.to }],
            subject: message.subject,
            textContent: message.text,
            htmlContent: message.html,
        }),
    });
    if (!response.ok) {
        const details = await response.text().catch(() => "");
        throw new Error(`Brevo email API failed with status ${response.status}: ${details.slice(0, 300)}`);
    }
}
