import { loadEnvFile } from "./env.js";

loadEnvFile();

const { createApiServer } = await import("./apiServer.js");
const { createSmartTransitStore } = await import("./store.js");

const port = Number(process.env.API_PORT ?? process.env.PORT ?? 5050);
const store = await createSmartTransitStore();
const server = createApiServer(store);

server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
        console.error(`Port ${port} is already in use. Try API_PORT=${port + 1} npm run backend.`);
        process.exit(1);
    }
    throw error;
});

server.listen(port, () => {
    console.log(`SmartTransit API running at http://127.0.0.1:${port}/api`);
    console.log(`Storage: ${store.description ?? store.storageType ?? "configured"}`);
});

async function shutdown() {
    await store.close?.();
    server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
