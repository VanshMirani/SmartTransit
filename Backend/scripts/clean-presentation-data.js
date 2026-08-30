import { loadEnvFile } from "../env.js";
import { cleanPresentationData } from "../seedData.js";

loadEnvFile();

const args = process.argv.slice(2);

function parseArgs(values) {
    const options = {
        apply: false,
        keepEmails: [],
    };
    for (let index = 0; index < values.length; index += 1) {
        const value = values[index];
        if (value === "--apply") {
            options.apply = true;
            continue;
        }
        if (value === "--keep-email") {
            const email = values[index + 1];
            if (email) {
                options.keepEmails.push(email);
                index += 1;
            }
            continue;
        }
        if (value.startsWith("--keep-email=")) {
            options.keepEmails.push(value.slice("--keep-email=".length));
        }
    }
    return options;
}

function countState(data) {
    return {
        users: data.users?.length ?? 0,
        studentRecords: data.admin?.records?.students?.length ?? 0,
        notifications: data.communications?.notifications?.length ?? 0,
        campaigns: data.communications?.campaigns?.length ?? 0,
        complaints: data.communications?.complaints?.length ?? 0,
        seatUpdates: data.operations?.seatUpdates?.length ?? 0,
        sessions: Object.keys(data.sessions ?? {}).length,
    };
}

function summarize(before, after) {
    const beforeCounts = countState(before);
    const afterCounts = countState(after);
    return Object.fromEntries(Object.keys(beforeCounts).map((key) => [
        key,
        `${beforeCounts[key]} -> ${afterCounts[key]}`,
    ]));
}

const options = parseArgs(args);
const { createSmartTransitStore } = await import("../store.js");
const store = await createSmartTransitStore();
const before = await store.get();
const after = cleanPresentationData(before, { keepEmails: options.keepEmails });
const summary = summarize(before, after);

console.log(`SmartTransit presentation cleanup for ${store.description ?? store.storageType ?? "configured storage"}`);
console.table(summary);
console.log(`Kept accounts: ${after.users.map((user) => user.email).join(", ")}`);

if (!options.apply) {
    console.log("Dry run only. Run again with --apply to update the database.");
    await store.close?.();
    process.exit(0);
}

await store.update((data) => {
    Object.keys(data).forEach((key) => delete data[key]);
    Object.assign(data, after);
    return true;
});

await store.close?.();
console.log("Presentation cleanup applied.");
