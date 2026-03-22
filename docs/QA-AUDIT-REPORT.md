# NMD Platform — Comprehensive QA & Health Check Report

**Date:** 2025-03-14  
**Scope:** Monorepo-wide audit across Functional, Mobile/UI, Technical, and Error Handling.

---

## 1. Functional QA (Happy Path)

### 1.1 OTP Auth Flow

| Finding | Severity | Notes |
|--------|----------|--------|
| **Session consistency** | OK | Single `nmd-access-token` (admin) and `nmd-customer-token` (customer) used across apps. AuthContext in admin/nmd-admin reads from localStorage; token is sent on API calls. No evidence of path-specific loss. |
| **Edge case** | Low | If user opens merchant in WebView and storefront in browser, both share localStorage on same origin; logging out in one clears `nmd-access-token` and affects the other. By design for “unified session.” |
| **Recommendation** | — | Document for support: “Logout in Merchant app logs out all admin sessions on this device.” |

### 1.2 Order Flow (Storefront → Mock API → Merchant → Super Admin)

| Finding | Severity | Notes |
|--------|----------|--------|
| **Data consistency** | OK | Order created via `POST /orders`; persisted by repos (JSON or Postgres). Same order id used by: storefront success page, merchant OrderAlarmContext (polling + FCM), Super Admin `getMarketOrders(id)` and `getOrder(orderId)`. |
| **View Details** | OK | Super Admin uses `api.getOrder(orderId)` → `GET /orders/:orderId`. Backend restricts only `MARKET_ADMIN` by `marketId`; `ROOT_ADMIN` and `SUPER_ADMIN` can fetch any order. View Details works for all market IDs (Dabburiyya, Iksal, etc.). |
| **Merchant alarm** | OK | OrderAlarmContext polls `getMarketOrders(marketId)` or tenant orders; new orders trigger sound + toasts. |

### 1.3 Actions Column (View Details)

| Finding | Severity | Notes |
|--------|----------|--------|
| **Eye icon / drawer** | OK | MarketDetailPage orders tab has Actions column with Eye (التفاصيل) and optional Trash for Super Admin. Drawer fetches full order via `api.getOrder(orderId)` and shows summary, customer, items, totals, store. |
| **Market-agnostic** | OK | `GET /orders/:orderId` returns order for any market when user is SUPER_ADMIN/ROOT_ADMIN; no market id in request. |

---

## 2. Mobile & UI/UX Audit (Native Feel)

### 2.1 Horizontal Scroll & Overflow

| Finding | Severity | Notes |
|--------|----------|--------|
| **apps/admin** | OK | Root layout has `overflow-x-hidden` (AdminLayout + index.css on `html`, `body`, `#root`). Tables use `overflow-x-auto` in contained wrappers (intentional for wide tables). |
| **apps/nmd-admin** | Fixed | **Was missing:** global `overflow-x: hidden` and viewport anti-zoom. **Fix applied:** `index.css` now sets `overflow-x: hidden` on `html`, `body`, and `#root`; `index.html` viewport updated (see below). |
| **overflow-x-auto usage** | OK | Used for table wrappers only; root is not scrollable horizontally. |

### 2.2 Viewport Meta Tags

| App | Before | After / Recommendation |
|-----|--------|-------------------------|
| **apps/admin** | `width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover` | OK — already optimized. |
| **apps/nmd-admin** | `width=device-width, initial-scale=1.0` only | **Fixed:** set to `width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover`. |
| **storefront** | `viewport-fit=cover` only (no maximum-scale) | Consider adding `maximum-scale=1, user-scalable=no` if PWA should feel more app-like. |
| **courier** | Has maximum-scale and user-scalable=no | OK. |

### 2.3 Navbar & Toasts

| Finding | Severity | Notes |
|--------|----------|--------|
| **Merchant (admin)** | OK | Header is `sticky top-0 z-50`; sidebar fixed on mobile with overlay. Main content `overflow-auto`. |
| **nmd-admin** | OK | Native-style layout uses `fixed bottom-0` nav bar; desktop uses static sidebar. |
| **Toasts (@nmd/ui)** | OK | Toast container is `fixed bottom-4 start-4 end-4 ... z-[9999]` — does not depend on keyboard; safe for mobile. |

### 2.4 Hardcoded Widths

| Finding | Severity | Notes |
|--------|----------|--------|
| **admin** | Low | Some `min-w-[...]` (e.g. 7rem, 140px, 220px) for form/table columns; all within flexible layouts. No full-width fixed px that would force horizontal scroll on small screens. |
| **nmd-admin** | Low | Same pattern; min-widths on inputs/tables. No root-level risk. |

---

## 3. Technical & Performance QA

### 3.1 TypeScript & Unused Code

| Finding | Severity | Notes |
|--------|----------|--------|
| **apps/admin** | OK | `pnpm exec tsc --noEmit` passes. |
| **apps/nmd-admin** | Fail | **Multiple TS errors:** (1) `MockApiClient` missing `getCoupons`, `createCoupon`, `hardDeleteOrder` in type/implementation. (2) `ConfirmDialog` usage passes `closeOnConfirm` but built `@nmd/ui` dist `ConfirmDialogProps` does not include `closeOnConfirm` (source has it; dist is stale). (3) `TenantLayout.tsx` window type assertion for `__NMD_NATIVE_REGISTER_PUSH__`. |
| **Fix (ConfirmDialog)** | — | Rebuild UI package so dist types match source: `pnpm --filter @nmd/ui build`. Then re-run tsc in nmd-admin. |
| **Fix (MockApiClient)** | — | Add `getCoupons`, `createCoupon`, `hardDeleteOrder` to `@nmd/mock` MockApiClient (or remove usage in nmd-admin if features are not wired). |
| **Fix (TenantLayout)** | — | Use `(window as unknown as { __NMD_NATIVE_REGISTER_PUSH__?: () => void })` or extend Window interface in a global.d.ts. |

### 3.2 Native Bridge

| Finding | Severity | Notes |
|--------|----------|--------|
| **Android FCM** | OK | MainActivity prefetches FCM token on startup so when web calls `getFCMToken`, token is often ready. |
| **Web (OrderAlarmContext)** | OK | 3s delay before first `getFCMToken`; retries at 4s and 10s; `visibilitychange` retries when tab becomes visible. 8s callback timeout; if no callback, app continues with polling. |
| **Improvement** | Low | Consider one extra retry at ~15s for very slow WebView init. |

### 3.3 Docker & Build Cache

| Finding | Severity | Notes |
|--------|----------|--------|
| **Dockerfile.web** | OK | Each app stage copies `apps` then runs install + build. Changing any app (e.g. MarketDetailPage for View Details) invalidates the COPY layer and rebuilds that app. No over-caching of app code. |
| **docker-compose** | OK | `STOREFRONT_CACHEBUST: "1"` can be bumped to force storefront rebuild when needed. merchant and nmd-admin do not use a cache-bust arg; their layers invalidate when app sources change. |
| **Recommendation** | — | For critical UI deploys, run `docker compose build --no-cache web-gateway` once to guarantee fresh build. |

---

## 4. Error Handling

### 4.1 WhatsApp Service Down

| Finding | Severity | Notes |
|--------|----------|--------|
| **Auth flow** | OK | In `POST /customer/auth/start`, if `WHATSAPP_GATEWAY_URL` or send-otp fails, the handler only logs (`console.warn`) and still returns `200` with `{ ok: true }`. OTP is still generated and can be shown in dev or used by another channel. User is not stuck. |
| **Recommendation** | Low | Optionally return a flag in the response when WhatsApp send failed (e.g. `whatsAppSent: false`) so the client can show “تم إرسال الرمز” vs “الرمز جاهز (تحقق من التطبيق)”. |

### 4.2 FCM Token Registration Failure

| Finding | Severity | Notes |
|--------|----------|--------|
| **PUT failure** | OK | OrderAlarmContext sets `fcmTokenSentRef.current = false` on non-ok or fetch error so that `visibilitychange` or retry timers can try again. |
| **No token / no bridge** | OK | If NativeBridge is missing or callback never fires, app continues with polling (POLLING_FALLBACK_MS 30s). User still sees new orders. |
| **User feedback** | Low | On failure, only console.warn. Consider a one-time toast: “لم يتم ربط الإشعارات — ستستمر التحديثات تلقائياً” when FCM fails but polling is active. |

---

## 5. Summary: Found Issues & Suggested Fixes

### Applied in This Audit

1. **nmd-admin viewport** — Updated `index.html` viewport to `maximum-scale=1, user-scalable=no, viewport-fit=cover`.
2. **nmd-admin overflow** — Added `overflow-x: hidden` to `html`, `body`, and `#root` in `index.css`.

### To Fix (Recommended)

| # | Issue | Fix |
|---|--------|-----|
| 1 | **nmd-admin TS errors** (MockApiClient, ConfirmDialog, TenantLayout) | Rebuild `@nmd/ui`: `pnpm --filter @nmd/ui build`. Add or align `getCoupons`, `createCoupon`, `hardDeleteOrder` in `@nmd/mock`. Fix TenantLayout window type (e.g. `as unknown` before cast). |
| 2 | **ConfirmDialog types in dist** | Already correct in source; rebuild packages/ui so `dist/index.d.ts` includes `closeOnConfirm` and updated `onConfirm` signature. |
| 3 | **FCM failure UX** | Optional: show a single toast when FCM registration fails but polling is used. |
| 4 | **WhatsApp send failure** | Optional: add `whatsAppSent: false` to auth/start response when gateway fails so client can adapt message. |

### No Change Needed

- OTP auth and session consistency across paths.
- Order flow and View Details for all markets.
- Merchant and nmd-admin navbar/toast positioning.
- Docker/build cache strategy.
- WhatsApp and FCM degradation behavior (auth and orders still work).

---

*End of QA Audit Report*
