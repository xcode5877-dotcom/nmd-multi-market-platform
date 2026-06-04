# Firebase Push (Flutter Customer App)

Package: `com.nowmarket.app`

## Android

1. In [Firebase Console](https://console.firebase.google.com/) → project **now-market-59841** → Add app → Android → `com.nowmarket.app`.
2. Download `google-services.json` into `apps/customer_flutter/android/app/`.
3. Rebuild: `flutter build apk --release`.

## iOS

1. Add iOS app in the same Firebase project (bundle ID from Xcode).
2. Download `GoogleService-Info.plist` into `apps/customer_flutter/ios/Runner/`.
3. Upload **APNs Authentication Key** (.p8) in Firebase → Project settings → Cloud Messaging.
4. Enable Push Notifications capability in Xcode for the Runner target.
5. Rebuild: `flutter build ios --release`.

## Backend

Set on mock-api:

- `FIREBASE_SERVICE_ACCOUNT_JSON` or `FIREBASE_SERVICE_ACCOUNT_PATH`
- `STORAGE_DRIVER=db` (recommended for `CustomerFCMToken`)

Admin UI: `/push-notifications` in nmd-admin.

## Token endpoint

Flutter uploads via `POST /customer/save-fcm-token` with customer JWT after login.
