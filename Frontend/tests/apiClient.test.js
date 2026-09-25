import assert from 'node:assert/strict';
import test from 'node:test';
import { apiRequest, backendConfig, clearBackendToken, saveBackendToken } from '../src/services/apiClient.js';

function setup(t, fetch) {
    const original = { ...backendConfig };
    const globals = ['window', 'sessionStorage'].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
    Object.assign(backendConfig, { enabled: true, baseUrl: 'https://example.invalid/api', configurationError: '' });
    globalThis.window = new EventTarget();
    const storage = new Map();
    globalThis.sessionStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) };
    t.mock.method(globalThis, 'fetch', fetch);
    t.after(() => {
        Object.assign(backendConfig, original);
        for (const [key, descriptor] of globals) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else delete globalThis[key];
        }
    });
}

test('API network failures use actionable language without implying authentication failed', async (t) => {
    setup(t, async () => { throw new TypeError('Failed to fetch'); });
    await assert.rejects(apiRequest('/auth/login', { method: 'POST', body: {} }), (error) => {
        assert.equal(error.status, 0);
        assert.match(error.message, /Check your internet connection/);
        assert.doesNotMatch(error.message, /Failed to fetch|password|expired/);
        return true;
    });
});

test('API timeouts have retry guidance and intentional cancellation is preserved', async (t) => {
    const timeout = new DOMException('timeout', 'TimeoutError');
    setup(t, async () => { throw timeout; });
    await assert.rejects(apiRequest('/auth/session'), /taking too long.*retry/);
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(apiRequest('/auth/session', { signal: controller.signal }), (error) => error === timeout);
});

test('API rejection status and invalid HTML response remain distinct from network failures', async (t) => {
    let response = new Response('{"message":"Authentication required."}', { status: 401 });
    setup(t, async () => response);
    await assert.rejects(apiRequest('/auth/session'), (error) => error.status === 401 && error.message === 'Authentication required.');
    response = new Response('<html>Misrouted request</html>', { status: 200 });
    await assert.rejects(apiRequest('/auth/session'), (error) => error.status === 502 && /invalid response/.test(error.message));
});

test('a dropped response body is a network failure, not a successful sync', async (t) => {
    setup(t, async () => ({ text: async () => { throw new TypeError('connection closed'); } }));
    await assert.rejects(apiRequest('/student/transit'), (error) => error.status === 0 && /Unable to reach/.test(error.message));
});

test('a pending anonymous login cannot complete after sign-out or another session begins', async (t) => {
    let finish;
    setup(t, () => new Promise((resolve) => { finish = resolve; }));
    for (const change of [clearBackendToken, () => saveBackendToken('isolated-new-session')]) {
        const request = apiRequest('/auth/login', { method: 'POST', body: {} });
        change();
        finish(new Response('{}'));
        await assert.rejects(request, (error) => error.status === 409);
        clearBackendToken();
    }
});

test('requests work without newer AbortSignal helpers and preserve caller cancellation', async (t) => {
    setup(t, async (_url, { signal }) => {
        assert.ok(signal instanceof AbortSignal);
        if (signal.aborted) throw signal.reason;
        return new Response('{}');
    });
    for (const name of ['any', 'timeout']) {
        const descriptor = Object.getOwnPropertyDescriptor(AbortSignal, name);
        Object.defineProperty(AbortSignal, name, { configurable: true, value: undefined });
        t.after(() => Object.defineProperty(AbortSignal, name, descriptor));
    }
    assert.deepEqual(await apiRequest('/auth/session', { signal: new AbortController().signal }), {});
    const controller = new AbortController();
    controller.abort(new DOMException('Cancelled', 'AbortError'));
    await assert.rejects(apiRequest('/auth/session', { signal: controller.signal }), /Cancelled/);
});

test('reads invalidated by continuous writes have a bounded retry budget', async (t) => {
    let reads = 0;
    setup(t, async (_url, { method }) => {
        if (method === 'GET') {
            reads += 1;
            if (reads <= 5) await apiRequest('/write', { method: 'POST', body: {} });
        }
        return new Response('{}');
    });
    await assert.rejects(apiRequest('/student/transit'), /changed|refresh|retry/i);
    assert.equal(reads, 2);
});

test('an obsolete account request cannot update connection state after sign-out', async (t) => {
    let fail;
    setup(t, () => new Promise((_resolve, reject) => { fail = reject; }));
    const events = [];
    globalThis.window.addEventListener('smarttransit:connection', (event) => events.push(event.detail));
    saveBackendToken('isolated-old-session');
    const request = apiRequest('/student/transit');
    clearBackendToken();
    fail(new TypeError('offline'));
    await assert.rejects(request);
    assert.equal(events.length, 0);
});

test('a late older read cannot overwrite an already accepted newer response', async (t) => {
    let finishOld, calls = 0;
    setup(t, async () => ++calls === 1 ? new Promise((resolve) => { finishOld = resolve; }) : new Response('{"count":3}'));
    const oldRead = apiRequest('/student/transit');
    assert.deepEqual(await apiRequest('/student/transit'), { count: 3 });
    finishOld(new Response('{"count":1}'));
    assert.deepEqual(await oldRead, { count: 3 });
    assert.equal(calls, 3);
});
