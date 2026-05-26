# Apple App Review — Resolution Center Response Template

**App:** Now Market (Customer)  
**Bundle ID:** `com.nowmarket.app`  
**Rejected build:** 1.0.8 (24)

Copy, adapt, and paste into **App Store Connect → Resolution Center** when resubmitting.

---

## Suggested reply (English)

Dear App Review Team,

Thank you for your feedback on build 1.0.8 (24). We have addressed each point as follows.

### Guideline 2.3.10 — Accurate metadata (screenshots)

We have removed all screenshots that were captured on Android devices. The new submission includes **only iPhone screenshots** taken on iOS (Simulator or device), with the native iOS status bar and no Android system UI.

Please see our internal checklist: `docs/APP_STORE_SCREENSHOTS_CHECKLIST.md` in our repository for the exact pixel sizes we used per device class.

### Guideline 4.2.3(i) — Login services (WhatsApp)

Our customer sign-in uses a one-time code (OTP). **App Review does not need WhatsApp installed.**

For review only, we provide an in-app demo sign-in on **iOS**:

| Field | Value |
|--------|--------|
| Phone | `0500000000` |
| OTP | `123456` |

Steps:

1. Open the app and go to **Account** (or any flow that prompts sign-in).
2. Enter phone **`0500000000`** (10 digits, Israeli format starting with 05).
3. Tap continue — the code is entered **inside the app**; nothing is sent via WhatsApp or SMS for this test line.
4. Enter OTP **`123456`**.
5. If asked for a display name (new user), enter any test name (e.g. `App Reviewer`).
6. You can browse markets, stores, catalog, cart, and checkout as a signed-in customer.

All other phone numbers continue to use the normal OTP delivery flow (including WhatsApp where configured). Only the number above uses the review path.

### Guideline 2.1(a) — App completeness (demo access)

The same credentials provide **full in-app access** without depending on receiving an external OTP message:

- Phone: **`0500000000`**
- OTP: **`123456`**

No third-party app, deep link, or SMS is required for this test account.

### Privacy Policy URL

`https://nmd.marketing/privacy.html`

---

We believe this build meets the cited guidelines. Please let us know if you need any additional information or a screen recording of the demo login.

Best regards,  
[Your name / Now Market team]

---

## App Review Information (Connect fields)

Paste into **App Store Connect → App → App Information → App Review Information**:

**Sign-in required:** Yes  

**User name / Phone:** `0500000000`  

**Password / OTP:** `123456`  

**Notes:**

```
Demo login (iOS): phone 0500000000, OTP 123456 — enter both inside the app.
WhatsApp is NOT required for this test account.
Privacy policy: https://nmd.marketing/privacy.html
```

---

## Hebrew summary (optional, for internal team)

- צילומי מסך: רק iPhone, בלי סרגל סטטוס אנדרואיד.
- התחברות לביקורת: 0500000000 + 123456 בתוך האפליקציה, בלי וואטסאפ.
- מדיניות פרטיות: https://nmd.marketing/privacy.html

---

## Resubmission checklist

- [ ] New iOS-only screenshots uploaded for all required device sizes
- [ ] Build number incremented (e.g. 1.0.8 (25) or 1.0.9)
- [ ] App Review Information updated with demo credentials
- [ ] Resolution Center reply sent (text above)
- [ ] Tested demo login on physical iPhone or Simulator before submit
