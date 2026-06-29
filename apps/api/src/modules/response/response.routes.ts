import type { Prisma } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { formatDateOnly, parseDateOnly } from "../../common/datetime.js";
import { HttpError, sendOk } from "../../common/http.js";
import { maskPii } from "../llm/pii-masker.js";
import {
  createResponseSchema,
  listResponseQuerySchema,
  statsResponseQuerySchema,
  suggestResponseSchema,
  updateResponseSchema,
  type CreateResponseInput,
  type SuggestResponseInput,
  type UpdateResponseInput
} from "./response.schemas.js";

const idParamsSchema = z.object({
  id: z.coerce.bigint().positive()
});

type ResponseCriterionPathItem = {
  id: number;
  parentId: number | null;
  depth: number;
  name: string;
};

type CriterionWithParents = Prisma.ResponseCriterionGetPayload<{
  include: {
    parent: {
      include: {
        parent: true;
      };
    };
  };
}>;

type ResponseWithRelations = Prisma.CustomerResponseGetPayload<{
  include: {
    criterion: true;
    majorCriterion: true;
    middleCriterion: true;
    minorCriterion: true;
  };
}>;

type DateRangeQuery = {
  from?: string | undefined;
  to?: string | undefined;
};

type CriterionGroup = {
  _count: { _all: number };
};

type MajorGroup = CriterionGroup & {
  majorCriterionId: number;
};

type MiddleGroup = CriterionGroup & {
  majorCriterionId: number;
  middleCriterionId: number | null;
};

type MinorGroup = CriterionGroup & {
  majorCriterionId: number;
  middleCriterionId: number | null;
  minorCriterionId: number | null;
};

type ResponseInsightTopic = {
  criterionId: number;
  label: string;
  path: ResponseCriterionPathItem[];
  count: number;
  ratio: number;
  sampleSummaries: string[];
};

type CriterionPathIds = {
  criterionId: number;
  majorCriterionId: number;
  middleCriterionId: number | null;
  minorCriterionId: number | null;
};

const activeResponseCriterionWhere: Prisma.CustomerResponseWhereInput = {
  majorCriterion: { is: { isActive: true } }
};

function buildDateWhere(query: DateRangeQuery): Prisma.CustomerResponseWhereInput {
  return query.from || query.to
    ? {
        date: {
          ...(query.from ? { gte: parseDateOnly(query.from) } : {}),
          ...(query.to ? { lte: parseDateOnly(query.to) } : {})
        }
      }
    : {};
}

function ratio(count: number, total: number): number {
  return total > 0 ? count / total : 0;
}

function toCriterionPath(response: ResponseWithRelations): ResponseCriterionPathItem[] {
  const path: ResponseCriterionPathItem[] = [];

  for (const criterion of [
    response.majorCriterion,
    response.middleCriterion,
    response.minorCriterion
  ]) {
    if (criterion) {
      path.push({
        id: criterion.id,
        parentId: criterion.parentId,
        depth: criterion.depth,
        name: criterion.name
      });
    }
  }

  return path;
}

function toResponseDto(response: ResponseWithRelations) {
  return {
    id: response.id.toString(),
    date: formatDateOnly(response.date),
    criterionId: response.criterionId,
    majorCriterionId: response.majorCriterionId,
    middleCriterionId: response.middleCriterionId,
    minorCriterionId: response.minorCriterionId,
    criterionPath: toCriterionPath(response),
    shortSummary: response.shortSummary,
    fullText: response.fullText,
    llmAssisted: response.llmAssisted,
    createdAt: response.createdAt.toISOString()
  };
}

function criterionLabel(criterion: ResponseCriterionPathItem | undefined): string {
  return criterion?.name ?? "미분류";
}

function toCriterionStat(
  criterion: ResponseCriterionPathItem | undefined,
  count: number,
  total: number
) {
  return {
    criterionId: criterion?.id ?? null,
    name: criterionLabel(criterion),
    depth: criterion?.depth ?? null,
    parentId: criterion?.parentId ?? null,
    count,
    ratio: ratio(count, total)
  };
}

function buildPathFromCriteria(
  criteriaById: Map<number, ResponseCriterionPathItem>,
  criterion: ResponseCriterionPathItem
): ResponseCriterionPathItem[] {
  const path: ResponseCriterionPathItem[] = [];
  let current: ResponseCriterionPathItem | undefined = criterion;

  while (current) {
    path.unshift(current);
    current = current.parentId ? criteriaById.get(current.parentId) : undefined;
  }

  return path;
}

function buildResponseInsights(
  total: number,
  majorGroups: MajorGroup[],
  minorGroups: MinorGroup[],
  criteriaById: Map<number, ResponseCriterionPathItem>,
  responses: ResponseWithRelations[]
) {
  const summariesByCriterionId = new Map<number, string[]>();
  for (const response of responses) {
    const criterionId = response.minorCriterionId ?? response.middleCriterionId ?? response.majorCriterionId;
    const summaries = summariesByCriterionId.get(criterionId) ?? [];
    if (response.shortSummary && !summaries.includes(response.shortSummary)) {
      summaries.push(response.shortSummary);
    }
    summariesByCriterionId.set(criterionId, summaries.slice(0, 3));
  }

  const repeatedTopics: ResponseInsightTopic[] = minorGroups
    .filter((group) => group.minorCriterionId !== null)
    .map((group) => {
      const criterion = criteriaById.get(group.minorCriterionId ?? 0);
      return {
        criterionId: group.minorCriterionId ?? 0,
        label: criterionLabel(criterion),
        path: criterion ? buildPathFromCriteria(criteriaById, criterion) : [],
        count: group._count._all,
        ratio: ratio(group._count._all, total),
        sampleSummaries: summariesByCriterionId.get(group.minorCriterionId ?? 0) ?? []
      };
    })
    .filter((topic) => topic.criterionId > 0 && topic.count > 0)
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
    .slice(0, 5);

  const complaintGroup = majorGroups.find((group) => criteriaById.get(group.majorCriterionId)?.name === "불만");
  const topMajorGroup = [...majorGroups].sort((left, right) => right._count._all - left._count._all)[0];
  const topMajorName = topMajorGroup ? criterionLabel(criteriaById.get(topMajorGroup.majorCriterionId)) : "기록 없음";
  const topTopic = repeatedTopics[0];

  return {
    headline:
      total > 0
        ? `${total.toLocaleString("ko-KR")}건 중 ${topMajorName} 비중이 가장 큽니다.`
        : "조회 기간에 등록된 손님 반응이 없습니다.",
    repeatedTopics,
    keyNotes: [
      complaintGroup && complaintGroup._count._all > 0
        ? `불만 ${complaintGroup._count._all.toLocaleString("ko-KR")}건은 우선 확인이 필요합니다.`
        : "조회 기간에 확인할 불만 반복 항목은 없습니다.",
      topTopic
        ? `가장 반복된 세부 내용은 ${topTopic.path.map((item) => item.name).join(" > ")}입니다.`
        : "아직 반복 내용을 판단할 기록이 없습니다.",
      total > 0
        ? `대표님 보고에는 상위 반복 내용 ${Math.min(repeatedTopics.length, 3)}개만 먼저 보이면 충분합니다.`
        : "기록이 쌓이면 상위 반복 내용과 주의 사항이 자동으로 표시됩니다."
    ]
  };
}

type SuggestCriterion = ResponseCriterionPathItem & {
  sortOrder: number;
  isActive: boolean;
};

type HermesChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

type HermesSuggestionPayload = {
  criterionId: number;
  shortSummary: string;
  reason?: string;
};

type ResponseSuggestion = {
  criterionId: number;
  criterionPath: ResponseCriterionPathItem[];
  shortSummary: string;
  reason: string;
};

const hermesSystemPrompt = [
  "당신은 고객 반응 분류 전용 프로필입니다.",
  "오직 제공된 등록 기준 목록 안에서만 criterionId를 하나 고릅니다.",
  "대분류는 불만, 손님경험, 운영보고, 기타 중 하나입니다.",
  "예: '청주에서 방문한 손님 계셨습니다.'처럼 먼 지역 방문이 언급되면 손님경험 > 일상 > 장거리손님을 우선 검토합니다.",
  "후속 질문, 설명, 작업 제안, 인사말은 절대 하지 않습니다.",
  "응답은 JSON 객체 하나만 반환합니다: {\"criterionId\": number, \"shortSummary\": string, \"reason\": string}.",
  "shortSummary는 한국어 한 줄, 최대 60자입니다.",
  "불만, 위생, 품절, 제품/서비스 문제는 우선적으로 반영합니다."
].join("\n");

const suggestionFailureMessage = "AI 추천에 실패했습니다. 잠시 후 다시 시도하거나 직접 분류하세요.";

function buildCriterionPath(
  criteriaById: Map<number, SuggestCriterion>,
  criterion: SuggestCriterion
): ResponseCriterionPathItem[] {
  const path: ResponseCriterionPathItem[] = [];
  let current: SuggestCriterion | undefined = criterion;

  while (current) {
    path.unshift({
      id: current.id,
      parentId: current.parentId,
      depth: current.depth,
      name: current.name
    });
    current = current.parentId ? criteriaById.get(current.parentId) : undefined;
  }

  return path;
}

function stripJsonFence(content: string): string {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced?.[1]?.trim() ?? trimmed;
}

function parseHermesSuggestion(content: string): HermesSuggestionPayload {
  const parsed = JSON.parse(stripJsonFence(content)) as Partial<HermesSuggestionPayload>;
  if (!Number.isInteger(parsed.criterionId) || typeof parsed.shortSummary !== "string") {
    throw new Error("Invalid Hermes suggestion payload");
  }

  const criterionId = Number(parsed.criterionId);
  const reason = typeof parsed.reason === "string" ? parsed.reason.trim() : undefined;
  return {
    criterionId,
    shortSummary: parsed.shortSummary.trim().slice(0, 200),
    ...(reason ? { reason } : {})
  };
}

function buildHermesUserPrompt(input: SuggestResponseInput, criteria: SuggestCriterion[]): string {
  const masked = maskPii(input.fullText).maskedText;
  return JSON.stringify(
    {
      task: "customer_response_classification",
      rules: [
        "registered_criteria_only",
        "one_line_summary",
        "complaints_and_product_mentions_first",
        "json_only"
      ],
      registeredCriteria: criteria.map((criterion) => ({
        id: criterion.id,
        parentId: criterion.parentId,
        depth: criterion.depth,
        name: criterion.name
      })),
      customerResponseText: masked
    },
    null,
    2
  );
}

function findCriterionByPath(criteria: SuggestCriterion[], pathNames: string[]): SuggestCriterion | undefined {
  const criteriaById = new Map(criteria.map((criterion) => [criterion.id, criterion]));

  return criteria.find((criterion) => {
    const path = buildCriterionPath(criteriaById, criterion).map((item) => item.name);
    return path.length === pathNames.length && path.every((name, index) => name === pathNames[index]);
  });
}

function deterministicSuggestion(input: SuggestResponseInput, criteria: SuggestCriterion[]): ResponseSuggestion {
  const text = input.fullText.replace(/\s+/g, " ").trim();
  const rules: Array<{ path: string[]; keywords: string[]; summary: string }> = [
    { path: ["손님경험", "일상", "장거리손님"], keywords: ["청주", "대전", "대구", "부산", "광주", "멀리", "장거리", "타지역", "지방"], summary: "장거리 방문 손님 언급" },
    { path: ["손님경험", "일상", "칭찬"], keywords: ["칭찬", "맛있", "좋았", "친절", "감사", "만족"], summary: "손님 칭찬 반응" },
    { path: ["불만", "위생", "이물발견"], keywords: ["이물", "머리카락", "벌레", "이물질"], summary: "위생 이물 관련 불만" },
    { path: ["불만", "위생", "변질이상"], keywords: ["상했", "변질", "쉰", "냄새", "곰팡"], summary: "변질 이상 관련 불만" },
    { path: ["불만", "제품", "품절"], keywords: ["품절", "없어서", "재고 없", "매진"], summary: "제품 품절 불만" },
    { path: ["운영보고", "제품보고", "품절/재고부족"], keywords: ["재고부족", "재고 부족", "부족", "빨리 나감"], summary: "제품 재고 부족 보고" },
    { path: ["불만", "제품", "맛"], keywords: ["맛", "짜", "달", "싱겁", "시큼", "쓰다"], summary: "제품 맛 관련 반응" },
    { path: ["불만", "제품", "퀄리티"], keywords: ["딱딱", "질기", "탄", "부서", "퀄리티", "상태"], summary: "제품 퀄리티 관련 반응" },
    { path: ["불만", "서비스", "응대지연"], keywords: ["기다", "늦", "지연", "대기"], summary: "응대 지연 관련 불만" },
    { path: ["불만", "서비스", "주문오류"], keywords: ["주문오류", "주문 오류", "잘못", "다른 제품"], summary: "주문 오류 관련 불만" },
    { path: ["불만", "서비스", "포장불량"], keywords: ["포장", "봉투", "박스"], summary: "포장 관련 반응" },
    { path: ["불만", "서비스", "누락"], keywords: ["누락", "빠졌", "안 들어"], summary: "상품 누락 관련 불만" },
    { path: ["불만", "매장환경", "청결"], keywords: ["청결", "더럽", "지저분"], summary: "매장 청결 관련 반응" },
    { path: ["불만", "매장환경", "동선/대기"], keywords: ["동선", "줄", "혼잡", "대기"], summary: "동선과 대기 관련 반응" },
    { path: ["불만", "매장환경", "주차/접근"], keywords: ["주차", "접근", "찾기", "위치"], summary: "주차와 접근 관련 반응" },
    { path: ["손님경험", "제안기타", "신제품"], keywords: ["신제품", "새 제품", "새로운"], summary: "신제품 제안" },
    { path: ["손님경험", "제안기타", "온라인스토어"], keywords: ["온라인", "스토어", "배송"], summary: "온라인스토어 관련 제안" },
    { path: ["운영보고", "제품보고", "수요"], keywords: ["찾는 손님", "많이 찾", "수요", "인기"], summary: "제품 수요 보고" },
    { path: ["운영보고", "제품보고", "문의"], keywords: ["문의", "물어", "언제 나오"], summary: "제품 문의 보고" },
    { path: ["운영보고", "현상보고", "방문패턴"], keywords: ["방문", "손님 계셨", "손님이 오", "왔습니다"], summary: "방문 패턴 보고" },
    { path: ["운영보고", "현상보고", "구매패턴"], keywords: ["구매", "사가", "많이 사", "세트"], summary: "구매 패턴 보고" },
    { path: ["기타", "기타", "기타"], keywords: [], summary: "기타 손님 반응" }
  ];

  const selectedRule = rules.find((rule) => rule.keywords.some((keyword) => text.includes(keyword))) ?? rules.at(-1);
  const criterion = selectedRule ? findCriterionByPath(criteria, selectedRule.path) : undefined;
  const fallbackCriterion = criterion ?? findCriterionByPath(criteria, ["기타", "기타", "기타"]) ?? criteria.at(-1);

  if (!fallbackCriterion) {
    throw new HttpError(400, "RESPONSE_CRITERION_EMPTY", "등록된 반응 기준이 없습니다.");
  }

  const criteriaById = new Map(criteria.map((item) => [item.id, item]));
  return {
    criterionId: fallbackCriterion.id,
    criterionPath: buildCriterionPath(criteriaById, fallbackCriterion),
    shortSummary: (selectedRule?.summary ?? "손님 반응 기록").slice(0, 60),
    reason: "Hermes API가 설정되지 않아 등록 기준 기반으로 우선 분류했습니다."
  };
}

async function requestHermesSuggestion(
  app: FastifyInstance,
  input: SuggestResponseInput,
  criteria: SuggestCriterion[]
): Promise<ResponseSuggestion> {
  if (!app.config.HERMES_API_BASE_URL || !app.config.HERMES_API_KEY) {
    throw new HttpError(503, "HERMES_NOT_CONFIGURED", "Hermes API server is not configured");
  }

  const criteriaById = new Map(criteria.map((criterion) => [criterion.id, criterion]));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), app.config.HERMES_API_TIMEOUT_MS);

  try {
    const response = await fetch(`${app.config.HERMES_API_BASE_URL.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${app.config.HERMES_API_KEY}`,
        "Content-Type": "application/json",
        "X-Hermes-Session-Id": "pnp-response-classifier",
        "X-Hermes-Session-Key": "pnp:response-classifier"
      },
      body: JSON.stringify({
        model: app.config.HERMES_API_MODEL,
        stream: false,
        temperature: 0,
        messages: [
          { role: "system", content: hermesSystemPrompt },
          { role: "user", content: buildHermesUserPrompt(input, criteria) }
        ]
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Hermes API failed with ${response.status}`);
    }

    const completion = (await response.json()) as HermesChatCompletionResponse;
    const content = completion.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("Hermes API returned no content");
    }

    const suggestion = parseHermesSuggestion(content);
    const criterion = criteriaById.get(suggestion.criterionId);
    if (!criterion) {
      throw new Error("Hermes suggested an unregistered criterion");
    }

    return {
      criterionId: criterion.id,
      criterionPath: buildCriterionPath(criteriaById, criterion),
      shortSummary: suggestion.shortSummary,
      reason: suggestion.reason || "Hermes 전용 고객 반응 분류 프로필이 추천했습니다."
    };
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }
    throw new HttpError(502, "HERMES_SUGGESTION_FAILED", suggestionFailureMessage);
  } finally {
    clearTimeout(timeout);
  }
}

function pathFromCriterion(criterion: CriterionWithParents): CriterionPathIds {
  if (!criterion.isActive) {
    throw new HttpError(400, "RESPONSE_CRITERION_INACTIVE", "Response criterion is inactive");
  }

  if (criterion.depth === 1) {
    return {
      criterionId: criterion.id,
      majorCriterionId: criterion.id,
      middleCriterionId: null,
      minorCriterionId: null
    };
  }

  if (criterion.depth === 2) {
    if (!criterion.parent) {
      throw new HttpError(400, "RESPONSE_CRITERION_INVALID", "Middle criterion has no parent");
    }
    return {
      criterionId: criterion.id,
      majorCriterionId: criterion.parent.id,
      middleCriterionId: criterion.id,
      minorCriterionId: null
    };
  }

  if (!criterion.parent?.parent) {
    throw new HttpError(400, "RESPONSE_CRITERION_INVALID", "Minor criterion has no full path");
  }

  return {
    criterionId: criterion.id,
    majorCriterionId: criterion.parent.parent.id,
    middleCriterionId: criterion.parent.id,
    minorCriterionId: criterion.id
  };
}

async function resolveCriterionPath(
  app: FastifyInstance,
  criterionId: number
): Promise<CriterionPathIds> {
  const criterion = await app.prisma.responseCriterion.findUnique({
    where: { id: criterionId },
    include: {
      parent: {
        include: {
          parent: true
        }
      }
    }
  });

  if (!criterion) {
    throw new HttpError(404, "RESPONSE_CRITERION_NOT_FOUND", "Response criterion not found");
  }

  return pathFromCriterion(criterion);
}

function buildCreateResponseData(
  input: CreateResponseInput,
  path: CriterionPathIds
): Prisma.CustomerResponseUncheckedCreateInput {
  return {
    date: parseDateOnly(input.date),
    criterionId: path.criterionId,
    majorCriterionId: path.majorCriterionId,
    middleCriterionId: path.middleCriterionId,
    minorCriterionId: path.minorCriterionId,
    shortSummary: input.shortSummary,
    fullText: input.fullText ?? null,
    llmAssisted: input.llmAssisted ?? false
  };
}

function buildUpdateResponseData(
  input: UpdateResponseInput,
  path: CriterionPathIds | null
): Prisma.CustomerResponseUncheckedUpdateInput {
  return {
    ...(input.date ? { date: parseDateOnly(input.date) } : {}),
    ...(path
      ? {
          criterionId: path.criterionId,
          majorCriterionId: path.majorCriterionId,
          middleCriterionId: path.middleCriterionId,
          minorCriterionId: path.minorCriterionId
        }
      : {}),
    ...(input.shortSummary !== undefined ? { shortSummary: input.shortSummary } : {}),
    ...(input.fullText !== undefined ? { fullText: input.fullText ?? null } : {}),
    ...(input.llmAssisted !== undefined ? { llmAssisted: input.llmAssisted } : {})
  };
}

async function findResponseById(app: FastifyInstance, id: bigint) {
  return app.prisma.customerResponse.findUnique({
    where: { id },
    include: {
      criterion: true,
      majorCriterion: true,
      middleCriterion: true,
      minorCriterion: true
    }
  });
}

async function buildCriterionFilter(
  app: FastifyInstance,
  criterionId?: number
): Promise<Prisma.CustomerResponseWhereInput> {
  if (!criterionId) {
    return {};
  }

  const criterion = await app.prisma.responseCriterion.findUnique({ where: { id: criterionId } });
  if (!criterion) {
    throw new HttpError(404, "RESPONSE_CRITERION_NOT_FOUND", "Response criterion not found");
  }

  if (criterion.depth === 1) {
    return { majorCriterionId: criterion.id };
  }
  if (criterion.depth === 2) {
    return { middleCriterionId: criterion.id };
  }
  return { minorCriterionId: criterion.id };
}

export async function registerResponseRoutes(app: FastifyInstance): Promise<void> {
  app.get("/", async (request, reply) => {
    const query = listResponseQuerySchema.parse(request.query);
    const where = {
      ...buildDateWhere(query),
      ...activeResponseCriterionWhere,
      ...(await buildCriterionFilter(app, query.criterion_id))
    };

    const [items, total] = await app.prisma.$transaction([
      app.prisma.customerResponse.findMany({
        where,
        include: {
          criterion: true,
          majorCriterion: true,
          middleCriterion: true,
          minorCriterion: true
        },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: 100
      }),
      app.prisma.customerResponse.count({ where })
    ]);

    return sendOk(reply, {
      items: items.map(toResponseDto),
      total,
      page: 1,
      size: items.length
    });
  });

  app.get("/stats", async (request, reply) => {
    const query = statsResponseQuerySchema.parse(request.query);
    const where = { ...buildDateWhere(query), ...activeResponseCriterionWhere };

    const [total, majorGroups, middleGroups, minorGroups, criteria, responses] = await app.prisma.$transaction(
      [
        app.prisma.customerResponse.count({ where }),
        app.prisma.customerResponse.groupBy({
          by: ["majorCriterionId"],
          where,
          orderBy: { majorCriterionId: "asc" },
          _count: { _all: true }
        }),
        app.prisma.customerResponse.groupBy({
          by: ["majorCriterionId", "middleCriterionId"],
          where: { ...where, middleCriterionId: { not: null } },
          orderBy: [{ majorCriterionId: "asc" }, { middleCriterionId: "asc" }],
          _count: { _all: true }
        }),
        app.prisma.customerResponse.groupBy({
          by: ["majorCriterionId", "middleCriterionId", "minorCriterionId"],
          where: { ...where, minorCriterionId: { not: null } },
          orderBy: [
            { majorCriterionId: "asc" },
            { middleCriterionId: "asc" },
            { minorCriterionId: "asc" }
          ],
          _count: { _all: true }
        }),
        app.prisma.responseCriterion.findMany({
          orderBy: [{ depth: "asc" }, { parentId: "asc" }, { sortOrder: "asc" }, { name: "asc" }]
        }),
        app.prisma.customerResponse.findMany({
          where,
          include: {
            criterion: true,
            majorCriterion: true,
            middleCriterion: true,
            minorCriterion: true
          },
          orderBy: [{ date: "desc" }, { createdAt: "desc" }],
          take: 300
        })
      ]
    );

    const criteriaById = new Map(
      criteria.map((criterion) => [
        criterion.id,
        {
          id: criterion.id,
          parentId: criterion.parentId,
          depth: criterion.depth,
          name: criterion.name
        }
      ])
    );

    return sendOk(reply, {
      from: query.from,
      to: query.to,
      total,
      major: (majorGroups as MajorGroup[]).map((group) =>
        toCriterionStat(criteriaById.get(group.majorCriterionId), group._count._all, total)
      ),
      middle: (middleGroups as MiddleGroup[]).map((group) => ({
        ...toCriterionStat(
          criteriaById.get(group.middleCriterionId ?? 0),
          group._count._all,
          total
        ),
        majorCriterionId: group.majorCriterionId
      })),
      minor: (minorGroups as MinorGroup[]).map((group) => ({
        ...toCriterionStat(criteriaById.get(group.minorCriterionId ?? 0), group._count._all, total),
        majorCriterionId: group.majorCriterionId,
        middleCriterionId: group.middleCriterionId
      })),
      insights: buildResponseInsights(
        total,
        majorGroups as MajorGroup[],
        minorGroups as MinorGroup[],
        criteriaById,
        responses as ResponseWithRelations[]
      )
    });
  });

  app.post("/suggest", async (request, reply) => {
    const input = suggestResponseSchema.parse(request.body);
    const criteria = await app.prisma.responseCriterion.findMany({
      where: { isActive: true },
      orderBy: [{ depth: "asc" }, { parentId: "asc" }, { sortOrder: "asc" }, { name: "asc" }]
    });

    try {
      return sendOk(reply, await requestHermesSuggestion(app, input, criteria));
    } catch (error) {
      if (error instanceof HttpError && error.code === "HERMES_NOT_CONFIGURED") {
        return sendOk(reply, deterministicSuggestion(input, criteria));
      }
      throw error;
    }
  });

  app.post("/", async (request, reply) => {
    const input = createResponseSchema.parse(request.body);
    const path = await resolveCriterionPath(app, input.criterionId);
    const response = await app.prisma.customerResponse.create({
      data: buildCreateResponseData(input, path)
    });

    const stored = await findResponseById(app, response.id);
    if (!stored) {
      throw new HttpError(500, "RESPONSE_CREATE_FAILED", "Response was not persisted");
    }

    return sendOk(reply, toResponseDto(stored), 201);
  });

  app.patch("/:id", async (request, reply) => {
    const params = idParamsSchema.parse(request.params);
    const input = updateResponseSchema.parse(request.body);
    const existing = await findResponseById(app, params.id);

    if (!existing) {
      throw new HttpError(404, "RESPONSE_NOT_FOUND", "Response not found");
    }

    const path =
      input.criterionId !== undefined ? await resolveCriterionPath(app, input.criterionId) : null;

    await app.prisma.customerResponse.update({
      where: { id: params.id },
      data: buildUpdateResponseData(input, path)
    });

    const updated = await findResponseById(app, params.id);
    if (!updated) {
      throw new HttpError(404, "RESPONSE_NOT_FOUND", "Response not found");
    }

    return sendOk(reply, toResponseDto(updated));
  });

  app.delete("/:id", async (request, reply) => {
    const params = idParamsSchema.parse(request.params);
    const existing = await findResponseById(app, params.id);

    if (!existing) {
      throw new HttpError(404, "RESPONSE_NOT_FOUND", "Response not found");
    }

    await app.prisma.customerResponse.delete({ where: { id: params.id } });
    return sendOk(reply, { deleted: true });
  });
}
