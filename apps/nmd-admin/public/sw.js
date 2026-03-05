/* Minimal service worker for PWA "Add to Home Screen" (System Admin). */
self.addEventListener('install', function () {
  self.skipWaiting();
});
self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', function () {});
