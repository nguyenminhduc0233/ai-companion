#!/usr/bin/env bash
# Build the Windows EXE (portable) from the shared web core using Electron.
# On Windows this "just works". On Linux/macOS, electron-builder needs wine
# to stamp the Windows executable; install wine first (see README).
set -e
cd "$(dirname "$0")/.."

echo "==> Building web core (Vite)…"
npm run build

echo "==> Packaging Windows portable EXE (electron-builder)…"
npx electron-builder --win portable --publish never

echo "✅ Look in ./release for AI-Companion-*-portable.exe"
