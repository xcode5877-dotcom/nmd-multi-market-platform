import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { initMock } from '@nmd/mock';
import App from './App';
import './index.css';

initMock();

function hideSplash() {
  const s = document.getElementById('splash');
  if (s) {
    s.style.opacity = '0';
    setTimeout(() => { s.style.display = 'none'; }, 300);
  }
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
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
setTimeout(hideSplash, 100);

/* Service Worker disabled for development — load site directly without SW to verify design changes. */
// if ('serviceWorker' in navigator && import.meta.env.PROD) {
//   window.addEventListener('load', () => {
//     navigator.serviceWorker.register('/sw.js').catch(() => {});
//   });
// }
