# Data recovery and uploads

## Source of truth: `data.json`

- **Preferred file:** `apps/mock-api/data/data.json`  
  This is the main seed/store catalog used by the mock-api. Use it as the recovered state when the database is outdated or contains deleted stores.
- A copy may exist at `data/data.json`; keep it in sync if you use it elsewhere (e.g. Docker volume).

## Uploads (store images)

- **Directory:** `apps/mock-api/data/uploads`  
  New images (e.g. from March 5th) live here. The API serves them under a path like `/api/uploads/<filename>` (or as configured by `UPLOADS_DIR`).
- **Matching to stores:** Image URLs in `data.json` (tenant `logoUrl`, product `imageUrl`, etc.) reference these filenames. Ensure URLs point to files that exist in `data/uploads` if you want images to display.

## Removing default/placeholder stores

1. **From JSON** (so the file no longer contains the deleted stores):
   ```bash
   cd apps/mock-api && pnpm exec tsx scripts/clean-default-stores-json.ts
   ```
   Uses `apps/mock-api/data/data.json` by default, or `SEED_JSON_PATH` if set. Creates a timestamped backup before writing.

2. **From PostgreSQL** (so the DB matches the cleaned JSON):
   ```bash
   cd apps/mock-api && DATABASE_URL=postgresql://... pnpm exec tsx scripts/delete-default-stores-db.ts
   ```
   Removes tenants `store-dab-bakery` and `store-dab-electronics` and all related rows (orders, users, catalog, delivery settings/zones).

## Seeding from data.json (PostgreSQL)

After schema or JSON changes:

1. Sync schema: `cd apps/mock-api && DATABASE_URL=... npx prisma db push`
2. Seed: `cd apps/mock-api && DATABASE_URL=... npx prisma db seed` (or `pnpm exec tsx prisma/seed.ts`)

The seed reads `apps/mock-api/data/data.json` by default (override with `DATA_FILE`). It maps JSON fields to the schema: tenants support `addressLine`, `location`, `_meta`, `isActive`→`enabled`, `businessType`, and optional fields like `operationalStatus`, `businessHours`, `openTime`, `closeTime`, `phone`. Products support `inStock`→`isAvailable`. Delivery zones support `minimumOrder`.

## Emergency sync

If no newer JSON is available, the only recovery path implemented is to use the cleaned `apps/mock-api/data/data.json` and reseed or re-import into the database. There is no separate “global identity” or store registry in this repo for restoring stores into the market catalog.
