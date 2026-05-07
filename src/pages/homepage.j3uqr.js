import wixLocation from 'wix-location';
import { session } from 'wix-storage';
import { me as meViaWebModule } from 'backend/auth-api';
import { getHomepageSummary, getRecentConsultations } from 'backend/homepage';

const LOGIN_PATH = '/log-in';
const SESSION_KEY = 'custom_auth_session_id';
const SUMMARY_SELECTORS = {
    totalPatients: ['#totalPatient', '#text19'],
    totalConsultations: ['#consultationCount', '#text20'],
    activeCharts: ['#activeDepartments', '#text21']
};
const RECENT_CONSULTATION_BUTTONS = ['#viewChartB', '#viewPatientB'];
const RECENT_CONSULTATIONS_REPEATER = '#recentConsultations';
const RECENT_CONSULTATIONS_LIMIT = 10;
const REPEATER_ITEM_SELECTORS = {
    name: ['#name'],
    age: ['#age'],
    sex: ['#sex'],
    viewChart: ['#viewChartB'],
    viewPatient: ['#viewPatientB']
};
const LOG_PREFIX = '[page.homepage]';

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

    const currentPath = wixLocation.path?.length ? `/${wixLocation.path.join('/')}` : '/homepage';
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

function setText(selectors, value) {
    const element = getElement(selectors);
    if (!element) {
        return;
    }

    if ('text' in element) {
        element.text = value;
    } else if ('label' in element) {
        element.label = value;
    }
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

async function loadSummary() {
    console.log(`${LOG_PREFIX} summary_load_start`);
    const result = await getHomepageSummary();
    if (!result?.ok) {
        console.error(`${LOG_PREFIX} summary_load_fail`, { message: result?.message });
        return;
    }

    console.log(`${LOG_PREFIX} summary_load_success`, {
        totalPatients: result.totalPatients,
        totalConsultations: result.totalConsultations,
        activeCharts: result.activeCharts
    });
    setText(SUMMARY_SELECTORS.totalPatients, String(result.totalPatients ?? 0));
    setText(SUMMARY_SELECTORS.totalConsultations, String(result.totalConsultations ?? 0));
    setText(SUMMARY_SELECTORS.activeCharts, String(result.activeCharts ?? 0));
}

async function loadRecentConsultations() {
    console.log(`${LOG_PREFIX} consultations_load_start`);
    const result = await getRecentConsultations(RECENT_CONSULTATIONS_LIMIT);
    if (!result?.ok) {
        console.error(`${LOG_PREFIX} consultations_load_fail`, { message: result?.message });
        return;
    }

    const items = result.items || [];
    console.log(`${LOG_PREFIX} consultations_load_success`, { count: items.length });

    const repeater = getElement([RECENT_CONSULTATIONS_REPEATER]);
    if (repeater && 'data' in repeater && 'onItemReady' in repeater) {
        const repeaterData = items.map((item, index) => ({
            _id: `consultation-${index + 1}`,
            ...item
        }));

        repeater.data = repeaterData;
        repeater.onItemReady(($item, itemData) => {
            const nameText = getItemElement($item, REPEATER_ITEM_SELECTORS.name);
            const ageText = getItemElement($item, REPEATER_ITEM_SELECTORS.age);
            const sexText = getItemElement($item, REPEATER_ITEM_SELECTORS.sex);
            const viewChartButton = getItemElement($item, REPEATER_ITEM_SELECTORS.viewChart);
            const viewPatientButton = getItemElement($item, REPEATER_ITEM_SELECTORS.viewPatient);

            if (nameText && 'text' in nameText) {
                nameText.text = itemData.patientName || 'Unknown Patient';
            }

            if (ageText && 'text' in ageText) {
                ageText.text = itemData.patientAge == null ? '-' : String(itemData.patientAge);
            }

            if (sexText && 'text' in sexText) {
                sexText.text = itemData.patientSex || '-';
            }

            if (viewChartButton && 'label' in viewChartButton) {
                viewChartButton.label = itemData.chartId ? 'View Chart' : 'No Chart';
            }

            if (viewChartButton && 'onClick' in viewChartButton) {
                viewChartButton.onClick(() => {
                    if (!itemData.chartId) {
                        return;
                    }
                    console.log(`${LOG_PREFIX} consultation_open_click`, {
                        patientId: itemData.patientId,
                        chartId: itemData.chartId
                    });
                    wixLocation.to(`/patient-chart?patientId=${encodeURIComponent(itemData.patientId)}&chartId=${encodeURIComponent(itemData.chartId)}`);
                });
            }

            if (viewChartButton && 'disable' in viewChartButton && 'enable' in viewChartButton) {
                if (itemData.chartId) {
                    viewChartButton.enable();
                } else {
                    viewChartButton.disable();
                }
            }

            if (viewPatientButton && 'label' in viewPatientButton) {
                viewPatientButton.label = 'View Patient';
            }

            if (viewPatientButton && 'onClick' in viewPatientButton) {
                viewPatientButton.onClick(() => {
                    console.log(`${LOG_PREFIX} patient_open_click`, { patientId: itemData.patientId });
                    wixLocation.to(`/patient-demographic?patientId=${encodeURIComponent(itemData.patientId)}`);
                });
            }
        });

        return;
    }

    RECENT_CONSULTATION_BUTTONS.forEach((selector, index) => {
        const button = getElement([selector]);
        if (!button) {
            return;
        }

        const item = items[index];

        if (!item) {
            if ('label' in button) {
                button.label = 'No consultation';
            }
            if ('disable' in button) {
                button.disable();
            }
            return;
        }

        const label = `${item.patientName} - ${formatDate(item.createdAt) || 'No date'}`;

        if ('label' in button) {
            button.label = label;
        }

        if ('enable' in button) {
            if (item.chartId) {
                button.enable();
            }
        }

        if (!item.chartId && 'disable' in button) {
            button.disable();
        }

        if ('onClick' in button) {
            button.onClick(() => {
                if (!item.chartId) {
                    return;
                }
                console.log(`${LOG_PREFIX} consultation_open_click`, {
                    patientId: item.patientId,
                    chartId: item.chartId
                });
                wixLocation.to(`/patient-chart?patientId=${encodeURIComponent(item.patientId)}&chartId=${encodeURIComponent(item.chartId)}`);
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

    await Promise.all([loadSummary(), loadRecentConsultations()]);
    console.log(`${LOG_PREFIX} on_ready_data_load_complete`);
});
