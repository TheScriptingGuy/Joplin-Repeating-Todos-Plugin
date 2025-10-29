/** Imports **************************************************************************************************************************************/
import joplin from 'api';
import { openDialog } from '../gui/dialog/dialog';
import { Database } from './database';
import { JoplinAPI } from './joplin';  // ← NEW: Replace old imports
import { Recurrence } from '../model/recurrence';
import { sleep } from './misc';
import { Trace, TryCatch } from './decorators';

/**
 * Central manager for all recurrence-related logic.
 * All public methods are static – no need to instantiate.
 */
export class RecurrenceManager {
  private static updating = false;

  /** Open the recurrence dialog for the currently selected note */
  @Trace()
  @TryCatch({ logError: true })
  static async openRecurrenceDialog(): Promise<void> {
    const selectedNote = await joplin.workspace.selectedNote();
    if (!selectedNote) return;

    const oldRecurrence = await Database.getRecord(selectedNote.id);
    const newRecurrence = await openDialog(oldRecurrence);

    if (newRecurrence) {
      await Database.updateRecord(selectedNote.id, newRecurrence);
    }
  }

  /** Synchronise every recurring todo with Joplin */
  @Trace()
  @TryCatch({ logError: true })
  static async updateAllRecurrences(): Promise<void> {
    if (this.updating) return;
    this.updating = true;

    try {
      const allRecurrences = await Database.getAllRecords();

      for (const record of allRecurrences) {
        await this.processTodo(record);
      }
    } finally {
      this.updating = false;
    }
  }

  /** Move overdue incomplete todos to today (preserve time) */
  @Trace()
  @TryCatch({ logError: true })
  static async setOverdueTodosToToday(): Promise<void> {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    for (const note of await JoplinAPI.getAllNotes()) {
      const recurrence = await Database.getRecord(note.id);
      const dueDate = new Date(note.todo_due);

      if (
        note.todo_due !== 0 &&
        recurrence?.enabled &&
        dueDate < startOfToday
      ) {
        const newDueDate = new Date(startOfToday);
        newDueDate.setHours(
          dueDate.getHours(),
          dueDate.getMinutes(),
          dueDate.getSeconds(),
          dueDate.getMilliseconds()
        );

        await JoplinAPI.setTaskDueDate(note.id, newDueDate);
        await sleep(1000);
      }
    }

    await joplin.views.dialogs.showMessageBox('Overdue Tasks Rescheduled');
  }

  /** Mark overdue completed todos and roll forward */
  @Trace()
  @TryCatch({ logError: true })
  static async updateOverdueTodos(): Promise<void> {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    for (const note of await JoplinAPI.getAllNotes()) {
      const recurrence = await Database.getRecord(note.id);
      const dueDate = new Date(note.todo_due);

      if (
        note.todo_due !== 0 &&
        recurrence?.enabled &&
        dueDate < startOfToday
      ) {
        await JoplinAPI.markTaskComplete(note.id);
        await this.processTodo(note, startOfToday);
        await sleep(1000);
      }
    }

    await joplin.views.dialogs.showMessageBox('Overdue Tasks Rescheduled');
  }

  /** Core recurrence engine */
  @Trace()
  @TryCatch({ logError: true })
  private static async processTodo(
    todo: any,
    after: Date | null = null
  ): Promise<void> {
    const recurrence = await Database.getRecord(todo.id);

    if (
      todo.todo_completed !== 0 &&
      todo.todo_due !== 0 &&
      recurrence.enabled
    ) {
      const initialDate = new Date(todo.todo_due);
      const nextDate =
        after === null
          ? recurrence.getNextDate(initialDate)
          : recurrence.getNextDateAfter(initialDate, after);
      if (!nextDate) return;
      await JoplinAPI.setTaskDueDate(todo.id, nextDate);
      await JoplinAPI.markTaskIncomplete(todo.id);
      await JoplinAPI.markSubTasksIncomplete(todo.id);

      recurrence.updateStopStatus();
      await Database.updateRecord(todo.id, recurrence);
    }
  }
}