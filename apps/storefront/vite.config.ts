import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  base: '/', // Production path: storefront at root (nmd.marketing/)
  plugins: [react()],
  resolve: {
    alias: {
      '@': `${__dirname}/src`,
    },
  },
});
