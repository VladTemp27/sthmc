import { ok, badRequest, unauthorized, tooManyRequests, serverError } from 'wix-http-functions';
import { loginFromRequest, logoutFromRequest, meFromRequest } from 'backend/auth/authService';

function withJsonHeaders(response, extraHeaders = {}) {
    return {
        ...response,
        headers: {
            'Content-Type': 'application/json',
            ...(response.headers || {}),
            ...extraHeaders
        }
    };
}

function jsonBody(payload) {
    return JSON.stringify(payload);
}

function fromResult(result) {
    const headers = result.cookie ? { 'Set-Cookie': result.cookie } : {};

    if (result.ok) {
        return withJsonHeaders(ok({ body: jsonBody(result.data || {}) }), headers);
    }

    const errorPayload = { error: result.error || 'Request failed' };

    switch (result.status) {
    case 400:
        return withJsonHeaders(badRequest({ body: jsonBody(errorPayload) }), headers);
    case 401:
        return withJsonHeaders(unauthorized({ body: jsonBody(errorPayload) }), headers);
    case 429:
        return withJsonHeaders(tooManyRequests({ body: jsonBody(errorPayload) }), headers);
    default:
        return withJsonHeaders(serverError({ body: jsonBody({ error: 'Internal server error' }) }), headers);
    }
}

export async function post_login(request) {
    try {
        const result = await loginFromRequest(request);
        return fromResult(result);
    } catch (_err) {
        return withJsonHeaders(serverError({ body: jsonBody({ error: 'Internal server error' }) }));
    }
}

export async function post_logout(request) {
    try {
        const result = await logoutFromRequest(request);
        return fromResult(result);
    } catch (_err) {
        return withJsonHeaders(serverError({ body: jsonBody({ error: 'Internal server error' }) }));
    }
}

export async function get_me(request) {
    try {
        const result = await meFromRequest(request);
        return fromResult(result);
    } catch (_err) {
        return withJsonHeaders(serverError({ body: jsonBody({ error: 'Internal server error' }) }));
    }
}
