import wixLocation from 'wix-location';

const ME_ENDPOINT = '/_functions/me';
const LOGIN_PATH = '/log-in';

async function enforceAuthGuard() {
    try {
        const response = await fetch(ME_ENDPOINT, {
            method: 'GET',
            credentials: 'include'
        });

        if (response.ok) {
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
