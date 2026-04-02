import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import wasm from 'vite-plugin-wasm'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    wasm(),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'corp-logo.png'],
      manifest: {
        name: 'Corp Matrix',
        short_name: 'Corp Matrix',
        description: 'Secure corporate messenger built on the Matrix protocol',
        theme_color: '#4a90d9',
        background_color: '#0d1117',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/corp-logo.png', sizes: '512x512', type: 'image/png' },
          { src: '/corp-logo.png', sizes: '192x192', type: 'image/png' },
          { src: '/corp-logo.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,wasm,svg,png,jpg,json}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\/_matrix\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'matrix-api', expiration: { maxEntries: 50, maxAgeSeconds: 300 } },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@app': path.resolve(__dirname, 'src/app'),
      '@features': path.resolve(__dirname, 'src/features'),
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@workers': path.resolve(__dirname, 'src/workers'),
    },
  },
  css: {
    modules: {
      localsConvention: 'camelCase',
    },
  },
  optimizeDeps: {
    exclude: ['@matrix-org/matrix-sdk-crypto-wasm'],
  },
})
