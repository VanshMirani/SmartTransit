import assert from 'node:assert/strict';
import test from 'node:test';
import { randomBytes } from 'node:crypto';
import { encryptBackup, decryptBackup } from '../backupArchive.js';

test('encrypted backup preserves application state and BSON dates without plaintext', () => {
    const key = randomBytes(32);
    const source = { _id: 'qa-only', updatedAt: new Date('2026-09-25T10:00:00Z'), revision: 4,
        data: { users: [{ name: 'Local fixture', passwordHash: 'private-fixture-value' }], seats: 33 } };
    const archive = encryptBackup(source, key);
    assert.equal(archive.includes(Buffer.from('private-fixture-value')), false);
    assert.deepEqual(decryptBackup(archive, key), source);
    assert.notDeepEqual(encryptBackup(source, key), archive, 'Every archive uses a fresh nonce');
});

test('backup rejects a wrong key, tampered content and truncated or unknown formats', () => {
    const key = randomBytes(32);
    const archive = encryptBackup({ data: 'fixture' }, key);
    assert.throws(() => decryptBackup(archive, randomBytes(32)));
    const tampered = Buffer.from(archive);
    tampered[tampered.length - 1] ^= 1;
    assert.throws(() => decryptBackup(tampered, key));
    assert.throws(() => decryptBackup(archive.subarray(0, 20), key));
    assert.throws(() => encryptBackup({}, Buffer.alloc(3)));
    assert.throws(() => decryptBackup(archive, Buffer.alloc(3)));
});
