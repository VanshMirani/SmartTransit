import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveBackendConfiguration } from '../src/services/backendConfiguration.js';
import { createGpsSync } from '../src/operations/gpsSync.js';

test('production fails closed with missing or insecure backend configuration', () => {
    for (const env of [{ PROD: true }, { VITE_USE_BACKEND: 'true' }, { PROD: true, VITE_API_BASE_URL: 'http://example.com/api' }]) {
        const config = resolveBackendConfiguration(env);
        assert.equal(config.enabled, true);
        assert.ok(config.configurationError);
    }
    assert.equal(resolveBackendConfiguration({ PROD: true, VITE_API_BASE_URL: 'https://example.com/api/' }).configurationError, '');
    assert.equal(resolveBackendConfiguration({ DEV: true }).enabled, false);
});

test('failed GPS uploads are not successful syncs, retry with a new fix, and ignore disposed trips', async () => {
    let now = Date.now(), calls = 0, accepted = 0;
    const states = [];
    const position = (accuracy = 10) => ({ timestamp: now, coords: { latitude: 23, longitude: 72, accuracy } });
    const sync = createGpsSync({ tripId: 'A', now: () => now,
        request: async () => { calls += 1; if (calls === 1) throw new Error('offline'); return { ok: true, location: { updatedAt: new Date(now).toISOString() } }; },
        onState: (state) => states.push(state), onAccepted: () => { accepted += 1; },
    });
    await sync.receive(position());
    assert.equal(accepted, 0);
    assert.equal(states.at(-1), 'error');
    await sync.receive(position());
    assert.equal(calls, 1);
    now += 10001;
    await sync.receive(position(500));
    assert.equal(calls, 1);
    assert.equal(states.at(-1), 'weak');
    await sync.receive(position());
    assert.equal(accepted, 1);
    now += 31000;
    sync.checkFreshness();
    assert.equal(states.at(-1), 'error');
    sync.dispose();
    await sync.receive(position());
    assert.equal(calls, 2);

    let finish;
    const pending = createGpsSync({ tripId: 'old', now: () => now, request: () => new Promise((resolve) => { finish = resolve; }), onState: () => {}, onAccepted: () => { accepted += 1; } });
    const upload = pending.receive(position());
    pending.dispose();
    finish({ ok: true, location: { updatedAt: new Date(now).toISOString() } });
    await upload;
    assert.equal(accepted, 1);
});

test('GPS first-fix waiting and device errors are not replaced with misleading stale-location messages', async () => {
    let now = Date.now();
    const messages = [];
    const sync = createGpsSync({ tripId: 'waiting', now: () => now,
        request: async () => { throw new Error('offline'); },
        onState: (status, message) => messages.push({ status, message }), onAccepted: () => assert.fail('No successful upload expected'),
    });
    sync.checkFreshness();
    assert.equal(messages.length, 0);
    now += 31000;
    sync.checkFreshness();
    assert.equal(messages.at(-1).status, 'waiting');
    assert.match(messages.at(-1).message, /No GPS location has been received/);
    assert.doesNotMatch(messages.at(-1).message, /last accepted|out of date/);
    for (const code of [1, 2, 3]) {
        sync.reportError({ code });
        const failure = messages.at(-1);
        assert.equal(failure.status, code === 1 ? 'permission' : 'error');
        now += 60000;
        sync.checkFreshness();
        assert.equal(messages.at(-1), failure);
    }
    const position = (accuracy) => ({ timestamp: now, coords: { latitude: 23, longitude: 72, accuracy } });
    await sync.receive(position(500));
    const weak = messages.at(-1);
    now += 31000;
    sync.checkFreshness();
    assert.equal(messages.at(-1), weak);
    await sync.receive(position(10));
    const uploadFailure = messages.at(-1);
    assert.match(uploadFailure.message, /upload was not confirmed/);
    now += 60000;
    sync.checkFreshness();
    assert.equal(messages.at(-1), uploadFailure);
    sync.dispose();
    sync.reportError({ code: 1 });
    assert.equal(messages.at(-1), uploadFailure);
});

test('a late GPS upload acknowledgement cannot erase a newer permission error', async () => {
    const now = Date.now();
    let finish;
    const states = [];
    const sync = createGpsSync({ tripId: 'permission-changed', now: () => now,
        request: () => new Promise((resolve) => { finish = resolve; }),
        onState: (status) => states.push(status), onAccepted: () => {},
    });
    const uploading = sync.receive({ timestamp: now, coords: { latitude: 23, longitude: 72, accuracy: 10 } });
    sync.reportError({ code: 1 });
    finish({ ok: true, location: { updatedAt: new Date(now).toISOString() } });
    await uploading;
    assert.equal(states.at(-1), 'permission');
    sync.checkFreshness();
    assert.equal(states.at(-1), 'permission');
    sync.dispose();
});
