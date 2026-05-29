import { Page, Frame, expect } from '@playwright/test';

/**
 * Reusable, real-app interaction helpers for the Repeating To-Dos e2e suite.
 *
 * Every helper drives the genuine Joplin desktop GUI through the main renderer `Page` (`win`).
 * Selectors and the interaction recipe here were verified by prior exploration; see comments
 * on each helper for the gotchas (e.g. the dialog form lives in an iframe and only persists its
 * values on DOM change/click events).
 */

/** Short settle delay used after GUI actions that trigger async React re-renders. */
const SETTLE = 1500;

/** ----------------------------------------------------------------------------------------------
 * Notebook + to-do creation
 * ------------------------------------------------------------------------------------------- */

/** Create a new notebook with the given name. It becomes the active/selected notebook. */
export async function createNotebook(win: Page, name: string): Promise<void> {
  await win.click('.sidebar-header-button.-newfolder');
  await win.waitForTimeout(1200);
  await win.locator('input[type="text"]:visible').first().fill(name);
  await win.keyboard.press('Enter');
  await win.waitForTimeout(1200);
}

/**
 * Create a new to-do in the currently selected notebook and type its title.
 * Focus lands in the title field after clicking "New to-do", so we just type.
 */
export async function createTodo(win: Page, title: string): Promise<void> {
  await win.locator('button:has-text("New to-do")').first().click();
  await win.waitForTimeout(SETTLE);
  await win.keyboard.type(title);
  await win.waitForTimeout(SETTLE);
}

/** ----------------------------------------------------------------------------------------------
 * Recurrence dialog
 * ------------------------------------------------------------------------------------------- */

/** Click the plugin's toolbar button to open the recurrence dialog. */
export async function openRecurrenceDialog(win: Page): Promise<void> {
  await win.locator('button.toolbar-button[title="Open Recurrence Dialog"]').click();
  await win.waitForTimeout(SETTLE);
  // Wait until the dialog form (inside its iframe) is actually present.
  await expect
    .poll(async () => (await findDialogFrame(win)) != null, { timeout: 20_000 })
    .toBe(true);
}

/**
 * Find the iframe Frame that hosts the recurrence dialog form. The form is rendered inside a
 * Joplin plugin webview iframe; we locate it by the presence of `#enabledCheckbox` rather than by
 * frame name (more robust).
 */
async function findDialogFrame(win: Page): Promise<Frame | null> {
  for (const f of win.frames()) {
    const has = await f
      .locator('#enabledCheckbox')
      .count()
      .catch(() => 0);
    if (has) return f;
  }
  return null;
}

/** Get the recurrence dialog frame, throwing if it is not open. */
export async function dialogFrame(win: Page): Promise<Frame> {
  const f = await findDialogFrame(win);
  if (!f) throw new Error('recurrence dialog frame not found');
  return f;
}

export interface RecurrenceStop {
  type: 'never' | 'number' | 'date';
  /** Required when type === 'number'. */
  number?: number;
  /** Required when type === 'date'; format 'YYYY-MM-DD'. */
  date?: string;
}

export interface RecurrenceConfig {
  enabled: boolean;
  interval?: 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';
  intervalNumber?: number;
  /** Lowercase weekday names to tick, e.g. ['monday','friday']. */
  weekdays?: Array<
    'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday'
  >;
  stop?: RecurrenceStop;
}

const WEEKDAY_IDS: Record<string, string> = {
  sunday: '#weekSundayCheckbox',
  monday: '#weekMondayCheckbox',
  tuesday: '#weekTuesdayCheckbox',
  wednesday: '#weekWednesdayCheckbox',
  thursday: '#weekThursdayCheckbox',
  friday: '#weekFridayCheckbox',
  saturday: '#weekSaturdayCheckbox',
};

/** Set a checkbox to a desired state, only clicking when needed (click fires the change event). */
async function setCheckbox(frame: Frame, selector: string, desired: boolean): Promise<void> {
  const loc = frame.locator(selector);
  const isChecked = await loc.isChecked();
  if (isChecked !== desired) {
    await loc.click();
  }
}

/**
 * Open the recurrence dialog (must be open already? — no, this opens it), fill the form to match
 * `config`, and click OK to persist.
 *
 * Gotcha: the dialog addon JS only writes field values into its hidden form field on DOM
 * change/click events, so we use `.click()` for checkboxes and `.selectOption()` for selects
 * (both fire the needed events). After enabling, the interval/stop fieldsets become visible.
 */
export async function setRecurrence(win: Page, config: RecurrenceConfig): Promise<void> {
  await openRecurrenceDialog(win);
  const frame = await dialogFrame(win);

  await setCheckbox(frame, '#enabledCheckbox', config.enabled);

  if (config.enabled) {
    if (config.intervalNumber != null) {
      await frame.locator('#intervalNumberSpinbutton').fill(String(config.intervalNumber));
      // Ensure a change event is fired so the addon persists the value.
      await frame.locator('#intervalNumberSpinbutton').dispatchEvent('change');
    }
    if (config.interval) {
      await frame.locator('#intervalDropdown').selectOption(config.interval);
    }
    if (config.weekdays) {
      for (const [name, id] of Object.entries(WEEKDAY_IDS)) {
        await setCheckbox(frame, id, config.weekdays.includes(name as any));
      }
    }
    if (config.stop) {
      await frame.locator('#stopTypeDropdown').selectOption(config.stop.type);
      if (config.stop.type === 'number' && config.stop.number != null) {
        await frame.locator('#stopNumberSpinbutton').fill(String(config.stop.number));
        await frame.locator('#stopNumberSpinbutton').dispatchEvent('change');
      }
      if (config.stop.type === 'date' && config.stop.date) {
        await frame.locator('#stopDatePicker').fill(config.stop.date);
        await frame.locator('#stopDatePicker').dispatchEvent('change');
      }
    }
  }

  // The dialog's OK button is rendered by Joplin OUTSIDE the iframe in the main page.
  await win.locator('button:has-text("OK")').last().click();
  await win.waitForTimeout(SETTLE);
}

export interface RecurrenceState {
  enabled: boolean;
  interval: string;
  intervalNumber: string;
  weekdays: Record<string, boolean>;
  stopType: string;
}

/**
 * Open the recurrence dialog, read the current form state, then close via Cancel (no mutation).
 */
export async function readRecurrenceDialog(win: Page): Promise<RecurrenceState> {
  await openRecurrenceDialog(win);
  const frame = await dialogFrame(win);

  const enabled = await frame.locator('#enabledCheckbox').isChecked();
  const interval = await frame.locator('#intervalDropdown').inputValue();
  const intervalNumber = await frame.locator('#intervalNumberSpinbutton').inputValue();
  const stopType = await frame.locator('#stopTypeDropdown').inputValue();

  const weekdays: Record<string, boolean> = {};
  for (const [name, id] of Object.entries(WEEKDAY_IDS)) {
    weekdays[name] = await frame.locator(id).isChecked();
  }

  // Close without saving.
  await win.locator('button:has-text("Cancel")').last().click();
  await win.waitForTimeout(SETTLE);

  return { enabled, interval, intervalNumber, weekdays, stopType };
}

/** ----------------------------------------------------------------------------------------------
 * Alarm / due date
 * ------------------------------------------------------------------------------------------- */

/**
 * Set the to-do's alarm (due date) to `isoLocal` formatted 'YYYY-MM-DDTHH:MM'.
 * Opens the Set alarm dialog, fills the datetime-local input, confirms with OK.
 */
export async function setAlarm(win: Page, isoLocal: string): Promise<void> {
  await win.click('button[title="Set alarm"]');
  await win.waitForTimeout(2000);
  await win.locator('input[type="datetime-local"]').fill(isoLocal);
  await win.locator('button:has-text("OK")').last().click();
  await win.waitForTimeout(SETTLE);
}

/**
 * Open the Set alarm dialog, read the current datetime-local value, then cancel.
 * Returns the value formatted 'YYYY-MM-DDTHH:MM' (whatever the input reports).
 */
export async function readAlarm(win: Page): Promise<string> {
  await win.click('button[title="Set alarm"]');
  await win.waitForTimeout(2000);
  const value = await win.locator('input[type="datetime-local"]').inputValue();
  await win.locator('button:has-text("Cancel")').last().click();
  await win.waitForTimeout(SETTLE);
  return value;
}

/** ----------------------------------------------------------------------------------------------
 * To-do completion
 * ------------------------------------------------------------------------------------------- */

/**
 * The completion checkbox lives in the selected note-list row. Joplin labels it
 * "Incomplete to-do" / "Completed to-do" via aria-label, which we use to read state.
 */
const COMPLETE_CHECKBOX = '.note-list-item .content.-selected .checkbox input[type="checkbox"]';

/** Mark the currently selected to-do complete by clicking its note-list checkbox. */
export async function completeTodo(win: Page): Promise<void> {
  const cb = win.locator(COMPLETE_CHECKBOX).first();
  if (!(await cb.isChecked())) {
    await cb.click();
  }
  await win.waitForTimeout(SETTLE);
}

/** Read whether the currently selected to-do is marked complete. */
export async function isTodoComplete(win: Page): Promise<boolean> {
  return win.locator(COMPLETE_CHECKBOX).first().isChecked();
}
