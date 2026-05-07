import wixLocation from 'wix-location';
import { session } from 'wix-storage';
import { me as meViaWebModule } from 'backend/auth-api';

const SESSION_KEY = 'custom_auth_session_id';
const LOGIN_PATH = '/log-in';
const HOME_PATH = '/homepage';
const LOG_PREFIX = '[master-page]';

async function isAuthenticated() {
    try {
        const sessionId = session.getItem(SESSION_KEY);
        const result = await meViaWebModule(sessionId);
        return Boolean(result?.ok);
    } catch (_err) {
        console.error(`${LOG_PREFIX} auth_check_error`, { message: _err?.message });
        return false;
    }
}

function getLoginButton() {
    try {
        return $w('#button1');
    } catch (_err) {
        return null;
    }
}

function wireNavButton(button, targetPath) {
    if (!button) {
        return;
    }

    if ('link' in button) {
        button.link = targetPath;
    }

    if ('onClick' in button) {
        button.onClick(() => {
            wixLocation.to(targetPath);
        });
    }
}

$w.onReady(async function () {
    const button = getLoginButton();
    if (!button) {
        return;
    }

    const authed = await isAuthenticated();
    const targetPath = authed ? HOME_PATH : LOGIN_PATH;
    const label = authed ? 'Home' : 'Log In';

    if ('label' in button) {
        button.label = label;
    }

    wireNavButton(button, targetPath);

    console.log(`${LOG_PREFIX} nav_button_state`, { authed, label, targetPath });
});
