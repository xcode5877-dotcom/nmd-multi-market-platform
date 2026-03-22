import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
var __dirname = fileURLToPath(new URL('.', import.meta.url));
/** Production API base so merchant app never sends requests relative to /merchant/. */
var API_BASE = process.env.VITE_MOCK_API_URL || 'https://nmd.marketing/api';
export default defineConfig({
    // Merchant app is served from /merchant/; assets use absolute /merchant/assets/... URLs
    base: '/merchant/',
    plugins: [react()],
    server: { port: 5174 },
    resolve: {
        alias: {
            '@': "".concat(__dirname, "/src"),
        },
    },
    // Ensure production build always has full API URL (avoids relative paths under /merchant/)
    define: {
        'import.meta.env.VITE_MOCK_API_URL': JSON.stringify(API_BASE),
    },
    build: {
        // Allow CommonJS dependencies in node_modules to be bundled correctly
        commonjsOptions: {
            include: [/node_modules/],
        },
        // Single bundle to avoid "Failed to fetch dynamically imported module" during navigation in WebView
        rollupOptions: {
            output: {
                manualChunks: undefined,
                inlineDynamicImports: true,
            },
        },
    },
});
