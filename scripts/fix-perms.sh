#!/usr/bin/env bash
# Fix permissions so the mock-api container can read/write host-mapped data.json and uploads.
# Run from repo root: ./scripts/fix-perms.sh

set -e
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DATA_FILE="$ROOT/apps/mock-api/data.json"
UPLOADS_DIR="$ROOT/apps/mock-api/uploads"

# Ensure data.json exists (copy from data/data.json if present)
if [[ ! -f "$DATA_FILE" ]]; then
  if [[ -f "$ROOT/apps/mock-api/data/data.json" ]]; then
    mkdir -p "$(dirname "$DATA_FILE")"
    cp "$ROOT/apps/mock-api/data/data.json" "$DATA_FILE"
    echo "[fix-perms] Created $DATA_FILE from apps/mock-api/data/data.json"
  else
    touch "$DATA_FILE"
    echo '{"markets":[],"tenants":[],"users":[],"couriers":[],"customers":[],"catalog":{},"delivery":{},"deliveryZones":{},"auditEvents":[]}' > "$DATA_FILE"
    echo "[fix-perms] Created empty $DATA_FILE"
  fi
fi

chmod 666 "$DATA_FILE"
echo "[fix-perms] chmod 666 apps/mock-api/data.json"

mkdir -p "$UPLOADS_DIR"
chmod -R 777 "$UPLOADS_DIR"
echo "[fix-perms] chmod -R 777 apps/mock-api/uploads"

echo "[fix-perms] Done. Start mock-api with: docker compose up -d --build mock-api"
