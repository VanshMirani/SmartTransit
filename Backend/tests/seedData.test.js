import assert from 'node:assert/strict';
import test from 'node:test';
import { createSeedData } from '../seedData.js';
import { verifyPassword } from '../passwords.js';

test('isolated development fixtures provide four roles with hashed passwords and no sessions', () => {
    const data = createSeedData();
    assert.deepEqual(data.users.map((user) => user.role).sort(), ['admin', 'conductor', 'driver', 'student']);
    for (const user of data.users) {
        assert.equal(Object.hasOwn(user, 'password'), false);
        assert.match(user.passwordHash, /^scrypt:/);
        const password = user.role[0].toUpperCase() + user.role.slice(1) + '@123';
        assert.equal(verifyPassword(password, user), true);
    }
    assert.deepEqual(data.sessions, {});
    assert.deepEqual(data.signupOtps, {});
    assert.deepEqual(data.passwordResetOtps, {});
    assert.equal(data.operations.tripStatus, 'not-started');
    assert.deepEqual(data.operations.liveLocations, {});
});

test('new development state does not share mutable records with another store', () => {
    const first = createSeedData();
    const originalName = first.users[0].name;
    const originalStop = first.admin.routes[0].stops[0].name;
    first.users[0].name = 'Changed in the first isolated store';
    first.admin.routes[0].stops[0].name = 'Changed stop';
    first.sessions['local-session'] = { userId: first.users[0].id };
    first.operations.liveLocations['local-trip'] = { coordinates: [0, 0] };
    const second = createSeedData();
    assert.equal(second.users[0].name, originalName);
    assert.equal(second.admin.routes[0].stops[0].name, originalStop);
    assert.deepEqual(second.sessions, {});
    assert.deepEqual(second.operations.liveLocations, {});
});
