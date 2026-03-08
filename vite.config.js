import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
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
      },
    },
    cssMinify: true,
  },
  server: {
    port: 8000,
  },
});
