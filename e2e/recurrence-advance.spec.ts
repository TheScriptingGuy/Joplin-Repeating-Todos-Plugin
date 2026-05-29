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
});
