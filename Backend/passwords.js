import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const algorithm = "scrypt";
const keyLength = 64;

export function hashPassword(password) {
    const salt = randomBytes(16).toString("hex");
    const hash = scryptSync(String(password), salt, keyLength).toString("hex");
    return `${algorithm}:${salt}:${hash}`;
}

export function verifyPassword(password, user) {
    if (user.passwordHash?.startsWith(`${algorithm}:`)) {
        const [, salt, expectedHash] = user.passwordHash.split(":");
        const expected = Buffer.from(expectedHash, "hex");
        const actual = scryptSync(String(password), salt, expected.length);
        return expected.length === actual.length && timingSafeEqual(expected, actual);
    }

    return Boolean(user.password) && user.password === password;
}
