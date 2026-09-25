import assert from 'node:assert/strict';
import test from 'node:test';
import { productionBackendErrors } from '../productionConfiguration.js';
import { createApiServer } from '../apiServer.js';

test('production rejects missing/weak OTP secret and permissive or invalid CORS origins without printing values', () => {
    const valid = { SMARTTRANSIT_OTP_SECRET: 'isolated-fixture-secret-with-32-characters', SMARTTRANSIT_ALLOWED_ORIGIN: 'https://example.invalid' };
    assert.deepEqual(productionBackendErrors(valid), []);
    for (const origin of ['*', 'http://example.invalid', 'https://example.invalid/path', 'https://name:password@example.invalid'])
        assert.ok(productionBackendErrors({ ...valid, SMARTTRANSIT_ALLOWED_ORIGIN: origin }).length);
    for (const secret of ['', 'short', 'smarttransit-development-otp-secret']) {
        const errors = productionBackendErrors({ ...valid, SMARTTRANSIT_OTP_SECRET: secret });
        assert.ok(errors.length);
        if (secret) assert.equal(errors.join('').includes(secret), false);
    }
});

test('the API refuses unsafe production configuration before starting', (t) => {
    const previous = { ...process.env };
    t.after(() => { for (const name of ['NODE_ENV', 'SMARTTRANSIT_OTP_SECRET', 'SMARTTRANSIT_ALLOWED_ORIGIN']) {
        if (previous[name] === undefined) delete process.env[name]; else process.env[name] = previous[name];
    } });
    process.env.NODE_ENV = 'production';
    delete process.env.SMARTTRANSIT_OTP_SECRET;
    delete process.env.SMARTTRANSIT_ALLOWED_ORIGIN;
    assert.throws(() => createApiServer({}), /Production configuration is invalid/);
});
