#!/usr/bin/env bash
# Build storefront, sync to Android project assets, and assemble debug APK.
#
# One-liner (run from repo root):
#   rm -rf apps/storefront/dist && pnpm --filter storefront run build && rm -rf apps/native-assets/customer/android-project/app/src/main/assets/public && mkdir -p apps/native-assets/customer/android-project/app/src/main/assets/public && cp -R apps/storefront/dist/* apps/native-assets/customer/android-project/app/src/main/assets/public/ && (cd apps/native-assets/customer/android-project && ./gradlew assembleDebug)
#
# Android project: apps/native-assets/customer/android-project
# Asset path: app/src/main/assets/public (correct webDir for bundled storefront).
# By default the app loads https://nmd.marketing (strings.xml web_base_url). This script keeps the bundled copy in sync.
# User-Agent is set in MainActivity.java to include "NMDCustomerApp" and "NMD-Android-App" (no Capacitor in this project).

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STOREFRONT_DIST="$ROOT/apps/storefront/dist"
ANDROID_PROJECT="$ROOT/apps/native-assets/customer/android-project"
ANDROID_PUBLIC="$ANDROID_PROJECT/app/src/main/assets/public"

echo "[1/5] Deleting storefront dist..."
rm -rf "$STOREFRONT_DIST"

echo "[2/5] Building storefront..."
cd "$ROOT" && pnpm --filter storefront run build

echo "[3/5] Clearing Android assets/public..."
rm -rf "$ANDROID_PUBLIC"
mkdir -p "$ANDROID_PUBLIC"

echo "[4/5] Copying storefront dist to Android assets/public..."
cp -R "$STOREFRONT_DIST"/* "$ANDROID_PUBLIC/"

echo "[5/5] Running ./gradlew assembleDebug..."
cd "$ANDROID_PROJECT" && ./gradlew assembleDebug

echo "Done. APK: $ANDROID_PROJECT/app/build/outputs/apk/debug/app-debug.apk"
