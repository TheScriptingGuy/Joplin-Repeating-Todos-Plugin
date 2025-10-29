/** README ******************************************************************************************************************************************
 * This file contains all functions involved in managing the recurrence data.
 * Recurrence data is stored directly in the todo note's body as YAML frontmatter for full cross-platform compatibility (desktop and mobile).
 * Each recurrence corresponds with the note/task id in Joplin which it affects.
 ***************************************************************************************************************************************************/

import joplin from "api";
import { Recurrence } from "../model/recurrence";
import yaml from 'js-yaml';
import { Trace, TryCatch } from "./decorators";

/**
 * Database class for managing recurrence data in Joplin notes.
 * Uses YAML frontmatter in note body + "recurring" tag.
 */

export class Database {
  private static readonly TAG_NAME = "recurring";

  /** No setup required for note-based storage */
  static async setupDatabase() {
    console.info('Recurrence storage initialized (note-based mode).');
  }

  @Trace()
  /** Helper: Extract YAML frontmatter from note body */
  private static async extractFrontmatter(body: string): Promise<any | null> {
    if (!body) return null;
    const match = body.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
    if (!match) return null;
    try {
        const data = yaml.load(match[1]);
        return data?.['joplin-recurrence'] ?? null;
    } catch {
        return null;
    }
  }

  @Trace()
  /** Helper: Inject or update YAML frontmatter */
  @TryCatch({ logError: true })
  private static async injectFrontmatter(id: string, recurrence: Recurrence, originalBody: string): Promise<string> {
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

    const existingFrontmatter = await this.extractFrontmatter(originalBody);
    if (existingFrontmatter === null) {
            newBody = `---\n${yamlString}\n---\n\n${originalBody}`;
    }
    else
    {
            newBody = originalBody.replace(/^---\s*\n([\s\S]*?)\n---\s*\n/, `---\n${yamlString}\n---\n`);

    }
    
    // Save the updated note
    await joplin.data.put(['notes', id], null, { body: newBody });
    return newBody;
  }

  @Trace()
  /** Find or create the "recurring" tag */
  @TryCatch({ logError: true, fallback: null })
  private static async findOrCreateTagId(): Promise<string | null> {
    const allTags = await joplin.data.get(['tags'], { fields: ['id', 'title'] });
    const matchingTag = (allTags?.items || []).find((tag: any) => tag.title === this.TAG_NAME);
    if (matchingTag) return matchingTag.id;

    const newTag = await joplin.data.post(['tags'], null, { title: this.TAG_NAME });
    return newTag.id;
  }

  @Trace()
  /** Create a new recurrence record */
  @TryCatch({ logError: true })
  static async createRecord(id: string, recurrence: Recurrence) {
    const note = await joplin.data.get(['notes', id], { fields: ['body'] });
    const cleanedBody = note.body.replace(/^---\s*\n([\s\S]*?)\n---\s*\n/, '').trimStart();
    await joplin.data.put(['notes', id], null, { body: cleanedBody });
    
    await this.injectFrontmatter(id, recurrence, note.body);

    const tagId = await this.findOrCreateTagId();
    if (tagId) {
      await joplin.data.post(['tags', tagId, 'notes'], null, { id });
    }
  }

  @Trace()
  /** Get all recurrence records (only todos with due date and "recurring" tag) */
  @TryCatch({ logError: true, fallback: [] })
  static async getAllRecords() {
    const tagId = await this.findOrCreateTagId();
    if (!tagId) return [];

    const response = await joplin.data.get(['tags', tagId, 'notes'], {
      where: 'is_todo = 1 AND todo_due != 0',
      fields: ['id', 'body', 'title', 'is_todo', 'todo_due', 'todo_completed']
    });

    const notes = (response?.items || []).filter((note: any) => note.is_todo === 1 && note.todo_due !== 0);
    const results: any[] = [];

    for (const note of notes) {
      const data = await this.extractFrontmatter(note.body);
      if (data) {
        results.push({ ...note, recurrence: this.toRecurrence(data) });
      } else {
        console.warn(`No recurrence data for note ${note.id}; removing tag.`);
        await this.deleteRecord(note.id);
      }
    }

    return results;
  }

  @Trace()
  /** Get recurrence for a specific note */
  @TryCatch({ logError: true, fallback: new Recurrence() })
  static async getRecord(id: string): Promise<Recurrence> {
    // Fetch note's tags with id and title
    const currentTagsResponse = await joplin.data.get(['notes', id, 'tags'], { fields: ['id', 'title'] });
    
    // Safely extract and map to array of { id, title } objects
    const currentTags = (currentTagsResponse?.items || []).map(tag => ({
        id: tag.id,
        title: tag.title
    }));

    const note = await joplin.data.get(['notes', id], { fields: ['body'] });

    if (!currentTags.some(tag => tag.title === "recurring")) {
        this.createRecord(id, new Recurrence());
    }
    const recurrenceData = await this.extractFrontmatter(note.body);
    if (!recurrenceData) {
        console.warn("No recurrence data found; deleting and recreate record.");
        this.deleteRecord(id);
        this.createRecord(id, new Recurrence());
    }
    return this.toRecurrence(recurrenceData);
  }

  @Trace()
  /** Update recurrence record */
  @TryCatch({ logError: true })
  static async updateRecord(id: string, recurrence: Recurrence) {
    const tagsResponse = await joplin.data.get(['notes', id, 'tags'], { fields: ['title'] });
    const hasRecurringTag = (tagsResponse?.items || []).some((t: any) => t.title === this.TAG_NAME);

    if (!hasRecurringTag) {
      const tagId = await this.findOrCreateTagId();
      if (tagId) await joplin.data.post(['tags', tagId, 'notes'], null, { id });
    }

    const note = await joplin.data.get(['notes', id], { fields: ['body'] });
    await this.injectFrontmatter(id, recurrence, note.body);
  }

  @Trace()
  /** Delete recurrence record */
  @TryCatch({ logError: true })
  static async deleteRecord(id: string) {
    const note = await joplin.data.get(['notes', id], { fields: ['body'] });
    const cleanedBody = note.body.replace(/^---\s*\n([\s\S]*?)\n---\s*\n/, '').trimStart();
    await joplin.data.put(['notes', id], null, { body: cleanedBody });

    const tagId = await this.findOrCreateTagId();
    if (tagId) {
      try {
        await joplin.data.delete(['tags', tagId, 'notes', id]);
      } catch (e) {
        // Ignore if already removed
      }
    }
  }

  /** Convert YAML object → Recurrence instance */
  private static toRecurrence(record: any): Recurrence {
    
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
}