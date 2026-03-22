# Final Audit: Orders Data Flow (Zombie Orders)

## 1. Seed logic

### Startup (index.ts)

- **`seedDbFromJsonIfEmpty()`** runs on every startup when `STORAGE_DRIVER=db`.
- It **returns immediately** if `markets.length > 0` (line 5247–5252). So if your DB still has Market rows after TRUNCATE Order, **no reseed runs** and orders are not repopulated from file.
- **If** `markets.length === 0` (e.g. full DB reset or new DB), it:
  - Loads from **`loadFromPath(seedPath)`** where `seedPath` is one of: `SEED_JSON_PATH`, `DATA_FILE`, `/data/data.json`, `process.cwd()/data/data.json`, `process.cwd()/data.json`.
  - Then does **`if ((data.orders ?? []).length > 0) await repos.orders.setAll(data.orders)`** (line 5288).

So the **only** way the app re-populates the DB with orders on startup is:

- `STORAGE_DRIVER=db`
- **Market table is empty** (`markets.length === 0`)
- The file at **seedPath** (typically **DATA_FILE** = `/app/data/data.json` in Docker) **contains an `"orders"` key with a non-empty array**.

**Conclusion:** If `data.json` on the host/container has `"orders": [ ... ]`, and the DB ever starts with no markets, those orders are re-seeded into the DB. Remove or empty `orders` in **data.json** and/or stop seeding orders from it (see fix below).

### Standalone seed (prisma/seed.ts)

- Run manually via `pnpm run db:seed` or `npx prisma db seed`. Not run by the app on startup.
- Reads orders from **ORDERS_FILE** (e.g. `orders.json`) and upserts into the DB. Does not read `data.json` for orders.

### docker-entrypoint.sh

- Creates **`/app/data/orders.json`** with initial content **`[]`** only if the file (or directory) does not exist. It does **not** re-populate orders.

---

## 2. repos.orders.findAll()

### DB mode (`STORAGE_DRIVER=db`)

| Location | What it does |
|----------|----------------|
| **apps/mock-api/src/repos/index.ts** | `createRepos()` uses `process.env.STORAGE_DRIVER ?? 'json'`. If `db`, returns `createDbOrdersRepo()`. |
| **apps/mock-api/src/repos/db-repos.ts** | `createDbOrdersRepo().findAll()` → **`prisma.order.findMany()`** → PostgreSQL table **`Order`** (Prisma model name; table name is `"Order"`). |

No other table. No fallback array. Single source: **PostgreSQL `"Order"` table**.

### JSON mode (`STORAGE_DRIVER=json`)

| Location | What it does |
|----------|----------------|
| **apps/mock-api/src/repos/json-repos.ts** | `findAll()` → **`getOrders()`** from store. |
| **apps/mock-api/src/store.ts** | `getOrders()` uses in-memory **`ordersCache`**; if null, calls **`loadOrders()`** which reads **`ORDERS_FILE`**. |
| **ORDERS_FILE** | `process.env.ORDERS_FILE \|\| join(process.cwd(), '..', '..', 'packages', 'mock', 'data', 'orders.json')`. In Docker: **`/app/data/orders.json`** (env **ORDERS_FILE**). |

So in JSON mode the only sources are: **file at ORDERS_FILE** and in-memory **`ordersCache`** (until process restart).

---

## 3. Hardcoded / fallback data

- **No** large hardcoded order arrays in **apps/mock-api/src**.
- **No** “if DB empty return demo orders” branch.
- **seedOrdersIfNeeded()** in index.ts is a **no-op** (“orders start empty”).

---

## 4. GET /markets/:marketId/orders

- Implemented in **apps/mock-api/src/index.ts** (around line 4392).
- Uses **`repos.orders.findAll()`** then filters by **`tenantId in getMarketTenantIds(marketId)`**.
- **Same** `repos.orders` as everywhere else. **No** separate table, file, or cache for “market” orders.

---

## 5. Middleware / interceptors

- **No** MSW or other mocking middleware in apps/mock-api.
- **No** interceptors that return static order data before hitting the DB.

---

## 6. Environment

- **STORAGE_DRIVER:** `process.env.STORAGE_DRIVER ?? 'json'` (repos/index.ts). No hardcoded override to `db` in code. Docker-compose sets **`STORAGE_DRIVER: "${STORAGE_DRIVER:-db}"`**.
- **DATABASE_URL:** Used by Prisma only; read from env. No default in app code.
- **ORDERS_FILE:** `process.env.ORDERS_FILE || join(process.cwd(), '..', '..', 'packages', 'mock', 'data', 'orders.json')`. Docker: **`ORDERS_FILE: "/app/data/orders.json"`**.

---

## Exact source of zombies (most likely)

Given you truncated the Order table, cleared orders.json and data.json, and restarted:

1. **data.json still has `"orders": [ ... ]`**  
   If the file at **DATA_FILE** (e.g. **/app/data/data.json** → host **./apps/mock-api/data.json**) still contains an **`orders`** array (e.g. from backup or partial clear), and the DB ever has **no markets** (e.g. after a full reset or another environment), **seedDbFromJsonIfEmpty()** will run and do **`repos.orders.setAll(data.orders)`**, repopulating the DB from **data.json**.

2. **Different DB or file**  
   The running mock-api might be using a different **DATABASE_URL** (or a different **ORDERS_FILE** in JSON mode) than the one you cleared.

3. **Browser / CDN cache**  
   Cached response for `GET /markets/market-dabburiyya/orders`. Nginx in this repo does **not** cache `/api/`.

---

## Commands to kill zombies forever

1. **Stop seeding orders from data.json (DONE in code)**  
   In **apps/mock-api/src/index.ts**, **seedDbFromJsonIfEmpty()** no longer calls `repos.orders.setAll(data.orders)`. So even if data.json contains `"orders"`, they are never written to the DB on startup.

2. **Strip orders from data.json (host + container)**  
   - Run the script (from repo root):
     ```bash
     DATA_FILE=./apps/mock-api/data.json pnpm exec tsx apps/mock-api/scripts/strip-orders-from-data-json.ts
     ```
   - Or from apps/mock-api: `pnpm exec tsx scripts/strip-orders-from-data-json.ts`
   - Or with jq: `jq 'del(.orders) | .orders = []' apps/mock-api/data.json > apps/mock-api/data.json.tmp && mv apps/mock-api/data.json.tmp apps/mock-api/data.json`
   - In Docker, the container uses **/app/data/data.json** (mounted from host **./apps/mock-api/data.json**). So fixing the host file is enough; then restart the container so it reads the updated file if seed ever runs.

2. **Ensure DB and files are what the app uses**  
   - Inside the **same** container/process that serves nmd.marketing:
     - Confirm **STORAGE_DRIVER** (e.g. `db`).
     - If db: run **`SELECT COUNT(*) FROM "Order";`** against the **same** **DATABASE_URL** the app uses; it should be 0.
     - If json: ensure **ORDERS_FILE** points to the path you cleared (e.g. `/app/data/orders.json`) and restart the process after clearing.

3. **Force empty orders in DB again (if db)**  
   ```bash
   cd apps/mock-api && DATABASE_URL='postgresql://...' pnpm run force-delete-orders
   ```
   Then restart mock-api.

4. **Browser**  
   Hard refresh or test in incognito so the UI is not showing a cached response.

---

## Code change applied

**apps/mock-api/src/index.ts** — In **seedDbFromJsonIfEmpty()**, the line that did `if ((data.orders ?? []).length > 0) await repos.orders.setAll(data.orders as OrderRecord[])` has been removed. Orders are no longer seeded from data.json on startup.
