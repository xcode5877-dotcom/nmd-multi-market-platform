# NMD Multi-Market Platform — Architecture & Functional Summary

This document gives a full architectural and functional overview so downstream agents (e.g. Gemini) and developers stay synced.

---

## 0. Project Structure & Roles

### Monorepo (pnpm)
- **Root:** `pnpm` monorepo; shared lockfile and workspace.
- **Packages:** Shared logic in `packages/` — `@nmd/core` (types, utils, tenant/cart/order), `@nmd/ui` (components, theme, Drawer, Modal, DataTable), `@nmd/mock` (MockApiClient, tenant registry, orders store).
- **Apps:** `apps/` — each app is a separate deployable; they consume packages and may call the same backend.

### Backend
- **Node.js API** (mock or real): `apps/mock-api`. Handles orders, markets, tenants, customer auth, FCM, uploads. Repos abstract storage (JSON vs Postgres via Prisma).

### Global Identity
- **Phone-based OTP** for customers (`nmd-customer-token`).
- **Admin/Super Admin:** JWT in `nmd-access-token`. Users (Merchants, Market Admins, Super Admins) are recognized across markets/stores with a **unified session**.

### App Roles
| App | Path / Purpose |
|-----|----------------|
| **Super Admin** | `apps/nmd-admin`. Controls all markets (e.g. Dabburiyya, Iksal), tenants, orders; has "View Details" Drawer for order products/prices. |
| **Merchant** | `apps/admin`. Dashboard for **store owners**; manage their orders in real time. |
| **Storefront** | Customer-facing web app for browsing and ordering. |
| **Courier** | Courier-facing app for delivery assignments and status. |

### Mobile Infrastructure (Android / iOS)
- **Tech:** WebView-based native wrappers in `apps/native-assets/`.
- **Android:** `apps/native-assets/merchant/android-project` — configured with FCM, Native Bridge (FCM token to web), viewport fixed, no zoom, `overflow-x-hidden`, stabilized navbar for native feel.
- **iOS:** WebView wrapper logic in `apps/native-assets/` (e.g. courier/ios or merchant) for Xcode/Swift deployment.
- **FCM:** Firebase Cloud Messaging for push; device token sent from native to web via bridge and stored on server for push delivery.
- **Real-time:** Order Alarm (e.g. `OrderAlarmContext`) — sound (bell) and toasts when new orders arrive.

### UI/UX Consistency (Merchant & Super Admin)
- **Mobile-first, native-feel:** Viewport fixed (no zoom), horizontal scroll disabled (`overflow-x-hidden`), navbar stabilized.
- New UI changes in merchant and super-admin apps must respect these constraints so the WebView experience feels native.

### Deployment
- **Docker Compose:** Services include `web-gateway` (Nginx), `postgres`, `whatsapp-service`, `mock-api`. Volumes for data, uploads, WhatsApp session.

---

## 1. Core Features

### Global Identity (NMD ID)
- **Single phone-based identity** across Market, Store, and Pro flows.
- **Session key:** `nmd-customer-token` (localStorage). Distinct from admin token `nmd-access-token`.
- **Flow:** User enters phone → “Send Code” → 6-digit OTP → Verify. Optional name on first signup.
- **Backend:** `POST /customer/auth/start` (sends OTP), `POST /customer/auth/verify` (returns JWT + customer). `GET /customer/auth/check-phone` to check if phone exists.
- **Used in:** Storefront, nmd-mall, and shared `packages/customer-auth`. Logout clears only `nmd-customer-token` and customer state.

### OTP Authentication
- **OTP:** 6-digit code generated and verified in mock-api (`customer-auth.ts`). In dev, code can be logged or shown in toast.
- **Resend:** 60-second cooldown after “Send Code” to avoid abuse.
- **JWT:** Issued on verify; payload includes `sub` (customer id) and `role: 'CUSTOMER'`. Used as `Authorization: Bearer <token>` for all customer APIs.

### WhatsApp Integration
- **WhatsApp service** (`apps/whatsapp-service`): Node + Puppeteer/WhatsApp Web. Exposes:
  - `POST /send-otp` — sends OTP message to a phone (body: `phone`, `code`). Requires `x-api-key` header.
  - `POST /send-message`, `GET /health` (connection state, battery).
- **mock-api** calls the gateway on `POST /customer/auth/start`: reads `WHATSAPP_GATEWAY_URL` and `WA_API_KEY`, sends `x-api-key` and OTP to gateway (with one retry after 2s). If gateway fails, auth still succeeds (dev fallback).
- **OTP delayed?** Check server logs for `[customer/auth/start] WhatsApp send-otp`; call `GET /customer/auth/otp-gateway-health` to see if gateway is reachable and ready; check the WhatsApp provider’s status page for outages.
- **Docker:** `WA_API_KEY` must be set for both mock-api and whatsapp-service; gateway rejects requests without matching key. WhatsApp service can persist logs to Postgres (`whatsapp_logs`) and uses `DATABASE_URL`.

### Order Flow
- **Checkout:** Storefront submits order to mock-api `POST /orders` (cart, tenantId, customerId when logged in, delivery, payment).
- **Auth:** Customer orders require `Authorization: Bearer <nmd-customer-token>` or guest (no token). Order is linked to `customerId` when present.
- **Persistence:** Orders are stored via **repos** (see Data Storage). In Docker, `STORAGE_DRIVER=db` uses Postgres; otherwise JSON files.
- **Post-order:** Order success page, print view (`/order/:orderId/print`), and merchant/courier flows use the same order records.

---

## 2. Current Tech Stack

| Layer | Technology |
|-------|------------|
| **Storefront** | Vite, React 18, React Router, TanStack Query, Zustand, Tailwind, Framer Motion, `@nmd/ui`, `@nmd/core`, `@nmd/mock` |
| **Mock API** | Express, TypeScript, CORS, JWT (customer + admin), multer (uploads). Repos abstract storage (JSON vs Prisma/Postgres). |
| **Storage** | **JSON:** `DATA_FILE` (markets, tenants, users, customers, catalog, …), `ORDERS_FILE` (orders). **DB:** PostgreSQL via Prisma when `STORAGE_DRIVER=db`. |
| **Push** | Web Push (VAPID). Storefront: `usePushNotifications`, service worker `sw.js` (push + notificationclick). mock-api: `push-subscriptions.ts` (VAPID keys, save by phone), `POST /customer/push-subscription`, `GET /customer/push-public-key`. |
| **WhatsApp** | Node, Puppeteer, whatsapp-web.js. Runs as separate service; mock-api calls it over HTTP with `WA_API_KEY`. |
| **Deploy** | Docker Compose: postgres, web-gateway (Nginx), mock-api, whatsapp-service. Volumes: `postgres_data`, `./data` (JSON + push-subscriptions), `uploads_data`, `whatsapp_session`. |

---

## 3. NOW Market Identity

### Brand & Theme
- **Name:** NOW Market (short: NOW). Subtitle/context: “Daburiyya” (e.g. site title: “NOW Market - Daburiyya”).
- **Teal:** Primary theme color `#00A0A0` (used in manifest, index theme-color, splash, and PWA Install Guide).
- **Icon:** Single SVG used everywhere: rounded square teal (`#00A0A0`) with white “N” and upward-arrow accent. File: `apps/storefront/public/favicon.svg`.

### PWA & Manifest
- **manifest.json** (`apps/storefront/public/manifest.json`):
  - `name`: "NOW Market", `short_name`: "NOW"
  - `display`: "standalone", `display_override`: ["standalone", "minimal-ui", "browser"]
  - `theme_color` / `background_color`: "#00A0A0"
  - `icons`: single entry `favicon.svg` (type image/svg+xml, purpose any maskable)
- **index.html:** `<title>NOW Market - Daburiyya</title>`, `<link rel="apple-touch-icon" href="/favicon.svg">`, `theme-color` meta `#00A0A0`, splash background `#00A0A0`, splash icon `/favicon.svg`.

### Install Guide (iOS PWA)
- **When it shows:** Only when **not** installed as PWA and on **iOS Safari** (not Chrome/Firefox on iOS). Uses strict checks: `window.navigator.standalone === false` and `window.matchMedia('(display-mode: standalone)').matches` for standalone; plus `isIOS()` and `isSafari()`.
- **Persistence:** Dismissal stored in localStorage key `nmd-pwa-install-dismissed`; guide shows again after **24 hours**.
- **UI:** Premium bottom sheet (Arabic): “ثبّت تطبيق دبورية مول على هاتفك”, steps (Share → Add to Home Screen), animated arrow. No separate bar on iOS; Android gets a separate install bar with `beforeinstallprompt`.

---

## 4. Routes & Fixed Logic

### Storefront Routes (apps/storefront)
- **Landing:** `/` (markets picker), `/my-activity`
- **Markets:** `/daburiyya`, `/daburiyya/stores`; `/daburiyya` (alt spelling); `/iksal`, `/iksal/stores`
- **Tenant store:** `/:tenantSlug` (e.g. `/buffalo`) → Layout with Home, `p/:productId`, `c/:categoryId`, `products`, `cart`, `checkout`, `my-activity`, `order/:orderId/success`
- **Global:** `/order/:orderId/print`, `/order/:orderId/success` (legacy redirect), `/merchant/dashboard`, `/p/:productId` (legacy redirect)
- **InstallBanner** is mounted at app root so it appears on all routes (including deep links like `/buffalo`).

### Store Open/Closed Logic (packages/core tenant.ts)
- **Order of evaluation:**  
  1. `forceClosed === true` → **closed**.  
  2. `operationalStatus === 'open'` or `'busy'` → return that (overrides time; good for dev/manual).  
  3. If `openTime`/`closeTime` set: compare current time in store TZ (Asia/Jerusalem). **Next-day close** supported: if `closeMin < openMin` (e.g. close 03:00, open 20:00), store is “open” when `nowMin >= openMin || nowMin < closeMin`.  
  4. Else use `operationalStatus` if set.  
  5. Else derive from `businessHours` by day.
- **Data:** mock-api returns `openTime`, `closeTime`, `forceClosed` in market tenants and tenant by slug. Storefront uses same tenant object for StatusBadge, ProfessionalHero, StoreCard so store status is consistent. Market tenants script (`update-dabburiyya-hours.ts`) can set dabburiyya tenants to `openTime: '00:00'`, `closeTime: '23:59'`.

### Customer Auth on API
- **Customer routes** (e.g. `/customer/me`, `/customer/profile`, `/customer/activity`, `/customer/push-subscription`): require `req.customer` set by JWT middleware (Bearer token, `role: 'CUSTOMER'`, `sub` = customer id). Public customer routes: `/customer/auth/*`, `GET /customer/push-public-key`.

### CORS
- mock-api allows all origins and includes `Authorization` in `allowedHeaders`. POST to `/customer/push-subscription` from the storefront origin is allowed.

---

## 5. Data Storage

| Data | Where | Notes |
|------|--------|------|
| **Markets, tenants, users, catalog, delivery, campaigns, leads, …** | **JSON:** `DATA_FILE` (default `data.json`; Docker: `/data/data.json` → host `./data`). **DB:** Postgres via Prisma when `STORAGE_DRIVER=db`. | mock-api `store.ts` loads/saves JSON; repos switch between json-repos and db-repos. |
| **Orders** | **JSON:** `ORDERS_FILE` (default `packages/mock/data/orders.json`; Docker: `/data/orders.json` → host `./data`). **DB:** Postgres when `STORAGE_DRIVER=db`. | Written by mock-api after order create; json-repos use a separate file from DATA_FILE. |
| **Customers** | Same as above: in-memory from DATA_FILE (customers array) or Prisma `Customer` when `STORAGE_DRIVER=db`. | Created/updated via `/customer/auth/verify`, `/customer/profile`. |
| **Push subscriptions** | **File:** `PUSH_SUBSCRIPTIONS_FILE` (default `/app/data/push-subscriptions.json` in Docker; host `./data` if volume mapped). In-memory map keyed by phone; persisted to JSON. | mock-api `push-subscriptions.ts`. VAPID keys from env or generated once. Script `send-test-push.ts` sends test push by phone. |
| **Uploads** | **Docker:** volume `uploads_data` → `/app/apps/mock-api/uploads`. | Served at `/uploads/*`. |
| **WhatsApp session** | **Docker:** volume `whatsapp_session` → `/app/session`. | Persists so QR is not required on every restart. |
| **Postgres** | **Docker:** volume `postgres_data`. Used when `STORAGE_DRIVER=db` for tenants, markets, users, customers, orders, catalog, etc., plus Prisma migrations. | `DATABASE_URL` in mock-api and whatsapp-service. |

---

## Quick Reference

- **Customer token:** `localStorage.getItem('nmd-customer-token')` (Bearer for API).
- **PWA dismiss key:** `nmd-pwa-install-dismissed` (timestamp; 24h cooldown).
- **Teal:** `#00A0A0`. **Icon:** `apps/storefront/public/favicon.svg`.
- **Site title:** “NOW Market - Daburiyya” in `index.html`.
- **Env (Docker):** `STORAGE_DRIVER`, `DATA_FILE`, `ORDERS_FILE`, `WA_API_KEY`, `WHATSAPP_GATEWAY_URL`, `DATABASE_URL`, `PUSH_SUBSCRIPTIONS_FILE` (optional).
