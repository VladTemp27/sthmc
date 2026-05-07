import wixLocation from 'wix-location';
import { session } from 'wix-storage';
import { me as meViaWebModule } from 'backend/auth-api';
import { getPatientById } from 'backend/patients';
import { getChartsForPatient } from 'backend/charts';

const LOGIN_PATH = '/log-in';
const SESSION_KEY = 'custom_auth_session_id';
const LOG_PREFIX = '[page.patient-demographic]';

const FIELD_SELECTORS = {
    firstName: ['#firstName'],
    lastName: ['#lastName'],
    birthday: ['#birthDay'],
    age: ['#age'],
    sex: ['#sex']
};

const MESSAGE_SELECTORS = ['#text27', '#text26', '#text19'];
const ADD_CHART_BUTTON_SELECTORS = ['#addChartButton'];
const CHARTS_REPEATER_SELECTORS = ['#repeater1'];

const CHARTS_ITEM_SELECTORS = {
    chartNo: ['#chartNo'],
    department: ['#deparment'],
    date: ['#date'],
    viewButton: ['#viewButton']
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

    const currentPath = wixLocation.path?.length ? `/${wixLocation.path.join('/')}` : '/patient-demographic';
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

function setTextValue(selectors, value) {
    const element = getElement(selectors);
    if (!element) {
        return;
    }

    if ('value' in element) {
        element.value = value;
    } else if ('text' in element) {
        element.text = value;
    }
}

function setDateValue(selectors, value) {
    const element = getElement(selectors);
    if (!element) {
        return;
    }

    if (!value) {
        return;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return;
    }

    if ('value' in element) {
        element.value = date;
    }
}

function formatDate(value) {
    if (!value) {
        return '';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return '';
    }

    return date.toLocaleDateString();
}

function getItemElement($item, selectors) {
    for (const selector of selectors) {
        try {
            const element = $item(selector);
            if (element) {
                return element;
            }
        } catch (_err) {
            continue;
        }
    }

    return null;
}

function disableField(selectors) {
    const element = getElement(selectors);
    if (!element) {
        return;
    }

    if ('disable' in element) {
        element.disable();
    }
}

function wireAddChartButton(patientId) {
    const button = getElement(ADD_CHART_BUTTON_SELECTORS);
    if (!button || !('onClick' in button)) {
        return;
    }

    button.onClick(() => {
        console.log(`${LOG_PREFIX} add_chart_click`, { patientId });
        wixLocation.to(`/add-new-chart?patientId=${encodeURIComponent(patientId)}`);
    });
}

function renderPatient(patient) {
    setTextValue(FIELD_SELECTORS.firstName, patient.firstName || '');
    setTextValue(FIELD_SELECTORS.lastName, patient.lastName || '');
    setDateValue(FIELD_SELECTORS.birthday, patient.birthday);
    setTextValue(FIELD_SELECTORS.age, patient.age != null ? String(patient.age) : '');
    setTextValue(FIELD_SELECTORS.sex, patient.sex || '');
}

function lockReadOnlyFields() {
    disableField(FIELD_SELECTORS.firstName);
    disableField(FIELD_SELECTORS.lastName);
    disableField(FIELD_SELECTORS.birthday);
    disableField(FIELD_SELECTORS.age);
    disableField(FIELD_SELECTORS.sex);
}

function renderCharts(patientId, charts) {
    const repeater = getElement(CHARTS_REPEATER_SELECTORS);
    if (!repeater || !('data' in repeater) || !('onItemReady' in repeater)) {
        return;
    }

    const repeaterData = (charts || []).map((chart, index) => ({
        _id: chart.chartId || `chart-${index + 1}`,
        index: index + 1,
        ...chart
    }));

    repeater.data = repeaterData;
    repeater.onItemReady(($item, itemData) => {
        const chartNoText = getItemElement($item, CHARTS_ITEM_SELECTORS.chartNo);
        const departmentText = getItemElement($item, CHARTS_ITEM_SELECTORS.department);
        const dateText = getItemElement($item, CHARTS_ITEM_SELECTORS.date);
        const viewButton = getItemElement($item, CHARTS_ITEM_SELECTORS.viewButton);

        if (chartNoText && 'text' in chartNoText) {
            chartNoText.text = String(itemData.index || '');
        }

        if (departmentText && 'text' in departmentText) {
            departmentText.text = itemData.department || '-';
        }

        if (dateText && 'text' in dateText) {
            dateText.text = formatDate(itemData.chartDate || itemData.createdAt) || '-';
        }

        if (viewButton && 'onClick' in viewButton) {
            viewButton.onClick(() => {
                if (!itemData.chartId) {
                    return;
                }
                wixLocation.to(`/patient-chart?patientId=${encodeURIComponent(patientId)}&chartId=${encodeURIComponent(itemData.chartId)}`);
            });
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

    setMessage('Loading patient details...');

    const patientId = String(wixLocation.query?.patientId || '').trim();
    console.log(`${LOG_PREFIX} query_patient_id_resolved`, { patientId });
    if (!patientId) {
        console.error(`${LOG_PREFIX} query_patient_id_missing`);
        setMessage('Missing patient ID.', true);
        return;
    }

    try {
        console.log(`${LOG_PREFIX} get_patient_by_id_start`, { patientId });
        const result = await getPatientById(patientId);
        if (!result?.ok) {
            console.error(`${LOG_PREFIX} get_patient_by_id_fail`, { patientId, type: result?.type, message: result?.message });
            setMessage(result?.message || 'Unable to load patient details.', true);
            return;
        }

        console.log(`${LOG_PREFIX} get_patient_by_id_success`, { patientId });
        renderPatient(result.patient || {});
        lockReadOnlyFields();
        wireAddChartButton(patientId);

        const chartsResult = await getChartsForPatient(patientId);
        if (!chartsResult?.ok) {
            console.error(`${LOG_PREFIX} get_charts_for_patient_fail`, { patientId, message: chartsResult?.message });
            setMessage(chartsResult?.message || 'Unable to load patient charts.', true);
            renderCharts(patientId, []);
            return;
        }

        const charts = chartsResult.items || [];
        renderCharts(patientId, charts);
        if (charts.length === 0) {
            setMessage('No charts yet.');
        } else {
            setMessage('');
        }
    } catch (_err) {
        console.error(`${LOG_PREFIX} load_error`, { patientId, message: _err?.message });
        setMessage('Something went wrong while loading patient details.', true);
    }
});
