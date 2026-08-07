import cookie from "@fastify/cookie";
import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AppConfig } from "../../config.js";
import { HttpError, sendError } from "../../common/http.js";
import { attachCsrfProtection } from "../../common/security/csrf.js";
import { registerPnpV2FeedbackRoutes } from "./pnp-v2-feedback.routes.js";

const storeId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";

const config = {
  NODE_ENV: "test",
  HOST: "127.0.0.1",
  PORT: 3000,
  CORS_ORIGIN: "http://localhost:5173",
  HERMES_API_BASE_URL: "http://host.docker.internal:8642/v1",
  HERMES_API_KEY: "test-hermes-key",
  HERMES_API_MODEL: "pnpclassifier",
  HERMES_API_TIMEOUT_MS: 1000,
  SUPABASE_URL: "https://project.supabase.co",
  SUPABASE_ANON_KEY: "test-anon-key",
} as AppConfig;

afterEach(() => {
  vi.unstubAllGlobals();
});

async function buildTestApp() {
  const app = Fastify({ logger: false });
  app.decorate("config", config);
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof HttpError) return sendError(reply, error);
    throw error;
  });
  await app.register(cookie);
  attachCsrfProtection(app);
  app.post("/api/v1/unrelated", async () => ({ ok: true }));
  await app.register(registerPnpV2FeedbackRoutes, { prefix: "/api/v1/pnp-v2/feedback" });
  return app;
}

function stubAuthorizedSupabaseAndModels() {
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
    const url = String(input);
    if (url.endsWith("/auth/v1/user")) return Response.json({ id: userId, email: "staff@example.com" });
    if (url.includes("/rest/v1/memberships")) return Response.json([{ role: "staff" }]);
    if (url.includes("/rest/v1/response_criteria")) return Response.json([{
      id: "33333333-3333-4333-8333-333333333333",
      parent_id: null,
      depth: 1,
      name: "가격",
      sort_order: 1,
      active: true,
    }]);
    if (url.endsWith("/v1/models")) return Response.json({
      object: "list",
      data: [{ id: "pnpclassifier", object: "model", owned_by: "hermes" }],
    });
    throw new Error(`Unexpected request: ${url}`);
  }));
}

describe("pnp-v2 feedback routes", () => {
  it("reaches Bearer authentication without requiring a CSRF cookie", async () => {
    const app = await buildTestApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/pnp-v2/feedback/classify",
      payload: { storeId, content: "가격이 올랐나요?" },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: { code: "SUPABASE_AUTH_INVALID" } });
    await app.close();
  });

  it("keeps unrelated unsafe routes protected by CSRF", async () => {
    const app = await buildTestApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/unrelated",
      headers: { authorization: "Bearer user-access-token" },
      payload: {},
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: { code: "CSRF_TOKEN_INVALID" } });
    await app.close();
  });

  it("reports available only after auth, store access, criteria, and model checks", async () => {
    stubAuthorizedSupabaseAndModels();
    const app = await buildTestApp();
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/pnp-v2/feedback/classify/status?storeId=${storeId}`,
      headers: { authorization: "Bearer user-access-token" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ data: { available: true }, error: null });
    await app.close();
  });
});
