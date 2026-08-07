import { afterEach, describe, expect, it, vi } from "vitest";

import type { AppConfig } from "../../config.js";
import { loadAuthorizedStoreCriteria } from "./pnp-v2-feedback.service.js";

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

describe("loadAuthorizedStoreCriteria", () => {
  it("rejects a token that Supabase Auth does not recognize", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(
      JSON.stringify({ message: "invalid token" }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    )));

    await expect(loadAuthorizedStoreCriteria(config, "invalid-token", storeId))
      .rejects.toMatchObject({ statusCode: 401, code: "SUPABASE_AUTH_INVALID" });
  });

  it("rejects a viewer membership before loading criteria", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/auth/v1/user")) {
        return Response.json({ id: userId, email: "viewer@example.com" });
      }
      if (url.includes("/rest/v1/memberships")) {
        return Response.json([{ role: "viewer" }]);
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(loadAuthorizedStoreCriteria(config, "viewer-token", storeId))
      .rejects.toMatchObject({ statusCode: 403, code: "STORE_ACCESS_DENIED" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("loads only active criteria for the requested store with the caller token", async () => {
    const criterion = {
      id: "33333333-3333-4333-8333-333333333333",
      parent_id: null,
      depth: 1,
      name: "맛",
      sort_order: 1,
      active: true,
    };
    const requests: Array<{ url: string; headers: Headers }> = [];
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      requests.push({ url, headers: new Headers(init?.headers) });
      if (url.endsWith("/auth/v1/user")) return Response.json({ id: userId, email: "staff@example.com" });
      if (url.includes("/rest/v1/memberships")) return Response.json([{ role: "staff" }]);
      if (url.includes("/rest/v1/response_criteria")) return Response.json([criterion]);
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(loadAuthorizedStoreCriteria(config, "user-access-token", storeId))
      .resolves.toEqual([criterion]);

    const membershipRequest = requests.find((request) => request.url.includes("/memberships"));
    const criteriaRequest = requests.find((request) => request.url.includes("/response_criteria"));
    expect(membershipRequest?.url).toContain(`store_id=eq.${storeId}`);
    expect(membershipRequest?.url).toContain(`user_id=eq.${userId}`);
    expect(criteriaRequest?.url).toContain(`store_id=eq.${storeId}`);
    expect(criteriaRequest?.url).toContain("active=eq.true");
    expect(criteriaRequest?.headers.get("Authorization")).toBe("Bearer user-access-token");
    expect(criteriaRequest?.headers.get("apikey")).toBe("test-anon-key");
  });
});
