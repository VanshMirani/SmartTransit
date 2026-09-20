import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { randomUUID } from 'node:crypto';
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createSeedData } from "./seedData.js";

const backendDir = path.dirname(fileURLToPath(import.meta.url));
const defaultDataFile = path.join(backendDir, "data", "smarttransit-db.json");
const clone = (value) => JSON.parse(JSON.stringify(value));

export function createDataStore(dataFile = process.env.SMARTTRANSIT_DB_FILE || defaultDataFile) {
    let cache = null;
    let loading;
    let queue = Promise.resolve();
    const serialized = (task) => {
        const next = queue.then(task);
        queue = next.catch(() => {});
        return next;
    };

    async function ensureLoaded() {
        if (cache)
            return cache;

        if (loading) return loading;
        loading = (async () => { try {
            cache = JSON.parse(await readFile(dataFile, "utf8"));
        }
        catch (error) {
            if (error.code !== 'ENOENT') throw error;
            const seed = createSeedData();
            await save(seed);
            cache = seed;
        }
        return cache; })();
        return loading;
    }

    async function save(data) {
        await mkdir(path.dirname(dataFile), { recursive: true });
        const temporaryFile = `${dataFile}.${randomUUID()}.tmp`;
        await writeFile(temporaryFile, JSON.stringify(data, null, 2), { mode: 0o600 });
        await rename(temporaryFile, dataFile);
    }

    return {
        storageType: "json",
        dataFile,
        description: dataFile,
        async get() {
            return clone(await ensureLoaded());
        },
        async update(mutator) {
            return serialized(async () => {
                const data = clone(await ensureLoaded());
                const result = await mutator(data);
                await save(data);
                cache = data;
                return clone(result);
            });
        },
        async reset() {
            return serialized(async () => {
                const seed = createSeedData();
                await save(seed);
                cache = seed;
                return clone(cache);
            });
        },
    };
}
