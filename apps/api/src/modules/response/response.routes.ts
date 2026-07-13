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
  items: Array<{
    id: string;
    date: string;
    summary: string;
    text: string;
  }>;
};

type ExecutiveBucketKey =
  | "salesStrength"
  | "missedSales"
  | "productImprovements"
  | "visitFlow"
  | "serviceRisk";

type DirectCustomerQuote = {
  id: string;
  date: string;
  text: string;
  summary: string;
  criterionId: number;
  path: ResponseCriterionPathItem[];
};

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
  "가격 부담",
  "청결",
  "덜 구워짐",
  "너무 탐",
  "신선도",
  "맛 변화",
  "딱딱함",
  "질김",
  "눅눅함",
  "분류 보류"
]);

const checkNeededWords = [
  "컴플레인",
  "환불",
  "불만",
  "불편",
  "문제",
  "보상",
  "위생",
  "이물",
  "변질",
  "너무 길"
];

const executiveBucketConfigs: Array<{
  key: ExecutiveBucketKey;
  title: string;
  summary: string;
}> = [
  {
    key: "salesStrength",
    title: "매출 기회",
    summary: "시식 후 구매, 재구매, 대량 구매처럼 더 팔 수 있는 기회입니다."
  },
  {
    key: "missedSales",
    title: "놓친 매출",
    summary: "품절, 재고 부족, 찾는 제품 부재처럼 팔 수 있었지만 놓친 수요입니다."
  },
  {
    key: "productImprovements",
    title: "제품 점검",
    summary: "맛, 식감, 품질, 보관, 컷팅처럼 제품 기준을 확인할 단서입니다."
  },
  {
    key: "visitFlow",
    title: "방문 흐름",
    summary: "언제·어떤 손님이 왜 방문하는지 보여주는 흐름입니다."
  },
  {
    key: "serviceRisk",
    title: "즉시 확인",
    summary: "컴플레인, 환불, 위생, 응대 불만처럼 오늘 바로 확인할 항목입니다."
  }
];

const negativeSignalCriterionNames = new Set([
  "덜 구워짐",
  "너무 탐",
  "딱딱함",
  "질김",
  "눅눅함",
  "짠맛",
  "포장 불편",
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
  "불편",
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

function trimQuoteText(value: string): string {
  return value
    .trim()
    .replace(/^["'“”‘’「」『』]+|["'“”‘’「」『』]+$/g, "")
    .trim();
}

function isOperationalObservation(value: string): boolean {
  return (
    operationalReportWords.some((word) => value.includes(word)) ||
    [
      "문의가",
      "요청이",
      "평을",
      "반응이",
      "계셨",
      "있었습니다",
      "많았습니다",
      "하셨습니다",
      "남겨주셨"
    ].some((word) => value.includes(word))
  );
}

function indirectCustomerQuote(value: string): string | null {
  const compact = trimQuoteText(value.replace(/\s+/g, " "));
  if (
    !compact ||
    operationalReportWords.some((word) => compact.includes(word)) ||
    /(?:예약|판매|품절|마감).{0,20}구매문의|구매문의\s*(?:많|있)/.test(compact)
  ) {
    return null;
  }

  const normalized = compact.replace(/^단골손님인\s*[^\s]+님이\s*/, "").trim();
  const patterns = [
    /^(.{2,120}?(?:문의|요청))(?:가|이|\s|$)/,
    /^(.{2,120}?)(?:으로|로)\s*바꿨으면 하는 손님 의견/,
    /^(.{2,120}?)(?:을|를)?\s*(?:원하는|원하시는|희망한|희망하시는)\s*손님/,
    /^(.{2,120}?(?:달라는|달라고 하는|넣어달라는))\s*요청/,
    /^(.{2,120}?(?:라고|다고|냐고))\s*(?:물어보|문의|말씀|하셨|했습니다|했|평|칭찬|남겨|요청)/
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    const quote = match?.[1] ? trimQuoteText(match[1]) : null;
    if (quote && quote.length >= 3 && quote !== "구매문의") {
      return quote.slice(0, 120);
    }
  }

  return null;
}

function directCustomerQuote(response: ResponseWithRelations): string | null {
  const cleanedText = cleanResponseText(response.fullText) || cleanResponseText(response.shortSummary);
  const lines = cleanedText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  for (const line of lines) {
    const speakerMatch = line.match(/^(?:손님|고객|손님 말|고객 말)\s*[:：]\s*(.+)$/);
    if (speakerMatch?.[1]) {
      return trimQuoteText(speakerMatch[1]).slice(0, 120);
    }

    const explicitQuoteMatch = line.match(/["“'‘「『]([^"”'’」』]{2,120})["”'’」』]/);
    if (explicitQuoteMatch?.[1]) {
      return trimQuoteText(explicitQuoteMatch[1]).slice(0, 120);
    }

    const compact = trimQuoteText(line.replace(/\s+/g, " "));
    const indirectQuote = indirectCustomerQuote(compact);
    if (indirectQuote) {
      return indirectQuote;
    }

    if (isOperationalObservation(compact)) {
      continue;
    }

    if (
      compact.length >= 4 &&
      compact.length <= 120 &&
      (compact.endsWith("?") ||
        /(?:요|어요|아요|예요|이에요|네요|싶었어요|좋겠어요|불편했어요)[.!?]?$/.test(compact))
    ) {
      return compact;
    }
  }

  return null;
}

function isLikelyCustomerVoice(value: string): boolean {
  const compact = value.replace(/\s+/g, " ").trim();
  if (!compact) {
    return false;
  }

  if (operationalReportWords.some((word) => compact.includes(word))) {
    return (
      customerVoiceWords.some((word) => compact.includes(word)) &&
      ["문의", "요청", "원하", "말씀", "평", "칭찬", "아쉬워", "희망", "구매의사"].some((word) =>
        compact.includes(word)
      )
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

function responseTopicItem(response: ResponseWithRelations) {
  const text = cleanResponseText(response.fullText) || cleanResponseText(response.shortSummary);
  return {
    id: response.id?.toString() ?? "",
    date: response.date ? formatDateOnly(response.date) : "",
    summary: cleanResponseText(response.shortSummary) || "요약 없음",
    text: text.slice(0, 160)
  };
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

function criteriaMap(
  criteria: ResponseCriterionPathItem[]
): Map<number, ResponseCriterionPathItem> {
  return new Map(
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

  const hasMissedSalesSignal =
    pathNames.includes("품절") ||
    pathNames.includes("원하는 제품 품절") ||
    pathNames.includes("재입고 문의") ||
    combinedText.includes("품절") ||
    combinedText.includes("재고가 없") ||
    combinedText.includes("빵이 없") ||
    combinedText.includes("구매하지 못");

  const needsImmediateCheck = responseNeedsCheck(response, path);

  const hasProductImprovementSignal =
    pathNames.some((name) => negativeSignalCriterionNames.has(name)) ||
    pathNames.includes("제품") ||
    pathNames.includes("품질") ||
    pathNames.includes("식감") ||
    pathNames.includes("맛") ||
    pathNames.includes("포장") ||
    pathNames.includes("제품 문의") ||
    pathNames.includes("제품 제안") ||
    combinedText.includes("컷팅") ||
    combinedText.includes("보관") ||
    combinedText.includes("알러지") ||
    combinedText.includes("알레르") ||
    (pathNames.includes("제품") &&
      (hasAnyWord(combinedText, negativeSignalWords) || hasAnyWord(combinedText, productNeedWords)));

  const hasVisitFlowSignal =
    pathNames.includes("손님경험") ||
    pathNames.includes("방문 이유") ||
    pathNames.includes("장거리 방문") ||
    pathNames.includes("단골") ||
    pathNames.includes("선물·특별 목적") ||
    pathNames.includes("방문 시간대") ||
    pathNames.includes("방문객 특성") ||
    pathNames.includes("날씨 영향") ||
    pathNames.includes("주차·접근") ||
    pathNames.includes("장거리손님") ||
    pathNames.includes("유동인구 낮음") ||
    combinedText.includes("방문") ||
    combinedText.includes("유동인구") ||
    combinedText.includes("손님 꾸준") ||
    combinedText.includes("시간대");

  const hasPositiveSignal =
    pathNames.includes("맛있음") ||
    pathNames.includes("만족") ||
    pathNames.includes("직원 칭찬") ||
    pathNames.includes("구매·수요") ||
    pathNames.includes("특정 제품 수요 높음") ||
    pathNames.includes("샌드위치 수요") ||
    pathNames.includes("큰 빵 수요") ||
    pathNames.includes("대량 구매") ||
    pathNames.includes("객단가 높음") ||
    combinedText.includes("구매로 이어") ||
    combinedText.includes("판매완료") ||
    combinedText.includes("재구매") ||
    combinedText.includes("대량") ||
    combinedText.includes("잘 팔") ||
    combinedText.includes("수요") ||
    combinedText.includes("맛있") ||
    combinedText.includes("칭찬");

  if (hasPositiveSignal && !hasMissedSalesSignal && !needsImmediateCheck) {
    buckets.add("salesStrength");
  }

  if (hasMissedSalesSignal) {
    buckets.add("missedSales");
  }

  if (hasProductImprovementSignal && !hasMissedSalesSignal) {
    buckets.add("productImprovements");
  }

  if (hasVisitFlowSignal) {
    buckets.add("visitFlow");
  }

  if (needsImmediateCheck) {
    buckets.add("serviceRisk");
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
    const item = responseTopicItem(response);

    for (const bucket of buckets) {
      bucketResponses.get(bucket)?.add(response);
      const topicMap = bucketTopicMaps.get(bucket);
      const existingTopic = topicMap?.get(criterionId);

      if (topicMap && existingTopic) {
        existingTopic.count += 1;
        existingTopic.ratio = ratio(existingTopic.count, total);
        if (sample && !existingTopic.sampleSummaries.includes(sample)) {
          existingTopic.sampleSummaries = [...existingTopic.sampleSummaries, sample];
        }
        if (!existingTopic.items.some((existingItem) => existingItem.id === item.id)) {
          existingTopic.items = [...existingTopic.items, item];
        }
      } else if (topicMap) {
        topicMap.set(criterionId, {
          criterionId,
          label: criterionLabel(criterion),
          path: topicPath,
          count: 1,
          ratio: ratio(1, total),
          sampleSummaries: sample ? [sample] : [],
          items: [item]
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

  const joinedTitle = joinExecutiveTitles(topBuckets);
  const objectParticle = hasFinalConsonant(joinedTitle) ? "을" : "를";
  return `이번 기간은 ${joinedTitle}${objectParticle} 먼저 봐야 합니다.`;
}

function buildResponseInsights(
  total: number,
  majorGroups: MajorGroup[],
  minorGroups: MinorGroup[],
  criteriaById: Map<number, ResponseCriterionPathItem>,
  responses: ResponseWithRelations[]
) {
  const summariesByCriterionId = new Map<number, string[]>();
  const itemsByCriterionId = new Map<number, ReturnType<typeof responseTopicItem>[]>();
  for (const response of responses) {
    const criterionId = responseCriterionId(response);
    const summaries = summariesByCriterionId.get(criterionId) ?? [];
    const items = itemsByCriterionId.get(criterionId) ?? [];
    if (response.shortSummary && !summaries.includes(response.shortSummary)) {
      summaries.push(response.shortSummary);
    }
    if (!items.some((item) => item.id === (response.id?.toString() ?? ""))) {
      items.push(responseTopicItem(response));
    }
    summariesByCriterionId.set(criterionId, summaries.slice(0, 3));
    itemsByCriterionId.set(criterionId, items);
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
        sampleSummaries: summariesByCriterionId.get(group.minorCriterionId ?? 0) ?? [],
        items: itemsByCriterionId.get(group.minorCriterionId ?? 0) ?? []
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
  const directQuotes: DirectCustomerQuote[] = responses
    .map((response) => {
      const text = directCustomerQuote(response);
      if (!text) {
        return null;
      }

      const criterionId = responseCriterionId(response);
      const criterion = criteriaById.get(criterionId);
      return {
        id: response.id?.toString() ?? "",
        date: response.date ? formatDateOnly(response.date) : "",
        text,
        summary: cleanResponseText(response.shortSummary) || "요약 없음",
        criterionId,
        path: criterion ? buildPathFromCriteria(criteriaById, criterion) : responsePathFromIds(response, criteriaById)
      };
    })
    .filter((quote): quote is DirectCustomerQuote => quote !== null)
    .slice(0, 5);

  return {
    headline: executiveHeadline(total, executiveBuckets, fallbackHeadline),
    checkNeededCount,
    executiveBuckets,
    repeatedTopics,
    directQuotes,
    keyNotes: [
      ...(checkNeededCount > 0
        ? [`확인 필요 반응 ${checkNeededCount.toLocaleString("ko-KR")}건`]
        : []),
      ...(topTopic ? [`최다 반복: ${topTopic.path.map((item) => item.name).join(" > ")}`] : [])
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

async function buildCheckNeededFilter(
  app: FastifyInstance,
  enabled: boolean
): Promise<Prisma.CustomerResponseWhereInput> {
  if (!enabled) {
    return {};
  }

  const criteria = await app.prisma.responseCriterion.findMany({
    where: { name: { in: Array.from(checkNeededCriterionNames) } },
    select: { id: true, depth: true }
  });

  const criterionFilters = criteria.flatMap((criterion): Prisma.CustomerResponseWhereInput[] => {
    if (criterion.depth === 1) {
      return [{ majorCriterionId: criterion.id }];
    }
    if (criterion.depth === 2) {
      return [{ middleCriterionId: criterion.id }];
    }
    return [{ minorCriterionId: criterion.id }];
  });

  const textFilters = checkNeededWords.flatMap((word): Prisma.CustomerResponseWhereInput[] => [
    { shortSummary: { contains: word } },
    { fullText: { contains: word } }
  ]);

  return { OR: [...criterionFilters, ...textFilters] };
}

async function buildInsightBucketFilter(
  app: FastifyInstance,
  baseWhere: Prisma.CustomerResponseWhereInput,
  bucket?: ExecutiveBucketKey
): Promise<Prisma.CustomerResponseWhereInput> {
  if (!bucket) {
    return {};
  }

  const [criteria, candidates] = await app.prisma.$transaction([
    app.prisma.responseCriterion.findMany({
      orderBy: [{ depth: "asc" }, { parentId: "asc" }, { sortOrder: "asc" }, { name: "asc" }]
    }),
    app.prisma.customerResponse.findMany({
      where: baseWhere,
      include: {
        criterion: true,
        majorCriterion: true,
        middleCriterion: true,
        minorCriterion: true
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 1000
    })
  ]);

  const criteriaById = criteriaMap(criteria);
  const matchingIds = (candidates as ResponseWithRelations[])
    .filter((response) =>
      classifyExecutiveBuckets(response, responsePathFromIds(response, criteriaById)).includes(
        bucket
      )
    )
    .map((response) => response.id);

  return { id: { in: matchingIds } };
}

export async function registerResponseRoutes(app: FastifyInstance): Promise<void> {
  app.get("/", async (request, reply) => {
    const query = listResponseQuerySchema.parse(request.query);
    const baseWhere = {
      ...buildDateWhere(query),
      ...activeResponseCriterionWhere
    };
    const where = {
      ...baseWhere,
      ...(await buildCriterionFilter(app, query.criterion_id)),
      ...(await buildCheckNeededFilter(app, query.check_needed)),
      ...(await buildInsightBucketFilter(app, baseWhere, query.insight_bucket))
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
    const criteriaById = criteriaMap(responseCriteria);

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
