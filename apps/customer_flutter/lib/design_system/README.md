# Now Market Design System (Flutter)

Foundation layer for `apps/customer_flutter`. **Alive + Premium + Community-Driven.**

This package is UI-only. It does not import feature modules (cart, auth, API). Screen migration happens in later phases.

## Philosophy

| Pillar | Expression |
|--------|------------|
| **Alive** | Warm teal tints (`tintAlive*`), soft motion (`NmdMotion`), community surfaces |
| **Premium** | Restrained shadows, pill CTAs, Cairo typography, crisp borders |
| **Community-Driven** | Teal shell + white commerce cards; dark + gold reserved for rewards |

Reference: `docs/NOW-MARKET-SOURCE-OF-TRUTH.md`

## Structure

```
lib/design_system/
  tokens/       # Colors, type, spacing, radius, shadows, motion, semantic
  theme/        # NmdTheme.light (+ ThemeExtension extras)
  widgets/      # NmdButton, NmdCard, NmdAppHeader, …
  design_system.dart   # Barrel export
```

## Tokens

### Colors (`NmdColors`)

- **Brand:** `brandPrimary` `#0F766E`, `brandDeep`, `brandSecondary`
- **Surfaces:** `surfaceBase` (commerce white), `surfaceCommunity` (rewards dark)
- **Gold:** `accentGold` — coins, achievements only; never as default CTA
- **Semantic:** success / warning / error / info + soft backgrounds

### Typography (`NmdTypography`)

Cairo scale: `display` → `h1`–`h3` → `body` / `bodySmall` → `label` / `micro` → `button` / `appBarTitle`.

Use `Theme.of(context).textTheme` after `NmdTheme.light` is applied.

### Spacing (`NmdSpacing`)

4px base: `xxs`(4) … `xxxl`(40). Screen horizontal padding: `screenHorizontal` (16).

### Radius (`NmdRadius`)

Cards: `md`–`lg`. **Pill identity:** `borderPill` (999) for buttons, chips, badges.

### Shadows (`NmdShadows`)

Prefer borders on light cards; use `md`/`lg` for floating elements; `brandGlow` / `goldGlow` sparingly.

### Motion (`NmdMotion`)

`instant` 120ms → `page` 550ms; curves `standard`, `enter`, `exit`, `bounce`.

### Semantic (`NmdSemantic`)

Store status from API strings; `NmdBadgeTone` for badge colors.

## Usage rules

1. **Import:** `import 'package:customer_flutter/design_system/design_system.dart';`
2. **New UI** uses `Nmd*` widgets and tokens — not ad-hoc hex or radii.
3. **RTL:** Section headers and form fields default to `TextDirection.rtl`.
4. **Headers:** Use `NmdAppHeader` with injected `leading` / `actions` — wire cart/auth in presentation, not in design_system.
5. **Do not** use gold for primary actions; teal pills only.
6. **Legacy:** `AppTheme.light` delegates to `NmdTheme.light` but keeps `AppColors.shellTeal` for scaffold until migration.

## Components

| Widget | Purpose |
|--------|---------|
| `NmdButton` | Pill CTA (primary / secondary / ghost / destructive) |
| `NmdCard` | Bordered / elevated / community card |
| `NmdSectionHeader` | RTL section title + optional action |
| `NmdInput` | RTL text field |
| `NmdChip` | Filter / choice / status pills |
| `NmdBadge` | Compact status or count |
| `NmdLoading` | Branded spinner |
| `NmdEmptyState` | No data |
| `NmdErrorState` | Retryable error |
| `NmdSurface` | Layered surface modes |
| `NmdScaffold` | Header + body shell |
| `NmdAppHeader` | Centered teal bar (foundation; replaces `GlobalNmdHeader` over time) |

## Migration status

- Phase 2.1: foundation only — **no screen rewrites**
- Existing: `GlobalNmdHeader`, `NmdAppBar`, feature pages unchanged
- Next: Home → Store → Product → Cart → Checkout
