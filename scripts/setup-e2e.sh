#!/usr/bin/env bash
#
# Downloads and extracts the Joplin desktop AppImage used by the real-app E2E tests.
# Idempotent: skips the download/extract if the extracted Electron binary already exists.
#
# Override the version with JOPLIN_E2E_VERSION (must be >= the plugin's app_min_version).
#
set -euo pipefail

JOPLIN_VERSION="${JOPLIN_E2E_VERSION:-3.6.14}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CACHE_DIR="$REPO_ROOT/.e2e-cache"
APPIMAGE="$CACHE_DIR/Joplin.AppImage"
BINARY="$CACHE_DIR/squashfs-root/joplin"
URL="https://github.com/laurent22/joplin/releases/download/v${JOPLIN_VERSION}/Joplin-${JOPLIN_VERSION}.AppImage"

mkdir -p "$CACHE_DIR"

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
