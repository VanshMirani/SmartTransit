import { loadEnvFile } from "../env.js";
import { getMissingMailSettings } from "../emailService.js";
import { productionBackendErrors } from '../productionConfiguration.js';
import { resolveBackendConfiguration } from '../../Frontend/src/services/backendConfiguration.js';

loadEnvFile();

const required = [
    "VITE_USE_BACKEND",
    "VITE_API_BASE_URL",
    "SMARTTRANSIT_STORAGE",
    "SMARTTRANSIT_MONGODB_URI",
    "SMARTTRANSIT_MONGODB_DB",
    "SMARTTRANSIT_ALLOWED_ORIGIN",
];

const missing = required.filter((key) => !process.env[key]?.trim());
missing.push(...getMissingMailSettings());
missing.push(...productionBackendErrors(process.env));
if (resolveBackendConfiguration({ ...process.env, PROD: true }).configurationError)
    missing.push('VITE_API_BASE_URL must be a valid HTTPS API URL without embedded credentials, query or fragment');
if (Object.keys(process.env).some((name) => /^VITE_.*(?:PASSWORD|SECRET|PRIVATE_KEY|API_KEY|TOKEN)$/i.test(name) && process.env[name]?.trim()))
    missing.push('Remove credentials from frontend-exposed VITE_* variables');

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

console.log("Required configuration is present. No database connection or mutation was performed.");
console.log("This check does not verify deployment, database contents, email delivery or phone GPS.");
