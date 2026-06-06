import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  base: '/market-admin/', // Production path: system admin at /market-admin (Market + Root by role)
  plugins: [react()],
  // Ensure UTF-8 for source and output (Arabic and other scripts)
  build: {
    target: 'esnext',
    rollupOptions: {
      output: { format: 'es' },
    },
  },
  server: {
    port: 5176,
    proxy: {
      '/auth': 'http://localhost:5190',
      '/categories': 'http://localhost:5190',
      '/global-categories': 'http://localhost:5190',
      '/markets': 'http://localhost:5190',
      '/tenants': 'http://localhost:5190',
      '/users': 'http://localhost:5190',
      '/leads': 'http://localhost:5190',
      '/health': 'http://localhost:5190',
      '/upload': 'http://localhost:5190',
      '/catalog': 'http://localhost:5190',
      '/orders': 'http://localhost:5190',
      '/customers': 'http://localhost:5190',
      '/campaigns': 'http://localhost:5190',
      '/delivery': 'http://localhost:5190',
      '/merchant': 'http://localhost:5190',
      '/audit-events': 'http://localhost:5190',
      '/monitoring': 'http://localhost:5190',
      '/admin': 'http://localhost:5190',
      '/templates': 'http://localhost:5190',
      '/staff': 'http://localhost:5190',
      '/storefront': 'http://localhost:5190',
      '/public': 'http://localhost:5190',
      '/courier': 'http://localhost:5190',
    },
  },
  resolve: {
    alias: {
      '@': `${__dirname}/src`,
    },
    dedupe: ['react', 'react-dom'],
  },
});
