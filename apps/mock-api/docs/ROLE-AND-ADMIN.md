# Roles and platform admin

## Role values (correct strings)

- **Prisma**: The `User.role` column is a **String** (no enum in the schema). Any of the values below are valid.
- **Application** (`store.ts` `UserRole`): `'ROOT_ADMIN' | 'SUPER_ADMIN' | 'MARKET_ADMIN' | 'TENANT_ADMIN' | 'COURIER' | 'CUSTOMER'`.

For **platform super admin** (e.g. to see delivery settings in the Admin UI), use either:

- **`ROOT_ADMIN`** — used in seed and docs.
- **`SUPER_ADMIN`** — treated the same as `ROOT_ADMIN` in the API (same permissions).

There is no `ADMIN` role; use `ROOT_ADMIN` or `SUPER_ADMIN`.

## If delivery settings don’t show for you

Your account is probably `TENANT_ADMIN` (merchant). Promote your user to `ROOT_ADMIN`:

**By email (recommended):**

```bash
# From repo root (replace with your email)
pnpm --filter mock-api promote-user-to-root -- your@email.com

# Or with env
PROMOTE_USER_EMAIL=your@email.com pnpm --filter mock-api promote-user-to-root
```

- **Database**: set `DATABASE_URL`; the script updates the user in Prisma.
- **JSON**: set `DATA_FILE` to your `data.json` path (e.g. `apps/mock-api/data/data.json`); the script updates the `users` array in that file.

Then log out and log in again so the new role is reflected in the JWT.
