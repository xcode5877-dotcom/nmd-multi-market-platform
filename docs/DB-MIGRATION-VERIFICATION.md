# Database Migration Verification (JSON → PostgreSQL)

After running the strict migration (`scripts/backup_before_db_migration.sh` then `scripts/migrate_json_to_postgres.sh`), use this to confirm stores, products, and images are linked correctly.

## 1. Quick counts (run inside mock-api container)

From repo root:

```bash
docker compose run --rm mock-api npx prisma db execute --stdin <<'SQL'
SELECT 'markets' AS entity, COUNT(*) AS cnt FROM "Market"
UNION ALL SELECT 'tenants', COUNT(*) FROM "Tenant"
UNION ALL SELECT 'CatalogProduct', COUNT(*) FROM "CatalogProduct"
UNION ALL SELECT 'CatalogCategory', COUNT(*) FROM "CatalogCategory"
UNION ALL SELECT 'orders', COUNT(*) FROM "Order"
UNION ALL SELECT 'Customer', COUNT(*) FROM "Customer";
SQL
```

Or use Prisma Studio to browse:

```bash
docker compose run --rm -p 5555:5555 mock-api npx prisma studio
```

Then open http://localhost:5555 and check **Tenant**, **CatalogProduct**, **Order**.

## 2. Stores (tenants) and products linked

- Each **CatalogProduct** has `tenantId` and `categoryId`; categories are per-tenant.
- Each **Order** has `tenantId`; order `payload` (JSON) holds items and customer info.
- **Tenant** rows should match the number of stores you had in `data.json` (plus the default tenant).

## 3. Images

- **Tenant**: `logoUrl`, `hero` (JSON), `banners` (JSON) — URLs point to your uploads (e.g. `https://nmd.marketing/api/uploads/...` or relative `/uploads/...`). Files live in `apps/mock-api/uploads/` on the host; the app serves them via the same API. No change after migration.
- **CatalogProduct**: `imageUrl`, `images` (JSON) — same as above; product images are stored in DB as URLs; files remain in `uploads/`.
- **Market**: `branding` (JSON) may contain market image URLs; again files in `uploads/`.

So: **stores, products, and images stay linked** — the DB holds the same URLs as before; only the source of truth for tenants/catalog/orders moves from JSON to PostgreSQL. Uploads folder is unchanged.

## 4. Verification summary checklist

| Check | How |
|-------|-----|
| Markets count | `SELECT COUNT(*) FROM "Market";` — should match data.json markets length. |
| Tenants count | `SELECT COUNT(*) FROM "Tenant";` — should match data.json tenants (+ 1 default if seed created it). |
| Products per tenant | `SELECT "tenantId", COUNT(*) FROM "CatalogProduct" GROUP BY "tenantId";` — should match catalog in data.json. |
| Orders | `SELECT COUNT(*) FROM "Order";` — should match orders.json length. |
| Image URLs | Tenant and CatalogProduct rows have `logoUrl` / `imageUrl` populated; same values as in JSON. |
| postgres_data volume | `docker volume inspect nmd-multi-market-platform_postgres_data` (or your project name) — exists and persists. |

## 5. If something is missing

- **Re-run seed (idempotent):**  
  `docker compose run --rm -e DATA_FILE=/app/data/data.json -e ORDERS_FILE=/app/data/orders.json mock-api npx prisma db seed`
- **Restore from backup:** Copy from `backups_before_db_migration/<timestamp>/` back to `apps/mock-api/*.json` and `apps/mock-api/uploads/`. To revert to JSON driver temporarily: set `STORAGE_DRIVER=json` and restart.
- **JSON files are not deleted** — they remain as cold standby in `apps/mock-api/`.
