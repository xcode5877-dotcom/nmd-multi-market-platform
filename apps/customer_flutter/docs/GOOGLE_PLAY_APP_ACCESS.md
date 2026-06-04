# Google Play — App access & reviewer login

Use this text in **Play Console → App content → App access** (and in release notes when submitting a new version).

## Instructions for reviewers

This app requires sign-in with a one-time code (OTP) sent to the phone number.

**Test account (review only):**

| Field | Value |
|--------|--------|
| Phone | `0500000000` |
| OTP | `123456` |

**Steps:**

1. Open the app and tap sign in / account.
2. Enter phone number: **0500000000** (Israeli format, 10 digits starting with 05).
3. Tap continue to request a code. No SMS/WhatsApp is required for this test line.
4. Enter OTP: **123456**.
5. If prompted for a display name (new user), enter any test name (e.g. `Play Reviewer`).
6. Browse markets, stores, and catalog as a signed-in customer.

Wrong OTP codes are rejected. Any other phone number uses the normal OTP flow (real SMS/WhatsApp).

## Technical notes (operators)

- Enforced **server-side** in `mock-api` (`google-play-review.ts` + `customer-auth.ts`).
- The Flutter app does **not** show the OTP in the UI and has no client-side bypass.
- Optional env overrides (defaults match the table above):
  - `GOOGLE_PLAY_REVIEW_PHONES=0500000000`
  - `GOOGLE_PLAY_REVIEW_OTP=123456`
- Does not delete or reset production data; may create a single test customer record for this phone on first login (same as normal registration).

## Release notes snippet

```
Reviewer login: phone 0500000000, OTP 123456 (see Play Console app access).
```
