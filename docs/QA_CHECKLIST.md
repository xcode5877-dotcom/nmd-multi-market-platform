# Pizza Addons & Storefront QA Checklist

## Pre-release verification

### A) Buffalo28 pizza product (storefront :5173)

- [ ] Select 3 addons, set different placements (كامل / يمين / يسار)
- [ ] Close/reopen popovers → placements persist
- [ ] Remove one addon → others remain
- [ ] Add to cart → cart shows placements

### B) Cart

- [ ] Cart item data contains placement for each addon (inspect in UI)
- [ ] Placements display with Arabic labels (كامل, يسار, يمين)

### C) Checkout

- [ ] POST /orders payload contains addon placement in `optionPlacements`
- [ ] Admin Orders shows placement in order detail

### D) WhatsApp

- [ ] Opens only if `tenant.branding.whatsappPhone` exists and is valid
- [ ] No fallback number; else toast only
- [ ] Message includes placement lines (كامل/يسار/يمين)

### E) Console

- [ ] No `validateDOMNesting` warnings (TopHeroCarousel uses buttons, no nested `<a>`)
- [ ] No React key warnings
- [ ] No infinite render warnings
