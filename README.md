# NMD Multi-Tenant Ecosystem

Phase 1.1 foundation for NMD's multi-tenant e-commerce platform. Built with React, Vite, TypeScript, and TailwindCSS.

## Project Structure

```
nmdnew/
├── apps/
│   ├── storefront/      # Tenant storefront (customer-facing)
│   ├── admin/           # Tenant Admin (per-tenant management) — alias: tenant-admin
│   ├── nmd-mall/        # Public portal (store directory)
│   └── nmd-admin/       # NMD Super Admin (platform management)
├── packages/
│   ├── core/            # Types, utils, tenant logic, API adapters
│   ├── ui/              # Shared design system components
│   └── mock/            # Mock API + localStorage persistence + TenantRegistry
├── pnpm-workspace.yaml
└── package.json
```

## Ports

| App | Port | Description |
|-----|------|-------------|
| storefront | 5173 | Tenant storefront |
| admin | 5174 | Tenant Admin |
| nmd-mall | 5175 | NMD Mall (public portal) |
| nmd-admin | 5176 | NMD Super Admin |

## Quick Start

```bash
pnpm install
pnpm --filter @nmd/core build
pnpm --filter @nmd/mock build
pnpm --filter @nmd/ui build

# Run individual apps
pnpm dev:storefront
pnpm dev:admin
pnpm dev:mall
pnpm dev:superadmin
```

## Key localStorage Keys

| Key | Purpose |
|-----|---------|
| `nmd.tenants` | Tenant registry (single source of truth) |
| `nmd.orders` | All orders across tenants |
| `nmd.catalog` | Catalog per tenant (categories, products, optionGroups) |
| `nmd.campaigns` | Campaigns per tenant (discounts) |
| `nmd.delivery` | Delivery settings per tenant (modes, zones, fees) |
| `nmd.templates` | System layout templates |
| `nmd.staff` | Staff users per tenant |
| `nmd.lastTenant` | Last selected tenant (dev) |
| `nmd-cart` | Cart state per tenant |
| `nmd-admin-*` | Tenant Admin overrides (categories, products, branding per tenant) |

## Dev Tenant Selection

- **URL:** Add `?tenant=slug` (e.g. `?tenant=pizza`)
- **Fallback:** Uses `nmd.lastTenant` when no `?tenant` in URL
- **TenantSwitcher:** Shown in storefront header (dev only, pass `visible={import.meta.env.DEV}`)

## What Changed (Phase 1.1)

### New Apps
- **nmd-mall:** Home, /stores, /store/:slug (store preview + "Open Store" link)
- **nmd-admin:** Dashboard, /tenants (CRUD), /tenants/:id (Branding/Catalog/Orders tabs), /system/templates (placeholder)

### packages/mock (NEW)
- **TenantRegistry:** `listTenants`, `getTenantBySlug`, `createTenant`, `updateTenant`, `toggleTenant`
- **OrdersStore:** `listOrders`, `listOrdersByTenant`, `getOrdersToday`, `getOrdersThisWeek`, `addOrder`
- **CatalogStore:** `getCatalog`, `setCatalog` per tenant
- **MockApiClient:** Resolves tenant via registry; creates orders in OrdersStore
- **Seed:** 3 demo tenants (pizza, groceries, apparel)

### packages/core
- **resolveTenantFromUrl():** `?tenant=slug` or `nmd.lastTenant`
- **setLastTenant():** Persist last selected tenant
- **LAST_TENANT_KEY:** `nmd.lastTenant`
- Removed MockApiClient (moved to @nmd/mock)

### packages/ui
- **TenantSwitcher:** Dev-only tenant dropdown (pass `visible` prop)

### apps/storefront
- Tenant selection screen when no tenant
- Uses @nmd/mock, initMock, resolveTenantFromUrl
- TenantSwitcher in header
- Cart/orders use tenant.id from registry

### apps/admin (Tenant Admin)
- Label updated to "Tenant Admin"
- Tenant selection screen when no tenant
- Uses @nmd/mock, AdminContext for tenantId
- admin-data: createAdminData(tenantId), integrates with catalog store
- Orders page: filters by tenantId from OrdersStore

## Phase 1.2 — Implemented

### New Routes

| App | Route | Purpose |
|-----|-------|---------|
| admin | `/campaigns` | List campaigns |
| admin | `/campaigns/new` | Create campaign |
| admin | `/campaigns/:id/edit` | Edit campaign |
| admin | `/settings/delivery` | Delivery settings (modes, zones, fees) |
| admin | `/catalog/options` | Option builder (groups + items) |
| nmd-admin | `/tenants/:id` | Tenant detail (Branding, Catalog, Orders tabs) |

### New Features

- **Campaigns:** CRUD, toggle status, schedule (start/end), appliesTo (ALL/CATEGORIES/PRODUCTS)
- **Delivery:** Pickup/delivery toggles, min order, delivery fee, zones CRUD
- **Options:** Group + item CRUD, scope, min/max selection, priceDelta, defaultSelected
- **Storefront:** Campaign banners, discounted prices (product/cart), delivery zones in checkout, PIZZA WHOLE/LEFT/RIGHT tabs
- **NMD Admin:** Catalog tab (counts), Orders tab (last 20), links to Tenant Admin and Storefront

## Phase 1.3 — Launch-readiness UX + Operations

### New Routes

| App | Route | Purpose |
|-----|-------|---------|
| nmd-admin | `/system/templates` | System templates (assign to tenant) |
| admin | `/settings/staff` | Staff users CRUD |
| admin | `/orders/board` | Kitchen board view |
| storefront | `/order/:id/success` | Order success (WhatsApp, Print) |
| storefront | `/order/:id/print` | Print-friendly order |
| nmd-mall | `/search?q=` | Search products across tenants |

### New Features

- **System templates:** minimal, cozy, bold, modern; assign to tenant; LayoutShell variants
- **Staff:** OWNER, MANAGER, STAFF roles; CRUD at /settings/staff
- **WhatsApp + Print:** buildWhatsAppMessage, wa.me link after order; print view
- **Orders:** Today/All filter, status filter, search by ID; quick status buttons; board view
- **Catalog quality:** inStock, quantity, lowStockThreshold; badges "نفد" / "آخر X قطع"; disable add-to-cart if out of stock
- **Mall search:** /search?q=; results grouped by tenant; links open storefront with ?tenant=slug

## Phase 1.4 — UI/UX Final Polish

### UI Conventions (packages/ui)

- **Typography scale:** Display, H1, H2, H3, Body, Small, Caption (see `design-tokens.css`)
- **Spacing:** Container widths, section padding (`p-4`/`p-6`), card padding (`p-4`/`p-6`), grid gaps (`gap-4`/`gap-6`)
- **Components:**
  - `PageHeader` — title, subtitle, actions
  - `FiltersBar` — search, chips, selects
  - `DataTable` — sticky header, row hover, empty state, optional `onRowClick`
  - `Drawer` — right-side (RTL: start) panel for details
  - `InlineBadge` — order status (New/Preparing/Ready/Completed/Cancelled)
  - `EmptyState` — variants: no-data, no-results, error
- **RTL:** Icons and inputs use `ps-`/`pe-` for padding; Drawer side `start` = right in RTL

### Components Added/Updated

| Component | Location | Purpose |
|-----------|----------|---------|
| PageHeader | @nmd/ui | Page title + subtitle + actions |
| FiltersBar | @nmd/ui | Search + chips + selects |
| DataTable | @nmd/ui | Table with sticky header, row hover, empty state |
| InlineBadge | @nmd/ui | Order status badges |
| EmptyState | @nmd/ui | No data / no results / error states |
| design-tokens.css | @nmd/ui | Typography + spacing vars |

### Key UX Improvements

- **Storefront:** CartBar (mobile sticky), header search expand on focus, product page sticky add-to-cart, collapsible "ملخص اختياراتك", hero + category chips, skeletons
- **Tenant Admin:** Collapsible sidebar (localStorage), Orders drawer with quick status buttons, Products table + edit drawer, Branding live preview, Onboarding checklist
- **NMD Mall:** "قرية الدبورية التقنية" hero, featured stores, category chips, search result highlighting, "فتح المتجر" CTA per group, store preview with products
- **NMD Super Admin:** Tenants table with enable toggle, icon links to Admin/Storefront, Template Preview gallery
