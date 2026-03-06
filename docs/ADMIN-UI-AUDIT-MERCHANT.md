# Merchant Admin UI – Deep Dive Technical Map (apps/admin)

Structured audit of the Merchant Admin interface for redesign without breaking backend logic or routing.

---

## 1. Route Structure

**Basename:** `/merchant` (see `main.tsx` / `BrowserRouter basename`).

**Auth:** All routes under `/*` are wrapped in `AuthGuard` (requires token when `VITE_MOCK_API_URL` is set). Unauthenticated users are redirected to `/login?returnTo=...`.

| URL Path | Page Component (src/pages) | Description |
|----------|----------------------------|-------------|
| `/login` | `LoginPage.tsx` | Login form; no layout. |
| `/order-actions/:orderId/:action` | `OrderActionPage.tsx` | Deep link: confirm / ready / shipped → updates order status, then success/error UI. |
| `/` | `DashboardPage.tsx` | Dashboard (index inside layout). |
| `/leads` | `LeadsPage.tsx` | Leads list. |
| `/orders` | `OrdersPage.tsx` | Orders list + drawer. |
| `/orders/board` | `OrdersBoardPage.tsx` | Kanban-style order board. |
| `/catalog/categories` | `CategoriesPage.tsx` | Category tree CRUD. |
| `/catalog/products` | `ProductsPage.tsx` | Product list + edit drawer. |
| `/catalog/options` | `OptionsPage.tsx` | Option groups & items. |
| `/campaigns` | `CampaignsPage.tsx` | Campaign list. |
| `/campaigns/new` | `CampaignEditPage.tsx` | New campaign. |
| `/campaigns/:id/edit` | `CampaignEditPage.tsx` | Edit campaign. |
| `/settings/delivery` | `DeliverySettingsPage.tsx` | Delivery modes + zones (platform-admin only in practice). |
| `/settings/store` | `StoreSettingsPage.tsx` | Store settings, hours, delivery block (conditional), delete store. |
| `/settings/staff` | `StaffPage.tsx` | Staff list + add/edit modal. |
| `/branding` | `BrandingPage.tsx` | Logo, hero, banners, colors. |
| `/homepage` | `HomepageManagerPage.tsx` | Homepage sections/collections. |

**Layout:** Everything except `/login` and `/order-actions/...` that is rendered after auth is under a single `<Route path="/*">` which renders `AdminApp` (or `AdminAppLegacy` when no API). The inner `<Routes>` are under `AdminLayout`, so the sidebar and header wrap: Dashboard, Leads, Orders, Catalog, Campaigns, Settings, Branding, Homepage.

**Legacy (no API):** When `VITE_MOCK_API_URL` is not set, `AdminAppLegacy` renders; tenant comes from `getInitialTenant()`, and if missing, `TenantSelectPage` is shown (no route path – it replaces the app until a tenant is selected).

---

## 2. State Management

### 2.1 Context

- **AuthContext** (`contexts/AuthContext.tsx`)
  - `user` (id, email, role, marketId?, tenantId?, mustChangePassword?)
  - `token`, `isLoading`, `login`, `logout`, `refetchUser`
  - Token stored in `localStorage` under `nmd-access-token`; also provided to `@nmd/mock` via `setMockApiTokenProvider`.

- **AdminContext** (`context/AdminContext.tsx`)
  - `tenantId` (current merchant store)
  - `tenantType` (FOOD | CLOTHING | GENERAL) for catalog/options behavior.
  - Provided only inside the main app (after tenant is resolved); not available on Login or OrderActionPage.

### 2.2 Data Fetching

- **React Query (TanStack Query)** when `VITE_MOCK_API_URL` is set:
  - **App level (AdminApp):** `['me', token]` → `api.getMe()`, `['tenant-by-id', tenantId]` → `api.getTenant(tenantId)` to resolve current user and tenant.
  - **Dashboard:** catalog, tenant-registry, orders, dashboard-stats, campaigns, delivery settings.
  - **Orders:** `['orders', tenantId, ...]` → `api.listOrdersByTenant(tenantId, listOptions)`; tenant → `api.getTenant(tenantId)`.
  - **DeliverySettingsPage:** delivery-settings, delivery-zones.
  - **StoreSettingsPage:** tenant-registry, delivery-zones.
  - **BrandingPage:** tenant-registry; save via `api.updateBrandingApi`.
  - **HomepageManagerPage:** tenant-registry, catalog; save via `api.updateCollectionsApi`.
  - **LeadsPage:** `api.listLeads(tenantSlug)`.
  - **OrdersBoardPage:** `api.listOrdersByTenant(tenantId)` (or local `listOrdersByTenant` when no API).
  - **Dashboard stats:** `api.getTenantDashboardStats(tenantId)` (always, for revenue/orders count).

- **Local / in-memory when no API:**
  - **Catalog (categories, products, option groups):** `createAdminData(tenantId)` from `store/admin-data.ts` – uses `@nmd/mock` `getCatalog`/`setCatalog` and optional `localStorage` fallback.
  - **useAdminData hook** (`hooks/useAdminData.ts`): When API is set, uses React Query `['catalog', tenantId]` and `api.getCatalogApi` / `api.setCatalogApi`; when no API, returns `createAdminData(tenantId)` (get/set categories, products, optionGroups).
  - **CategoriesPage:** Uses `useAdminData`; state in local `useState` synced from adminData.
  - **ProductsPage:** Same pattern via useAdminData for catalog; product edit state in drawer.
  - **OptionsPage:** When no API uses `listOptionGroups(tenantId)` from `@nmd/mock` + local state; no API wiring for options in this audit.
  - **CampaignsPage / CampaignEditPage:** `listCampaigns`, `getCampaign`, `createCampaign`, `updateCampaign`, `toggleCampaignStatus`, `deleteCampaign` from `@nmd/mock` (local).
  - **StaffPage:** `listStaff`, `addStaff`, `updateStaff`, `removeStaff` from `@nmd/mock` (local).

### 2.3 Local UI State

- **AdminLayout:** `collapsed` (sidebar) in `useState`, persisted with `lib/storage` (SIDEBAR_KEY).
- **OrdersPage:** filters (today/all, date range, search, status), `selectedOrder`, `cancelTarget`, `refresh`.
- **Order drawer:** `updating` for status buttons.
- **DeliverySettingsPage:** `modalOpen`, `editingZone`, `zoneForm`, `modeSettings`, `modeSettingsDirty`.
- **StoreSettingsPage:** multiple modals and form state (status override, hours, delivery zone form, delete store confirmation, etc.).
- **ProductsPage:** drawer open/close, `editing` product, reorder expanded, delete/regenerate confirmations, image form state.
- **CategoriesPage:** `editing`, `modalOpen`, `form`, `deleteConfirm`, `expandedIds`.
- **OptionsPage:** `selected` group, `groupForm`/`itemForm`, `groupModalOpen`/`itemModalOpen`.
- **CampaignsPage:** `campaigns` in state, refreshed after toggle/delete.
- **CampaignEditPage:** single `form` state, loaded from `getCampaign(id)` when editing.
- **BrandingPage:** `saving`, refs for file inputs, local banner/hero state until save.
- **HomepageManagerPage:** sections state, `editingId`, `saving`, drag/reorder.

---

## 3. Component Breakdown

### 3.1 Layout (AdminLayout.tsx)

- **Header:** Title “Store OS Dashboard”, `user.email` from `useAuth()`, **تسجيل الخروج** button → `handleLogout` (clears nmd session, `logout()`, `navigate('/login')`).
- **Sidebar:** Collapse toggle (PanelLeft / PanelLeftClose), then **NAV_ITEMS** as `NavLink`s (see Route Structure). No role-based filtering in the layout; all links are shown to every logged-in merchant.
- **Main:** `<Outlet />` with motion wrapper for page content.

### 3.2 Sidebar Nav Items (order in code)

| to | label (Arabic) |
|----|-----------------|
| `/` | لوحة التحكم |
| `/leads` | سجل الطلبات |
| `/orders` | الطلبات |
| `/orders/board` | لوحة الطلبات |
| `/catalog/categories` | التصنيفات |
| `/catalog/products` | المنتجات |
| `/catalog/options` | مجموعات الخيارات |
| `/campaigns` | الحملات |
| `/settings/delivery` | مناطق التوصيل |
| `/settings/store` | إعدادات المحل |
| `/settings/staff` | الفريق |
| `/branding` | واجهة المحل |
| `/homepage` | الصفحة الرئيسية |

### 3.3 Dashboard (DashboardPage)

- **PageHeader:** “لوحة التحكم”, “نظرة عامة على متجرك”.
- **LaunchReadinessPanel:** Checks (whatsapp, categories, products, stock, hero, banners); “Launch ready” when all pass.
- **Setup checklist:** Categories, Products, (if platform admin) Delivery, Campaigns – with links to respective pages; **إضافة تصنيفات ومنتجات** button → catalog; refresh button.
- **Cards:** إيرادات اليوم (stats.dailyRevenue), إيرادات الشهر (stats.monthlyRevenue), الطلبات اليوم (ordersTodayCount), التصنيفات count.
- **ملخص مالي:** totalSales, platformFee, merchantBalance (from dashboard-stats).
- **Store URL:** Copy button (navigator.clipboard.writeText(storeUrl)); “عرض المتجر” link.

### 3.4 Order Drawer (OrdersPage – OrderDrawerContent)

- Customer block: name, phone, fulfillment type, delivery zone/fee/address, notes, WhatsApp notification status.
- **العناصر:** List of items (image, name, options, quantity, price); then **المجموع (منتجات)**, **رسوم التوصيل**, and **حصة التاجر** or **المجموع الكلي** (role-based).
- **فتح واتساب** → `openWhatsAppOrderLink(waUrl, deepLinkUrl)` (pre-filled message).
- **نسخ رسالة واتساب**, **نسخ رقم الهاتف**, **طباعة** (opens print URL in new tab).
- **تغيير الحالة:** تم التواصل (CONFIRMED), تم التسليم (COMPLETED), إلغاء (CANCELLED) → `handleStatus` → `api.updateOrderStatus(order.id, status)` (or local `updateOrderStatus` when no API).
- Cancel confirmation: ConfirmDialog → same `handleStatus(..., 'CANCELLED')`.

---

## 4. Action Buttons & Logic (by page)

### LoginPage

- **تسجيل الدخول:** submit → `login(email, password)` (AuthContext) → POST to API `/auth/login`, then set token.
- **استعادة كلمة المرور:** toast only (“تواصل مع الدعم”).

### OrderActionPage

- No button; on mount: `api.updateOrderStatus(orderId, ACTION_TO_STATUS[action])` for `confirm`|`ready`|`shipped` → then success or error view with links to `/orders` and `/`.

### DashboardPage

- **إضافة تصنيفات ومنتجات:** Link to `/${tenantSlug}/catalog/products` or similar catalog flow.
- **تحديث:** `window.location.reload()`.
- **نسخ رابط المتجر:** `navigator.clipboard.writeText(storeUrl)`.

### LeadsPage

- Data only: `api.listLeads(tenantSlug)` (with filters). No prominent action buttons in the grep; table/list view.

### OrdersPage

- **اليوم / الكل:** set filter (today vs all), optional date range.
- **Status filter:** dropdown.
- **Row click:** set `selectedOrder` → open drawer.
- **تم التواصل:** `handleStatus(o, 'CONFIRMED')` → `api.updateOrderStatus` or `updateOrderStatus`.
- **تم التسليم:** `handleStatus(o, 'COMPLETED')`.
- **إلغاء:** set `cancelTarget` → ConfirmDialog → `handleStatus(cancelTarget, 'CANCELLED')`.
- **Drawer:** فتح واتساب, نسخ رسالة واتساب, نسخ رقم الهاتف, طباعة; status buttons (تم التواصل, تم التسليم, إلغاء) same as above.

### OrdersBoardPage

- **OrderCard:** “تقدم” (advance) → `api.updateOrderStatus(order.id, nextStatus)` (PENDING→CONFIRMED→COMPLETED, etc.).

### CategoriesPage

- **إضافة تصنيف:** open add modal; **إضافة فرعي:** open add with parentId; **تعديل:** open edit modal; **حذف:** set deleteConfirm → confirm → `remove(id)` → `adminData.setCategories(next)` (and remove descendants).
- **حفظ (modal):** `save()` → update or add category in state and `adminData.setCategories` / useAdminData setCategories.

### ProductsPage

- **إضافة منتج:** open drawer in “add” mode.
- **تعديل (منتج):** open drawer with product.
- **Reorder:** expand reorder UI → drag/drop → `handleReorder` → `adminData.setProducts` / setProducts.
- **Image upload:** file input / drop → upload and add to product images; move up/down, remove.
- **Option presets:** apply preset to option groups.
- **إضافة مجموعة خيارات**, **حذف مجموعة**, remove option from group, **توليد المتغيرات**, **إعادة توليد** (with confirm).
- **حفظ:** persist product (via adminData setProducts / catalog API); **إلغاء** close drawer; **حذف** set delete confirm → then remove product.

### OptionsPage

- **إضافة مجموعة:** open group modal; **تعديل** group; **حذف** group → `handleDeleteGroup` (local).
- **إضافة عنصر** to group; **تعديل** / **حذف** item → `handleSaveItem` / `handleDeleteItem` (local).
- **حفظ** in modals → `handleSaveGroup` / `handleSaveItem` (sync to listOptionGroups / local state).

### CampaignsPage

- **إضافة حملة:** Link to `/campaigns/new`.
- **تعديل:** Link to `/campaigns/:id/edit`.
- **تفعيل / إيقاف:** `handleToggle(c.id)` → `toggleCampaignStatus(id)` (local).
- **حذف:** `handleDelete(c.id)` → `deleteCampaign(id)` (local).

### CampaignEditPage

- **حفظ:** `handleSave()` → `updateCampaign(id, payload)` or `createCampaign(payload)` (local), then `navigate('/campaigns')`.

### DeliverySettingsPage

- **حفظ إعدادات الوضع:** `handleSaveModeSettings` → `api.saveDeliverySettingsApi(tenantId, ...)`.
- **إضافة منطقة:** open zone modal; **إخفاء/تفعيل:** `handleToggleActive` → `api.patchDeliveryZoneApi`; **تعديل:** open modal with zone; **حذف:** `handleDeleteZone` → `api.deleteDeliveryZoneApi`.
- **حفظ (zone modal):** `handleSaveZone` → `api.createDeliveryZoneApi` or `api.patchDeliveryZoneApi` / `updateDeliveryZoneApi`.

### StoreSettingsPage

- **Status override:** open / busy / closed → `handleStatusOverride` → `api.updateOperationalSettingsApi(tenantId, { operationalStatus })`.
- **Order policy:** accept_always / accept_only_when_open → `handleOrderPolicyChange` → `api.updateOperationalSettingsApi(..., { orderPolicy })`.
- **Busy banner:** toggle and text save → `handleBusyBannerToggle`, `handleBusyBannerTextSave` → same API.
- **حفظ (اسم المحل):** `handleSaveStoreName` → `api.updateOperationalSettingsApi(tenantId, { name })`.
- **ساعات العمل:** per-day open/close/closed → `handleSaveHours` → `api.updateOperationalSettingsApi(..., { businessHours })`.
- **حذف المتجر:** open modal → `handleDeleteStore` → `api.deleteTenant(tenantId)`.
- **Change password:** `handleChangePassword` → `api.changePassword(currentPassword, newPassword)`.
- **About / WhatsApp / Office hours / Booking:** various `api.updateOperationalSettingsApi` calls.
- **Delivery block (when canSeeDelivery):** Add/Edit/Delete zone → `api.createDeliveryZoneApi`, `api.patchDeliveryZoneApi`, `api.deleteDeliveryZoneApi`.

### StaffPage

- **إضافة:** open modal; **تعديل** / **حذف** (disabled for OWNER) → `updateStaff` / `removeStaff` (local).
- **حفظ (modal):** `handleSave` → `addStaff` or `updateStaff` (local).

### BrandingPage

- **Logo / Hero / Banner upload:** file input or drop → upload then `api.updateBrandingApi(tenantId, { ... })`.
- **Add banner, move up/down, remove banner, replace image:** local state then **حفظ** → `api.updateBrandingApi`.

### HomepageManagerPage

- **إضافة قسم:** `addSection()`.
- **Move section up/down**, **تعديل**, **حذف قسم:** local state.
- **حفظ التعديل** (section edit): `saveEdit()`.
- **حفظ:** `persist()` → `api.updateCollectionsApi(tenantId!, toSave)`.

### ChangePasswordPage

- **حفظ كلمة المرور الجديدة:** submit → `api.changePassword(currentPassword, newPassword)` then redirect (e.g. to login or dashboard).

---

## 5. Permissions Check (MERCHANT vs ROOT_ADMIN)

- **Role source:** `useAuth().user.role` (from `/auth/me`). No separate “MERCHANT_ADMIN” in the UI; typical merchant user has `role: 'TENANT_ADMIN'` and `tenantId` set. Platform admins: `ROOT_ADMIN` or `SUPER_ADMIN`.

- **Helper:** `isPlatformAdmin(role)` in `lib/is-platform-admin.ts` → `role === 'ROOT_ADMIN' || role === 'SUPER_ADMIN'`.

- **Where it’s used:**
  - **DashboardPage:**  
    - `setupComplete` includes delivery check only if `isPlatformAdmin(user?.role)`; otherwise delivery is not required for “setup complete”.  
    - “إعداد التوصيل” setup item and link to `/settings/delivery` are rendered only when `isPlatformAdmin(user?.role)`.
  - **OrdersPage:**  
    - `showGrandTotal = isPlatformAdmin(user?.role)`: table column and drawer show “المجموع الكلي” (Grand Total) for platform admin, “حصة التاجر” (Merchant Share) for others.
  - **DeliverySettingsPage:**  
    - `canManageDelivery = isPlatformAdmin(currentUser?.role)`. If false, page redirects to `/`; delivery settings and zones (and all buttons) are only shown when true.
  - **StoreSettingsPage:**  
    - `canSeeDelivery = isPlatformAdmin(currentUser?.role)`. Delivery block (zones table, add/edit/delete zone) is rendered only when `canSeeDelivery`; merchants do not see it.

- **Sidebar:** No permission filter. All links (including “مناطق التوصيل” `/settings/delivery`) are visible to everyone. Access is enforced on the page: DeliverySettingsPage redirects non–platform-admins.

- **Summary:**  
  - **Visible to all (TENANT_ADMIN):** Dashboard (with delivery optional in setup), Orders (with Merchant Share total), Orders Board, Leads, Catalog, Campaigns, Store Settings (no delivery block), Staff, Branding, Homepage.  
  - **Only for ROOT_ADMIN/SUPER_ADMIN:** Delivery setup link on dashboard, full Delivery Settings page, delivery block on Store Settings, and Grand Total in orders list/drawer.

---

## 6. API Surface Used (MockApiClient / backend)

When `VITE_MOCK_API_URL` is set, the app uses:

- **Auth:** POST `/auth/login`, GET `/auth/me`; token in `Authorization: Bearer`.
- **Tenant:** `getTenant(tenantId)`, `getTenantById(tenantId)` (registry).
- **Catalog:** `getCatalogApi(tenantId)`, `setCatalogApi(tenantId, { categories, products, optionGroups })`.
- **Orders:** `listOrdersByTenant(tenantId, { from, to, search })`, `updateOrderStatus(orderId, status)`.
- **Dashboard:** `getTenantDashboardStats(tenantId)`.
- **Campaigns:** `listCampaignsApi(tenantId)` (when API set).
- **Delivery:** `getDeliverySettingsApi(tenantId)`, `saveDeliverySettingsApi(tenantId, body)`, `getDeliveryZones(tenantId)`, `createDeliveryZoneApi`, `patchDeliveryZoneApi`, `updateDeliveryZoneApi`, `deleteDeliveryZoneApi`.
- **Store settings:** `updateOperationalSettingsApi(tenantId, updates)`, `changePassword(current, new)`, `deleteTenant(tenantId)`.
- **Branding:** `getTenantById`, `updateBrandingApi(tenantId, payload)`.
- **Homepage:** `updateCollectionsApi(tenantId, collections)`.
- **Leads:** `listLeads(tenantSlug)`.

---

## 7. File Map (Quick Reference)

| Area | File |
|------|------|
| Routes & auth | `App.tsx` |
| Layout & sidebar | `layouts/AdminLayout.tsx` |
| Context | `context/AdminContext.tsx`, `contexts/AuthContext.tsx` |
| Permissions | `lib/is-platform-admin.ts` |
| Catalog state (no API) | `store/admin-data.ts`, `hooks/useAdminData.ts` |
| Dashboard | `pages/DashboardPage.tsx` |
| Orders | `pages/OrdersPage.tsx`, `pages/OrdersBoardPage.tsx`, `pages/OrderActionPage.tsx` |
| Catalog | `pages/CategoriesPage.tsx`, `pages/ProductsPage.tsx`, `pages/OptionsPage.tsx` |
| Campaigns | `pages/CampaignsPage.tsx`, `pages/CampaignEditPage.tsx` |
| Settings | `pages/StoreSettingsPage.tsx`, `pages/DeliverySettingsPage.tsx`, `pages/StaffPage.tsx` |
| Branding & Homepage | `pages/BrandingPage.tsx`, `pages/HomepageManagerPage.tsx` |
| Auth & tenant | `pages/LoginPage.tsx`, `pages/ChangePasswordPage.tsx`, `pages/TenantSelectPage.tsx` |
| Leads | `pages/LeadsPage.tsx` |

---

*Document generated from codebase audit. Use for UI redesign while keeping routes, API calls, and permission checks intact.*
