#!/usr/bin/env bash
#
# Prepares everything the E2E tests need:
#   * the Joplin desktop AppImage driven by the real-app tests
#   * a Chromium for the mobile WebView tests
# Idempotent: skips work that is already done.
#
# Override the Joplin version with JOPLIN_E2E_VERSION (must be >= the plugin's app_min_version).
#
set -euo pipefail

JOPLIN_VERSION="${JOPLIN_E2E_VERSION:-3.6.14}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CACHE_DIR="$REPO_ROOT/.e2e-cache"
APPIMAGE="$CACHE_DIR/Joplin.AppImage"
BINARY="$CACHE_DIR/squashfs-root/joplin"
URL="https://github.com/laurent22/joplin/releases/download/v${JOPLIN_VERSION}/Joplin-${JOPLIN_VERSION}.AppImage"

mkdir -p "$CACHE_DIR"

# Chromium for the mobile WebView tests. Non-fatal: sandboxes and CI images often block the download
# but already ship a browser, which playwright.config.ts finds on its own.
if ! npx playwright install chromium >/dev/null 2>&1; then
  echo "[setup-e2e] Could not download Chromium — falling back to an already-installed browser."
  echo "[setup-e2e] Set PLAYWRIGHT_CHROMIUM_PATH if the WebView tests cannot find one."
fi

if [ -x "$BINARY" ]; then
  echo "[setup-e2e] Joplin already extracted at $BINARY — nothing to do."
  exit 0
fi

if [ ! -f "$APPIMAGE" ]; then
  echo "[setup-e2e] Downloading Joplin $JOPLIN_VERSION ..."
  curl -sSL -o "$APPIMAGE" "$URL"
  chmod +x "$APPIMAGE"
fi

echo "[setup-e2e] Extracting AppImage (no FUSE required) ..."
( cd "$CACHE_DIR" && "$APPIMAGE" --appimage-extract >/dev/null )

if [ ! -x "$BINARY" ]; then
  echo "[setup-e2e] ERROR: expected Electron binary not found at $BINARY" >&2
  exit 1
fi

echo "[setup-e2e] Ready: $BINARY"
