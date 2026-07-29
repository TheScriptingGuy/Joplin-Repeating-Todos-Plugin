import { test, expect, devices } from '@playwright/test';
import {
  clearField,
  defaultRecurrence,
  openDialogWebview,
  readSubmittedRecurrence,
  typeIntoField,
} from './dialog-webview';

/**
 * Mobile recurrence dialog persistence.
 *
 * Regression suite for: on mobile, changing the interval from "every 1 minute" to "every 5 minutes" was
 * silently discarded — reopening the dialog showed 1 again.
 *
 * Cause: the dialog only wrote a field's value into its hidden `recurrenceData` form field on the DOM
 * `change` event. A `<input type="number">` fires `change` on commit (blur / Enter), not while typing.
 * On desktop the dialog's OK button is a DOM button, so clicking it blurs the spinbutton and `change`
 * fires just in time. On mobile the OK button is a native control outside the WebView: tapping it never
 * blurs the field, `change` never fires, and the typed number is dropped while checkbox/dropdown changes
 * (which fire `change` on tap) persist fine — which is exactly the reported symptom.
 *
 * These tests run under mobile device emulation and never blur the edited field before reading the form
 * back, so they fail against the `change`-only implementation and pass once the dialog also persists on
 * `input`. See ./dialog-webview.ts for how the mobile hosting model is reproduced.
 */
test.use({ ...devices['Pixel 5'] });

test.describe('Recurrence dialog persistence on mobile', () => {
  test('changing the interval from 1 to 5 minutes persists without blurring the field', async ({
    page,
  }) => {
    await openDialogWebview(page, defaultRecurrence({ interval: 'minute', intervalNumber: 1 }));

    await typeIntoField(page, '#intervalNumberSpinbutton', '5');

    // The user taps the native OK button — the spinbutton is never blurred.
    const submitted = await readSubmittedRecurrence(page);
    expect(Number(submitted.intervalNumber)).toBe(5);
    expect(submitted.interval).toBe('minute');
    expect(submitted.enabled).toBe(true);
  });

  test('the stop-after-N-repeats count persists without blurring the field', async ({ page }) => {
    await openDialogWebview(page, defaultRecurrence());

    await page.locator('#stopTypeDropdown').selectOption('number');
    await typeIntoField(page, '#stopNumberSpinbutton', '12');

    const submitted = await readSubmittedRecurrence(page);
    expect(submitted.stopType).toBe('number');
    expect(Number(submitted.stopNumber)).toBe(12);
  });

  // Non-regression guard rather than a reproduction: a date picker commits its value when the picker
  // closes, so `change` fires there even on mobile. `fill()` models that commit faithfully.
  test('the stop date still persists', async ({ page }) => {
    await openDialogWebview(page, defaultRecurrence());

    await page.locator('#stopTypeDropdown').selectOption('date');
    await page.locator('#stopDatePicker').fill('2031-03-09');

    const submitted = await readSubmittedRecurrence(page);
    expect(submitted.stopType).toBe('date');
    expect(submitted.stopDate).toBe('2031-03-09');
  });

  test('a half-typed interval never overwrites the stored value with an invalid one', async ({
    page,
  }) => {
    await openDialogWebview(page, defaultRecurrence({ intervalNumber: 3 }));

    // Mid-edit the field is momentarily empty. Persisting that as-is would store 0 and break the
    // date maths, so the last valid value must stand until a valid one is typed.
    await clearField(page, '#intervalNumberSpinbutton');
    expect(Number((await readSubmittedRecurrence(page)).intervalNumber)).toBe(3);

    await page.keyboard.type('7');
    expect(Number((await readSubmittedRecurrence(page)).intervalNumber)).toBe(7);
  });

  test('interval unit, weekdays and enabled state still persist', async ({ page }) => {
    await openDialogWebview(page, defaultRecurrence({ enabled: false }));

    await page.locator('#enabledCheckbox').tap();
    await page.locator('#intervalDropdown').selectOption('week');
    await page.locator('#weekMondayCheckbox').tap();
    await page.locator('#weekFridayCheckbox').tap();

    const submitted = await readSubmittedRecurrence(page);
    expect(submitted.enabled).toBe(true);
    expect(submitted.interval).toBe('week');
    expect(submitted.weekMonday).toBe(true);
    expect(submitted.weekFriday).toBe(true);
    expect(submitted.weekTuesday).toBe(false);
  });

  test('committing the field the desktop way (blur) still persists', async ({ page }) => {
    await openDialogWebview(page, defaultRecurrence({ intervalNumber: 1 }));

    await typeIntoField(page, '#intervalNumberSpinbutton', '5');
    // Desktop: clicking the OK button moves focus out of the field, firing `change`.
    await page.locator('#intervalNumberSpinbutton').blur();

    expect(Number((await readSubmittedRecurrence(page)).intervalNumber)).toBe(5);
  });
});
