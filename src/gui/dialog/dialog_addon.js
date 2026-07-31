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

/* numberFieldValue **********************************************************************************************************************
    Reads a spinbutton as a whole number, kept inside the field's own min/max. A number field reads back as a string and is empty while it
    is being retyped, and both of those go straight into the recurrence as '5' or 0 - a string the date maths concatenates instead of adds,
    or a zero-length interval that never moves. Anything unusable therefore falls back to `fallback`, which keeps the last good value.
*/
function numberFieldValue(input, fallback) {
    const parsed = Math.trunc(Number(input.value));
    if (!Number.isFinite(parsed) || input.value === '') {
        return fallback;
    }
    const min = Number(input.min);
    const max = Number(input.max);
    if (Number.isFinite(min) && parsed < min) return fallback;
    if (Number.isFinite(max) && parsed > max) return max;
    return parsed;
}

let stopFieldset = safeGetElement('stopFieldset');
let stopTypeDropdown = safeGetElement('stopTypeDropdown');
let stopNumberSpinbutton = safeGetElement('stopNumberSpinbutton');
let stopDatePicker = safeGetElement('stopDatePicker');

if (stopTypeDropdown) {
    stopTypeDropdown.addEventListener("change", onStopTypeChanged);
}
if (stopNumberSpinbutton) {
    // 'input' as well as 'change': a number field only fires 'change' once the edit is committed
    // (blur or Enter), and the dialog's OK button lives outside this iframe, so mirroring on every
    // keystroke is what guarantees a typed value is in the hidden form field when OK is pressed.
    stopNumberSpinbutton.addEventListener("change", onStopNumberChanged);
    stopNumberSpinbutton.addEventListener("input", onStopNumberChanged);
}
if (stopDatePicker) {
    stopDatePicker.addEventListener("change", onStopDateChanged);
    stopDatePicker.addEventListener("input", onStopDateChanged);
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
    recurrence.stopNumber = numberFieldValue(stopNumberSpinbutton, recurrence.stopNumber);
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
    // See the note on the stop-number field: 'input' keeps the hidden form field in step with what
    // has been typed, so "every 5 minutes" is saved whether or not the field is ever committed.
    intervalNumberSpinbutton.addEventListener("change", onIntervalNumberChanged);
    intervalNumberSpinbutton.addEventListener("input", onIntervalNumberChanged);
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
    recurrence.intervalNumber = numberFieldValue(intervalNumberSpinbutton, recurrence.intervalNumber);
    saveData();
}

/******************************************************************************************************************************************
****************************************************************** Alarm ******************************************************************
******************************************************************************************************************************************/
let alarmFieldset = safeGetElement('alarmFieldset');           // Gets the alarm Fieldset
let resetAlarmCheckbox = safeGetElement('resetAlarmCheckbox'); // Gets the "move the alarm on when not done" checkbox

if (resetAlarmCheckbox) {
    resetAlarmCheckbox.addEventListener("change", onResetAlarmChanged);
}

/* onResetAlarmChanged ********************************************************************************************************************
    Called if the reset-alarm checkbox is toggled. Saves the changes to the hidden form. This is a per-to-do option: it only affects the
    to-do the dialog was opened for.
*/
function onResetAlarmChanged() {
    if (!recurrence || !resetAlarmCheckbox) return;
    recurrence.resetAlarmWhenNotDone = resetAlarmCheckbox.checked;
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
        if (alarmFieldset) {
            alarmFieldset.style.display = 'block';                            // and the alarm Fieldset
        }
    } else {                                                            // Otherwise...
        if (intervalFieldset) {
            intervalFieldset.style.display = 'none';                          // Hide the interval Fieldset
        }
        if (stopFieldset) {
            stopFieldset.style.display = 'none';                              // And the stop Fieldset
        }
        if (alarmFieldset) {
            alarmFieldset.style.display = 'none';                             // And the alarm Fieldset
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

/* defaultRecurrence **********************************************************************************************************************
    The recurrence a dialog starts from when there is nothing to load. These match both the plugin's own defaults and the values the form
    markup shows, so a fresh dialog never claims one interval while displaying another.
*/
function defaultRecurrence() {
    return {
        enabled: false,
        interval: 'minute',
        intervalNumber: 1,
        weekSunday: false,
        weekMonday: false,
        weekTuesday: false,
        weekWednesday: false,
        weekThursday: false,
        weekFriday: false,
        weekSaturday: false,
        monthWeekday: '',
        monthOrdinal: 'first',
        stopType: 'never',
        stopDate: '',
        stopNumber: 1,
        resetAlarmWhenNotDone: false
    };
}

/* loadData *******************************************************************************************************************************
    Loads data from the hidden data form into the dialog recurrence object.

    Whatever happens - data present, missing or unreadable - the recurrence object and the form fields are filled from the same values, so
    what the dialog shows is always what pressing OK will save.
*/
function loadData() {
    if (!recurrenceInput) {
        console.warn('recurrenceDataInput element not found. Skipping loadData.');
        return;
    }

    recurrence = defaultRecurrence();

    try {
        var encodedRecurrenceData = recurrenceInput.value;                   // gets the encoded recurrence data from the hidden form
        if (encodedRecurrenceData) {
            var decodedRecurrenceData = atob(encodedRecurrenceData);         // decodes the recurrence data into the json string
            // Layer the stored values over the defaults, so a field the stored data does not carry
            // (an older recurrence saved before that field existed) keeps its default.
            recurrence = Object.assign(defaultRecurrence(), JSON.parse(decodedRecurrenceData));
        } else {
            console.warn('No encoded recurrence data found. Initializing with defaults.');
        }
    } catch (error) {
        console.error('Error loading recurrence data:', error);
        recurrence = defaultRecurrence();
    }

    applyRecurrenceToForm();

    onEnabledChanged();
    onIntervalChanged();
    onMonthWeekdayChanged();
    onStopTypeChanged();
}

/* applyRecurrenceToForm ******************************************************************************************************************
    Writes the recurrence object into the form fields, skipping any element the markup does not have.
*/
function applyRecurrenceToForm() {
    var defaults = defaultRecurrence();
    if (enabledCheckbox) enabledCheckbox.checked = Boolean(recurrence.enabled);
    if (intervalNumberSpinbutton) intervalNumberSpinbutton.value = wholeNumberOr(recurrence.intervalNumber, defaults.intervalNumber);
    if (intervalDropdown) intervalDropdown.value = recurrence.interval || defaults.interval;
    if (weekSundayCheckbox) weekSundayCheckbox.checked = Boolean(recurrence.weekSunday);
    if (weekMondayCheckbox) weekMondayCheckbox.checked = Boolean(recurrence.weekMonday);
    if (weekTuesdayCheckbox) weekTuesdayCheckbox.checked = Boolean(recurrence.weekTuesday);
    if (weekWednesdayCheckbox) weekWednesdayCheckbox.checked = Boolean(recurrence.weekWednesday);
    if (weekThursdayCheckbox) weekThursdayCheckbox.checked = Boolean(recurrence.weekThursday);
    if (weekFridayCheckbox) weekFridayCheckbox.checked = Boolean(recurrence.weekFriday);
    if (weekSaturdayCheckbox) weekSaturdayCheckbox.checked = Boolean(recurrence.weekSaturday);
    if (monthWeekdayDropdown) monthWeekdayDropdown.value = recurrence.monthWeekday || '';
    if (monthOrdinalDropdown) monthOrdinalDropdown.value = recurrence.monthOrdinal || defaults.monthOrdinal;
    if (stopTypeDropdown) stopTypeDropdown.value = recurrence.stopType || defaults.stopType;
    if (stopDatePicker) stopDatePicker.value = recurrence.stopDate ? String(recurrence.stopDate) : '';
    if (stopNumberSpinbutton) stopNumberSpinbutton.value = wholeNumberOr(recurrence.stopNumber, defaults.stopNumber);
    if (resetAlarmCheckbox) resetAlarmCheckbox.checked = Boolean(recurrence.resetAlarmWhenNotDone);

    // Keep the object itself in step with the sanitised values now shown in the spinbuttons.
    if (intervalNumberSpinbutton) recurrence.intervalNumber = Number(intervalNumberSpinbutton.value);
    if (stopNumberSpinbutton) recurrence.stopNumber = Number(stopNumberSpinbutton.value);
}

/* wholeNumberOr **************************************************************************************************************************
    A stored value as a whole number of at least 1, or `fallback` when it is missing, blank or not a number.
*/
function wholeNumberOr(value, fallback) {
    var parsed = Math.trunc(Number(value));
    return Number.isFinite(parsed) && parsed >= 1 ? parsed : fallback;
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