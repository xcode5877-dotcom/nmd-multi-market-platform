# Storage Matrix (Hybrid DB + JSON)

When `STORAGE_DRIVER=db`, mock-api uses a **hybrid** storage model: core entities live in the database, while config/content entities remain in JSON. This document describes the split and migration path.

---

## 1. What Uses DB (Pilot)

| Entity | Repo | Source | Prisma Model |
|--------|------|--------|--------------|
| markets | `repos.markets` | SQLite | `Market` |
| tenants | `repos.tenants` | SQLite | `Tenant` |
| users | `repos.users` | SQLite | `User` |
| couriers | `repos.couriers` | SQLite | `Courier` |
| customers | `repos.customers` | SQLite | `Customer` |
| orders | `repos.orders` | SQLite | `Order` |
| catalog | `repos.catalog` | SQLite | `CatalogCategory`, `CatalogProduct`, `CatalogOptionGroup` |

These are the **repo-backed** entities. They are switched by `STORAGE_DRIVER` and backed by Prisma/SQLite when `db` is set.

---

## 2. What Remains in JSON (Temporary)

| Entity | Store API | Source |
|--------|-----------|--------|
| campaigns | `getCampaigns`, `setCampaigns` | `data.json` → `campaigns` |
| delivery | `getDelivery`, `setDelivery` | `data.json` → `delivery` |
| deliveryZones | `getDeliveryZones`, `setDeliveryZones` | `data.json` → `deliveryZones` |
| deliveryJobs | `getDeliveryJobs`, `setDeliveryJobs` | `data.json` → `deliveryJobs` |
| templates | `getTemplates`, `setTemplates` | `data.json` → `templates` |
| staff | `getStaff`, `setStaff` | `data.json` → `staff` |
| auditEvents | `getAuditEvents`, `appendAuditEvent` | `data.json` → `auditEvents` |

These are **not** in the Repos interface. They always use `store.ts` and read/write `data.json`.

**Note:** `orders` when `STORAGE_DRIVER=json` uses `packages/mock/data/orders.json` (separate from `data.json`).

---

## 3. Why (Strangler Pattern)

- **Pilot:** Core transactional data (markets, tenants, users, couriers, customers, orders) is migrated first.
- **Lower risk:** Config/catalog data stays in JSON until migration is proven.
- **Incremental:** Each entity can be moved to DB independently.
- **Rollback:** `STORAGE_DRIVER=json` restores full JSON-only behavior.

---

## 4. Migration Path (Later)

| Step | Action |
|------|--------|
| 1 | Add Prisma models for catalog, campaigns, delivery, deliveryZones, deliveryJobs, templates, staff, auditEvents |
| 2 | Implement `*Repo` interfaces in `db-repos.ts` for each |
| 3 | Add `createDb*Repo` factories and wire them in `repos/index.ts` |
| 4 | Introduce `STORAGE_DRIVER=db` support for these entities (e.g. via env or config) |
| 5 | Add seed script to load from `data.json` into DB |
| 6 | Run `verify-storage-drivers.ts` to confirm parity |

---

## 5. File Paths

| Purpose | Path |
|---------|------|
| Repo selection (DB vs JSON) | `apps/mock-api/src/repos/index.ts` |
| Repo interfaces | `apps/mock-api/src/repos/types.ts` |
| JSON repos | `apps/mock-api/src/repos/json-repos.ts` |
| DB repos | `apps/mock-api/src/repos/db-repos.ts` |
| Store (JSON) | `apps/mock-api/src/store.ts` |
| Data file | `apps/mock-api/data.json` |
| Orders file (JSON mode) | `packages/mock/data/orders.json` |
| Prisma schema | `apps/mock-api/prisma/schema.prisma` |

---

## 6. Env

```bash
STORAGE_DRIVER=json   # default: all JSON
STORAGE_DRIVER=db     # hybrid: repos → DB, store → JSON
```
