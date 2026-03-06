# System Audit & Handover Report

**Generated:** For context handover to a new session.  
**Repository:** nmd-multi-market-platform  
**Latest commit:** `2837b454` — STABLE: Professional stores layout restored and system cleaned

---

## 1. Infrastructure & Connectivity

### Domain & Routing

| Item | Detail |
|------|--------|
| **Main domain** | `https://nmd.marketing` |
| **Storefront** | Served by **Nginx** at the same domain. Root path `/` serves the storefront SPA (`/usr/share/nginx/html` → `index.html`; SPA fallback). No separate “port 3000” in production — the storefront is built into the Nginx image and served on 80/443. |
| **Mock API** | **Port 5190** inside Docker; exposed on host as **3001** (`docker-compose.yml`: `3001:5190`). In production, **Nginx** proxies `location /api/` to `http://mock-api:5190/`, so the public API base is `https://nmd.marketing/api`. |
| **Config files** | `nginx.conf` (production: HTTP→HTTPS, `/api/` → mock-api:5190, storefront at `/`, market-admin at `/market-admin/`, merchant at `/merchant/`, courier at `/courier/`). `docker-compose.yml` defines services: `postgres`, `web-gateway` (Nginx), `whatsapp-service`, `mock-api`. |
| **PM2** | Not used in the current setup. All services run via **Docker Compose**. |

### Database (Postgres / Docker)

| Item | Detail |
|------|--------|
| **Connection string** | `postgresql://nmd:nmd@postgres:5432/nmd?schema=public` (inside Docker). From host: `postgresql://nmd:nmd@localhost:5433/nmd` (port **5433** mapped from container 5432). |
| **Container** | Service name **`postgres`** (image `postgres:16-alpine`). Multiple containers can match `name=postgres`; the one used for the audit had ID `34a79a43648b`. |
| **Persistence** | Data in named volume **`postgres_data`**. Survives `docker compose down/up` and rebuilds. |
| **Env** | `DATABASE_URL` is set in `mock-api` and `whatsapp-service` in `docker-compose.yml`. |

### WhatsApp Integration

| Item | Detail |
|------|--------|
| **OTP/WhatsApp provider** | Self-hosted **whatsapp-service** (WhatsApp Web via `whatsapp-web.js`). Sends OTP by WhatsApp message when mock-api calls the gateway. |
| **Gateway URL** | `http://whatsapp-service:3000` (from mock-api in Docker). Service listens on **port 3000** inside the container. |
| **Auth** | All requests to whatsapp-service require header **`x-api-key`** matching **`WA_API_KEY`** (e.g. `your_secret_key_here` in compose; override with `WA_API_KEY` env). |
| **Verified numbers** | No fixed “verified number” list in code. The WhatsApp session (volume `whatsapp_session`) is the linked phone; any number that can receive messages from that session can get OTP. |
| **OTP logic (mock-api)** | **`apps/mock-api/src/customer-auth.ts`**: in-memory OTP store, TTL 5 min, rate limit 5 requests/hour/phone, max 3 verify attempts, lock 10 min on abuse. **`apps/mock-api/src/index.ts`**: `POST /customer/auth/start` creates OTP and, if `WHATSAPP_GATEWAY_URL` and `WA_API_KEY` are set, calls `POST ${gatewayUrl}/send-otp` with `{ phone, code }` and `x-api-key`. `POST /customer/auth/verify` verifies code and creates/updates customer (DB or JSON per `STORAGE_DRIVER`). |
| **WhatsApp service routes** | **`apps/whatsapp-service/src/index.js`**: `POST /send-otp` (receives phone + code, sends via WhatsApp), `GET /health` (battery/connection state). Optional Postgres logging to `whatsapp_logs`. |

---

## 2. Database Content Audit

### Tenants / Stores (from Postgres)

| # | id (or slug) | slug | name | storeType | businessType |
|---|----------------|------|------|-----------|--------------|
| 1 | 78463821-ccb7-48af-841b-84a18c42abb6 | buffalo | BUFFALO28 | PROFESSIONAL | SERVICE |
| 2 | store-dab-bakery | dab-bakery | مخبز دبورية | (null) | RESTAURANT |
| 3 | store-dab-electronics | dab-electronics | إلكترونيات دبورية | (null) | RETAIL |
| 4 | store-dab-grocery | dab-grocery | بقالة الواحة | (null) | RETAIL |
| 5 | a7b8c9d0-e1f2-4a3b-8c9d-0e1f2a3b4c5d | lawyer-falan | مكتب المحامي نمر مصالحة | (null) | RETAIL |
| 6 | 5b35539f-90e1-49cc-8c32-8d26cdce20f2 | ms-brands | MS BRAND | PROFESSIONAL | SERVICE |
| 7 | 3f801fb9-f6f9-4e81-b3a2-f8954498cdac | obr | OBR | (null) | RETAIL |
| 8 | 1cc59722-3687-45a1-9121-e7a608fba225 | بيتسا-اشرف | بيتسا اشرف | (null) | RESTAURANT |
| 9 | 60904bcc-970a-45e3-8669-8015ee2afe64 | توب-ماركت | توب ماركت | (null) | RETAIL |
| 10 | f741d517-e7e6-48c9-a046-18d85acf1d25 | سوق-طلعت-للخضار-والفوكه | سوق طلعت للخضار والفوكه | (null) | RETAIL |
| 11 | 1c6f3866-a475-445e-8806-42065adea654 | مكتب-المحامي-يوسف-حسام-دراوشة | مكتب المحامي يوسف حسام دراوشة | (null) | RETAIL |

**Summary:** 11 tenants. **PROFESSIONAL + SERVICE:** `buffalo`, `ms-brands`. The rest are RETAIL or RESTAURANT with `storeType` null (they use RESTAURANT/RETAIL layout by default).

### Products / Services

| Metric | Value |
|--------|--------|
| **Total products in DB** | **15** |
| **By tenant (tenantId → count)** | MS BRAND (5b35539f...): 4; مكتب المحامي نمر مصالحة (a7b8c9d0...): 3; store-dab-grocery: 2; store-dab-electronics: 2; store-dab-bakery: 2; buffalo (78463821...): 1; مكتب المحامي يوسف حسام دراوشة (1c6f3866...): 1. |

No tenant named “Shaghaf” in the current DB; “Buffalo” has 1 product; “MS BRAND” has 4.

### Global Identity (unified users/customers)

| Entity | Count |
|--------|--------|
| **Customer** (storefront OTP signup/login) | **3** |
| **User** (admin/merchant/courier accounts) | **13** |

Customers are unified by phone (single record across tenants). Users are per-role (admin, tenant, market, courier).

---

## 3. Frontend Features & Routes

### Core Routes (Storefront — `apps/storefront/src/App.tsx`)

| Route | Description |
|-------|-------------|
| `/` | LandingLayout: markets picker (index) or my-activity |
| `/my-activity` | Under landing or tenant |
| `/daburiyya`, `/dabburiyya`, `/iksal` | Market layout: MarketHomePage, `/stores` → MarketStoresPage |
| `/:tenantSlug/*` | TenantGate → Layout: HomePage, p/:productId, c/:categoryId, category/:categoryId, products, cart, checkout, my-activity, order/:orderId/success |
| `/order/:orderId/print` | OrderPrintPage |
| `/order/:orderId/success` | LegacyOrderSuccessRedirect |
| `/merchant/dashboard` | MerchantDashboardPage |
| `/p/:productId` | LegacyProductRedirect (root-level) |

There is no explicit `/auth/otp` route; OTP is handled in modals (e.g. OtpLoginModal) and API calls to `/customer/auth/start` and `/customer/auth/verify`.

### Professional Logic (components and locations)

For tenants with **storeType === 'PROFESSIONAL'** or **businessType === 'SERVICE'**, the app uses “Professional” layout and components:

| Component | Role | Source |
|-----------|------|--------|
| **ProfessionalHero** | Hero section (about, logo, CTA, optional hero/banners slides). | `apps/storefront/src/components/ProfessionalHero.tsx`; used in **HomePage** when `isProfessional`. |
| **ProfessionalBar** | Bottom bar for professional stores (contact/CTA instead of cart). | `apps/storefront/src/components/ProfessionalBar.tsx`; used in **Layout** when `isProfessional` (else CartBar). |
| **Service list** | “خدماتنا” section with ServiceCard per product. | **HomePage.tsx**: when `isProfessional`, renders list of services (products) with `ServiceCard` and `AvailableSlotsPlaceholder`. |
| **Layout choice** | `storeType` / `businessType` set in TenantGate; Layout picks ProfessionalBar vs CartBar. | **App.tsx** (TenantGate): `useProfessionalLayout = storeType === 'PROFESSIONAL' \|\| businessType === 'SERVICE'`; **Layout.tsx**: `isProfessional ? <ProfessionalBar /> : <CartBar />`. |

Other Professional-related behavior: Header hides cart when `storeType === 'PROFESSIONAL'`; CartPage/CheckoutPage redirect or show message for professional stores; ProductPage shows contact/inquire instead of add-to-cart when professional; trackLead supports `PROFESSIONAL_CONTACT`.

---

## 4. Recent Fixes & Stable State

### “Professional Layout” fix (completed)

- **Data:** Tenants that should appear as Professional (e.g. ms-brands, buffalo) were updated in Postgres: `storeType = 'PROFESSIONAL'`, `businessType = 'SERVICE'`. (Slugs shaghaf, shaghaf-bakery were not present in DB; 2 rows updated.)
- **Code:** Professional components (ProfessionalHero, ProfessionalBar, Service list, CollectionSlider for retail) were already present. Restored **collections + CollectionSlider** on HomePage for retail stores when `branding.collections` is set (dynamic collection sliders).
- **Cleanup:** Removed temporary fix scripts: `fix_stores_final.ts`, `fix_stores_now.cjs`, `fix_shaghaf.js`, `fix_shaghaf.cjs` from `apps/mock-api/`.

### Git state

- **Latest commit:** `2837b454` — **STABLE: Professional stores layout restored and system cleaned**.
- **Working tree:** One untracked file at audit time: `apps/mock-api/data.json` (root of mock-api). Rest of changes are committed. Current state matches the “stable” checkpoint except for that optional file.

---

## 5. System Health Check

| Check | Result |
|-------|--------|
| **API (mock-api)** | **OK.** `GET http://localhost:3001/health` → **200** (host port 3001 maps to container 5190). |
| **Database** | **OK.** `pg_isready -U nmd -d nmd` inside Postgres container → accepting connections. |
| **Images** | In production, images are served as `https://nmd.marketing/api/uploads/<filename>` (Nginx proxies `/api/` to mock-api; mock-api serves static from UPLOADS_DIR at `/uploads`). A direct `GET /uploads/` on the API may 404 (no index); actual image URLs like `/uploads/<file>.jpg` work. Ensure `apps/mock-api/data/uploads` (or the mounted volume) contains the files referenced in tenant/product data. |

---

## Quick Reference

- **API base (production):** `https://nmd.marketing/api`
- **API base (local Docker):** `http://localhost:3001`
- **DB (from host):** `postgresql://nmd:nmd@localhost:5433/nmd`
- **DB (from container):** `postgresql://nmd:nmd@postgres:5432/nmd`
- **Storefront (production):** `https://nmd.marketing/`
- **Tenant storefront:** `https://nmd.marketing/<tenantSlug>`
- **OTP start:** `POST /customer/auth/start` (body: `{ phone }`)
- **OTP verify:** `POST /customer/auth/verify` (body: `{ phone, code, name? }`)
