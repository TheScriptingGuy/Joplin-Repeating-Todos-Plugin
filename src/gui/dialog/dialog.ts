/** Imports ****************************************************************************************************************************************/
import joplin from 'api';
import { recurrenceFromJSON, recurrenceToJSON } from '../../model/recurrence';

let dialog = null;
let BaseHTML = null;

/** setupDialog ************************************************************************************************************************************/
export async function setupDialog() {  // Named export (no default needed)
    BaseHTML = `
<h1>Repeating To-Do</h1>
<form name="recurrenceForm">

    <input id="recurrenceDataInput" type="hidden" name="recurrenceData" value="RECURRENCE_DATA">

    <fieldset id="enabledFieldset">
        <legend>Enabled</legend>
        <input id="enabledCheckbox" type="checkbox" value="True">
        <label for="enabledCheckbox">This To-Do Repeats</label>
    </fieldset>

    <fieldset id="alarmFieldset">
        <legend>Alarm</legend>
        <input id="resetAlarmCheckbox" type="checkbox" value="True">
        <label for="resetAlarmCheckbox">Move the alarm on even when this To-Do is not done</label>
    </fieldset>

    <fieldset id="intervalFieldset">
        <legend>Interval</legend>
        <input id="intervalNumberSpinbutton" type="number" min="1" max="999" step="1" value="1">
        <select id="intervalDropdown">
            <option value="minute" selected>Minute</option>
            <option value="hour">Hour</option>
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
            <option value="year">Year</option>
        </select>
    </fieldset>

    <fieldset id="weekFieldset">
        <legend>Weekdays</legend>
        <table>
            <tr>
                <td><input id="weekSundayCheckbox" type="checkbox" value="true"></td>
                <td><label for="weekSundayCheckbox">Sunday</label></td>
            </tr>
            <tr>
                <td><input id="weekMondayCheckbox" type="checkbox" value="true"></td>
                <td><label for="weekMondayCheckbox">Monday</label></td>
            </tr>
            <tr>
                <td><input id="weekTuesdayCheckbox" type="checkbox" value="true"></td>
                <td><label for="weekTuesdayCheckbox">Tuesday</label></td>
            </tr>
            <tr>
                <td><input id="weekWednesdayCheckbox" type="checkbox" value="true"></td>
                <td><label for="weekWednesdayCheckbox">Wednesday</label></td>
            </tr>
            <tr>
                <td><input id="weekThursdayCheckbox" type="checkbox" value="true"></td>
                <td><label for="weekThursdayCheckbox">Thursday</label></td>
            </tr>
            <tr>
                <td><input id="weekFridayCheckbox" type="checkbox" value="true"></td>
                <td><label for="weekFridayCheckbox">Friday</label></td>
            </tr>
            <tr>
                <td><input id="weekSaturdayCheckbox" type="checkbox" value="true"></td>
                <td><label for="weekdaySaturdayCheckbox">Saturday</label></td>
            </tr>
        </table>	
    </fieldset>

    <fieldset id="monthFieldset">
        <legend>Weekday of Month</legend>
        <select id="monthOrdinalDropdown"">
            <option value="first" selected>First</option>
            <option value="second">Second</option>
            <option value="third">Third</option>
            <option value="fourth">Fourth</option>
            <option value="last">Last</option>
        </select>
        <select id="monthWeekdayDropdown"">
            <option value="" selected>None</option>
            <option value="sunday">Sunday</option>
            <option value="monday">Monday</option>
            <option value="tuesday">Tuesday</option>
            <option value="wednesday">Wednesday</option>
            <option value="thursday">Thursday</option>
            <option value="friday">Friday</option>
            <option value="saturday">Saturday</option>
        </select>
    </fieldset>

    <fieldset id="stopFieldset">
        <legend>Repeating Stops</legend>
        <select id="stopTypeDropdown"">
            <option value="never">Never</option>
            <option value="number">After # of Repeats</option>
            <option value="date">After a date</option>
        </select>
        <input id="stopNumberSpinbutton" type="number" min="1" max="999" step="1" value="1">
        <input id="stopDatePicker" type="date">
    </fieldset>

</form>

    `.trim();  // Removes extra leading/trailing whitespace
    dialog = await joplin.views.dialogs.create('dialog');
}

/** openDialog **************************************************************************************************************************************/
export async function openDialog(recurrenceData) {
    if (!dialog) {
        throw new Error('Dialog not initialized—call setupDialog1 first');
    }
    const replacedHTML = BaseHTML.replace("RECURRENCE_DATA", btoa(recurrenceToJSON(recurrenceData)));
    await joplin.views.dialogs.setHtml(dialog, replacedHTML);
    
    // Load JS/CSS after HTML for DOM timing (fixed: addStyle for CSS)
    await joplin.views.dialogs.addScript(dialog, './gui/dialog/dialog_addon.js');
    await joplin.views.dialogs.addScript(dialog, './gui/dialog/dialog.css');  // Fixed: addStyle, not addScript
    
    console.log('Dialog opened successfully');  // Debug log
    
    const formResult = await joplin.views.dialogs.open(dialog);
    if (formResult.id === 'ok') {
        return recurrenceFromJSON(atob(formResult.formData.recurrenceForm.recurrenceData));
    }
    return null;  // On cancel
}