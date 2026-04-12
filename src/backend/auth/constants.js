export const COLLECTIONS = {
    USERS: 'CustomUsers',
    SESSIONS: 'AuthSessions'
};

export const COOKIE = {
    NAME: 'custom_auth_session',
    PATH: '/',
    SAME_SITE: 'Lax',
    MAX_AGE_SECONDS: 86400
};

export const SESSION = {
    TTL_MS: COOKIE.MAX_AGE_SECONDS * 1000,
    ID_BYTES: 32
};

export const LOGIN = {
    FAILED_ATTEMPTS_LOCKOUT_THRESHOLD: 5,
    LOCKOUT_MS: 15 * 60 * 1000,
    RATE_LIMIT_MAX_ATTEMPTS: 10,
    RATE_LIMIT_WINDOW_MS: 5 * 60 * 1000
};

export const PASSWORD = {
    ALGORITHM: 'pbkdf2',
    ITERATIONS: 120000,
    KEY_LENGTH: 32,
    DIGEST: 'sha256',
    SALT_BYTES: 16
};

export const GENERIC_LOGIN_ERROR_MESSAGE = 'Invalid email or password.';
