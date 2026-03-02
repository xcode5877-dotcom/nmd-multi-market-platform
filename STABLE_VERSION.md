# Global Identity & Multi-Market Stable Version

**Checkpoint:** This document describes the working reference architecture. When debugging or reverting, compare against this structure.

## Routing (Storefront)

| Path | Component | Description |
|------|-----------|-------------|
| `/` | `LandingLayout` → `MarketsPickerPage` | Global mall: choose Daburiyya or Iksal |
| `/daburiyya` | `MarketLayout` → `MarketHomePage` | Daburiyya local market (store grid) |
| `/dabburiyya` | Same | API slug alias |
| `/iksal` | `MarketLayout` → `MarketHomePage` | Iksal local market |
| `/:tenantSlug/*` | `TenantGate` → `Layout` → store pages | Individual stores (e.g. /lawyer-falan) |
| `/my-activity` | `LandingLayout` → `MyActivityPage` | Customer activity (orders, leads) |

## Auth (Global Identity)

- **ToastProvider** – Root wrapper (required for OtpLoginModal)
- **CustomerAuthProvider** – Token, fetchMe, checkPhone, start, verify
- **GlobalAuthModalProvider** – openAuthModal, OtpLoginModal
- Token key: `nmd-customer-token` (localStorage)
- Smart OTP flow: phone check → existing (OTP only) vs new (name + OTP)

## Key Files

```
apps/storefront/src/
├── App.tsx              # Routes + ToastProvider, CustomerAuthProvider, GlobalAuthModalProvider
├── layouts/
│   ├── LandingLayout.tsx   # Root / markets picker
│   ├── MarketLayout.tsx    # /daburiyya, /iksal
│   └── Layout.tsx         # Store pages (tenant)
├── pages/
│   ├── MarketsPickerPage.tsx
│   ├── MarketHomePage.tsx
│   ├── MyActivityPage.tsx
│   └── ...
├── components/
│   ├── StoreCard.tsx
│   ├── OtpLoginModal.tsx
│   └── Header.tsx         # Has "السوق" link when on store
└── contexts/
    ├── CustomerAuthContext.tsx
    └── GlobalAuthModalContext.tsx
```

## Navigation Flow

1. **Home** (/) → Markets picker (Daburiyya | Iksal)
2. **Daburiyya** → Market home with store grid (banners, categories, StoreCards)
3. **Store** (e.g. lawyer-falan) → TenantGate → store HomePage
4. **السوق** link in store header → back to /

## Removed (Cleanup)

- `RootRedirect.tsx` – replaced by MarketsPicker at /
- `TenantSelectPage.tsx` – replaced by MarketsPickerPage
- `MarketplacePage.tsx` – simplified version removed
- `MarketplaceLayout.tsx` – replaced by LandingLayout + MarketLayout

## Git

```
Commit: chore: Global Identity & Multi-Market Stable Version checkpoint
```
