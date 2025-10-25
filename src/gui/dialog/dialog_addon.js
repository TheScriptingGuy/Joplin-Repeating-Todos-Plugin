/******************************************************************************************************************************************
************************************************************* Stop Data *******************************************************************
******************************************************************************************************************************************/
function safeGetElement(id) {
    const el = document.getElementById(id);
    if (!el) {
        console.warn(`Element with ID '${id}' not found in the DOM.`);
    }
    return el;
}

let stopFieldset = safeGetElement('stopFieldset');
let stopTypeDropdown = safeGetElement('stopTypeDropdown');
let stopNumberSpinbutton = safeGetElement('stopNumberSpinbutton');
let stopDatePicker = safeGetElement('stopDatePicker');

if (stopTypeDropdown) {
    stopTypeDropdown.addEventListener("change", onStopTypeChanged);
}
if (stopNumberSpinbutton) {
    stopNumberSpinbutton.addEventListener("change", onStopNumberChanged);
}
if (stopDatePicker) {
    stopDatePicker.addEventListener("change", onStopDateChanged);
}

function onStopTypeChanged() {
    if (!recurrence) return; // Guard against null recurrence
    recurrence.stopType = stopTypeDropdown ? stopTypeDropdown.value : '';
    if (recurrence.enabled && recurrence.stopType === 'date' && stopDatePicker) {
        stopDatePicker.style.display = 'block';
    } else if (stopDatePicker) {
        stopDatePicker.style.display = 'none';
    }
    if (recurrence.enabled && recurrence.stopType === 'number' && stopNumberSpinbutton) {
        stopNumberSpinbutton.style.display = 'block';
    } else if (stopNumberSpinbutton) {
        stopNumberSpinbutton.style.display = 'none';
    }
    saveData();
}

function onStopNumberChanged() {
    if (!recurrence || !stopNumberSpinbutton) return;
    recurrence.stopNumber = stopNumberSpinbutton.value;
    saveData();
}

function onStopDateChanged() {
    if (!recurrence || !stopDatePicker) return;
    recurrence.stopDate = stopDatePicker.value;
    saveData();
}

/******************************************************************************************************************************************
************************************************************* Month Weekday ***************************************************************
*****************************************************************************************************************************************/
let monthFieldset = safeGetElement('monthFieldset');
let monthOrdinalDropdown = safeGetElement('monthOrdinalDropdown');
let monthWeekdayDropdown = safeGetElement('monthWeekdayDropdown');

if (monthWeekdayDropdown) {
    monthWeekdayDropdown.addEventListener('change', onMonthWeekdayChanged);
}
if (monthOrdinalDropdown) {
    monthOrdinalDropdown.addEventListener('change', onMonthOrdinalChanged);
}

function onMonthWeekdayChanged() {
    if (!recurrence || !monthWeekdayDropdown) return;
    recurrence.monthWeekday = monthWeekdayDropdown.value;
    if (recurrence.enabled && recurrence.interval === "month" && recurrence.monthWeekday !== '') {
        if (monthOrdinalDropdown) {
            monthOrdinalDropdown.style.display = 'inline';
        }
    } else if (monthOrdinalDropdown) {
        monthOrdinalDropdown.style.display = 'none';
    }
    saveData();
}

function onMonthOrdinalChanged() {
    if (!recurrence || !monthOrdinalDropdown) return;
    recurrence.monthOrdinal = monthOrdinalDropdown.value;
    saveData();
}

/*******************************************************************************************************************************************
****************************************************************** Week ********************************************************************
*******************************************************************************************************************************************/
let weekFieldset = safeGetElement('weekFieldset');
let weekSundayCheckbox = safeGetElement('weekSundayCheckbox');
let weekMondayCheckbox = safeGetElement('weekMondayCheckbox');
let weekTuesdayCheckbox = safeGetElement('weekTuesdayCheckbox');
let weekWednesdayCheckbox = safeGetElement('weekWednesdayCheckbox');
let weekThursdayCheckbox = safeGetElement('weekThursdayCheckbox');
let weekFridayCheckbox = safeGetElement('weekFridayCheckbox');
let weekSaturdayCheckbox = safeGetElement('weekSaturdayCheckbox');

if (weekSundayCheckbox) {
    weekSundayCheckbox.addEventListener("change", onWeekSundayCheckboxChanged);
}
if (weekMondayCheckbox) {
    weekMondayCheckbox.addEventListener("change", onWeekMondayCheckboxChanged);
}
if (weekTuesdayCheckbox) {
    weekTuesdayCheckbox.addEventListener("change", onWeekTuesdayCheckboxChanged);
}
if (weekWednesdayCheckbox) {
    weekWednesdayCheckbox.addEventListener("change", onWeekWednesdayCheckboxChanged);
}
if (weekThursdayCheckbox) {
    weekThursdayCheckbox.addEventListener("change", onWeekThursdayCheckboxChanged);
}
if (weekFridayCheckbox) {
    weekFridayCheckbox.addEventListener("change", onWeekFridayCheckboxChanged);
}
if (weekSaturdayCheckbox) {
    weekSaturdayCheckbox.addEventListener("change", onWeekSaturdayCheckboxChanged);
}

function onWeekSundayCheckboxChanged() {
    if (!recurrence || !weekSundayCheckbox) return;
    recurrence.weekSunday = weekSundayCheckbox.checked;
    saveData();
}
function onWeekMondayCheckboxChanged() {
    if (!recurrence || !weekMondayCheckbox) return;
    recurrence.weekMonday = weekMondayCheckbox.checked;
    saveData();
}
function onWeekTuesdayCheckboxChanged() {
    if (!recurrence || !weekTuesdayCheckbox) return;
    recurrence.weekTuesday = weekTuesdayCheckbox.checked;
    saveData();
}
function onWeekWednesdayCheckboxChanged() {
    if (!recurrence || !weekWednesdayCheckbox) return;
    recurrence.weekWednesday = weekWednesdayCheckbox.checked;
    saveData();
}
function onWeekThursdayCheckboxChanged() {
    if (!recurrence || !weekThursdayCheckbox) return;
    recurrence.weekThursday = weekThursdayCheckbox.checked;
    saveData();
}
function onWeekFridayCheckboxChanged() {
    if (!recurrence || !weekFridayCheckbox) return;
    recurrence.weekFriday = weekFridayCheckbox.checked;
    saveData();
}
function onWeekSaturdayCheckboxChanged() {
    if (!recurrence || !weekSaturdayCheckbox) return;
    recurrence.weekSaturday = weekSaturdayCheckbox.checked;
    saveData();
}

/******************************************************************************************************************************************
***************************************************************** Interval **************************************************************** 
******************************************************************************************************************************************/

let intervalFieldset = safeGetElement('intervalFieldset');     // Gets the interval Fieldset
let intervalNumberSpinbutton = safeGetElement('intervalNumberSpinbutton');  // Gets the interval number spinbutton
let intervalDropdown = safeGetElement('intervalDropdown');     // Gets the interval dropdown

if (intervalDropdown) {
    intervalDropdown.addEventListener("change", onIntervalChanged);
}
if (intervalNumberSpinbutton) {
    intervalNumberSpinbutton.addEventListener("change", onIntervalNumberChanged);
}

/* onIntervalChanged **********************************************************************************************************************
    Called if thee interval dropdown changes. It saves the changes to the hidden form and toggles the visibility of the other elements
    depending on the current interval
*/
function onIntervalChanged() {
    if (!recurrence || !intervalDropdown) return;
    recurrence.interval = intervalDropdown.value;
    if (recurrence.enabled && recurrence.interval === "week" && weekFieldset) {
        weekFieldset.style.display = 'block';
    } else if (weekFieldset) {
        weekFieldset.style.display = 'none';
    }
    if (recurrence.enabled && recurrence.interval === "month" && monthFieldset) {
        monthFieldset.style.display = 'block';
    } else if (monthFieldset) {
        monthFieldset.style.display = 'none';
    }
    onMonthWeekdayChanged();
    saveData();
}

/* onIntervalNumberChanged ****************************************************************************************************************
    Called when the interval number spinbutton changes. Saves the changes to the hidden form
*/
function onIntervalNumberChanged() {
    if (!recurrence || !intervalNumberSpinbutton) return;
    recurrence.intervalNumber = intervalNumberSpinbutton.value;
    saveData();
}

/******************************************************************************************************************************************
 ***************************************************************** Enabled ****************************************************************
******************************************************************************************************************************************/
let enabledCheckbox = safeGetElement('enabledCheckbox');       // Gets the enabled checkbox

if (enabledCheckbox) {
    enabledCheckbox.addEventListener("change", onEnabledChanged);           // Adds callback for when the checbox is ticked
}

/* onEnabledChanged ***********************************************************************************************************************
    Called if the enabled checkbox is toggled. It saves the changes to the hidden form and toggles the visibility of the other elements
    depending on the enabled state
*/

function onEnabledChanged() {
    if (!recurrence || !enabledCheckbox) return;
    recurrence.enabled = enabledCheckbox.checked;                        // Saves the checkbox status to the recurrence object
    if (recurrence.enabled) {                                           // If the recurrence is enabled
        if (intervalFieldset) {
            intervalFieldset.style.display = 'block';                         // Show the interval Fieldset...
        }
        if (stopFieldset) {
            stopFieldset.style.display = 'block';                             // and the stop Fieldset
        }
    } else {                                                            // Otherwise...
        if (intervalFieldset) {
            intervalFieldset.style.display = 'none';                          // Hide the interval Fieldset
        }
        if (stopFieldset) {
            stopFieldset.style.display = 'none';                              // And the stop Fieldset
        }
    }
    onIntervalChanged();                                                // Calls the interval changed function for updating
    onStopTypeChanged();                                                // Calls the stop type changed function for updating
    saveData();                                                         // Saves the data to the hidden form
}

/******************************************************************************************************************************************
************************************************ Recurrence Data Management ***************************************************************
******************************************************************************************************************************************/

var recurrenceInput = safeGetElement('recurrenceDataInput');    // Gets the hidden input storing the recurrence data
var recurrence = null;                                          // Initializes the recurrence object

// Wait for DOM to be ready before loading data
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadData);
} else {
    loadData();
}

/* loadData *******************************************************************************************************************************
    Loads data from the hidden data form into the dialog recurrence object
*/
function loadData() {
    if (!recurrenceInput) {
        console.warn('recurrenceDataInput element not found. Skipping loadData.');
        return;
    }
    try {
        var encodedRecurrenceData = recurrenceInput.value;                   // gets the encoded recurrence data from the hidden form
        if (!encodedRecurrenceData) {
            console.warn('No encoded recurrence data found. Initializing with defaults.');
            recurrence = {
                enabled: false,
                interval: 'day',
                intervalNumber: 1,
                weekSunday: false,
                weekMonday: false,
                weekTuesday: false,
                weekWednesday: false,
                weekThursday: false,
                weekFriday: false,
                weekSaturday: false,
                monthWeekday: '',
                monthOrdinal: '',
                stopType: '',
                stopDate: '',
                stopNumber: 0
            };
            return;
        }
        var decodedRecurrenceData = atob(encodedRecurrenceData);             // decodes the recurrence data into the json string
        recurrence = JSON.parse(decodedRecurrenceData);                      // parse the recurrence json string into a usable data object

        // Safely set properties only if elements exist
        if (enabledCheckbox) enabledCheckbox.checked = recurrence.enabled || false;
        if (intervalNumberSpinbutton) intervalNumberSpinbutton.value = recurrence.intervalNumber || 1;
        if (intervalDropdown) intervalDropdown.value = recurrence.interval || 'day';
        if (weekSundayCheckbox) weekSundayCheckbox.checked = recurrence.weekSunday || false;
        if (weekMondayCheckbox) weekMondayCheckbox.checked = recurrence.weekMonday || false;
        if (weekTuesdayCheckbox) weekTuesdayCheckbox.checked = recurrence.weekTuesday || false;
        if (weekWednesdayCheckbox) weekWednesdayCheckbox.checked = recurrence.weekWednesday || false;
        if (weekThursdayCheckbox) weekThursdayCheckbox.checked = recurrence.weekThursday || false;
        if (weekFridayCheckbox) weekFridayCheckbox.checked = recurrence.weekFriday || false;
        if (weekSaturdayCheckbox) weekSaturdayCheckbox.checked = recurrence.weekSaturday || false;
        if (monthWeekdayDropdown) monthWeekdayDropdown.value = recurrence.monthWeekday || '';
        if (monthOrdinalDropdown) monthOrdinalDropdown.value = recurrence.monthOrdinal || '';
        if (stopTypeDropdown) stopTypeDropdown.value = recurrence.stopType || '';
        if (stopDatePicker) stopDatePicker && (stopDatePicker.value = recurrence.stopDate ? String(recurrence.stopDate) : "");
        if (stopNumberSpinbutton) stopNumberSpinbutton.value = recurrence.stopNumber || 0;

        onEnabledChanged();
        onIntervalChanged();
        onMonthWeekdayChanged();
        onStopTypeChanged();
    } catch (error) {
        console.error('Error loading recurrence data:', error);
        // Initialize with defaults on error
        recurrence = {
            enabled: false,
            interval: 'day',
            intervalNumber: 1,
            weekSunday: false,
            weekMonday: false,
            weekTuesday: false,
            weekWednesday: false,
            weekThursday: false,
            weekFriday: false,
            weekSaturday: false,
            monthWeekday: '',
            monthOrdinal: '',
            stopType: '',
            stopDate: '',
            stopNumber: 0
        };
    }
}

/* saveData *******************************************************************************************************************************
    Saves data from the dialog recurrence object into the hidden data form
*/
function saveData() {
    if (!recurrence || !recurrenceInput) return;
    try {
        var JSONstring = JSON.stringify(recurrence);                         // Saves the recurrence data object to a json string
        var encodedString = btoa(JSONstring);                                // Encodes the json string to make it safe for HTML insertion
        recurrenceInput.value = encodedString;                               // saves the encoded string to the hidden recurrence data form
    } catch (error) {
        console.error('Error saving recurrence data:', error);
    }
}