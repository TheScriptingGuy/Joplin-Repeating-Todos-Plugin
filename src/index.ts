import joplin from 'api';

// Core
import { Database } from './core/database';
import { SettingsManager } from './core/settings';
import { CommandManager } from './core/commands';
import { TimerManager } from './core/timer';

// GUI
import { setupDialog } from './gui/dialog/dialog';
import { setupMenu } from './gui/menu';
import { setupToolbar } from './gui/toolbar';

/** Plugin Registration *****************************************************************************************************************************
 * Registers the plugin with Joplin and starts initialization.
 ***************************************************************************************************************************************************/
joplin.plugins.register({
  async onStart() {
    await main();
  }});

/** Main ********************************************************************************************************************************************
 * Initializes all components of the plugin in the correct order.
 ***************************************************************************************************************************************************/
async function main(): Promise<void> {
  try {
    // 1. Initialize storage (no-op, but consistent)
    await Database.setupDatabase();

    // 2. Register settings
    await SettingsManager.setup();

    // 3. Register commands
    await CommandManager.registerAll();

    // 4. Set up GUI components
    await setupDialog();
    await setupMenu();
    await setupToolbar();

    // 5. Start the recurring timer
    await TimerManager.start();

    console.info('Joplin Repeating Todos Plugin: Fully loaded and running!');
  } catch (error) {
    console.error('Failed to start Repeating Todos plugin:', error);
    await joplin.views.dialogs.showMessageBox(
      'Repeating Todos failed to start. Check console for details.'
    );
  }
}


