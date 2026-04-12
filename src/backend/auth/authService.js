import crypto from 'crypto';
import wixData from 'wix-data';
import {
    COLLECTIONS,
    COOKIE,
    GENERIC_LOGIN_ERROR_MESSAGE,
    LOGIN
} from 'backend/auth/constants';
import { verifyPassword } from 'backend/auth/password';
import { clearAttempts, isRateLimited, recordFailedAttempt } from 'backend/auth/loginPolicy';
import { createSession, getSession, revokeSession } from 'backend/auth/sessionStore';
import { normalizeEmail, safeString, validateEmail } from 'backend/auth/validators';

function hashIp(ip) {
    return crypto.createHash('sha256').update(String(ip || '')).digest('hex');
}

function getClientIp(request) {
    const headerIp = request?.headers?.['x-forwarded-for'] || request?.headers?.['X-Forwarded-For'];
    if (headerIp) {
        return String(headerIp).split(',')[0].trim();
    }

    return request?.ip || 'unknown';
}

async function parseRequestBody(request) {
    if (!request?.body) {
        return {};
    }

    if (typeof request.body.json === 'function') {
        try {
            return await request.body.json();
        } catch (_err) {
            return {};
        }
    }

    if (typeof request.body.text === 'function') {
        try {
            const rawText = await request.body.text();
            return rawText ? JSON.parse(rawText) : {};
        } catch (_err) {
            return {};
        }
    }

    if (typeof request.body === 'string') {
        try {
            return JSON.parse(request.body);
        } catch (_err) {
            return {};
        }
    }

    return request.body;
}

async function getUserByEmail(email) {
    const result = await wixData.query(COLLECTIONS.USERS)
        .eq('email', email)
        .limit(1)
        .find();

    return result.items?.[0] || null;
}

function loginFailedResponse(status = 401) {
    return {
        ok: false,
        status,
        error: GENERIC_LOGIN_ERROR_MESSAGE
    };
}

function isUserLocked(user, now = Date.now()) {
    if (!user?.lockUntil) {
        return false;
    }

    return new Date(user.lockUntil).getTime() > now;
}

function buildRateLimitKey(email, ip) {
    return `${email}|${ip}`;
}

async function handleFailedPassword(user, now) {
    const nextFailedCount = Number(user.failedLoginCount || 0) + 1;
    const updates = {
        failedLoginCount: nextFailedCount
    };

    if (nextFailedCount >= LOGIN.FAILED_ATTEMPTS_LOCKOUT_THRESHOLD) {
        updates.lockUntil = new Date(now + LOGIN.LOCKOUT_MS);
        updates.failedLoginCount = 0;
    }

    await wixData.update(COLLECTIONS.USERS, {
        ...user,
        ...updates
    });
}

function createSetCookieHeader(sessionId, secure = true) {
    const parts = [
        `${COOKIE.NAME}=${encodeURIComponent(sessionId)}`,
        `Max-Age=${COOKIE.MAX_AGE_SECONDS}`,
        `Path=${COOKIE.PATH}`,
        'HttpOnly',
        `SameSite=${COOKIE.SAME_SITE}`
    ];

    if (secure) {
        parts.push('Secure');
    }

    return parts.join('; ');
}

function createExpiredCookieHeader(secure = true) {
    const parts = [
        `${COOKIE.NAME}=`,
        'Max-Age=0',
        `Path=${COOKIE.PATH}`,
        'HttpOnly',
        `SameSite=${COOKIE.SAME_SITE}`
    ];

    if (secure) {
        parts.push('Secure');
    }

    return parts.join('; ');
}

function getCookieValue(request, cookieName) {
    const cookieHeader = request?.headers?.cookie || request?.headers?.Cookie || '';
    const cookieParts = String(cookieHeader).split(';').map((v) => v.trim());

    for (const part of cookieParts) {
        if (!part) {
            continue;
        }

        const [key, ...rest] = part.split('=');
        if (key !== cookieName) {
            continue;
        }

        return decodeURIComponent(rest.join('='));
    }

    return null;
}

export async function loginFromRequest(request) {
    const payload = await parseRequestBody(request);
    const email = normalizeEmail(payload.email);
    const password = String(payload.password || '');
    const ip = getClientIp(request);
    const rateKey = buildRateLimitKey(email, ip);

    if (!validateEmail(email) || !password) {
        return loginFailedResponse(400);
    }

    if (isRateLimited(rateKey)) {
        return {
            ok: false,
            status: 429,
            error: 'Too many login attempts. Please try again later.'
        };
    }

    const user = await getUserByEmail(email);
    if (!user || !user.isActive) {
        recordFailedAttempt(rateKey);
        return loginFailedResponse(401);
    }

    const now = Date.now();
    if (isUserLocked(user, now)) {
        recordFailedAttempt(rateKey);
        return loginFailedResponse(401);
    }

    const passwordOk = verifyPassword(password, user.passwordHash);
    if (!passwordOk) {
        recordFailedAttempt(rateKey);
        await handleFailedPassword(user, now);
        return loginFailedResponse(401);
    }

    const ipHash = hashIp(ip);
    const userAgent = safeString(request?.headers?.['user-agent'] || request?.headers?.['User-Agent'] || '');
    const sessionId = await createSession({
        userId: user._id,
        ipHash,
        userAgent,
        now
    });

    await wixData.update(COLLECTIONS.USERS, {
        ...user,
        failedLoginCount: 0,
        lockUntil: null,
        lastLoginAt: new Date(now)
    });

    clearAttempts(rateKey);

    return {
        ok: true,
        status: 200,
        data: {
            user: {
                id: user._id,
                email: user.email,
                role: user.role || null
            }
        },
        cookie: createSetCookieHeader(sessionId, true)
    };
}

export async function logoutFromRequest(request) {
    const sessionId = getCookieValue(request, COOKIE.NAME);
    if (sessionId) {
        await revokeSession(sessionId);
    }

    return {
        ok: true,
        status: 200,
        data: { success: true },
        cookie: createExpiredCookieHeader(true)
    };
}

export async function meFromRequest(request) {
    const sessionId = getCookieValue(request, COOKIE.NAME);
    if (!sessionId) {
        return {
            ok: false,
            status: 401,
            error: 'Unauthorized'
        };
    }

    const session = await getSession(sessionId);
    if (!session) {
        return {
            ok: false,
            status: 401,
            error: 'Unauthorized'
        };
    }

    const user = await wixData.get(COLLECTIONS.USERS, session.userId);
    if (!user || !user.isActive) {
        return {
            ok: false,
            status: 401,
            error: 'Unauthorized'
        };
    }

    return {
        ok: true,
        status: 200,
        data: {
            user: {
                id: user._id,
                email: user.email,
                role: user.role || null
            }
        }
    };
}
