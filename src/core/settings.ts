import joplin from 'api';
import { SettingItemType } from 'api/types';
import { RecurrenceScheduler } from './timer';
import { TryCatch } from './decorators';

/**
 * Handles all plugin settings registration and change events.
 */
export class SettingsManager {
  private static readonly SECTION_ID = 'repeating-todos';
  private static readonly SECTION_LABEL = 'Repeating To-dos';
  private static readonly SECTION_ICON = 'fa fa-redo-alt';

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
    });

    // Restart timer whenever settings change
    joplin.settings.onChange(async () => {
      console.info('Settings changed — restarting scheduler...');
      await RecurrenceScheduler.start();
    });

    console.info('Settings registered and change listener attached.');
  }
}