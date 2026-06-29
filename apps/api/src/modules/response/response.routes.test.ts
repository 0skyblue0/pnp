import type { ApiEnvelope } from "@pnp/shared";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { describe, expect, it, vi } from "vitest";

import { HttpError, sendError } from "../../common/http.js";
import { registerResponseRoutes } from "./response.routes.js";

type CountRatio = {
  count: number;
  ratio: number;
};

type CriterionStats = CountRatio & {
  criterionId: number | null;
  name: string;
  depth: number | null;
  parentId: number | null;
};

type MiddleStats = CriterionStats & {
  majorCriterionId: number;
};

type MinorStats = CriterionStats & {
  majorCriterionId: number;
  middleCriterionId: number | null;
};

type ResponseStatsBody = {
  from: string;
  to: string;
  total: number;
  major: CriterionStats[];
  middle: MiddleStats[];
  minor: MinorStats[];
  insights: {
    headline: string;
    repeatedTopics: Array<{
      criterionId: number;
      label: string;
      count: number;
      ratio: number;
      sampleSummaries: string[];
    }>;
    keyNotes: string[];
  };
};

function buildPrismaMock() {
  return {
    $transaction: vi.fn(async (queries: Promise<unknown>[]) => Promise.all(queries)),
    customerResponse: {
      count: vi.fn(),
      groupBy: vi.fn(),
      findMany: vi.fn()
    },
    responseCriterion: {
      findMany: vi.fn()
    }
  };
}

function decorateTestConfig(app: FastifyInstance, overrides: Record<string, unknown> = {}) {
  app.setErrorHandler((error: Error, _request: FastifyRequest, reply: FastifyReply) => {
    if (error instanceof HttpError) {
      return sendError(reply, error);
    }
    throw error;
  });
  app.decorate("config", {
    NODE_ENV: "test",
    HOST: "127.0.0.1",
    PORT: 0,
    CORS_ORIGIN: "http://localhost:5173",
    HERMES_API_BASE_URL: "http://127.0.0.1:8642/v1",
    HERMES_API_KEY: "test-hermes-key",
    HERMES_API_MODEL: "pnp-response-classifier",
    HERMES_API_TIMEOUT_MS: 1000,
    ...overrides
  });
}

describe("response suggestion route", () => {
  it("asks the dedicated Hermes API server with masked customer text", async () => {
    const prisma = buildPrismaMock();
    prisma.responseCriterion.findMany.mockResolvedValue([
      { id: 1, parentId: null, depth: 1, name: "제품", sortOrder: 1, isActive: true },
      { id: 2, parentId: 1, depth: 2, name: "품목", sortOrder: 1, isActive: true },
      { id: 3, parentId: 2, depth: 3, name: "바게트", sortOrder: 1, isActive: true },
      { id: 4, parentId: null, depth: 1, name: "불만", sortOrder: 2, isActive: false }
    ]);
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (typeof init?.body !== "string") {
        throw new Error("Expected string request body");
      }
      const requestBody = JSON.parse(init.body) as {
        model: string;
        messages: { role: string; content: string }[];
        temperature: number;
      };
      expect(requestBody.model).toBe("pnp-response-classifier");
      expect(requestBody.temperature).toBe(0);
      expect(requestBody.messages[0]?.content).toContain("고객 반응 분류 전용 프로필");
      expect(requestBody.messages.at(-1)?.content).toContain("[PHONE]");
      expect(requestBody.messages.at(-1)?.content).not.toContain("010-1234-5678");

      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  criterionId: 3,
                  shortSummary: "바게트 품목 상태 불만",
                  reason: "바게트와 불만 표현이 함께 언급되었습니다."
                })
              }
            }
          ]
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const app = Fastify({ logger: false });
    decorateTestConfig(app);
    app.decorate("prisma", prisma as never);
    await app.register(registerResponseRoutes, { prefix: "/response" });

    const response = await app.inject({
      method: "POST",
      url: "/response/suggest",
      payload: {
        fullText:
          "010-1234-5678 고객이 바게트가 어제보다 너무 딱딱해서 먹기 불편했다고 불만을 말했고 품목 상태 확인을 요청했다."
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<
      ApiEnvelope<{ criterionId: number; shortSummary: string; criterionPath: { name: string }[] }>
    >();
    expect(body.error).toBeNull();
    expect(body.data).not.toBeNull();
    if (!body.data) {
      throw new Error("Expected suggestion data");
    }

    expect(body.data.criterionId).toBe(3);
    expect(body.data.criterionPath.map((item) => item.name)).toEqual(["제품", "품목", "바게트"]);
    expect(body.data.shortSummary).toBe("바게트 품목 상태 불만");
    const firstFetchCall = fetchMock.mock.calls[0];
    const firstFetchOptions = firstFetchCall?.[1];
    expect(firstFetchCall?.[0]).toBe("http://127.0.0.1:8642/v1/chat/completions");
    expect(firstFetchOptions?.method).toBe("POST");
    expect((firstFetchOptions?.headers as Record<string, string> | undefined)?.Authorization).toBe(
      "Bearer test-hermes-key"
    );
    expect(prisma.responseCriterion.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: [{ depth: "asc" }, { parentId: "asc" }, { sortOrder: "asc" }, { name: "asc" }]
    });

    await app.close();
  });

  it("shows a suggestion failure instead of falling back when Hermes is unavailable", async () => {
    const prisma = buildPrismaMock();
    prisma.responseCriterion.findMany.mockResolvedValue([
      { id: 1, parentId: null, depth: 1, name: "제품", sortOrder: 1, isActive: true }
    ]);
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("connect ECONNREFUSED"))));

    const app = Fastify({ logger: false });
    decorateTestConfig(app);
    app.decorate("prisma", prisma as never);
    await app.register(registerResponseRoutes, { prefix: "/response" });

    const response = await app.inject({
      method: "POST",
      url: "/response/suggest",
      payload: { fullText: "고객이 바게트가 딱딱하다고 말했다." }
    });

    expect(response.statusCode).toBe(502);
    const body = response.json<{ error?: { code?: string; message?: string }; data?: unknown }>();
    expect(body).toMatchObject({
      error: {
        code: "HERMES_SUGGESTION_FAILED",
        message: "AI 추천에 실패했습니다. 잠시 후 다시 시도하거나 직접 분류하세요."
      }
    });

    await app.close();
  });
});

describe("response stats route", () => {
  it("returns major, middle, and minor aggregate stats without the list API limit", async () => {
    const prisma = buildPrismaMock();
    prisma.customerResponse.count.mockResolvedValue(6);
    prisma.customerResponse.groupBy
      .mockResolvedValueOnce([
        { majorCriterionId: 1, _count: { _all: 4 } },
        { majorCriterionId: 2, _count: { _all: 2 } }
      ])
      .mockResolvedValueOnce([
        { majorCriterionId: 1, middleCriterionId: 3, _count: { _all: 3 } },
        { majorCriterionId: 1, middleCriterionId: 4, _count: { _all: 1 } },
        { majorCriterionId: 2, middleCriterionId: 5, _count: { _all: 2 } }
      ])
      .mockResolvedValueOnce([
        { majorCriterionId: 1, middleCriterionId: 3, minorCriterionId: 6, _count: { _all: 2 } },
        { majorCriterionId: 1, middleCriterionId: 3, minorCriterionId: 7, _count: { _all: 1 } },
        { majorCriterionId: 2, middleCriterionId: 5, minorCriterionId: 8, _count: { _all: 2 } }
      ]);
    prisma.responseCriterion.findMany.mockResolvedValue([
      { id: 1, parentId: null, depth: 1, name: "제품", sortOrder: 1 },
      { id: 2, parentId: null, depth: 1, name: "요청", sortOrder: 2 },
      { id: 3, parentId: 1, depth: 2, name: "맛", sortOrder: 1 },
      { id: 4, parentId: 1, depth: 2, name: "포장", sortOrder: 2 },
      { id: 5, parentId: 2, depth: 2, name: "예약", sortOrder: 1 },
      { id: 6, parentId: 3, depth: 3, name: "바게트", sortOrder: 1 },
      { id: 7, parentId: 3, depth: 3, name: "식감", sortOrder: 2 },
      { id: 8, parentId: 5, depth: 3, name: "대량", sortOrder: 1 }
    ]);
    prisma.customerResponse.findMany.mockResolvedValue([
      { majorCriterionId: 1, middleCriterionId: 3, minorCriterionId: 6, shortSummary: "바게트 맛 불만 반복" },
      { majorCriterionId: 1, middleCriterionId: 3, minorCriterionId: 6, shortSummary: "바게트 식감 확인 필요" },
      { majorCriterionId: 2, middleCriterionId: 5, minorCriterionId: 8, shortSummary: "예약 대량 문의" }
    ]);

    const app = Fastify({ logger: false });
    app.decorate("prisma", prisma as never);
    await app.register(registerResponseRoutes, { prefix: "/response" });

    const response = await app.inject({
      method: "GET",
      url: "/response/stats?from=2026-01-01&to=2026-01-31"
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<ApiEnvelope<ResponseStatsBody>>();
    expect(body.error).toBeNull();
    expect(body.data).not.toBeNull();
    if (!body.data) {
      throw new Error("Expected stats response data");
    }

    const stats = body.data;
    expect(stats).toMatchObject({
      from: "2026-01-01",
      to: "2026-01-31",
      total: 6
    });
    expect(stats.major).toEqual([
      { criterionId: 1, name: "제품", depth: 1, parentId: null, count: 4, ratio: 2 / 3 },
      { criterionId: 2, name: "요청", depth: 1, parentId: null, count: 2, ratio: 1 / 3 }
    ]);
    expect(stats.middle).toEqual([
      {
        criterionId: 3,
        majorCriterionId: 1,
        name: "맛",
        depth: 2,
        parentId: 1,
        count: 3,
        ratio: 0.5
      },
      {
        criterionId: 4,
        majorCriterionId: 1,
        name: "포장",
        depth: 2,
        parentId: 1,
        count: 1,
        ratio: 1 / 6
      },
      {
        criterionId: 5,
        majorCriterionId: 2,
        name: "예약",
        depth: 2,
        parentId: 2,
        count: 2,
        ratio: 1 / 3
      }
    ]);
    expect(stats.minor).toEqual([
      {
        criterionId: 6,
        majorCriterionId: 1,
        middleCriterionId: 3,
        name: "바게트",
        depth: 3,
        parentId: 3,
        count: 2,
        ratio: 1 / 3
      },
      {
        criterionId: 7,
        majorCriterionId: 1,
        middleCriterionId: 3,
        name: "식감",
        depth: 3,
        parentId: 3,
        count: 1,
        ratio: 1 / 6
      },
      {
        criterionId: 8,
        majorCriterionId: 2,
        middleCriterionId: 5,
        name: "대량",
        depth: 3,
        parentId: 5,
        count: 2,
        ratio: 1 / 3
      }
    ]);
    expect(stats.insights.headline).toBe("6건 중 제품 비중이 가장 큽니다.");
    expect(stats.insights.repeatedTopics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          criterionId: 6,
          label: "바게트",
          count: 2,
          ratio: 1 / 3,
          sampleSummaries: ["바게트 맛 불만 반복", "바게트 식감 확인 필요"]
        }),
        expect.objectContaining({
          criterionId: 8,
          label: "대량",
          count: 2,
          ratio: 1 / 3,
          sampleSummaries: ["예약 대량 문의"]
        })
      ])
    );

    expect(prisma.customerResponse.count).toHaveBeenCalledWith({
      where: {
        date: {
          gte: new Date("2026-01-01T00:00:00.000Z"),
          lte: new Date("2026-01-31T00:00:00.000Z")
        },
        majorCriterion: { is: { isActive: true } }
      }
    });
    expect(prisma.customerResponse.groupBy).toHaveBeenCalledTimes(3);
    expect(prisma.customerResponse.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 300 }));
    for (const [query] of prisma.customerResponse.groupBy.mock.calls) {
      expect(query).not.toHaveProperty("take");
    }

    await app.close();
  });
});
