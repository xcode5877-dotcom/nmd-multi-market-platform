# Persistent storage for uploads

Uploaded images (market images, store logos, banners) are stored on disk so they **survive rebuilds** when you use a persistent directory.

## Default behaviour

- **UPLOADS_DIR** is not set: uploads go to `./data/uploads` (relative to mock-api process cwd). The directory is created automatically.
- **UPLOADS_DIR** is set (env): uploads go to that absolute path.

## Ensuring uploads survive builds

1. **Local dev**  
   From `apps/mock-api`, uploads go to `apps/mock-api/data/uploads`. This folder is typically not in the build output, so it persists across `pnpm build` as long as you don’t delete `data/`.

2. **Docker**  
   Mount a volume for uploads so the container can write and the host keeps the files:
   - Map `./data` (or a dedicated host folder) to the app’s data directory, e.g. `/app/data`, and set **UPLOADS_DIR=/app/data/uploads**, or
   - Map a host folder to **UPLOADS_DIR** directly, e.g. `-v ./uploads:/app/uploads` and `UPLOADS_DIR=/app/uploads`.

3. **Example env**  
   ```bash
   # Optional: custom path for uploads (must exist or be writable by the process)
   UPLOADS_DIR=/app/data/uploads
   ```

## Backup

Before any operation that modifies `data.json` or the uploads folder, create a backup (see `scripts/README-BACKUP-RULE.md`). For a full **database + code snapshot** (data.json and optional git tag), run from repo root:

```bash
./scripts/backup-database-and-snapshot.sh       # backup only
./scripts/backup-database-and-snapshot.sh --tag # backup + git tag stable-YYYY-MM-DD
```
