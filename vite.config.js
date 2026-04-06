import { defineConfig } from "vite";
import { resolve } from "path";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss()],
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
