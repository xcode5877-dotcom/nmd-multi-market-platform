# Driver (Courier) System Audit — Current Logic & Workflow

**Purpose:** Complete summary of how the Driver/Courier application is implemented before code freeze and Live Database migration.  
**Date:** Technical audit from codebase inspection.

---

## 1. Authentication

### Does the Driver use OtpLoginModal?
**No.** The Driver app uses its **own login flow**, not the storefront `OtpLoginModal`.

- **App:** `apps/courier`
- **Login screen:** `apps/courier/src/pages/LoginPage.tsx`
- **Method:** **Email + password** (البريد الإلكتروني، كلمة المرور)
- **API:** `POST /auth/login` with `{ email, password }` (same admin auth endpoint)
- **Token storage:** `localStorage` key **`courier-access-token`** (separate from `nmd-access-token` and `nmd-customer-token`)

### How is the DRIVER role identified?
- After login, the app calls **`GET /auth/me`**. The backend returns `role`, `marketId`, **`courierId`** from the **users** table.
- **Requirement:** `auth/me` must return **`role === 'COURIER'`** and non-empty **`courierId`** and **`marketId`**. Otherwise the courier app treats the user as invalid and clears the token.
- The app then calls **`GET /courier/me`** to load courier profile and market name. That endpoint uses **`requireCourier(req, res)`**, which checks `req.user.role === 'COURIER'` and `req.user.courierId` / `req.user.marketId`.
- **Backend:** Users with driver access are stored in **`repos.users`** (in `data.json` under `users[]`) with:
  - `role: 'COURIER'`
  - `marketId: <market-uuid>`
  - `courierId: <courier-uuid>` (links to `repos.couriers` / `data.json` `couriers[]`)

**Seed example (mock-api):**
- `ahmed@courier.nmd.com` / `123456` → `role: COURIER`, `marketId: DABBURIYYA_MARKET_ID`, `courierId: 'courier-50971b77-...'`

---

## 2. Order Lifecycle (Status Flow)

Delivery state is driven by **`deliveryStatus`** on the order (and optionally `order.status` for tenant-facing states). The courier app and API use **`deliveryStatus`** for transitions.

### Status transitions (handled in mock-api)

| deliveryStatus  | Allowed courier action | Next deliveryStatus |
|-----------------|------------------------|----------------------|
| `UNASSIGNED`    | — (order not for this courier) | — |
| `ASSIGNED`      | **ACKNOWLEDGE** (“بدء التوصيل”) | `IN_PROGRESS` |
| `IN_PROGRESS`   | **PICKED_UP** (“تم الاستلام”)   | `PICKED_UP` |
| `PICKED_UP`     | **DELIVERED** (“تم التسليم”)    | `DELIVERED` |
| `DELIVERED`     | **FINISH** (“إنهاء”)           | stays `DELIVERED` (order closed) |

- **Where:** `apps/mock-api/src/index.ts`  
  - `VALID_ACTION_FROM_DELIVERY`  
  - **`POST /courier/orders/:orderId/status`** with body `{ action: 'ACKNOWLEDGE' | 'PICKED_UP' | 'DELIVERED' | 'FINISH', notes?: string }`
- **Timeline:** Each action updates `order.deliveryTimeline` (e.g. `acknowledgedAt`, `pickedUpAt`, `deliveredAt`, `closedAt`) and persists via **`repos.orders.setAll(orders)`** (writes to **data.json** `orders[]`).
- **READY_FOR_PICKUP:** This is a **tenant/order status** concept (e.g. order ready at store). The **courier** side uses **ASSIGNED** (order assigned to courier) → **IN_PROGRESS** (courier started) → **PICKED_UP** → **DELIVERED** → **FINISH**.

---

## 3. API Endpoints Used by Drivers (mock-api, port 5190)

| Method + Route | Purpose |
|----------------|--------|
| **POST /auth/login** | Login with email/password; returns `accessToken`. |
| **GET /auth/me** | Returns user id, email, **role**, **marketId**, **courierId** (used to enforce COURIER and load context). |
| **GET /courier/me** | Returns courier profile + market (name, phone, isOnline, isAvailable, market name). |
| **GET /courier/orders** | Returns **only orders where** `fulfillmentType === 'DELIVERY'` **and** `courierId === current courier` **and** `status !== 'CANCELED'`. No “available pool”; only assigned orders. |
| **POST /courier/orders/:orderId/status** | Courier action: `ACKNOWLEDGE` \| `PICKED_UP` \| `DELIVERED` \| `FINISH`. Validates transition by current `deliveryStatus`, updates `deliveryTimeline` and `deliveryStatus`, persists orders (and courier `isAvailable` / `deliveryCount` where applicable). |
| **GET /courier/stats** | Courier’s own performance (points, badges, avg time, on-time rate). |
| **GET /markets/:marketId/leaderboard?period=week** | Leaderboard for the courier’s market. |
| **GET /courier/events** | **SSE** (EventSource). Auth via Bearer or `?token=`. Emits `connected` and **`order_assigned`** / **`order_unassigned`** when dispatch assigns/unassigns an order to this courier. Used to refresh the orders list without polling. |

**Note:** There is **no** driver-facing endpoint to “fetch available orders” or “accept from pool”. Assignment is done from **NMD-Admin** (Market Dispatch): **POST /markets/:marketId/orders/:orderId/assign** with `{ courierId }`.

---

## 4. UI Components (Courier App)

| Route | Component | Description |
|-------|-----------|-------------|
| **/login** | `LoginPage` | Email + password form; calls `login()` then redirects to `/courier`. |
| **/courier** | `CourierDashboard` | Main screen: greeting, link to “طلباتي المعيّنة”, link to “مسار التوصيل”, status (متاح/مشغول), leaderboard, أدائي (stats). |
| **/courier/orders** | `CourierOrdersPage` | **Assigned orders** list. Tabs: “نشط” / “منتهي”. For each order: pickup/dropoff, payment, timeline, and **one allowed action button** (بدء التوصيل / تم الاستلام / تم التسليم / إنهاء). Uses **GET /courier/orders** and **POST /courier/orders/:orderId/status**. Subscribes to **useCourierEvents** (SSE) to invalidate list on assign/unassign. |
| **/courier/route** | `CourierRoutePage` | Simple list of current route orders (same **GET /courier/orders**), filtered by `status !== 'DELIVERED' && status !== 'CANCELED'`, showing order id, customer name, status badge. |

**Flow summary:**
- Driver **does not** see “new available orders” in the app; they see only **orders already assigned to them**.
- New assignments appear when **Market Dispatch** (nmd-admin) assigns an order; the courier app can refresh via **SSE** (`order_assigned`) or refetch.

---

## 5. Step-by-Step Technical Summary

### How a driver sees new orders
1. **Assignment is done in NMD-Admin (Market Dispatch), not in the courier app.**  
   Admin calls **POST /markets/:marketId/orders/:orderId/assign** with `{ courierId }`.  
   Backend sets `order.courierId`, `order.deliveryStatus = 'ASSIGNED'`, `deliveryTimeline.assignedAt`, and persists. It also sets courier `isAvailable: false` and calls **emitCourierAssigned(courierId, order)**.
2. **Courier app** loads orders via **GET /courier/orders** (returns orders where `courierId === scope.courierId`).
3. **SSE** **GET /courier/events** receives `order_assigned` (or `order_unassigned`), and the app invalidates the **courier-orders** query so the list refetches and the new order appears.

### What happens when a driver clicks “Accept” or “Pickup”
- **“بدء التوصيل” (Accept / Start):** Sends **POST /courier/orders/:orderId/status** with `{ action: 'ACKNOWLEDGE' }`.  
  - Backend: from `ASSIGNED` → `IN_PROGRESS`, sets `deliveryTimeline.acknowledgedAt`.  
  - Response: updated order; UI updates.
- **“تم الاستلام” (Pickup):** Same endpoint with `{ action: 'PICKED_UP' }`.  
  - From `IN_PROGRESS` → `PICKED_UP`, sets `deliveryTimeline.pickedUpAt`.
- **“تم التسليم” (Delivered):** `{ action: 'DELIVERED' }`.  
  - From `PICKED_UP` → `DELIVERED`, sets `deliveryTimeline.deliveredAt`, and backend increments courier `deliveryCount` and sets `isAvailable: true`.
- **“إنهاء” (Finish):** `{ action: 'FINISH', notes?: string }`.  
  - Sets `deliveryTimeline.closedAt` and, for CASH, marks payment as `COLLECTED` with `cashLedger.collectedByCourierId`. Order remains `DELIVERED`.

All of the above persist via **repos.orders.setAll(orders)** (and courier updates via **repos.couriers.setAll(couriers)** where applicable).

### How the system handles “Delivery Confirmation”
- **Delivery confirmation** in the app is the **“تم التسليم”** button, which sends **POST /courier/orders/:orderId/status** with **`action: 'DELIVERED'`**.
- Backend:
  - Validates current `deliveryStatus === 'PICKED_UP'`.
  - Sets `order.deliveryStatus = 'DELIVERED'`, `deliveryTimeline.deliveredAt`, and optionally `order.deliveredAt`.
  - Updates courier (e.g. `isAvailable: true`, `deliveryCount += 1`).
  - Persists orders and couriers to storage (e.g. **data.json**).

Optional “إنهاء” (FINISH) then closes the delivery (timeline + cash ledger) without changing `deliveryStatus` again.

### Where driver data is stored (data.json)
- **Users (driver login):** **`data.json` → `users[]`**.  
  Each driver has an entry with `role: 'COURIER'`, `marketId`, **`courierId`** (and `email`, `password` for login).
- **Couriers (profile, availability):** **`data.json` → `couriers[]`**.  
  Fields include: `id`, `scopeType`, `scopeId`, `marketId`, `name`, `phone`, `isActive`, `isOnline`, `isAvailable`, `capacity`, `deliveryCount`.  
  Persisted by **repos.couriers** (e.g. **repos.couriers.setAll**).
- **Orders (assigned, status, timeline):** **`data.json` → `orders[]`**.  
  Each order can have `courierId`, **`deliveryStatus`**, **`deliveryTimeline`** (assignedAt, acknowledgedAt, pickedUpAt, deliveredAt, closedAt).  
  Persisted by **repos.orders.setAll(orders)**.

---

## 6. Confirmation for Backup & Migration

- **Authentication:** Driver uses **email/password** and **POST /auth/login**; role **COURIER** and **courierId** from **users** in **data.json**; token in **courier-access-token**.
- **Order lifecycle:** **deliveryStatus** and **deliveryTimeline** in **orders**; transitions in **POST /courier/orders/:orderId/status**; all persisted to **data.json** (orders + couriers).
- **Driver-facing API:** **GET /courier/me**, **GET /courier/orders**, **POST /courier/orders/:orderId/status**, **GET /courier/stats**, **GET /markets/:marketId/leaderboard**, **GET /courier/events** (SSE).
- **UI:** **Login** (email/password), **Dashboard**, **طلباتي المعيّنة** (assigned orders + actions), **مسار التوصيل** (route list). No OtpLoginModal; no “available orders” screen.

**This logic is fully implemented in the current codebase and persists driver-related data (users, couriers, orders with deliveryStatus/deliveryTimeline) in the mock-api store that writes to data.json. A backup of the repo and data.json will capture the current Driver System behavior for the Live Database migration.**
