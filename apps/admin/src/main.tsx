import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { initMock } from '@nmd/mock';
import App from './App';
import './index.css';

initMock();

// Reload on chunk load failure (e.g. after deploy when index.html points to new hashed chunks but browser cached old refs)
const CHUNK_LOAD_RETRY_KEY = 'chunk-load-retry';
const MAX_CHUNK_RETRIES = 3;
function isChunkLoadError(message: string | undefined): boolean {
  if (!message) return false;
  return (
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('Importing a module script failed') ||
    message.includes('Loading chunk') ||
    message.includes('Loading CSS chunk')
  );
}
window.addEventListener('unhandledrejection', (event) => {
  const msg = event.reason?.message ?? event.reason?.toString?.() ?? '';
  if (!isChunkLoadError(msg)) return;
  const retries = parseInt(sessionStorage.getItem(CHUNK_LOAD_RETRY_KEY) || '0', 10);
  if (retries < MAX_CHUNK_RETRIES) {
    sessionStorage.setItem(CHUNK_LOAD_RETRY_KEY, String(retries + 1));
    window.location.reload();
  }
  event.preventDefault();
});
window.addEventListener('error', (event) => {
  const msg = event.message ?? '';
  if (!isChunkLoadError(msg)) return;
  const retries = parseInt(sessionStorage.getItem(CHUNK_LOAD_RETRY_KEY) || '0', 10);
  if (retries < MAX_CHUNK_RETRIES) {
    sessionStorage.setItem(CHUNK_LOAD_RETRY_KEY, String(retries + 1));
    window.location.reload();
  }
});

if ('serviceWorker' in navigator && import.meta.env.PROD && window.isSecureContext) {
  window.addEventListener('load', () => {
    const swUrl = new URL('/sw.js', window.location.origin).href;
    navigator.serviceWorker.register(swUrl, { scope: '/' }).catch(() => {});
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000 },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename="/merchant" future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
