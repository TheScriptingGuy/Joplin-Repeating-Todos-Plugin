import joplin from 'api';
import { ChangeEvent } from 'api/JoplinSettings';
import { SettingItemType } from 'api/types';
import { RecurrenceManager } from './recurrence';
import { RecurrenceScheduler } from './timer';
import { TryCatch } from './decorators';

/**
 * Handles all plugin settings registration and change events.
 */
export class SettingsManager {
  private static readonly SECTION_ID = 'repeating-todos';
  private static readonly SECTION_LABEL = 'Repeating To-dos';
  private static readonly SECTION_ICON = 'fa fa-redo-alt';
  /** Key of the one-shot "remove everything" toggle. */
  private static readonly CLEAR_ALL_KEY = 'clearAllRecurrences';
  /** Guard so the toggle-reset write cannot re-enter the clear routine. */
  private static clearing = false;

  /** Register settings section and individual settings */
  @TryCatch({ logError: true })
  static async setup(): Promise<void> {
    // Register the settings section
    await joplin.settings.registerSection(this.SECTION_ID, {
      label: this.SECTION_LABEL,
      iconName: this.SECTION_ICON,
    });

    // Register individual settings
    await joplin.settings.registerSettings({
      updateFrequency: {
        label: 'Update frequency (seconds)',
        description: 'How often the plugin checks for due recurring tasks',
        value: 30,
        type: SettingItemType.Int,
        public: true,
        section: this.SECTION_ID,
        minimum: 10,
        maximum: 3600,
      },
      debug: {
        label: 'Enable debug logging',
        description: 'Logs detailed info to the developer console',
        value: false,
        type: SettingItemType.Bool,
        public: true,
        section: this.SECTION_ID,
      },
      [this.CLEAR_ALL_KEY]: {
        label: 'Remove all recurrence settings from all to-dos',
        description:
          'Switch this on to clear the recurrence dialog settings of every to-do at once, after ' +
          'a confirmation. The to-dos themselves are kept exactly as they are - alarms, contents ' +
          'and completion state included - they just stop repeating. The switch turns itself back ' +
          'off once it has run, and what it removes cannot be restored.',
        value: false,
        type: SettingItemType.Bool,
        public: true,
        section: this.SECTION_ID,
      },
    });

    // Restart timer whenever settings change, and run the one-shot clear when it is switched on.
    joplin.settings.onChange(async (event: ChangeEvent) => {
      console.info('Settings changed — restarting scheduler...');
      await RecurrenceScheduler.start();
      await this.handleClearAllToggle(event);
    });

    console.info('Settings registered and change listener attached.');
  }

  /**
   * Runs the "remove all recurrence settings" action when its toggle is switched on, then switches
   * the toggle straight back off so it reads as the momentary action it is. The reset write comes
   * back through onChange, which the `clearing` guard (and the value check) absorbs.
   */
  @TryCatch({ logError: true })
  private static async handleClearAllToggle(event?: ChangeEvent): Promise<void> {
    if (this.clearing) return;
    // Joplin reports which keys changed; ignore changes to anything else.
    if (event?.keys && !event.keys.includes(this.CLEAR_ALL_KEY)) return;
    if (!(await joplin.settings.value(this.CLEAR_ALL_KEY))) return;

    this.clearing = true;
    try {
      await RecurrenceManager.clearAllRecurrences();
    } finally {
      await joplin.settings.setValue(this.CLEAR_ALL_KEY, false);
      this.clearing = false;
    }
  }
}
