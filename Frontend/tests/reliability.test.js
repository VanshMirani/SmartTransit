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
