# Arabic encoding (UTF-8) and image persistence

## Character encoding (UTF-8)

- **API responses**: All JSON responses send `Content-Type: application/json; charset=utf-8` so browsers interpret Arabic (and other non-ASCII) correctly. Without this, Arabic can appear as `?????`.
- **Files**: `data.json`, `market-config.json`, and `orders` are read/written with `utf-8` encoding (`readFileSync`/`writeFileSync` with `'utf-8'`).
- **Docker**: `Dockerfile.mock-api` and `Dockerfile.web` set `LANG=C.UTF-8` and `LC_ALL=C.UTF-8` so the environment supports non-ASCII characters.

**Verification**: After saving a market name (or any text) in Arabic in the Admin, reload the page or open the Storefront; the text should remain Arabic and not turn into `?????`.

## Image filenames and URLs

- **Filenames**: Uploaded files are stored with **sanitized names** only: `{timestamp}-{random}.{ext}` (e.g. `17102024-abc12def.jpg`). The original filename is never used on disk, so Arabic or special characters in the user’s filename do not break the URL path.
- **Extension**: Only safe image extensions are allowed: `jpg`, `jpeg`, `png`, `webp`, `gif`. Any other or non-ASCII characters in the extension are replaced with `jpg`.
- **URL**: The API returns **absolute** image URLs when `PUBLIC_URL` is set (e.g. `PUBLIC_URL=https://nmd.marketing/api`). The Storefront and Admin use these URLs as-is, so images load from the same origin (or the configured API origin).

## Serving uploads (Nginx / gateway)

- **mock-api** serves files from `UPLOADS_DIR` at path `/uploads/` (e.g. `GET /uploads/17102024-abc12def.webp`).
- **Nginx** (e.g. `nginx.conf`) proxies `location /api/uploads/` to `http://mock-api:5190/uploads/`, so the public URL is `https://nmd.marketing/api/uploads/...`. Ensure the web gateway is configured this way so the Storefront can load images.

## Global data sync (market imageUrl)

- Market data (including `name`, `imageUrl`, `slug`, etc.) is stored in the **same store** as the rest of the API: either **data.json** (JSON driver) or the **database** (DB driver).
- When the Admin updates a market (e.g. `PUT /markets/:id` with `imageUrl` or Arabic name), the change is persisted to that store. `GET /markets` and the Storefront (e.g. MarketsPickerPage) read from the same store, so they see updates immediately—no separate sync to `market-config.json` is needed for market list or market image. (`market-config.json` is used for **banners and layout** per market, not for the market list.)
