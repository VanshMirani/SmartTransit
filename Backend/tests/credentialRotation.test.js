import assert from 'node:assert/strict';
import test from 'node:test';
import { rotatePublishedAccounts } from '../credentialRotation.js';
import { hashPassword, verifyPassword } from '../passwords.js';

function fixture() {
    const published = 'FixtureOnly@123';
    const users = ['admin', 'student', 'conductor', 'driver'].map((role) => ({
        id: role, role, email: `${role}@example.invalid`, passwordHash: hashPassword(published), assignment: 'retained',
    }));
    const data = { users, sessions: Object.fromEntries(users.map((u) => [`token-${u.id}`, { userId: u.id }])),
        passwordResetOtps: Object.fromEntries(users.map((u) => [u.email, { codeHash: 'fixture-hash' }])),
        operations: { tripHistory: [{ id: 'retain-history' }] }, admin: { routes: [{ code: 'retain-route' }] } };
    const replacements = users.filter((u) => u.role !== 'driver').map((u) => ({
        id: u.id, role: u.role, email: u.email, publishedPasswords: [published], newPassword: `New-${u.role}@456!`,
    }));
    return { data, replacements, published };
}

test('narrow credential rotation revokes only targeted sessions/challenges and preserves transport data', () => {
    const { data, replacements, published } = fixture();
    const before = structuredClone(data);
    const result = rotatePublishedAccounts(data, replacements);
    assert.equal(result.revokedSessions, 3);
    for (const item of replacements) {
        const user = data.users.find((u) => u.id === item.id);
        assert.equal(verifyPassword(published, user), false);
        assert.equal(verifyPassword(item.newPassword, user), true);
        const { passwordHash: _hash, ...identity } = user;
        const { passwordHash: _old, ...oldIdentity } = before.users.find((u) => u.id === item.id);
        void _hash; void _old;
        assert.deepEqual(identity, oldIdentity);
        assert.equal(data.passwordResetOtps[user.email], undefined);
    }
    assert.deepEqual(data.users.find((u) => u.role === 'driver'), before.users.find((u) => u.role === 'driver'));
    assert.deepEqual(data.sessions, { 'token-driver': { userId: 'driver' } });
    assert.deepEqual(data.passwordResetOtps, { 'driver@example.invalid': { codeHash: 'fixture-hash' } });
    assert.deepEqual(data.operations, before.operations);
    assert.deepEqual(data.admin, before.admin);
});

test('rotation refuses changed identities, changed passwords, incomplete plans and weak replacements atomically', () => {
    for (const alter of [
        (plan) => { plan[2].email = 'different@example.invalid'; },
        (plan) => { plan[2].publishedPasswords = ['not-the-current-password']; },
        (plan) => { plan.pop(); },
        (plan) => { plan[2].newPassword = 'weak'; },
        (plan) => { plan[2].newPassword = 'FixtureOnly@123'; },
        (plan) => { plan[2].role = 'admin'; },
    ]) {
        const { data, replacements } = fixture();
        const before = structuredClone(data);
        alter(replacements);
        assert.throws(() => rotatePublishedAccounts(data, replacements));
        assert.deepEqual(data, before);
    }
});
