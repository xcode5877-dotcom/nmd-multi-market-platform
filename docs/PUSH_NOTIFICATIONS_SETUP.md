# Push notifications (FCM) — required files

Production customer push uses **Firebase Cloud Messaging**. The codebase builds without these secrets; delivery requires configuring them on the server and in mobile builds.

## Backend (mock-api / Docker)

Set **one** of:

| Variable | Description |
|----------|-------------|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Stringified Firebase service account JSON (recommended for CI) |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Path inside container, e.g. `/app/firebase-service-account.json` |

File: `firebase-service-account.json` — from Firebase Console → Project settings → Service accounts → **Generate new private key**. Must match the same Firebase project as the customer apps (e.g. `now-market-59841`).

`docker-compose.yml` mounts the file at `FIREBASE_SERVICE_ACCOUNT_PATH`.

Verify: Super Admin → **إشعارات العملاء** → status shows **FCM: مُهيّأ**.

## Flutter customer app (Android)

| File | Location |
|------|----------|
| `google-services.json` | `apps/customer_flutter/android/app/google-services.json` |

Generate via [FlutterFire CLI](https://firebase.flutter.dev/docs/overview): `flutterfire configure` for package `com.nowmarket.app` (or your app id).

Without this file, `build.gradle.kts` skips the Google Services plugin and FCM init is skipped at runtime (no fake “success”).

## Flutter customer app (iOS)

| File | Location |
|------|----------|
| `GoogleService-Info.plist` | `apps/customer_flutter/ios/Runner/GoogleService-Info.plist` |

Also enable **Push Notifications** capability and upload APNs key/cert in Firebase Console.

## Token registration

After customer OTP login, the app calls `POST /customer/save-fcm-token` with Bearer `nmd-customer-token`. Tokens are stored in `CustomerFCMToken` (DB) or `customer.fcmToken` (JSON store).

## Channels

| App | Android channel ID |
|-----|-------------------|
| Customer Flutter | `customer_notifications` |
| Merchant native | `new_order_alerts` |

Admin broadcast and order-status pushes use `customer_notifications`.
