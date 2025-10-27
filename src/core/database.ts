/** README ******************************************************************************************************************************************
 * This file contains all functions involved in managing the recurrence data.                                                                      *
 * Recurrence data is stored directly in the todo note's body as YAML frontmatter for full cross-platform compatibility (desktop and mobile).      *
 * Each recurrence corresponds with the note/task id in Joplin which it affects.                                                                   *
 ***************************************************************************************************************************************************/

/** Imports ****************************************************************************************************************************************/
import joplin from "api";
import { Recurrence } from "../model/recurrence";
import yaml from 'js-yaml';

/** setupDatabase ***********************************************************************************************************************************
 * No setup required for note-based storage—this is a no-op. Call it at program start if needed for consistency.                                    *
 ***************************************************************************************************************************************************/
export async function setupDatabase() {
    console.log('Recurrence storage initialized (note-based mode).');
}

/** Helper: Extract YAML frontmatter from note body ***************************************************************************************/
function extractFrontmatter(body: string): any | null {
    if (!body) return null;
    const frontmatterMatch = body.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
    if (!frontmatterMatch) return null;
    try {
        const frontmatter = yaml.load(frontmatterMatch[1]);
        return frontmatter['joplin-recurrence'] || null;
    } catch (e) {
        console.error('Failed to parse YAML frontmatter:', e.message);
        return null;
    }
}

/** Helper: Inject or update YAML frontmatter in note body ******************************************************************************/
async function injectFrontmatter(id: string, recurrence: Recurrence, originalBody: string): Promise<string> {
    const recurrenceData = {
        enabled: recurrence.enabled,
        interval: recurrence.interval,
        intervalNumber: recurrence.intervalNumber,
        weekSunday: recurrence.weekSunday,
        weekMonday: recurrence.weekMonday,
        weekTuesday: recurrence.weekTuesday,
        weekWednesday: recurrence.weekWednesday,
        weekThursday: recurrence.weekThursday,
        weekFriday: recurrence.weekFriday,
        weekSaturday: recurrence.weekSaturday,
        monthOrdinal: recurrence.monthOrdinal,
        monthWeekday: recurrence.monthWeekday,
        stopType: recurrence.stopType,
        stopDate: recurrence.stopDate,
        stopNumber: recurrence.stopNumber,
    };

    const yamlString = yaml.dump({ 'joplin-recurrence': recurrenceData }, { indent: 2 });

    let newBody: string;
    const existingFrontmatter = extractFrontmatter(originalBody);


    if (existingFrontmatter) {
        // Update existing
        newBody = originalBody.replace(/^---\s*\n([\s\S]*?)\n---\s*\n/, `---\n${yamlString}\n---\n`);

    } else {
        // Prepend new frontmatter
        newBody = `---\n${yamlString}\n---\n\n${originalBody}`;

    }
    // Save the updated note
    await joplin.data.put(['notes', id], null, { body: newBody });
    return newBody;
}



/**
 * Helper: Finds a tag ID by title.
 * @param tagTitle - The tag title to search for.
 * @returns The tag ID if found, null otherwise.
 */
async function findTagIdByTitle(tagTitle: string): Promise<string> {
  const allTags = await joplin.data.get(['tags'], { fields: ['id', 'title'] });
  const matchingTag = (allTags?.items || []).find((tag: { id: string; title: string }) => tag.title === tagTitle);
  let tag_id = matchingTag ? matchingTag.id : null;  
  if (!tag_id) {
        // Create the tag if it doesn't exist
        const newTag = await joplin.data.post(['tags'], null, { title: "recurring" });
        tag_id = newTag.id;
    }
  return tag_id;
}
/** createRecord ************************************************************************************************************************************
 * Creates a new recurrence record when given the noteID and recurrence data object.                                                               *
 * Injects into the note body as YAML frontmatter.                                                                                                 *
 ***************************************************************************************************************************************************/
export async function createRecord(id: string, recurrence: Recurrence) {
    // Fetch note body
    const note = await joplin.data.get(['notes', id], { fields: ['body', 'todo_due'] });

    const cleanedBody = note.body.replace(/^---\s*\n([\s\S]*?)\n---\s*\n/, '').trimStart();
        
    await joplin.data.put(['notes',id], null, {body : cleanedBody} );


    await injectFrontmatter(id, recurrence, note.body);

    let tag_id = await findTagIdByTitle("recurring");

    // Associate the tag with the note (correct path: tags/{tag_id}/notes)
    await joplin.data.post(['tags', tag_id, 'notes'], null, { id: id });
}

/** getAllRecords ***********************************************************************************************************************************
 * Gets all recurrence records by fetching all todo notes and parsing their bodies.                                                                *
 ***************************************************************************************************************************************************/
export async function getAllRecords() {
    let tag_id = await findTagIdByTitle("recurring");
    
    const notesResponse = await joplin.data.get(['tags', tag_id, 'notes'], {
        fields: ['id', 'body', 'title', 'is_todo', 'todo_due','todo_completed'] 
    });


    const allTagNotes = notesResponse?.items || [];

    const filteredNotes = allTagNotes.filter(note => note.is_todo === 1 && note.todo_due == 0);

    const results = [];
    for (const note of filteredNotes) {
        const recurrenceData = extractFrontmatter(note.body);
        if (recurrenceData) {
            results.push(note);
        }
        if (!recurrenceData) {
            console.error(`No recurrence data found for note ID ${note.id}; skipping.`);
            deleteRecord(note.id);
        }
        
    }
    return results;
}

/** getRecord ***************************************************************************************************************************************
 * Gets recurrence record for the corresponding note ID                                                                                            *
 ***************************************************************************************************************************************************/
export async function getRecord(id: string): Promise<Recurrence> {
    // Fetch note's tags with id and title
    const currentTagsResponse = await joplin.data.get(['notes', id, 'tags'], { fields: ['id', 'title'] });
    
    // Safely extract and map to array of { id, title } objects
    const currentTags = (currentTagsResponse?.items || []).map(tag => ({
        id: tag.id,
        title: tag.title
    }));

    const note = await joplin.data.get(['notes', id], { fields: ['body'] });

    if (!currentTags.some(tag => tag.title === "recurring")) {
        createRecord(id, new Recurrence());
    }
    const recurrenceData = extractFrontmatter(note.body);
    if (!recurrenceData) {
        console.error("No recurrence data found; deleting and recreate record.");
        deleteRecord(id);
        createRecord(id, new Recurrence());
    }
    return getRecordAsRecurrence(recurrenceData);
}

/** updateRecord ************************************************************************************************************************************
 * Updates a recurrence record when given the noteID and recurrence data object                                                                    *
 ***************************************************************************************************************************************************/
export async function updateRecord(id: string, recurrence: Recurrence) {
    // Fetch note's tags with id and title
    const currentTagsResponse = await joplin.data.get(['notes', id, 'tags'], { fields: ['id', 'title'] });

    // Safely extract and map to array of { id, title } objects
    const currentTags = (currentTagsResponse?.items || []).map(tag => ({
        id: tag.id,
        title: tag.title
    }));
    if (!currentTags.some(tag => tag.title === "recurring")) {
        let tag_id = await findTagIdByTitle("recurring");
        await joplin.data.post(['tags', tag_id, 'notes'], null, { id: id });
    }
    else {
        const note = await joplin.data.get(['notes', id], { fields: ['body'] });

        await injectFrontmatter(id, recurrence, note.body);
    }
    
}

/** deleteRecord ************************************************************************************************************************************
 * Deletes a recurrence record for the corresponding note ID.                                                                                      *
 ***************************************************************************************************************************************************/
export async function deleteRecord(id: string) {
    // Remove frontmatter from note body
    const note = await joplin.data.get(['notes', id], { fields: ['body'] });
    
    const cleanedBody = note.body.replace(/^---\s*\n([\s\S]*?)\n---\s*\n/, '').trimStart();
    let tag_id = await findTagIdByTitle("recurring")
    await joplin.data.put(['notes',id], null, { body: cleanedBody });

    await joplin.data.delete(['tags', tag_id, 'notes', id]);
}

/** convertRecordToRecurrence ***********************************************************************************************************************
 * Converts a plain object from YAML output to a recurrence object                                                                                *
 ***************************************************************************************************************************************************/
function getRecordAsRecurrence(record: any): Recurrence{

    const recurrence = new Recurrence();

    if (!record) 
        {
        return recurrence;
        }
    else
    {
    recurrence.enabled = record.enabled ?? false;
    recurrence.interval = record.interval ?? '';
    recurrence.intervalNumber = record.intervalNumber ?? 1;
    recurrence.weekSunday = record.weekSunday ?? false;
    recurrence.weekMonday = record.weekMonday ?? false;
    recurrence.weekTuesday = record.weekTuesday ?? false;
    recurrence.weekWednesday = record.weekWednesday ?? false;
    recurrence.weekThursday = record.weekThursday ?? false;
    recurrence.weekFriday = record.weekFriday ?? false;
    recurrence.weekSaturday = record.weekSaturday ?? false;
    recurrence.monthOrdinal = record.monthOrdinal ?? '';
    recurrence.monthWeekday = record.monthWeekday ?? '';
    recurrence.stopType = record.stopType ?? '';
    recurrence.stopDate = record.stopDate ?? '';
    recurrence.stopNumber = record.stopNumber ?? 0;
    }
    return recurrence;
}