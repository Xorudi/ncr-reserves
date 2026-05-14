import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// ─── Hardening notes ──────────────────────────────────────────────────────────
//  • `allowedHosts` is locked to the known Railway domain. Removed the
//    permissive 'all' value which disabled Vite's host check and opened the
//    door to DNS rebinding attacks against the preview server.
//  • Source maps are explicitly disabled for production builds so the
//    deployed bundle does not leak the un-minified codebase.
//  • Production is served by `server.mjs` (see package.json `start`) with
//    full security headers — `vite preview` is NOT a production server.
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  build:   {
    sourcemap: false,
    target:    'es2020',
  },
  preview: {
    allowedHosts: ['ncr-reserves-production.up.railway.app'],
    host: '0.0.0.0',
    port: 4173,
  },
  server: {
    host: '0.0.0.0',
  },
})
