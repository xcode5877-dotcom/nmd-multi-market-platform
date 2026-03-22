# Notifications System Audit - State of Implementation

Summary of how notifications work across Storefront, Admin (Merchant), and Courier so audio alerts can be added without breaking existing logic.

---

## 1. Technology: How New Orders Are Detected

| App | Mechanism | Details |
|-----|-----------|--------|
| **Merchant Admin** (apps/admin) | **HTTP Polling** | No WebSockets or SSE. Orders fetched every **5 seconds** via `useQuery` with `refetchInterval: 5000`. Query key: `['orders-board', tenantId]`. Same polling in **OrderAlarmContext** and **OrdersBoardPage**. |
| **Courier** (apps/courier) | **Server-Sent Events (SSE)** | Single `EventSource` to **GET /courier/events?token=...**. Events: `connected`, `order_assigned`, `order_unassigned`, `order_ready`. Implemented in `useCourierEvents` (apps/courier/src/hooks/useCourierEvents.ts). |
| **Storefront** | N/A for "new order" | Customer does not listen for new orders in real time. "تم إرسال طلبك بنجاح" is shown after checkout submit (see section 4). Order status updates (CONFIRMED, READY, etc.) go via **Web Push**. |
| **NMD-Admin** | N/A | No real-time order notifications. |

**Summary:** Merchant = **polling (5s)**. Courier = **SSE**. No WebSockets.

---

## 2. Background Support: Service Worker and Push

### Service Worker (sw.js)

- **Merchant Admin:** `apps/admin/public/sw.js` - Install/activate, **push** (new order), **notificationclick** (open to orders board). **Already sets `options.sound = origin + '/alarm.mp3'`** for push notifications.
- **Storefront:** `apps/storefront/public/sw.js` - Install/activate, fetch (network-first), **push** (status updates), **notificationclick**. No sound in options.
- **Courier / NMD-Admin:** Have sw.js; courier does not use push for orders (uses SSE in foreground).

### Push: FCM vs Custom

- **Custom Web Push (VAPID)** only. No Firebase/FCM.
- **Backend:** `apps/mock-api/src/push-subscriptions.ts` uses **web-push** with VAPID keys (env or hardcoded). `sendPushNotification(subscription, payload)` sends to subscription endpoint.
- **Merchant:** POST /merchant/push-subscription (stores by tenantId), GET /merchant/push-public-key.
- **Customer:** POST /customer/push-subscription (stores by phone), GET /customer/push-public-key.
- **When merchant push is sent:** After creating an order in **POST /orders** (apps/mock-api/src/index.ts), `notifyMerchantNewOrder(created, tenant)` is called. Subscriptions by tenantId receive Web Push. **Service Worker** shows system notification and uses alarm.mp3 if available.

So: **Service Worker already handles Push**; Merchant sw.js is integrated with **custom VAPID Push API** and already references `/alarm.mp3`.

---

## 3. PWA Status: Manifest and Capabilities

- **Manifests:** All apps have `public/manifest.json` with `display: "standalone"`, icons, scope. No explicit `background_sync` or `push` in manifest; Push is requested at runtime via PushManager and Service Worker.
- **Background Sync:** Not used.
- **Push:** Used for Merchant (new order) and Customer (order status). SW registered in admin main.tsx (production) and subscription in OrderAlarmContext + DashboardPage.

---

## 4. UI Triggers: Where Messages and Toasts Come From

| Message / Behavior | Where |
|--------------------|--------|
| **"تم إرسال طلبك بنجاح"** (customer) | **Storefront** `apps/storefront/src/pages/CheckoutPage.tsx`: inside **createOrder** mutation **onSuccess** (~line 184). `addToast('تم إرسال طلبك بنجاح', 'success')` then navigate to order success page. |
| **Merchant "new order"** | (1) **Foreground:** **OrderAlarmContext** reacts to polling: when `pendingCount > 0` it plays **audio** (/alarm.mp3 or fallback beep). (2) **Background:** Server sends Web Push; **Service Worker** (apps/admin/public/sw.js) shows **system notification** "طلب جديد وصل! 🔔". |
| **Order status (customer)** | Server calls `notifyCustomerOrderStatusPush(phone, status)`. Storefront SW receives push and shows system notification. |
| **Courier: new assignment / ready** | **Courier** `apps/courier/src/pages/CourierOrdersPage.tsx`: **useCourierEvents** callback. On `order_assigned`/`order_unassigned` invalidates queries; on `order_ready` calls `setToastMessage('Order #... is READY for pickup!')`. |

---

## 5. Current Limitations: Tab Completely Closed

- **Merchant:** **Yes.** Server still sends Web Push to tenant subscriptions. Browser/OS can show system notification (and sound where supported) when tab is closed.
- **Courier:** **No.** Uses SSE in foreground only. When tab is closed, EventSource is gone; no push for courier.
- **Customer:** **Yes** for order status updates if they have a push subscription (by phone).

---

## 6. Where the "Event Listener" for New Orders Lives (for Audio)

### Merchant Admin (apps/admin)

- **Foreground (tab open):**  
  - **Listener:** Polling in **OrderAlarmContext** (apps/admin/src/contexts/OrderAlarmContext.tsx).  
  - **Query:** `useQuery({ queryKey: ['orders-board', tenantId], refetchInterval: REFETCH_MS })` with REFETCH_MS = 5000.  
  - **Reaction:** `hasPendingAlarm = pendingCount > 0` (PENDING orders). The **useEffect** that depends on `[hasPendingAlarm, muted]` (~lines 236-272) **already plays audio**: creates `Audio(ALARM_SRC)` (/alarm.mp3), loop: true, play (or playFallbackBeep every 800ms).  
  - **Safe place to add/change audio:** That same **useEffect** in **OrderAlarmContext**. Do not remove dependency on hasPendingAlarm and muted.

- **Background (tab closed):**  
  - **Listener:** **push** event in **Service Worker** apps/admin/public/sw.js.  
  - **Handler:** `self.addEventListener('push', ...)`. Already sets `options.sound = origin + '/alarm.mp3'`.  
  - **Safe place:** Same push handler; adjust sound URL or behavior if needed.

### Courier (apps/courier)

- **Listener:** **useCourierEvents** callback in **CourierOrdersPage.tsx** (~lines 395-404).  
- **Events:** order_assigned, order_unassigned (invalidate queries), order_ready (setToastMessage).  
- **Safe place to add audio:** In that callback, when `event.type === 'order_assigned'` or `order_ready`, play a sound in addition to existing invalidation/toast.

### Storefront (customer)

- "تم إرسال طلبك بنجاح" is checkout success in **CheckoutPage** (onSuccess), not a "new order" listener. For order status push, the listener is the **Storefront SW** push event in apps/storefront/public/sw.js; sound can be added there if desired.

---

## 7. Summary Table

| App | How new orders/assignments are seen | Listener location | Where to add audio |
|-----|-------------------------------------|-------------------|---------------------|
| Merchant Admin | Polling (5s) + Web Push (background) | OrderAlarmContext (useEffect on hasPendingAlarm); admin sw.js (push) | Same useEffect (foreground); same push handler (background; sound already set) |
| Courier | SSE /courier/events | useCourierEvents callback in CourierOrdersPage | Same callback (e.g. on order_assigned / order_ready) |
| Storefront | N/A (checkout success only) | CheckoutPage mutation onSuccess | N/A for new order; optional in sw.js for status push |

---

## 8. Key Files

- Merchant foreground alarm: `apps/admin/src/contexts/OrderAlarmContext.tsx`
- Merchant background push: `apps/admin/public/sw.js`
- Server new-order push: `apps/mock-api/src/index.ts` (POST /orders), `apps/mock-api/src/services/NotificationService.ts` (notifyMerchantNewOrder)
- Push send: `apps/mock-api/src/push-subscriptions.ts`
- Courier SSE: `apps/courier/src/hooks/useCourierEvents.ts`, `apps/courier/src/pages/CourierOrdersPage.tsx`
- Storefront checkout success: `apps/storefront/src/pages/CheckoutPage.tsx`
