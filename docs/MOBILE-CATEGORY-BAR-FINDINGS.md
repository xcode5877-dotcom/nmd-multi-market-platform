# Mobile Category Bar – Investigation Findings

## Summary

**There is NO separate MobileLayout or mobile-specific page.** `MarketHomePage` and `HomePage` are the same components for both desktop and mobile. Categories (PillarNav / CategoryTab) are rendered inside these pages.

## Route Structure

| Route | Layout | Page |
|-------|--------|------|
| `/` | LandingLayout | MarketsPickerPage |
| `/dabburiyya`, `/iksal` | MarketLayout | MarketHomePage |
| `/:tenantSlug/*` | Layout (via TenantGate) | HomePage |

## Key Findings

### 1. `FORCE_ANDROID_UI = true` (platform.ts)

`isAndroidOrMobileApp()` returns **true for all users** (including desktop). This causes:
- RootLayout to always use AndroidHeader (not GlobalHeader)
- LandingLayout to use `overflow-hidden` on main when `isAndroid` is true

### 2. LandingLayout

- **Only used for `/` routes** (MarketsPickerPage, my-activity, my-account)
- **Does NOT wrap MarketHomePage or HomePage**
- When `isAndroid`: root has `overflow-hidden`, main has `overflow-hidden`

### 3. MarketLayout / Layout

- **MarketLayout** wraps MarketHomePage – no overflow-hidden on main
- **Layout** wraps HomePage (tenant stores) – no overflow-hidden on main

### 4. Native App Assets

The Android app can load from:
- **Remote URL** (e.g. https://nmd.marketing) – uses deployed code
- **Bundled assets** (file:///android_asset/public/) – uses pre-built copy

To update the native app with latest storefront:

```bash
bash scripts/android-build-with-storefront.sh
```

This builds the storefront and copies `dist/` to `apps/native-assets/customer/android-project/app/src/main/assets/public/`.

## Fixes Applied

1. **Layouts**: Added `overflow-visible` to RootLayout main, MarketLayout main, Layout main
2. **Banner section**: Added `banner-category-parent` and `overflow-visible` to the motion.section wrapping banner + categories
3. **CSS**: Strong `#category-nav-v2026` rules with `!important` for display, visibility, z-index, background, red debug border
4. **Mobile @media**: Extra rules for `max-width: 768px` to ensure category bar visibility

## If Red Border Still Doesn't Appear

1. **Rebuild**: `pnpm build:storefront` and redeploy or run `android-build-with-storefront.sh`
2. **Cache**: Hard refresh (Ctrl+Shift+R) or clear browser cache
3. **Test URL**: Confirm you're on `/dabburiyya` (MarketHomePage) or `/:store` (HomePage), not `/` (MarketsPickerPage has no category bar)
