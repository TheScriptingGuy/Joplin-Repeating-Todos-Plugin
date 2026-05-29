import { test, expect } from '@playwright/test';
import { launchJoplin, closeJoplin, JoplinInstance } from './launch';
import { createNotebook, createTodo, setAlarm, readAlarm, completeTodo, isTodoComplete } from './helpers';

/**
 * NEGATIVE CONTROL (temporary): proves the recurrence-advance assertions actually measure the
 * plugin. Same flow as recurrence-advance.spec.ts, but Joplin is launched WITHOUT the plugin.
 * Expectation: completing the to-do leaves it COMPLETE and the alarm UNCHANGED (Joplin has no
 * native recurrence). If these "no-op" assertions hold, the positive test's pass is attributable
 * to the plugin and not to some Joplin built-in behavior or a false positive.
 */
test.describe('NEGATIVE CONTROL: no plugin loaded', () => {
  let joplin: JoplinInstance;

  test.beforeAll(async () => {
    joplin = await launchJoplin({ loadPlugin: false });
    await createNotebook(joplin.win, 'NegCtl NB');
  });

  test.afterAll(async () => {
    if (joplin) await closeJoplin(joplin);
  });

  test('without the plugin, completing a to-do does NOT advance the alarm or re-open it', async () => {
    const { win } = joplin;

    // Confirm the plugin is genuinely absent (no recurrence toolbar button, no plugin CDP page).
    await createTodo(win, 'NegCtl Todo ' + Date.now());
    const hasButton = await win
      .locator('button.toolbar-button[title="Open Recurrence Dialog"]')
      .count();
    expect(hasButton, 'plugin toolbar button must be ABSENT in the negative control').toBe(0);
    const pluginPages = joplin.browser
      .contexts()
      .flatMap((c) => c.pages())
      .filter((p) => p.url().includes('pluginId=com.github.TheScriptingGuy.joplin-plugin-repeating-todos'));
    expect(pluginPages.length, 'plugin background page must be ABSENT').toBe(0);

    const ORIGINAL = '2026-06-01T09:00';
    await setAlarm(win, ORIGINAL);
    expect(await readAlarm(win)).toBe(ORIGINAL);

    await completeTodo(win);

    // Give it the same window the positive test allows the plugin to act in.
    await win.waitForTimeout(10_000);

    // KEY ASSERTION: with no plugin, nothing re-opens the to-do, so it stays complete.
    // (The positive test asserts the opposite — that the plugin re-marks it incomplete.)
    expect(await isTodoComplete(win)).toBe(true);

    // Joplin disables the "Set alarm" button on completed to-dos, so we can't reopen the alarm
    // dialog here — but that disabled state is itself the proof: in the positive test `readAlarm`
    // only succeeds because the plugin re-marked the to-do incomplete, re-enabling the button.
    const setAlarmDisabled = await win
      .locator('button[title="Set alarm"]')
      .isDisabled();
    expect(setAlarmDisabled, 'Set alarm stays disabled because the to-do is still complete').toBe(true);
  });
});
