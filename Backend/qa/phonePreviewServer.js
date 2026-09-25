import { createServer, request as proxyRequest } from 'node:http';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';

const cookieName = '__Host-smarttransit-phone';
const digest = (value) => createHash('sha256').update(String(value)).digest();
const mimeTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.jpeg': 'image/jpeg', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };
const gatePage = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Phone test | SmartTransit</title>
<style>body{font:18px system-ui;background:#f3f7f8;color:#102e40;margin:0}main{max-width:28rem;margin:8vh auto;padding:24px}h1{font-size:28px}label{display:block;margin-top:24px}input,button{box-sizing:border-box;width:100%;font:inherit;padding:14px;margin-top:10px;border:1px solid #647b85;border-radius:6px}button{background:#006b68;color:white;font-weight:600}a{color:#006b68}:focus-visible{outline:3px solid #b15c00;outline-offset:3px}</style>
<main><h1>SmartTransit phone test</h1><p>Temporary test environment. No real trips, accounts or email delivery.</p><p>GPS shared during a test trip is saved only in the isolated test database on the owner's Mac. End the trip when finished. Keep this access code private.</p><form action="/__phone/unlock" method="post"><label for="code">Test access code</label><input id="code" name="code" type="password" autocomplete="off" required maxlength="128"><button>Open test website</button></form></main></html>`;

export function createPhonePreviewServer({ origin, accessCode, apiPort, distDirectory, expiresAt, now = Date.now }) {
    const publicUrl = new URL(origin);
    if (publicUrl.protocol !== 'https:' || publicUrl.origin !== origin || publicUrl.username || publicUrl.password)
        throw new Error('An exact HTTPS preview origin is required.');
    if (typeof accessCode !== 'string' || accessCode.length < 16) throw new Error('A private random access code is required.');
    if (!Number.isInteger(apiPort) || apiPort < 1 || apiPort > 65535) throw new Error('A loopback API port is required.');
    if (!Number.isFinite(expiresAt) || expiresAt <= now() || expiresAt > now() + 2 * 60 * 60 * 1000)
        throw new Error('The phone preview must expire within two hours.');
    const sessions = new Set();
    const codeHash = digest(accessCode);
    let failedAttempts = 0;
    let failureWindow = now();
    const headers = {
        'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow, noarchive',
        'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
        'X-Frame-Options': 'DENY', 'Permissions-Policy': 'geolocation=(self), camera=(), microphone=()',
    };
    return createServer(async (req, res) => {
        const send = (status, body, extra = {}) => {
            res.writeHead(status, { ...headers, 'Content-Type': 'application/json', ...extra });
            res.end(typeof body === 'string' ? body : JSON.stringify(body));
        };
        try {
            if (now() >= expiresAt) return send(410, { message: 'This temporary phone test has expired.' });
            if (req.headers.host !== publicUrl.host) return send(421, { message: 'Unexpected test host.' });
            const url = new URL(req.url, origin);
            if (url.origin !== origin) return send(400, { message: 'Invalid request.' });
            const write = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
            if ((write && req.headers.origin !== origin) || (req.headers.origin && req.headers.origin !== origin))
                return send(403, { message: 'Use the test website to submit this request.' });
            if (req.method === 'GET' && url.pathname === '/__phone')
                // Form navigation needs a same-origin Origin header; no-referrer makes it null in Chrome.
                return send(200, gatePage, { 'Content-Type': 'text/html; charset=utf-8', 'Referrer-Policy': 'same-origin', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'" });
            if (req.method === 'POST' && url.pathname === '/__phone/unlock') {
                if (now() - failureWindow > 60_000) { failedAttempts = 0; failureWindow = now(); }
                if (failedAttempts >= 10) return send(429, { message: 'Too many incorrect codes. Wait one minute and retry.' }, { 'Retry-After': '60' });
                if (!req.headers['content-type']?.startsWith('application/x-www-form-urlencoded'))
                    return send(415, { message: 'Use the access-code form.' });
                let body = '';
                for await (const chunk of req) {
                    body += chunk.toString();
                    if (Buffer.byteLength(body) > 2048) return send(413, { message: 'Request too large.' });
                }
                const entered = new URLSearchParams(body).get('code') ?? '';
                if (!timingSafeEqual(codeHash, digest(entered))) {
                    failedAttempts += 1;
                    return send(401, '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><p>Incorrect test access code. <a href="/__phone">Try again</a>.</p>', { 'Content-Type': 'text/html; charset=utf-8' });
                }
                if (sessions.size >= 30) return send(429, { message: 'Test session limit reached.' });
                const session = randomBytes(32).toString('base64url');
                sessions.add(session);
                return send(303, '', { Location: '/login', 'Set-Cookie': `${cookieName}=${session}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${Math.max(1, Math.floor((expiresAt - now()) / 1000))}` });
            }
            const cookie = (req.headers.cookie ?? '').split(';').map((value) => value.trim()).find((value) => value.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
            if (!cookie || !sessions.has(cookie)) {
                if (req.method === 'GET' && !url.pathname.startsWith('/api')) return send(303, '', { Location: '/__phone' });
                return send(401, { message: 'Test access expired or missing. Open /__phone to unlock the test website.' });
            }
            if (url.pathname === '/__phone/lock' && req.method === 'POST') {
                sessions.delete(cookie);
                return send(303, '', { Location: '/__phone', 'Set-Cookie': `${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0` });
            }
            if (url.pathname.startsWith('/api/')) {
                // This preview cannot send mail or create email-verification challenges.
                if (['/api/auth/signup-otp', '/api/auth/register/student', '/api/auth/password-reset', '/api/auth/password-reset/confirm'].includes(url.pathname))
                    return send(403, { message: 'Email and registration are disabled for this isolated phone test. Use the provided test account.' });
                if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return send(405, { message: 'Method not allowed.' });
                const upstream = proxyRequest({ hostname: '127.0.0.1', port: apiPort, path: `${url.pathname}${url.search}`, method: req.method,
                    headers: { accept: 'application/json', 'content-type': 'application/json', ...(req.headers.authorization ? { authorization: req.headers.authorization } : {}) }, timeout: 20_000,
                }, (response) => {
                    res.writeHead(response.statusCode, { ...headers, 'Content-Type': 'application/json' });
                    response.pipe(res);
                });
                upstream.on('timeout', () => upstream.destroy());
                upstream.on('error', () => {
                    if (!res.headersSent) send(502, { message: 'The isolated test API is unavailable.' });
                    else res.destroy();
                });
                let bytes = 0;
                req.on('data', (chunk) => {
                    bytes += chunk.length;
                    if (bytes > 512 * 1024) { send(413, { message: 'Request too large.' }); req.unpipe(upstream); upstream.destroy(); }
                });
                req.on('aborted', () => upstream.destroy());
                req.pipe(upstream);
                return;
            }
            if (!['GET', 'HEAD'].includes(req.method)) return send(405, { message: 'Method not allowed.' });
            const pathname = decodeURIComponent(url.pathname);
            if (pathname.includes('\\') || pathname.includes('\0') || pathname.split('/').some((part) => part.startsWith('.')))
                return send(404, { message: 'Not found.' });
            const root = await realpath(distDirectory);
            let file = path.resolve(root, `.${pathname}`);
            if (!file.startsWith(`${root}${path.sep}`) && file !== root) return send(404, { message: 'Not found.' });
            try { file = await realpath(file); }
            catch {
                if (path.extname(pathname) || pathname.startsWith('/assets/')) return send(404, { message: 'Not found.' });
                file = path.join(root, 'index.html');
            }
            if (file === root) file = path.join(root, 'index.html');
            if (!file.startsWith(`${root}${path.sep}`) || !mimeTypes[path.extname(file)]) return send(404, { message: 'Not found.' });
            const body = await readFile(file);
            res.writeHead(200, { ...headers, 'Content-Type': mimeTypes[path.extname(file)] });
            res.end(req.method === 'HEAD' ? undefined : body);
        } catch {
            if (!res.headersSent) send(500, { message: 'The temporary test server could not complete the request.' });
            else res.destroy();
        }
    });
}
