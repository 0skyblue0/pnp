import basicSsl from "@vitejs/plugin-basic-ssl";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const apiProxyTarget = process.env.VITE_API_PROXY_TARGET ?? "http://localhost:3000";
const devHttpsEnabled = process.env.VITE_DEV_HTTPS === "true";
const viteCacheDir = process.env.VITE_CACHE_DIR;

export default defineConfig({
  plugins: [react(), ...(devHttpsEnabled ? [basicSsl()] : [])],
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
