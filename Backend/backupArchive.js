import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { BSON } from 'mongodb';

const header = Buffer.from('SMARTTRANSIT-BACKUP-1\n');
export function encryptBackup(document, key) {
    if (!Buffer.isBuffer(key) || key.length !== 32) throw new Error('A 32-byte backup key is required.');
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(header);
    const plain = BSON.serialize(document);
    try {
        const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
        return Buffer.concat([header, iv, cipher.getAuthTag(), encrypted]);
    } finally { plain.fill(0); }
}

export function decryptBackup(archive, key) {
    if (!Buffer.isBuffer(key) || key.length !== 32) throw new Error('A 32-byte backup key is required.');
    if (archive.length < header.length + 29 || !archive.subarray(0, header.length).equals(header))
        throw new Error('Unsupported or incomplete backup archive.');
    const offset = header.length;
    const decipher = createDecipheriv('aes-256-gcm', key, archive.subarray(offset, offset + 12));
    decipher.setAAD(header);
    decipher.setAuthTag(archive.subarray(offset + 12, offset + 28));
    const plain = Buffer.concat([decipher.update(archive.subarray(offset + 28)), decipher.final()]);
    try { return BSON.deserialize(plain); }
    finally { plain.fill(0); }
}
