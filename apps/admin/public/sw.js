/* Service worker for Merchant PWA: install, activate, push. Chrome (Android) and Safari (iOS 16.4+). */
const MERCHANT_ORDERS_PATH = '/merchant/orders/board';

self.addEventListener('install', function () {
  self.skipWaiting();
});
self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', function () {});

/* Push: tag prevents duplicate notifications; renotify shows again when same tag. */
self.addEventListener('push', function (event) {
  var title = 'طلب جديد وصل! 🔔';
  var body = 'لديك طلب جديد ينتظر القبول في متجر دبورية';
  var data = {};
  if (event.data) {
    try {
      data = event.data.json();
      if (data.title) title = data.title;
      if (data.body) body = data.body;
    } catch (_) {
      var text = event.data.text();
      if (text) body = text;
    }
  }
  var options = {
    body: body,
    icon: '/merchant/favicon.svg',
    badge: '/merchant/favicon.svg',
    tag: data.tag || 'new-order-alarm',
    renotify: data.renotify !== false,
    requireInteraction: true,
    vibrate: [500, 110, 500, 110, 450, 110, 200, 110, 170, 40, 450, 110, 200, 110, 170, 40, 450],
    data: { url: MERCHANT_ORDERS_PATH },
  };
  var soundUrl = new URL('/alarm.mp3', self.location.origin).href;
  options.sound = soundUrl;
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const path = event.notification.data?.url || MERCHANT_ORDERS_PATH;
  const fullUrl = new URL(path, self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.indexOf('/merchant') !== -1 && 'focus' in client) {
          client.navigate(fullUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(fullUrl);
    })
  );
});
