# App Store Connect — iPhone Screenshots Checklist

**App:** Now Market Customer (`com.nowmarket.app`)  
**Bundle:** `apps/customer_flutter`

Use this checklist before uploading screenshots for **App Store Connect → App → iOS App → Previews and Screenshots**.

---

## Critical reminders (Guideline 2.3.10)

- [ ] **Use ONLY iPhone screenshots** — capture on a physical iPhone or iOS Simulator set to an iPhone device (not iPad-only unless you also provide iPad sizes).
- [ ] **No Android status bar** — do not upload images from Android devices or emulators.
- [ ] **No Samsung navigation bar** — no three-button or gesture bar from Android.
- [ ] **No mixed-platform frames** — reject any crop that shows non‑iOS system UI (battery style, notch layout from wrong device class, etc.).
- [ ] Prefer **light mode** or your App Store–approved theme consistently across all shots.
- [ ] Use **production or review-demo data** that looks realistic; avoid debug banners, `DEBUG` labels, or internal URLs.
- [ ] Text and UI must match the **submitted build** (version **1.0.8+** or whatever you ship next).

---

## Required screenshot sizes (App Store Connect)

Apple may show different sizes per device family. Prepare assets for the families you support in Connect.

| Display | Portrait size (px) | Notes |
|--------|---------------------|--------|
| **6.9"** (e.g. iPhone 16 Pro Max) | **1320 × 2868** | Largest phone class if enabled |
| **6.7"** (e.g. iPhone 15 Plus / 14 Pro Max) | **1290 × 2796** | Common “large” slot |
| **6.5"** (legacy large) | **1284 × 2778** | Still accepted for some listings |
| **6.3"** (e.g. iPhone 16 Pro) | **1206 × 2622** | If listed in your Connect UI |
| **6.1"** (e.g. iPhone 15 / 14) | **1179 × 2556** | Standard Pro/non-Pro large |
| **5.5"** (legacy) | **1242 × 2208** | Only if Connect still asks for this slot |

**How to capture in Simulator:** File → New Screen Shot (⌘S), or `xcrun simctl io booted screenshot screenshot.png` after setting the correct device.

**Minimum set:** At least **one full set** for the primary device size Connect requires for your app record (often 6.7" or 6.9"). Add other sizes only if Connect prompts for them.

---

## Recommended screens to capture (in order)

Capture **3–10** screens that show core value. Suggested flow:

1. [ ] **Splash** — branded launch / loading (optional if very short; home is often stronger).
2. [ ] **Home** — market picker or main catalog with real categories.
3. [ ] **Product** — product detail with price, image, add-to-cart.
4. [ ] **Cart** — cart with items and totals.
5. [ ] **Checkout** — delivery / payment step (no sensitive real card data).
6. [ ] **Rewards** — loyalty / coins / wheel if enabled in production.

**Optional (if space):** Account (logged in), Orders list, Store detail.

---

## Pre-upload QA

- [ ] Status bar shows **iOS** icons (cellular dots/wifi/battery iOS style).
- [ ] No “offline” or error toasts in frame.
- [ ] RTL (Arabic) layout renders correctly; no clipped text.
- [ ] Same locale and market across all screenshots for consistency.
- [ ] File format: **PNG** or **JPEG** per Connect; no borders or marketing frames unless using Apple’s optional promotional templates.

---

## Review login (for live demo during review)

Do **not** put credentials on screenshot images. Provide them in **App Review Information** (see `docs/APPLE_REVIEW_RESPONSE.md`):

- Phone: `0500000000`
- OTP: `123456`

---

## After rejection 2.3.10

1. Delete all Android-origin assets from App Store Connect.
2. Re-capture full set on iPhone Simulator or device.
3. Re-upload every required size slot.
4. In Resolution Center, state that screenshots were replaced with **iOS-only** captures.
