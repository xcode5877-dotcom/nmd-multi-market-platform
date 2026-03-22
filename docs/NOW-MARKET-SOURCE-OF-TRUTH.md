# Now Market — Source of Truth for AI Sessions

> **Purpose:** This document is the definitive technical and visual specification for the NMD Now Market project. Use it as context for any new AI session working on UI/UX refinement.
> 
> **Rule:** Data and business logic are **locked and tested**. All work is strictly **high-end UI/UX refinement**.

---

## 1. Project Stack & Identity

### Tech Stack
| Layer | Technology |
|-------|------------|
| **Storefront** | Vite, React 18, React Router, TanStack Query, Zustand, Tailwind, Framer Motion, `@nmd/ui`, `@nmd/core`, `@nmd/mock` |
| **Monorepo** | pnpm workspaces |
| **Packages** | `@nmd/core` (types, API clients), `@nmd/ui` (Drawer, Modal, Button, DataTable), `@nmd/mock` (MockApiClient) |

### Infrastructure
- **Dockerized:** `docker compose` with services: web-gateway (Nginx), postgres, mock-api, whatsapp-service.
- **Routing:** Nginx routes by URL (e.g. `/market-admin/`, `/merchant/`, storefront paths).

### Global Identity System
- **Method:** Phone-based OTP (no passwords).
- **Customer token:** `nmd-customer-token` (localStorage) for storefront customer orders.
- **Admin token:** `nmd-access-token` for merchants, market admins, super admins.
- **Unified session:** A user logged in is recognized across the entire platform.

---

## 2. Fixed Design System (MANDATORY)

### Palette
| Use Case | Value |
|----------|-------|
| **Primary** | Teal `#0f766e` |
| **Background** | Pure White `#ffffff` |
| **Text** | Deep Black `#0a0a0a` |
| **Light Teal** | `#0d9488` |
| **Neon Teal** | `#14b8a6` (for accents / grand prizes) |

### Shape Rules
- **All components:** Pill-shaped (`rounded-full`).
- **No borders:** Use clean shapes; borders only when semantically required (e.g. teal border on coins banner).
- **No dark/grey segments** on wheels or banners.

---

## 3. The Header (LOCKED)

### Layout
3-column symmetrical header:
```
[ Burger Menu / Back ] | [ Centered Logo ] | [ Search | Cart | Profile Icons ]
```

### Implementation Notes
- **GlobalHeader** (`apps/storefront/src/components/GlobalHeader.tsx`): Web/PWA.
- **AndroidHeader** (`apps/storefront/src/components/AndroidHeader.tsx`): Native WebView.
- Logo: **absolutely centered** via `absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2`.
- Left/Right columns: `min-w-[88px]` / `min-w-[120px]` to **prevent overlap**.
- Icons: `gap-4` between Search, User, Cart.
- **CSS** (`apps/storefront/src/index.css`): `[data-global-header]` and `.now-market-tab-bar` use `width: 100%`, `margin: 0`, `padding-left: 0`, `padding-right: 0`.

---

## 4. Lucky Wheel Specification

### Path
`/lucky-wheel` (inside LandingLayout).

### Zero-Scroll Architecture
- **max-h-screen** and **overflow-hidden** on the Lucky Wheel page.
- Every element must fit within the mobile viewport.
- No vertical scrolling.
- Layout: `flex flex-col h-full min-h-0 max-h-screen overflow-hidden`.

### Vibrant Palette
| Element | Color |
|---------|-------|
| Regular segments | Teal `#0f766e`, Light Teal `#0d9488` |
| Grand Prizes (هدية صغيرة، شحن مجاني) | Neon Teal `#14b8a6` |
| Segment text | **White** |
| Pointer | Solid Teal `#0f766e` |
| Spin button | Solid Teal `#0f766e`, white text, `rounded-full` |

**NO dark or grey segment colors.**

### Spin Button
- Solid Teal `#0f766e`.
- Pill shape (`rounded-full`).
- White text.
- Centered (`mx-auto`).

### Coins Banner
- White pill with **2px Teal border** (`#0f766e`).
- Dark text (`#0a0a0a`).
- Coins icon (Teal).
- Prominent shadow.

### Interactive Logic (Insufficient Coins)
- **Trigger:** User clicks Spin when `userCoins < spinCost` (typically 10).
- **Modal:** Teal-branded, centered.
- **Modal text:** `عذراً، رصيدك من العملات غير كافٍ` (Black `#0a0a0a`).
- **Modal button:** `احصل على عملات` — Teal Pill, links to `/` (tasks/invites later).
- **No data logic changes** — only UI display.

---

## 5. Product Page Standards

### Description
- **line-clamp-1** (single line, truncated).
- Positioned **ABOVE** options (before variant/addon selectors).

### Fixed Bottom Action Bar
- Add to Cart bar: fixed at bottom.
- **Safe-area support:** `paddingBottom: env(safe-area-inset-bottom, 0px)`.
- Quantity selector: **centered**, **pill-shaped** (`rounded-full`).
- Teal branding for buttons.

---

## 6. FAB (Floating Action Button)

- **Teal branding** (`#0f766e`).
- Positioned **above** order-tracking banner and bottom nav.
- **Respects** `env(safe-area-inset-bottom)` and `env(safe-area-inset-right)`.
- Visible on markets-only paths (home, daburiyya, dabburiyya, iksal).
- `z-[9996]` so it sits above order-tracking (`z-[9995]`).

---

## 7. Development Rule

> **Data and business logic are locked and tested.**
> 
> All current work is **strictly high-end UI/UX refinement**.
> 
> Do not modify:
> - useCoins, deductCoins, addCoins, hasEnoughForSpin
> - Cart store, order flow, checkout logic
> - API calls, tenant/customer auth
> - Prize determination, spin animation logic

---

## 8. Key File Paths

| Purpose | Path |
|---------|------|
| Lucky Wheel page | `apps/storefront/src/pages/LuckyWheelPage.tsx` |
| Lucky Wheel component | `apps/storefront/src/components/LuckyWheel.tsx` |
| Global header | `apps/storefront/src/components/GlobalHeader.tsx` |
| Android header | `apps/storefront/src/components/AndroidHeader.tsx` |
| FAB | `apps/storefront/src/components/FloatingLuckyWheelFab.tsx` |
| Product page | `apps/storefront/src/pages/ProductPage.tsx` |
| Global CSS | `apps/storefront/src/index.css` |
| Landing layout | `apps/storefront/src/layouts/LandingLayout.tsx` |
| Project context | `.cursor/rules/project-context-master.mdc` |

---

*Last updated: Session handoff. Use this as the single source of truth for UI/UX work.*
