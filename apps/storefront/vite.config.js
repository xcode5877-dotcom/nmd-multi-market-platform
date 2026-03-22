import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
var __dirname = fileURLToPath(new URL('.', import.meta.url));
export default defineConfig({
    base: './', // Works for both web (nmd.marketing) and file:// (Android assets/public)
    plugins: [react()],
    resolve: {
        alias: {
            '@': "".concat(__dirname, "/src"),
        },
    },
    build: {
        outDir: 'dist',
        rollupOptions: {
            output: {
                entryFileNames: 'assets/[name]-[hash].js',
                chunkFileNames: 'assets/[name]-[hash].js',
                assetFileNames: 'assets/[name]-[hash][extname]',
            },
        },
    },
});
