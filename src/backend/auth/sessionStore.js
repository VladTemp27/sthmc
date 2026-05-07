import crypto from 'crypto';
import wixData from 'wix-data';
import { COLLECTIONS, SESSION } from 'backend/auth/constants';

function generateSessionId() {
    return crypto.randomBytes(SESSION.ID_BYTES).toString('base64url');
}

function toDateTime(value) {
    return value instanceof Date ? value : new Date(value);
}

function isExpired(session, now = Date.now()) {
    const expiresAtMs = new Date(session.expiresAt).getTime();
    return !Number.isFinite(expiresAtMs) || expiresAtMs <= now;
}

export async function createSession({ userId, ipHash, userAgent, now = Date.now() }) {
    const sessionId = generateSessionId();

    await wixData.insert(COLLECTIONS.SESSIONS, {
        sessionId,
        userId,
        createdAt: new Date(now),
        expiresAt: new Date(now + SESSION.TTL_MS),
        ipHash,
        userAgent
    }, { suppressAuth: true, suppressHooks: true });

    return sessionId;
}

export async function getSession(sessionId, now = Date.now()) {
    const result = await wixData.query(COLLECTIONS.SESSIONS)
        .eq('sessionId', sessionId)
        .limit(1)
        .find({ suppressAuth: true, suppressHooks: true });

    const session = result.items?.[0];
    if (!session) {
        return null;
    }

    if (isExpired(session, now)) {
        if (session._id) {
            await wixData.remove(COLLECTIONS.SESSIONS, session._id, { suppressAuth: true, suppressHooks: true });
        }
        return null;
    }

    return {
        ...session,
        createdAt: toDateTime(session.createdAt),
        expiresAt: toDateTime(session.expiresAt)
    };
}

export async function revokeSession(sessionId) {
    const result = await wixData.query(COLLECTIONS.SESSIONS)
        .eq('sessionId', sessionId)
        .limit(1)
        .find({ suppressAuth: true, suppressHooks: true });

    const session = result.items?.[0];
    if (!session?._id) {
        return false;
    }

    await wixData.remove(COLLECTIONS.SESSIONS, session._id, { suppressAuth: true, suppressHooks: true });
    return true;
}
