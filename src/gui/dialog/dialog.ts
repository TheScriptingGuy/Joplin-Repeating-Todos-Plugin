/** Imports ****************************************************************************************************************************************/
import joplin from 'api';
import { recurrenceFromJSON, recurrenceToJSON } from '../../model/recurrence';
const fs = joplin.require('fs-extra');

let dialog = null;
let HTMLFilePath = null;
let BaseHTML = null;

/** setupDialog ************************************************************************************************************************************/
export async function setupDialog() {  // Named export (no default needed)
    HTMLFilePath = (await joplin.plugins.installationDir()) + "/gui/dialog/dialog.html"
    BaseHTML = await fs.readFile(HTMLFilePath, 'utf8');
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