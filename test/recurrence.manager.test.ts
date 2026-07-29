// Unit tests for the RecurrenceManager engine.
//
// The storage layer (RecurrenceStore) and the Joplin wrapper (JoplinAPI) are mocked so the engine
// logic can be asserted in isolation. The real Recurrence model is used so date math is exercised.

import joplin from 'api';
import { RecurrenceManager } from '../src/core/recurrence';
import { RecurrenceStore, RecurringTodo } from '../src/core/database';
import { JoplinAPI } from '../src/core/joplin';
import { Recurrence } from '../src/model/recurrence';

jest.mock('../src/core/database');
jest.mock('../src/core/joplin');

const mockStore = RecurrenceStore as jest.Mocked<typeof RecurrenceStore>;
const mockApi = JoplinAPI as jest.Mocked<typeof JoplinAPI>;

/**
 * Sets the `resetAlarmWhenNotDone` setting for a test while leaving every other setting (notably
 * `debug`, which drives @Trace) off.
 */
function setResetAlarmWhenNotDone(enabled: boolean): void {
  (joplin.settings.value as jest.Mock).mockImplementation(
    async (key: string) => (key === 'resetAlarmWhenNotDone' ? enabled : false)
  );
}

/** Milliseconds offset from now, for time-relative test fixtures. */
function fromNow(ms: number): number {
  return Date.now() + ms;
}

const ONE_HOUR = 60 * 60 * 1000;

/** Build an enabled daily recurrence (optionally overridden). */
function dailyRecurrence(overrides: Partial<Recurrence> = {}): Recurrence {
  const r = new Recurrence();
  r.enabled = true;
  r.interval = 'day';
  r.intervalNumber = 1;
  Object.assign(r, overrides);
  return r;
}

/** Build a RecurringTodo record. */
function makeTodo(overrides: Partial<RecurringTodo> = {}): RecurringTodo {
  return {
    id: 'note-1',
    title: 'Test todo',
    is_todo: 1,
    todo_due: new Date(2026, 0, 10, 9, 0).getTime(),
    todo_completed: new Date(2026, 0, 10, 12, 0).getTime(),
    recurrence: dailyRecurrence(),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  // Sensible defaults.
  mockStore.get.mockResolvedValue(null);
  mockStore.getAllRecurringTodos.mockResolvedValue([]);
  mockStore.set.mockResolvedValue(undefined);
  mockStore.remove.mockResolvedValue(undefined);
  mockApi.getNote.mockResolvedValue(null);
  mockApi.setTaskDueDate.mockResolvedValue(undefined);
  mockApi.markTaskIncomplete.mockResolvedValue(undefined);
  mockApi.markSubTasksIncomplete.mockResolvedValue(undefined);
  mockApi.markTaskComplete.mockResolvedValue(undefined);
  // Default to the old behaviour; the alarm-reset tests opt in explicitly.
  setResetAlarmWhenNotDone(false);
  // Reset the static re-entrancy guard between tests.
  (RecurrenceManager as any).updating = false;
});

describe('RecurrenceManager.updateAllRecurrences (sweep)', () => {
  it('advances a completed + enabled todo to the next occurrence and persists', async () => {
    const todo = makeTodo();
    mockStore.getAllRecurringTodos.mockResolvedValue([todo]);

    await RecurrenceManager.updateAllRecurrences();

    expect(mockApi.setTaskDueDate).toHaveBeenCalledTimes(1);
    const [calledId, calledDate] = mockApi.setTaskDueDate.mock.calls[0];
    expect(calledId).toBe('note-1');
    // Daily recurrence: due moves from Jan 10 09:00 to Jan 11 09:00.
    expect((calledDate as Date).getTime()).toBe(new Date(2026, 0, 11, 9, 0).getTime());

    expect(mockApi.markTaskIncomplete).toHaveBeenCalledWith('note-1');
    expect(mockApi.markSubTasksIncomplete).toHaveBeenCalledWith('note-1');
    expect(mockStore.set).toHaveBeenCalledWith('note-1', todo.recurrence);
    expect(mockStore.remove).not.toHaveBeenCalled();
  });

  it('does not advance an incomplete todo when alarm reset is off', async () => {
    const todo = makeTodo({ todo_completed: 0 });
    mockStore.getAllRecurringTodos.mockResolvedValue([todo]);

    await RecurrenceManager.updateAllRecurrences();

    expect(mockApi.setTaskDueDate).not.toHaveBeenCalled();
    expect(mockApi.markTaskIncomplete).not.toHaveBeenCalled();
    expect(mockStore.set).not.toHaveBeenCalled();
  });

  it('does not advance a todo whose recurrence is disabled', async () => {
    const todo = makeTodo({ recurrence: dailyRecurrence({ enabled: false }) });
    mockStore.getAllRecurringTodos.mockResolvedValue([todo]);

    await RecurrenceManager.updateAllRecurrences();

    expect(mockApi.setTaskDueDate).not.toHaveBeenCalled();
    expect(mockStore.set).not.toHaveBeenCalled();
  });

  it('is re-entrancy guarded: a concurrent call is a no-op', async () => {
    const todo = makeTodo();
    mockStore.getAllRecurringTodos.mockResolvedValue([todo]);

    (RecurrenceManager as any).updating = true;
    await RecurrenceManager.updateAllRecurrences();

    expect(mockStore.getAllRecurringTodos).not.toHaveBeenCalled();
    expect(mockApi.setTaskDueDate).not.toHaveBeenCalled();
  });
});

describe('RecurrenceManager.handleNoteChange', () => {
  it('advances when the note is a completed recurring todo with an enabled recurrence', async () => {
    mockApi.getNote.mockResolvedValue({
      id: 'note-1',
      title: 'Test todo',
      is_todo: 1,
      todo_due: new Date(2026, 0, 10, 9, 0).getTime(),
      todo_completed: new Date(2026, 0, 10, 12, 0).getTime(),
    });
    mockStore.get.mockResolvedValue(dailyRecurrence());

    await RecurrenceManager.handleNoteChange('note-1');

    expect(mockApi.setTaskDueDate).toHaveBeenCalledTimes(1);
    const [, calledDate] = mockApi.setTaskDueDate.mock.calls[0];
    expect((calledDate as Date).getTime()).toBe(new Date(2026, 0, 11, 9, 0).getTime());
    expect(mockApi.markTaskIncomplete).toHaveBeenCalledWith('note-1');
    expect(mockStore.set).toHaveBeenCalledTimes(1);
  });

  it('no-ops when the note is incomplete', async () => {
    mockApi.getNote.mockResolvedValue({
      id: 'note-1',
      title: 'Test todo',
      is_todo: 1,
      todo_due: new Date(2026, 0, 10, 9, 0).getTime(),
      todo_completed: 0,
    });
    mockStore.get.mockResolvedValue(dailyRecurrence());

    await RecurrenceManager.handleNoteChange('note-1');

    expect(mockApi.setTaskDueDate).not.toHaveBeenCalled();
    expect(mockStore.set).not.toHaveBeenCalled();
  });

  it('no-ops when there is no recurrence for the note', async () => {
    mockApi.getNote.mockResolvedValue({
      id: 'note-1',
      is_todo: 1,
      todo_due: new Date(2026, 0, 10, 9, 0).getTime(),
      todo_completed: new Date(2026, 0, 10, 12, 0).getTime(),
    });
    mockStore.get.mockResolvedValue(null);

    await RecurrenceManager.handleNoteChange('note-1');

    expect(mockApi.setTaskDueDate).not.toHaveBeenCalled();
  });
});

describe('RecurrenceManager.handleAlarm', () => {
  it('advances when the alarmed todo is already completed', async () => {
    mockApi.getNote
      // First call (in handleAlarm) and second call (in handleNoteChange) return the same note.
      .mockResolvedValue({
        id: 'note-1',
        title: 'Test todo',
        is_todo: 1,
        todo_due: new Date(2026, 0, 10, 9, 0).getTime(),
        todo_completed: new Date(2026, 0, 10, 12, 0).getTime(),
      });
    mockStore.get.mockResolvedValue(dailyRecurrence());

    await RecurrenceManager.handleAlarm('note-1');

    expect(mockApi.setTaskDueDate).toHaveBeenCalledTimes(1);
  });

  it('no-ops on an incomplete todo when alarm reset is off', async () => {
    mockApi.getNote.mockResolvedValue({
      id: 'note-1',
      is_todo: 1,
      todo_due: new Date(2026, 0, 10, 9, 0).getTime(),
      todo_completed: 0,
    });
    mockStore.get.mockResolvedValue(dailyRecurrence());

    await RecurrenceManager.handleAlarm('note-1');

    expect(mockApi.setTaskDueDate).not.toHaveBeenCalled();
  });
});

describe('RecurrenceManager alarm reset (resetAlarmWhenNotDone)', () => {
  /** An incomplete todo whose alarm went off an hour ago. */
  function overdueOpenNote(overrides: Record<string, any> = {}) {
    return {
      id: 'note-1',
      title: 'Test todo',
      is_todo: 1,
      todo_due: fromNow(-ONE_HOUR),
      todo_completed: 0,
      ...overrides,
    };
  }

  it('re-arms the alarm on the next occurrence without completing the todo', async () => {
    setResetAlarmWhenNotDone(true);
    const note = overdueOpenNote();
    mockApi.getNote.mockResolvedValue(note);
    const recurrence = dailyRecurrence();
    mockStore.get.mockResolvedValue(recurrence);

    await RecurrenceManager.handleAlarm('note-1');

    expect(mockApi.setTaskDueDate).toHaveBeenCalledTimes(1);
    const [calledId, calledDate] = mockApi.setTaskDueDate.mock.calls[0];
    expect(calledId).toBe('note-1');
    // Daily recurrence, one hour overdue → tomorrow, same time of day.
    const expected = new Date(note.todo_due);
    expected.setDate(expected.getDate() + 1);
    expect((calledDate as Date).getTime()).toBe(expected.getTime());
    // The to-do was never done, so its state and its sub-tasks are left alone.
    expect(mockApi.markTaskIncomplete).not.toHaveBeenCalled();
    expect(mockApi.markSubTasksIncomplete).not.toHaveBeenCalled();
    expect(mockStore.set).toHaveBeenCalledWith('note-1', recurrence);
  });

  it('skips past every missed occurrence so the new alarm is in the future', async () => {
    setResetAlarmWhenNotDone(true);
    // Hourly recurrence that was last due three and a half hours ago.
    const dueAt = fromNow(-3.5 * ONE_HOUR);
    mockApi.getNote.mockResolvedValue(overdueOpenNote({ todo_due: dueAt }));
    mockStore.get.mockResolvedValue(dailyRecurrence({ interval: 'hour' }));

    await RecurrenceManager.handleAlarm('note-1');

    const [, calledDate] = mockApi.setTaskDueDate.mock.calls[0];
    expect((calledDate as Date).getTime()).toBeGreaterThan(Date.now());
    // Four hourly steps from the original due date clears "now" by half an hour.
    expect((calledDate as Date).getTime()).toBe(dueAt + 4 * ONE_HOUR);
  });

  it('leaves a todo alone when its alarm has not fired yet', async () => {
    setResetAlarmWhenNotDone(true);
    mockApi.getNote.mockResolvedValue(overdueOpenNote({ todo_due: fromNow(ONE_HOUR) }));
    mockStore.get.mockResolvedValue(dailyRecurrence());

    await RecurrenceManager.handleAlarm('note-1');

    expect(mockApi.setTaskDueDate).not.toHaveBeenCalled();
    expect(mockStore.set).not.toHaveBeenCalled();
  });

  it('leaves a todo with no due date alone', async () => {
    setResetAlarmWhenNotDone(true);
    mockApi.getNote.mockResolvedValue(overdueOpenNote({ todo_due: 0 }));
    mockStore.get.mockResolvedValue(dailyRecurrence());

    await RecurrenceManager.handleAlarm('note-1');

    expect(mockApi.setTaskDueDate).not.toHaveBeenCalled();
  });

  it('catches alarms missed while Joplin was closed via the safety-net sweep', async () => {
    setResetAlarmWhenNotDone(true);
    const todo = makeTodo({ todo_due: fromNow(-ONE_HOUR), todo_completed: 0 });
    mockStore.getAllRecurringTodos.mockResolvedValue([todo]);

    await RecurrenceManager.updateAllRecurrences();

    expect(mockApi.setTaskDueDate).toHaveBeenCalledTimes(1);
    expect(mockApi.markTaskIncomplete).not.toHaveBeenCalled();
  });

  it('consumes an occurrence of a stop-after-N recurrence when the alarm is skipped', async () => {
    setResetAlarmWhenNotDone(true);
    const recurrence = dailyRecurrence({ stopType: 'number', stopNumber: 1 });
    mockApi.getNote.mockResolvedValue(overdueOpenNote());
    mockStore.get.mockResolvedValue(recurrence);

    await RecurrenceManager.handleAlarm('note-1');

    expect(mockApi.setTaskDueDate).toHaveBeenCalledTimes(1);
    expect(recurrence.enabled).toBe(false);
    expect(mockStore.remove).toHaveBeenCalledWith('note-1');
  });

  it('defaults to on when the setting cannot be read', async () => {
    (joplin.settings.value as jest.Mock).mockImplementation(async (key: string) => {
      if (key === 'resetAlarmWhenNotDone') throw new Error('setting not registered');
      return false;
    });
    mockApi.getNote.mockResolvedValue(overdueOpenNote());
    mockStore.get.mockResolvedValue(dailyRecurrence());

    await RecurrenceManager.handleAlarm('note-1');

    expect(mockApi.setTaskDueDate).toHaveBeenCalledTimes(1);
  });
});

describe('RecurrenceManager stop-by-number', () => {
  it('removes the recurrence from the index once the count is exhausted', async () => {
    // stopType 'number' with stopNumber 1 → updateStopStatus disables it after processing.
    const recurrence = dailyRecurrence({ stopType: 'number', stopNumber: 1 });
    const todo = makeTodo({ recurrence });
    mockStore.getAllRecurringTodos.mockResolvedValue([todo]);

    await RecurrenceManager.updateAllRecurrences();

    // The next occurrence is still scheduled...
    expect(mockApi.setTaskDueDate).toHaveBeenCalledTimes(1);
    // ...but because the recurrence is now disabled, it is removed (not set).
    expect(recurrence.enabled).toBe(false);
    expect(mockStore.remove).toHaveBeenCalledWith('note-1');
    expect(mockStore.set).not.toHaveBeenCalled();
  });

  it('decrements and persists when more than one occurrence remains', async () => {
    const recurrence = dailyRecurrence({ stopType: 'number', stopNumber: 3 });
    const todo = makeTodo({ recurrence });
    mockStore.getAllRecurringTodos.mockResolvedValue([todo]);

    await RecurrenceManager.updateAllRecurrences();

    expect(recurrence.enabled).toBe(true);
    expect(recurrence.stopNumber).toBe(2);
    expect(mockStore.set).toHaveBeenCalledWith('note-1', recurrence);
    expect(mockStore.remove).not.toHaveBeenCalled();
  });
});
