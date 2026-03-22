# Strict Database Migration: JSON → PostgreSQL

Permanent switch from `STORAGE_DRIVER=json` to `STORAGE_DRIVER=db` (PostgreSQL). JSON files are **not** deleted; they remain as cold standby.

## Checklist (order matters)

### 1. Backup first (mandatory)

```bash
./scripts/backup_before_db_migration.sh
```

Creates `backups_before_db_migration/YYYYMMDD-HHMMSS/` with:

- `data.json`, `orders.json`, `market-config.json`, `push-subscriptions.json`
- `uploads/` (full tree)

### 2. Environment

- **docker-compose** is already updated: `STORAGE_DRIVER` default is `db`; `DATABASE_URL` points to the `postgres` service.
- No change needed unless you override in `.env`.

### 3. Prisma: create tables

Tables are created when you run the migration script (step 4). It runs:

```bash
docker compose run --rm mock-api npx prisma migrate deploy
```

### 4. Data sync: JSON → PostgreSQL

Run the full migration script (it checks backup, starts Postgres, runs migrate, then seed):

```bash
./scripts/migrate_json_to_postgres.sh
```

This:

- Ensures a backup exists
- Starts Postgres and waits for healthy
- Runs `prisma migrate deploy`
- Runs `prisma db seed` with `DATA_FILE=/app/data/data.json` and `ORDERS_FILE=/app/data/orders.json` (reads from your current JSON; does **not** delete them)

### 5. Persistence

- **postgres_data** volume in `docker-compose.yml` is configured. DB data survives `down/up` and image rebuilds. Do not remove the volume unless you intend to reset the DB.

### 6. Verification

```bash
./scripts/verify_db_migration.sh
```

See **docs/DB-MIGRATION-VERIFICATION.md** for counts, stores/products linkage, and image URLs.

### 7. Start the stack

```bash
docker compose up -d
```

mock-api will use PostgreSQL for all tenant, catalog, and order data. JSON files in `apps/mock-api/` are kept as cold standby and are **not** modified or deleted by this migration.
