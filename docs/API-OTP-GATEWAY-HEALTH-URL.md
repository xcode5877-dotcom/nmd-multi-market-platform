# OTP Gateway Health Endpoint — Exact Public URL

## Backend (mock-api)

- **Mount:** Routes are registered directly on the Express app with **no** base path.
- **Path:** `GET /customer/auth/otp-gateway-health`
- **File:** `apps/mock-api/src/index.ts` (around line 754)

## Nginx (this repo)

- **Config:** `nginx.conf` in the repo root (production: `/api/` → mock-api).
- **Rule:** `location /api/` → `proxy_pass http://mock-api:5190/`  
  So the **`/api` prefix is stripped** when proxying. The backend receives `GET /customer/auth/otp-gateway-health`.

## Exact public URLs

| Domain (server_name in Nginx) | Full URL |
|-------------------------------|----------|
| **nmd.marketing** (current config) | **https://nmd.marketing/api/customer/auth/otp-gateway-health** |
| **now.marketing** (if you use this hostname) | **https://now.marketing/api/customer/auth/otp-gateway-health** |

Use **HTTPS** in production. No trailing slash.

## Storefront (WebView / browser)

The storefront calls this endpoint via `VITE_MOCK_API_URL`:

- **Build-time env:** `VITE_MOCK_API_URL` must be the **API base including `/api`**, with **no trailing slash**.
  - Example: `https://nmd.marketing/api`
- **Resulting request:** `fetch(\`${VITE_MOCK_API_URL}/customer/auth/otp-gateway-health\`)`  
  → `https://nmd.marketing/api/customer/auth/otp-gateway-health`

Set in production (e.g. CI/CD or `.env.production`):

```bash
VITE_MOCK_API_URL=https://nmd.marketing/api
```

## Android app

- **`web_base_url`** in `app/src/main/res/values/strings.xml` is the **storefront** URL (the page loaded in the WebView), e.g. `https://nmd.marketing`.
- The Android app **does not** call the API directly for auth or OTP; the WebView loads the storefront, and the storefront JavaScript uses `VITE_MOCK_API_URL` to call the API.
- So there is **no** API base URL or path to set in MainActivity or Android constants for this endpoint. Just ensure:
  - **Storefront is built** with the correct `VITE_MOCK_API_URL` (e.g. `https://nmd.marketing/api`).
  - **`web_base_url`** points to the same origin as the storefront (e.g. `https://nmd.marketing`).

## Quick check

```bash
# Replace with your real domain if different
curl -s https://nmd.marketing/api/customer/auth/otp-gateway-health
```

Expected: JSON like `{"gatewayConfigured":true,"gatewayReachable":false,"ready":false}` (or `true`/`true` when the gateway is up).
