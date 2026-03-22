# Pre-Maps Backup — نقطة الاستعادة قبل إضافة الخرائط

**Date:** 2025-03-06  
**Git commit:** `aa7ee237` (run `git rev-parse backup/pre-maps-2025-03-06` to confirm)  
**Tag:** `backup/pre-maps-2025-03-06`  
**Branch:** `backup/pre-maps-2025-03-06`  
**Archive:** `backups/pre-maps-2025-03-06/source-snapshot.tar.gz`

## استعادة الحالة (Restore)

```bash
# Option A: Checkout the backup branch
git checkout backup/pre-maps-2025-03-06

# Option B: Reset current branch to checkpoint
git reset --hard backup/pre-maps-2025-03-06

# Option C: Extract source snapshot (no git)
tar xzf backups/pre-maps-2025-03-06/source-snapshot.tar.gz -C /path/to/restore
```

---

## Integrity Check — الميزات المحفوظة

| Feature | Location | Status |
|--------|----------|--------|
| **Sticky Checkout bar** | `apps/storefront/src/pages/CheckoutPage.tsx` — `fixed bottom-0` bar (mobile) | ✅ Preserved |
| **CartBar fixed bottom** | `apps/storefront/src/components/CartBar.tsx` — `fixed bottom-0`, `--cart-bar-height` | ✅ Preserved |
| **Merchant–Courier Handover** | `apps/admin/OrdersBoardPage.tsx` — handed-to-driver, blue pulse, driver coming | ✅ Preserved |
| **Handover API** | `apps/mock-api/src/index.ts` — POST handed-to-driver, PICKED_UP requires handedToDriverAt | ✅ Preserved |
| **Courier sync** | `apps/courier/CourierOrdersPage.tsx` — Navigate to Store, preparation status, Start Delivery only after handed | ✅ Preserved |
| **Pickup-only flow** | Checkout: fulfillmentType PICKUP/DELIVERY, delivery zones, pickup mode | ✅ Preserved |
| **Floating Order Tracking** | `OrderTrackingFloating.tsx`, `OrderTrackingSheet.tsx`, `OrderTrackingWidget.tsx` — position above CartBar | ✅ Preserved |
| **Identity / Customer auth** | Storefront auth modal, checkout auth gate | ✅ Preserved |

No map-related code was present at checkpoint. After this backup, the following was added (geo + maps):

- **Data model:** `RegistryTenant.addressLine`, `RegistryTenant.location` (store pin); `Order.deliveryLocation`, `OrderDeliverySnapshot.deliveryLocation` (customer pin).
- **Libraries:** `leaflet`, `react-leaflet@4`, `@types/leaflet` in storefront, admin, courier.
- **Storefront:** `LocationPicker` (OpenStreetMap, draggable pin, "تحديد موقعي"), integrated in Checkout for DELIVERY; order payload includes `deliveryLocation`.
- **Admin:** `StoreLocationPicker` in Store Settings; `addressLine` + `location` saved via `updateOperationalSettingsApi`; mock-api PUT operational-settings accepts `addressLine` and `location`.
- **Courier:** `OrderRouteMap` (store red marker, customer green marker, polyline); "فتح في خرائط Google" uses exact `lat,lng` when available.
