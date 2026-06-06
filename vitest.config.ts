import { defineConfig } from 'vitest/config';
import path from 'path';

// Smoke-test config. Node environment (the tested code is pure logic +
// WebCrypto, no DOM). The `@` alias mirrors vite.config so imports resolve.
export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
  },
});
