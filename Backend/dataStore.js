import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createSeedData } from "./seedData.js";

const backendDir = path.dirname(fileURLToPath(import.meta.url));
const defaultDataFile = path.join(backendDir, "data", "smarttransit-db.json");
const clone = (value) => JSON.parse(JSON.stringify(value));

export function createDataStore(dataFile = process.env.SMARTTRANSIT_DB_FILE || defaultDataFile) {
    let cache = null;

    async function ensureLoaded() {
        if (cache)
            return cache;

        try {
            cache = JSON.parse(await readFile(dataFile, "utf8"));
        }
        catch {
            cache = createSeedData();
            await save();
        }
        return cache;
    }

    async function save() {
        await mkdir(path.dirname(dataFile), { recursive: true });
        await writeFile(dataFile, JSON.stringify(cache, null, 2));
    }

    return {
        storageType: "json",
        dataFile,
        description: dataFile,
        async get() {
            return clone(await ensureLoaded());
        },
        async update(mutator) {
            const data = await ensureLoaded();
            const result = await mutator(data);
            await save();
            return clone(result);
        },
        async reset() {
            cache = createSeedData();
            await save();
            return clone(cache);
        },
    };
}
