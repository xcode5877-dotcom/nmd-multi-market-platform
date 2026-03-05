import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { initMock } from '@nmd/mock';
import App from './App';
import './index.css';

if (!import.meta.env.VITE_MOCK_API_URL) {
  initMock();
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    const base = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '') || '';
    navigator.serviceWorker.register(`${base}/sw.js`).catch(() => {});
  });
}

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename="/market-admin">
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
