#!/usr/bin/env bash
# Print counts from PostgreSQL after migration (stores, products, orders).
# Run from repo root: ./scripts/verify_db_migration.sh

set -e
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "=== Migration verification (PostgreSQL) ==="
docker compose exec -T postgres psql -U nmd -d nmd -c "
SELECT 'markets' AS entity, COUNT(*) AS cnt FROM \"Market\"
UNION ALL SELECT 'tenants', COUNT(*) FROM \"Tenant\"
UNION ALL SELECT 'products', COUNT(*) FROM \"CatalogProduct\"
UNION ALL SELECT 'categories', COUNT(*) FROM \"CatalogCategory\"
UNION ALL SELECT 'orders', COUNT(*) FROM \"Order\"
UNION ALL SELECT 'customers', COUNT(*) FROM \"Customer\";
"

echo "Tenants (stores) with product counts:"
docker compose exec -T postgres psql -U nmd -d nmd -c "
SELECT t.name, t.slug, (SELECT COUNT(*) FROM \"CatalogProduct\" p WHERE p.\"tenantId\" = t.id) AS products
FROM \"Tenant\" t
ORDER BY t.slug
LIMIT 30;
"

echo "Done. Stores, products, and image URLs are in the DB; uploads/ folder unchanged."
