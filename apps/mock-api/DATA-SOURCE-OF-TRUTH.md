# Data source of truth

**Canonical file:** `apps/mock-api/data.json` (at repo root under `apps/mock-api/`).

- Docker mounts this file as `/app/data/data.json` in the container (`DATA_FILE=/app/data/data.json`).
- All scripts that read or write tenant/market/catalog data must use this file only.
- **Do not** overwrite this file with an older backup or with `data/data.json`. If you run a script that writes JSON, set `DATA_FILE` to the path of this file (e.g. when in Docker, the container path is `/app/data/data.json`).
- `data/data.json` may exist as a copy; it is synced from the canonical file. Scripts must not write to `data/data.json` instead of the canonical path.
