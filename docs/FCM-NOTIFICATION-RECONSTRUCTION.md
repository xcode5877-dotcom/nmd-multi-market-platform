# FCM Notification System — Reconstruction Summary

This document summarizes the surgical reconstruction of the Merchant app push notification flow and serves as a reference for verification and Android configuration.

---

## Phase 1: Deep Clean (Done)

- **Single FCM path:** All FCM token capture and server sync now go through `apps/admin/src/lib/fcm-bridge.ts`. No duplicate callback slots; one `__onFCMToken` at a time to avoid races.
- **No token in localStorage:** FCM token is never cached in localStorage; it is sent to the server only (PUT `/users/me/fcm-token`).
- **Redundant logic removed:** The previous inline FCM effect in OrderAlarmContext (multiple timeouts, duplicate callback setup) was replaced by calls to `registerFCMTokenAndSyncToServer`. `window.forceRegisterFCM()` still exists for console debugging but delegates to the same function.

---

## Phase 2: Foundation (Done)

### Bridge audit

- **Android:** `MainActivity` adds `FCMBridge` as `NativeBridge`. `getFCMToken(callbackName)` runs `FirebaseMessaging.getInstance().getToken()` and invokes the JS global (e.g. `window.__onFCMToken`) on the UI thread with the token (or empty string on failure). FCM token is prefetched in `onCreate` so it is often ready when the WebView calls.
- **Web:** `fcm-bridge.ts` exposes `getBridgeStatus()` and `registerFCMTokenAndSyncToServer()`. The React app (OrderAlarmContext) calls the latter with auth token; on callback it PUTs to the server and updates `fcmLastSyncTime` and `fcmTokenStatus`.

### Token capture and server sync

- **Retries:** After login, registration runs at **0 ms, 2 s, 5 s, and 15 s**, and again on **visibilitychange** (app foregrounded). This covers slow bridge/WebView init.
- **Token refresh:** Re-running on visibilitychange effectively re-syncs when the user returns to the app; if the native side gets a new token (e.g. `onNewToken`), the next bridge call can send it. No separate refresh API required on the web.

---

## Phase 3: Server-Side (Already in place)

- **Storage:** Mock API stores FCM token in:
  - `User.fcmToken` (legacy)
  - `UserFCMToken` (per-token table, limit 10 per user).
- **Endpoint:** `PUT /users/me/fcm-token` (auth required) accepts `{ fcmToken: string }` and updates both.
- **Trigger:** On new order creation, `sendFCMToTenantForNewOrder(tenantId, order)` is called. It resolves store owners (and market admins) and sends FCM to all their tokens via `sendFCMToToken()` (Firebase Admin SDK). Payload includes `title`, `body`, and `data: { orderId, type: 'new_order' }`.

**Requirement:** Firebase must be configured (e.g. `FIREBASE_SERVICE_ACCOUNT_PATH` or `FIREBASE_SERVICE_ACCOUNT_JSON`). If not set, FCM send is no-op and logs a warning.

---

## Phase 4: Foreground & Background (Done)

- **Foreground:** When the app is open and a new order appears (polling or refetch), OrderAlarmContext shows a **toast** (“طلب جديد! لديك N طلب…”) and, if not muted, plays the **alarm sound** (or fallback beep).
- **Background:** FCM payload is built in `firebase-admin.ts` with:
  - `notification: { title, body }` for system tray
  - `data: { orderId, type: 'new_order' }` for click handling
  - `android.notification.channelId: 'new_order_alerts'`, `priority: 'high'`, sound, etc.

Android `MyFirebaseMessagingService` receives the message, shows a notification with title/body/sound, and sets the activity intent with `orderId`. Tapping the notification opens the app and `getPendingOrderId()` returns the id; AdminLayout navigates to `/orders/board?highlight=<orderId>`.

---

## Phase 5: Diagnostics (Done)

In **Merchant app → إعدادات المحل (Store settings)** a card **“إشعارات الطلبات — تشخيص”** shows:

- **حالة الجسر (Native Bridge):** متصل / غير متاح (from `getBridgeStatus()`).
- **رمز FCM:** تم الاستلام / لم يُستلم / — (from `fcmTokenStatus`).
- **آخر مزامنة مع الخادم:** relative time or date (from `fcmLastSyncTime`).
- Button **“إعادة ربط الجهاز بالإشعارات”** when the bridge is present, calling `registerFCMTokenManual`.

---

## Android Configuration Checklist

If notifications still do not reach the device, verify:

1. **google-services.json**  
   - Present in `android-project/app/` (or the module that applies the Firebase plugin).  
   - Package name matches the app and the Firebase project.

2. **Firebase Cloud Messaging**  
   - FCM is enabled in the Firebase Console for the project.  
   - No conflicting or disabled FCM configuration.

3. **MyFirebaseMessagingService**  
   - Registered in `AndroidManifest.xml` with `<intent-filter>` for FCM (Firebase SDK usually adds this).  
   - `CHANNEL_ID = "new_order_alerts"` matches the backend payload `channelId`.

4. **MainActivity**  
   - WebView URL loads the Merchant app (e.g. `https://nmd.marketing/merchant/`).  
   - User-Agent includes the suffix that the web app uses to detect the native shell (e.g. `NMD-Native-App`), so the same FCM registration path is used.  
   - `FCMBridge` is added as `JavascriptInterface` with name `NativeBridge`.  
   - `getFCMToken(String callbackName)` invokes the global callback (e.g. `window.__onFCMToken`) with the token string; escaping is correct for JS (e.g. `'` and `\` in the token).

5. **Notification permission (Android 13+)**  
   - `POST_NOTIFICATIONS` is requested (e.g. in `MainActivity.requestNotificationPermission()`).

6. **Backend**  
   - `FIREBASE_SERVICE_ACCOUNT_PATH` or `FIREBASE_SERVICE_ACCOUNT_JSON` is set.  
   - Service account has the “Firebase Cloud Messaging API” (or equivalent) permission so the Admin SDK can send.

7. **Token flow**  
   - Merchant logs in in the WebView.  
   - After login, the web app calls `NativeBridge.getFCMToken('window.__onFCMToken')`.  
   - Android invokes the callback with the token; the web app sends it to `PUT /users/me/fcm-token`.  
   - Creating an order for that store triggers `sendFCMToTenantForNewOrder`, which sends to that token.

---

## Files Touched

| Area | File |
|------|------|
| FCM module | `apps/admin/src/lib/fcm-bridge.ts` (new) |
| Alarm context | `apps/admin/src/contexts/OrderAlarmContext.tsx` (refactor + lastSyncTime, bridge status) |
| Diagnostics UI | `apps/admin/src/pages/StoreSettingsPage.tsx` (diagnostics card) |
| Backend | No change (already stores token and sends on new order) |
| Android | No code change (existing bridge and service are used) |

---

## Global Identity

- FCM token is associated with the **user** (JWT `sub`), not with a specific store. The same user can manage one or more stores; they receive new-order notifications for stores they own or manage.  
- Auth remains a single global session (`nmd-access-token`). No change to login or tenant context.
