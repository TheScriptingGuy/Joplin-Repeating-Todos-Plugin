import { test, expect } from '@playwright/test';
import { launchJoplin, closeJoplin, JoplinInstance } from './launch';
import {
  createNotebook,
  createTodo,
  setRecurrence,
  setAlarm,
  readAlarm,
  completeTodo,
  isTodoComplete,
} from './helpers';

/**
 * Headline behavior: when a recurring to-do (with an alarm) is marked complete, the plugin
 * asynchronously (via onNoteChange) advances its alarm by the configured interval and re-marks
 * the to-do incomplete. This drives that flow through the real GUI.
 */
test.describe('Recurrence advancement', () => {
  let joplin: JoplinInstance;

  test.beforeAll(async () => {
    joplin = await launchJoplin();
    await createNotebook(joplin.win, 'Advance NB');
  });

  test.afterAll(async () => {
    if (joplin) await closeJoplin(joplin);
  });

  test('completing a daily recurring to-do advances alarm +1 day and re-marks incomplete', async () => {
    const { win } = joplin;
    await createTodo(win, 'Advance Todo ' + Date.now());

    const ORIGINAL = '2026-06-01T09:00';
    const EXPECTED = '2026-06-02T09:00';

    // Give it an alarm (required for advancement), then make it repeat daily.
    await setAlarm(win, ORIGINAL);
    await setRecurrence(win, { enabled: true, interval: 'day' });

    // Sanity: alarm was set.
    expect(await readAlarm(win)).toBe(ORIGINAL);

    // Mark complete — this triggers the plugin's advancement.
    await completeTodo(win);

    // The plugin should re-mark the to-do incomplete within a few seconds.
    await expect
      .poll(async () => isTodoComplete(win), { timeout: 15_000, intervals: [500] })
      .toBe(false);

    // And the alarm should have advanced by exactly one day.
    await expect
      .poll(async () => readAlarm(win), { timeout: 15_000, intervals: [1000] })
      .toBe(EXPECTED);
  });

  test('completing an OVERDUE (past-alarm) recurring to-do advances by one interval, not to today', async () => {
    const { win } = joplin;
    await createTodo(win, 'Overdue Todo ' + Date.now());

    // Alarm well in the past — the "overdue" path.
    const ORIGINAL = '2020-03-10T08:00';
    const EXPECTED = '2020-03-11T08:00';

    await setAlarm(win, ORIGINAL);
    await setRecurrence(win, { enabled: true, interval: 'day' });
    expect(await readAlarm(win)).toBe(ORIGINAL);

    await completeTodo(win);

    // Plugin re-opens the to-do (completion-driven advancement runs regardless of past/future).
    await expect
      .poll(async () => isTodoComplete(win), { timeout: 15_000, intervals: [500] })
      .toBe(false);

    // The alarm advances by exactly one interval from the stored due date — it is NOT rescheduled
    // to "today" (that only happens via the manual "Reschedule overdue to-dos" command).
    await expect
      .poll(async () => readAlarm(win), { timeout: 15_000, intervals: [1000] })
      .toBe(EXPECTED);
  });
});
