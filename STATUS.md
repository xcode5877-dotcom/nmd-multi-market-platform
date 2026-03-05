# Milestone Zero — Stable State (Pre-Database)

**Frozen:** Stable state before Database Schema (PostgreSQL) and Media Uploads work.

---

## 1. MIME Type / 404 Fix (Resolved)

- **Issue:** Admin dashboards (market-admin, merchant) were serving `index.html` for missing or stale JS assets, causing the browser to report MIME type `text/html` instead of `application/javascript`.
- **Root cause:** Phantom assets (old build hashes referenced in `index.html` after rebuild) and Nginx `try_files` falling back to `index.html` for asset paths.
- **Fix applied:**
  - Single **global root** in Nginx: `root /usr/share/nginx/html;` for the HTTPS server block.
  - **Dedicated asset locations** with **hard 404**: `location ^~ /market-admin/assets/` and `location ^~ /merchant/assets/` using `try_files $uri =404` so missing files return 404 and never `index.html`.
  - **Clean build:** `rm -rf dist` before build in admin and nmd-admin (`package.json` scripts).
  - **Dockerfile:** `RUN rm -rf /usr/share/nginx/html/merchant /usr/share/nginx/html/market-admin` before COPY so the image never serves stale assets from a cached layer.
  - **Cache busting (dev):** `Cache-Control: no-store, no-cache, must-revalidate` on admin assets and SPA routes.
- **Config:** `include /etc/nginx/mime.types;` at the top of the server block; no manual `Content-Type` in asset blocks.

---

## 2. Current Working Login (Admin)

| Purpose        | Email           | Password | Notes |
|----------------|-----------------|----------|--------|
| Root admin     | **root@nmd.com**| **123456** | Platform admin (nmd-admin at `/market-admin/`). |
| OTP backdoor   | —               | —        | `POST /auth/login` with `{ "phone": "999", "code": "1234" }` logs in as root@nmd.com. |

- **Store admin (merchant):** `/merchant/` — e.g. **ms-brands@nmd.com** / **ms123456** for tenant ms-brands.
- **Market admin:** e.g. **dab@nmd.com** / **123456** for market dabburiyya.

---

## 3. Current Build Hashes (Snapshot)

| App          | Main chunk (index)   |
|-------------|----------------------|
| **merchant** (admin)  | `index-Dm7LX8KL.js`  |
| **market-admin** (nmd-admin) | `index-CXGgR1sC.js` |

These are the hashes in `index.html` at freeze time. Rebuilding will produce new hashes; the backup and this file record the state at Milestone Zero.

---

## 4. Global Identity System (Current Logic)

- **Admin (dashboard) login:**  
  - **Email + password:** `POST /auth/login` with `{ email, password }`.  
  - **OTP backdoor (root only):** same endpoint with `{ phone: "999", code: "1234" }` → treated as root@nmd.com.
- **Customer (storefront):**  
  - **OTP-based:** `GET /customer/auth/check-phone`, `POST /customer/auth/start`, `POST /customer/auth/verify` (phone + code; optional name on signup).  
  - No separate “admin” OTP for customers; admin stays on email/password (and root OTP backdoor).

---

## 5. Backup & Restore

- **Config backup:** `backups/stable-v1-pre-db/` contains copies of:
  - `docker-compose.yml`
  - `nginx.conf`
  - `Dockerfile.web`, `Dockerfile.mock-api`, `Dockerfile.storefront`
- **State snapshot script:** `scripts/backup-current-state.sh`  
  Creates a timestamped `state-YYYYMMDD-HHMMSS.tar.gz` in `backups/stable-v1-pre-db/` containing `docker-compose.yml`, `nginx.conf`, all Dockerfiles, and `apps/storefront/dist`, `apps/courier/dist`, `apps/admin/dist`, `apps/nmd-admin/dist` (if present).  
  Run from repo root: `./scripts/backup-current-state.sh`

---

## 6. Git Tag (Optional)

To mark this state in Git:

```bash
git tag stable-v1-dashboards-live
git push origin stable-v1-dashboards-live   # if using a remote
```

---

**Next steps:** Database Schema design (PostgreSQL) and Media Uploads implementation.
