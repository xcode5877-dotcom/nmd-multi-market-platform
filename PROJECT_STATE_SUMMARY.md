# Project State Summary

Technical snapshot for alignment on **Global Identity**, **WhatsApp service**, **database**, and **Android wrapper**. Use this as a single reference when shifting focus (e.g. to the Android wrapper).

---

## 1. Global Identity System

### Phone-based OTP flow

- **Single identity:** One phone number = one customer across all paths (market, store, professional). No separate “store account” vs “market account.”
- **Endpoints (mock-api):**
  - `GET /customer/auth/check-phone?phone=...` — returns `{ exists: boolean }` (is phone already registered).
  - `POST /customer/auth/start` — body `{ phone }`. Validates phone (normalized, length ≥ 9), creates OTP (in-memory in mock-api), rate limit 5 requests/hour/phone. Sends code via WhatsApp gateway (if `WHATSAPP_GATEWAY_URL` + `WA_API_KEY` set) with one retry after 2s. Response: `{ ok, whatsAppSent?, devCode? }` (devCode only in dev/MOCK_OTP).
  - `POST /customer/auth/verify` — body `{ phone, code, name? }`. Verifies OTP (TTL 5 min, max 3 attempts, 10 min lock on abuse). Creates or finds customer, returns JWT + `{ token, customer, isNewUser }`.
- **OTP storage (customer-auth.ts):** In-memory only. Keys: normalized phone (last 10 digits). Value: `{ codeHash, expiresAt, attempts, lockedUntil }`. Code is never stored in plain text; only hash. Rate limit: 5 `/start` per phone per hour.

### Unified session across paths

- **Token:** JWT signed with `JWT_SECRET`, payload `{ sub: customer.id, role: 'CUSTOMER' }`, expiry 30 days.
- **Client storage:** Single key `nmd-customer-token` in **localStorage** (storefront). All customer APIs send `Authorization: Bearer <token>`.
- **Unified usage:** Same token works on `/`, `/:marketSlug`, `/:tenantSlug`, `/my-activity`, `/my-account`, cart, checkout. No path-specific session; one login for the whole platform.
- **Logout:** Frontend removes `nmd-customer-token` from localStorage and (in app) navigates to `/` without reload; backend has no explicit “logout” endpoint (stateless JWT).

---

## 2. WhatsApp Service

### Docker configuration (docker-compose.yml)

| Setting | Value |
|--------|--------|
| **Image** | Built from `apps/whatsapp-service/Dockerfile` (base: `ghcr.io/puppeteer/puppeteer:21.6.1`) |
| **Ports** | `3000:3000` |
| **shm_size** | `2gb` |
| **privileged** | `true` |
| **security_opt** | `seccomp:unconfined` |
| **cap_add** | `SYS_ADMIN` |
| **Environment** | `PORT=3000`, `WA_SESSION_PATH=/app/session`, `PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable`, `WA_API_KEY`, `DEBUG=whatsapp-web.js:*`, `DATABASE_URL` (Postgres) |
| **Volumes** | `whatsapp_session:/app/session` (persistent auth) |
| **Resource limits** | `memory: 2G` |
| **Depends on** | `postgres` (healthy) |

### Dockerfile (current)

- **Base:** `ghcr.io/puppeteer/puppeteer:21.6.1`, **USER root**.
- **Order:** `WORKDIR /app` → `COPY package*.json` → `npm install --omit=dev` → `COPY . .` → `RUN chmod -R 777 /app` → `ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable` → `CMD ["node", "src/index.js"]`.
- **.dockerignore:** `node_modules`, `.wwebjs_auth`, `.wwebjs_cache`, `session`, `dist` (avoids “cannot replace directory with file” and keeps build context clean).

### index.js launcher and stability fixes

- **Puppeteer args:** `--no-sandbox`, `--disable-setuid-sandbox`, `--disable-dev-shm-usage`, `--disable-gpu`, `--no-proxy-server`, plus custom `--user-agent`.
- **Chrome path:** `process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable'`.
- **SingletonLock cleanup (before `client.initialize()`):**
  1. Remove `SESSION_PATH/SingletonLock` (if exists).
  2. Recursive `deleteSingletonLocks(USER_DATA_DIR)` (all `SingletonLock` files under session dir).
  3. After client creation and event setup: `find` under `USER_DATA_DIR` to delete `SingletonLock`, `SingletonCookie`, `SingletonSocket`.
  4. Immediately before `await client.initialize()`: if `SESSION_PATH/.wwebjs_auth/SingletonLock` exists, `unlinkSync` it (avoids TargetCloseError / lock after crash).
- **Auth:** `LocalAuth({ dataPath: SESSION_PATH })`; session persisted in volume `whatsapp_session`.
- **API:** All routes require `x-api-key` header matching `WA_API_KEY`. Endpoints: `POST /send-otp`, `POST /send-message`, `GET /health`.

---

## 3. Database Schema (Identity & WhatsApp)

### Identity-related tables (Prisma / PostgreSQL)

- **Customer**  
  - `id` (String, PK), `phone` (String, unique), `name` (String?), `createdAt` (String).  
  - Used by mock-api via repos (when `STORAGE_DRIVER=db`); otherwise customers stored in JSON.

- **User** (admin/merchant, not customer)  
  - `id`, `email`, `role`, `marketId`, `tenantId`, `password`, `fcmToken`, etc.

- **UserFCMToken**  
  - Multi-device FCM tokens for admin/merchant users (`userId`, `token`).

### WhatsApp logs (created by whatsapp-service)

- **whatsapp_logs** (created in service if `DATABASE_URL` set):  
  - `id` (SERIAL), `phone` (TEXT), `status` (TEXT), `created_at` (TIMESTAMPTZ).  
  - Used to log OTP/message send success or failure; optional (service works without DB).

### Note

- Customer records are in **Postgres** when mock-api runs with `STORAGE_DRIVER=db`; OTP state is **in-memory** in mock-api (not in DB). WhatsApp session is on **disk** in the container volume (`/app/session`), not in Postgres.

---

## 4. Android Wrapper Context

### How the web app is wrapped

- **App:** Customer Android app in `apps/native-assets/customer/android-project`. Single-Activity: **SplashActivity** (launcher) then **MainActivity** (main UI).
- **MainActivity:** Hosts a full-screen **WebView** plus a fixed **BottomNavigationView** (native). No fragments; no separate “screens” in native code. All content is the storefront loaded from `web_base_url` (e.g. `https://nmd.marketing`).
- **WebView config:**  
  - Loads `baseUrl` from `R.string.web_base_url` (e.g. `https://nmd.marketing`).  
  - User-Agent suffix `NMDCustomerApp/1.0` so the web can detect in-app (e.g. hide footer, use `body.is-app`).  
  - JavaScript enabled, DOM storage enabled, cookies and third-party cookies accepted.  
  - Over-scroll and scrollbars disabled; hardware layer; white background; no reload on bottom-nav tap (sync only).
- **Native bottom bar:** Four items (Home, Categories, Orders, Profile) that map to URLs and call `webView.loadUrl(...)`. Selection is synced from URL in `onPageFinished` (with a guard so it doesn’t flicker when navigation originated from the bar).
- **Bridge:** `NMDWebBridge` exposes `NMDNative.setBottomBarVisible(boolean)` and `NMDNative.getToken()` (FCM). Web can hide/show the native bar (e.g. on cart/checkout).

### Session persistence

- **Where session lives:** In the **WebView**: localStorage key `nmd-customer-token` (JWT) set by the storefront after `POST /customer/auth/verify`.
- **Current behavior:** In **MainActivity.onCreate()** the app calls `WebStorage.getInstance().deleteAllData()` (and `webView.clearCache(true)`). That clears WebView local storage (and thus `nmd-customer-token`) on **every** app launch. So with the current code, the user must log in again after each app restart.
- **Cookies:** CookieManager accepts and persists cookies; they are flushed on page finish. Logout flow clears cookies and cache via `clearWebViewCacheAndCookies()` and injects `localStorage.clear()`.
- **FCM:** Token is requested and passed to the web via the bridge; mock-api can store customer FCM token via `PUT /customer/me/fcm-token` for push.

### Summary table (Android)

| Item | Current state |
|------|----------------|
| **Base URL** | `strings.xml` → `web_base_url` (e.g. `https://nmd.marketing`) |
| **Session store** | WebView localStorage `nmd-customer-token` |
| **Persistence across restarts** | No — `deleteAllData()` in onCreate wipes storage each launch |
| **Auth flow** | Same as web: OTP via WhatsApp, verify, then JWT in localStorage |
| **Detection** | `navigator.userAgent` includes `NMDCustomerApp`; web uses `body.is-app` and hides footer / avoids reload on logout |

---

*Document generated for alignment; update this file when making significant changes to Identity, WhatsApp, or the Android wrapper.*
