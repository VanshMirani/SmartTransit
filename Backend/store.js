import { createDataStore } from "./dataStore.js";
import { createMongoDataStore } from "./mongoDataStore.js";

function selectedStorage() {
    return process.env.SMARTTRANSIT_STORAGE?.trim().toLowerCase();
}

export async function createSmartTransitStore() {
    const storage = selectedStorage();
    const shouldUseMongo = storage === "mongodb" ||
        (!storage && Boolean(process.env.SMARTTRANSIT_MONGODB_URI?.trim()));

    if (!shouldUseMongo) {
        return createDataStore();
    }

    const store = createMongoDataStore();
    await store.ready();
    return store;
}
