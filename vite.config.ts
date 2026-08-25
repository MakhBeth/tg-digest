/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({ globals: { Buffer: true, process: true } }),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'tg-digest',
        short_name: 'tg-digest',
        theme_color: '#0f1115',
        display: 'standalone',
      },
    }),
  ],
  test: { environment: 'node', passWithNoTests: true },
})
