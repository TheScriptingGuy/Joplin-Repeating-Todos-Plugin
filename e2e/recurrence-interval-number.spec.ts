import { test, expect } from '@playwright/test';
import { launchJoplin, closeJoplin, JoplinInstance } from './launch';
import {
  createNotebook,
  createTodo,
  openRecurrenceDialog,
  dialogFrame,
  readRecurrenceDialog,
  setCheckbox,
  typeNumberField,
  confirmDialog,
} from './helpers';

/**
 * The interval number, typed the way a user types it.
 *
 * These tests deliberately avoid the synthetic `change` event that `setRecurrence` dispatches: the
 * user clicks the spinbutton, types a number and clicks OK. Because Joplin renders OK outside the
 * dialog iframe, the input is never committed by a blur inside the iframe, so a dialog that only
 * mirrors its fields into the hidden form field on `change` loses whatever was typed — which is how
 * "you cannot set the interval to 1-5 minutes" shows up in the GUI.
 */
test.describe('Interval number typed in the dialog', () => {
  let joplin: JoplinInstance;

  test.beforeAll(async () => {
    joplin = await launchJoplin();
    await createNotebook(joplin.win, 'Interval NB');
  });

  test.afterAll(async () => {
    if (joplin) await closeJoplin(joplin);
  });

  test('a minute interval typed when first setting up the to-do is kept', async () => {
    const { win } = joplin;
    await createTodo(win, 'Every 3 Minutes ' + Date.now());

    await openRecurrenceDialog(win);
    const frame = await dialogFrame(win);
    await setCheckbox(frame, '#enabledCheckbox', true);
    await frame.locator('#intervalDropdown').selectOption('minute');
    await typeNumberField(frame, '#intervalNumberSpinbutton', 3);
    await confirmDialog(win);

    const state = await readRecurrenceDialog(win);
    expect(state.enabled).toBe(true);
    expect(state.interval).toBe('minute');
    expect(state.intervalNumber).toBe('3');
  });

  test('every minute interval from 1 to 5 can be typed while editing', async () => {
    const { win } = joplin;
    await createTodo(win, 'Edited Minutes ' + Date.now());

    // Set it up once as a minute recurrence, then edit only the number, as a user would.
    await openRecurrenceDialog(win);
    const frame = await dialogFrame(win);
    await setCheckbox(frame, '#enabledCheckbox', true);
    await frame.locator('#intervalDropdown').selectOption('minute');
    await confirmDialog(win);

    for (const minutes of [1, 2, 3, 4, 5]) {
      await openRecurrenceDialog(win);
      const editFrame = await dialogFrame(win);
      await typeNumberField(editFrame, '#intervalNumberSpinbutton', minutes);
      await confirmDialog(win);

      const state = await readRecurrenceDialog(win);
      expect(state.interval, `interval after typing ${minutes}`).toBe('minute');
      expect(state.intervalNumber, `interval number after typing ${minutes}`).toBe(
        String(minutes)
      );
    }
  });

  test('a minute interval nudged with the keyboard arrows is kept', async () => {
    const { win } = joplin;
    await createTodo(win, 'Arrow Minutes ' + Date.now());

    await openRecurrenceDialog(win);
    const frame = await dialogFrame(win);
    await setCheckbox(frame, '#enabledCheckbox', true);
    await frame.locator('#intervalDropdown').selectOption('minute');

    // Default is 1; four Up presses on the spinbutton should land on 5.
    const spin = frame.locator('#intervalNumberSpinbutton');
    await spin.click();
    for (let i = 0; i < 4; i++) await spin.press('ArrowUp');
    expect(await spin.inputValue()).toBe('5');
    await confirmDialog(win);

    const state = await readRecurrenceDialog(win);
    expect(state.interval).toBe('minute');
    expect(state.intervalNumber).toBe('5');
  });

  test('the stop-after-a-number field keeps a typed value too', async () => {
    const { win } = joplin;
    await createTodo(win, 'Stop After Typed ' + Date.now());

    await openRecurrenceDialog(win);
    const frame = await dialogFrame(win);
    await setCheckbox(frame, '#enabledCheckbox', true);
    await frame.locator('#intervalDropdown').selectOption('minute');
    await frame.locator('#stopTypeDropdown').selectOption('number');
    await typeNumberField(frame, '#stopNumberSpinbutton', 4);
    await confirmDialog(win);

    await openRecurrenceDialog(win);
    const reopened = await dialogFrame(win);
    expect(await reopened.locator('#stopNumberSpinbutton').inputValue()).toBe('4');
    await win.locator('button:has-text("Cancel")').last().click();
  });
});
