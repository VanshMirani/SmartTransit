import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createDataStore } from '../dataStore.js';
import { createApiServer } from '../apiServer.js';
import { createServer as createViteServer } from 'vite';

// Isolated local QA only: does not load .env or contact an email provider.
const directory = await mkdtemp(path.join(tmpdir(), 'smarttransit-qa-'));
const store = createDataStore(path.join(directory, 'db.json'));
await store.get();
const mailbox = {};
const captureMail = async ({ to, otp }) => {
    mailbox[to] = otp;
    await writeFile(path.join(directory, 'mailbox.json'), JSON.stringify(mailbox), { mode: 0o600 });
};
const api = createApiServer(store, { otpEmailSender: captureMail, passwordResetEmailSender: captureMail });
await new Promise((resolve) => api.listen(0, '127.0.0.1', resolve));
const apiUrl = `http://127.0.0.1:${api.address().port}/api`;
const vite = await createViteServer({
    root: path.resolve('Frontend'), envDir: directory,
    server: { host: '127.0.0.1', port: 5175, strictPort: true },
    define: { 'import.meta.env.VITE_USE_BACKEND': '"true"', 'import.meta.env.VITE_API_BASE_URL': JSON.stringify(apiUrl) },
});
await vite.listen();
console.log(`QA frontend: http://127.0.0.1:5175\nQA API: ${apiUrl}\nQA data: ${directory}`);
async function close() { await vite.close(); api.close(() => process.exit(0)); }
process.on('SIGINT', close);
process.on('SIGTERM', close);
