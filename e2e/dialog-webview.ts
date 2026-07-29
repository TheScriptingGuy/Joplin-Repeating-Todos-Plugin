import { Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

import { DIALOG_HTML } from '../src/gui/dialog/dialog_html';

/**
 * Harness for driving the recurrence dialog's WebView in isolation, the way Joplin **mobile** hosts it.
 *
 * Why this exists next to the real-app (desktop Electron) suite:
 *   Joplin mobile is a React Native app, so it cannot be driven by Playwright. What *can* be reproduced
 *   faithfully is the one structural difference that causes mobile-only dialog bugs: on mobile the
 *   dialog's OK/Cancel buttons are **native** controls living outside the WebView, so tapping OK never
 *   moves focus out of the focused form field. On desktop the buttons are ordinary DOM buttons in the
 *   parent document, so clicking one blurs the field first.
 *
 *   That difference matters because a `<input type="number">` only fires `change` when it is committed
 *   (blur / Enter). Anything the dialog persists solely on `change` therefore survives on desktop and is
 *   silently dropped on mobile.
 *
 * The harness loads the real dialog markup (`DIALOG_HTML`) and the real, shipped addon script
 * (`src/gui/dialog/dialog_addon.js`) — no reimplementation — and reads back the form exactly as Joplin
 * does when the dialog is accepted.
 */

const ADDON_PATH = path.resolve(__dirname, '..', 'src', 'gui', 'dialog', 'dialog_addon.js');

export interface RecurrenceData {
  enabled: boolean;
  interval: string;
  intervalNumber: number | string;
  weekSunday: boolean;
  weekMonday: boolean;
  weekTuesday: boolean;
  weekWednesday: boolean;
  weekThursday: boolean;
  weekFriday: boolean;
  weekSaturday: boolean;
  monthOrdinal: string;
  monthWeekday: string;
  stopType: string;
  stopDate: string | null;
  stopNumber: number | string;
}

/** The recurrence a to-do starts from: repeats every 1 minute. Mirrors the Recurrence class defaults. */
export function defaultRecurrence(overrides: Partial<RecurrenceData> = {}): RecurrenceData {
  return {
    enabled: true,
    interval: 'minute',
    intervalNumber: 1,
    weekSunday: false,
    weekMonday: false,
    weekTuesday: false,
    weekWednesday: false,
    weekThursday: false,
    weekFriday: false,
    weekSaturday: false,
    monthOrdinal: 'first',
    monthWeekday: '',
    stopType: 'never',
    stopDate: null,
    stopNumber: 1,
    ...overrides,
  };
}

/**
 * Render the dialog WebView pre-loaded with `recurrence`, mirroring `openDialog()`: the recurrence JSON
 * is base64-encoded into the hidden `recurrenceData` field and the addon script is added after the HTML.
 */
export async function openDialogWebview(page: Page, recurrence: RecurrenceData): Promise<void> {
  const addonJs = fs.readFileSync(ADDON_PATH, 'utf8');
  const encoded = Buffer.from(JSON.stringify(recurrence), 'utf8').toString('base64');
  const html = DIALOG_HTML.replace('RECURRENCE_DATA', encoded);

  await page.setContent(`<!DOCTYPE html><html><body>${html}</body></html>`);
  await page.addScriptTag({ content: addonJs });
}

/**
 * Read the form data Joplin would hand back when the dialog is accepted.
 *
 * Deliberately does **not** click, focus or blur anything: on mobile the OK button is outside the
 * WebView, so accepting the dialog cannot itself commit a field the user is still editing. Whatever the
 * hidden `recurrenceData` field holds at this moment is exactly what gets saved to the note.
 */
export async function readSubmittedRecurrence(page: Page): Promise<RecurrenceData> {
  const encoded = await page.evaluate(() => {
    const form = document.forms.namedItem('recurrenceForm') as HTMLFormElement;
    return String(new FormData(form).get('recurrenceData') ?? '');
  });
  return JSON.parse(Buffer.from(encoded, 'base64').toString('utf8')) as RecurrenceData;
}

/**
 * Replace the contents of a text/number field using genuine key events, the way a user editing the field
 * on a phone does: tap the field, select what is there, type the new value. Focus stays in the field
 * afterwards — nothing is blurred, so no `change` event is fired.
 *
 * Playwright's `locator.fill()` is unusable here: it dispatches a synthetic `change` event of its own,
 * which papers over exactly the bug these tests exist to catch.
 */
export async function typeIntoField(page: Page, selector: string, value: string): Promise<void> {
  const field = page.locator(selector);
  await field.tap();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.type(value);
}

/** Clear a field with the backspace key, leaving it empty and still focused. */
export async function clearField(page: Page, selector: string): Promise<void> {
  const field = page.locator(selector);
  await field.tap();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.press('Backspace');
}
