import wixLocation from 'wix-location';
import { session } from 'wix-storage';
import { login as loginViaWebModule } from 'backend/auth-api';

const DEFAULT_SUCCESS_PATH = '/homepage';
const GENERIC_ERROR = 'Invalid email or password.';
const SESSION_KEY = 'custom_auth_session_id';
const LOADING_BUTTON_LABEL = 'Logging in...';

let isSubmitting = false;
let activeSubmitButtonSelector = null;
let defaultSubmitButtonLabel = 'Log in';

function maskEmail(email) {
    const value = String(email || '');
    const [local = '', domain = ''] = value.split('@');
    if (!local || !domain) {
        return 'invalid';
    }

    return `${local.slice(0, 2)}***@${domain}`;
}

function getValueIfExists(selector) {
    try {
        const element = $w(selector);
        return typeof element.value === 'string' ? element.value : '';
    } catch (_err) {
        return '';
    }
}

async function revealIfExists(selector) {
    try {
        const element = $w(selector);
        if (typeof element.expand === 'function') {
            await element.expand();
        }
        if (typeof element.show === 'function') {
            await element.show();
        }
    } catch (_err) {
        // No-op when element ID is unavailable in this environment.
    }
}

async function showErrorMessage(text) {
    try {
        await revealIfExists('#loginSection');
        await revealIfExists('#loginform');

        const errorElement = $w('#errorText');

        console.log('[login-page] errorText state before', {
            hidden: 'hidden' in errorElement ? errorElement.hidden : 'n/a',
            collapsed: 'collapsed' in errorElement ? errorElement.collapsed : 'n/a'
        });

        if (typeof errorElement.text === 'string') {
            errorElement.text = text;
        }

        if (typeof errorElement.expand === 'function') {
            await errorElement.expand();
        }
        if (typeof errorElement.show === 'function') {
            await errorElement.show();
        }

        console.log('[login-page] errorText state after', {
            hidden: 'hidden' in errorElement ? errorElement.hidden : 'n/a',
            collapsed: 'collapsed' in errorElement ? errorElement.collapsed : 'n/a',
            text: errorElement.text
        });

        setTimeout(async () => {
            try {
                const retryElement = $w('#errorText');
                if (typeof retryElement.show === 'function') {
                    await retryElement.show();
                }
                if (typeof retryElement.expand === 'function') {
                    await retryElement.expand();
                }
            } catch (_err) {
                // No-op on retry visibility sync.
            }
        }, 0);
    } catch (_err) {
        console.error('[login-page] failed to show #errorText', _err?.message || 'unknown error');
    }

    console.log('[login-page] error message displayed', {
        text
    });
}

function clearErrorText(selector) {
    try {
        const element = $w(selector);
        if (typeof element.text === 'string') {
            element.text = '';
        }
    } catch (_err) {
        // No-op when element ID is unavailable in this environment.
    }
}

function setLoadingState(isLoading) {
    if (!activeSubmitButtonSelector) {
        return;
    }

    try {
        const button = $w(activeSubmitButtonSelector);

        if (isLoading) {
            if (typeof button.label === 'string' && button.label) {
                defaultSubmitButtonLabel = button.label;
            }
            button.label = LOADING_BUTTON_LABEL;
            if (typeof button.disable === 'function') {
                button.disable();
            }
            return;
        }

        button.label = defaultSubmitButtonLabel;
        if (typeof button.enable === 'function') {
            button.enable();
        }
    } catch (_err) {
        // No-op when button selector is unavailable.
    }
}

function getRedirectTarget() {
    try {
        const queryTarget = wixLocation.query?.redirect;
        if (queryTarget && String(queryTarget).startsWith('/')) {
            return queryTarget;
        }
    } catch (_err) {
        // Ignore malformed or unavailable query access.
    }

    return DEFAULT_SUCCESS_PATH;
}

async function submitLogin() {
    console.log('[login-page] submitLogin invoked');

    if (isSubmitting) {
        return;
    }

    clearErrorText('#errorText');

    const email = getValueIfExists('#emailInput').trim();
    const password = getValueIfExists('#passwordInput');

    console.log('[login-page] payload collected', {
        email: maskEmail(email),
        hasPassword: Boolean(password)
    });

    if (!email || !password) {
        console.log('[login-page] blocked: missing email or password');
        await showErrorMessage(GENERIC_ERROR);
        return;
    }

    isSubmitting = true;
    setLoadingState(true);

    try {
        const result = await loginViaWebModule(email, password);

        console.log('[login-page] login response received', {
            ok: result?.ok,
            status: result?.status,
            debugCode: result?.debugCode || null,
            debugStage: result?.debugStage || null
        });

        if (!result?.ok) {
            const message = result?.status && result.status >= 500
                ? 'Login service is temporarily unavailable. Please try again in a minute.'
                : result?.status === 429 && result?.error
                    ? String(result.error)
                    : GENERIC_ERROR;
            if (result?.status && result.status >= 500) {
                console.error('[login-page] login debug details', {
                    debugCode: result?.debugCode || null,
                    debugStage: result?.debugStage || null,
                    backendMessage: result?.error || null
                });
            }
            await showErrorMessage(message);
            return;
        }

        if (result.sessionId) {
            session.setItem(SESSION_KEY, result.sessionId);
        }

        console.log('[login-page] login success, redirecting', getRedirectTarget());
        wixLocation.to(getRedirectTarget());
    } catch (_err) {
        console.error('[login-page] login request failed', _err?.message || 'unknown error');
        await showErrorMessage('Unable to log in right now. Please try again.');
    } finally {
        isSubmitting = false;
        setLoadingState(false);
    }
}

function wireFormHandlers() {
    const submitSelectors = ['#loginButton', '#submitButton', '#signInButton'];
    let bound = false;

    for (const selector of submitSelectors) {
        try {
            const button = $w(selector);
            if (typeof button.onClick === 'function') {
                console.log('[login-page] binding click handler', selector);
                if (!activeSubmitButtonSelector) {
                    activeSubmitButtonSelector = selector;
                    if (typeof button.label === 'string' && button.label) {
                        defaultSubmitButtonLabel = button.label;
                    }
                }
                button.onClick(() => {
                    console.log('[login-page] click captured', selector);
                    submitLogin();
                });
                bound = true;
            }
        } catch (_err) {
            // Try next known selector.
        }
    }

    if (!bound) {
        const formSelectors = ['#loginform', '#loginForm'];

        for (const selector of formSelectors) {
            try {
                const maybeForm = $w(selector);
                if (typeof maybeForm.onSubmit === 'function') {
                    console.log('[login-page] binding submit handler', selector);
                    maybeForm.onSubmit((event) => {
                        event.preventDefault();
                        console.log('[login-page] submit captured', selector);
                        submitLogin();
                    });
                    break;
                }
            } catch (_err) {
                // Try next known selector.
            }
        }
    }
}

function wireEnterKeyHandlers() {
    const inputSelectors = ['#emailInput', '#passwordInput'];

    for (const selector of inputSelectors) {
        try {
            const input = $w(selector);
            if (typeof input.onKeyPress === 'function') {
                input.onKeyPress((event) => {
                    if (event?.key === 'Enter') {
                        submitLogin();
                    }
                });
            }
        } catch (_err) {
            // Ignore missing selectors.
        }
    }
}

$w.onReady(function () {
    console.log('[login-page] onReady start');
    clearErrorText('#errorText');
    wireFormHandlers();
    wireEnterKeyHandlers();
    console.log('[login-page] onReady complete');
});
