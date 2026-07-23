#!/usr/bin/env bash
# Build the Android APK (debug) from the shared web core.
# Prerequisites: Node 18+, JDK 17, Android SDK (ANDROID_HOME set).
set -e
cd "$(dirname "$0")/.."

echo "==> Building web core (Vite)…"
npm run build

if [ ! -d "android" ]; then
  echo "==> Adding Android platform (Capacitor)…"
  npx cap add android
fi

echo "==> Syncing web assets into Android project…"
npx cap sync android

echo "==> Gradle assembleDebug…"
cd android
chmod +x ./gradlew || true
./gradlew assembleDebug

APK="app/build/outputs/apk/debug/app-debug.apk"
if [ -f "$APK" ]; then
  echo "✅ APK built: android/$APK"
else
  echo "❌ APK not found — check Gradle output above."
  exit 1
fi
