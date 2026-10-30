/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        // Emit the MapLibre worker (an .mjs asset) as .js so any static host serves it with a JavaScript MIME type.
        assetFileNames: (asset) =>
          asset.names?.some((n) => n.endsWith(".mjs")) ? "assets/[name]-[hash].js" : "assets/[name]-[hash][extname]",
        manualChunks: {
          maplibre: ["maplibre-gl"],
          charts: ["recharts"],
        },
      },
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
