# Android Customer App — Checklist & Setup

Use a **separate Android applicationId** and Firebase project (or same Firebase project with a second Android app) for the Customer app so FCM tokens and config stay distinct from the Merchant app.

## Checklist

| Item | Merchant (existing) | Customer (new) |
|------|---------------------|----------------|
| **applicationId** | `com.nmd.merchant` | `com.nmd.customer` |
| **Package name** | `com.nmd.merchant` | `com.nmd.customer` |
| **WebView URL** | `https://nmd.marketing/merchant/` | `https://nmd.marketing/` (storefront) or your storefront URL |
| **Firebase** | One Android app in Firebase Console | Add a second Android app with package `com.nmd.customer`, download `google-services.json` into `app/` |
| **User-Agent suffix** | `NMD-Native-App` | `NMD-Native-App` (same so storefront detects native) |
| **FCM Bridge** | `NativeBridge.getFCMToken('window.__onFCMToken')` | Same; storefront uses `PUT /customer/me/fcm-token` |
| **Notification tap** | `getPendingOrderId()` → navigate to order | Same; storefront can navigate to order status |

## Firebase Console

1. Open your Firebase project (or create one for customer).
2. Add app → Android.
3. Package name: `com.nmd.customer`.
4. Download `google-services.json` and place in `apps/native-assets/customer/android-project/app/`.
5. Ensure the Customer app is linked to the same or a dedicated FCM-enabled project so the mock API (or production server) can send to customer tokens.

## Build

- Use the same Gradle/AGP setup as the merchant app; only change `applicationId` and package names to `com.nmd.customer`.
- Point `WEBVIEW_URL` in `MainActivity.java` to your storefront (e.g. `https://nmd.marketing/`).

## Behaviour

- **FCM token**: Web calls `NativeBridge.getFCMToken('window.__onFCMToken')`; native returns token and storefront PUTs it to `PUT /customer/me/fcm-token`.
- **Order status FCM**: When backend sends a data message with `orderId` / `status` / `title` / `body`, the customer app shows a system notification (background) or forwards to the WebView (foreground) via `window.__onOrderStatus({ orderId, status, title, body })`.
- **Notification tap**: Intent extra `orderId` is exposed to the web via `NativeBridge.getPendingOrderId()` so the storefront can navigate to the order.
