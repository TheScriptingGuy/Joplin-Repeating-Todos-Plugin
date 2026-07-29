/** README ******************************************************************************************************************************************
 * This file contains all functions involved in managing recurrence storage.
 *
 * Recurrence data is now stored using Joplin's note userData API (key/value pairs attached to a note, synchronised across devices) instead of YAML
 * frontmatter embedded in the note body. The userData value is the plain RecurrenceData object produced by `recurrenceToObject`.
 *
 * The "recurring" tag is kept purely as a query index so that all recurring todos can be discovered quickly. It is no longer used as a storage
 * mechanism. A one-time migration path reads any legacy `joplin-recurrence` YAML frontmatter still present in a note body, moves it into userData,
 * and strips the frontmatter from the body.
 ***************************************************************************************************************************************************/

import joplin from "api";
import { ModelType } from "api/types";
import yaml from "js-yaml";
import {
  Recurrence,
  RecurrenceData,
  recurrenceToObject,
  recurrenceFromObject,
} from "../model/recurrence";
import { Trace, TryCatch } from "./decorators";

/** RecurringTodo ***********************************************************************************************************************************
 * The shape returned by getAllRecurringTodos(): the indexed note fields plus the recurrence loaded from userData.                                  *
 ***************************************************************************************************************************************************/
export interface RecurringTodo {
  id: string;
  title: string;
  is_todo: number;
  todo_due: number;
  todo_completed: number;
  recurrence: Recurrence;
}

/**
 * Storage layer for recurrence data.
 * Stores recurrence under note userData (key `RECURRENCE_KEY`) and uses the `recurring` tag purely as a query index.
 */
export class RecurrenceStore {
  /** userData key under which the serialized RecurrenceData is stored on each note */
  private static readonly RECURRENCE_KEY = "recurrence";
  /** Name of the tag used solely as a query index for recurring notes */
  private static readonly TAG_NAME = "recurring";
  /** Legacy YAML frontmatter block matcher (old storage format) */
  private static readonly FRONTMATTER_REGEX = /^---\s*\n([\s\S]*?)\n---\s*\n?/;

  /** init *********************************************************************************************************************************
   * No persistent setup is required for userData-based storage.                                                                          *
   *************************************************************************************************************************************/
  static async init(): Promise<void> {
    console.info("Recurrence storage initialized (userData mode).");
  }

  /** get **********************************************************************************************************************************
   * Loads the recurrence for a note.                                                                                                     *
   *   1. Reads userData; if present, builds a Recurrence from it.                                                                         *
   *   2. Otherwise attempts a migration from legacy YAML frontmatter in the note body.                                                   *
   *   3. Returns null if neither exists.                                                                                                  *
   *************************************************************************************************************************************/
  @Trace()
  @TryCatch({ logError: true, fallback: null })
  static async get(noteId: string): Promise<Recurrence | null> {
    const data = await joplin.data.userDataGet<RecurrenceData>(
      ModelType.Note,
      noteId,
      this.RECURRENCE_KEY
    );

    if (data) {
      return recurrenceFromObject(data);
    }

    // Migration fallback: look for legacy YAML frontmatter in the note body.
    const note = await joplin.data.get(["notes", noteId], { fields: ["body"] });
    const legacy = this.extractLegacyFrontmatter(note?.body);
    if (legacy) {
      const recurrence = recurrenceFromObject(legacy);
      // Persist into userData + ensure tag.
      await this.set(noteId, recurrence);
      // Strip the legacy frontmatter block from the body.
      const cleanedBody = String(note.body)
        .replace(this.FRONTMATTER_REGEX, "")
        .trimStart();
      await joplin.data.put(["notes", noteId], null, { body: cleanedBody });
      return recurrence;
    }

    return null;
  }

  /** set **********************************************************************************************************************************
   * Writes the recurrence to userData and ensures the note carries the `recurring` index tag.                                            *
   *************************************************************************************************************************************/
  @Trace()
  @TryCatch({ logError: true })
  static async set(noteId: string, recurrence: Recurrence): Promise<void> {
    await joplin.data.userDataSet<RecurrenceData>(
      ModelType.Note,
      noteId,
      this.RECURRENCE_KEY,
      recurrenceToObject(recurrence)
    );

    const tagId = await this.findOrCreateTagId();
    if (tagId) {
      await joplin.data.post(["tags", tagId, "notes"], null, { id: noteId });
    }
  }

  /** remove *******************************************************************************************************************************
   * Deletes the recurrence userData and removes the note from the `recurring` index tag (ignoring already-removed errors).               *
   *************************************************************************************************************************************/
  @Trace()
  @TryCatch({ logError: true })
  static async remove(noteId: string): Promise<void> {
    await this.removeUsingTag(await this.findOrCreateTagId(), noteId);
  }

  /** removeUsingTag ***********************************************************************************************************************
   * The body of `remove` with the index tag already resolved, so bulk callers look it up only once.                                       *
   *************************************************************************************************************************************/
  private static async removeUsingTag(tagId: string | null, noteId: string): Promise<void> {
    await joplin.data.userDataDelete(ModelType.Note, noteId, this.RECURRENCE_KEY);

    if (tagId) {
      try {
        await joplin.data.delete(["tags", tagId, "notes", noteId]);
      } catch (e) {
        // Ignore if the note was already removed from the tag.
      }
    }
  }

  /** getAllRecurringTodos *****************************************************************************************************************
   * Returns every todo that has recurrence data, discovered via the `recurring` index tag.                                               *
   * Notes whose userData no longer holds recurrence (orphaned tags) are skipped and untagged.                                            *
   *************************************************************************************************************************************/
  @Trace()
  @TryCatch({ logError: true, fallback: [] })
  static async getAllRecurringTodos(): Promise<RecurringTodo[]> {
    const tagId = await this.findOrCreateTagId();
    if (!tagId) return [];

    const notes = await this.getIndexedNotes(tagId, [
      "id",
      "title",
      "is_todo",
      "todo_due",
      "todo_completed",
    ]);

    const results: RecurringTodo[] = [];
    for (const note of notes) {
      if (note.is_todo !== 1) continue;

      const recurrence = await this.get(note.id);
      if (!recurrence) {
        // Orphaned tag with no recurrence data: drop it.
        console.warn(`No recurrence data for note ${note.id}; removing from index.`);
        await this.remove(note.id);
        continue;
      }

      results.push({
        id: note.id,
        title: note.title,
        is_todo: note.is_todo,
        todo_due: note.todo_due,
        todo_completed: note.todo_completed,
        recurrence,
      });
    }

    return results;
  }

  /** removeAll ****************************************************************************************************************************
   * Wipes the recurrence data off every note in the recurring index, leaving the notes themselves   *
   * (and their alarms) untouched. Returns how many notes were cleared.                              *
   * Unlike getAllRecurringTodos this does not skip non-to-do notes, so nothing is left behind.     *
   *************************************************************************************************************************************/
  @Trace()
  @TryCatch({ logError: true, fallback: 0 })
  static async removeAll(): Promise<number> {
    const tagId = await this.findOrCreateTagId();
    if (!tagId) return 0;

    const notes = await this.getIndexedNotes(tagId, ["id"]);
    for (const note of notes) {
      await this.removeUsingTag(tagId, note.id);
    }

    return notes.length;
  }

  /** getIndexedNotes **********************************************************************************************************************
   * Returns every note carrying the `recurring` index tag, walking all pages of the tag query.      *
   *************************************************************************************************************************************/
  private static async getIndexedNotes(tagId: string, fields: string[]): Promise<any[]> {
    const notes: any[] = [];
    let page = 1;
    let hasMore = true;
    while (hasMore) {
      const response = await joplin.data.get(["tags", tagId, "notes"], {
        fields,
        page,
      });
      const items = response?.items || [];
      notes.push(...items);
      hasMore = Boolean(response?.has_more);
      page += 1;
    }
    return notes;
  }

  /** extractLegacyFrontmatter *************************************************************************************************************
   * Parses an old-format YAML frontmatter block from a note body and returns the `joplin-recurrence` payload, or null when absent.       *
   *************************************************************************************************************************************/
  private static extractLegacyFrontmatter(
    body: string | undefined | null
  ): Partial<RecurrenceData> | null {
    if (!body) return null;
    const match = body.match(this.FRONTMATTER_REGEX);
    if (!match) return null;
    try {
      const parsed = yaml.load(match[1]) as any;
      return (parsed && parsed["joplin-recurrence"]) || null;
    } catch {
      return null;
    }
  }

  /** findOrCreateTagId ********************************************************************************************************************
   * Returns the id of the `recurring` index tag, creating it if it does not yet exist.                                                   *
   *************************************************************************************************************************************/
  @TryCatch({ logError: true, fallback: null })
  private static async findOrCreateTagId(): Promise<string | null> {
    let page = 1;
    let hasMore = true;
    while (hasMore) {
      const allTags = await joplin.data.get(["tags"], {
        fields: ["id", "title"],
        page,
      });
      const items = allTags?.items || [];
      const match = items.find((tag: any) => tag.title === this.TAG_NAME);
      if (match) return match.id;
      hasMore = Boolean(allTags?.has_more);
      page += 1;
    }

    const newTag = await joplin.data.post(["tags"], null, { title: this.TAG_NAME });
    return newTag?.id ?? null;
  }
}
