# System Pre-Flight Audit: Preparing for 5-PWA Multi-Tenant Deployment

**Scope:** Global scan, env audit, identity verification, PWA/manifest strategy, Docker/Nginx plan.  
**Constraint:** No files modified; revert to current `data.json` state possible at any time.

---

## 1. Global Scan — Route Structures & Courier Location

### 1.1 Monorepo apps (relevant to 5-PWA)

| App | Path | Purpose |
|-----|------|--------|
| **storefront** | `apps/storefront` | Customer: markets picker, market pages (dabburiyya/iksal), tenant storefront (`/:tenantSlug/*`), merchant dashboard (`/merchant/dashboard`), my-activity, checkout, order success |
| **nmd-admin** | `apps/nmd-admin` | Admin: login, markets, market detail (tenants/orders/dispatch/finance/banners/layout), tenants (global), categories, tenant portal (`/tenant/*`), leads, customers, settings, audit, monitoring. Serves **both** Market Admin and Root Admin by role. |
| **admin** | `apps/admin` | **Tenant/Merchant** admin: single-tenant dashboard, orders, catalog, campaigns, delivery settings, staff, branding, store settings, leads. (Merchant = tenant owner.) |
| **courier** | `apps/courier` | **Driver** app: login, `/courier` (dashboard), `/courier/orders`, `/courier/route`. |
| **mock-api** | `apps/mock-api` | Backend API (port 5190); JSON or DB storage. |
| **nmd-mall** | `apps/nmd-mall` | Alternative mall UI; not in current Docker deploy. |

### 1.2 Route structures (summary)

**Storefront (`apps/storefront/src/App.tsx`):**
- `/` — LandingLayout (MarketsPickerPage, my-activity)
- `/daburiyya`, `/dabburiyya`, `/iksal` — MarketLayout → MarketHomePage
- `/:tenantSlug/*` — TenantGate → Layout (tenant storefront: home, cart, checkout, etc.)
- `/merchant/dashboard` — MerchantDashboardPage
- `/order/:orderId/print`, `/order/:orderId/success` — order print/success

**NMD-Admin (`apps/nmd-admin/src/App.tsx`):**
- `/login` — LoginPage
- `/` — AdminLayout; index → role-based redirect (markets / tenants / tenant portal)
- `/markets`, `/markets/:id`, `/markets/:id/tenants|orders|dispatch|finance|banners|layout`, `/markets/:id/couriers` (→ dispatch)
- `/tenants`, `/tenants/:id`, `/categories`, `/plans`, `/modules`, `/api`, `/settings`, `/audit`, `/leads`, `/customers`
- `/tenant/*` — RequireTenant → TenantLayout (products, delivery-zones, orders, customers, account/security)

**Admin / Merchant (`apps/admin/src/App.tsx`):**
- `/login` — LoginPage
- `/` — TenantSelectPage or AdminLayout with tenant-scoped routes: leads, orders, orders/board, catalog/*, campaigns, settings/*, branding, homepage, staff

**Courier (`apps/courier/src/App.tsx`):**
- `/login` — LoginPage
- `/courier` — CourierDashboard
- `/courier/orders` — CourierOrdersPage
- `/courier/route` — CourierRoutePage
- `/`, `*` — redirect to `/login`

### 1.3 Where /courier (driver) logic lives

- **Frontend:** Entirely in **`apps/courier`** (separate Vite app). Routes: `/login`, `/courier`, `/courier/orders`, `/courier/route`. No route lives under `apps/storefront` or `apps/nmd-admin`.
- **API:** **`apps/mock-api`** — routes under `/courier/*` (e.g. `/courier/me`, `/courier/orders`, `/courier/orders/:id/status`, `/courier/stats`, `/courier/events`). Assignment is from nmd-admin (Market Dispatch) via **POST /markets/:marketId/orders/:orderId/assign**.
- **Auth:** Courier uses **email + password** and **`courier-access-token`** (see §3). No OtpLoginModal.

---

## 2. Environment Variable Audit — Hardcoded URLs & Production Switch

### 2.1 Hardcoded localhost (or similar) — files to adjust for production

| File | Current usage | Production approach |
|------|----------------|---------------------|
| **apps/nmd-admin/vite.config.ts** | Proxy targets `http://localhost:5190` for many paths | Dev-only; production uses same origin or `VITE_MOCK_API_URL` for direct API. Nginx will proxy `/api` (or similar) to backend. |
| **apps/nmd-admin/src/pages/TenantsPage.tsx** | `ADMIN_URL = 'http://localhost:5176'` in dev | Use `import.meta.env.VITE_ADMIN_URL` or `VITE_NMD_ADMIN_URL` (e.g. `https://nmd.marketing/market-admin`) in production. |
| **apps/admin/src/pages/LoginPage.tsx** | `MARKET_ADMIN_LOGIN_URL = 'http://localhost:5176/login'` | Replace with env (e.g. `VITE_NMD_ADMIN_URL`) for production. |
| **apps/admin/.env.development** | Comment `VITE_NMD_ADMIN_URL=http://localhost:5176` | Document; production set to `https://nmd.marketing/market-admin` (or /root-admin). |
| **apps/courier/src/api.ts** | Fallback `return 'http://localhost:5190'` when `import.meta.env.DEV` and no `VITE_API_BASE_URL` | Production must set **`VITE_API_BASE_URL`** (e.g. `https://nmd.marketing/api` or dedicated API host). No localhost in prod build. |
| **apps/nmd-admin/src/pages/MarketDetailPage.tsx** | User-facing message "مثال: http://localhost:5190" | Keep as example only; no logic change. |
| **apps/nmd-admin/src/pages/MarketTenantsPage.tsx** | Same message | Same. |
| **apps/nmd-admin/src/pages/MarketFinancePage.tsx** | Same message | Same. |

**Existing env usage (already correct for switching):**
- **storefront, nmd-admin, admin:** Use **`VITE_MOCK_API_URL`** for API base. Set at build time (e.g. `https://nmd.marketing/api` or `https://api.nmd.marketing`).
- **courier:** Uses **`VITE_API_BASE_URL`**. Must be set in production (same API base as above if single domain).
- **Docker:** `Dockerfile.storefront` uses `ARG VITE_MOCK_API_URL=...`; `docker-compose.yml` passes `VITE_MOCK_API_URL: "http://147.93.120.244:5190"`. For production, pass `https://nmd.marketing/api` (or your API URL).

### 2.2 Suggested single production API env

- **Name:** `VITE_API_URL` (or keep `VITE_MOCK_API_URL` / `VITE_API_BASE_URL` for compatibility.)
- **Value (example):** `https://nmd.marketing/api` when Nginx proxies `/api` to mock-api.
- **Files to touch (when implementing):** All files that read `VITE_MOCK_API_URL` or `VITE_API_BASE_URL` — use one env name for production and set it in each app’s build (storefront, nmd-admin, admin, courier). No file changes in this audit; list is in §2.1 and in the VITE_* grep results.

---

## 3. Identity System Verification

### 3.1 OtpLoginModal — Name + Phone mandatory signup

- **Location:** `apps/storefront/src/components/OtpLoginModal.tsx`.
- **Modes:** **LOGIN** (phone only) and **SIGNUP** (phone + **الاسم الكامل** from the start).
- **Signup:** Clicking "إنشاء حساب جديد" switches to SIGNUP; **Name field is visible and required** before "التالي". In SIGNUP, `handlePhoneSubmit` and `handleCodeSubmit` require `name.trim()`; confirm button is disabled when `mode === 'SIGNUP' && !name.trim()`.
- **API:** Name is sent in **POST /customer/auth/verify** as `name` and persisted (new customer or update); see `apps/mock-api/src/index.ts` and `docs/DRIVER-SYSTEM-AUDIT.md`.

**Conclusion:** Name + phone mandatory signup is implemented and verified.

### 3.2 Token isolation — courier-access-token vs nmd-customer-token

- **nmd-customer-token:** Used by **storefront** (and nmd-mall, packages/customer-auth) for **customer** session. Set/read/removed only in CustomerAuthContext and storefront logout; key is `'nmd-customer-token'`.
- **courier-access-token:** Used only by **apps/courier** (`apps/courier/src/api.ts`: `TOKEN_KEY = 'courier-access-token'`). Login/logout and API calls use this key; **not** used by storefront or nmd-admin.
- **nmd-access-token:** Used by **nmd-admin** and **admin** (and MockApiClient in packages/mock) for **admin** (Root/Market/Tenant) session.

**Conclusion:** Three separate keys: `nmd-customer-token`, `courier-access-token`, `nmd-access-token`. Courier is isolated from customer token; no shared storage between courier and storefront identity.

---

## 4. PWA & Manifest Strategy

### 4.1 Current public/ folders

| App | Public folder | Has manifest |
|-----|---------------|--------------|
| **storefront** | `apps/storefront/public` | No (only favicon.svg) |
| **nmd-admin** | `apps/nmd-admin/public` | No (only favicon.svg) |
| **admin** | `apps/admin/public` | No (only favicon.svg) |
| **courier** | `apps/courier/public` | **Yes** — `manifest.json` (name: "NMD Courier", start_url: "/") |
| **nmd-mall** | `apps/nmd-mall/public` | No |

### 4.2 Plan — 5 distinct manifest.json files

Deployment will serve 5 path prefixes; each needs a manifest whose `start_url` and scope match that path.

| Path prefix | App (source) | Suggested manifest location (when implementing) | name / short_name (example) |
|-------------|--------------|--------------------------------------------------|-----------------------------|
| **/** | storefront | `apps/storefront/public/manifest.json` | NMD Storefront / Storefront |
| **/courier** | courier | `apps/courier/public/manifest.json` (existing; update start_url) | NMD Courier / Courier |
| **/merchant** | admin | `apps/admin/public/manifest.json` | NMD Merchant / Merchant |
| **/market-admin** | nmd-admin | `apps/nmd-admin/public/manifest.json` (or subpath manifest) | NMD Market Admin / Market |
| **/root-admin** | nmd-admin | Same app as market-admin; can use same manifest or second copy with different name | NMD Root Admin / Root |

**Implementation notes (no changes in this audit):**
- **Base path:** Each app must be built with Vite `base: '/courier'`, `base: '/merchant'`, etc., so assets and `index.html` resolve under that path. Courier currently has no `base` (assumes root); for a single domain it would be `base: '/courier'`.
- **start_url:** For each manifest, set `start_url` to the path prefix (e.g. `/`, `/courier/`, `/merchant/`, `/market-admin/`, `/root-admin/`) so install adds the right entry point.
- **Scope:** Optionally set `scope` in manifest to the same prefix so the PWA is clearly scoped.
- **5 manifests:** Either 5 separate build outputs (one per app) with a manifest in each app’s `public/`, or a single Nginx/shell step that writes 5 manifest files into the combined docroot. Recommended: each app’s `public/manifest.json` is built with the app and deployed under its path.

---

## 5. Docker & Nginx Preparation — Single Nginx for nmd.marketing

### 5.1 Current state

- **Docker:** `docker-compose.yml` has `mock-api` (port 5190) and `storefront` (nginx on port 80). Storefront Dockerfile builds only `apps/storefront` and serves it at `/` with SPA fallback.
- **No Nginx config file** in repo; nginx is generated inline in `Dockerfile.storefront` (single server block, root `/usr/share/nginx/html`, `try_files $uri $uri/ /index.html`).

### 5.2 Target layout (5 paths on nmd.marketing)

| URL path | Serves | Build from |
|----------|--------|------------|
| `/` | Customer storefront (markets, tenant storefront, merchant dashboard) | apps/storefront (base: `/`) |
| `/courier` | Driver app | apps/courier (base: `/courier`) |
| `/merchant` | Tenant/Merchant admin | apps/admin (base: `/merchant`) |
| `/market-admin` | NMD Admin (Market + Root by role) | apps/nmd-admin (base: `/market-admin`) |
| `/root-admin` | Same as market-admin; optional alias or same app with different entry | Same nmd-admin build (or second build with base: `/root-admin`) |
| **API** | Backend | Proxy to mock-api (e.g. `/api` → container or host:5190) |

**Note:** market-admin and root-admin can be the same app (nmd-admin) at one path (e.g. `/market-admin`) with role-based redirect after login; `/root-admin` can redirect to `/market-admin` or be an alias.

### 5.3 Nginx strategy (single container)

- **Option A — Multi-build single image:**  
  Build storefront, courier, admin, nmd-admin with different `base` (e.g. `/`, `/courier`, `/merchant`, `/market-admin`). Copy each `dist` into a subpath of `/usr/share/nginx/html` (e.g. `html/`, `html/courier/`, `html/merchant/`, `html/market-admin/`). One Nginx config:
  - `location /` → root for storefront; `try_files` → `/index.html`.
  - `location /courier` → alias or root to `html/courier/`; `try_files` → `/courier/index.html`.
  - `location /merchant` → same for merchant.
  - `location /market-admin` → same for nmd-admin.
  - `location /api/` → proxy_pass to `http://mock-api:5190/` (strip `/api` or not depending on API expectation).

- **Option B — Separate images per app:**  
  Build 4 (or 5) images; one Nginx container with config that proxies by path to different containers, or use multiple server blocks with different root/alias. More moving parts; Option A is simpler for one domain.

- **API base URL:** All frontends must call the same API base. If Nginx exposes API at `https://nmd.marketing/api`, set `VITE_API_URL` (or `VITE_MOCK_API_URL` / `VITE_API_BASE_URL`) to `https://nmd.marketing/api` at build time for all apps.

### 5.4 Example Nginx sketch (no file created in audit)

```text
# Conceptual only — not written to repo
server {
  listen 80;
  server_name nmd.marketing;
  root /usr/share/nginx/html;

  location /api/ {
    proxy_pass http://mock-api:5190/;   # or strip /api
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }

  location /courier/ {
    alias /usr/share/nginx/html/courier/;
    try_files $uri $uri/ /courier/index.html;
  }
  location /merchant/ {
    alias /usr/share/nginx/html/merchant/;
    try_files $uri $uri/ /merchant/index.html;
  }
  location /market-admin/ {
    alias /usr/share/nginx/html/market-admin/;
    try_files $uri $uri/ /market-admin/index.html;
  }
  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

- **data.json:** Served only by mock-api (or copied for backup). Nginx does not serve `data.json` to the internet; revert to current state by restoring `apps/mock-api/data.json` (and stopping/starting mock-api if needed).

---

## 6. Revert & Backup

- **Code:** All logic is in the repo; no edits were made in this audit. Revert with `git checkout -- .` (or restore from backup) if future edits need undoing.
- **Data:** **`apps/mock-api/data.json`** is the current JSON store. Keep a copy (e.g. `data.json.backup-YYYYMMDD`) before any migration or schema change. Restore by replacing `data.json` and restarting mock-api so the system returns to the current data state.

---

## 7. Summary Checklist

| Item | Status |
|------|--------|
| Routes mapped (storefront, nmd-admin, admin, courier) | Done |
| /courier logic location (apps/courier + mock-api /courier/*) | Documented |
| Hardcoded localhost list and env strategy | Listed in §2 |
| VITE_MOCK_API_URL / VITE_API_BASE_URL usage | Confirmed; production via single VITE_API_URL (or existing names) |
| OtpLoginModal Name+Phone signup | Verified |
| courier-access-token vs nmd-customer-token | Isolated; verified |
| public/ and manifest (only courier has one) | Listed; 5-manifest plan in §4 |
| Docker/Nginx plan for 5 paths on nmd.marketing | Outlined in §5 |
| Revert to data.json state | Possible by restoring file and restarting mock-api |

**No files were modified. This document is the technical summary only.**
