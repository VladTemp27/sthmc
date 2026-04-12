import crypto from 'crypto';
import { PASSWORD } from 'backend/auth/constants';

function toBase64(buffer) {
    return Buffer.from(buffer).toString('base64');
}

function fromBase64(value) {
    return Buffer.from(value, 'base64');
}

function deriveKey(password, salt, iterations) {
    return crypto.pbkdf2Sync(password, salt, iterations, PASSWORD.KEY_LENGTH, PASSWORD.DIGEST);
}

export function hashPassword(plainPassword) {
    const password = String(plainPassword || '');
    const salt = crypto.randomBytes(PASSWORD.SALT_BYTES);
    const hash = deriveKey(password, salt, PASSWORD.ITERATIONS);

    return [
        PASSWORD.ALGORITHM,
        String(PASSWORD.ITERATIONS),
        toBase64(salt),
        toBase64(hash)
    ].join('$');
}

export function verifyPassword(plainPassword, storedHash) {
    const password = String(plainPassword || '');
    const serialized = String(storedHash || '');
    const parts = serialized.split('$');

    if (parts.length !== 4) {
        return false;
    }

    const [algorithm, iterationRaw, saltBase64, hashBase64] = parts;
    if (algorithm !== PASSWORD.ALGORITHM) {
        return false;
    }

    const iterations = Number(iterationRaw);
    if (!Number.isFinite(iterations) || iterations < 1000) {
        return false;
    }

    try {
        const salt = fromBase64(saltBase64);
        const expectedHash = fromBase64(hashBase64);
        const actualHash = deriveKey(password, salt, iterations);

        if (expectedHash.length !== actualHash.length) {
            return false;
        }

        return crypto.timingSafeEqual(expectedHash, actualHash);
    } catch (_err) {
        return false;
    }
}
