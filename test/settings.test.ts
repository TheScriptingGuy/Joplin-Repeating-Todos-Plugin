// Unit tests for SettingsManager, in particular the one-shot "remove all recurrence settings"
// toggle: it must run the clear exactly when it is switched on, and switch itself back off after.

import joplin from 'api';
import { SettingsManager } from '../src/core/settings';
import { RecurrenceManager } from '../src/core/recurrence';
import { RecurrenceScheduler } from '../src/core/timer';

jest.mock('../src/core/recurrence');
jest.mock('../src/core/timer');

const mockManager = RecurrenceManager as jest.Mocked<typeof RecurrenceManager>;
const mockScheduler = RecurrenceScheduler as jest.Mocked<typeof RecurrenceScheduler>;

const CLEAR_ALL_KEY = 'clearAllRecurrences';

/** Registers the settings and returns the onChange handler Joplin was given. */
async function setupAndGetChangeHandler(): Promise<(event: any) => Promise<void>> {
  await SettingsManager.setup();
  const handler = (joplin.settings.onChange as jest.Mock).mock.calls[0][0];
  // The registration sweep is irrelevant to the assertions below.
  jest.clearAllMocks();
  return handler;
}

/** Makes joplin.settings.value report `value` for the clear-all toggle, false for everything else. */
function setToggle(value: boolean): void {
  (joplin.settings.value as jest.Mock).mockImplementation(async (key: string) =>
    key === CLEAR_ALL_KEY ? value : false
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  setToggle(false);
  mockManager.clearAllRecurrences.mockResolvedValue(0);
  mockScheduler.start.mockResolvedValue(undefined);
  (joplin.settings.setValue as jest.Mock).mockResolvedValue(undefined);
  (SettingsManager as any).clearing = false;
});

describe('SettingsManager.setup', () => {
  it('registers the clear-all toggle, off by default', async () => {
    await SettingsManager.setup();

    const registered = (joplin.settings.registerSettings as jest.Mock).mock.calls[0][0];
    expect(registered[CLEAR_ALL_KEY]).toBeDefined();
    expect(registered[CLEAR_ALL_KEY].value).toBe(false);
    expect(registered[CLEAR_ALL_KEY].public).toBe(true);
  });
});

describe('SettingsManager clear-all toggle', () => {
  it('clears every recurrence when the toggle is switched on, then switches it back off', async () => {
    const onChange = await setupAndGetChangeHandler();
    setToggle(true);
    mockManager.clearAllRecurrences.mockResolvedValue(3);

    await onChange({ keys: [CLEAR_ALL_KEY] });

    expect(mockManager.clearAllRecurrences).toHaveBeenCalledTimes(1);
    expect(joplin.settings.setValue).toHaveBeenCalledWith(CLEAR_ALL_KEY, false);
  });

  it('does nothing when a different setting changes', async () => {
    const onChange = await setupAndGetChangeHandler();
    setToggle(true);

    await onChange({ keys: ['updateFrequency'] });

    expect(mockManager.clearAllRecurrences).not.toHaveBeenCalled();
    expect(joplin.settings.setValue).not.toHaveBeenCalled();
    // The scheduler still restarts, as it does for any setting change.
    expect(mockScheduler.start).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the toggle change is the reset back to off', async () => {
    const onChange = await setupAndGetChangeHandler();
    setToggle(false);

    await onChange({ keys: [CLEAR_ALL_KEY] });

    expect(mockManager.clearAllRecurrences).not.toHaveBeenCalled();
    expect(joplin.settings.setValue).not.toHaveBeenCalled();
  });

  it('still switches the toggle off when the clear fails', async () => {
    const onChange = await setupAndGetChangeHandler();
    setToggle(true);
    mockManager.clearAllRecurrences.mockRejectedValue(new Error('boom'));

    await onChange({ keys: [CLEAR_ALL_KEY] });

    expect(joplin.settings.setValue).toHaveBeenCalledWith(CLEAR_ALL_KEY, false);
    // A failed clear must not wedge the guard, or the toggle would never work again.
    expect((SettingsManager as any).clearing).toBe(false);
  });

  it('does not re-enter while a clear is already running', async () => {
    const onChange = await setupAndGetChangeHandler();
    setToggle(true);
    (SettingsManager as any).clearing = true;

    await onChange({ keys: [CLEAR_ALL_KEY] });

    expect(mockManager.clearAllRecurrences).not.toHaveBeenCalled();
  });
});
