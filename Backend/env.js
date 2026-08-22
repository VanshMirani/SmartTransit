import { readFileSync } from "node:fs";

function cleanValue(value) {
    const trimmed = value.trim();
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        return trimmed.slice(1, -1);
    }
    return trimmed;
}

export function loadEnvFile(filePath = ".env") {
    try {
        const contents = readFileSync(filePath, "utf8");
        for (const line of contents.split(/\r?\n/)) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith("#"))
                continue;
            const separator = trimmed.indexOf("=");
            if (separator === -1)
                continue;
            const key = trimmed.slice(0, separator).trim();
            const value = cleanValue(trimmed.slice(separator + 1));
            if (key && process.env[key] === undefined) {
                process.env[key] = value;
            }
        }
    }
    catch (error) {
        if (error.code !== "ENOENT")
            throw error;
    }
}
