import { afterEach, describe, expect, it, vi } from "vitest";

import type { AppConfig } from "../../config.js";
import {
  loadAuthorizedStoreCriteria,
  requestPnpV2HermesSuggestion,
  type SupabaseCriterion,
} from "./pnp-v2-feedback.service.js";

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

const criteria: SupabaseCriterion[] = [
  { id: "30000000-0000-4000-8000-000000000001", parent_id: null, depth: 1, name: "맛", sort_order: 1, active: true },
  { id: "30000000-0000-4000-8000-000000000002", parent_id: "30000000-0000-4000-8000-000000000001", depth: 2, name: "식감", sort_order: 1, active: true },
  { id: "30000000-0000-4000-8000-000000000003", parent_id: "30000000-0000-4000-8000-000000000002", depth: 3, name: "바게트", sort_order: 1, active: true },
];

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

describe("requestPnpV2HermesSuggestion", () => {
  it("sends masked content and registered criteria with the pnpclassifier contract", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      capturedUrl = String(input);
      capturedInit = init;
      return Response.json({
        id: "chatcmpl-test",
        object: "chat.completion",
        created: 1,
        model: "pnpclassifier",
        choices: [{
          index: 0,
          message: {
            role: "assistant",
            content: JSON.stringify({
              major: "맛",
              mid: "식감",
              minor: "바게트",
              signal: "불만/개선",
              summary: "바게트 식감이 단단하다는 의견",
              reason: "등록된 식감 기준과 일치합니다.",
            }),
          },
          finish_reason: "stop",
        }],
      });
    }));

    await expect(requestPnpV2HermesSuggestion(
      config,
      "010-1234-5678 고객이 바게트가 딱딱하다고 말했다.",
      criteria,
    )).resolves.toEqual({
      major: "맛",
      mid: "식감",
      minor: "바게트",
      signal: "불만/개선",
      summary: "바게트 식감이 단단하다는 의견",
      reason: "등록된 식감 기준과 일치합니다.",
    });

    expect(capturedUrl).toBe("http://host.docker.internal:8642/v1/chat/completions");
    const requestBody = JSON.parse(String(capturedInit?.body)) as {
      model: string;
      stream: boolean;
      temperature: number;
      messages: Array<{ content: string }>;
    };
    expect(requestBody.model).toBe("pnpclassifier");
    expect(requestBody.stream).toBe(false);
    expect(requestBody.temperature).toBe(0);
    expect(requestBody.messages.at(-1)?.content).toContain("[PHONE]");
    expect(requestBody.messages.at(-1)?.content).not.toContain("010-1234-5678");
    expect(requestBody.messages.at(-1)?.content).toContain("30000000-0000-4000-8000-000000000003");
  });

  it("rejects an unregistered category path", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({
      choices: [{ message: { content: JSON.stringify({
        major: "맛",
        mid: "식감",
        minor: "등록되지 않은 빵",
        signal: "불만/개선",
        summary: "요약",
        reason: "이유",
      }) } }],
    })));

    await expect(requestPnpV2HermesSuggestion(config, "빵이 딱딱해요", criteria))
      .rejects.toMatchObject({ statusCode: 502, code: "HERMES_INVALID_SUGGESTION" });
  });

  it("rejects a signal outside the current service contract", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({
      choices: [{ message: { content: JSON.stringify({
        major: "맛",
        mid: "식감",
        minor: "바게트",
        signal: "새로운 신호",
        summary: "요약",
        reason: "이유",
      }) } }],
    })));

    await expect(requestPnpV2HermesSuggestion(config, "빵이 딱딱해요", criteria))
      .rejects.toMatchObject({ statusCode: 502, code: "HERMES_INVALID_SUGGESTION" });
  });

  it("maps transport failures to a stable error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("connect ECONNREFUSED"))));

    await expect(requestPnpV2HermesSuggestion(config, "빵이 딱딱해요", criteria))
      .rejects.toMatchObject({ statusCode: 502, code: "HERMES_SUGGESTION_FAILED" });
  });
});
