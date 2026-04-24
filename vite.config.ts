import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  preview: {
    allowedHosts: ['ncr-reserves-production.up.railway.app', 'all'],
    host: '0.0.0.0',
    port: 4173,
  },
  server: {
    host: '0.0.0.0',
  },
})
