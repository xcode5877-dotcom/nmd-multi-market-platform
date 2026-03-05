# Hero Images Persistence — Investigation Report

**Scope:** Market page Hero (banner carousel) images disappear; product images appear to persist. Investigation only — no fixes applied.

---

## 1. Storage path: where does mock-api save Hero (banner) images?

- **Market “Hero”** on the storefront is the **banner carousel** at the top of the Market home page (e.g. `/dabburiyya`). Data comes from **market-level banners**, not tenant hero.
- **Upload endpoint:** `POST /upload/banner` (single file, field name `file`).
- **File storage path (on disk):**
  - `UPLOADS_BANNERS_DIR = join(UPLOADS_DIR, 'banners')`
  - So files are saved under **`<UPLOADS_DIR>/banners/`**.
- **`UPLOADS_DIR`** is set as:
  - Env: `process.env.UPLOADS_DIR` if set.
  - Docker: when `process.cwd() === '/app/apps/mock-api'` → **`/app/apps/mock-api/uploads`**.
  - Local: **`<repo>/packages/mock/uploads`**.
- So in Docker, Hero/banner image **files** are stored at:
  - **`/app/apps/mock-api/uploads/banners/<timestamp>-<random>.<ext>`**

**Where banner metadata (which image is which) is stored:**

- Banner list (id, imageUrl, title, linkTo, active) is **not** in `DATA_FILE` or Postgres.
- It is in **`market-config.json`**, which is loaded/saved by `apps/mock-api/src/market-config.ts`.
- **Config file path:** `CONFIG_FILE = join(process.cwd(), 'market-config.json')`  
  → In Docker: **`/app/apps/mock-api/market-config.json`** (inside the container, next to the app).
- After upload, the API returns a **full image URL** (e.g. `https://nmd.marketing/api/uploads/banners/xyz.jpg`). The admin (or client) then calls **`PUT /markets/by-slug/:slug/banners`** with the new banner list including that `imageUrl`. That list is written to **`market-config.json`** only (see `setBannersForMarket` → `save(store)`).

**Summary:**

- **Hero image files:** `UPLOADS_DIR/banners/` → in Docker **`/app/apps/mock-api/uploads/banners/`**.
- **Hero image metadata (and thus which URL is shown):** **`market-config.json`** at **`/app/apps/mock-api/market-config.json`** (process cwd).

---

## 2. Docker volumes: is that path on a persistent volume?

**From `docker-compose.yml` (mock-api service):**

```yaml
volumes:
  - ./data:/data
  - uploads_data:/app/apps/mock-api/uploads
```

- **`./data`** is bound to **`/data`** (for `DATA_FILE`, `ORDERS_FILE`, etc.).
- **`uploads_data`** (named volume) is bound to **`/app/apps/mock-api/uploads`**.

So:

- **Banner image files** live under **`/app/apps/mock-api/uploads/banners/`**, which is inside **`/app/apps/mock-api/uploads`** → that **is** on the persistent volume **`uploads_data`**. So the **files** persist across container restarts/recreates.
- **`market-config.json`** is at **`/app/apps/mock-api/market-config.json`**, i.e. in the app directory, **not** under `/data` and **not** under `/app/apps/mock-api/uploads`. So it is **not** on any volume. It lives only on the container filesystem and is **lost** on `docker compose down` / image rebuild / new container.

**Conclusion:**

- Hero **image files**: stored on a **persistent** volume (`uploads_data`).
- Hero **configuration** (which banners exist and their `imageUrl`s): stored in **`market-config.json`**, which is **not** on a persistent volume, so it is **not** persisted across container recreates.

---

## 3. Frontend: how is the Hero image URL built?

- **API:** Storefront calls **`GET /markets/by-slug/:slug/banners`** (e.g. for `dabburiyya`). That returns the array of banners from **`getBannersForMarket(slug)`** in `market-config.ts`, i.e. from **`market-config.json`** (or seed defaults if file missing).
- **Response shape:** Each banner has **`imageUrl`** (full URL), e.g. `https://nmd.marketing/api/uploads/banners/1234567890-abc.jpg`.
- **Storefront:** `MarketHomePage.tsx` keeps that in `promos` and renders the carousel with **`b.imageUrl`** directly:
  - `src={b.imageUrl || BANNER_PLACEHOLDER}`
- So the frontend does **not** construct the URL; it uses the **full `imageUrl`** returned by the API. The API builds that URL at upload time using **`UPLOAD_BASE`** (`PUBLIC_URL` or `http://localhost:PORT`) and **`/uploads/banners/<filename>`**.

So:

- Hero image URLs **point to** the uploads path (e.g. `.../api/uploads/banners/...`), which is the same volume-backed directory where files are saved.
- If those URLs “disappear”, it is because the **list of banners** (and thus the `imageUrl` values) is lost when **`market-config.json`** is lost, not because the frontend builds the path wrongly.

---

## 4. Comparison: why do product images “stay” but Hero images “disappear”?

**Product images**

- **Upload:** `POST /upload` → file saved under **`UPLOADS_DIR`** (same base as banners: **`/app/apps/mock-api/uploads`**), so also on **`uploads_data`**.
- **URL storage:** The returned URL is stored **in the catalog** (product’s `imageUrl` or `images[].url). Catalog is persisted in:
  - **JSON mode:** part of the data written to **`DATA_FILE`** (e.g. **`/data/data.json`**), which is mounted from **`./data`** → **persistent**.
  - **DB mode:** in **Postgres** (e.g. catalog tables) → **persistent** (postgres_data volume).
- So both the **file** (uploads volume) and the **reference** (catalog in `/data` or DB) persist. Product images therefore “stay”.

**Hero (market banner) images**

- **Upload:** `POST /upload/banner` → file saved under **`UPLOADS_DIR/banners`** → same **`uploads_data`** volume → **files persist**.
- **URL storage:** The returned URL is stored only when the admin updates the market’s banners via **`PUT /markets/by-slug/:slug/banners`**. That updates in-memory config and writes **`market-config.json`** in **`process.cwd()`** → **`/app/apps/mock-api/market-config.json`**, which is **not** on any volume.
- So after a container recreate, **`market-config.json`** is gone (or reset). The API falls back to **seed/default banners** (e.g. placehold.co or seed `imageUrl`s). Any previously uploaded Hero image URLs that were only stored in `market-config.json` are lost, even though the files are still on `uploads_data`.

**Summary**

| Aspect              | Product images                    | Hero (market banner) images        |
|---------------------|-----------------------------------|------------------------------------|
| File storage        | `UPLOADS_DIR` (uploads volume)   | `UPLOADS_DIR/banners` (same volume) |
| Where URL is stored | Catalog (DATA_FILE or Postgres)   | `market-config.json` (container only) |
| Volume for URL data| `./data` or postgres_data         | **None**                           |
| After container recreate | Files + URLs persist         | Files persist, **URLs lost**       |

So the difference is **not** in where the image files are stored (both use the same uploads volume), but in **where the image URL is stored**: catalog is on a persistent volume/DB, while market banners are only in **`market-config.json`**, which is not on a persistent volume. That is why Hero images “disappear” (their references are lost) while product images appear to stay.

---

## 5. Summary

- **Storage path (Hero files):** `UPLOADS_DIR/banners` → in Docker **`/app/apps/mock-api/uploads/banners/`** (backed by **`uploads_data`**).
- **Docker volumes:** Hero **files** are on the persistent volume **`uploads_data`**. Hero **metadata** (banner list and `imageUrl`s) is in **`market-config.json`**, which is **not** on any volume.
- **Frontend:** Uses the **full `imageUrl`** from `GET /markets/by-slug/:slug/banners`; it does not construct the path.
- **Why Hero disappears but product images stay:** Product image URLs live in catalog (DATA_FILE or DB), which is persistent. Hero image URLs live only in **`market-config.json`**, which is not on a volume and is lost on container recreate.

No code or deployment changes were made; this document is for investigation only.
