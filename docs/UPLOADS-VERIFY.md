# Uploads verification

## Real-time sync

- **Nginx:** `location /api/uploads/` has `Cache-Control: no-store, no-cache, must-revalidate` so new/replaced images are not cached and appear immediately.
- **mock-api:** Serves files directly from the mounted volume (`/app/uploads` → host `apps/mock-api/uploads`). No in-memory caching; `express.static` reads from disk on each request.
- **Entrypoint:** On container start, `docker-entrypoint.sh` runs `chmod -R 777 /app/uploads` so the app can read/write the mounted dir.

## Case sensitivity

- The API tries a **case-insensitive** match for the filename: if the request is for `image.JPG` and only `image.jpg` exists in the uploads folder, the API serves `image.jpg`. This avoids 404s on Linux when URLs and filesystem case differ.

## Missing images (example check)

Referenced in **data.json** but **not** present in `apps/mock-api/uploads/` (as of last check):

| Referenced in data.json | Used by (example) | Action |
|-------------------------|-------------------|--------|
| `1772532322802-leodyihb.jpg` | Store logo (e.g. Shaghaf) | Add this file to `apps/mock-api/uploads/` or change the store’s `logoUrl` in data.json to an existing image. |
| `1772515525402-nueajgna.jpg` | MS BRAND logo | Add file or update `logoUrl`. |
| `1772515548660-csdwypi2.jpg` | MS BRAND hero image | Add file or update `imageUrl`. |

To fix: either copy the missing images into `apps/mock-api/uploads/` (same filename), or edit `data.json` and set the store’s `logoUrl` / hero `imageUrl` to a path that already exists (e.g. `https://nmd.marketing/api/uploads/1772370120646-4wvvc7wm.jpg`).

To list current uploads: `ls apps/mock-api/uploads/`.
