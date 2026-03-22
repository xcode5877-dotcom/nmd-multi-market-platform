#!/usr/bin/env bash
# Create a database backup and optional code snapshot (git tag) of the current stable state.
# Usage: ./scripts/backup-database-and-snapshot.sh [--tag]
#   --tag   Create a git tag (e.g. stable-2026-03-07) after backup. You can push with: git push origin <tagname>

set -e
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TIMESTAMP=$(date +%Y-%m-%dT%H-%M-%S)
BACKUP_DIR="${REPO_ROOT}/backups/stable-state-${TIMESTAMP}"

cd "$REPO_ROOT"
mkdir -p "$BACKUP_DIR"

# 1. Database backup: mock-api data.json (and alternate data/data.json if present)
DATA_JSON="${REPO_ROOT}/apps/mock-api/data.json"
DATA_DIR_JSON="${REPO_ROOT}/apps/mock-api/data/data.json"
if [ -f "$DATA_JSON" ]; then
  cp "$DATA_JSON" "$BACKUP_DIR/data.json"
  echo "Backed up: data.json"
fi
if [ -f "$DATA_DIR_JSON" ]; then
  mkdir -p "$BACKUP_DIR/data"
  cp "$DATA_DIR_JSON" "$BACKUP_DIR/data/data.json"
  echo "Backed up: data/data.json"
fi

# Market config (banners, layout per market)
MARKET_CONFIG="${REPO_ROOT}/apps/mock-api/market-config.json"
if [ -f "$MARKET_CONFIG" ]; then
  cp "$MARKET_CONFIG" "$BACKUP_DIR/market-config.json"
  echo "Backed up: market-config.json"
fi

# Orders (if using file-based orders)
ORDERS_JSON="${REPO_ROOT}/packages/mock/data/orders.json"
if [ -f "$ORDERS_JSON" ]; then
  mkdir -p "$BACKUP_DIR/orders"
  cp "$ORDERS_JSON" "$BACKUP_DIR/orders/orders.json" 2>/dev/null || true
fi

# 2. Code snapshot: create git tag if requested
CREATE_TAG=false
for arg in "$@"; do
  if [ "$arg" = "--tag" ]; then
    CREATE_TAG=true
    break
  fi
done

if [ "$CREATE_TAG" = true ]; then
  TAG_NAME="stable-$(date +%Y-%m-%d)"
  if git rev-parse "$TAG_NAME" >/dev/null 2>&1; then
    echo "Tag $TAG_NAME already exists. Skipping tag. Use a different date or delete the tag."
  else
    git tag -a "$TAG_NAME" -m "Stable snapshot $TIMESTAMP"
    echo "Created git tag: $TAG_NAME (push with: git push origin $TAG_NAME)"
  fi
fi

echo "Backup written to: $BACKUP_DIR"
ls -la "$BACKUP_DIR"
