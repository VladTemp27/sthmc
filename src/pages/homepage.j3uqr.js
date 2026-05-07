import wixLocation from 'wix-location';
import { session } from 'wix-storage';
import { me as meViaWebModule } from 'backend/auth-api';
import { getHomepageSummary, getRecentConsultations, searchPatientsForHomepage } from 'backend/homepage';
import { getLatestChartForPatient } from 'backend/charts';

const LOGIN_PATH = '/log-in';
const PATIENT_DEMOGRAPHICS_PATH = '/patient-demographics';
const SESSION_KEY = 'custom_auth_session_id';
const SUMMARY_SELECTORS = {
    totalPatients: ['#totalPatient', '#text19'],
    totalConsultations: ['#consultationCount', '#text20'],
    activeCharts: ['#activeDepartments', '#text21']
};
const RECENT_CONSULTATION_BUTTONS = ['#viewChartB', '#viewPatientB'];
const RECENT_CONSULTATIONS_REPEATER = '#recentConsultations';
const RECENT_CONSULTATIONS_LIMIT = 10;
const SEARCH_INPUT_SELECTORS = ['#search', '#searchInput', '#input1', '#textInput1'];
const REPEATER_ITEM_SELECTORS = {
    name: ['#name'],
    age: ['#age'],
    sex: ['#sex'],
    viewChart: ['#viewChartB'],
    viewPatient: ['#viewPatientB']
};
const LOG_PREFIX = '[page.homepage]';

let renderHomeList = async () => {};

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

async function openLatestChartForPatient(patientId, button) {
    const id = String(patientId || '').trim();
    if (!id) {
        return;
    }

    const previousLabel = button && 'label' in button ? button.label : '';
    if (button && 'label' in button) {
        button.label = 'Opening...';
    }
    if (button && 'disable' in button) {
        button.disable();
    }

    try {
        const latestResult = await getLatestChartForPatient(id);
        if (!latestResult?.ok || !latestResult?.chartId) {
            console.error(`${LOG_PREFIX} latest_chart_resolve_fail`, { patientId: id, message: latestResult?.message });
            return;
        }

        console.log(`${LOG_PREFIX} consultation_open_click`, {
            patientId: id,
            chartId: latestResult.chartId
        });
        wixLocation.to(`/patient-chart?patientId=${encodeURIComponent(id)}&chartId=${encodeURIComponent(latestResult.chartId)}`);
    } catch (_err) {
        console.error(`${LOG_PREFIX} latest_chart_resolve_error`, { patientId: id, message: _err?.message });
    } finally {
        if (button && 'label' in button) {
            button.label = previousLabel;
        }
        if (button && 'enable' in button) {
            button.enable();
        }
    }
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
    await renderItemsToRepeater(items);
}

async function renderItemsToRepeater(items) {
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
                    openLatestChartForPatient(itemData.patientId, viewChartButton);
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
                    wixLocation.to(`${PATIENT_DEMOGRAPHICS_PATH}?patientId=${encodeURIComponent(itemData.patientId)}`);
                });
            }
        });

        return;
    }

    const fallbackChartButton = getElement([RECENT_CONSULTATION_BUTTONS[0]]);
    const fallbackPatientButton = getElement([RECENT_CONSULTATION_BUTTONS[1]]);
    const firstItem = items[0];

    if (fallbackChartButton) {
        if ('label' in fallbackChartButton) {
            fallbackChartButton.label = firstItem?.chartId ? 'View Chart' : 'No Chart';
        }
        if ('disable' in fallbackChartButton && 'enable' in fallbackChartButton) {
            if (firstItem?.chartId) {
                fallbackChartButton.enable();
            } else {
                fallbackChartButton.disable();
            }
        }
        if ('onClick' in fallbackChartButton) {
            fallbackChartButton.onClick(() => {
                openLatestChartForPatient(firstItem?.patientId, fallbackChartButton);
            });
        }
    }

    if (fallbackPatientButton) {
        if ('label' in fallbackPatientButton) {
            fallbackPatientButton.label = firstItem ? 'View Patient' : 'No Patient';
        }
        if ('disable' in fallbackPatientButton && 'enable' in fallbackPatientButton) {
            if (firstItem?.patientId) {
                fallbackPatientButton.enable();
            } else {
                fallbackPatientButton.disable();
            }
        }
        if ('onClick' in fallbackPatientButton) {
            fallbackPatientButton.onClick(() => {
                if (!firstItem?.patientId) {
                    return;
                }
                console.log(`${LOG_PREFIX} patient_open_click`, { patientId: firstItem.patientId });
                wixLocation.to(`${PATIENT_DEMOGRAPHICS_PATH}?patientId=${encodeURIComponent(firstItem.patientId)}`);
            });
        }
    }
}

function wireSearchInput() {
    const searchInput = getElement(SEARCH_INPUT_SELECTORS);
    if (!searchInput) {
        console.log(`${LOG_PREFIX} search_input_not_found`, { selectors: SEARCH_INPUT_SELECTORS });
        return;
    }

    const runSearch = async () => {
        const raw = 'value' in searchInput ? searchInput.value : '';
        const query = String(raw || '').trim();

        if (!query) {
            console.log(`${LOG_PREFIX} search_query_empty_restore_default`);
            await renderHomeList();
            return;
        }

        console.log(`${LOG_PREFIX} search_query_start`, { query });
        const result = await searchPatientsForHomepage(query, RECENT_CONSULTATIONS_LIMIT);
        if (!result?.ok) {
            console.error(`${LOG_PREFIX} search_query_fail`, { query, message: result?.message });
            return;
        }

        const items = result.items || [];
        await renderItemsToRepeater(items);
        if (items.length === 0) {
            const firstButton = getElement([RECENT_CONSULTATION_BUTTONS[0]]);
            if (firstButton && 'label' in firstButton) {
                firstButton.label = 'No patient found';
            }
        }
    };

    if ('onInput' in searchInput) {
        searchInput.onInput(runSearch);
    }

    if ('onChange' in searchInput) {
        searchInput.onChange(runSearch);
    }
}

$w.onReady(async function () {
    console.log(`${LOG_PREFIX} on_ready_start`);
    const isAuthed = await enforceAuthGuard();
    if (!isAuthed) {
        console.log(`${LOG_PREFIX} on_ready_stop_auth_failed`);
        return;
    }

    renderHomeList = async () => {
        await loadRecentConsultations();
    };

    await Promise.all([loadSummary(), renderHomeList()]);
    wireSearchInput();
    console.log(`${LOG_PREFIX} on_ready_data_load_complete`);
});
