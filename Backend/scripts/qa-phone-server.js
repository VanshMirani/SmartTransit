import { mkdtemp, writeFile, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { createPhonePreviewServer } from '../qa/phonePreviewServer.js';

// Never read .env, reuse a database, or inherit provider credentials in this launcher.
if (Object.keys(process.env).some((key) => /^(SMARTTRANSIT_|VITE_)/.test(key)))
    throw new Error('Start the isolated phone launcher without SMARTTRANSIT_* or VITE_* environment variables.');
const [origin, portText = '5186'] = process.argv.slice(2);
if (!/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(origin ?? ''))
    throw new Error('Provide the exact temporary HTTPS trycloudflare.com origin.');
const port = Number(portText);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid preview port.');
process.env.NODE_ENV = 'test';
process.env.SMARTTRANSIT_ALLOWED_ORIGIN = origin;
process.env.SMARTTRANSIT_OTP_SECRET = randomBytes(32).toString('hex');
const { createDataStore } = await import('../dataStore.js');
const { createApiServer } = await import('../apiServer.js');
const { hashPassword } = await import('../passwords.js');
const { build } = await import('vite');
const directory = await mkdtemp(path.join(tmpdir(), 'smarttransit-phone-'));
await chmod(directory, 0o700);
const store = createDataStore(path.join(directory, 'db.json'));
const accounts = [];
await store.update((data) => {
    for (const user of data.users) {
        const password = `Phone!${randomBytes(10).toString('base64url')}7a`;
        user.passwordHash = hashPassword(password);
        delete user.password;
        accounts.push({ role: user.role, email: user.email, password });
    }
    data.sessions = {};
    data.signupOtps = {};
    data.passwordResetOtps = {};
    return { initialized: true };
});
const distDirectory = path.join(directory, 'dist');
process.env.NODE_ENV = 'production';
await build({ root: path.resolve('Frontend'), envDir: directory, mode: 'phone-test',
    define: { 'import.meta.env.VITE_USE_BACKEND': '"true"', 'import.meta.env.VITE_API_BASE_URL': JSON.stringify(`${origin}/api`) },
    build: { outDir: distDirectory, emptyOutDir: true, sourcemap: false },
});
process.env.NODE_ENV = 'test';
const rejectMail = async () => { throw new Error('Email delivery is disabled in the isolated phone test.'); };
const api = createApiServer(store, { otpEmailSender: rejectMail, passwordResetEmailSender: rejectMail });
await new Promise((resolve) => api.listen(0, '127.0.0.1', resolve));
const expiresAt = Date.now() + 2 * 60 * 60 * 1000;
const accessCode = randomBytes(12).toString('base64url');
const server = createPhonePreviewServer({ origin, accessCode, apiPort: api.address().port, distDirectory, expiresAt });
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
const handover = path.join(directory, 'PHONE_TEST_ACCESS.json');
await writeFile(handover, JSON.stringify({ origin, expiresAt: new Date(expiresAt).toISOString(), accessCode, accounts, dataFile: store.dataFile }, null, 2), { mode: 0o600 });
console.log(JSON.stringify({ phoneTest: 'ready', origin, port, expiresAt: new Date(expiresAt).toISOString(), privateAccessFile: handover, dataIsolated: true, emailDisabled: true }));
let closing = false;
async function close() {
    if (closing) return;
    closing = true;
    server.closeAllConnections(); api.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await new Promise((resolve) => api.close(resolve));
    console.log('Temporary phone test stopped. Its private files remain locally for owner-reviewed cleanup.');
    process.exit(0);
}
setTimeout(close, expiresAt - Date.now());
process.on('SIGINT', close);
process.on('SIGTERM', close);
