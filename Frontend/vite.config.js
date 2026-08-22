import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
    envDir: '..',
    plugins: [react()],
    server: {
        port: 5173,
        strictPort: true,
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    charts: ['recharts'],
                    maps: ['leaflet', 'react-leaflet'],
                    vendor: ['react', 'react-dom', 'react-router-dom'],
                },
            },
        },
    },
});
