import joplin from 'api';
import { RecurrenceManager } from './recurrence';
import { TryCatch } from './decorators';

/**
 * Disposable returned by Joplin's on* event registrations. Joplin's type stub declares this as an
 * empty interface, so `dispose` is optional here and called defensively at runtime.
 */
interface Disposable {
  dispose?(): void;
}

/**
 * Event + safety-net scheduler.
 *
 * Advancement is driven by Joplin's to-do alarm / note-change events rather than pure polling:
 *  - onNoteChange  → (debounced) RecurrenceManager.handleNoteChange
 *  - onNoteAlarmTrigger → RecurrenceManager.handleAlarm
 *
 * A periodic sweep (interval from the `updateFrequency` setting) runs `updateAllRecurrences` as a
 * safety net in case an event was missed. `start()` and `stop()` are kept as static methods because
 * index.ts calls them.
 */
export class RecurrenceScheduler {
  private static intervalId: NodeJS.Timeout | null = null;
  private static noteChangeDisposable: Disposable | null = null;
  private static alarmDisposable: Disposable | null = null;
  private static readonly DEFAULT_INTERVAL_SECONDS = 60;
  private static readonly DEBOUNCE_MS = 500;

  /** Per-note debounce timers for note-change events. */
  private static debounceTimers: Map<string, NodeJS.Timeout> = new Map();

  /** Start the event listeners and the safety-net sweep. */
  @TryCatch({ logError: true })
  static async start(): Promise<void> {
    await this.stop(); // Clear any prior registration.

    // 1. React to note changes (debounced per-note to avoid thrashing).
    this.noteChangeDisposable = await joplin.workspace.onNoteChange((event: any) => {
      this.debounceNoteChange(event.id);
    });

    // 2. React to to-do alarms.
    this.alarmDisposable = await joplin.workspace.onNoteAlarmTrigger((event: any) => {
      RecurrenceManager.handleAlarm(event.noteId);
    });

    // 3. Initial sweep.
    await RecurrenceManager.updateAllRecurrences();

    // 4. Periodic safety-net sweep.
    await this.setupSweep();

    console.info('Recurrence scheduler started (event-driven + safety-net sweep).');
  }

  /** Stop the sweep and dispose event registrations. */
  @TryCatch({ logError: true })
  static async stop(): Promise<void> {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.info('Recurrence safety-net sweep stopped.');
    }

    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    if (this.noteChangeDisposable) {
      this.noteChangeDisposable.dispose?.();
      this.noteChangeDisposable = null;
    }

    if (this.alarmDisposable) {
      this.alarmDisposable.dispose?.();
      this.alarmDisposable = null;
    }
  }

  /** Internal: debounce note-change handling per note id. */
  private static debounceNoteChange(noteId: string): void {
    const existing = this.debounceTimers.get(noteId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.debounceTimers.delete(noteId);
      RecurrenceManager.handleNoteChange(noteId);
    }, this.DEBOUNCE_MS);

    this.debounceTimers.set(noteId, timer);
  }

  /** Internal: set up the periodic safety-net sweep from the updateFrequency setting. */
  @TryCatch({ logError: true })
  private static async setupSweep(): Promise<void> {
    const intervalSeconds =
      (await joplin.settings.value('updateFrequency')) ||
      this.DEFAULT_INTERVAL_SECONDS;

    const intervalMs = intervalSeconds * 1000;

    console.info(`Starting recurrence safety-net sweep: every ${intervalSeconds}s`);

    this.intervalId = setInterval(async () => {
      try {
        await RecurrenceManager.updateAllRecurrences();
      } catch (error) {
        console.error('Safety-net sweep failed:', error);
      }
    }, intervalMs);
  }
}
