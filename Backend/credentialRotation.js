import { hashPassword, verifyPassword } from './passwords.js';
import { validatePassword } from '../Frontend/src/utils/registrationValidation.js';

// Offline maintenance only. Validate the entire narrow plan before mutating any account.
export function rotatePublishedAccounts(data, replacements) {
    const roles = ['admin', 'conductor', 'student'];
    if (!Array.isArray(replacements) || replacements.length !== roles.length ||
        roles.some((role) => replacements.filter((item) => item.role === role).length !== 1))
        throw new Error('Confirm exactly the admin, student and conductor fixture accounts.');
    const changes = replacements.map((item) => {
        const matches = data.users.filter((user) => user.id === item.id && user.role === item.role && user.email === item.email);
        if (matches.length !== 1) throw new Error('An intended account is missing or ambiguous. Nothing was rotated.');
        const user = matches[0];
        if (!Array.isArray(item.publishedPasswords) || !item.publishedPasswords.some((password) => verifyPassword(password, user)))
            throw new Error('An account no longer matches the reviewed published passwords. Nothing was rotated.');
        if (typeof item.newPassword !== 'string' || validatePassword(item.newPassword) ||
            item.publishedPasswords.includes(item.newPassword) || verifyPassword(item.newPassword, user))
            throw new Error('A new, non-published strong password is required. Nothing was rotated.');
        return { user, passwordHash: hashPassword(item.newPassword) };
    });
    if (new Set(changes.map(({ user }) => user.id)).size !== roles.length)
        throw new Error('Account identifiers must be unique. Nothing was rotated.');
    const ids = new Set(changes.map(({ user }) => user.id));
    const tokens = Object.keys(data.sessions ?? {}).filter((token) => ids.has(data.sessions[token]?.userId));
    for (const { user, passwordHash } of changes) {
        user.passwordHash = passwordHash;
        delete user.password;
        const email = user.email.toLowerCase();
        // Old reset challenges must not remain a route back into a rotated account.
        if (data.passwordResetOtps) delete data.passwordResetOtps[email];
    }
    for (const token of tokens) delete data.sessions[token];
    return { roles, revokedSessions: tokens.length };
}
