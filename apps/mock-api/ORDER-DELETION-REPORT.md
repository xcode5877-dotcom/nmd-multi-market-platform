# Order Deletion Report

Audit of every code path that can delete or wipe Order data. Generated as part of order append-only protection (2026-06-10).

**Blocked at API runtime:** `prisma.order.deleteMany()` and `repos.orders.setAll()` — both log `[ORDER_PROTECTION_BLOCKED]` and throw.

---

## 1. Runtime API (protected)

| Location | Operation | Status |
|----------|-----------|--------|
| `src/repos/db-repos.ts` — `createDbOrdersRepo` | ~~`setAll` → `deleteMany` + recreate~~ | **Removed** — replaced with `create` / `update` / `upsert` / `updateMany` |
| `src/index.ts` — courier cascade delete | ~~`prisma.order.deleteMany({ courierId })`~~ | **Replaced** with `repos.orders.deleteByCourierId()` (one `delete` per row) |
| `src/index.ts` — tenant deep-delete | ~~`repos.orders.setAll(filtered)`~~ | **Replaced** with `repos.orders.deleteByTenantId()` (one `delete` per row) |
| `src/index.ts` — `DELETE /orders/:orderId/hard-delete` | `repos.orders.deleteById()` → `prisma.order.delete` | **Still active** — single-order hard delete (SUPER_ADMIN / scoped admins) |
| `src/repos/db-repos.ts` — `deleteByTenantId` | Loop `prisma.order.delete` per tenant order | **Still active** — used by tenant delete |
| `src/repos/db-repos.ts` — `deleteByCourierId` | Loop `prisma.order.delete` per courier order | **Still active** — used by courier cascade delete |
| `src/repos/json-repos.ts` — `deleteById` / `deleteByTenantId` / `deleteByCourierId` | Filter array + `setOrders()` | **Still active** — JSON fallback driver only |

---

## 2. Direct Prisma bypass (API)

| Location | Operation | Notes |
|----------|-----------|-------|
| `src/index.ts` — `POST /courier/external-orders` | `prisma.order.create` | Create only — no delete |
| `src/index.ts` — various reads | `prisma.order.findMany` / `findUnique` | Read-only |

No remaining `prisma.order.deleteMany` in `src/` after protection.

---

## 3. Maintenance scripts (outside API startup guard)

These scripts instantiate their own `PrismaClient` **without** `installOrderPrismaProtection`. They can still call `deleteMany` if run manually.

| Script | Operation |
|--------|-----------|
| `scripts/db-cleanup-orders-and-drivers.ts` | `prisma.order.deleteMany({})` — wipes all orders |
| `scripts/force-delete-all-orders-emergency.ts` | `prisma.payment.deleteMany({})` then `prisma.order.deleteMany({})` |
| `scripts/delete-default-stores-db.ts` | `prisma.order.deleteMany({ where: { id: { in: orderIds } } })` per tenant |
| `prisma/seed.ts` | `prisma.order.deleteMany()` before re-seeding |

**Recommendation:** Run maintenance scripts only with explicit operator intent; consider importing `prisma` from `src/db.js` so the guard applies there too.

---

## 4. JSON / client-side storage

| Location | Operation | Notes |
|----------|-----------|-------|
| `src/store.ts` — `setOrders()` | Replaces entire `orders.json` cache | No longer called for full-table wipe via repo; still used for per-order upserts in JSON mode |
| `packages/mock/src/orders-store.ts` | `localStorage` append (`addOrder`) | Client mock only; no server delete |

---

## 5. Cascades (related tables)

| Location | Operation | Effect on orders |
|----------|-----------|------------------|
| `Payment` model (`schema.prisma`) | `onDelete: Cascade` from `Order` | Deleting an order deletes its payment row |
| `src/index.ts` — tenant delete | `repos.payments.deleteForOrderIds` | Deletes payment rows before order rows |
| `src/repos/db-repos.ts` — `PaymentsRepo.deleteForOrderIds` | `prisma.payment.deleteMany` | Does **not** delete orders |

---

## 6. Audit logging (new)

Order mutations through `repos.orders` now emit:

```
[ORDER_AUDIT] Order created|updated|restored { id, tenantId, status, timestamp }
```

| Action | Trigger |
|--------|---------|
| `created` | `create`, `addOrderWithPayment`, `upsert` (new id) |
| `updated` | `update`, `upsert` (existing id), `updateMany`, `unassignCourier` |
| `restored` | `restore` (e.g. loyalty-force-award recovery path) |

In-memory trail: `getOrderAuditLog()` in `src/order-protection.ts`.

---

## 7. Summary

| Category | Count | Risk |
|----------|-------|------|
| Bulk wipe (`deleteMany` / `setAll`) in API | **0** (blocked) | Eliminated |
| Single-order delete (`deleteById`) | 1 endpoint | Intentional hard-delete |
| Bulk delete via loops (`deleteByTenantId`, `deleteByCourierId`) | 2 repo methods | Per-row delete, not wipe-all |
| Emergency scripts | 4 files | Outside runtime guard |
