import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { createServer as createHttpServer } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import httpolyglot from "httpolyglot";
import { createServer as createViteServer } from "vite";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const host = process.env.HOST ?? "0.0.0.0";
const port = Number.parseInt(process.env.PORT ?? "5173", 10);
const dualProtocolEnabled = process.env.VITE_DEV_HTTPS === "true";
const apiProxyTarget = process.env.VITE_API_PROXY_TARGET ?? "http://localhost:3000";

function ensureCertificate() {
  const certDir = resolve(root, "node_modules/.vite/pnp-dev-cert");
  const keyPath = resolve(certDir, "localhost-key.pem");
  const certPath = resolve(certDir, "localhost-cert.pem");

  if (!existsSync(keyPath) || !existsSync(certPath)) {
    mkdirSync(certDir, { recursive: true });
    execFileSync("openssl", [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-sha256",
      "-days",
      "30",
      "-subj",
      "/CN=localhost",
      "-addext",
      "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:1.226.52.124",
      "-keyout",
      keyPath,
      "-out",
      certPath
    ]);
  }

  return {
    key: readFileSync(keyPath),
    cert: readFileSync(certPath)
  };
}

let vite;
const server = dualProtocolEnabled
  ? httpolyglot.createServer(ensureCertificate(), (request, response) =>
      vite.middlewares(request, response)
    )
  : createHttpServer((request, response) => vite.middlewares(request, response));

vite = await createViteServer({
  root,
  appType: "spa",
  server: {
    middlewareMode: true,
    allowedHosts: true,
    host,
    port,
    hmr: { host: process.env.VITE_HMR_HOST, server },
    proxy: {
      "/api": apiProxyTarget
    }
  }
});

server.listen(port, host, () => {
  const protocols = dualProtocolEnabled ? "http/https" : "http";
  console.log(`PNP Vite dev server listening on ${protocols}://localhost:${port}/`);
  if (dualProtocolEnabled) {
    console.log(`HTTP  : http://localhost:${port}/`);
    console.log(`HTTPS : https://localhost:${port}/`);
  }
});
