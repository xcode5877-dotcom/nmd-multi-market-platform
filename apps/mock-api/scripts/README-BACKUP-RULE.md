# Backup-first rule (NO DATA LOSS)

**Any script that modifies `data.json`, `market-config.json`, or the `uploads/` folder MUST trigger a backup first.**

## Quick backup (no wipe)

From `apps/mock-api`:

```bash
BACKUP_ONLY=1 pnpm exec tsx scripts/backup-then-wipe-images.ts
```

This creates a timestamped backup under `backups/pre-wipe-<timestamp>/` and exits without modifying data or uploads.

## Full backup + wipe (when intended)

- **Backup:** Timestamped dir under `backups/pre-wipe-<timestamp>/` with `data.json`, `market-config.json`, and `uploads.tar.gz`.
- **Wipe:** Run the same script with default flags to also wipe image URLs and flush uploads.

## Scripts that modify data

- `sync-audit-tenants-and-images.ts` – run a backup before this if you have not already.
- `backup-then-wipe-images.ts` – creates backup first, then (by default) wipes images and flushes uploads.
- `compress-uploads-webp.ts` – updates URLs in data.json; run a backup before use.

## Restore from backup

Copy from `backups/pre-wipe-<timestamp>/` back to `apps/mock-api/data.json`, `apps/mock-api/market-config.json`, and extract `uploads.tar.gz` into `apps/mock-api/uploads/`.
