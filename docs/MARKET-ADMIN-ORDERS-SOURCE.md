# Market Admin Orders – Source of Truth (Zombie Orders Trace)

## URL and route

- **URL:** `https://nmd.marketing/market-admin/markets/market-dabburiyya/orders`
- **App:** `apps/nmd-admin`
- **Route:** `markets/:id/orders` → **MarketDetailPage** (tab: orders)
- **API call:** `api.getMarketOrders(marketId)` → `GET /markets/:marketId/orders`

## 1. API call trace

| Layer | File | What happens |
|-------|------|----------------|
| UI | `apps/nmd-admin/src/pages/MarketDetailPage.tsx` | `useQuery` with `queryFn: () => api.getMarketOrders(id!)` |
| Client | `packages/mock/src/mock-api-client.ts` | `getMarketOrders(marketId)` → when `useApi`: `apiFetch('/markets/${marketId}/orders')` |
| Backend | `apps/mock-api/src/index.ts` | `GET /markets/:marketId/orders` (around line 4392) |

So the **only** backend endpoint for market orders is:

**`GET /markets/:marketId/orders`** → implemented in **`apps/mock-api/src/index.ts`**.

## 2. Environment (nmd-admin)

- **Env:** `VITE_MOCK_API_URL` (build-time; no `VITE_API_URL` in this app).
- **Production build:** Set in Dockerfile/CI (e.g. `VITE_PUBLIC_ORIGIN` / `VITE_MOCK_API_URL=https://nmd.marketing/api`).
- **Conclusion:** Market Admin uses the **same** mock-api as merchant admin (same origin, e.g. `https://nmd.marketing/api`). There is no separate backend or port for “Market Admin”.

## 3. Where backend gets orders (single source)

There is **no** separate market orders store:

- **No** `MarketOrder` table.
- **No** `data/markets/dabburiyya/orders.json` or similar.
- **No** `marketOrdersCache` or other in-memory cache for “market” orders.

Implementation in **`apps/mock-api/src/index.ts`** (GET `/markets/:marketId/orders`):

```ts
const tenantIds = await getMarketTenantIds(marketId);
const orders = ((await repos.orders.findAll()) as { tenantId?: string }[])
  .filter((o) => o.tenantId && tenantIds.has(o.tenantId));
// ... enrich, then res.json(orders)
```

So market orders are:

- **Same** `repos.orders` as everywhere else.
- **Same** storage as merchant admin (one of the two below).

## 4. Storage mode (single STORAGE_DRIVER)

- **`STORAGE_DRIVER=db`**  
  - **Table:** PostgreSQL **`Order`** (Prisma model `Order`).  
  - **Repo:** `repos.orders` → `db-repos.ts` → `prisma.order.findMany()`.  
  - No file, no per-market table.

- **`STORAGE_DRIVER=json`**  
  - **File:** `ORDERS_FILE` (e.g. `/app/data/orders.json` in Docker, or `apps/mock-api/orders.json` on host).  
  - **In-memory:** `store.ts` → `getOrders()` uses **`ordersCache`**; first call loads from file, then serves from cache until process restarts or cache is cleared.

There is **no** different storage or schema for “Market Admin” vs “Global Admin”; both use the same `repos.orders` and thus the same DB table or same JSON file + cache.

## 5. What can still show “zombie” orders

After clearing the main DB and deleting `orders.json`:

| Cause | What to do |
|-------|------------|
| **JSON mode + process not restarted** | In-memory **`ordersCache`** in **`apps/mock-api/src/store.ts`** still holds the old array. **Restart the mock-api process** so the next request uses a new process and reloads from disk (empty file → `[]`). |
| **DB mode + different DB** | Emergency script ran against a different `DATABASE_URL` than the one the running mock-api uses (e.g. different host or DB name). Run the cleanup script with the **same** `DATABASE_URL` the app uses, or confirm in the app env. |
| **Browser or CDN cache** | Browser or proxy caching `GET /markets/market-dabburiyya/orders`. Hard refresh (Ctrl+Shift+R), or test in incognito, or add cache-busting query (e.g. `?t=123`). |
| **Multiple instances** | Several mock-api replicas; only one was cleared or restarted. Clear/restart **all** instances, or ensure they share the same DB and, in JSON mode, the same file and no long-lived in-memory cache. |

## 6. Exact “zombie” sources (by mode)

- **If `STORAGE_DRIVER=db`:**  
  Rows are coming from the **PostgreSQL table `Order`** that the **running** mock-api’s `DATABASE_URL` points to. That is the only place. Re-run the emergency cleanup against that same DB and confirm no other replica is still running against an old DB.

- **If `STORAGE_DRIVER=json`:**  
  Rows are coming from either:  
  1. The file at **`ORDERS_FILE`** (e.g. `./apps/mock-api/orders.json` or `/app/data/orders.json` in the container), or  
  2. The in-memory **`ordersCache`** in **`apps/mock-api/src/store.ts`** if the process was not restarted after deleting the file.  
  So the “zombie” source is either that file or that in-process cache.

## 7. Quick checks

1. **Confirm storage mode:** In the environment of the running mock-api, check `STORAGE_DRIVER` (e.g. in Docker: `STORAGE_DRIVER=db` or `json`).
2. **DB:** If DB mode, run `SELECT COUNT(*) FROM "Order";` on the **exact** DB the app uses; it should be 0 after cleanup.
3. **JSON file:** If JSON mode, ensure `ORDERS_FILE` (and host path that mounts into the container) is deleted or overwritten with `[]`, then **restart mock-api** so `ordersCache` is dropped.
4. **No extra tables/files:** There is no other table or file providing market orders; the only source is the one above for the active `STORAGE_DRIVER`.
