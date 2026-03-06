# Database schema sync and default tenant

The **web-gateway** (and other production) containers do **not** have pnpm/Prisma installed. Schema sync and default-tenant setup must be run **from the host** or from a **temporary dev container** where `DATABASE_URL` is set.

## 1. Set DATABASE_URL

Ensure `apps/mock-api/.env` contains a valid PostgreSQL URL, for example:

- From host (if Postgres runs on host or is port-forwarded):  
  `DATABASE_URL=postgresql://nmd:nmd@localhost:5432/nmd`
- From host (Docker Postgres, same network):  
  `DATABASE_URL=postgresql://nmd:nmd@postgres:5432/nmd`

(See `apps/mock-api/.env.example`.)

## 2. Push schema

From the **repo root** (with pnpm available):

```bash
pnpm --filter mock-api db:push
```

To force sync and create new tables (e.g. `DeliveryZone`) even if it may cause data loss:

```bash
pnpm --filter mock-api db:push:force
```

This applies the current `prisma/schema.prisma` to the database. No Prisma in the container is required.

**Note:** In this repo Prisma lives in **mock-api**, not `@nmd/core`. Use `--filter mock-api`, not `--filter @nmd/core`.

## 3. Ensure "default" tenant exists

The storefront uses a fallback tenant id/slug `default` to load delivery zones and policies. Either:

**Option A – Full seed** (loads all data from `data.json` and also ensures default tenant):

```bash
pnpm --filter mock-api db:seed
```

**Option B – Only ensure default tenant** (no other data changes):

```bash
pnpm --filter mock-api ensure-default-tenant
```

After this, the database has a tenant with `slug: "default"`, `TenantDeliverySettings`, and one `DeliveryZone`, so the storefront can load delivery zones and policies.
