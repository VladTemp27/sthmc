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
        console.log('[http-functions]', 'POST /_functions/login start');
        console.info('[http-functions]', 'POST /_functions/login called');
        const result = await loginFromRequest(request);
        console.log('[http-functions]', 'POST /_functions/login result', result.status);
        console.info('[http-functions]', 'POST /_functions/login completed', {
            ok: result.ok,
            status: result.status
        });
        return fromResult(result);
    } catch (err) {
        console.error('[http-functions]', 'POST /_functions/login failed', {
            message: err?.message || 'Unknown error'
        });
        return withJsonHeaders(serverError({ body: jsonBody({ error: 'Internal server error' }) }));
    }
}

export async function post_logout(request) {
    try {
        console.log('[http-functions]', 'POST /_functions/logout start');
        console.info('[http-functions]', 'POST /_functions/logout called');
        const result = await logoutFromRequest(request);
        console.log('[http-functions]', 'POST /_functions/logout result', result.status);
        console.info('[http-functions]', 'POST /_functions/logout completed', {
            ok: result.ok,
            status: result.status
        });
        return fromResult(result);
    } catch (err) {
        console.error('[http-functions]', 'POST /_functions/logout failed', {
            message: err?.message || 'Unknown error'
        });
        return withJsonHeaders(serverError({ body: jsonBody({ error: 'Internal server error' }) }));
    }
}

export async function get_me(request) {
    try {
        console.log('[http-functions]', 'GET /_functions/me start');
        console.info('[http-functions]', 'GET /_functions/me called');
        const result = await meFromRequest(request);
        console.log('[http-functions]', 'GET /_functions/me result', result.status);
        console.info('[http-functions]', 'GET /_functions/me completed', {
            ok: result.ok,
            status: result.status
        });
        return fromResult(result);
    } catch (err) {
        console.error('[http-functions]', 'GET /_functions/me failed', {
            message: err?.message || 'Unknown error'
        });
        return withJsonHeaders(serverError({ body: jsonBody({ error: 'Internal server error' }) }));
    }
}
