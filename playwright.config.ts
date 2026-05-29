import { defineConfig } from '@playwright/test';

/**
 * Playwright config for the real-app Joplin end-to-end tests.
 *
 * These tests launch the actual Joplin desktop (Electron) build with this plugin loaded as a
 * development plugin, and drive the genuine GUI. They are intentionally serial (a single Joplin
 * instance, one profile at a time) and have generous timeouts because launching Joplin and waiting
 * for the plugin/runtime to initialise is slow.
 *
 * Run with:  npm run test:e2e   (which wraps `playwright test` in xvfb-run for a virtual display)
 */
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
  },
});
