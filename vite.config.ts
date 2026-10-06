import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: process.env.DQ_BASE ?? '/day-quest/',
  build: { target: 'es2020', chunkSizeWarningLimit: 800 },
  plugins: [
    VitePWA({
      registerType: 'prompt', // never reload under a playing child; new version applies on next launch
      injectRegister: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,webp,png,svg,woff2,txt,webmanifest}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
      manifest: {
        name: 'היום של רפאל',
        short_name: 'רפאל',
        lang: 'he',
        dir: 'rtl',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#bfe3f7',
        background_color: '#eaf6fd',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
});
