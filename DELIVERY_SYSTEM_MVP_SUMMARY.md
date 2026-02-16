# Delivery System MVP - Implementation Summary & Test Plan

## 1) Files Modified/Created

### Created
- `apps/mock-api/src/delivery-engine.ts` - Rules engine (readiness, eligibility, batching, fallback)
- `apps/nmd-admin/src/pages/MarketDispatchPage.tsx` - Market dispatch UI (Queue, Couriers, Jobs)
- `apps/nmd-admin/src/pages/TenantDeliverySettingsPage.tsx` - Tenant delivery settings form

### Modified
- `apps/mock-api/src/store.ts` - Added Courier, DeliveryJob types; tenantType, deliveryProviderMode, allowMarketCourierFallback, defaultPrepTimeMin; getCouriers, setCouriers, getDeliveryJobs, setDeliveryJobs
- `apps/mock-api/src/index.ts` - New endpoints: PATCH tenant delivery settings, POST order ready, market/tenant couriers, dispatch queue, delivery jobs
- `packages/mock/src/mock-api-client.ts` - New API methods for delivery system
- `apps/nmd-admin/src/App.tsx` - Routes for dispatch, tenant delivery settings
- `apps/nmd-admin/src/pages/MarketDetailPage.tsx` - Dispatch tab (hidden from TENANT_ADMIN)
- `apps/nmd-admin/src/pages/TenantDetailPage.tsx` - Orders tab with READY button, delivery settings link
- `apps/nmd-admin/src/tenant-portal/layouts/TenantLayout.tsx` - Nav with settings/delivery link
- `apps/nmd-admin/src/tenant-portal/pages/TenantOrdersPage.tsx` - Full orders list with READY button, countdown, fallback indicator

---

## 2) Data Model Changes

### Tenant (extended)
```json
{
  "tenantType": "RESTAURANT",
  "deliveryProviderMode": "TENANT",
  "allowMarketCourierFallback": true,
  "defaultPrepTimeMin": 30
}
```
- **tenantType**: `RESTAURANT` | `SHOP` | `SERVICE` (default: RESTAURANT for FOOD, SHOP otherwise)
- **deliveryProviderMode**: `TENANT` | `MARKET` | `PICKUP_ONLY` (default: TENANT)
- **allowMarketCourierFallback**: boolean (default: true)
- **defaultPrepTimeMin**: number (default: 30 for RESTAURANT)

### Order (extended)
```json
{
  "status": "PREPARING",
  "prepTimeMin": 30,
  "readyAt": "2026-02-15T14:30:00.000Z",
  "deliveryAssignmentMode": "TENANT",
  "fallbackTriggeredAt": null
}
```
- **status**: `NEW` | `PREPARING` | `READY` | `OUT_FOR_DELIVERY` | `DELIVERED` | `CANCELED`
- **prepTimeMin**: optional override
- **readyAt**: computed for RESTAURANT (createdAt + prepTimeMin) or set on READY
- **deliveryAssignmentMode**: `TENANT` | `MARKET`
- **fallbackTriggeredAt**: set when fallback TENANT→MARKET triggers

### Courier (new)
```json
{
  "id": "courier-xxx",
  "scopeType": "MARKET",
  "scopeId": "market-dabburiyya",
  "name": "أحمد",
  "phone": "0501234567",
  "isActive": true,
  "isOnline": false,
  "capacity": 3
}
```

### DeliveryJob (new)
```json
{
  "id": "job-xxx",
  "marketId": "market-dabburiyya",
  "courierId": "courier-xxx",
  "status": "ASSIGNED",
  "items": [
    { "orderId": "ord-1", "tenantId": "t-1" },
    { "orderId": "ord-2", "tenantId": "t-1" }
  ],
  "createdAt": "2026-02-15T14:00:00.000Z"
}
```
- **status**: `NEW` | `ASSIGNED` | `PICKING` | `DELIVERING` | `DONE` | `CANCELED`

---

## 3) API Endpoints Added

| Method | Path | Scope | Description |
|--------|------|-------|-------------|
| PATCH | `/tenants/:tenantId/settings/delivery` | TENANT_ADMIN own; MARKET_ADMIN in market; ROOT_ADMIN emergency | Update tenantType, deliveryProviderMode, allowMarketCourierFallback, defaultPrepTimeMin |
| POST | `/tenants/:tenantId/orders/:orderId/ready` | TENANT_ADMIN own; MARKET_ADMIN in market; ROOT_ADMIN emergency | Set status=READY, readyAt=now |
| GET | `/markets/:marketId/couriers` | MARKET_ADMIN own; ROOT_ADMIN | List market couriers |
| POST | `/markets/:marketId/couriers` | MARKET_ADMIN own; ROOT_ADMIN emergency | Create market courier |
| PATCH | `/markets/:marketId/couriers/:courierId` | MARKET_ADMIN own; ROOT_ADMIN emergency | Update courier (isOnline, etc.) |
| GET | `/tenants/:tenantId/couriers` | TENANT_ADMIN own; MARKET_ADMIN in market | List tenant couriers |
| POST | `/tenants/:tenantId/couriers` | TENANT_ADMIN own; MARKET_ADMIN in market; ROOT_ADMIN emergency | Create tenant courier |
| PATCH | `/tenants/:tenantId/couriers/:courierId` | Same as POST | Update tenant courier |
| GET | `/markets/:marketId/dispatch/queue` | MARKET_ADMIN own; ROOT_ADMIN (TENANT_ADMIN 403) | Orders eligible for market dispatch (after fallback eval) |
| GET | `/markets/:marketId/delivery-jobs` | MARKET_ADMIN own; ROOT_ADMIN | List delivery jobs |
| POST | `/markets/:marketId/delivery-jobs` | MARKET_ADMIN own; ROOT_ADMIN emergency | Create job with items |
| PATCH | `/markets/:marketId/delivery-jobs/:jobId/assign` | MARKET_ADMIN own; ROOT_ADMIN emergency | Assign courierId, status=ASSIGNED |

### Example: PATCH tenant delivery settings
```bash
curl -X PATCH http://localhost:5190/tenants/78463821-ccb7-48af-841b-84a18c42abb6/settings/delivery \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"tenantType":"RESTAURANT","deliveryProviderMode":"TENANT","allowMarketCourierFallback":true,"defaultPrepTimeMin":25}'
```

### Example: Mark order READY
```bash
curl -X POST http://localhost:5190/tenants/78463821-ccb7-48af-841b-84a18c42abb6/orders/<ORDER_ID>/ready \
  -H "Authorization: Bearer <TOKEN>"
```

### Example: Create delivery job
```bash
curl -X POST http://localhost:5190/markets/market-dabburiyya/delivery-jobs \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"items":[{"orderId":"ord-1","tenantId":"78463821-ccb7-48af-841b-84a18c42abb6"}]}'
```

---

## 4) Rules Engine Details

### Readiness
- **RESTAURANT**: `readyAt = createdAt + (prepTimeMin from order override or tenant.defaultPrepTimeMin)`. Manual override: POST `/ready` sets status=READY, readyAt=now.
- **SHOP/SERVICE**: Eligible immediately (no readyAt required).

### Eligibility (for MARKET dispatch)
- **deliveryAssignmentMode** must be `MARKET`.
- **fulfillmentType** must be `DELIVERY` (not PICKUP).
- **RESTAURANT**: status=READY OR (readyAt - now <= 10 min).
- **SHOP/SERVICE**: status in PREPARING, READY, or NEW.

### Batching
- **RESTAURANT**: Same tenant only. Eligible if both READY OR |readyAt diff| <= 7 min.
- **SHOP/SERVICE**: No restriction.

### Fallback (TENANT → MARKET)
Evaluated when `GET /markets/:marketId/dispatch/queue` is called.
- **SHOP/SERVICE**: If deliveryAssignmentMode=TENANT, allowMarketCourierFallback=true, and not assigned within 5 min → switch to MARKET, set fallbackTriggeredAt.
- **RESTAURANT READY**: Same, 5 min.
- **RESTAURANT near-ready** (≤10 min to readyAt): 7 min.

---

## 5) UI Routes & Role Access Matrix

| Route | ROOT_ADMIN | MARKET_ADMIN | TENANT_ADMIN |
|-------|------------|--------------|--------------|
| `/markets/:id` | ✓ | ✓ own market | ✗ redirect /tenant |
| `/markets/:id/dispatch` | ✓ | ✓ own market | ✗ redirect /tenant |
| `/markets/:id/tenants/:tenantId` | ✓ | ✓ in market | ✗ |
| `/markets/:id/tenants/:tenantId/settings/delivery` | ✓ (emergency) | ✓ in market | ✗ |
| `/tenant` | ✓ | ✓ | ✓ |
| `/tenant/orders` | ✓ | ✓ | ✓ own tenant |
| `/tenant/settings/delivery` | ✓ (emergency) | ✓ | ✓ own tenant |

- **ROOT_ADMIN writes**: Require Emergency Mode + `_meta.emergencyReason` in body.
- **Dispatch tab**: Hidden from TENANT_ADMIN (tab not shown).

---

## 6) Manual Smoke Test Checklist

### A) RESTAURANT order lifecycle
1. **Setup**: Tenant BUFFALO28 (78463821-ccb7-48af-841b-84a18c42abb6) – set tenantType=RESTAURANT, deliveryProviderMode=TENANT, allowMarketCourierFallback=true.
2. **Create order**: Storefront → BUFFALO28 → add item → checkout → DELIVERY → submit. Order created with status=PREPARING, readyAt=createdAt+30min.
3. **Tenant orders**: Login as buffalo@nmd.com → /tenant/orders. See countdown to readyAt. Click "جاهز للاستلام" → status=READY.
4. **Fallback**: Wait 5 min (or mock time). As MARKET_ADMIN, GET /markets/market-dabburiyya/dispatch/queue. Order should appear (fallback triggered).
5. **Create job**: Dispatch tab → Create job → select order → Create.
6. **Assign courier**: Add courier (name, phone) → toggle online → Assign courier to job.

### B) TENANT mode fallback → MARKET
1. Tenant with deliveryProviderMode=TENANT, allowMarketCourierFallback=true.
2. Create DELIVERY order. Leave unassigned.
3. For SHOP: wait 5 min. For RESTAURANT READY: wait 5 min. For RESTAURANT near-ready: wait 7 min.
4. Call GET /markets/:marketId/dispatch/queue. Order should appear with fallbackTriggeredAt set.

### C) 403 checks
1. **MARKET_ADMIN wrong market**: Login dab@nmd.com (market-dabburiyya). GET /markets/market-iksal/dispatch/queue → 403.
2. **TENANT_ADMIN dispatch**: Login buffalo@nmd.com. Navigate to /markets/market-dabburiyya/dispatch → redirect to /tenant.
3. **TENANT_ADMIN wrong tenant**: PATCH /tenants/<other-tenant>/settings/delivery → 403.

### D) ROOT_ADMIN emergency write
1. Login root@nmd.com. Enable Emergency Mode with reason.
2. PATCH /tenants/:id/settings/delivery (or create courier) → 200.
3. Disable Emergency Mode → 403 EMERGENCY_MODE_REQUIRED.

### E) Public endpoints unchanged
- GET /tenants/by-slug/:slug, POST /orders, GET /markets, GET /markets/by-slug/:slug, GET /markets/:marketId/tenants.
- Response shapes unchanged.

---

## 7) Courier App (Future)

- **Entities**: Courier, DeliveryJob already exist. Add `DeliveryOffer` later for courier app: courier sees available jobs, accepts/declines.
- **Routes**: `GET /couriers/:courierId/jobs` (assigned), `POST /couriers/:courierId/jobs/:jobId/accept` (future).
- **Auth**: Courier-specific JWT (e.g. role=COURIER, courierId).
