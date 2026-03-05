import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';

const queryClient = new QueryClient();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    const base = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '') || '';
    navigator.serviceWorker.register(`${base}/sw.js`).catch(() => {});
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename="/courier">
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
