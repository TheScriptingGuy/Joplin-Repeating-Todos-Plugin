// Unit tests for the RecurrenceManager engine.
//
// The storage layer (RecurrenceStore) and the Joplin wrapper (JoplinAPI) are mocked so the engine
// logic can be asserted in isolation. The real Recurrence model is used so date math is exercised.

import { RecurrenceManager } from '../src/core/recurrence';
import { RecurrenceStore, RecurringTodo } from '../src/core/database';
import { JoplinAPI } from '../src/core/joplin';
import { Recurrence } from '../src/model/recurrence';

jest.mock('../src/core/database');
jest.mock('../src/core/joplin');

const mockStore = RecurrenceStore as jest.Mocked<typeof RecurrenceStore>;
const mockApi = JoplinAPI as jest.Mocked<typeof JoplinAPI>;

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

  it('does not advance a todo that is not completed', async () => {
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

  it('no-ops when the alarmed todo is not completed', async () => {
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
