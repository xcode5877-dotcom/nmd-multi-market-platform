# Restore report: Professional Landing & Store design (~10:20 AM)

## Local History / Timeline

**Cursor and VS Code "Local History" or "Timeline" are not stored in the repo.** They live in the editor’s workspace storage. I can only use **git history**, not editor-local history. There is no commit in the reflog at "10:20 AM today"; the latest refs are from March 2–3, 2026.

## Git reference points used

- **8a00746** – "Backup: Markets and Professional leads system working" (2026-03-02 01:08)
- **b3b8f95** – "chore: Global Identity & Multi-Market Stable Version checkpoint" (2026-03-02 03:46)
- **466e680** – "Stable: Merchant dashboard routing and homepage navigation" (current HEAD)

## schema.prisma – Global Identity & Professional fields

**They are still there.** No reversion needed. Current `apps/mock-api/prisma/schema.prisma` includes:

- **tenantType** (String?)
- **storeType** (String? // RESTAURANT | PROFESSIONAL)
- **businessType** (String? @default("RETAIL"))  
- **about**, **operationalStatus**, **orderPolicy**, **businessHours**, **openTime**, **closeTime**, **forceClosed**, **phone**, **collections** (JSON), **bookingEnabled**, **appointmentDuration**, etc.

Older commits (8a00746, b3b8f95) used SQLite and a **simpler** Tenant model (no `storeType`). The current schema is the one that has the Global Identity and Professional-related fields.

## Current code – LandingLayout, ProfessionalHero, ProfessionalBar

**Already present** in the repo:

| Location | What’s there |
|----------|----------------|
| **App.tsx** | `LandingLayout` lazy-loaded; route `/` uses it. `TenantGate` sets `storeType` and `useProfessionalLayout = storeType === 'PROFESSIONAL' \|\| businessType === 'SERVICE'`; passes `effectiveStoreType` to `setTenant`. |
| **Layout.tsx** | `ProfessionalBar` imported; `isProfessional ? <ProfessionalBar /> : <CartBar />`. |
| **HomePage.tsx** | `ProfessionalHero` imported; `isProfessional` branch with StatusBadge, `ProfessionalHero tenant={tenant} hero={hero} banners={banners}`, Service list, `AvailableSlotsPlaceholder`. |
| **ProfessionalHero.tsx** | Full component with hero/banners and about/contact. |
| **ProfessionalBar.tsx** | Full component. |

So conditional rendering for **PROFESSIONAL** stores is already implemented (App, Layout, HomePage, ProductPage, CartPage, CheckoutPage, Header, CartBar).

## What was missing vs backup (8a00746)

The backup **HomePage** had:

- **collections** from `branding.collections` (filtered by `isActive`)
- **resolveCollectionProducts** and **useDynamicCollections**
- For RESTAURANT layout: when `useDynamicCollections`, render **CollectionSlider** per collection; otherwise "مختارات" + "وصل حديثًا" sections.

The **current** HomePage uses category tabs + horizontal category rows and does **not** use CollectionSlider or dynamic collections. That backup behavior has been re-added below (additive only).

## Summary

- **Schema:** No change; Professional/Identity fields are present.
- **PROFESSIONAL logic:** Already in place (LandingLayout, ProfessionalHero, ProfessionalBar, storeType/businessType).
- **Restored:** Collections + CollectionSlider logic on HomePage for the retail layout (from backup 8a00746), without removing existing code.
