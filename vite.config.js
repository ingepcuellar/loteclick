import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const brand = env.VITE_BRAND || 'predioclick'

  // Nombres dinámicos por marca
  const brandNames = {
    predioclick: { name: 'PredioClick', shortName: 'PredioClick', color: '#0f172a' },
    jvj: { name: 'J.V.J. Constructores', shortName: 'JVJ', color: '#f97316' },
    diamante: { name: 'El Diamante Campestre', shortName: 'Diamante', color: '#020617' },
  }

  const brandInfo = brandNames[brand] || brandNames.predioclick

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'favicon-*.svg', 'logo.png', 'logo-*.png'],
        manifest: {
          name: brandInfo.name,
          short_name: brandInfo.shortName,
          description: `Sistema de Gestión de Lotes - ${brandInfo.name}`,
          theme_color: brandInfo.color,
          background_color: brandInfo.color,
          display: 'standalone',
          orientation: 'portrait',
          scope: '/',
          start_url: '/',
          icons: [
            {
              src: '/favicon.svg',
              sizes: '192x192',
              type: 'image/svg+xml',
              purpose: 'any maskable'
            },
            {
              src: '/logo.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        },
        workbox: {
          // Permitir archivos grandes (logos HD y JS bundle)
          maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10 MB
          // Cachear todos los assets estáticos
          globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,jpeg,woff,woff2}'],
          // Estrategia de caché para las llamadas API
          runtimeCaching: [
            {
              // Cachear las llamadas GET al API para lectura offline
              urlPattern: /\/api\/endpoints\/.*$/,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-cache',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 // 24 horas
                },
                networkTimeoutSeconds: 5,
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            {
              // Cachear las imágenes y uploads
              urlPattern: /\/api\/uploads\/.*$/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'images-cache',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 60 * 60 * 24 * 7 // 7 días
                }
              }
            }
          ]
        }
      })
    ],
    base: '/',
    server: {
      port: 3000,
      open: true
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      emptyOutDir: true
    }
  }
})
