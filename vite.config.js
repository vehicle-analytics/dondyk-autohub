import { defineConfig } from "vite";
import { resolve } from "path";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,json,woff,woff2}"],
        globIgnores: ["**/seed-data.json"], // Виключаємо гігантський прекеш з Service Worker!
        maximumFileSizeToCacheInBytes: 5000000, 
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/sheets\.googleapis\.com\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "google-sheets-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 // 1 day
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      },
      manifest: {
        name: "DondykAutoHub",
        short_name: "DondykAutoHub",
        description: "Аналітична панель для відстеження обслуговування автомобілів",
        theme_color: "#1e40af",
        background_color: "#0f172a",
        display: "standalone",
        orientation: "any",
        start_url: "/",
        categories: ["utilities", "productivity"],
        lang: "uk",
        icons: [
          {
            src: "icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "icon-192-maskable.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable"
          }
        ]
      }
    })
  ],
  build: {
    target: "esnext",          // Сучасний JS — менший bundle
    sourcemap: false,           // Без source maps у продакшені = менший розмір
    assetsInlineLimit: 0,       // Не інлайнити assets у JS (уникаємо роздування bundle)
    chunkSizeWarningLimit: 1000, // Збільшений поріг попередження (у KB)
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        reports: resolve(__dirname, "reports.html"),
        analytics: resolve(__dirname, "analytics.html"),
      },
      output: {
        manualChunks: {
          vendor: ["config/partsConfig.js"],
          utils: ["utils/formatters.js", "cache/cacheManager.js"],
          data: [
            "data/dataProcessor.js",
            "processing/carProcessor.js",
            "filters/carFilters.js",
          ],
          analytics: ["analytics/statsCalculator.js"],
        },
      },
    },
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ["console.log", "console.info", "console.debug"],
      },
    },
    cssMinify: true,
  },
  server: {
    port: 8000,
  },
});
