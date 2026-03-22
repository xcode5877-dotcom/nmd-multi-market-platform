#!/usr/bin/env bash
# Strict migration: JSON → PostgreSQL.
# Prerequisites: backup already created (run ./scripts/backup_before_db_migration.sh first).
# Uses existing JSON files (data.json, orders.json) to seed the DB; does NOT delete JSON files (cold standby).
# Run from repo root.

set -e
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "[migrate] 1. Checking backup exists..."
BACKUP_LATEST="$REPO_ROOT/backups_before_db_migration"
if [ ! -d "$BACKUP_LATEST" ] || [ -z "$(ls -A "$BACKUP_LATEST" 2>/dev/null)" ]; then
  echo "[migrate] ERROR: No backup found. Run first: ./scripts/backup_before_db_migration.sh"
  exit 1
fi
echo "[migrate] Backup dir(s) present: $BACKUP_LATEST"

echo "[migrate] 2. Ensuring Postgres is up..."
docker compose up -d postgres
echo "[migrate] Waiting for Postgres to be healthy..."
sleep 3
until docker compose exec -T postgres pg_isready -U nmd -d nmd 2>/dev/null; do
  echo "[migrate] Waiting for postgres..."
  sleep 2
done

echo "[migrate] 3. Running Prisma migrate deploy (create/update tables)..."
docker compose run --rm mock-api npx prisma migrate deploy --schema=prisma/schema.prisma

echo "[migrate] 4. Seeding database from JSON (data.json + orders.json)..."
docker compose run --rm \
  -e DATA_FILE=/app/data/data.json \
  -e ORDERS_FILE=/app/data/orders.json \
  mock-api npx prisma db seed

echo "[migrate] Done. Start app with: docker compose up -d"
echo "[migrate] JSON files were NOT deleted; they remain as cold standby in apps/mock-api/."
