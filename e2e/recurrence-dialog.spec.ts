import { test, expect } from '@playwright/test';
import { launchJoplin, closeJoplin, JoplinInstance } from './launch';
import { createNotebook, createTodo, setRecurrence, readRecurrenceDialog } from './helpers';

/**
 * Core UI + storage round-trip: drive the real recurrence dialog, persist settings via OK,
 * reopen, and assert the values survived a real Joplin note userData round-trip.
 *
 * Recurrence is stored per-note, so each test owns its own uniquely-titled to-do in a shared
 * notebook and stays independent of the others.
 */
test.describe('Recurrence dialog round-trip', () => {
  let joplin: JoplinInstance;

  test.beforeAll(async () => {
    joplin = await launchJoplin();
    await createNotebook(joplin.win, 'Dialog NB');
  });

  test.afterAll(async () => {
    if (joplin) await closeJoplin(joplin);
  });

  test('weekly with weekdays persists across reopen', async () => {
    const { win } = joplin;
    await createTodo(win, 'Weekly Todo ' + Date.now());

    await setRecurrence(win, {
      enabled: true,
      interval: 'week',
      weekdays: ['monday', 'friday'],
    });

    const state = await readRecurrenceDialog(win);
    expect(state.enabled).toBe(true);
    expect(state.interval).toBe('week');
    expect(state.weekdays.monday).toBe(true);
    expect(state.weekdays.friday).toBe(true);
    // Untouched days should remain unticked.
    expect(state.weekdays.tuesday).toBe(false);
  });

  test('enable then disable persists', async () => {
    const { win } = joplin;
    await createTodo(win, 'Toggle Todo ' + Date.now());

    // Enable daily.
    await setRecurrence(win, { enabled: true, interval: 'day' });

    let state = await readRecurrenceDialog(win);
    expect(state.enabled).toBe(true);
    expect(state.interval).toBe('day');

    // Now disable.
    await setRecurrence(win, { enabled: false });

    state = await readRecurrenceDialog(win);
    expect(state.enabled).toBe(false);
  });

  test('the alarm-reset option is off by default and stays per to-do', async () => {
    const { win } = joplin;

    // A to-do that opts in.
    await createTodo(win, 'Opted In Todo ' + Date.now());
    await setRecurrence(win, {
      enabled: true,
      interval: 'day',
      resetAlarmWhenNotDone: true,
    });
    expect((await readRecurrenceDialog(win)).resetAlarmWhenNotDone).toBe(true);

    // A second to-do set up the same way, minus that option, must not inherit it.
    await createTodo(win, 'Plain Todo ' + Date.now());
    await setRecurrence(win, { enabled: true, interval: 'day' });
    expect((await readRecurrenceDialog(win)).resetAlarmWhenNotDone).toBe(false);
  });
});
