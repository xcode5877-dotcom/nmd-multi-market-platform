import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  base: '/merchant/', // Production path: merchant at /merchant (nmd.marketing/merchant)
  plugins: [react()],
  server: { port: 5174 },
  resolve: {
    alias: {
      '@': `${__dirname}/src`,
    },
  },
});
