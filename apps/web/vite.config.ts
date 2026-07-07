import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const apiProxyTarget = process.env.VITE_API_PROXY_TARGET ?? "http://localhost:3000";
const viteCacheDir = process.env.VITE_CACHE_DIR;

export default defineConfig({
  plugins: [react()],
  ...(viteCacheDir ? { cacheDir: viteCacheDir } : {}),
  resolve: {
    alias: {
      "@pnp/shared": fileURLToPath(new URL("../../packages/shared/src/index.ts", import.meta.url))
    }
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
    port: 5173,
    proxy: {
      "/api": apiProxyTarget
    }
  }
});
