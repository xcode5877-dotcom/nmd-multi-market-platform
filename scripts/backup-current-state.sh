#!/usr/bin/env bash
# Snapshot current state: apps/*/dist + core config into backups/stable-v1-pre-db
# Usage: ./scripts/backup-current-state.sh   (run from repo root)

set -e
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="${REPO_ROOT}/backups/stable-v1-pre-db"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
ARCHIVE="${BACKUP_DIR}/state-${TIMESTAMP}.tar.gz"

cd "$REPO_ROOT"
mkdir -p "$BACKUP_DIR"

# Collect paths (config files + dist dirs that exist)
FILES="docker-compose.yml nginx.conf Dockerfile.web Dockerfile.mock-api Dockerfile.storefront"
for dir in apps/storefront/dist apps/courier/dist apps/admin/dist apps/nmd-admin/dist; do
  [ -d "$dir" ] && FILES="$FILES $dir"
done

tar czf "$ARCHIVE" $FILES

echo "Backup written: $ARCHIVE"
ls -la "$ARCHIVE"
