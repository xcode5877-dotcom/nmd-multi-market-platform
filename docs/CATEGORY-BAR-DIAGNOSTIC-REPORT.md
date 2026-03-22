# Category Bar Mobile Invisibility – Diagnostic Report

## 1. Final CSS in dist/

**Result:** `#category-nav-v2026` **IS** in the built output.

- **HomePage-KIe-fPQD.js** – Contains category-nav-v2026 (minified)
- **MarketHomePage-CLIbEpuR.js** – Contains category-nav-v2026 (minified)
- **index-CW5PVgTO.css** – Contains `#category-nav-v2026`, `force-category-bar`, `banner-category-parent`, red border rules

**Conclusion:** Build is including our code. The problem is not a failed build.

---

## 2. Ghost Layout – display:none / visibility:hidden

**Found in index.css @media (max-width: 768px):**

```css
.bottom-nav,
.mobile-nav,
.bottom-navigation,
nav[class*="bottom"],
div[class*="bottom-nav"],
#bottom-navigation {
  display: none !important;
  visibility: hidden !important;
  height: 0 !important;
  opacity: 0 !important;
  pointer-events: none !important;
}
```

**Analysis:**
- `div[class*="bottom-nav"]` – Our category div uses `force-category-bar` (no "bottom-nav") ✓ Safe
- `nav[class*="bottom"]` – Our nav elements do not use classes containing "bottom" ✓ Safe

**Conclusion:** These selectors should not hide our category bar.

---

## 3. Body / #root Overflow

**index.css:**
```css
html, body {
  overflow-x: hidden;  /* NOT overflow: hidden */
  ...
}
```

**Conclusion:** Only `overflow-x: hidden` is set. Vertical overflow is not restricted. Body/#root do not use `overflow: hidden`.

---

## 4. Direct Action – ForceVisibleCategories.tsx

**Created:** `apps/storefront/src/components/ForceVisibleCategories.tsx`

**Injected in:** `App.tsx` – Rendered at the root, inside `PlatformThemeGate`, before `Suspense`/Routes. It is outside all route-specific layouts.

**Component:** A div with:
- `id="force-visible-categories-root-test"`
- Inline styles: `display: flex`, `visibility: visible`, `opacity: 1`, `z-index: 99999`, `border: 3px solid red`
- Text: "🔴 ForceVisibleCategories (root test)"

**Test logic:**
- **If it appears on mobile** → Root-level rendering works; the issue is in page routing or layout nesting.
- **If it does not appear** → Something above the React tree (e.g. body classes, viewport, or native app shell) is blocking or clipping content.

---

## Next Steps

1. Rebuild: `pnpm build:storefront`
2. Test on mobile web
3. Check whether the red "ForceVisibleCategories (root test)" bar is visible
4. Report the result to decide whether to focus on routing/layout or on a systemic override
