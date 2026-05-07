import wixLocation from 'wix-location';
import { session } from 'wix-storage';
import { me as meViaWebModule } from 'backend/auth-api';
import { getChartContext, updateChartData } from 'backend/charts';

const LOGIN_PATH = '/log-in';
const SESSION_KEY = 'custom_auth_session_id';
const SAVE_DEBOUNCE_MS = 500;
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

function toNumberOrNull(value) {
    if (value == null || value === '') {
        return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function toTextOrNull(value) {
    const text = String(value == null ? '' : value).trim();
    return text || null;
}

function toDateOrNull(value) {
    if (!value) {
        return null;
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function buildPayloadFromForm() {
    return {
        weight: toNumberOrNull(field(FIELD_IDS.weight)?.value),
        height: toNumberOrNull(field(FIELD_IDS.height)?.value),
        temperature: toNumberOrNull(field(FIELD_IDS.temperature)?.value),
        bp: toTextOrNull(field(FIELD_IDS.bp)?.value),
        heartRate: toNumberOrNull(field(FIELD_IDS.heartRate)?.value),
        respiratoryRate: toNumberOrNull(field(FIELD_IDS.respiratoryRate)?.value),
        department: toTextOrNull(field(FIELD_IDS.department)?.value),
        findings: toTextOrNull(field(FIELD_IDS.findings)?.value),
        medicationsAd: toTextOrNull(field(FIELD_IDS.medicationsAd)?.value),
        chartDate: toDateOrNull(field(FIELD_IDS.chartDate)?.value)
    };
}

function setFieldValue(id, value) {
    const el = field(id);
    if (!el || !('value' in el)) {
        return;
    }

    el.value = value == null ? '' : value;
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

function registerAutoSave(patientId, chartId) {
    let saveTimer = null;
    let isSaving = false;
    let pendingSave = false;

    const scheduleSave = () => {
        if (saveTimer) {
            clearTimeout(saveTimer);
        }

        saveTimer = setTimeout(async () => {
            if (isSaving) {
                pendingSave = true;
                return;
            }

            isSaving = true;
            const payload = buildPayloadFromForm();
            logInfo('autosave_start', { patientId, chartId, payloadKeys: Object.keys(payload || {}) });
            const result = await updateChartData(patientId, chartId, payload);
            isSaving = false;

            if (!result?.ok) {
                logError('autosave_fail', { patientId, chartId, message: result?.message || 'Unable to save chart data.' });
            } else {
                logInfo('autosave_success', { patientId, chartId, updatedAt: result?.updatedAt || null });
            }

            if (pendingSave) {
                pendingSave = false;
                scheduleSave();
            }
        }, SAVE_DEBOUNCE_MS);
    };

    Object.values(FIELD_IDS).forEach((id) => {
        const el = field(id);
        if (!el) {
            return;
        }

        if ('onInput' in el) {
            el.onInput(scheduleSave);
        }

        if ('onChange' in el) {
            el.onChange(scheduleSave);
        }
    });
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
        registerAutoSave(patientId, chartId);
        logInfo('chart_ready_autosave_enabled', { patientId, chartId });
    } catch (_err) {
        logError('chart_load_error', { patientId, chartId, message: _err?.message || 'Unknown error' });
    }
});
