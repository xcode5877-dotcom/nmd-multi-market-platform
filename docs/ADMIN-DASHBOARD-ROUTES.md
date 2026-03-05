# Admin Dashboard – Routes, Auth and Tenant Access

## 1. Routes (verified)

Admin dashboards are **separate apps**; they are **not** in `apps/storefront/src/App.tsx`.

| App | Purpose | Base path | Login URL |
|-----|---------|-----------|-----------|
| nmd-admin | Platform admin (markets, root) | `/market-admin/` | **`/market-admin/login`** |
| admin (tenant) | Store management | `/merchant/` | **`/merchant/login`** |

- **There is no `/admin/login` and no `/dashboard/login`.** Use the URLs above.
- **Storefront** has a single route `/merchant/dashboard` (MerchantDashboardPage) that redirects to the tenant app or external URL; the actual store admin app is the **admin** app at base `/merchant/`.
- **nginx** serves: `/` → storefront, `/merchant/` → admin app, `/market-admin/` → nmd-admin app, `/api/` → mock-api.

## 2. Auth – mock-api (verified)

- Both apps call **`POST ${VITE_MOCK_API_URL}/auth/login`** with `{ email, password }`.
- **apps/nmd-admin** and **apps/admin** use `AuthContext` which posts to `${MOCK_API_URL}/auth/login` and stores the returned `accessToken`.
- Set **`VITE_MOCK_API_URL`** when building: e.g. `http://localhost:5190` for dev, or `https://nmd.marketing/api` (or `/api`) in production so login hits the mock-api.

## 3. Identity system (verified)

- **Admin routes** use the **Global Identity** flow:
  - **Email + password**: `POST /auth/login` with `{ email, password }` (used by both nmd-admin and admin login pages).
  - **OTP backdoor** (root only): same endpoint with `{ phone: "999", code: "1234" }` → logs in as `root@nmd.com`.
- **Customer (storefront)** identity is separate: Phone/OTP via `/customer/auth/*`; that is **not** used for admin login.

## 4. Tenant access – ms-brands@nmd.com (verified)

- In **data.json**: user `ms-brands@nmd.com`, password **`ms123456`**, role `TENANT_ADMIN`, `tenantId`: `5b35539f-90e1-49cc-8c32-8d26cdce20f2` (tenant slug `ms-brands`).
- **Store admin** (`/merchant/login`):
  - After login, **admin** app fetches `GET /auth/me` (token in header), then `GET /tenants/by-id/{me.tenantId}` to get tenant slug, then redirects to **`/?tenant=ms-brands`** (i.e. `/merchant/?tenant=ms-brands`).
  - The app then loads the dashboard for that tenant (orders, catalog, branding, etc.). So **ms-brands@nmd.com** lands on their **MS BRANDS store management page**.
- **Platform admin** (`/market-admin/login`):
  - Same user, after login, **nmd-admin**’s `IndexOrRedirect` sees `role === 'TENANT_ADMIN'` and redirects to **`/tenant`**.
  - The tenant portal uses the token’s `tenantId` and loads the same store (ms-brands) for management inside the platform admin app.

---

## Quick test checklist

1. **Route**: Open **https://nmd.marketing/merchant/login** (store admin) or **https://nmd.marketing/market-admin/login** (platform admin). Do **not** use `/admin/login` or `/dashboard/login`.
2. **Auth**: Ensure `VITE_MOCK_API_URL` is set so the login form submits to the mock-api (e.g. `/api` or full URL). Check browser Network tab: `POST /api/auth/login` (or your API base) should return `{ accessToken: "..." }`.
3. **Identity**: Log in with **email + password** (e.g. `ms-brands@nmd.com` / `ms123456`). Root can use OTP backdoor `phone=999`, `code=1234` if the login UI supports it (currently both UIs are email/password only).
4. **Tenant redirect**: Log in as **ms-brands@nmd.com** at **/merchant/login**. You should be redirected to **/merchant/?tenant=ms-brands** and see the MS BRANDS store dashboard (orders, catalog, branding, etc.).
