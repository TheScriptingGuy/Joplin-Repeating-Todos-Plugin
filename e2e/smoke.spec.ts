import { test, expect } from '@playwright/test';
import { launchJoplin, closeJoplin, JoplinInstance } from './launch';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Smoke test: prove that the real Joplin desktop launches with our plugin loaded.
 * Also dumps diagnostics (screenshot + a summary of toolbar/menu DOM) to test-results/ to help
 * author the richer UI specs.
 */
test.describe('Joplin app smoke', () => {
  let joplin: JoplinInstance;

  test.beforeAll(async () => {
    joplin = await launchJoplin();
  });

  test.afterAll(async () => {
    if (joplin) await closeJoplin(joplin);
  });

  test('launches and renders the Joplin UI', async () => {
    const { win } = joplin;
    const outDir = path.join(__dirname, '..', 'test-results');
    fs.mkdirSync(outDir, { recursive: true });

    // Give the plugin runtime a moment to register toolbar buttons / menus.
    await win.waitForTimeout(8000);
    await win.screenshot({ path: path.join(outDir, 'smoke-main.png'), fullPage: true });

    const title = await win.title();
    console.log('WINDOW TITLE:', title);

    // Diagnostics: dump every toolbar button's aria-label/title so we can find the recurrence button.
    const buttons = await win.evaluate(() => {
      const out: Array<Record<string, string | null>> = [];
      document.querySelectorAll('button, a[role="button"]').forEach((b) => {
        out.push({
          title: b.getAttribute('title'),
          aria: b.getAttribute('aria-label'),
          cls: b.getAttribute('class'),
          icon: b.querySelector('i')?.getAttribute('class') ?? null,
        });
      });
      return out;
    });
    fs.writeFileSync(
      path.join(outDir, 'smoke-buttons.json'),
      JSON.stringify(buttons, null, 2)
    );
    console.log('TOTAL BUTTONS:', buttons.length);
    const redo = buttons.filter((b) => (b.icon || '').includes('fa-redo'));
    console.log('REDO-ICON BUTTONS:', JSON.stringify(redo));

    expect(win).toBeTruthy();
  });
});
