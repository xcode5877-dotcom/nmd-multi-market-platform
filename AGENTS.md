# AGENTS.md

## Cursor Cloud specific instructions

### Overview

NMD is a pnpm monorepo (pnpm@9.14.2) with 6 apps and 4 shared packages. It is a multi-tenant Arabic RTL e-commerce platform. No external databases or services are required — the mock-api uses local JSON file storage by default.

### Shared packages build order

Packages must be rebuilt whenever their source changes. Build order:

```
@nmd/core → @nmd/mock, @nmd/ui, @nmd/customer-auth → apps
```

Commands: see `Quick Start` section of `README.md`.

### Running services for development

1. **mock-api** (required): `pnpm dev:mock-api` — Express backend on port 5190
2. **storefront**: `pnpm dev:storefront` — Vite dev server on port 5173
3. **admin**: `pnpm dev:admin` — port 5174
4. **nmd-mall**: `pnpm dev:mall` — port 5175
5. **nmd-admin**: `pnpm dev:superadmin` — port 5176
6. **courier**: `pnpm dev:courier`

### Local environment override

The committed `.env.development` files point to an external production IP (`147.93.120.244:5190`). For local development, create `.env.local` files in each app directory with `VITE_MOCK_API_URL=http://localhost:5190`. These are gitignored via the `.env.*` pattern in `.gitignore`.

### Lint and format

- **ESLint**: `npx eslint . --ignore-pattern '**/dist/**'` — the flat config (`eslint.config.js`) ignores `dist/` and `node_modules/`, but the CLI needs `--ignore-pattern '**/dist/**'` to properly exclude built package output.
- **Prettier**: `pnpm format` (writes) or `npx prettier --check "**/*.{ts,tsx}" --ignore-path .gitignore` (check only).
- **Typecheck**: `pnpm typecheck` runs `tsc --noEmit` across all packages.
- Pre-existing lint warnings exist in the codebase (2 errors in `apps/mock-api/src/index.ts`); pre-existing Prettier issues exist in ~153 files.

### Testing

No automated test framework is configured. QA is manual — see `docs/QA_CHECKLIST.md`.

### Build

- `pnpm build:storefront` — production build for the storefront app.
- `pnpm build` — builds everything recursively.
