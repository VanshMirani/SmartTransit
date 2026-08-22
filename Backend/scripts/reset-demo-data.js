import { createDataStore } from "../dataStore.js";

const store = createDataStore();
const data = await store.reset();

console.log(`SmartTransit demo data reset at ${store.dataFile}`);
console.log(`Routes: ${data.routes.length}`);
console.log(`Users: ${data.users.length}`);
console.log(`Complaints: ${data.communications.complaints.length}`);
