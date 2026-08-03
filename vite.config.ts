import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon.svg'],
      manifest: {
        name: '빅맥계산기',
        short_name: '빅맥계산기',
        description: '가격을 빅맥 개수로 환산해 보여주는 계산기',
        lang: 'ko',
        theme_color: '#f6f4ef',
        background_color: '#f6f4ef',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          {
            // 가격 데이터는 항상 최신을 먼저 시도하고, 오프라인이면 캐시로 폴백.
            // 재배포 없이 prices.json만 교체해도 반영되게 하는 핵심 설정.
            urlPattern: /\/data\/prices\.json$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'prices-data',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
});
