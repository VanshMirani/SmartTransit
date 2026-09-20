import { createDataStore } from "./dataStore.js";
import { createMongoDataStore } from "./mongoDataStore.js";

function selectedStorage() {
    return process.env.SMARTTRANSIT_STORAGE?.trim().toLowerCase();
}

export async function createSmartTransitStore() {
    const storage = selectedStorage();
    if (storage && !['json', 'mongodb'].includes(storage))
        throw new Error('SMARTTRANSIT_STORAGE must be json or mongodb.');
    if (process.env.NODE_ENV === 'production' && storage !== 'mongodb')
        throw new Error('Production requires SMARTTRANSIT_STORAGE=mongodb.');
    const shouldUseMongo = storage === "mongodb" ||
        (!storage && Boolean(process.env.SMARTTRANSIT_MONGODB_URI?.trim()));

    if (!shouldUseMongo) {
        return createDataStore();
    }

    const store = createMongoDataStore();
    await store.ready();
    return store;
}
