# Delivery/Ordering Flow Fixes — Summary

## Root Causes

### Bug 1: Success page "المتجر غير موجود"
**Cause:** Checkout navigated to `/order/:orderId/success` instead of `/:tenantSlug/order/:orderId/success`. The route `/:tenantSlug/*` treated `"order"` as `tenantSlug`, so TenantGate tried to load tenant `"order"` and failed.

### Bug 2: Tenant not seeing their orders
**Cause:** `GET /orders?tenantId=xxx` did not enforce TENANT_ADMIN scope. Also, `listOrdersByTenant` used the generic `/orders` endpoint. A dedicated tenant-scoped endpoint was added and the client updated to use it.

### Bug 3: Tenant delivery settings
**Status:** Already implemented. `PATCH /tenants/:tenantId/settings/delivery` allows TENANT_ADMIN for own tenant. `/tenant/settings/delivery` exists in the tenant portal.

### Bug 4: Dispatch queue
**Status:** Already correct. `getDispatchQueue` filters by `deliveryAssignmentMode === 'MARKET'` via `isOrderEligibleForMarketDispatch`. Tenant orders are independent of dispatch.

---

## Files Modified/Created

### Created
| File | Reason |
|------|--------|
| `apps/storefront/src/pages/LegacyOrderSuccessRedirect.tsx` | Handles legacy `/order/:orderId/success` and redirects to home |
| `DELIVERY_ORDERING_FIXES_SUMMARY.md` | This summary |

### Modified
| File | Change |
|------|--------|
| `apps/storefront/src/pages/CheckoutPage.tsx` | Navigate to `/${tenantSlug}/order/${order.id}/success` instead of `/order/${order.id}/success` |
| `apps/storefront/src/pages/OrderSuccessPage.tsx` | Use `tenantSlugFromUrl` from params, fix tenant resolution and error message |
| `apps/storefront/src/App.tsx` | Add route `/order/:orderId/success` → `LegacyOrderSuccessRedirect` |
| `apps/mock-api/src/index.ts` | Enforce TENANT_ADMIN scope on `GET /orders`; add `GET /tenants/:tenantId/orders` |
| `packages/mock/src/mock-api-client.ts` | `listOrdersByTenant` now calls `GET /tenants/:tenantId/orders` |

---

## Endpoints Added/Changed

### New
| Method | Path | Scope | Description |
|--------|------|-------|-------------|
| GET | `/tenants/:tenantId/orders` | TENANT_ADMIN own; MARKET_ADMIN in market; ROOT_ADMIN any | Returns all orders for tenant (independent of deliveryAssignmentMode) |

### Changed
| Method | Path | Change |
|--------|------|--------|
| GET | `/orders` | TENANT_ADMIN: only own tenant; reject if `tenantId` ≠ `user.tenantId` |

### Unchanged (public)
- `GET /tenants/by-slug/:slug` — public
- `POST /orders` — public

---

## UI Routes & Role Access

| Route | ROOT_ADMIN | MARKET_ADMIN | TENANT_ADMIN |
|-------|------------|--------------|--------------|
| `/tenant/orders` | ✓ | ✓ | ✓ own tenant |
| `/tenant/settings/delivery` | ✓ (emergency) | ✓ in market | ✓ own tenant |
| `/markets/:id/dispatch` | ✓ | ✓ own market | ✗ redirect /tenant |

---

## Test Checklist

### 1. Storefront success redirect
- [ ] Go to `http://localhost:5173/buffalo-28/checkout`
- [ ] Place order (DELIVERY or PICKUP)
- [ ] **Expected:** Redirect to `http://localhost:5173/buffalo-28/order/<orderId>/success`
- [ ] **Expected:** Success page shows order ID and WhatsApp button (if configured)

### 2. Legacy URL
- [ ] Go to `http://localhost:5173/order/any-id/success`
- [ ] **Expected:** "تم استلام طلبك. تم تحديث الرابط." and redirect to `/` after 3s

### 3. Tenant orders visibility
- [ ] Place order from storefront (any tenant, e.g. BUFFALO28)
- [ ] Login as buffalo@nmd.com (TENANT_ADMIN)
- [ ] Go to `http://localhost:5176/tenant/orders`
- [ ] **Expected:** New order appears in list (regardless of deliveryAssignmentMode)

### 4. Delivery mode selection
- [ ] Login as buffalo@nmd.com
- [ ] Go to `http://localhost:5176/tenant/settings/delivery`
- [ ] Set deliveryProviderMode to TENANT, allowMarketCourierFallback=true
- [ ] Place order from storefront
- [ ] **Expected:** Order in tenant orders; NOT in market dispatch (until fallback)
- [ ] Set deliveryProviderMode to MARKET
- [ ] Place order
- [ ] **Expected:** Order in tenant orders AND in market dispatch queue

### 5. Security
- [ ] Login as buffalo@nmd.com
- [ ] Call `GET /tenants/<other-tenant-id>/orders` → **Expected:** 403
- [ ] Login as dab@nmd.com (market-dabburiyya)
- [ ] Call `GET /markets/market-iksal/dispatch/queue` → **Expected:** 403
- [ ] Login as root@nmd.com, disable Emergency Mode
- [ ] PATCH tenant settings → **Expected:** 403 EMERGENCY_MODE_REQUIRED

---

## Remaining Risks

1. **Legacy URL:** `/order/:orderId/success` cannot resolve tenant without auth; user is redirected to home. Old bookmarks lose order context.
2. **Orders persistence:** Orders live in `packages/mock/data/orders.json`; mock-api and in-memory stores must stay in sync when both are used.
