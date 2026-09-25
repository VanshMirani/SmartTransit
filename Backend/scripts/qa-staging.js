import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:https';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { build, preview } from 'vite';
import { MongoClient } from 'mongodb';
import { createSeedData } from '../seedData.js';

// No .env is loaded. Only a newly created loopback MongoDB receives QA fixtures.
const directory = await mkdtemp(path.join(tmpdir(), 'smarttransit-qa-staging-'));
const { MongoMemoryServer } = await import(process.env.QA_MONGO_MODULE);
const mongo = await MongoMemoryServer.create();
const uri = mongo.getUri();
assert.ok(uri.startsWith('mongodb://127.0.0.1:'));
const database = 'smarttransit_staging_qa';
const stateId = 'isolated-staging';
const client = new MongoClient(uri);
await client.connect();
await client.db(database).collection('app_state').insertOne({ _id: stateId, revision: 0, data: createSeedData() });
await client.close();

const keyPath = path.join(directory, 'localhost.key');
const certPath = path.join(directory, 'localhost.crt');
execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=localhost',
    '-addext', 'subjectAltName=IP:127.0.0.1,DNS:localhost', '-keyout', keyPath, '-out', certPath], { stdio: 'ignore' });
const tls = { key: await readFile(keyPath), cert: await readFile(certPath) };
const listen = (server) => new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
});
let staticMiddleware;
const frontend = createServer(tls, (request, response) => {
    if (staticMiddleware) staticMiddleware(request, response);
    else response.writeHead(503).end('Staging build is starting.');
});
await listen(frontend);
const base = `https://127.0.0.1:${frontend.address().port}`;
Object.assign(process.env, {
    NODE_ENV: 'production', SMARTTRANSIT_STORAGE: 'mongodb',
    SMARTTRANSIT_MONGODB_URI: uri, SMARTTRANSIT_MONGODB_DB: database,
    SMARTTRANSIT_MONGODB_COLLECTION: 'app_state', SMARTTRANSIT_MONGODB_STATE_ID: stateId,
    SMARTTRANSIT_ALLOWED_ORIGIN: base, SMARTTRANSIT_OTP_SECRET: randomBytes(32).toString('hex'),
});
const { createApiServer } = await import('../apiServer.js');
const { createSmartTransitStore } = await import('../store.js');
let store, api, previewServer;
const mailbox = {};
const captureMail = async ({ to, otp }) => {
    mailbox[to] = otp;
    await writeFile(path.join(directory, 'mailbox.json'), JSON.stringify(mailbox), { mode: 0o600 });
};
const closeServer = (server) => server?.listening
    ? new Promise((resolve) => { server.close(resolve); server.closeIdleConnections(); }) : Promise.resolve();
const run = (script, extraEnv = {}) => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], { stdio: 'inherit', env: { ...process.env, ...extraEnv } });
    child.on('error', reject);
    child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`${script} exited ${code}`)));
});
try {
    store = await createSmartTransitStore();
    const application = createApiServer(store, { otpEmailSender: captureMail, passwordResetEmailSender: captureMail });
    api = createServer(tls, application.listeners('request')[0]);
    await listen(api);
    const apiUrl = `https://127.0.0.1:${api.address().port}/api`;
    const config = {
        root: path.resolve('Frontend'), envDir: directory,
        define: { 'import.meta.env.VITE_USE_BACKEND': '"true"', 'import.meta.env.VITE_API_BASE_URL': JSON.stringify(apiUrl) },
        build: { outDir: path.join(directory, 'dist'), emptyOutDir: true },
    };
    await build(config);
    previewServer = await preview({ ...config, preview: { host: '127.0.0.1', port: 0, strictPort: true } });
    staticMiddleware = previewServer.middlewares;
    console.log(`Local staging: ${base}\nStorage: disposable MongoDB\nFrontend: production build; test-only local TLS certificate`);
    await run(process.env.QA_PERFORMANCE_ONLY ? 'Backend/scripts/qa-performance.js' : 'Backend/scripts/qa-browser.js', {
        QA_BASE_URL: base, QA_API_URL: apiUrl, QA_DATA_DIR: directory,
        QA_RUN_NAME: process.env.QA_RUN_NAME || '2026-09-20-staging',
    });
    const saved = await store.get();
    await store.close();
    store = await createSmartTransitStore();
    assert.deepEqual(await store.get(), saved);
    console.log('PASS production-mode MongoDB adapter reopen preserves exact browser-created state');
} finally {
    await closeServer(frontend);
    await closeServer(api);
    await closeServer(previewServer?.httpServer);
    await store?.close();
    await mongo.stop();
}
