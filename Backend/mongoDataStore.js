import { createSeedData } from "./seedData.js";

const clone = (value) => JSON.parse(JSON.stringify(value));
const defaultDatabaseName = "smarttransit";
const defaultCollectionName = "app_state";
const defaultStateId = "production";

function requireMongoUri() {
    const uri = process.env.SMARTTRANSIT_MONGODB_URI?.trim();
    if (!uri) {
        throw new Error("SMARTTRANSIT_MONGODB_URI is required when SMARTTRANSIT_STORAGE=mongodb.");
    }
    return uri;
}

function databaseName() {
    return process.env.SMARTTRANSIT_MONGODB_DB?.trim() || defaultDatabaseName;
}

function collectionName() {
    return process.env.SMARTTRANSIT_MONGODB_COLLECTION?.trim() || defaultCollectionName;
}

function stateId() {
    return process.env.SMARTTRANSIT_MONGODB_STATE_ID?.trim() || defaultStateId;
}

function createUpdateQueue() {
    let queue = Promise.resolve();
    return (task) => {
        const next = queue.then(task, task);
        queue = next.catch(() => {});
        return next;
    };
}

export function createMongoDataStore() {
    const uri = requireMongoUri();
    const dbName = databaseName();
    const appStateCollection = collectionName();
    const documentId = stateId();
    const runSerialized = createUpdateQueue();
    let clientPromise = null;

    async function client() {
        if (!clientPromise) {
            clientPromise = import("mongodb").then(({ MongoClient }) => {
                const mongoClient = new MongoClient(uri, {
                    appName: "SmartTransit",
                    ignoreUndefined: true,
                });
                return mongoClient.connect();
            });
        }
        return clientPromise;
    }

    async function collection() {
        const mongoClient = await client();
        return mongoClient.db(dbName).collection(appStateCollection);
    }

    async function loadState() {
        const appState = await collection();
        const existing = await appState.findOne({ _id: documentId });
        if (existing?.data) {
            return clone(existing.data);
        }

        if (process.env.NODE_ENV === 'production' || documentId === 'production')
            throw new Error('Production database is not initialized. Provision reviewed transport data and an administrator before starting the service.');
        const data = createSeedData();
        const now = new Date();
        await appState.updateOne({ _id: documentId }, {
            $setOnInsert: { createdAt: now, data, updatedAt: now, revision: 0 },
        }, { upsert: true });
        return clone((await appState.findOne({ _id: documentId })).data);
    }

    async function saveState(data) {
        const appState = await collection();
        const now = new Date();
        await appState.updateOne({ _id: documentId }, {
            $setOnInsert: { createdAt: now },
            $set: { data, updatedAt: now },
        }, { upsert: true });
    }

    return {
        storageType: "mongodb",
        description: `MongoDB ${dbName}.${appStateCollection}/${documentId}`,
        async ready() {
            const mongoClient = await client();
            await mongoClient.db(dbName).command({ ping: 1 });
            await loadState();
        },
        async get() {
            return clone(await loadState());
        },
        async update(mutator) {
            return runSerialized(async () => {
                await loadState();
                const appState = await collection();
                // Mutators only change the state document. Retry if another process commits first.
                for (let attempt = 0; attempt < 8; attempt += 1) {
                    const snapshot = await appState.findOne({ _id: documentId });
                    const data = clone(snapshot.data);
                    const result = await mutator(data);
                    const saved = await appState.updateOne({
                        _id: documentId,
                        revision: snapshot.revision === undefined ? { $exists: false } : snapshot.revision,
                    }, { $set: { data, updatedAt: new Date() }, $inc: { revision: 1 } });
                    if (saved.modifiedCount === 1) return clone(result);
                }
                throw new Error('Transport data changed concurrently. Please retry the same request.');
            });
        },
        async reset() {
            return runSerialized(async () => {
                const data = createSeedData();
                await saveState(data);
                return clone(data);
            });
        },
        async close() {
            if (!clientPromise)
                return;
            const mongoClient = await clientPromise;
            await mongoClient.close();
            clientPromise = null;
        },
    };
}
