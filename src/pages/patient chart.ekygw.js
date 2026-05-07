import wixLocation from 'wix-location';
import { session } from 'wix-storage';
import { me as meViaWebModule } from 'backend/auth-api';
import { getChartContext } from 'backend/charts';

const LOGIN_PATH = '/log-in';
const SESSION_KEY = 'custom_auth_session_id';
const LOG_PREFIX = '[page.patient-chart]';
const FIELD_IDS = {
    weight: '#weight',
    height: '#height',
    temperature: '#temperature',
    bp: '#bp',
    heartRate: '#heartRate',
    respiratoryRate: '#respiratoryRate',
    department: '#department',
    findings: '#findings',
    medicationsAd: '#medicationsAd',
    chartDate: '#datePicker1'
};

async function enforceAuthGuard() {
    try {
        const sessionId = session.getItem(SESSION_KEY);
        logInfo('auth_check_start', { hasSession: Boolean(sessionId) });
        const result = await meViaWebModule(sessionId);
        if (result?.ok) {
            logInfo('auth_check_pass');
            return true;
        }
    } catch (_err) {
        logError('auth_check_error', { message: _err?.message || 'Unknown error' });
    }

    const currentPath = wixLocation.path?.length ? `/${wixLocation.path.join('/')}` : '/patient-chart';
    logInfo('auth_check_fail_redirect', { currentPath });
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

function logInfo(event, context = {}) {
    console.log(`${LOG_PREFIX} ${event}`, context);
}

function logError(event, context = {}) {
    console.error(`${LOG_PREFIX} ${event}`, context);
}

function field(id) {
    return getElement([id]);
}

function setFieldValue(id, value) {
    const el = field(id);
    if (!el || !('value' in el)) {
        return;
    }

    el.value = value == null ? '' : value;
}

function disableField(id) {
    const el = field(id);
    if (!el) {
        return;
    }

    if ('disable' in el) {
        el.disable();
    }
}

function populateForm(chart) {
    setFieldValue(FIELD_IDS.weight, chart?.weight);
    setFieldValue(FIELD_IDS.height, chart?.height);
    setFieldValue(FIELD_IDS.temperature, chart?.temperature);
    setFieldValue(FIELD_IDS.bp, chart?.bp);
    setFieldValue(FIELD_IDS.heartRate, chart?.heartRate);
    setFieldValue(FIELD_IDS.respiratoryRate, chart?.respiratoryRate);
    setFieldValue(FIELD_IDS.department, chart?.department);
    setFieldValue(FIELD_IDS.findings, chart?.findings);
    setFieldValue(FIELD_IDS.medicationsAd, chart?.medicationsAd);

    const chartDateElement = field(FIELD_IDS.chartDate);
    if (chartDateElement && 'value' in chartDateElement) {
        chartDateElement.value = chart?.chartDate ? new Date(chart.chartDate) : null;
    }
}

function lockDepartmentField() {
    disableField(FIELD_IDS.department);
}

function lockAllFieldsReadOnly() {
    Object.values(FIELD_IDS).forEach((id) => disableField(id));
}

$w.onReady(async function () {
    logInfo('on_ready_start');
    const isAuthed = await enforceAuthGuard();
    if (!isAuthed) {
        logInfo('on_ready_stop_auth_failed');
        return;
    }

    logInfo('chart_load_start');

    const patientId = String(wixLocation.query?.patientId || '').trim();
    const chartId = String(wixLocation.query?.chartId || '').trim();
    logInfo('query_params_resolved', { patientId: patientId || '(missing)', chartId: chartId || '(missing)' });

    if (!patientId || !chartId) {
        logError('query_params_missing', { patientId: patientId || null, chartId: chartId || null });
        return;
    }

    try {
        const result = await getChartContext(patientId, chartId);
        if (!result?.ok) {
            logError('chart_context_load_fail', { patientId, chartId, message: result?.message || 'Unable to load chart context.' });
            return;
        }

        populateForm(result.chart || {});
        lockAllFieldsReadOnly();
        lockDepartmentField();
        logInfo('chart_ready_read_only', { patientId, chartId });
    } catch (_err) {
        logError('chart_load_error', { patientId, chartId, message: _err?.message || 'Unknown error' });
    }
});
