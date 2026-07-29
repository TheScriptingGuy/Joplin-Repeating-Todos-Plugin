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

/** Format a Date as the 'YYYY-MM-DDTHH:MM' local string Joplin's alarm input uses. */
function alarmString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

/** A date `days` days from now at 09:00 local time. */
function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(9, 0, 0, 0);
  return d;
}

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

    // Deliberately in the future: an alarm that has already passed would be rolled forward by the
    // "reset alarm when not done" behaviour before we get to complete it (see the next test).
    const ORIGINAL = alarmString(daysFromNow(30));
    const EXPECTED = alarmString(daysFromNow(31));

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

  test('an OVERDUE (past-alarm) recurring to-do has its alarm reset forward without being completed', async () => {
    const { win } = joplin;
    await createTodo(win, 'Overdue Todo ' + Date.now());

    // Alarm well in the past — the missed-occurrence path. With the default
    // `resetAlarmWhenNotDone` setting the plugin re-arms the alarm on the next occurrence without
    // the to-do ever being ticked off. The alarm event already fired long ago, so what picks this
    // up is the periodic safety-net sweep (default every 30 s).
    const ORIGINAL = '2020-03-10T08:00';

    await setAlarm(win, ORIGINAL);
    await setRecurrence(win, { enabled: true, interval: 'day' });

    await expect
      .poll(async () => readAlarm(win), { timeout: 90_000, intervals: [2000] })
      .not.toBe(ORIGINAL);

    const advanced = await readAlarm(win);
    // Same time of day, but the occurrence it landed on is in the future — every missed daily
    // occurrence between 2020 and now was skipped in one go.
    expect(advanced.endsWith('T08:00'), `alarm kept its time of day: ${advanced}`).toBe(true);
    expect(new Date(advanced).getTime(), `alarm moved into the future: ${advanced}`).toBeGreaterThan(
      Date.now()
    );

    // KEY ASSERTION: the to-do was never marked complete along the way — only the alarm moved.
    expect(await isTodoComplete(win)).toBe(false);
  });
});
