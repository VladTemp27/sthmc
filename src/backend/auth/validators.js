const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
}

export function validateEmail(email) {
    if (!email) {
        return false;
    }

    if (email.length > 254) {
        return false;
    }

    return EMAIL_REGEX.test(email);
}

export function safeString(value, maxLength = 512) {
    const text = String(value || '').trim();
    return text.length > maxLength ? text.slice(0, maxLength) : text;
}

export function nowMs() {
    return Date.now();
}
