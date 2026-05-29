#!/usr/bin/env bash
set -euo pipefail

# Safe cleanup utility for order/lead data only.
# Default mode is dry-run. No deletion happens unless --execute is provided.
#
# Scope:
# - PostgreSQL: "Order", "Payment" only
# - JSON leads: /app/data/data.json -> leads[] (optional with --include-leads)
#
# Protected checks (must remain unchanged):
# - User, Tenant, Market, CatalogProduct, CatalogCategory, GlobalReward, RewardRedemption

POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-nmd-multi-market-platform-postgres-1}"
MOCK_API_CONTAINER="${MOCK_API_CONTAINER:-nmd-multi-market-platform-mock-api-1}"
DB_USER="${DB_USER:-nmd}"
DB_NAME="${DB_NAME:-nmd}"
BACKUP_DIR="${BACKUP_DIR:-/root/nmd-multi-market-platform/backups}"

EXECUTE=0
INCLUDE_LEADS=0
RESET_IDENTITIES=0
CONFIRM=""

for arg in "$@"; do
  case "$arg" in
    --dry-run) EXECUTE=0 ;;
    --execute) EXECUTE=1 ;;
    --include-leads) INCLUDE_LEADS=1 ;;
    --reset-identities) RESET_IDENTITIES=1 ;;
    --confirm=*) CONFIRM="${arg#*=}" ;;
    *)
      echo "Unknown option: $arg"
      echo "Usage: $0 [--dry-run] [--execute --confirm=DELETE] [--include-leads] [--reset-identities]"
      exit 1
      ;;
  esac
done

echo "=== CLEANUP PLAN (ORDER + LEADS) ==="
echo "Mode: $([ "$EXECUTE" -eq 1 ] && echo "EXECUTE" || echo "DRY-RUN")"
echo "Postgres container: $POSTGRES_CONTAINER"
echo "Mock API container: $MOCK_API_CONTAINER"
echo "Database: $DB_NAME (user: $DB_USER)"
echo "Include JSON leads cleanup: $([ "$INCLUDE_LEADS" -eq 1 ] && echo "YES" || echo "NO")"
echo "Reset identities for order tables: $([ "$RESET_IDENTITIES" -eq 1 ] && echo "YES" || echo "NO")"
echo

echo "Affected data targets:"
echo "  - PostgreSQL: \"Order\", \"Payment\""
if [ "$INCLUDE_LEADS" -eq 1 ]; then
  echo "  - JSON: /app/data/data.json -> leads[]"
fi
echo

echo "Protected data checks (must remain unchanged):"
echo "  - User, Tenant, Market, CatalogProduct, CatalogCategory, GlobalReward, RewardRedemption"
echo

echo "=== BEFORE COUNTS ==="
docker exec "$POSTGRES_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "
SELECT 'Order' AS tbl, COUNT(*)::bigint AS cnt FROM \"Order\"
UNION ALL SELECT 'Payment', COUNT(*) FROM \"Payment\"
UNION ALL SELECT 'User', COUNT(*) FROM \"User\"
UNION ALL SELECT 'Tenant', COUNT(*) FROM \"Tenant\"
UNION ALL SELECT 'Market', COUNT(*) FROM \"Market\"
UNION ALL SELECT 'CatalogProduct', COUNT(*) FROM \"CatalogProduct\"
UNION ALL SELECT 'CatalogCategory', COUNT(*) FROM \"CatalogCategory\"
UNION ALL SELECT 'GlobalReward', COUNT(*) FROM \"GlobalReward\"
UNION ALL SELECT 'RewardRedemption', COUNT(*) FROM \"RewardRedemption\"
ORDER BY tbl;"

docker exec "$MOCK_API_CONTAINER" node -e '
const fs=require("fs");
const path="/app/data/data.json";
if (!fs.existsSync(path)) {
  console.log("JSON leads count: data.json not found");
  process.exit(0);
}
const data=JSON.parse(fs.readFileSync(path,"utf8"));
console.log(`JSON leads count: ${Array.isArray(data.leads)?data.leads.length:0}`);
'

if [ "$EXECUTE" -ne 1 ]; then
  echo
  echo "DRY-RUN: no deletion executed."
  echo "To execute: $0 --execute --confirm=DELETE --include-leads"
  exit 0
fi

if [ "$CONFIRM" != "DELETE" ]; then
  echo "Refusing to execute without --confirm=DELETE"
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
RUN_BACKUP_DIR="$BACKUP_DIR/orders-leads-cleanup-$STAMP"
mkdir -p "$RUN_BACKUP_DIR"

echo
echo "=== BACKUP ==="
echo "Backup directory: $RUN_BACKUP_DIR"
docker exec "$POSTGRES_CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc -f /tmp/pre-orders-leads-cleanup.dump
docker cp "$POSTGRES_CONTAINER:/tmp/pre-orders-leads-cleanup.dump" "$RUN_BACKUP_DIR/pre-orders-leads-cleanup.dump"
docker exec "$POSTGRES_CONTAINER" rm -f /tmp/pre-orders-leads-cleanup.dump
echo "DB backup complete."

if [ "$INCLUDE_LEADS" -eq 1 ]; then
  docker exec "$MOCK_API_CONTAINER" sh -lc 'cp /app/data/data.json /app/data/data.json.pre-orders-leads-cleanup.bak'
  echo "JSON backup complete (/app/data/data.json.pre-orders-leads-cleanup.bak)."
fi

echo
echo "=== DELETE ORDER DATA (TRANSACTION) ==="
if [ "$RESET_IDENTITIES" -eq 1 ]; then
  docker exec "$POSTGRES_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -c "
BEGIN;
TRUNCATE TABLE \"Order\" RESTART IDENTITY CASCADE;
COMMIT;"
else
  docker exec "$POSTGRES_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -c "
BEGIN;
TRUNCATE TABLE \"Order\" CASCADE;
COMMIT;"
fi

if [ "$INCLUDE_LEADS" -eq 1 ]; then
  echo
  echo "=== DELETE JSON LEADS ONLY ==="
  docker exec "$MOCK_API_CONTAINER" node -e '
const fs=require("fs");
const path="/app/data/data.json";
if (!fs.existsSync(path)) process.exit(0);
const data=JSON.parse(fs.readFileSync(path,"utf8"));
data.leads=[];
fs.writeFileSync(path, JSON.stringify(data, null, 2));
console.log("JSON leads cleared.");
'
fi

echo
echo "=== AFTER COUNTS ==="
docker exec "$POSTGRES_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "
SELECT 'Order' AS tbl, COUNT(*)::bigint AS cnt FROM \"Order\"
UNION ALL SELECT 'Payment', COUNT(*) FROM \"Payment\"
UNION ALL SELECT 'User', COUNT(*) FROM \"User\"
UNION ALL SELECT 'Tenant', COUNT(*) FROM \"Tenant\"
UNION ALL SELECT 'Market', COUNT(*) FROM \"Market\"
UNION ALL SELECT 'CatalogProduct', COUNT(*) FROM \"CatalogProduct\"
UNION ALL SELECT 'CatalogCategory', COUNT(*) FROM \"CatalogCategory\"
UNION ALL SELECT 'GlobalReward', COUNT(*) FROM \"GlobalReward\"
UNION ALL SELECT 'RewardRedemption', COUNT(*) FROM \"RewardRedemption\"
ORDER BY tbl;"

docker exec "$MOCK_API_CONTAINER" node -e '
const fs=require("fs");
const path="/app/data/data.json";
if (!fs.existsSync(path)) {
  console.log("JSON leads count: data.json not found");
  process.exit(0);
}
const data=JSON.parse(fs.readFileSync(path,"utf8"));
console.log(`JSON leads count: ${Array.isArray(data.leads)?data.leads.length:0}`);
'

echo
echo "Cleanup completed."
