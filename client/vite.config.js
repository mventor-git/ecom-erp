import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    allowedHosts: true, // allow ngrok tunnel hostnames
    proxy: {
      '/api': {
        target: `http://localhost:${process.env.API_PORT || 5172}`,
        changeOrigin: true,
      },
      '/images': {
        target: `http://localhost:${process.env.API_PORT || 5172}`,
        changeOrigin: true,
      },
      '/create-checkout-session': {
        target: `http://localhost:${process.env.API_PORT || 5172}`,
        changeOrigin: true,
      },
      '/auth': {
        target: `http://localhost:${process.env.API_PORT || 5172}`,
        changeOrigin: true,
      },
    },
  },
});
