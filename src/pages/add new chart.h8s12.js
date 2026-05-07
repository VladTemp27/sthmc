import wixLocation from 'wix-location';
import { session } from 'wix-storage';
import { me as meViaWebModule } from 'backend/auth-api';
import { createChartForPatient, updateChartData } from 'backend/charts';

const LOGIN_PATH = '/log-in';
const PATIENT_DEMOGRAPHICS_PATH = '/patient-demographics';
const SESSION_KEY = 'custom_auth_session_id';
const LOG_PREFIX = '[page.add-new-chart]';

const MESSAGE_SELECTORS = ['#text21', '#text20'];
const SUBMIT_BUTTON_SELECTORS = ['#submitButton'];

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

function setSubmitButtonState(button, state) {
    if (!button) {
        return;
    }

    if ('label' in button) {
        if (state === 'saving') {
            button.label = 'Saving...';
        } else if (state === 'saved') {
            button.label = 'Saved';
        } else {
            button.label = 'Submit';
        }
    }

    if ('disable' in button && 'enable' in button) {
        if (state === 'saving') {
            button.disable();
        } else {
            button.enable();
        }
    }
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

function wireSubmitButton(patientId) {
    const submitButton = getElement(SUBMIT_BUTTON_SELECTORS);
    if (!submitButton || !('onClick' in submitButton)) {
        console.error(`${LOG_PREFIX} submit_button_missing`, { selectors: SUBMIT_BUTTON_SELECTORS });
        setMessage('Submit button is missing on this page.', true);
        return;
    }

    let isSaving = false;
    setSubmitButtonState(submitButton, 'idle');

    submitButton.onClick(async () => {
        if (isSaving) {
            return;
        }

        isSaving = true;
        setSubmitButtonState(submitButton, 'saving');
        setMessage('Saving chart...');

        try {
            const createResult = await createChartForPatient(patientId);
            if (!createResult?.ok || !createResult?.chartId) {
                console.error(`${LOG_PREFIX} create_chart_fail`, {
                    patientId,
                    type: createResult?.type,
                    message: createResult?.message
                });
                setMessage(createResult?.message || 'Unable to create chart.', true);
                setSubmitButtonState(submitButton, 'idle');
                isSaving = false;
                return;
            }

            const chartId = String(createResult.chartId);
            const payload = buildPayloadFromForm();
            console.log(`${LOG_PREFIX} submit_save_start`, { patientId, chartId, payloadKeys: Object.keys(payload || {}) });

            const updateResult = await updateChartData(patientId, chartId, payload);
            if (!updateResult?.ok) {
                console.error(`${LOG_PREFIX} submit_save_fail`, {
                    patientId,
                    chartId,
                    message: updateResult?.message
                });
                setMessage(updateResult?.message || 'Unable to save chart fields.', true);
                setSubmitButtonState(submitButton, 'idle');
                isSaving = false;
                return;
            }

            console.log(`${LOG_PREFIX} submit_save_success`, { patientId, chartId });
            setSubmitButtonState(submitButton, 'saved');
            setMessage('Chart saved. Redirecting...');
            wixLocation.to(`${PATIENT_DEMOGRAPHICS_PATH}?patientId=${encodeURIComponent(patientId)}`);
        } catch (_err) {
            console.error(`${LOG_PREFIX} submit_save_error`, { patientId, message: _err?.message });
            setMessage('Something went wrong while saving chart.', true);
            setSubmitButtonState(submitButton, 'idle');
            isSaving = false;
        }
    });
}

$w.onReady(async function () {
    console.log(`${LOG_PREFIX} on_ready_start`);
    const isAuthed = await enforceAuthGuard();
    if (!isAuthed) {
        console.log(`${LOG_PREFIX} on_ready_stop_auth_failed`);
        return;
    }

    const patientId = String(wixLocation.query?.patientId || '').trim();
    console.log(`${LOG_PREFIX} query_patient_id_resolved`, { patientId });
    if (!patientId) {
        console.error(`${LOG_PREFIX} query_patient_id_missing`);
        setMessage('Missing patient ID. Please open this page from a patient flow.', true);
        return;
    }

    setMessage('Fill out chart fields, then click Submit.');
    wireSubmitButton(patientId);
});
