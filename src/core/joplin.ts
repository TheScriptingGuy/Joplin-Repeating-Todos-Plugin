/** Imports **************************************************************************************************************************************/
import joplin from 'api';
import { TryCatch } from './decorators';
import { Trace } from './decorators'; 

/**
 * Clean wrapper around Joplin's data API.
 * All methods are static, safe, and auto-logged via @Trace().
 */
export class JoplinAPI {
  private static readonly NOTE_FIELDS = [
    'id',
    'title',
    'body',
    'todo_due',
    'todo_completed',
  ] as const;

  /** Get all notes with pagination */
  @Trace()
  @TryCatch({ fallback: [] })
  static async getAllNotes(): Promise<any[]> {
    const allNotes: any[] = [];
    let page = 0;

    do {
      const response = await joplin.data.get(['notes'], {
        fields: this.NOTE_FIELDS,
        page: page++,
      });

      allNotes.push(...response.items);

      if (!response.has_more) break;
    } while (true);

    return allNotes;
  }

  /** Get a single note (returns null if not found) */
  @Trace()
  @TryCatch({ fallback: null })
  static async getNote(noteId: string): Promise<any | null> {
    try {
      return await joplin.data.get(['notes', noteId], {
        fields: this.NOTE_FIELDS,
      });
    } catch (error: any) {
      if (error.message?.includes('Not Found')) {
        return null;
      }
      throw error;
    }
  }

  /** Mark task as complete */
  @Trace()
  @TryCatch({ logError: true })
  static async markTaskComplete(id: string): Promise<void> {
    await joplin.data.put(['notes', id], null, {
      todo_completed: Date.now(),
    });
  }

  /** Mark task as incomplete */
  @Trace()
  @TryCatch({ logError: true })
  static async markTaskIncomplete(id: string): Promise<void> {
    await joplin.data.put(['notes', id], null, {
      todo_completed: 0,
    });
  }

  /** Mark all subtasks in note body as incomplete */
  @Trace()
  @TryCatch({ logError: true })
  static async markSubTasksIncomplete(id: string): Promise<void> {
    const note = await this.getNote(id);
    if (!note?.body) return;

    const updatedBody = note.body.replace(/- \[x\]/gi, '- [ ]');
    if (updatedBody === note.body) return;

    await joplin.data.put(['notes', id], null, { body: updatedBody });

    // Optional: Refresh UI if this is the selected note
    const selected = await joplin.workspace.selectedNote();
    if (selected?.id === id) {
      // TODO: Refresh UI when Joplin supports it
      // https://github.com/laurent22/joplin/issues/5955
    }
  }

  /** Set due date for a task */
  @Trace()
  @TryCatch({ logError: true })
  static async setTaskDueDate(id: string, date: Date): Promise<void> {
    await joplin.data.put(['notes', id], null, {
      todo_due: date.getTime(),
    });
  }
}