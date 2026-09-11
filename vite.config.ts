import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative asset URLs — required for Capacitor file:// / bundled WebView
  base: './',
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
