#!/usr/bin/env bash
# Backup all JSON data and uploads before switching to STORAGE_DRIVER=db.
# Usage: from repo root: ./scripts/backup_before_db_migration.sh
# Creates: backups_before_db_migration/YYYYMMDD-HHMMSS/

set -e
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"
MOCK_API="$REPO_ROOT/apps/mock-api"
STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="$REPO_ROOT/backups_before_db_migration/$STAMP"
mkdir -p "$BACKUP_DIR"

echo "[backup] Creating backup in $BACKUP_DIR"

# JSON files (copy if they exist)
for f in data.json orders.json market-config.json push-subscriptions.json; do
  if [ -f "$MOCK_API/$f" ]; then
    cp "$MOCK_API/$f" "$BACKUP_DIR/$f"
    echo "[backup] Copied $f"
  else
    echo "[backup] Skip $f (not found)"
  fi
done

# data/data.json if present
if [ -f "$MOCK_API/data/data.json" ]; then
  mkdir -p "$BACKUP_DIR/data"
  cp "$MOCK_API/data/data.json" "$BACKUP_DIR/data/data.json"
  echo "[backup] Copied data/data.json"
fi

# uploads folder
if [ -d "$MOCK_API/uploads" ]; then
  cp -a "$MOCK_API/uploads" "$BACKUP_DIR/uploads"
  echo "[backup] Copied uploads/ (full tree)"
else
  echo "[backup] Skip uploads (directory not found)"
fi

echo "[backup] Done. Backup at: $BACKUP_DIR"
