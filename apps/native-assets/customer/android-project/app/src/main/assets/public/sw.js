/* PWA Service Worker: installable. Works on Chrome (Android) and Safari (iOS 16.4+ Web Push).
   Scope: / (required for push on iOS). CACHE DISABLED — Network First. */
var CACHE_NAME = 'nmd-storefront-v1';
self.addEventListener('install', function (e) {
  e.waitUntil(Promise.resolve().then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(names.map(function (n) { return caches.delete(n); }));
    }).then(function () { return self.clients.claim(); })
  );
});
/* Always go to network first; do not serve from cache or write to cache. */
self.addEventListener('fetch', function (e) {
  e.respondWith(
    fetch(e.request).catch(function () {
      var url = new URL(e.request.url);
      if (url.origin === self.location.origin && e.request.mode === 'navigate') {
        return caches.match('/index.html').then(function (r) { return r || caches.match('/'); });
      }
      throw new Error('offline');
    })
  );
});

/* Push: show notification (tag prevents duplicates; renotify shows new when same tag). */
self.addEventListener('push', function (e) {
  var data = {};
  if (e.data) {
    try {
      data = e.data.json();
    } catch (_) {
      data = { title: e.data.text() || 'تنبيه' };
    }
  }
  var title = data.title || 'دبورية مول';
  var options = {
    body: data.body || '',
    icon: data.icon || '/icons/icon-192.png',
    badge: data.badge || '/icons/icon-192.png',
    tag: data.tag || 'nmd-push',
    renotify: data.renotify !== false,
    data: data.data || { url: data.url || '/' },
    requireInteraction: !!data.requireInteraction,
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (var i = 0; i < clientList.length; i++) {
        if (clientList[i].url && 'focus' in clientList[i]) {
          clientList[i].navigate(url);
          return clientList[i].focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
