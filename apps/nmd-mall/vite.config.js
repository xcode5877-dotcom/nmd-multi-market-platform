import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
var __dirname = fileURLToPath(new URL('.', import.meta.url));
export default defineConfig({
    plugins: [react()],
    server: { port: 5175 },
    resolve: {
        alias: {
            '@': "".concat(__dirname, "/src"),
        },
    },
});
