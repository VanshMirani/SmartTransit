import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createMongoDataStore } from '../mongoDataStore.js';

// Downloads/runs a temporary MongoDB only; never reads the application's .env.
const { MongoMemoryServer } = await import(process.env.QA_MONGO_MODULE);
const mongo = await MongoMemoryServer.create();
process.env.SMARTTRANSIT_MONGODB_URI = mongo.getUri();
process.env.SMARTTRANSIT_MONGODB_DB = 'smarttransit_qa';
process.env.SMARTTRANSIT_MONGODB_STATE_ID = 'qa-concurrent';
const first = createMongoDataStore(), second = createMongoDataStore();
try {
    await Promise.all([first.ready(), second.ready()]);
    await Promise.all(Array.from({ length: 10 }, (_, index) => (index % 2 ? first : second).update((data) => {
        data.qaCount = (data.qaCount ?? 0) + 1;
        return data.qaCount;
    })));
    assert.equal((await first.get()).qaCount, 10);
    const original = await first.get();
    await first.close(); await second.close();
    const restarted = createMongoDataStore();
    assert.deepEqual(await restarted.get(), original);
    await restarted.close();
    process.env.NODE_ENV = 'production';
    process.env.SMARTTRANSIT_MONGODB_STATE_ID = 'qa-empty-production';
    const empty = createMongoDataStore();
    await assert.rejects(empty.ready(), /not initialized/);
    await empty.close();
    delete process.env.NODE_ENV;
    console.log('PASS MongoDB cross-adapter concurrent writes, exact state reopening, and empty production fail-closed');
    const child = spawn(process.execPath, ['--test', 'Backend/tests/reliability.test.js'], {
        stdio: 'inherit', env: { ...process.env, QA_MONGO_URI: mongo.getUri() },
    });
    const code = await new Promise((resolve) => child.on('exit', resolve));
    if (code !== 0) process.exitCode = 1;
} finally {
    await first.close(); await second.close(); await mongo.stop();
}
