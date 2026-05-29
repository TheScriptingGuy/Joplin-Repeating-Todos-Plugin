import { test, expect } from '@playwright/test';
import { launchJoplin, closeJoplin, JoplinInstance } from './launch';
import { createNotebook, createTodo } from './helpers';

const PLUGIN_ID = 'com.github.TheScriptingGuy.joplin-plugin-repeating-todos';

/**
 * Verifies the plugin is actually loaded and running in a real Joplin instance:
 *  - its background webview page exists (CDP), proving the plugin runtime started, and
 *  - its toolbar button is registered and visible once a to-do is open in the editor.
 */
test.describe('Plugin loads', () => {
  let joplin: JoplinInstance;

  test.beforeAll(async () => {
    joplin = await launchJoplin();
  });

  test.afterAll(async () => {
    if (joplin) await closeJoplin(joplin);
  });

  test('plugin background page is running (CDP)', async () => {
    // The plugin's background/script pages have a URL containing its plugin id.
    await expect
      .poll(
        () => {
          const urls: string[] = [];
          for (const ctx of joplin.browser.contexts()) {
            for (const p of ctx.pages()) urls.push(p.url());
          }
          return urls.some((u) => u.includes(`pluginId=${PLUGIN_ID}`));
        },
        { timeout: 30_000 }
      )
      .toBe(true);
  });

  test('recurrence toolbar button is registered', async () => {
    const { win } = joplin;
    await createNotebook(win, 'Loads NB');
    await createTodo(win, 'Loads Todo ' + Date.now());

    // The plugin registers this toolbar button; it is only present when a note/to-do is open.
    await expect(
      win.locator('button.toolbar-button[title="Open Recurrence Dialog"]')
    ).toBeVisible({ timeout: 20_000 });
  });
});
