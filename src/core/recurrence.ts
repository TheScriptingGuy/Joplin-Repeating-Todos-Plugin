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
 * The engine is alarm/event-native: advancement happens when a recurring to-do is marked complete,
 * or when its alarm passes while it is still open (observed via note-change / alarm events), not by
 * polling note state. `updateAllRecurrences` remains as a periodic safety-net sweep in case an event
 * was missed — which is also what catches alarms that elapsed while Joplin was closed.
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

  /**
   * Wipe the recurrence settings off every to-do, after confirming with the user.
   *
   * This only clears what the recurrence dialog stores (the userData entry and the `recurring`
   * index tag). The to-dos themselves are left alone: their alarms, completion state and sub-tasks
   * are untouched — they simply stop repeating. There is no undo, hence the confirmation.
   *
   * Returns the number of to-dos cleared, or -1 when the user cancelled.
   */
  @Trace()
  @TryCatch({ logError: true, fallback: -1 })
  static async clearAllRecurrences(): Promise<number> {
    const confirmed = await joplin.views.dialogs.showMessageBox(
      'Remove the recurrence settings from every to-do?\n\n' +
        'All to-dos will stop repeating. Their alarms and contents are left as they are, but the ' +
        'recurrence settings cannot be restored afterwards.'
    );
    // showMessageBox returns 0 for OK and 1 for Cancel.
    if (confirmed !== 0) return -1;

    const cleared = await RecurrenceStore.removeAll();

    await joplin.views.dialogs.showMessageBox(
      cleared === 0
        ? 'No to-dos had recurrence settings to remove.'
        : `Recurrence settings removed from ${cleared} to-do${cleared === 1 ? '' : 's'}.`
    );

    return cleared;
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
   * Event hook: an alarm fired for a note. A completed to-do advances exactly as it would on a
   * note-change; an open one is rolled on to its next occurrence only when that to-do has
   * `resetAlarmWhenNotDone` set on its own recurrence, which re-arms the alarm without the to-do
   * ever being ticked off. Both cases are handled by `processTodo`, so the alarm is just another
   * way in.
   */
  @Trace()
  @TryCatch({ logError: true })
  static async handleAlarm(noteId: string): Promise<void> {
    await this.handleNoteChange(noteId);
  }

  /**
   * Core recurrence engine.
   *
   * Two paths advance a to-do to its next occurrence:
   *  - completion — the to-do was ticked off. It is reopened and its sub-tasks are reset.
   *  - alarm reset — the due date/alarm passed while the to-do was still open, and this to-do's
   *    recurrence has `resetAlarmWhenNotDone` ticked. The missed occurrence is skipped and the
   *    alarm re-armed on the next one; the to-do stays open and any sub-task progress is left
   *    untouched. Off by default, so a repeating to-do that is not done stays overdue.
   *
   * Either way the to-do lands on its next occurrence that is still to come, never on one that has
   * already gone by.
   *
   * Both paths consume one occurrence, so a stop-after-N recurrence counts skipped alarms too.
   */
  @Trace()
  @TryCatch({ logError: true })
  private static async processTodo(
    todo: RecurringTodo,
    after: Date | null = null
  ): Promise<void> {
    const recurrence = todo.recurrence;

    if (todo.todo_due === 0 || !recurrence.enabled) return;

    const completed = todo.todo_completed !== 0;
    const now = new Date();

    if (!completed) {
      // An open to-do only moves on once its alarm has actually passed, and only when this
      // particular to-do was set up to have its alarm reset. Every other repeating to-do stays
      // overdue until it is ticked off.
      if (!recurrence.resetAlarmWhenNotDone) return;
      if (todo.todo_due > now.getTime()) return;
    }

    const initialDate = new Date(todo.todo_due);
    // The next occurrence always has to land in the future, on either path. A to-do that was missed
    // several intervals ago (Joplin closed over the weekend, say) would otherwise only creep forward
    // one step, and a to-do on a short interval - every few minutes - is always ticked off after its
    // own alarm, so one step from the old alarm would put the next occurrence in the past: reopened
    // and instantly overdue, with no alarm left to fire and nothing to move it on again.
    const notBefore = after ?? now;
    const nextDate = recurrence.getNextDateAfter(initialDate, notBefore);

    if (!nextDate) return;

    await JoplinAPI.setTaskDueDate(todo.id, nextDate);

    if (completed) {
      await JoplinAPI.markTaskIncomplete(todo.id);
      await JoplinAPI.markSubTasksIncomplete(todo.id);
    }

    recurrence.updateStopStatus();

    if (recurrence.enabled) {
      await RecurrenceStore.set(todo.id, recurrence);
    } else {
      // The recurrence just hit its stop condition; drop it from the index.
      await RecurrenceStore.remove(todo.id);
    }
  }
}
