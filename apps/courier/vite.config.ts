import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  base: '/courier/', // Production path: courier app at /courier (nmd.marketing/courier)
  plugins: [react()],
  server: { port: 5177 },
  resolve: {
    alias: {
      '@': `${__dirname}/src`,
    },
  },
});
