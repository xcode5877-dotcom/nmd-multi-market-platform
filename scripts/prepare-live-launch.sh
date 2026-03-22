#!/usr/bin/env bash
# PREPARE SYSTEM FOR LIVE LAUNCH - NO DATA DELETION
# Clears caches, builds for production, optionally optimizes DB and runs connectivity check.
# Does NOT delete or modify Users, Products, Tenants, Images, or Settings.

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "[1/5] Clearing application and build caches..."
# Vite / build tool caches
find . -type d -name '.vite' -path '*/node_modules/*' 2>/dev/null | head -20 | xargs -r rm -rf
find . -type d -name '.cache' -path '*/node_modules/*' 2>/dev/null | head -20 | xargs -r rm -rf
find . -type d -name 'dist' -not -path '*/.pnpm-store*' 2>/dev/null | while read -r d; do
  case "$d" in
    *node_modules*) ;;
    *) echo "  rm -rf $d" && rm -rf "$d" ;;
  esac
done
# Turbo / other meta caches at repo root
rm -rf .turbo 2>/dev/null || true
echo "  Cache clear done."

echo "[2/5] Clearing old log files (if any)..."
LOG_DIR="${LOG_DIR:-./logs}"
if [ -d "$LOG_DIR" ]; then
  find "$LOG_DIR" -maxdepth 1 -type f \( -name '*.log' -o -name '*.log.*' \) -exec truncate -s 0 {} \; 2>/dev/null || true
  echo "  Truncated log files in $LOG_DIR"
else
  mkdir -p "$LOG_DIR" 2>/dev/null || true
  echo "  No existing log dir; created $LOG_DIR (empty)."
fi

echo "[3/5] Production build (NODE_ENV=production, minified assets)..."
export NODE_ENV=production
pnpm run build
echo "  Build done."

echo "[4/5] Prisma: generate client and optional DB optimize..."
cd "$ROOT/apps/mock-api"
pnpm exec prisma generate
if [ -n "$DATABASE_URL" ]; then
  if echo "ANALYZE;" | pnpm exec prisma db execute --stdin 2>/dev/null; then
    echo "  DB ANALYZE completed (stats updated)."
  else
    echo "  DB ANALYZE skipped (execute failed or not available)."
  fi
else
  echo "  DATABASE_URL not set; skipping DB optimize."
fi
cd "$ROOT"

echo "[5/5] Connectivity check..."
if [ -n "$API_BASE_URL" ]; then
  if curl -sf "${API_BASE_URL%/}/health" >/dev/null; then
    echo "  API health: OK ($API_BASE_URL/health)"
  else
    echo "  WARN: API health check failed ($API_BASE_URL/health)"
  fi
else
  echo "  Set API_BASE_URL to run API connectivity check (e.g. https://nmd.marketing/api)."
fi

echo ""
echo "Launch prep complete. NODE_ENV=production; caches cleared; assets built."
echo "No users, products, tenants, images, or settings were modified."
