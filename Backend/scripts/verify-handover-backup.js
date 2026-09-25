import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, mkdtemp, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { isDeepStrictEqual, parseArgs, parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
import { BSON, MongoClient } from 'mongodb';
import { encryptBackup, decryptBackup } from '../backupArchive.js';
import { verifyPassword } from '../passwords.js';

// Reads one configured state document. There is deliberately no source write/restore path.
const { values } = parseArgs({ options: {
    'env-file': { type: 'string' }, 'backup-dir': { type: 'string' },
    'key-dir': { type: 'string' }, evidence: { type: 'string' },
} });
for (const name of ['env-file', 'backup-dir', 'key-dir', 'evidence'])
    if (!values[name]) throw new Error(`--${name} is required.`);
if (!process.env.QA_MONGO_MODULE) throw new Error('QA_MONGO_MODULE is required for a disposable restore target.');
process.umask(0o077);
const root = await realpath(fileURLToPath(new URL('../..', import.meta.url)));
async function privateRoot(input) {
    await mkdir(input, { recursive: true, mode: 0o700 });
    const directory = await realpath(input);
    assert.ok(directory !== root && !directory.startsWith(`${root}${path.sep}`), 'Sensitive backups/keys must stay outside the repository.');
    return directory;
}
const backupRoot = await privateRoot(values['backup-dir']);
const keyRoot = await privateRoot(values['key-dir']);
assert.notEqual(backupRoot, keyRoot, 'Keep the key separate from the backup directory.');
assert.ok(!keyRoot.startsWith(`${backupRoot}${path.sep}`) && !backupRoot.startsWith(`${keyRoot}${path.sep}`), 'Backup and key directories must not contain one another.');
const config = parseEnv(await readFile(values['env-file'], 'utf8'));
assert.equal(config.SMARTTRANSIT_STORAGE, 'mongodb', 'Explicit MongoDB configuration is required.');
assert.ok(config.SMARTTRANSIT_MONGODB_URI, 'SMARTTRANSIT_MONGODB_URI is required.');
const database = config.SMARTTRANSIT_MONGODB_DB || 'smarttransit';
const collection = config.SMARTTRANSIT_MONGODB_COLLECTION || 'app_state';
const stateId = config.SMARTTRANSIT_MONGODB_STATE_ID || 'production';
const source = new MongoClient(config.SMARTTRANSIT_MONGODB_URI, {
    serverSelectionTimeoutMS: 15000, connectTimeoutMS: 15000, appName: 'SmartTransitAuthorizedReadOnlyBackup',
});
let document, indexes;
try {
    await source.connect();
    const state = source.db(database).collection(collection);
    document = await state.findOne({ _id: stateId });
    assert.ok(document?.data?.users && document.data.admin?.routes, 'Expected SmartTransit state was not found; nothing will be initialized.');
    indexes = await state.listIndexes().toArray();
} catch (error) {
    // Do not include driver errors, URIs or document contents in audit output.
    console.error(`Source read failed (${error.name}); details withheld.`);
    document = null;
    process.exitCode = 1;
} finally { await source.close(); }
if (!document) process.exit(1);

const directory = await mkdtemp(path.join(backupRoot, 'snapshot-'));
const keyDirectory = await mkdtemp(path.join(keyRoot, 'key-'));
const archivePath = path.join(directory, 'app-state.stbackup');
const keyPath = path.join(keyDirectory, 'app-state.key');
const key = randomBytes(32);
const snapshot = { format: 'smarttransit-state-v1', createdAt: new Date(), database, collection, document, indexes };
const archive = encryptBackup(snapshot, key);
await writeFile(keyPath, key, { mode: 0o600, flag: 'wx' });
await writeFile(archivePath, archive, { mode: 0o600, flag: 'wx' });
key.fill(0);
const restored = decryptBackup(await readFile(archivePath), await readFile(keyPath));
// Assert a boolean, never the sensitive objects: assertion diffs are written to stderr.
assert.ok(isDeepStrictEqual(restored, snapshot), 'Encrypted file round trip must retain every field.');

const { MongoMemoryServer } = await import(process.env.QA_MONGO_MODULE);
const temporary = await MongoMemoryServer.create();
const uri = temporary.getUri();
assert.ok(uri.startsWith('mongodb://127.0.0.1:'), 'Restore target must be generated loopback MongoDB.');
const target = new MongoClient(uri);
let reopened;
try {
    await target.connect();
    const restoredCollection = target.db('smarttransit_restore_verification').collection(collection);
    assert.equal(await restoredCollection.countDocuments(), 0, 'Restore only into a new empty temporary collection.');
    await restoredCollection.insertOne(restored.document);
    for (const index of restored.indexes) {
        if (index.name === '_id_') continue;
        const { key: keys, v: _v, ns: _ns, ...options } = index;
        void _v; void _ns;
        await restoredCollection.createIndex(keys, options);
    }
    await target.close();
    reopened = new MongoClient(uri);
    await reopened.connect();
    const recovered = await reopened.db('smarttransit_restore_verification').collection(collection).findOne({ _id: stateId });
    assert.ok(isDeepStrictEqual(recovered, document), 'Restored MongoDB document must match the captured source exactly after reconnect.');
    const recoveredIndexes = await reopened.db('smarttransit_restore_verification').collection(collection).listIndexes().toArray();
    assert.deepEqual(recoveredIndexes.map(({ name, key: keys }) => ({ name, key: keys })), indexes.map(({ name, key: keys }) => ({ name, key: keys })));
} finally { await target.close(); await reopened?.close(); await temporary.stop(); }

const seed = await readFile(path.join(root, 'Backend/seedData.js'), 'utf8');
const credentials = await readFile(path.join(root, 'docs/LOGIN_CREDENTIALS.txt'), 'utf8');
const candidates = [...new Set([...seed.matchAll(/hashPassword\("([^"\n]+)"\)/g), ...credentials.matchAll(/^Password:\s*(\S+)/gm)].map((match) => match[1]))];
const roles = {};
for (const user of document.data.users) {
    const row = roles[user.role] ??= { accounts: 0, publishedPasswordMatches: 0, loginEligiblePublishedMatches: 0 };
    row.accounts++;
    if (candidates.some((password) => verifyPassword(password, user))) {
        row.publishedPasswordMatches++;
        if ((user.status ?? 'active') !== 'inactive' && !(user.role === 'student' && user.status === 'rejected')) row.loginEligiblePublishedMatches++;
    }
}
const routes = document.data.admin.routes.map((route) => ({ code: route.code, stops: (route.stops || []).map((stop) => ({
    name: stop.name, coordinates: stop.coordinates,
    validCoordinates: Array.isArray(stop.coordinates) && stop.coordinates.length === 2 && stop.coordinates.every(Number.isFinite) && Math.abs(stop.coordinates[0]) <= 90 && Math.abs(stop.coordinates[1]) <= 180,
    sharesPinWith: (route.stops || []).filter((other) => other !== stop && Array.isArray(stop.coordinates) && JSON.stringify(other.coordinates) === JSON.stringify(stop.coordinates)).map((other) => other.name),
    physicalPickupVerification: 'NOT TESTED - requires transport-office confirmation',
})) }));
const evidence = {
    checkedAt: new Date().toISOString(), source: 'Existing local MongoDB configuration; one state document, read-only',
    sourceRevision: document.revision, snapshotBytes: BSON.serialize(document).length,
    backup: { encryption: 'AES-256-GCM', archiveSha256: createHash('sha256').update(archive).digest('hex'), status: 'PASS', scope: 'Application state document and collection index definitions, not Atlas cluster configuration or point-in-time recovery' },
    restore: { status: 'PASS', destination: 'New disposable loopback MongoDB, destroyed after exact comparison and reconnect', dataEquality: true, indexDefinitions: indexes.length, sourceWrites: 0 },
    credentials: { comparison: 'Stored hash comparison with published fixture passwords; no login attempt', candidates: candidates.length, roles }, routes,
};
await mkdir(path.dirname(values.evidence), { recursive: true });
await writeFile(values.evidence, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
console.log(JSON.stringify({ backupStatus: 'PASS', restoreStatus: 'PASS', archivePath, keyPath, evidencePath: values.evidence, sourceWrites: 0, credentialSummary: roles }));
