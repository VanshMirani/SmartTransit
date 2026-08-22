import { loadEnvFile } from "../env.js";
import { createSmartTransitStore } from "../store.js";

loadEnvFile();

const required = [
    "VITE_USE_BACKEND",
    "VITE_API_BASE_URL",
    "SMARTTRANSIT_STORAGE",
    "SMARTTRANSIT_MONGODB_URI",
    "SMARTTRANSIT_MONGODB_DB",
    "SMARTTRANSIT_ALLOWED_ORIGIN",
    "SMARTTRANSIT_SMTP_HOST",
    "SMARTTRANSIT_SMTP_PORT",
    "SMARTTRANSIT_SMTP_USER",
    "SMARTTRANSIT_SMTP_PASS",
    "SMARTTRANSIT_MAIL_FROM",
    "SMARTTRANSIT_OTP_SECRET",
];

const missing = required.filter((key) => !process.env[key]?.trim());

if (process.env.VITE_USE_BACKEND !== "true") {
    missing.push("VITE_USE_BACKEND must be true");
}

if (process.env.SMARTTRANSIT_STORAGE !== "mongodb") {
    missing.push("SMARTTRANSIT_STORAGE must be mongodb");
}

if (missing.length) {
    console.error("Production configuration is incomplete:");
    for (const item of missing) {
        console.error(`- ${item}`);
    }
    process.exit(1);
}

const store = await createSmartTransitStore();
await store.close?.();

console.log("Production configuration looks ready.");
console.log(`Storage: ${store.description}`);
