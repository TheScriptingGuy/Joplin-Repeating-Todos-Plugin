import { defineConfig } from '@playwright/test';

/**
 * Playwright config for the end-to-end tests. Two kinds of test live in ./e2e:
 *
 *  - Real-app tests (*.spec.ts using ./launch) drive the actual Joplin desktop (Electron) build with
 *    this plugin loaded as a development plugin. They are intentionally serial (a single Joplin
 *    instance, one profile at a time) and have generous timeouts because launching Joplin and waiting
 *    for the plugin/runtime to initialise is slow.
 *  - WebView tests (mobile-dialog-persist.spec.ts) run the dialog's real markup + addon script in a
 *    mobile-emulated Chromium, covering the mobile hosting model that the desktop app cannot exercise.
 *
 * Run with:  npm run test:e2e   (which wraps `playwright test` in xvfb-run for a virtual display)
 *
 * Set PLAYWRIGHT_CHROMIUM_PATH to use an already-present Chromium build instead of Playwright's own
 * (useful in sandboxes/CI images where `playwright install` cannot download).
 */
const chromiumPath = process.env.PLAYWRIGHT_CHROMIUM_PATH;

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
