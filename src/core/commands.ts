import joplin from 'api';
import { RecurrenceManager } from './recurrence';
import { TryCatch } from './decorators';

/**
 * Registers all Joplin commands for toolbar buttons and menu items.
 */
export class CommandManager {
  private static readonly ICON = 'fas fa-redo-alt';

  /** Register all plugin commands */
  @TryCatch({ logError: true })
  static async registerAll(): Promise<void> {
    const commands = [
      {
        name: 'updateAllRecurrences',
        label: 'Update All Recurrence Information',
        execute: () => RecurrenceManager.updateAllRecurrences(),
      },
      {
        name: 'updateOverdueTodos',
        label: 'Update Overdue To-Dos',
        execute: () => RecurrenceManager.updateOverdueTodos(),
      },
      {
        name: 'setOverdueTodosToToday',
        label: 'Reschedule Overdue To-Dos to Today',
        execute: () => RecurrenceManager.setOverdueTodosToToday(),
      },
      {
        name: 'openRecurrenceDialog',
        label: 'Open Recurrence Dialog',
        execute: () => RecurrenceManager.openRecurrenceDialog(),
      },
    ];

    for (const cmd of commands) {
      await joplin.commands.register({
        ...cmd,
        iconName: this.ICON,
      });
      console.info(`Command registered: ${cmd.name}`);
    }

    console.info('All commands registered.');
  }
}