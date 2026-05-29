import { chromium, Browser, Page } from 'playwright';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';
import * as net from 'net';

/**
 * Helpers for launching a real Joplin desktop (Electron) instance with this plugin loaded as a
 * development plugin, against a throwaway profile.
 *
 * Why CDP instead of Playwright's `_electron.launch`:
 *   Joplin parses ALL process flags with a strict allow-list and throws "Unknown flag" on anything
 *   it doesn't recognise. Playwright's `_electron.launch` injects `--inspect=0`, which Joplin rejects,
 *   aborting startup. So instead we spawn Joplin ourselves passing only flags Chromium consumes
 *   (`--no-sandbox`, `--disable-gpu`) plus `--remote-debugging-port`, then attach Playwright via
 *   `chromium.connectOverCDP`. `_electron` drives Joplin's own bundled Electron — no browser download.
 *
 * The Joplin AppImage is downloaded + extracted by `scripts/setup-e2e.sh` into
 * `.e2e-cache/squashfs-root/`.
 */

const REPO_ROOT = path.resolve(__dirname, '..');
const CACHE_DIR = path.join(REPO_ROOT, '.e2e-cache');
const EXTRACT_DIR = path.join(CACHE_DIR, 'squashfs-root');
const JOPLIN_BINARY = path.join(EXTRACT_DIR, 'joplin');
const PLUGIN_DIST = path.join(REPO_ROOT, 'dist');

export interface JoplinInstance {
  browser: Browser;
  child: ChildProcess;
  /** The main Joplin window (renderer page). */
  win: Page;
  profileDir: string;
  port: number;
}

/** Throws a helpful error if the harness prerequisites are missing. */
export function assertE2EReady(): void {
  if (!fs.existsSync(JOPLIN_BINARY)) {
    throw new Error(
      `Joplin binary not found at ${JOPLIN_BINARY}.\n` +
        `Run "npm run setup:e2e" first to download and extract the Joplin AppImage.`
    );
  }
  if (!fs.existsSync(path.join(PLUGIN_DIST, 'manifest.json'))) {
    throw new Error(
      `Built plugin not found at ${PLUGIN_DIST}.\nRun "npm run dist" first.`
    );
  }
}

/** Create a fresh, isolated Joplin profile that loads this plugin from ./dist as a dev plugin. */
function createProfile(): string {
  const profilesRoot = path.join(REPO_ROOT, 'e2e', '.profiles');
  fs.mkdirSync(profilesRoot, { recursive: true });
  const profileDir = fs.mkdtempSync(path.join(profilesRoot, 'profile-'));

  // File-storage settings live in <profile>/settings.json. `plugins.devPluginPaths` is a
  // File-storage setting, so presetting it makes Joplin load our built plugin (./dist) on startup.
  const settings = {
    'plugins.devPluginPaths': PLUGIN_DIST,
    'welcome.enabled': false,
    'autoUpdateEnabled': false,
    'locale': 'en_GB',
    'sync.target': 0,
  };
  fs.writeFileSync(
    path.join(profileDir, 'settings.json'),
    JSON.stringify(settings, null, 2),
    'utf8'
  );
  return profileDir;
}

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

function waitForCDP(port: number, timeoutMs: number): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      http
        .get(`http://127.0.0.1:${port}/json/version`, (res) => {
          res.resume();
          resolve();
        })
        .on('error', () => {
          if (Date.now() - start > timeoutMs) reject(new Error('Joplin CDP endpoint never came up'));
          else setTimeout(tick, 500);
        });
    };
    tick();
  });
}

/** Launch Joplin and return the app + main window once the UI is ready. */
export async function launchJoplin(): Promise<JoplinInstance> {
  assertE2EReady();
  const profileDir = createProfile();
  const port = await getFreePort();

  const child = spawn(
    JOPLIN_BINARY,
    [
      '--profile',
      profileDir,
      // Only flags Chromium consumes (so they never reach Joplin's strict flag parser) + CDP port.
      '--no-sandbox',
      '--disable-gpu',
      `--remote-debugging-port=${port}`,
    ],
    {
      env: {
        ...process.env,
        LD_LIBRARY_PATH: `${EXTRACT_DIR}:${path.join(EXTRACT_DIR, 'usr', 'lib')}:${
          process.env.LD_LIBRARY_PATH ?? ''
        }`,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );

  await waitForCDP(port, 90_000);
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);

  const win = await findMainWindow(browser, 60_000);
  await waitForJoplinReady(win);

  return { browser, child, win, profileDir, port };
}

/** Locate the main Joplin renderer page (index.html) across CDP contexts. */
async function findMainWindow(browser: Browser, timeoutMs: number): Promise<Page> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    for (const ctx of browser.contexts()) {
      for (const p of ctx.pages()) {
        if (p.url().includes('index.html')) return p;
      }
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error('Could not find the Joplin main window via CDP');
}

/** Wait until the Joplin main UI has rendered (React app mounted, not a blank window). */
export async function waitForJoplinReady(win: Page): Promise<void> {
  await win.waitForFunction(
    () => {
      const root = document.getElementById('react-root');
      return !!root && root.children.length > 0;
    },
    undefined,
    { timeout: 90_000 }
  );
  // Sidebar is a reliable "fully rendered" signal.
  await win.waitForSelector('text=NOTEBOOKS', { timeout: 30_000 });
}

/** Close Joplin and remove its throwaway profile. */
export async function closeJoplin(instance: JoplinInstance): Promise<void> {
  try {
    await instance.browser.close();
  } catch {
    /* ignore */
  }
  try {
    instance.child.kill('SIGKILL');
  } catch {
    /* ignore */
  }
  try {
    fs.rmSync(instance.profileDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

export const E2E_PATHS = { REPO_ROOT, CACHE_DIR, EXTRACT_DIR, JOPLIN_BINARY, PLUGIN_DIST };
