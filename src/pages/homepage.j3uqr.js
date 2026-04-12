import wixLocation from 'wix-location';
import { session } from 'wix-storage';
import { me as meViaWebModule } from 'backend/auth-api';

const LOGIN_PATH = '/log-in';
const SESSION_KEY = 'custom_auth_session_id';

async function enforceAuthGuard() {
    try {
        const sessionId = session.getItem(SESSION_KEY);
        const result = await meViaWebModule(sessionId);
        if (result?.ok) {
            return;
        }
    } catch (_err) {
        // Fail closed and redirect to login.
    }

    const currentPath = wixLocation.path?.length ? `/${wixLocation.path.join('/')}` : '/homepage';
    wixLocation.to(`${LOGIN_PATH}?redirect=${encodeURIComponent(currentPath)}`);
}

$w.onReady(function () {
    enforceAuthGuard();
});
