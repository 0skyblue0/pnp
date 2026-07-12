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

type DailyGroup = CriterionGroup & {
  date: Date;
};

type ResponseInsightTopic = {
  criterionId: number;
  label: string;
  path: ResponseCriterionPathItem[];
  count: number;
  ratio: number;
  sampleSummaries: string[];
};

type ExecutiveBucketKey = "brandStrength" | "productNeeds" | "operationImprovements";

type ExecutiveBucket = {
  key: ExecutiveBucketKey;
  title: string;
  count: number;
  ratio: number;
  summary: string;
  topics: ResponseInsightTopic[];
};

type CriterionPathIds = {
  criterionId: number;
  majorCriterionId: number;
  middleCriterionId: number | null;
  minorCriterionId: number | null;
};

const checkNeededCriterionNames = new Set([
  "불친절",
  "응대 불만",
  "설명 부족",
  "결제 문제",
  "대기시간 김",
  "줄 혼잡",
  "가격 부담",
  "청결",
  "덜 구워짐",
  "너무 탐",
  "신선도",
  "맛 변화",
  "딱딱함",
  "질김",
  "눅눅함",
  "포장 불편",
  "분류 보류"
]);

const checkNeededWords = ["컴플레인", "환불", "불만", "문제", "보상", "위생", "이물", "변질"];

const executiveBucketConfigs: Array<{
  key: ExecutiveBucketKey;
  title: string;
  summary: string;
}> = [
  {
    key: "brandStrength",
    title: "긍정·방문 신호",
    summary: "칭찬, 재방문, 일부러 찾아온 이유처럼 긍정으로 확인된 반응입니다."
  },
  {
    key: "productNeeds",
    title: "제품·메뉴 신호",
    summary: "제품 문의, 품절, 구매 수요처럼 메뉴와 상품에서 반복된 반응입니다."
  },
  {
    key: "operationImprovements",
    title: "불편·개선 신호",
    summary: "맛·품질 혹평, 포장, 대기, 응대처럼 불편으로 확인된 반응입니다."
  }
];

const brandStrengthWords = [
  "장거리",
  "일부러",
  "추천",
  "입소문",
  "인스타",
  "재방문",
  "단골",
  "선물",
  "칭찬",
  "친절",
  "맛있",
  "좋아"
];

const negativeSignalCriterionNames = new Set([
  "덜 구워짐",
  "너무 탐",
  "딱딱함",
  "질김",
  "눅눅함",
  "짠맛",
  "포장 불편",
  "불친절",
  "응대 불만",
  "설명 부족",
  "결제 문제",
  "대기시간 김",
  "줄 혼잡",
  "가격 부담",
  "동선 불편",
  "분류 보류"
]);

const negativeSignalWords = [
  "혹평",
  "불만",
  "실망",
  "아쉬워",
  "불편",
  "문제",
  "부족",
  "짜다",
  "짰",
  "짜다는",
  "짠",
  "딱딱",
  "질김",
  "눅눅",
  "덜 구워",
  "탔",
  "비싸"
];

const productNeedWords = [
  "요청",
  "문의",
  "제안",
  "있으면",
  "없나요",
  "원해",
  "찾",
  "품절",
  "쌀빵",
  "건강빵",
  "호밀",
  "예약"
];

const operationImprovementWords = [
  "대기",
  "줄",
  "응대",
  "불친절",
  "설명",
  "청결",
  "위생",
  "포장",
  "가격",
  "딱딱",
  "질김",
  "눅눅",
  "덜 구워",
  "탐"
];

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

function responsePathFromIds(
  response: ResponseWithRelations,
  criteriaById: Map<number, ResponseCriterionPathItem>
): ResponseCriterionPathItem[] {
  return [response.majorCriterionId, response.middleCriterionId, response.minorCriterionId]
    .filter((criterionId): criterionId is number => typeof criterionId === "number")
    .map((criterionId) => criteriaById.get(criterionId))
    .filter((criterion): criterion is ResponseCriterionPathItem => criterion !== undefined);
}

function responseCriterionId(response: ResponseWithRelations): number {
  return response.minorCriterionId ?? response.middleCriterionId ?? response.majorCriterionId;
}

const sourceLinePattern = /^\s*(?:\[[^\]]+\]|출처:|source:)/i;
const operationalReportWords = [
  "매출",
  "판매물량",
  "판매완료",
  "판매되었습니다",
  "조기품절",
  "솔드아웃",
  "마감 되었습니다",
  "마감되었습니다",
  "꾸준히 방문",
  "손님 방문 많",
  "방문 많았습니다",
  "손님 꾸준"
];
const customerVoiceWords = [
  "손님",
  "문의",
  "요청",
  "원하",
  "찾",
  "방문",
  "왔",
  "싶었",
  "말씀",
  "평",
  "칭찬",
  "반응",
  "아쉬워",
  "희망",
  "구매의사"
];

function cleanResponseText(value: string | null | undefined): string {
  return (value ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !sourceLinePattern.test(line))
    .join("\n")
    .trim();
}

function isLikelyCustomerVoice(value: string): boolean {
  const compact = value.replace(/\s+/g, " ").trim();
  if (!compact) {
    return false;
  }

  if (operationalReportWords.some((word) => compact.includes(word))) {
    return customerVoiceWords.some((word) => compact.includes(word)) &&
      ["문의", "요청", "원하", "말씀", "평", "칭찬", "아쉬워", "희망", "구매의사"].some((word) =>
        compact.includes(word)
      );
  }

  return customerVoiceWords.some((word) => compact.includes(word));
}

function responseSample(response: ResponseWithRelations): string | null {
  const cleanedFullText = cleanResponseText(response.fullText);
  const cleanedSummary = cleanResponseText(response.shortSummary);
  const value = cleanedFullText || cleanedSummary;

  if (!isLikelyCustomerVoice(value)) {
    return null;
  }

  return value.slice(0, 120);
}

function hasAnyWord(value: string, words: string[]): boolean {
  return words.some((word) => value.includes(word));
}

function responseNeedsCheck(
  response: ResponseWithRelations,
  path: ResponseCriterionPathItem[]
): boolean {
  const pathNames = path.map((criterion) => criterion.name);
  const combinedText = `${response.shortSummary ?? ""}\n${response.fullText ?? ""}`;

  return (
    pathNames.some((name) => checkNeededCriterionNames.has(name)) ||
    checkNeededWords.some((word) => combinedText.includes(word))
  );
}

function classifyExecutiveBuckets(
  response: ResponseWithRelations,
  path: ResponseCriterionPathItem[]
): ExecutiveBucketKey[] {
  const pathNames = path.map((criterion) => criterion.name);
  const combinedText = `${pathNames.join(" ")}\n${response.shortSummary ?? ""}\n${response.fullText ?? ""}`;
  const buckets = new Set<ExecutiveBucketKey>();

  if (pathNames.includes("직원 메모")) {
    return [];
  }

  const hasNegativeSignal =
    pathNames.some((name) => negativeSignalCriterionNames.has(name)) ||
    hasAnyWord(combinedText, negativeSignalWords);

  const hasPositiveSignal =
    pathNames.includes("방문 이유") ||
    pathNames.includes("장거리 방문") ||
    pathNames.includes("단골") ||
    pathNames.includes("긍정 반응") ||
    pathNames.includes("선물·특별 목적") ||
    pathNames.includes("일부러 방문") ||
    pathNames.includes("SNS 보고 방문") ||
    pathNames.includes("지인 추천") ||
    pathNames.includes("장거리손님") ||
    pathNames.includes("재방문 의사") ||
    pathNames.includes("맛있음") ||
    pathNames.includes("만족") ||
    pathNames.includes("직원 칭찬") ||
    pathNames.includes("선물용") ||
    hasAnyWord(combinedText, brandStrengthWords);

  if (hasPositiveSignal && !hasNegativeSignal) {
    buckets.add("brandStrength");
  }

  if (
    pathNames.includes("제품") ||
    pathNames.includes("제품 제안") ||
    pathNames.includes("품절") ||
    hasAnyWord(combinedText, productNeedWords)
  ) {
    buckets.add("productNeeds");
  }

  if (
    responseNeedsCheck(response, path) ||
    hasNegativeSignal ||
    hasAnyWord(combinedText, operationImprovementWords)
  ) {
    buckets.add("operationImprovements");
  }

  return Array.from(buckets);
}

function buildExecutiveBuckets(
  total: number,
  criteriaById: Map<number, ResponseCriterionPathItem>,
  responses: ResponseWithRelations[]
): ExecutiveBucket[] {
  const bucketResponses = new Map<ExecutiveBucketKey, Set<ResponseWithRelations>>();
  const bucketTopicMaps = new Map<ExecutiveBucketKey, Map<number, ResponseInsightTopic>>();

  for (const config of executiveBucketConfigs) {
    bucketResponses.set(config.key, new Set());
    bucketTopicMaps.set(config.key, new Map());
  }

  for (const response of responses) {
    const path = responsePathFromIds(response, criteriaById);
    const buckets = classifyExecutiveBuckets(response, path);
    const criterionId = responseCriterionId(response);
    const criterion = criteriaById.get(criterionId);
    const topicPath = criterion ? buildPathFromCriteria(criteriaById, criterion) : path;
    const sample = responseSample(response);

    for (const bucket of buckets) {
      bucketResponses.get(bucket)?.add(response);
      const topicMap = bucketTopicMaps.get(bucket);
      const existingTopic = topicMap?.get(criterionId);

      if (topicMap && existingTopic) {
        existingTopic.count += 1;
        existingTopic.ratio = ratio(existingTopic.count, total);
        if (sample && !existingTopic.sampleSummaries.includes(sample)) {
          existingTopic.sampleSummaries = [...existingTopic.sampleSummaries, sample].slice(0, 3);
        }
      } else if (topicMap) {
        topicMap.set(criterionId, {
          criterionId,
          label: criterionLabel(criterion),
          path: topicPath,
          count: 1,
          ratio: ratio(1, total),
          sampleSummaries: sample ? [sample] : []
        });
      }
    }
  }

  return executiveBucketConfigs.map((config) => {
    const count = bucketResponses.get(config.key)?.size ?? 0;
    const topics = Array.from(bucketTopicMaps.get(config.key)?.values() ?? [])
      .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
      .slice(0, 3);

    return {
      key: config.key,
      title: config.title,
      count,
      ratio: ratio(count, total),
      summary: config.summary,
      topics
    };
  });
}

function hasFinalConsonant(value: string): boolean {
  const lastChar = value.trim().at(-1);
  if (!lastChar) {
    return false;
  }

  const code = lastChar.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) {
    return false;
  }

  return (code - 0xac00) % 28 > 0;
}

function joinExecutiveTitles(buckets: ExecutiveBucket[]): string {
  if (buckets.length <= 1) {
    return buckets[0]?.title ?? "손님 반응";
  }

  const first = buckets[0];
  const second = buckets[1];
  if (!first || !second) {
    return first?.title ?? "손님 반응";
  }

  const particle = hasFinalConsonant(first.title) ? "과" : "와";
  return `${first.title}${particle} ${second.title}`;
}

function executiveHeadline(total: number, buckets: ExecutiveBucket[], fallback: string): string {
  if (total <= 0) {
    return "조회 기간에 등록된 손님 반응이 없습니다.";
  }

  const topBuckets = buckets
    .filter((bucket) => bucket.count > 0)
    .sort((left, right) => right.count - left.count || left.title.localeCompare(right.title))
    .slice(0, 2);

  if (topBuckets.length === 0) {
    return fallback;
  }

  return `이번 기간에 가장 뚜렷한 축은 ${joinExecutiveTitles(topBuckets)}입니다.`;
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
    const criterionId = responseCriterionId(response);
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

  const topMajorGroup = [...majorGroups].sort(
    (left, right) => right._count._all - left._count._all
  )[0];
  const topMajorName = topMajorGroup
    ? criterionLabel(criteriaById.get(topMajorGroup.majorCriterionId))
    : "기록 없음";
  const topTopic = repeatedTopics[0];
  const executiveBuckets = buildExecutiveBuckets(total, criteriaById, responses);
  const fallbackHeadline =
    total > 0
      ? `${total.toLocaleString("ko-KR")}건 중 ${topMajorName} 비중이 가장 큽니다.`
      : "조회 기간에 등록된 손님 반응이 없습니다.";
  const checkNeededCount = responses.filter((response) =>
    responseNeedsCheck(response, responsePathFromIds(response, criteriaById))
  ).length;

  return {
    headline: executiveHeadline(total, executiveBuckets, fallbackHeadline),
    checkNeededCount,
    executiveBuckets,
    repeatedTopics,
    keyNotes: [
      ...(checkNeededCount > 0
        ? [`확인 필요 반응 ${checkNeededCount.toLocaleString("ko-KR")}건`]
        : []),
      ...(topTopic
        ? [`최다 반복: ${topTopic.path.map((item) => item.name).join(" > ")}`]
        : [])
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
  "대분류는 제품, 서비스·응대, 구매·운영, 손님경험, 기타 중 하나입니다.",
  "불만/칭찬 감정보다 실제 원인을 먼저 고릅니다: 제품 맛·식감·제안은 제품, 응대는 서비스·응대, 품절·수요·객단가·배달·예약은 구매·운영, 유동인구·시간대·가족단위·날씨·장거리·주차는 손님경험입니다.",
  "기타는 최후의 선택지입니다. 제품/서비스·응대/구매·운영/손님경험 중 하나로 해석 가능한 단서가 조금이라도 있으면 기타를 고르지 않습니다.",
  "기타는 등록 기준 어디에도 맞지 않는 잡담, 판독 불가, 업무와 무관한 내용에만 사용합니다.",
  "예: '청주에서 방문한 손님 계셨습니다.'처럼 먼 지역 방문이 언급되면 손님경험 > 장거리 방문 > 장거리손님을 우선 검토합니다.",
  "예: '비가 와서 배달 주문이 거의 없었습니다.'는 단맛이 아니라 구매·운영 > 배달·플랫폼 > 배달 주문 적음입니다.",
  "예: '유동인구가 낮았습니다.'는 기타가 아니라 손님경험 > 방문 시간대 > 유동인구 낮음입니다.",
  "예: '11-12시 시간대 매출 77만원'처럼 시간대 매출/방문 흐름만 말하면 특정 제품 수요가 아니라 손님경험 > 방문 시간대의 점심 몰림/오전 저조/오후 몰림 중 가장 가까운 기준입니다.",
  "예: '쌀빵이 있길 희망했습니다.'는 기타가 아니라 제품 > 제품 제안 > 쌀빵/건강빵 요청입니다.",
  "후속 질문, 설명, 작업 제안, 인사말은 절대 하지 않습니다.",
  '응답은 JSON 객체 하나만 반환합니다: {"criterionId": number, "shortSummary": string, "reason": string}.',
  "shortSummary는 한국어 한 줄, 최대 60자입니다.",
  "위생, 품절, 제품 품질, 서비스 문제는 우선적으로 구체적인 세부 기준까지 반영합니다."
].join("\n");

const suggestionNotConfiguredMessage =
  "AI 분류 API가 설정되지 않았습니다. 관리자에게 연결 상태를 확인해 주세요.";
const suggestionFailureMessage =
  "AI 분류 API 실행에 실패했습니다. 관리자에게 연결 상태를 확인해 주세요.";

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
        "choose_operational_root_cause_first",
        "product_service_purchase_experience_major_categories",
        "json_only"
      ],
      registeredCriteria: criteria.map((criterion) => ({
        id: criterion.id,
        parentId: criterion.parentId,
        depth: criterion.depth,
        name: criterion.name,
        useOnlyIfNoOperationalMatch: criterion.name === "기타"
      })),
      customerResponseText: masked
    },
    null,
    2
  );
}

async function requestHermesSuggestion(
  app: FastifyInstance,
  input: SuggestResponseInput,
  criteria: SuggestCriterion[]
): Promise<ResponseSuggestion> {
  if (!app.config.HERMES_API_BASE_URL || !app.config.HERMES_API_KEY) {
    throw new HttpError(503, "HERMES_NOT_CONFIGURED", suggestionNotConfiguredMessage);
  }

  const criteriaById = new Map(criteria.map((criterion) => [criterion.id, criterion]));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), app.config.HERMES_API_TIMEOUT_MS);
  const sessionNonce = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  try {
    const response = await fetch(
      `${app.config.HERMES_API_BASE_URL.replace(/\/$/, "")}/chat/completions`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${app.config.HERMES_API_KEY}`,
          "Content-Type": "application/json",
          "X-Hermes-Session-Id": `pnp-response-classifier-${sessionNonce}`,
          "X-Hermes-Session-Key": `pnp:response-classifier:${sessionNonce}`
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
      }
    );

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
        take: query.size ?? 100
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

    const [total, majorGroups, middleGroups, minorGroups, dailyGroups, criteria, responses] =
      await app.prisma.$transaction([
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
        app.prisma.customerResponse.groupBy({
          by: ["date"],
          where,
          orderBy: { date: "asc" },
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
      ]);

    const responseCriteria = criteria as ResponseCriterionPathItem[];
    const criteriaById = new Map(
      responseCriteria.map((criterion) => [
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
      daily: (dailyGroups as DailyGroup[]).map((group) => ({
        date: formatDateOnly(group.date),
        count: group._count._all
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

    return sendOk(reply, await requestHermesSuggestion(app, input, criteria));
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
