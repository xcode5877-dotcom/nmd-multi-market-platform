# Apple App Review — Resolution Center Response (ready to paste)

**App:** Now Market (Customer)  
**Bundle ID:** `com.nowmarket.app`  
**Rejected build:** 1.0.9 (25)  
**Test device noted by Apple:** iPad Air 11-inch (M3)

Copy the **Suggested reply** below into **App Store Connect → Resolution Center** when resubmitting the next build.

---

## Suggested reply (English)

Dear App Review Team,

Thank you for your feedback on build 1.0.9 (25). We have fixed the review login path on **iOS** so App Review can sign in **entirely inside the app** with **no WhatsApp installation**, **no external apps**, **no deep links**, and **no waiting for SMS or WhatsApp messages**.

### Guideline 4.2.3(i) — Login services (WhatsApp)

**WhatsApp is not required for the review test account.**

On iOS only, when you use the credentials below, the app:

- Does **not** open WhatsApp, `wa.me`, or the browser for authentication  
- Does **not** call our OTP delivery channel (`/customer/auth/start`)  
- Shows in-app instructions to enter the fixed review code  
- Completes sign-in after you enter the code in the app  

### Guideline 2.1(a) — App completeness (demo access)

**Review credentials (iOS only):**

| Field | Value |
|--------|--------|
| Phone | `+972500000000` **or** `0500000000` |
| OTP | `123456` |

**Steps:**

1. Open the app (iPhone or iPad).
2. Tap **Account** (or any screen that prompts sign-in).
3. Enter phone **`+972500000000`** or **`0500000000`**.
4. Tap **Continue** — you will see the in-app code screen (no WhatsApp step).
5. Enter OTP **`123456`**.
6. You are signed in and can use **Home**, **products**, **cart**, **checkout**, and **rewards** without installing any other app.

All other phone numbers continue to use the normal customer OTP flow (including WhatsApp where configured). Only the numbers above use the iOS review path.

### Guideline 2.3.10 — Screenshots

We have replaced prior assets with **iOS-only** screenshots (no Android status bar or navigation bar). See `docs/APP_STORE_SCREENSHOTS_CHECKLIST.md`.

### Privacy Policy URL

`https://nmd.marketing/privacy.html`

Please let us know if you need a screen recording of the demo login.

Best regards,  
Now Market team

---

## App Review Information (Connect fields)

**Sign-in required:** Yes  

**User name / Phone:** `+972500000000` (also accepts `0500000000`)  

**Password / OTP:** `123456`  

**Notes:**

```
iOS review login (in-app only): phone +972500000000 or 0500000000, OTP 123456.
WhatsApp is NOT required. No external app or message delivery for this account.
Privacy: https://nmd.marketing/privacy.html
```

---

## Resubmission checklist

- [ ] Increment build (e.g. 1.0.9 (26) or 1.0.10)
- [ ] Deploy API with review OTP verify fix (`customer-auth.ts`) if not already live
- [ ] Test on iOS Simulator: WhatsApp not installed → demo login succeeds
- [ ] iOS-only screenshots uploaded
- [ ] Paste reply above in Resolution Center
