import { LOGIN } from 'backend/auth/constants';

const attemptStore = new Map();

function getWindowStart(now) {
    return now - LOGIN.RATE_LIMIT_WINDOW_MS;
}

function pruneAttempts(attempts, now) {
    const minTs = getWindowStart(now);
    return attempts.filter((ts) => ts >= minTs);
}

function getEntry(key) {
    const entry = attemptStore.get(key);
    if (!entry) {
        return {
            attempts: []
        };
    }

    return entry;
}

function setEntry(key, entry) {
    if (!entry.attempts.length) {
        attemptStore.delete(key);
        return;
    }

    attemptStore.set(key, entry);
}

export function isRateLimited(key, now = Date.now()) {
    const entry = getEntry(key);
    const attempts = pruneAttempts(entry.attempts, now);
    setEntry(key, { attempts });
    return attempts.length >= LOGIN.RATE_LIMIT_MAX_ATTEMPTS;
}

export function recordFailedAttempt(key, now = Date.now()) {
    const entry = getEntry(key);
    const attempts = pruneAttempts(entry.attempts, now);
    attempts.push(now);
    setEntry(key, { attempts });
}

export function clearAttempts(key) {
    attemptStore.delete(key);
}
