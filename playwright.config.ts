import { defineConfig, chromium } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * Playwright config for the end-to-end tests. Two kinds of test live in ./e2e:
 *
 *  - Real-app tests (*.spec.ts using ./launch) drive the actual Joplin desktop (Electron) build with
 *    this plugin loaded as a development plugin. They are intentionally serial (a single Joplin
 *    instance, one profile at a time) and have generous timeouts because launching Joplin and waiting
 *    for the plugin/runtime to initialise is slow. They attach to Joplin's own Electron over CDP, so
 *    they need no Playwright-managed browser at all.
 *  - WebView tests (mobile-dialog-persist.spec.ts) run the dialog's real markup + addon script in a
 *    mobile-emulated Chromium, covering the mobile hosting model that the desktop app cannot exercise.
 *    These do need a Chromium build — see resolveChromium() below.
 *
 * Run with:  npm run test:e2e   (which wraps `playwright test` in xvfb-run for a virtual display —
 * Electron cannot start without one, so running `playwright test` bare makes the desktop tests fail
 * with "Joplin CDP endpoint never came up").
 */

/**
 * Find a Chromium for the WebView tests.
 *
 * Returns undefined when Playwright's own managed browser is present, letting Playwright resolve it as
 * usual. Otherwise falls back to any Chromium already on the machine, because plenty of sandboxes and
 * CI images ship a browser but block `playwright install` from downloading one — without this the
 * WebView tests fail with "Executable doesn't exist at .../chrome-headless-shell".
 *
 * Set PLAYWRIGHT_CHROMIUM_PATH to force a specific binary.
 */
function resolveChromium(): string | undefined {
  const override = process.env.PLAYWRIGHT_CHROMIUM_PATH;
  if (override) return override;

  // Playwright's managed build is installed: let it resolve the browser itself.
  try {
    if (fs.existsSync(chromium.executablePath())) return undefined;
  } catch {
    // executablePath() throws when nothing is registered at all — fall through to the search below.
  }

  const roots = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    path.join(os.homedir(), '.cache', 'ms-playwright'),
  ].filter((dir): dir is string => !!dir && dir !== '0' && fs.existsSync(dir));

  const candidates: string[] = [];
  for (const root of roots) {
    // A `chromium` symlink pointing straight at the binary, as used by some prebuilt images.
    candidates.push(path.join(root, 'chromium'));
    // Playwright's own layout: <root>/chromium-<revision>/chrome-linux/chrome
    for (const entry of fs.readdirSync(root)) {
      if (!entry.startsWith('chromium-')) continue;
      candidates.push(
        path.join(root, entry, 'chrome-linux', 'chrome'),
        path.join(root, entry, 'chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'),
        path.join(root, entry, 'chrome-win', 'chrome.exe')
      );
    }
  }

  return candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
}

const chromiumPath = resolveChromium();

export default defineConfig({
  testDir: './e2e',
  // Launching Joplin + waiting for the plugin to register can take a while on a cold profile.
  timeout: 180_000,
  expect: { timeout: 20_000 },
  // A single Joplin instance at a time.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...(chromiumPath ? { launchOptions: { executablePath: chromiumPath } } : {}),
  },
});
