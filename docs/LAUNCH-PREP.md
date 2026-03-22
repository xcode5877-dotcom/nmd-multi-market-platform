# Prepare System for Live Launch (No Data Deletion)

This checklist optimizes the system for production launch **without deleting or modifying any Users, Products, Tenants, Images, or Settings**.

## 1. Clear All Caches

- **Application / build caches:** Vite (`.vite`, `.cache` inside `node_modules`), `dist` folders, `.turbo`.
- **Run:** From repo root:
  ```bash
  pnpm run prepare:launch
  ```
  This script clears the caches above, then runs a full production build.

- **In-memory caches:** The mock-api uses in-memory caches for `data.json` and `market-config` when using JSON storage. Restarting the API process clears them. When using `STORAGE_DRIVER=db`, data is read from PostgreSQL (no app-level cache to clear for content).

- **Redis:** This project does not use Redis. If you add it later, run `FLUSHDB` or restart Redis before launch only if your runbook allows it.

## 2. Optimize Database

- **Safe optimization:** Update PostgreSQL statistics so the planner performs well under load (no data or schema change):
  ```bash
  cd apps/mock-api && DATABASE_URL=postgresql://... pnpm run db:analyze
  ```
  Or use stdin: `echo "ANALYZE;" | pnpm exec prisma db execute --stdin`

- **Indexing:** The Prisma schema already defines indexes on high-traffic fields (e.g. `Order`, `Tenant`, `CatalogProduct`). Do **not** run `prisma db push` or migrations that alter schema immediately before launch unless required; they can lock tables.

## 3. Clear Logs

- **App logs:** The mock-api and frontends log to stdout/stderr (no file logging by default). Restarting the processes starts fresh logs. If you use file-based logging (e.g. into `./logs`), truncate before launch:
  ```bash
  truncate -s 0 ./logs/*.log
  ```
  The `prepare:launch` script creates a `./logs` directory if missing and truncates any `*.log` files inside it.

## 4. Production Readiness

- **NODE_ENV:** The launch script sets `NODE_ENV=production` for the build. In Docker, ensure the API and Node apps run with `NODE_ENV=production` (e.g. in `docker-compose` or `Dockerfile`).

- **Assets:** `pnpm run build` (and thus `prepare:launch`) produces minified bundles for all apps (Vite/tsup). No extra step needed for minification.

- **Docker:** Rebuild images so they include the latest built assets:
  ```bash
  docker compose build --no-cache web-gateway mock-api
  ```

## 5. Final Connectivity Check

- **Backend ↔ Database:** From `apps/mock-api`:
  ```bash
  DATABASE_URL=postgresql://nmd:nmd@localhost:5433/nmd API_BASE_URL=https://nmd.marketing/api pnpm run connectivity-check
  ```
- **Frontend → Backend:** Confirm the API base URL used by each frontend (e.g. `VITE_MOCK_API_URL` / `VITE_API_BASE_URL`) points to the live API and that `GET /api/health` returns `{ "ok": true }`.

## Quick One-Command Prep (from repo root)

```bash
export NODE_ENV=production
export API_BASE_URL=https://nmd.marketing/api   # optional, for health check at end
export DATABASE_URL=postgresql://...            # optional, for DB ANALYZE and connectivity
pnpm run prepare:launch
```

Then run the connectivity check from `apps/mock-api` with the same env vars if you want to verify API + DB.
