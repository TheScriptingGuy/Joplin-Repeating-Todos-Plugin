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

/** A whole-minute date `minutes` minutes from now (negative for the past). */
function minutesFromNow(minutes: number): Date {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() + minutes);
  return d;
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

    // Deliberately in the future so the completion path is what is observed here (an already-passed
    // alarm is only rolled forward when this to-do opts in — see the last test).
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

  test('completing a to-do that repeats every 5 minutes lands the alarm in the future', async () => {
    const { win } = joplin;
    await createTodo(win, 'Five Minute Todo ' + Date.now());

    // A short interval is always ticked off later than its own alarm — nobody completes a to-do
    // within five minutes of it being due. The next occurrence therefore has to skip the
    // occurrences that already went by, otherwise the to-do reopens with an alarm that is still in
    // the past: overdue on the spot, no alarm left to fire, and (unless it opted into the alarm
    // reset) stuck there forever. That is what makes 1-5 minute intervals unusable.
    const base = minutesFromNow(-12);
    const ORIGINAL = alarmString(base);
    // From 12 minutes ago, 5-minute steps land on -7, -2, +3: the first one in the future.
    const EXPECTED = alarmString(new Date(base.getTime() + 15 * 60 * 1000));

    await setAlarm(win, ORIGINAL);
    await setRecurrence(win, { enabled: true, interval: 'minute', intervalNumber: 5 });
    expect(await readAlarm(win)).toBe(ORIGINAL);

    await completeTodo(win);

    await expect
      .poll(async () => isTodoComplete(win), { timeout: 15_000, intervals: [500] })
      .toBe(false);

    await expect
      .poll(async () => readAlarm(win), { timeout: 15_000, intervals: [1000] })
      .toBe(EXPECTED);

    // The point of the whole thing: the reopened to-do is not already overdue.
    expect(
      new Date(await readAlarm(win)).getTime(),
      'the next occurrence is in the future'
    ).toBeGreaterThan(Date.now());
  });

  test('completing a to-do that repeats every minute leaves an alarm still to come', async () => {
    const { win } = joplin;
    await createTodo(win, 'One Minute Todo ' + Date.now());

    const ORIGINAL = alarmString(minutesFromNow(-10));

    await setAlarm(win, ORIGINAL);
    await setRecurrence(win, { enabled: true, interval: 'minute', intervalNumber: 1 });

    await completeTodo(win);

    await expect
      .poll(async () => isTodoComplete(win), { timeout: 15_000, intervals: [500] })
      .toBe(false);

    await expect
      .poll(async () => new Date(await readAlarm(win)).getTime() > Date.now(), {
        timeout: 15_000,
        intervals: [1000],
      })
      .toBe(true);
  });

  test('completing a to-do that repeats every 5 days skips the occurrences it missed', async () => {
    const { win } = joplin;
    await createTodo(win, 'Five Day Todo ' + Date.now());

    // The same rule as the short intervals, at a scale where it is easy to read: an alarm 12 days
    // gone means two 5-day occurrences have already been and went, so the to-do belongs on the third.
    const base = daysFromNow(-12);
    const ORIGINAL = alarmString(base);
    const EXPECTED = alarmString(daysFromNow(3));

    await setAlarm(win, ORIGINAL);
    await setRecurrence(win, { enabled: true, interval: 'day', intervalNumber: 5 });
    expect(await readAlarm(win)).toBe(ORIGINAL);

    await completeTodo(win);

    await expect
      .poll(async () => isTodoComplete(win), { timeout: 15_000, intervals: [500] })
      .toBe(false);

    await expect
      .poll(async () => readAlarm(win), { timeout: 15_000, intervals: [1000] })
      .toBe(EXPECTED);
  });

  test('completing a to-do that repeats every 5 days ahead of its alarm advances exactly 5 days', async () => {
    const { win } = joplin;
    await createTodo(win, 'Five Day Early Todo ' + Date.now());

    // Nothing has been missed here, so there is nothing to skip: the next occurrence is simply the
    // one after the current alarm. This is the case the roll-forward must NOT disturb.
    const ORIGINAL = alarmString(daysFromNow(30));
    const EXPECTED = alarmString(daysFromNow(35));

    await setAlarm(win, ORIGINAL);
    await setRecurrence(win, { enabled: true, interval: 'day', intervalNumber: 5 });

    await completeTodo(win);

    await expect
      .poll(async () => isTodoComplete(win), { timeout: 15_000, intervals: [500] })
      .toBe(false);

    await expect
      .poll(async () => readAlarm(win), { timeout: 15_000, intervals: [1000] })
      .toBe(EXPECTED);
  });

  test('an OVERDUE (past-alarm) recurring to-do has its alarm reset forward without being completed', async () => {
    const { win } = joplin;
    await createTodo(win, 'Overdue Todo ' + Date.now());

    // Alarm well in the past — the missed-occurrence path. With this to-do's own
    // "move the alarm on even when not done" option ticked, the plugin re-arms the alarm on the
    // next occurrence without the to-do ever being ticked off. The alarm event already fired long
    // ago, so what picks this up is the periodic safety-net sweep (default every 30 s).
    const ORIGINAL = '2020-03-10T08:00';

    await setAlarm(win, ORIGINAL);
    await setRecurrence(win, {
      enabled: true,
      interval: 'day',
      resetAlarmWhenNotDone: true,
    });

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

  test('an OVERDUE recurring to-do that did NOT opt in keeps its alarm until it is done', async () => {
    const { win } = joplin;
    await createTodo(win, 'Overdue Untouched Todo ' + Date.now());

    // Same setup as the test above, minus the per-to-do opt-in. The alarm must stay put: the
    // alarm reset is a choice made per to-do, never something applied to every repeating to-do.
    const ORIGINAL = '2020-03-10T08:00';

    await setAlarm(win, ORIGINAL);
    await setRecurrence(win, { enabled: true, interval: 'day' });

    // Well past the safety-net sweep interval (default 30 s), so a sweep has definitely run.
    await win.waitForTimeout(60_000);

    expect(await readAlarm(win)).toBe(ORIGINAL);
    expect(await isTodoComplete(win)).toBe(false);
  });
});
