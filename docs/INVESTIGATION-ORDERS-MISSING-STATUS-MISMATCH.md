# Investigation: Orders Missing Platform-Wide (Status Mismatch)

**Date:** Check-only investigation, no fixes applied.  
**Scope:** Find where status key mismatch or filtering could cause orders to disappear from Merchant Board and Platform Admin (السوق الكبير).

---

## 1. Status key mismatch: constants vs data

### 1.1 What the code expects (English, uppercase)

| Location | Constant / type | Values |
|----------|-----------------|--------|
| **packages/core** `types/order.ts` | `Order.status` | `'PENDING' \| 'CONFIRMED' \| 'PREPARING' \| 'READY' \| 'COMPLETED' \| 'CANCELLED'` |
| **apps/admin** `OrdersPage.tsx` | `ORDER_STATUSES` | `PENDING`, `CONFIRMED`, `PREPARING`, `READY`, `COMPLETED`, `CANCELLED` |
| **apps/admin** `OrdersBoardPage.tsx` | `ACTIVE_STATUSES` | `PENDING`, `CONFIRMED`, `PREPARING`, `READY` |
| **packages/ui** `InlineBadge.tsx` | `OrderStatus` | Same as core (no `NEW`) |

So the **admin app and core type** use **`PENDING`** (and the set above). There is **no `NEW`** in these constants.

### 1.2 What the data / mock-api use

| Location | Usage |
|----------|--------|
| **apps/mock-api/data/data.json** | In the file, `"orders": []` at line 23309. The same file uses `"status": "NEW"` in the **leads** array (not in orders). So current JSON has **no orders**. Any previous or seed orders may have used a different status. |
| **apps/mock-api/src/delivery-engine.ts** (line 60) | Treats **`NEW`** as an active status: `['PREPARING', 'READY', 'NEW'].includes(order.status ?? '')`. So the **delivery engine** considers **`NEW`** valid. |
| **apps/mock-api** POST `/orders` (lines 2552–2566) | New orders are created with `status = 'PREPARING'` (or `created.status ?? 'PREPARING'`), not `PENDING` or `NEW`. So newly created orders via this endpoint get **PREPARING**. |
| **Prisma schema** `Order.status` | `String?` — no enum; any string can be stored. |

**Conclusion (1):** There is a **naming mismatch**: the app and core use **PENDING**; the delivery engine and possibly old/seed data use **NEW**. The core/Order type does **not** include `NEW`. If orders were ever stored with `status: "NEW"` (or `"جديد"` / `"pending"`), they are still **valid data** but the UI flow is built only for `PENDING` / `CONFIRMED` / etc.

---

## 2. Global filtering in data-fetching

### 2.1 Merchant admin (apps/admin)

- **OrdersPage:**  
  - Data: `useQuery(['orders', tenantId, ...], () => api.listOrdersByTenant(tenantId, listOptions))` or local `listOrdersByTenant(tenantId)`.  
  - No filter by status before setting state. Only later: `if (statusFilter) orders = orders.filter((o) => o.status === statusFilter)`. So with no filter selected, **all** orders are shown regardless of status string.

- **OrdersBoardPage:**  
  - Data: `useQuery(['orders-board', tenantId], () => api.listOrdersByTenant(tenantId) or listOrdersByTenant(tenantId))`.  
  - No status filter in the query. Filtering happens only in the derived list: `activeOrders = (allOrders ?? []).filter((o) => o.status !== 'COMPLETED' && o.status !== 'CANCELLED')`.  
  - So **no global filter** that drops orders before they reach the page; only exclusion of COMPLETED and CANCELLED for the board.

### 2.2 Platform admin (apps/nmd-admin)

- **MarketDetailPage** (market orders tab):  
  - Data: `useQuery(['market-orders', id], () => api.getMarketOrders(id))`.  
  - Renders `ordersAndLeads` which is `marketOrders` (from API) plus leads. **No filter by order status.**

- **TenantDetailPage** (tenant orders):  
  - Data: `useQuery(['orders', id], ...)` then `orders = (USE_API ? ordersFromApi : listOrdersByTenant(tenant.id)).sort(...).slice(0, 20)`.  
  - **No filter by status**; only sort and slice.

### 2.3 Mock-api (GET list endpoints)

- **GET /tenants/:tenantId/orders** (lines 2505–2522):  
  - Filters only by `tenantId`, optional date range (`from`/`to`), and optional `search`.  
  - **No filter by status.** All orders for the tenant are returned.

- **GET /markets/:marketId/orders** (lines 3351–3362):  
  - Filters only by `tenantId in market`.  
  - **No filter by status.** All orders for the market are returned.

**Conclusion (2):** There is **no global filter** in the data-fetching layer (admin, nmd-admin, or mock-api list endpoints) that removes orders based on status. Orders are not dropped before they reach the pages.

---

## 3. The `activeOrders` logic (OrdersBoardPage)

```ts
const activeOrders = (allOrders ?? []).filter(
  (o) => o.status !== 'COMPLETED' && o.status !== 'CANCELLED'
).sort(...);
```

- Orders are **excluded** only when `status === 'COMPLETED'` or `status === 'CANCELLED'`.
- So:
  - `status === 'NEW'` → **included** (NEW !== COMPLETED and NEW !== CANCELLED).
  - `status === 'جديد'` or `'pending'` or `null`/`undefined` → **included** (same reason).
- **Conclusion (3):** This logic **does not** hide orders with `NEW`, `null`, `undefined`, or Arabic/lowercase status. They would still appear on the board. The only way the board is empty is if `allOrders` is empty (e.g. no orders in the data source).

---

## 4. Translation / label logic (getStatusLabel, InlineBadge)

- **packages/ui** `InlineBadge.tsx`:  
  - `STATUS_LABELS[status as OrderStatus] ?? status`.  
  - If `status` is `'NEW'` or `'جديد'`, there is no key in `STATUS_LABELS`, so the label is the **raw** `status`. The component still **renders**; it does not drop the order.

- **apps/admin** `OrdersPage.tsx`:  
  - `StatusPill` and `STATUS_LABELS` are used only for **display**. No branch removes or filters orders based on label lookup.

**Conclusion (4):** Label/translation logic **does not** cause orders to be dropped from the UI. Unknown statuses are shown as the raw value.

---

## 5. Where the mismatch actually is

| Aspect | Finding |
|--------|--------|
| **Status in data** | Current **data.json** has `"orders": []`. So with this file, **no orders** exist at all — nothing to show. If another source (e.g. DB seed or older JSON) had orders with `status: "NEW"` (or `"جديد"` / `"pending"`), those would **not** be filtered out by the code paths above; they would appear in lists and on the board. |
| **NEW vs PENDING** | **delivery-engine** and possibly legacy/seed data use **NEW**. **Core type** and **admin constants** use **PENDING** and do not define **NEW**. So: (a) Orders with status **NEW** would still **show** in lists and board; (b) But **getNextOrderAction('NEW')** and **getBoardAction('NEW')** return **null** (default/unknown case), so those orders would have **no action button** (e.g. no “بدء التحضير”). |
| **CANCELED vs CANCELLED** | mock-api uses **CANCELED** (one L) in delivery and dispatch; admin uses **CANCELLED** (two L). For **activeOrders** we only exclude `'CANCELLED'`, so an order with `'CANCELED'` would still be **included** on the board. No hiding from this. |

---

## 6. Summary: why orders might be “missing”

1. **Empty data:** In **apps/mock-api/data/data.json**, **`"orders": []`**. So with this file, there are simply **no orders** to show anywhere (Merchant or Platform Admin). This alone explains “الطلبات اختفت” if this is the data source in use.

2. **Status key mismatch (when orders do exist):**  
   - Data/engine may use **NEW** (or Arabic/lowercase); UI flow expects **PENDING**, **PREPARING**, etc.  
   - Such orders are **not** removed by any of the checked filters; they would still appear in the list and on the board.  
   - The only effect is **UX**: no “next step” button for status **NEW** (or unknown), because `getNextOrderAction` / `getBoardAction` only handle the known English uppercase set.

3. **No evidence found** that:  
   - A global hook or useMemo filters out orders by status before they reach the pages.  
   - `activeOrders` excludes `NEW` or null/undefined.  
   - `getStatusLabel` / InlineBadge causes orders to be dropped from rendering.

**Exact locations referenced:**

- Status constants / flow: **apps/admin/src/pages/OrdersPage.tsx** (ORDER_STATUSES, getNextOrderAction), **apps/admin/src/pages/OrdersBoardPage.tsx** (ACTIVE_STATUSES, getBoardAction, activeOrders filter).  
- Types: **packages/core/src/types/order.ts** (Order.status).  
- Delivery engine: **apps/mock-api/src/delivery-engine.ts** (line 60, NEW in active list).  
- Data: **apps/mock-api/data/data.json** (line 23309, `"orders": []`).  
- API list endpoints: **apps/mock-api/src/index.ts** (GET tenants/:tenantId/orders, GET markets/:marketId/orders — no status filter).  
- Badge/labels: **packages/ui/src/InlineBadge.tsx** (STATUS_LABELS, fallback to raw status).

No code changes were applied; this is a check-only report.
