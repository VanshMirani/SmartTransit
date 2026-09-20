import assert from 'node:assert/strict';
import test from 'node:test';
import { apiRequest, backendConfig } from '../src/services/apiClient.js';

function setup(t, fetch) {
    const original = { ...backendConfig };
    const globals = ['window', 'sessionStorage'].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
    Object.assign(backendConfig, { enabled: true, baseUrl: 'https://example.invalid/api', configurationError: '' });
    globalThis.window = new EventTarget();
    globalThis.sessionStorage = { getItem: () => null };
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
