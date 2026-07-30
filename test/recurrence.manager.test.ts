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

/** Milliseconds offset from now, for time-relative test fixtures. */
function fromNow(ms: number): number {
  return Date.now() + ms;
}

const ONE_MINUTE = 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

/**
 * "Now" for the whole suite. The engine always advances a to-do to an occurrence that is still to
 * come, so the fixed calendar fixtures below (a to-do due Jan 10 09:00 and ticked off at 12:00) only
 * mean what they say with the clock pinned to that moment.
 */
const NOW = new Date(2026, 0, 10, 12, 0);

beforeAll(() => {
  jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
});

afterAll(() => {
  jest.useRealTimers();
});

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
  mockStore.removeAll.mockResolvedValue(0);
  // showMessageBox returns 0 (OK) unless a test says otherwise.
  (joplin.views.dialogs.showMessageBox as jest.Mock).mockResolvedValue(0);
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

  it('does not advance an incomplete todo when alarm reset is off for it', async () => {
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

  it('no-ops on an incomplete todo when alarm reset is off for it', async () => {
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

describe('RecurrenceManager alarm reset (per-to-do resetAlarmWhenNotDone)', () => {
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
    const note = overdueOpenNote();
    mockApi.getNote.mockResolvedValue(note);
    const recurrence = dailyRecurrence({ resetAlarmWhenNotDone: true });
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
    // Hourly recurrence that was last due three and a half hours ago.
    const dueAt = fromNow(-3.5 * ONE_HOUR);
    mockApi.getNote.mockResolvedValue(overdueOpenNote({ todo_due: dueAt }));
    mockStore.get.mockResolvedValue(
      dailyRecurrence({ interval: 'hour', resetAlarmWhenNotDone: true })
    );

    await RecurrenceManager.handleAlarm('note-1');

    const [, calledDate] = mockApi.setTaskDueDate.mock.calls[0];
    expect((calledDate as Date).getTime()).toBeGreaterThan(Date.now());
    // Four hourly steps from the original due date clears "now" by half an hour.
    expect((calledDate as Date).getTime()).toBe(dueAt + 4 * ONE_HOUR);
  });

  it('leaves a todo alone when its alarm has not fired yet', async () => {
    mockApi.getNote.mockResolvedValue(overdueOpenNote({ todo_due: fromNow(ONE_HOUR) }));
    mockStore.get.mockResolvedValue(dailyRecurrence({ resetAlarmWhenNotDone: true }));

    await RecurrenceManager.handleAlarm('note-1');

    expect(mockApi.setTaskDueDate).not.toHaveBeenCalled();
    expect(mockStore.set).not.toHaveBeenCalled();
  });

  it('leaves a todo with no due date alone', async () => {
    mockApi.getNote.mockResolvedValue(overdueOpenNote({ todo_due: 0 }));
    mockStore.get.mockResolvedValue(dailyRecurrence({ resetAlarmWhenNotDone: true }));

    await RecurrenceManager.handleAlarm('note-1');

    expect(mockApi.setTaskDueDate).not.toHaveBeenCalled();
  });

  it('catches alarms missed while Joplin was closed via the safety-net sweep', async () => {
    const todo = makeTodo({
      todo_due: fromNow(-ONE_HOUR),
      todo_completed: 0,
      recurrence: dailyRecurrence({ resetAlarmWhenNotDone: true }),
    });
    mockStore.getAllRecurringTodos.mockResolvedValue([todo]);

    await RecurrenceManager.updateAllRecurrences();

    expect(mockApi.setTaskDueDate).toHaveBeenCalledTimes(1);
    expect(mockApi.markTaskIncomplete).not.toHaveBeenCalled();
  });

  it('consumes an occurrence of a stop-after-N recurrence when the alarm is skipped', async () => {
    const recurrence = dailyRecurrence({
      stopType: 'number',
      stopNumber: 1,
      resetAlarmWhenNotDone: true,
    });
    mockApi.getNote.mockResolvedValue(overdueOpenNote());
    mockStore.get.mockResolvedValue(recurrence);

    await RecurrenceManager.handleAlarm('note-1');

    expect(mockApi.setTaskDueDate).toHaveBeenCalledTimes(1);
    expect(recurrence.enabled).toBe(false);
    expect(mockStore.remove).toHaveBeenCalledWith('note-1');
  });

  it('is off by default, so an overdue open to-do is left alone', async () => {
    mockApi.getNote.mockResolvedValue(overdueOpenNote());
    mockStore.get.mockResolvedValue(dailyRecurrence());

    await RecurrenceManager.handleAlarm('note-1');

    expect(mockApi.setTaskDueDate).not.toHaveBeenCalled();
    expect(mockStore.set).not.toHaveBeenCalled();
  });

  it('only touches the to-dos that opted in, not every recurring to-do', async () => {
    const optedIn = makeTodo({
      id: 'note-opted-in',
      todo_due: fromNow(-ONE_HOUR),
      todo_completed: 0,
      recurrence: dailyRecurrence({ resetAlarmWhenNotDone: true }),
    });
    const untouched = makeTodo({
      id: 'note-plain',
      todo_due: fromNow(-ONE_HOUR),
      todo_completed: 0,
      recurrence: dailyRecurrence(),
    });
    mockStore.getAllRecurringTodos.mockResolvedValue([optedIn, untouched]);

    await RecurrenceManager.updateAllRecurrences();

    expect(mockApi.setTaskDueDate).toHaveBeenCalledTimes(1);
    expect(mockApi.setTaskDueDate.mock.calls[0][0]).toBe('note-opted-in');
    expect(mockStore.set).toHaveBeenCalledTimes(1);
    expect(mockStore.set.mock.calls[0][0]).toBe('note-opted-in');
  });
});

describe('RecurrenceManager short intervals', () => {
  /** An enabled minute-based recurrence. */
  function minuteRecurrence(intervalNumber: number): Recurrence {
    return dailyRecurrence({ interval: 'minute', intervalNumber });
  }

  it('rolls a completed 5-minute to-do past the occurrences that already went by', async () => {
    // Nobody ticks a to-do off within five minutes of it being due. One step from the old alarm
    // would land in the past, reopening the to-do as instantly overdue with no alarm left to fire.
    const dueAt = fromNow(-12 * ONE_MINUTE);
    const todo = makeTodo({
      todo_due: dueAt,
      todo_completed: Date.now(),
      recurrence: minuteRecurrence(5),
    });
    mockStore.getAllRecurringTodos.mockResolvedValue([todo]);

    await RecurrenceManager.updateAllRecurrences();

    const [, calledDate] = mockApi.setTaskDueDate.mock.calls[0];
    // 5-minute steps from 12 minutes ago land on -7, -2, +3: the first one still to come.
    expect((calledDate as Date).getTime()).toBe(dueAt + 15 * ONE_MINUTE);
    expect((calledDate as Date).getTime()).toBeGreaterThan(Date.now());
    // Completing still reopens the to-do and resets its sub-tasks.
    expect(mockApi.markTaskIncomplete).toHaveBeenCalledWith('note-1');
    expect(mockApi.markSubTasksIncomplete).toHaveBeenCalledWith('note-1');
  });

  it('lands an every-minute to-do on an alarm that is still to come', async () => {
    const dueAt = fromNow(-10 * ONE_MINUTE);
    const todo = makeTodo({
      todo_due: dueAt,
      todo_completed: Date.now(),
      recurrence: minuteRecurrence(1),
    });
    mockStore.getAllRecurringTodos.mockResolvedValue([todo]);

    await RecurrenceManager.updateAllRecurrences();

    const [, calledDate] = mockApi.setTaskDueDate.mock.calls[0];
    expect((calledDate as Date).getTime()).toBe(dueAt + 11 * ONE_MINUTE);
    expect((calledDate as Date).getTime()).toBeGreaterThan(Date.now());
  });

  it('advances a to-do ticked off ahead of its alarm by exactly one interval', async () => {
    // Nothing to skip here, so the next occurrence is simply the one after the current alarm.
    const dueAt = new Date(2026, 1, 10, 9, 0).getTime();
    const todo = makeTodo({ todo_due: dueAt, todo_completed: Date.now() });
    mockStore.getAllRecurringTodos.mockResolvedValue([todo]);

    await RecurrenceManager.updateAllRecurrences();

    const [, calledDate] = mockApi.setTaskDueDate.mock.calls[0];
    expect((calledDate as Date).getTime()).toBe(new Date(2026, 1, 11, 9, 0).getTime());
  });

  it('does not stall when the interval number was stored as a string', async () => {
    // The dialog's number field reads back as a string, which the date maths would otherwise
    // concatenate instead of add.
    const recurrence = minuteRecurrence(5);
    (recurrence as any).intervalNumber = '5';
    const dueAt = fromNow(-12 * ONE_MINUTE);
    const todo = makeTodo({ todo_due: dueAt, todo_completed: Date.now(), recurrence });
    mockStore.getAllRecurringTodos.mockResolvedValue([todo]);

    await RecurrenceManager.updateAllRecurrences();

    const [, calledDate] = mockApi.setTaskDueDate.mock.calls[0];
    expect((calledDate as Date).getTime()).toBe(dueAt + 15 * ONE_MINUTE);
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

describe('RecurrenceManager.clearAllRecurrences', () => {
  it('clears every recurrence once the user confirms', async () => {
    mockStore.removeAll.mockResolvedValue(4);

    const cleared = await RecurrenceManager.clearAllRecurrences();

    expect(cleared).toBe(4);
    expect(mockStore.removeAll).toHaveBeenCalledTimes(1);
    // The to-dos themselves are untouched: no due dates moved, no completion state changed.
    expect(mockApi.setTaskDueDate).not.toHaveBeenCalled();
    expect(mockApi.markTaskComplete).not.toHaveBeenCalled();
    expect(mockApi.markTaskIncomplete).not.toHaveBeenCalled();
    expect(mockApi.markSubTasksIncomplete).not.toHaveBeenCalled();
  });

  it('clears nothing when the user cancels the confirmation', async () => {
    // showMessageBox returns 1 for Cancel.
    (joplin.views.dialogs.showMessageBox as jest.Mock).mockResolvedValue(1);

    const cleared = await RecurrenceManager.clearAllRecurrences();

    expect(cleared).toBe(-1);
    expect(mockStore.removeAll).not.toHaveBeenCalled();
  });

  it('reports back when there was nothing to clear', async () => {
    mockStore.removeAll.mockResolvedValue(0);

    expect(await RecurrenceManager.clearAllRecurrences()).toBe(0);
    // Confirmation + result message.
    expect(joplin.views.dialogs.showMessageBox).toHaveBeenCalledTimes(2);
  });
});
