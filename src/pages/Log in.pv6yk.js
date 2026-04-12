import wixLocation from 'wix-location';

const LOGIN_ENDPOINT = '/_functions/login';
const DEFAULT_SUCCESS_PATH = '/homepage';
const GENERIC_ERROR = 'Invalid email or password.';

function getValueIfExists(selector) {
    try {
        const element = $w(selector);
        return typeof element.value === 'string' ? element.value : '';
    } catch (_err) {
        return '';
    }
}

function setTextIfExists(selector, text) {
    try {
        const element = $w(selector);
        if (typeof element.text === 'string') {
            element.text = text;
            if (typeof element.show === 'function') {
                element.show();
            }
        }
    } catch (_err) {
        // No-op when element ID is unavailable in this environment.
    }
}

function hideIfExists(selector) {
    try {
        const element = $w(selector);
        if (typeof element.hide === 'function') {
            element.hide();
        }
    } catch (_err) {
        // No-op when element ID is unavailable in this environment.
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
    hideIfExists('#errorText');

    const email = getValueIfExists('#emailInput').trim();
    const password = getValueIfExists('#passwordInput');

    if (!email || !password) {
        setTextIfExists('#errorText', GENERIC_ERROR);
        return;
    }

    try {
        const response = await fetch(LOGIN_ENDPOINT, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        if (!response.ok) {
            let message = GENERIC_ERROR;
            try {
                const payload = await response.json();
                if (payload?.error && response.status === 429) {
                    message = String(payload.error);
                }
            } catch (_err) {
                // Use generic message.
            }

            setTextIfExists('#errorText', message);
            return;
        }

        wixLocation.to(getRedirectTarget());
    } catch (_err) {
        setTextIfExists('#errorText', 'Unable to log in right now. Please try again.');
    }
}

function wireFormHandlers() {
    const submitSelectors = ['#loginButton', '#submitButton', '#signInButton'];
    let bound = false;

    for (const selector of submitSelectors) {
        try {
            const button = $w(selector);
            if (typeof button.onClick === 'function') {
                button.onClick(() => {
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
                    maybeForm.onSubmit((event) => {
                        event.preventDefault();
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

$w.onReady(function () {
    hideIfExists('#errorText');
    wireFormHandlers();
});
