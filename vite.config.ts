import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  // Relative asset paths so the built `dist/` works when opened directly from the
  // filesystem (file://) AND when served from a web server. Production hosts
  // (Vercel, Netlify) handle either correctly.
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: { port: 5173, host: true },
});
