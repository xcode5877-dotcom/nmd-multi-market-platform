# Firebase Push (Flutter Customer App)

Package: `com.nowmarket.app`

## Android

1. In [Firebase Console](https://console.firebase.google.com/) → project **now-market-59841** → Add app → Android → `com.nowmarket.app`.
2. Download `google-services.json` into `apps/customer_flutter/android/app/`.
3. Rebuild: `flutter build apk --release`.

## iOS

1. Add iOS app in the same Firebase project (bundle ID **`com.nowmarket.app`**).
2. Download **`GoogleService-Info.plist`** from Firebase Console and place it at:
   `apps/customer_flutter/ios/Runner/GoogleService-Info.plist`
   **Do not commit a hand-edited or placeholder plist** — use the file from Firebase only.
3. Upload **APNs Authentication Key** (.p8) in Firebase → Project settings → Cloud Messaging.
4. On macOS, refresh pods: `cd apps/customer_flutter/ios && pod install`
5. Xcode Runner target: **Push Notifications** capability (repo includes `Runner/Runner.entitlements` with `aps-environment`).
6. Set **`IOS_APP_STORE_ID`** on mock-api for iOS force-update App Store links (numeric id only).
7. Rebuild: `flutter build ios --release` or `flutter build ipa --release`.

## Backend

Set on mock-api:

- `FIREBASE_SERVICE_ACCOUNT_JSON` or `FIREBASE_SERVICE_ACCOUNT_PATH`
- `STORAGE_DRIVER=db` (recommended for `CustomerFCMToken`)

Admin UI: `/push-notifications` in nmd-admin.

## Token endpoint

Flutter uploads via `POST /customer/save-fcm-token` with customer JWT after login.
