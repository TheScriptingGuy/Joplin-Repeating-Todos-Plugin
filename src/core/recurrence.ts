/** Imports **************************************************************************************************************************************/
import joplin from 'api';
import { openDialog } from '../gui/dialog/dialog';
import { RecurrenceStore, RecurringTodo } from './database';
import { JoplinAPI } from './joplin';
import { Recurrence } from '../model/recurrence';
import { Trace, TryCatch } from './decorators';

/**
 * Central manager for all recurrence-related logic.
 *
 * The engine is alarm/event-native: advancement happens when a recurring to-do is marked complete
 * (observed via note-change / alarm events), not by polling note state. `updateAllRecurrences` remains
 * as a periodic safety-net sweep in case an event was missed.
 *
 * Persistence convention used throughout: when `recurrence.enabled` is true we `RecurrenceStore.set`,
 * and when it is false (e.g. after `updateStopStatus` exhausts a count/date limit, or the dialog
 * disables it) we `RecurrenceStore.remove` so the recurring index stays clean.
 *
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

    const existing = await RecurrenceStore.get(selectedNote.id);
    const result = await openDialog(existing ?? new Recurrence());

    if (!result) return;

    if (result.enabled) {
      await RecurrenceStore.set(selectedNote.id, result);
    } else {
      // Disabling cleans up the index entirely.
      await RecurrenceStore.remove(selectedNote.id);
    }
  }

  /** Safety-net sweep: re-process every recurring todo in case an event was missed. */
  @Trace()
  @TryCatch({ logError: true })
  static async updateAllRecurrences(): Promise<void> {
    if (this.updating) return;
    this.updating = true;

    try {
      const todos = await RecurrenceStore.getAllRecurringTodos();
      for (const todo of todos) {
        await this.processTodo(todo);
      }
    } finally {
      this.updating = false;
    }
  }

  /** Move overdue todos to today (preserve time-of-day). */
  @Trace()
  @TryCatch({ logError: true })
  static async setOverdueTodosToToday(): Promise<void> {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const todos = await RecurrenceStore.getAllRecurringTodos();
    for (const todo of todos) {
      const dueDate = new Date(todo.todo_due);

      if (todo.recurrence.enabled && todo.todo_due !== 0 && dueDate < startOfToday) {
        const newDueDate = new Date(startOfToday);
        newDueDate.setHours(
          dueDate.getHours(),
          dueDate.getMinutes(),
          dueDate.getSeconds(),
          dueDate.getMilliseconds()
        );

        await JoplinAPI.setTaskDueDate(todo.id, newDueDate);
      }
    }

    await joplin.views.dialogs.showMessageBox('Overdue Tasks Rescheduled');
  }

  /** Mark overdue todos complete and roll their next occurrence forward past today. */
  @Trace()
  @TryCatch({ logError: true })
  static async updateOverdueTodos(): Promise<void> {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const todos = await RecurrenceStore.getAllRecurringTodos();
    for (const todo of todos) {
      const dueDate = new Date(todo.todo_due);

      if (todo.recurrence.enabled && todo.todo_due !== 0 && dueDate < startOfToday) {
        await JoplinAPI.markTaskComplete(todo.id);
        // Treat as completed for the roll-forward (the store record may be stale).
        await this.processTodo(
          { ...todo, todo_completed: Date.now() },
          startOfToday
        );
      }
    }

    await joplin.views.dialogs.showMessageBox('Overdue Tasks Rescheduled');
  }

  /** Event hook: a note changed. If it is a now-completed recurring todo, advance it. */
  @Trace()
  @TryCatch({ logError: true })
  static async handleNoteChange(noteId: string): Promise<void> {
    const note = await JoplinAPI.getNote(noteId);
    if (!note) return;

    const recurrence = await RecurrenceStore.get(noteId);
    if (!recurrence || !recurrence.enabled) return;

    const todo: RecurringTodo = {
      id: note.id,
      title: note.title,
      is_todo: note.is_todo,
      todo_due: note.todo_due,
      todo_completed: note.todo_completed,
      recurrence,
    };

    await this.processTodo(todo);
  }

  /**
   * Event hook: an alarm fired for a note. Advancement happens on completion, so if the to-do is
   * already complete we advance (same path as a note-change); otherwise the alarm merely notified
   * the user and we no-op.
   */
  @Trace()
  @TryCatch({ logError: true })
  static async handleAlarm(noteId: string): Promise<void> {
    const note = await JoplinAPI.getNote(noteId);
    if (!note) return;

    if (note.todo_completed && note.todo_completed !== 0) {
      await this.handleNoteChange(noteId);
    }
  }

  /** Core recurrence engine. */
  @Trace()
  @TryCatch({ logError: true })
  private static async processTodo(
    todo: RecurringTodo,
    after: Date | null = null
  ): Promise<void> {
    const recurrence = todo.recurrence;

    if (
      todo.todo_completed !== 0 &&
      todo.todo_due !== 0 &&
      recurrence.enabled
    ) {
      const initialDate = new Date(todo.todo_due);
      const nextDate =
        after == null
          ? recurrence.getNextDate(initialDate)
          : recurrence.getNextDateAfter(initialDate, after);

      if (!nextDate) return;

      await JoplinAPI.setTaskDueDate(todo.id, nextDate);
      await JoplinAPI.markTaskIncomplete(todo.id);
      await JoplinAPI.markSubTasksIncomplete(todo.id);

      recurrence.updateStopStatus();

      if (recurrence.enabled) {
        await RecurrenceStore.set(todo.id, recurrence);
      } else {
        // The recurrence just hit its stop condition; drop it from the index.
        await RecurrenceStore.remove(todo.id);
      }
    }
  }
}
