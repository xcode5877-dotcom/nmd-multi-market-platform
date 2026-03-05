# Store Management / Tenant Settings — Sitemap & Architecture

This document maps the **Store Management (Tenant Settings)** view and the **4-Tab layout** used in the admin dashboard.

---

## Route vs. App (Important)

| Route | App | Component | 4 Tabs? |
|-------|-----|-----------|---------|
| **/tenants/:id** | nmd-admin | TenantDetailPage | ✅ Yes |
| **/markets/:id/tenants/:tenantId** | nmd-admin | TenantDetailPage | ✅ Yes |
| **/merchant/settings/store** | apps/admin | StoreSettingsPage | ❌ No (different layout) |

The **4 Tabs (basic, products, orders, settings)** and the Cards layout described below live in **nmd-admin** at the tenant detail routes above, **not** at `/merchant/settings/store`. Use this sitemap when editing the **Market/Global Tenant → Store Detail** view.

---

## 1. Current Architecture (ASCII Tree)

```
TenantDetailPage (apps/nmd-admin/src/pages/TenantDetailPage.tsx)
│
├── Header
│   ├── Back link (→ /markets/:id/tenants or /tenants)
│   ├── Tenant avatar + name + slug + Badge
│   └── Actions
│       ├── تطبيق قالب جاهز (applyTemplateMutation)
│       ├── إعادة تعيين كلمة المرور (→ Reset Password Modal)
│       ├── فتح لوحة المستأجر (adminUrl)
│       ├── فتح المتجر (storefrontUrl)
│       └── إعدادات التوصيل (Link → .../settings/delivery)
│
└── Tabs (value=tab, onChange=setTab)
    │
    ├── [Tab] المعلومات الأساسية (value="basic")  ← DEFAULT
    │   └── <div className="space-y-6">
    │       ├── Card: "الاسم والنبذة"
    │       │   ├── Name input (nameLocal / setNameLocal)
    │       │   └── About textarea (aboutLocal / setAboutLocal)
    │       ├── Card: "العلامة التجارية (Logo / Colors)"
    │       │   └── primaryColor, secondaryColor, fontFamily (read-only)
    │       └── Button: "حفظ محتوى الواجهة" → handleSaveStorefront
    │
    ├── [Tab] المنتجات (value="products")
    │   └── <div className="space-y-6">
    │       └── Card: "الكتالوج"
    │           └── Counts: categories, products, optionGroups
    │
    ├── [Tab] الطلبات (value="orders")
    │   └── <div className="space-y-6">
    │       └── Card: "الطلبات"
    │           └── Table: last 20 orders (+ جاهز للاستلام when applicable)
    │
    └── [Tab] الإعدادات (value="settings")
        └── <div className="space-y-6">
            ├── Card: "وضع المتجر (Store Mode)"
            │   └── Radio: RESTAURANT | PROFESSIONAL (storeTypeLocal)
            ├── Card: "ساعات العمل (Business Hours)"
            │   ├── Open time (openTimeLocal) / Close time (closeTimeLocal)
            │   └── Force Closed checkbox (forceClosedLocal)
            ├── Button: "حفظ الإعدادات العامة" → handleSaveGeneral
            ├── Card: "إعدادات إضافية"
            │   └── Link: إعدادات التوصيل → .../settings/delivery
            └── Card: "منطقة الخطر"
                └── Button: "حذف المتجر" (red outline) → setDeleteStoreModalOpen(true)
    │
    ├── Modal: "حذف المتجر" (deleteStoreModalOpen)
    │   └── Confirm → deleteStoreMutation.mutate()
    │
    └── Modal: "إعادة تعيين كلمة المرور" (resetPasswordOpen)
        └── resetPasswordMutation
```

---

## 2. Technical Details

### State Management

| Purpose | Where | Type |
|---------|--------|------|
| **Active tab** | `tab` | `useState('basic')` — default: المعلومات الأساسية |
| Name / About | `nameLocal`, `aboutLocal` | `useState` synced from `tenant` |
| Store mode & hours | `storeTypeLocal`, `openTimeLocal`, `closeTimeLocal`, `forceClosedLocal` | `useState` synced from `tenant` |
| Delete modal | `deleteStoreModalOpen` | `useState(false)` |
| Reset password modal | `resetPasswordOpen` | `useState(false)` |

### API Integration

| UI Action | Method / Endpoint | Mutation / Handler |
|-----------|-------------------|--------------------|
| **Save** (Basic Info) | `PUT /tenants/:id/operational-settings` body `{ name, about }` | `saveStorefrontMutation` → `handleSaveStorefront` |
| **Save** (Settings tab) | `PUT /tenants/:id/operational-settings` body `{ storeType, openTime, closeTime, forceClosed }` | `saveGeneralMutation` → `handleSaveGeneral` |
| **Delete Store** (confirm in modal) | `DELETE /tenants/:id` | `deleteStoreMutation` → `api.deleteTenant(id)` |
| Tenant data | `GET` via `api.getTenantById(id)` | `useQuery` key `['tenant-registry', id]` |
| Catalog | `api.getCatalogApi(id)` | `useQuery` key `['catalog', id]` |
| Orders | `api.listOrdersByTenant(id)` | `useQuery` key `['orders', id]` |

### Schema Fields (openTime, closeTime, forceClosed)

- **Rendered in:** **الإعدادات** tab → Card **"ساعات العمل (Business Hours)"**.
- **State:** `openTimeLocal`, `closeTimeLocal`, `forceClosedLocal` (from `tenant.openTime`, `tenant.closeTime`, `tenant.forceClosed`; fallbacks `'08:00'`, `'17:00'`, `false`).
- **Persistence:** Sent in the same **Settings Save** payload as `storeType` via `PUT /tenants/:id/operational-settings`.
- **Backend:** Stored on Tenant in DB (Prisma: `openTime`, `closeTime`, `forceClosed`); deep delete does not depend on these.

---

## 3. File References (Where to Edit)

To change the **layout of the 4 Tabs** or the Cards inside them, edit:

| What you want to change | File path |
|-------------------------|-----------|
| **Tabs + all Cards + modals** (single page) | `apps/nmd-admin/src/pages/TenantDetailPage.tsx` |
| **Routing** (how you reach this page) | `apps/nmd-admin/src/App.tsx` (routes `tenants/:id`, `markets/:id/tenants/:tenantId`) |
| **Delivery settings** (linked from Settings tab) | `apps/nmd-admin/src/pages/TenantDeliverySettingsPage.tsx` |
| **UI primitives** (Card, Tabs, Button, Modal) | `packages/ui` (or wherever `@nmd/ui` is implemented) |
| **API client** (e.g. `deleteTenant`, `getTenantById`) | `packages/mock/src/mock-api-client.ts` |
| **Backend** (operational-settings, DELETE tenant) | `apps/mock-api/src/index.ts` |

**Single file for tab/card layout:**  
`apps/nmd-admin/src/pages/TenantDetailPage.tsx`

---

## 4. /merchant/settings/store (Other App)

The route **/merchant/settings/store** is in a **different app**:

- **App:** `apps/admin` (basename `/merchant`).
- **Route:** `settings/store` → full path **/merchant/settings/store**.
- **Component:** `apps/admin/src/pages/StoreSettingsPage.tsx`.
- **Layout:** No 4-tab structure; single page with status toggles, business hours per day, office hours text, etc.
- **Desktop layout (2-column grid):** On viewports from `md` and up, the first two cards are side-by-side:
  - **Left column:** **هوية المتجر (Store Identity)** — store name, about (professional), phone/WhatsApp (professional); each has its own Save → `PUT /tenants/:id/operational-settings` with `name`, `about`, or `phone`/`whatsappPhone`.
  - **Right column:** **الهوية البصرية (Branding)** — read-only (logo/colors managed from main admin).
  - Below the grid, remaining cards (ساعات العمل, حالة التشغيل, etc.) are full-width in a single column.
- **API:** `api.updateOperationalSettingsApi(tenantId, { ... })` (same backend, different UI).

To change the **Merchant Dashboard** store settings page (التاجر → إعدادات المحل), edit **apps/admin/src/pages/StoreSettingsPage.tsx** and **apps/admin/src/App.tsx** (route).

---

## 5. Quick Reference (Nested List)

- **Page:** TenantDetailPage
  - **Tab: basic**
    - Card: الاسم والنبذة (name, about) → Save → PUT operational-settings { name, about }
    - Card: العلامة التجارية (logo/colors) — read-only
  - **Tab: products**
    - Card: الكتالوج (counts)
  - **Tab: orders**
    - Card: الطلبات (table last 20)
  - **Tab: settings**
    - Card: وضع المتجر (storeType)
    - Card: ساعات العمل (openTime, closeTime, forceClosed) → Save → PUT operational-settings
    - Card: إعدادات إضافية (delivery link)
    - Card: منطقة الخطر → حذف المتجر → Modal → api.deleteTenant(id) → redirect

Use this sitemap as the primary reference for the **Store Management / Tenant Settings** view in the admin dashboard (nmd-admin).

---

## 6. Final Stable Version — Merchant Settings UI

The **Merchant Settings UI** at **/merchant/settings/store** is designated as the **Final Stable Version** with the following state:

- **Layout:** 2-column grid on desktop (Store Identity + Branding side-by-side); single column on smaller viewports. Remaining cards (Business Hours, Operation Status, Busy Banner, Security, Danger Zone) full-width below.
- **Save actions in the grid:** All Save buttons in the Store Identity card correctly call `api.updateOperationalSettingsApi(tenantId, payload)`:
  - Store name → `{ name }`
  - About (professional) → `{ about }`
  - Phone/WhatsApp (professional) → `{ phone, whatsappPhone }`
- **Branding card:** Read-only; no Save in grid.
- **Stable snapshot:** Git tag `merchant-settings-ui-stable-v1` (or equivalent) marks this version.
