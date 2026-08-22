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

        const data = createSeedData();
        const now = new Date();
        await appState.updateOne({ _id: documentId }, {
            $setOnInsert: { createdAt: now },
            $set: { data, updatedAt: now },
        }, { upsert: true });
        return clone(data);
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
                const data = await loadState();
                const result = await mutator(data);
                await saveState(data);
                return clone(result);
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
