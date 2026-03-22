import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { initMock } from '@nmd/mock';
import App from './App';
import './index.css';

const isFileProtocol = typeof window !== 'undefined' && window.location?.protocol === 'file:';
const Router = isFileProtocol ? HashRouter : BrowserRouter;

const isApp = typeof navigator !== 'undefined' && navigator.userAgent.includes('NMDCustomerApp');
const isNativeAndroidApp = typeof navigator !== 'undefined' && navigator.userAgent.includes('NMD-Android-App');
if (isApp) document.body.classList.add('is-app');
if (isNativeAndroidApp) document.body.classList.add('is-native-app');

/** Catch script/chunk load failures (e.g. after deploy) and reload to get new assets */
window.addEventListener('error', (e: ErrorEvent | Event) => {
  const message = (e as ErrorEvent).message || '';
  const chunkErrorMsgs = [
    'Failed to fetch dynamically imported module',
    'Unable to preload',
    'error loading dynamically imported module',
  ];
  const isChunkError = chunkErrorMsgs.some((msg) => message.includes(msg));
  if (isChunkError || e.target instanceof HTMLScriptElement) {
    if (!navigator.userAgent.includes('NMDCustomerApp')) {
      window.location.reload();
    }
    // In app: no reload to avoid WebView flicker; user can retry or restart
  }
}, true);

initMock();

function hideSplash() {
  const s = document.getElementById('splash');
  if (s) {
    s.style.opacity = '0';
    setTimeout(() => { s.style.display = 'none'; }, 400);
  }
}
if (isApp) {
  hideSplash();
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 0, refetchOnWindowFocus: true },
  },
});

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <Router>
        <App />
      </Router>
    </QueryClientProvider>
  </React.StrictMode>
);
if (!isApp) setTimeout(hideSplash, 4000);

/* Service Worker: required for Web Push on Chrome (Android) and Safari (iOS 16.4+). */
if (typeof window !== 'undefined' && 'serviceWorker' in navigator && window.isSecureContext && import.meta.env.PROD) {
  window.addEventListener('load', function () {
    var swUrl = new URL('sw.js', window.location.origin).href;
    navigator.serviceWorker.register(swUrl, { scope: '/' }).catch(function () {});
  });
}
