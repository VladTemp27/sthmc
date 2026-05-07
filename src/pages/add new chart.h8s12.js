import wixLocation from 'wix-location';
import { session } from 'wix-storage';
import { me as meViaWebModule } from 'backend/auth-api';
import { createChartForPatient } from 'backend/charts';

const LOGIN_PATH = '/log-in';
const SESSION_KEY = 'custom_auth_session_id';
const MESSAGE_SELECTORS = ['#text21', '#text20'];
const LOG_PREFIX = '[page.add-new-chart]';

async function enforceAuthGuard() {
    try {
        const sessionId = session.getItem(SESSION_KEY);
        console.log(`${LOG_PREFIX} auth_check_start`, { hasSession: Boolean(sessionId) });
        const result = await meViaWebModule(sessionId);
        if (result?.ok) {
            console.log(`${LOG_PREFIX} auth_check_pass`);
            return true;
        }
    } catch (_err) {
        console.error(`${LOG_PREFIX} auth_check_error`, { message: _err?.message });
    }

    const currentPath = wixLocation.path?.length ? `/${wixLocation.path.join('/')}` : '/add-new-chart';
    console.log(`${LOG_PREFIX} auth_check_fail_redirect`, { currentPath });
    wixLocation.to(`${LOGIN_PATH}?redirect=${encodeURIComponent(currentPath)}`);
    return false;
}

function getElement(selectors) {
    for (const selector of selectors) {
        try {
            const element = $w(selector);
            if (element) {
                return element;
            }
        } catch (_err) {
            continue;
        }
    }

    return null;
}

function setMessage(text, isError = false) {
    const messageElement = getElement(MESSAGE_SELECTORS);
    if (!messageElement) {
        return;
    }

    messageElement.text = text;

    if (messageElement.style && 'color' in messageElement.style) {
        messageElement.style.color = isError ? '#C81E1E' : '#1B7F3A';
    }
}

$w.onReady(async function () {
    console.log(`${LOG_PREFIX} on_ready_start`);
    const isAuthed = await enforceAuthGuard();
    if (!isAuthed) {
        console.log(`${LOG_PREFIX} on_ready_stop_auth_failed`);
        return;
    }

    setMessage('Preparing new chart...');

    const patientId = String(wixLocation.query?.patientId || '').trim();
    console.log(`${LOG_PREFIX} query_patient_id_resolved`, { patientId });
    if (!patientId) {
        console.error(`${LOG_PREFIX} query_patient_id_missing`);
        setMessage('Missing patient ID. Please open this page from a patient flow.', true);
        return;
    }

    try {
        console.log(`${LOG_PREFIX} create_chart_start`, { patientId });
        const result = await createChartForPatient(patientId);
        if (!result?.ok) {
            console.error(`${LOG_PREFIX} create_chart_fail`, { patientId, type: result?.type, message: result?.message });
            setMessage(result?.message || 'Unable to create chart.', true);
            return;
        }

        const chartId = String(result.chartId || '').trim();
        console.log(`${LOG_PREFIX} create_chart_response`, { patientId, chartId });
        if (!chartId) {
            console.error(`${LOG_PREFIX} create_chart_missing_id`, { patientId });
            setMessage('Chart created but chart ID is missing.', true);
            return;
        }

        console.log(`${LOG_PREFIX} redirect_to_patient_chart`, { patientId, chartId });
        wixLocation.to(`/patient-chart?patientId=${encodeURIComponent(patientId)}&chartId=${encodeURIComponent(chartId)}`);
    } catch (_err) {
        console.error(`${LOG_PREFIX} create_chart_error`, { patientId, message: _err?.message });
        setMessage('Something went wrong while creating chart. Please try again.', true);
    }
});
