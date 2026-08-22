import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { loadEnvFile } from "../env.js";

loadEnvFile();

const children = [];
const preferredApiPort = Number(process.env.API_PORT ?? 5050);

function isPortAvailable(port) {
    return new Promise((resolve) => {
        const server = createServer();
        server.once("error", () => resolve(false));
        server.once("listening", () => {
            server.close(() => resolve(true));
        });
        server.listen(port);
    });
}

async function findApiPort(startPort) {
    for (let port = startPort; port < startPort + 20; port += 1) {
        if (await isPortAvailable(port))
            return String(port);
    }
    throw new Error(`No available API port found between ${startPort} and ${startPort + 19}.`);
}

function run(name, command, args, env = {}) {
    const child = spawn(command, args, {
        stdio: "inherit",
        shell: process.platform === "win32",
        env: { ...process.env, ...env },
    });
    children.push(child);
    child.on("exit", (code) => {
        if (code && !process.exitCode)
            process.exitCode = code;
        children.forEach((item) => {
            if (item !== child)
                item.kill();
        });
    });
    console.log(`[${name}] started`);
}

process.on("SIGINT", () => {
    children.forEach((child) => child.kill("SIGINT"));
});

const apiPort = await findApiPort(preferredApiPort);

run("api", "node", ["Backend/index.js"], { API_PORT: apiPort });
run("frontend", "npm", ["run", "dev"], {
    VITE_USE_BACKEND: "true",
    VITE_API_BASE_URL: `http://127.0.0.1:${apiPort}/api`,
    VITE_ALLOWED_SIGNUP_EMAIL_DOMAINS: process.env.VITE_ALLOWED_SIGNUP_EMAIL_DOMAINS ?? "",
});
