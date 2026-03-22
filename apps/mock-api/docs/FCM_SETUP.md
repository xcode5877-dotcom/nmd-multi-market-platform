# FCM (Firebase Cloud Messaging) – Backend Setup

## 1. Firebase Admin SDK

Set **one** of:

- **FIREBASE_SERVICE_ACCOUNT_JSON** – stringified JSON of the service account key (e.g. from Firebase Console → Project settings → Service accounts → Generate new private key). Prefer in production so no file is needed on disk.
- **FIREBASE_SERVICE_ACCOUNT_PATH** – path to the JSON file (e.g. `./google-services-account.json`).

If neither is set, FCM sending is skipped (Web Push and other flows still work).

## 2. Database

**Global Identity:** FCM tokens are linked to **userId** (not to a store). The same merchant can log in from any store; their token is stored once per user.

- **User.fcmToken** – legacy single token (still updated for backward compatibility).
- **UserFCMToken** – one row per device; allows multiple tokens per user (e.g. phone + tablet). Tokens are keyed by `userId` only.

After deploying schema changes, run:

```bash
pnpm --filter mock-api db:push
# or
pnpm --filter mock-api db:migrate
```

## 3. API

- **PUT /users/me/fcm-token** – body `{ "fcmToken": "..." }`, requires auth. Registers the device token for the **current user** (userId). The token is associated with that user regardless of which store they are viewing. Up to 10 tokens per user (oldest removed when over).
- When a new order is created for **Store A**, the API: (1) finds all **owner** users (users with `tenantId` = Store A, plus **MARKET_ADMIN** users for that store’s market), (2) collects every FCM token linked to those users (from `UserFCMToken` and legacy `User.fcmToken`), (3) sends the notification to each token.

## 4. Web dashboard

The merchant **web** dashboard continues to use **Web Push (VAPID)** for browser notifications. No Firebase Web SDK is required in the browser; only the native Android app uses FCM.

## 5. End-to-end flow (Merchant Android app)

1. **Order creation** – `POST /orders` in `apps/mock-api/src/index.ts` saves the order, then calls `sendFCMToTenantForNewOrder(tenantId, order)` (fire-and-forget). No auth bypass; FCM is triggered for the tenant’s owners.
2. **Backend FCM** – `sendFCMToTenantForNewOrder` loads owner users (tenantId + MARKET_ADMIN for that market), collects tokens from `UserFCMToken` and `User.fcmToken`, and sends via `firebase-admin` (`sendFCMToToken`). Uses **Service Account** (see above); no Server Key.
3. **Token registration** – Android app gets FCM token on startup (prefetch in `MainActivity`) and when the merchant logs in the frontend calls `NativeBridge.getFCMToken(callback)`, then `PUT /users/me/fcm-token` with `Authorization: Bearer <jwt>` and `{ "fcmToken": "..." }`. Backend saves to `User.fcmToken` and `UserFCMToken`.
4. **Notification on device** – `MyFirebaseMessagingService` receives the message (foreground/background), shows a high-priority notification with sound. If the user taps it, the app opens with `orderId` in the intent; the WebView can read `NativeBridge.getPendingOrderId()` and navigate to the order.
