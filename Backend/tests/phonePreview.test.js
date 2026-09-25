import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request as httpRequest } from 'node:http';
import { mkdtemp, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createPhonePreviewServer } from '../qa/phonePreviewServer.js';

async function fixture(t) {
    const directory = await mkdtemp(path.join(tmpdir(), 'smarttransit-phone-test-'));
    await writeFile(path.join(directory, 'index.html'), '<h1>Isolated app</h1>');
    await writeFile(path.join(directory, 'bundle.js'), '/* test bundle */');
    const calls = [];
    const api = createServer(async (req, res) => {
        let body = '';
        for await (const chunk of req) body += chunk;
        calls.push({ url: req.url, authorization: req.headers.authorization, cookie: req.headers.cookie, body });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
    });
    await new Promise((resolve) => api.listen(0, '127.0.0.1', resolve));
    const origin = 'https://isolated-phone.trycloudflare.com';
    const accessCode = 'private-test-code-123456';
    let time = Date.now();
    const server = createPhonePreviewServer({ origin, accessCode, apiPort: api.address().port, distDirectory: directory, expiresAt: time + 120_000, now: () => time });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    t.after(async () => {
        server.closeAllConnections(); api.closeAllConnections();
        await new Promise((resolve) => server.close(resolve));
        await new Promise((resolve) => api.close(resolve));
        await rm(directory, { recursive: true, force: true });
    });
    // Node fetch replaces Host; use an HTTP client to reproduce the tunnel's original host.
    const request = (pathname, options = {}) => new Promise((resolve, reject) => {
        const req = httpRequest({ hostname: '127.0.0.1', port: server.address().port, path: pathname,
            method: options.method ?? 'GET', headers: { host: new URL(origin).host, origin, ...options.headers },
        }, async (response) => {
            let body = '';
            for await (const chunk of response) body += chunk;
            resolve({ status: response.statusCode, text: async () => body,
                headers: { get: (name) => Array.isArray(response.headers[name]) ? response.headers[name][0] : response.headers[name] },
            });
        });
        req.on('error', reject);
        req.end(options.body?.toString());
    });
    const unlock = (code = accessCode) => request('/__phone/unlock', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code }) });
    return { request, unlock, calls, directory, advance: (ms) => { time += ms; } };
}

test('phone preview protects the app, assets and API before the independent access gate', async (t) => {
    const f = await fixture(t);
    const gate = await f.request('/__phone');
    assert.equal(gate.status, 200);
    assert.match(await gate.text(), /Temporary test environment/);
    assert.equal(gate.headers.get('referrer-policy'), 'same-origin');
    for (const route of ['/login', '/driver/trip', '/bundle.js']) {
        const result = await f.request(route);
        assert.equal(result.status, 303);
        assert.equal(result.headers.get('location'), '/__phone');
    }
    assert.equal((await f.request('/api/health')).status, 401);
    assert.equal((await f.request('/api/auth/login', { method: 'POST', body: '{}' })).status, 401);
    assert.equal((await f.request('/api/health', { headers: { cookie: '__Host-smarttransit-phone=forged' } })).status, 401);
    assert.equal((await f.request('/__phone', { headers: { host: 'other.example' } })).status, 421);
    assert.equal(f.calls.length, 0);
});

test('phone gate rejects incorrect codes and cross-origin writes; safe retry sets a secure cookie', async (t) => {
    const f = await fixture(t);
    assert.equal((await f.unlock('wrong')).status, 401);
    assert.equal((await f.request('/__phone/unlock', { method: 'POST', headers: { origin: 'https://other.example' }, body: 'code=anything' })).status, 403);
    assert.equal((await f.request('/__phone/unlock', { method: 'POST', headers: { origin: 'null' }, body: 'code=anything' })).status, 403);
    const result = await f.unlock();
    assert.equal(result.status, 303);
    const setCookie = result.headers.get('set-cookie');
    for (const required of ['HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/']) assert.ok(setCookie.includes(required));
    const cookie = setCookie.split(';')[0];
    const page = await f.request('/driver/trip', { headers: { cookie } });
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Isolated app/);
    const response = await f.request('/api/driver/trips/current', { headers: { cookie, authorization: 'Bearer test-only-token' } });
    assert.equal(response.status, 200);
    assert.equal(f.calls[0].authorization, 'Bearer test-only-token');
    assert.equal(f.calls[0].cookie, undefined);
    assert.equal((await f.request('/api/staff/emergencies', { method: 'POST', headers: { cookie, origin: 'https://other.example' }, body: '{}' })).status, 403);
    assert.equal(f.calls.length, 1);
    assert.equal((await f.request('/__phone/lock', { method: 'POST', headers: { cookie } })).status, 303);
    assert.equal((await f.request('/api/health', { headers: { cookie } })).status, 401);
});

test('phone preview blocks email flows, non-build files and expires independently of sessions', async (t) => {
    const f = await fixture(t);
    const cookie = (await f.unlock()).headers.get('set-cookie').split(';')[0];
    await symlink('/etc/hosts', path.join(f.directory, 'outside.js'));
    for (const route of ['/api/auth/signup-otp', '/api/auth/register/student', '/api/auth/password-reset', '/api/auth/password-reset/confirm'])
        assert.equal((await f.request(route, { method: 'POST', headers: { cookie }, body: '{}' })).status, 403);
    for (const route of ['/.env', '/assets/missing.js', '/outside.js', '/%00.js'])
        assert.equal((await f.request(route, { headers: { cookie } })).status, 404);
    assert.equal(f.calls.length, 0);
    f.advance(120_001);
    assert.equal((await f.request('/__phone')).status, 410);
    assert.equal((await f.request('/api/health', { headers: { cookie } })).status, 410);
    assert.equal((await f.unlock()).status, 410);
});

test('phone gate bounds wrong-code attempts and recovers after the rate-limit window', async (t) => {
    const f = await fixture(t);
    for (let index = 0; index < 10; index++) assert.equal((await f.unlock('wrong')).status, 401);
    assert.equal((await f.unlock()).status, 429);
    f.advance(60_001);
    assert.equal((await f.unlock()).status, 303);
});
