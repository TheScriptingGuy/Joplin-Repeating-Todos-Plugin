import joplin from "api";
import { updateAllRecurrences } from "./recurrence";

let repeatingTimerId: NodeJS.Timeout | null = null;  // To store the timer ID for cleanup

export async function setupTimer(){
    await updateAllRecurrences()
    joplin.workspace.onNoteSelectionChange(async (event:any) => {
        //const note = await joplin.data.get(['notes', event.noteId]);
        //console.info('Alarm was triggered for note: ', note);
        updateAllRecurrences()
        // Set up the repeating timer: Runs every X seconds (from settings)
        const setupRepeatingTimer = async () => {
            if (repeatingTimerId) {
                clearInterval(repeatingTimerId);  // Clear any existing to avoid duplicates
            }

            const intervalSeconds = await joplin.settings.value('updateFrequency') || 60;  // Default 60s if not set
            console.info(`Setting up repeating timer with interval: ${intervalSeconds} seconds`);
            const intervalMs = intervalSeconds * 1000;  // Convert to milliseconds

            repeatingTimerId = setInterval(async () => {
                console.info(`Repeating timer fired - Interval: ${intervalSeconds}s`);
                try {
                    await updateAllRecurrences();
                    // Optional: Log success or show subtle feedback
                } catch (error) {
                    console.error('Repeating timer update failed:', error);
                }
            }, intervalMs);

            console.info(`Repeating timer started: every ${intervalSeconds} seconds`);
        };

        // Initial call to set it up
        await setupRepeatingTimer();
    });
    //clearInterval(timer)
    //timer = setInterval(updateAllRecurrences, await joplin.settings.value("updateFrequency") * 1000);
}