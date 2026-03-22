# Merchant notification flow – audit checklist

This document summarizes the end-to-end flow and where each piece lives, for placing a test order and seeing a push notification on the merchant’s Android device.

## Backend

| Check | Location | Status |
|-------|----------|--------|
| Order creation triggers FCM | `apps/mock-api/src/index.ts`: after `repos.orders.addOrderWithPayment(created, ...)`, `sendFCMToTenantForNewOrder(orderTenantId, created)` is called | ✅ |
| Firebase auth | `apps/mock-api/src/firebase-admin.ts`: uses **Service Account** via `FIREBASE_SERVICE_ACCOUNT_JSON` or `FIREBASE_SERVICE_ACCOUNT_PATH` (not Server Key) | ✅ |
| User/DB has FCM token | `prisma/schema.prisma`: `User.fcmToken` (legacy) + `UserFCMToken` (multi-device) | ✅ |
| API to save token | `PUT /users/me/fcm-token` – body `{ "fcmToken": "..." }`, requires `Authorization: Bearer <jwt>`. Writes to `User.fcmToken` and `UserFCMToken`. | ✅ |

## Android app

| Check | Location | Status |
|-------|----------|--------|
| FCM token on startup | `MainActivity.onCreate`: `FirebaseMessaging.getInstance().getToken()` prefetch so token is ready when frontend asks | ✅ |
| Token sent to backend on login | Frontend (`OrderAlarmContext.tsx`) calls `NativeBridge.getFCMToken('window.__onFCMToken')` after login, then `PUT https://nmd.marketing/api/users/me/fcm-token` with Bearer token | ✅ |
| Debug button layout | `MainActivity`: `btnParams.setMargins(0, 0, 0, 32)` (no `bottom = 32`) | ✅ |
| Handle FCM in background/foreground | `MyFirebaseMessagingService` – `onMessageReceived` shows notification; passes `orderId` in intent when opening `MainActivity` | ✅ |
| Manifest | `AndroidManifest.xml`: `<service android:name=".MyFirebaseMessagingService">` with `com.google.firebase.MESSAGING_EVENT` | ✅ |

## Test flow

1. **Backend:** Set `FIREBASE_SERVICE_ACCOUNT_PATH` or `FIREBASE_SERVICE_ACCOUNT_JSON` (see `FIREBASE-SERVICE-ACCOUNT.md`).
2. **Merchant:** Open Android app → log in (merchant dashboard). Ensure “FCM: found” in the debug strip and/or that `PUT /users/me/fcm-token` appears in mock-api logs with a token.
3. **Place order:** Create a test order for that merchant’s store (e.g. from storefront or `POST /orders`).
4. **Device:** Notification should appear; tapping it opens the app. Optionally the WebView can call `NativeBridge.getPendingOrderId()` and navigate to the order.

## If notifications don’t arrive

- **Backend logs:** Look for `[FCM] sendFCMToTenantForNewOrder`, `Total FCM tokens to send: 0` (no token saved) vs `Sent to token`.
- **Token registration:** Confirm `PUT /users/me/fcm-token` is called with a valid JWT and non-empty `fcmToken` after login.
- **Firebase:** Ensure `google-services.json` package name matches `com.nmd.merchant` and the service account has FCM permissions.
