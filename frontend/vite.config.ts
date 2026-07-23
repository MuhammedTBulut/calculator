/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Keep local development same-origin like the nginx production topology.
    proxy: {
      // The backend exposes /health (no /api prefix). nginx rewrites
      // /api/health → /health in the same way; mirror that here so
      // the dev server and production behave identically.
      '/api/health': {
        target: process.env.VITE_PROXY_TARGET ?? 'http://127.0.0.1:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/api': {
        target: process.env.VITE_PROXY_TARGET ?? 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
    },
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: ['src/main.tsx', 'src/test/**'],
    },
  },
})
