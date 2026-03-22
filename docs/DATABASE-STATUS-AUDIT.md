# Database Status Audit & Data Loss Investigation

**Date:** 2026-03  
**Trigger:** Store "Caramela Sandwich" (and products) disappeared after `docker compose build --no-cache`.

---

## 1. Current Summary: What We Use

### 1.1 Two storage modes

| Mode | When | Where data lives |
|------|------|-------------------|
| **JSON (Mock)** | `STORAGE_DRIVER=json` (default in docker-compose) | **Files on disk**: `data.json`, `orders.json`, `market-config.json`, `push-subscriptions.json`. Not in-memory only — the app reads/writes these files on every load/persist. |
| **PostgreSQL (Prisma)** | `STORAGE_DRIVER=db` + `DATABASE_URL` | **Postgres DB** in the `postgres` service. Data in the named volume `postgres_data` (persistent). |

So: we are **not** “in-memory only”. We use either **file-based JSON** or **PostgreSQL**. The Mock API is file-persisted when `STORAGE_DRIVER=json`.

### 1.2 Current production layout (docker-compose)

- **PostgreSQL:** Always runs; data in volume `postgres_data` (survives rebuild).
- **mock-api:** Runs with `STORAGE_DRIVER=json` and **bind mounts** from the host:
  - `./apps/mock-api/data.json` → `/app/data/data.json` (tenants, markets, catalog, users, etc.)
  - `./apps/mock-api/orders.json` → `/app/data/orders.json`
  - `./apps/mock-api/market-config.json` → `/app/data/market-config.json`
  - `./apps/mock-api/push-subscriptions.json` → `/app/data/push-subscriptions.json`
  - `./apps/mock-api/uploads` → `/app/uploads`

If these host paths exist as **files** (and the process has write permission), data persists across restart and rebuild. Rebuilding the image does **not** wipe them, because they live on the host, not inside the image.

---

## 2. Investigation: Why Did "Caramela Sandwich" Disappear?

### 2.1 Docker bind-mount gotcha

If you mount a **file** that **does not exist** on the host, Docker **creates a directory** with that name, not a file:

```text
./apps/mock-api/data.json  (missing on host)  →  Docker creates a directory "data.json"
```

Then inside the container:

- `DATA_FILE=/app/data/data.json` points at a **directory**.
- `readFileSync(DATA_FILE)` → **EISDIR** (error: is a directory).
- Store layer catches the error and returns **empty default** data (no tenants).
- When the admin adds "Caramela Sandwich", it lives only **in memory**. `persist()` calls `writeFileSync(DATA_FILE, ...)`, which again hits **EISDIR** and fails, so nothing is written to disk.
- After **restart or rebuild**, the process starts fresh, reads again from the same path (still a directory) → again empty → **Caramela is gone**.

So the most likely cause of the disappearance is: **on the machine where you ran `docker compose build --no-cache`**, the host path `./apps/mock-api/data.json` (and possibly others) did **not** exist as a file before the first `up`. Docker then created **directories**, and all JSON “persistence” failed silently (in-memory only → lost on rebuild).

### 2.2 Other possible contributors

- **Working directory:** Volumes are relative to `docker compose`’s working directory. If you run from a different directory, `./apps/mock-api/data.json` may point somewhere else or not exist.
- **Permissions:** If the process cannot write to the mounted file, `save()` throws and data is never written (same “in-memory only” effect).
- **.dockerignore:** `apps/mock-api/data.json` (and other JSON files) are ignored, so they are **not** baked into the image. Persistence is **only** via the bind mount. If the mount is wrong (e.g. directory instead of file), you get the behavior above.

---

## 3. Persistence Check: docker-compose and mock-api

### 3.1 docker-compose.yml

- **PostgreSQL:** Uses a **named volume** `postgres_data` → data survives down/up and rebuild.
- **mock-api:** Uses **bind mounts** to host paths under `./apps/mock-api/`:
  - `data.json`, `orders.json`, `market-config.json`, `push-subscriptions.json`, `uploads/`
- There is **no** `db.json`; the JSON driver uses `data.json` (and the other files above).

So: **no** PostgreSQL volume is needed for the Mock API when using JSON; for JSON, persistence is entirely via these bind-mounted files. For Postgres, the DB data is in `postgres_data`.

### 3.2 mock-api behavior

- **store.ts** reads from `DATA_FILE` and `ORDERS_FILE` (and the app uses `MARKET_CONFIG_FILE`, `PUSH_SUBSCRIPTIONS_FILE`). Writes go to the same paths.
- **Startup (index.ts):** If `STORAGE_DRIVER=json` and `DATA_FILE` exists and already has users/tenants, **no** seed overwrite (zero data loss on restart/build). If the path is a directory or unreadable, the code treats it as “no valid data” and uses in-memory defaults; it does not create the file.

So the weak point is **first run** (or any run where the host file is missing): Docker creates a directory, and the app never gets a valid file to read/write.

---

## 4. Emergency Fix: Ensure Data Files Exist (No Breaking Changes)

Goal: Even when the host does not have the JSON files yet (or they were wrongly created as directories), the container should **create proper JSON files** so that persistence works and data survives rebuild.

### 4.1 Change made: docker-entrypoint.sh

The entrypoint is updated to:

1. Ensure `/app/data` exists.
2. For each of `data.json`, `orders.json`, `market-config.json`, `push-subscriptions.json`:
   - If the path is a **directory** (Docker created it because the host file was missing), remove the directory and create a **file** with the correct initial content (`{}` or `[]` for orders).
   - If the path does **not** exist, create the file with that same initial content.

So:

- After rebuild, if the host had “directory instead of file”, the first start will fix it (directory removed, file created on the host via the bind mount).
- New deployments without pre-created files get valid files on first run.
- Existing valid files are **not** overwritten (we only replace directories or create when missing).

No configuration is deleted or reset; we only fix the mount-point shape (file vs directory) and ensure files exist.

### 4.2 Keeping data safe on the server

- **Backups:** Before any manual edit or script that rewrites `data.json` / `orders.json` / `market-config.json`, copy them (e.g. to `backups/` or a timestamped folder). See `apps/mock-api/scripts/README-BACKUP-RULE.md`.
- **Deploy:** Run `docker compose` from the **repo root** so `./apps/mock-api/data.json` and the other paths resolve correctly. Optionally, create empty files once on the host if you prefer not to rely on the entrypoint:

  ```bash
  touch apps/mock-api/data.json apps/mock-api/orders.json apps/mock-api/market-config.json apps/mock-api/push-subscriptions.json
  # Then put valid JSON in each (e.g. {} or [] for orders) if the entrypoint does not run.
  ```

With the entrypoint fix, you don’t have to pre-create files; the container will create them if they’re missing or were directories.

---

## 5. Path to Production: Mock → PostgreSQL

To fully switch from Mock (JSON) to the existing PostgreSQL:

1. **Use DB driver:** Set `STORAGE_DRIVER=db` (and keep `DATABASE_URL` pointing at the `postgres` service). The app already supports this; repos switch to Prisma when the driver is `db`.
2. **Migrations:** Ensure `npx prisma migrate deploy` runs on startup (already in `docker-entrypoint.sh` when `DATABASE_URL` is set).
3. **One-time seed:** Load current tenants/markets/catalog/orders from JSON into Postgres. Options:
   - Use the existing **seed** that reads from `data.json` (and orders) when the DB is empty (e.g. `seedDbFromJsonIfEmpty()` when `STORAGE_DRIVER=db`), or
   - Run a dedicated sync script (e.g. from `apps/mock-api/README-DB-SYNC.md`) with `DATA_FILE` and `ORDERS_FILE` set to your current JSON files.
4. **Optional:** After cutover, keep the JSON files as read-only backup or stop mounting them; the source of truth will be PostgreSQL.

What’s **not** missing in code: the app already has Prisma, migrations, and JSON→DB seed logic. What’s needed for production is: set `STORAGE_DRIVER=db`, ensure migrations and (if needed) one-time seed are run, and point `DATABASE_URL` at your production Postgres.

---

## 6. Short Checklist

| Item | Status |
|------|--------|
| Real DB (PostgreSQL) | Available; used when `STORAGE_DRIVER=db`. |
| Mock API persistence | File-based (`data.json` etc.) when `STORAGE_DRIVER=json`; not in-memory only. |
| Volume mapping | docker-compose bind-mounts `./apps/mock-api/*.json` and `./apps/mock-api/uploads`. |
| Why Caramela disappeared | Most likely: host `data.json` (or others) did not exist → Docker created directories → reads/writes failed → data only in memory → lost on rebuild. |
| Emergency fix | Entrypoint ensures `/app/data/*.json` are **files** with valid initial content (no overwrite of existing files). |
| Path to production (Postgres) | Set `STORAGE_DRIVER=db`, run migrations, one-time seed from JSON; no config deleted. |
