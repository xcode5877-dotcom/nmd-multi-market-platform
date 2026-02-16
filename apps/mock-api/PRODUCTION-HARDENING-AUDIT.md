# Production Hardening Audit — mock-api

**Date:** 2026-02-16  
**Scope:** DB-backed endpoints, cascading deletes, N+1 queries, SSE robustness, seed completeness  
**Constraint:** Inspection only — no behavior changes

---

## 1. Risk List

### High

| ID | Risk | Location | Impact |
|----|------|----------|--------|
| H1 | **No global error handler** | `index.ts` | Unhandled async rejections (DB errors, Prisma failures) can crash the process or leave requests hanging with no response. |
| H2 | **DB-backed endpoints lack try/catch** | catalog, delivery, delivery-zones, orders, payments, finance | Any repo/Prisma error propagates uncaught → unhandled rejection. |
| H3 | **POST /orders: createForOrder can throw** | `index.ts` ~1245 | If `createForOrder` throws (e.g. order not found, DB error), no try/catch → unhandled rejection. Order may be persisted but Payment not created → inconsistent state. |

### Medium

| ID | Risk | Location | Impact |
|----|------|----------|--------|
| M1 | **Tenant delete not implemented; no cascade for Catalog/Delivery/Zones** | Schema, API | Catalog, Delivery, DeliveryZone, TenantDeliverySettings have `tenantId` but no FK to Tenant. If Tenant delete is added later, orphan rows will remain. |
| M2 | **orders.setAll uses deleteMany** | `db-repos.ts` | Replaces entire order set on every write. Under load, concurrent POST /orders could cause race conditions. |

### Low

| ID | Risk | Location | Impact |
|----|------|----------|--------|
| L1 | **No Order DELETE endpoint** | API | Order→Payment cascade is defined but never exercised. Low impact if orders are never deleted. |
| L2 | **Tenants without delivery in data.json** | Seed | Tenants not in `data.delivery` get defaults at runtime via `getSettings`. Seed only creates rows for tenants in `data.delivery`. Current data: all 6 tenants have delivery. |

---

## 2. Cascading Deletes

| Relation | Schema | Status |
|----------|--------|--------|
| Order → Payment | `Payment.order` has `onDelete: Cascade` | ✅ Correct |
| Tenant → Catalog | No FK; `tenantId` only | ⚠️ No cascade |
| Tenant → Delivery | No FK; `TenantDeliverySettings.tenantId` is @id | ⚠️ No cascade |
| Tenant → DeliveryZone | No FK; `tenantId` only | ⚠️ No cascade |

**Note:** There is no `DELETE /tenants/:id` endpoint. Tenant deletion is not implemented.

---

## 3. N+1 Queries

| Endpoint | Queries | Result |
|----------|---------|--------|
| GET /catalog/:tenantId | 3 parallel (categories, products, optionGroups) | ✅ No N+1 |
| GET /markets/:marketId/orders | 2 (tenants.findAll + orders.findAll) | ✅ No N+1 |
| GET /markets/:marketId/finance/* | 1 orders.findAll + in-memory filter | ✅ No N+1 |

---

## 4. SSE Robustness

| Scenario | Handling |
|----------|----------|
| Invalid token | `requireCourier` returns null before SSE setup → 403, no listener registered |
| Courier disconnects | `req.on('close')` removes listener |
| Order reassigned | `emitCourierUnassigned` → `send()` has try/catch; on write error, listener removed |
| Write to disconnected client | `res.write` in try/catch; listener deleted on throw |

**Verdict:** SSE does not crash the server in these cases.

---

## 5. Seed Completeness

| Check | Result |
|-------|--------|
| All tenants have delivery settings | ✅ `data.delivery` keys match all 6 tenants in `data.tenants` |
| All orders have Payment rows | ✅ Seed runs payment backfill for all orders after order seed |
| Delivery zones | ✅ Seeded per tenant from `data.deliveryZones` |

---

## 6. Recommended Minimal Fixes

1. **Add global error handler** (High)
   ```ts
   app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
     console.error(err);
     res.status(500).json({ error: 'Internal server error' });
   });
   ```

2. **Wrap async route handlers** (High)  
   Use `wrapAsync` or equivalent so `next(err)` is called on rejection:
   ```ts
   const wrapAsync = (fn: express.RequestHandler) => (req: express.Request, res: express.Response, next: express.NextFunction) =>
     Promise.resolve(fn(req, res, next)).catch(next);
   ```
   Apply to DB-backed routes (catalog, delivery, delivery-zones, orders, finance).

3. **Try/catch around POST /orders payment creation** (High)
   ```ts
   try {
     await repos.payments.createForOrder(orderId, { ... });
   } catch (e) {
     // Rollback or retry; at minimum return 500 with safe message
     return res.status(500).json({ error: 'Failed to create payment record' });
   }
   ```

4. **Document Tenant delete behavior** (Medium)  
   If Tenant delete is added, implement manual cleanup of Catalog, Delivery, DeliveryZone, TenantDeliverySettings by `tenantId` before deleting Tenant.

---

## 7. Go-Live Readiness

**Verdict: Not Go-Live ready** without addressing High risks.

| Criterion | Status |
|-----------|--------|
| Error handling | ❌ No global handler; DB errors can crash process |
| Safe error responses | ❌ Unhandled rejections → no controlled 500 |
| Data integrity | ⚠️ POST /orders can leave Order without Payment on createForOrder failure |
| SSE stability | ✅ Adequate |
| Seed completeness | ✅ Adequate |
| N+1 | ✅ None found |

**Minimum for Go-Live:** Implement H1 (global error handler) and H3 (try/catch around createForOrder, or wrapAsync for all DB routes). M1 is acceptable if Tenant delete is not planned.
