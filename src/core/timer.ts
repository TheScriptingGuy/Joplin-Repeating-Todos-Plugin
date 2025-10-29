import joplin from 'api';
import { RecurrenceManager } from './recurrence';
import { TryCatch } from './decorators';

export class TimerManager {
  private static timerId: NodeJS.Timeout | null = null;
  private static readonly DEFAULT_INTERVAL_SECONDS = 60;

  /** Start the recurring update loop */
  @TryCatch({ logError: true })
  static async start(): Promise<void> {
    await this.stop(); // Ensure no duplicate timers

    // Run once immediately
    await RecurrenceManager.updateAllRecurrences();

    // Listen to note selection changes
    joplin.workspace.onNoteSelectionChange(async () => {
      await RecurrenceManager.updateAllRecurrences();
    });

    // Start repeating timer
    await this.setupRepeatingTimer();
  }

  /** Stop the timer and clean up */
  @TryCatch({ logError: true })
  static async stop(): Promise<void> {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
      console.info('Repeating timer stopped.');
    }
  }

  /** Internal: Set up the interval based on settings */
  @TryCatch({ logError: true })
  private static async setupRepeatingTimer(): Promise<void> {
    const intervalSeconds =
      (await joplin.settings.value('updateFrequency')) ||
      this.DEFAULT_INTERVAL_SECONDS;

    const intervalMs = intervalSeconds * 1000;

    console.info(`Starting repeating timer: every ${intervalSeconds}s`);

    this.timerId = setInterval(async () => {
      console.info(`Timer fired (${intervalSeconds}s interval)`);
      try {
        await RecurrenceManager.updateAllRecurrences();
      } catch (error) {
        console.error('Timer update failed:', error);
      }
    }, intervalMs);
  }
}