import type { AppConfig } from "../../config.js";
import { HttpError } from "../../common/http.js";
import { maskPii } from "../llm/pii-masker.js";
import {
  hermesFeedbackSuggestionSchema,
  type PnpV2FeedbackSuggestion
} from "./pnp-v2-feedback.schemas.js";

export type SupabaseCriterion = {
  id: string;
  parent_id: string | null;
  depth: number;
  name: string;
  sort_order: number;
  active: boolean;
};

type SupabaseUser = {
  id: string;
  email?: string;
};

type MembershipRow = {
  role: string;
};

const writableRoles = new Set(["owner", "manager", "staff"]);
const suggestionNotConfiguredMessage =
  "AI 분류 API가 설정되지 않았습니다. 관리자에게 연결 상태를 확인해 주세요.";
const suggestionFailureMessage =
  "AI 분류 API 실행에 실패했습니다. 관리자에게 연결 상태를 확인해 주세요.";
const suggestionInvalidMessage =
  "AI가 등록되지 않은 분류를 반환했습니다. 직접 분류해 주세요.";

type HermesChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
};

function supabaseHeaders(config: AppConfig, token: string): Record<string, string> {
  if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY) {
    throw new HttpError(
      503,
      "HERMES_NOT_CONFIGURED",
      "AI 분류 API가 설정되지 않았습니다. 관리자에게 연결 상태를 확인해 주세요."
    );
  }

  return {
    Accept: "application/json",
    apikey: config.SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`
  };
}

async function responseJson<T>(response: Response, code: string): Promise<T> {
  if (!response.ok) {
    throw new HttpError(502, code, "AI 분류용 데이터를 불러오지 못했습니다.");
  }
  return response.json() as Promise<T>;
}

export async function loadAuthorizedStoreCriteria(
  config: AppConfig,
  token: string,
  storeId: string
): Promise<SupabaseCriterion[]> {
  const headers = supabaseHeaders(config, token);
  const baseUrl = config.SUPABASE_URL!.replace(/\/$/, "");

  const userResponse = await fetch(`${baseUrl}/auth/v1/user`, { headers });
  if (!userResponse.ok) {
    throw new HttpError(401, "SUPABASE_AUTH_INVALID", "로그인이 만료되었습니다. 다시 로그인해 주세요.");
  }
  const user = await userResponse.json() as SupabaseUser;
  if (!user.id) {
    throw new HttpError(401, "SUPABASE_AUTH_INVALID", "로그인이 만료되었습니다. 다시 로그인해 주세요.");
  }

  const membershipQuery = new URLSearchParams({
    select: "role",
    store_id: `eq.${storeId}`,
    user_id: `eq.${user.id}`
  });
  const membershipResponse = await fetch(
    `${baseUrl}/rest/v1/memberships?${membershipQuery.toString()}`,
    { headers }
  );
  const memberships = await responseJson<MembershipRow[]>(membershipResponse, "SUPABASE_QUERY_FAILED");
  if (!memberships.some((membership) => writableRoles.has(membership.role))) {
    throw new HttpError(403, "STORE_ACCESS_DENIED", "이 매장에서 AI 분류를 사용할 권한이 없습니다.");
  }

  const criteriaQuery = new URLSearchParams({
    select: "id,parent_id,depth,name,sort_order,active",
    store_id: `eq.${storeId}`,
    active: "eq.true",
    order: "depth.asc,sort_order.asc"
  });
  const criteriaResponse = await fetch(
    `${baseUrl}/rest/v1/response_criteria?${criteriaQuery.toString()}`,
    { headers }
  );
  return responseJson<SupabaseCriterion[]>(criteriaResponse, "SUPABASE_QUERY_FAILED");
}

function stripJsonFence(content: string): string {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced?.[1]?.trim() ?? trimmed;
}

function validateRegisteredPath(
  suggestion: PnpV2FeedbackSuggestion,
  criteria: SupabaseCriterion[]
): void {
  const major = criteria.find((criterion) =>
    criterion.active && criterion.depth === 1 && criterion.name === suggestion.major
  );
  if (!major) {
    throw new HttpError(502, "HERMES_INVALID_SUGGESTION", suggestionInvalidMessage);
  }

  if (!suggestion.mid) {
    if (suggestion.minor) {
      throw new HttpError(502, "HERMES_INVALID_SUGGESTION", suggestionInvalidMessage);
    }
    return;
  }

  const mid = criteria.find((criterion) =>
    criterion.active
    && criterion.depth === 2
    && criterion.parent_id === major.id
    && criterion.name === suggestion.mid
  );
  if (!mid) {
    throw new HttpError(502, "HERMES_INVALID_SUGGESTION", suggestionInvalidMessage);
  }

  if (!suggestion.minor) return;
  const minor = criteria.find((criterion) =>
    criterion.active
    && criterion.depth === 3
    && criterion.parent_id === mid.id
    && criterion.name === suggestion.minor
  );
  if (!minor) {
    throw new HttpError(502, "HERMES_INVALID_SUGGESTION", suggestionInvalidMessage);
  }
}

function buildHermesUserPrompt(content: string, criteria: SupabaseCriterion[]): string {
  return JSON.stringify({
    task: "pnp_v2_feedback_classification",
    rules: [
      "registered_criteria_only",
      "exact_parent_path",
      "allowed_signal_only",
      "json_only"
    ],
    registeredCriteria: criteria.map((criterion) => ({
      id: criterion.id,
      parentId: criterion.parent_id,
      depth: criterion.depth,
      name: criterion.name
    })),
    customerResponseText: maskPii(content).maskedText
  }, null, 2);
}

const hermesSystemPrompt = [
  "당신은 paul&paulina 고객 반응 분류 전용 프로필입니다.",
  "제공된 등록 기준의 정확한 부모 경로만 선택합니다.",
  "signal은 매출 기회, 놓친 매출, 손님 요청, 불만/개선, 칭찬, 운영 정보 중 하나입니다.",
  "등록 기준에 없는 이름을 만들지 않습니다.",
  "응답은 JSON 객체 하나만 반환합니다.",
  '형식: {"major":string,"mid":string,"minor":string,"signal":string,"summary":string,"reason":string}',
  "중분류나 소분류가 없는 기준은 해당 값을 빈 문자열로 반환합니다."
].join("\n");

export async function requestPnpV2HermesSuggestion(
  config: AppConfig,
  content: string,
  criteria: SupabaseCriterion[]
): Promise<PnpV2FeedbackSuggestion> {
  if (!config.HERMES_API_BASE_URL || !config.HERMES_API_KEY) {
    throw new HttpError(503, "HERMES_NOT_CONFIGURED", suggestionNotConfiguredMessage);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.HERMES_API_TIMEOUT_MS);
  try {
    const response = await fetch(
      `${config.HERMES_API_BASE_URL.replace(/\/$/, "")}/chat/completions`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${config.HERMES_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: config.HERMES_API_MODEL,
          stream: false,
          temperature: 0,
          messages: [
            { role: "system", content: hermesSystemPrompt },
            { role: "user", content: buildHermesUserPrompt(content, criteria) }
          ]
        }),
        signal: controller.signal
      }
    );
    if (!response.ok) {
      throw new Error(`Hermes API failed with ${response.status}`);
    }

    const completion = await response.json() as HermesChatCompletionResponse;
    const completionContent = completion.choices?.[0]?.message?.content;
    if (!completionContent) {
      throw new Error("Hermes API returned no content");
    }

    let suggestion: PnpV2FeedbackSuggestion;
    try {
      suggestion = hermesFeedbackSuggestionSchema.parse(JSON.parse(stripJsonFence(completionContent)));
    } catch {
      throw new HttpError(502, "HERMES_INVALID_SUGGESTION", suggestionInvalidMessage);
    }
    validateRegisteredPath(suggestion, criteria);
    return suggestion;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(502, "HERMES_SUGGESTION_FAILED", suggestionFailureMessage);
  } finally {
    clearTimeout(timeout);
  }
}

export async function checkPnpV2HermesAvailability(config: AppConfig): Promise<boolean> {
  if (!config.HERMES_API_BASE_URL || !config.HERMES_API_KEY) return false;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.min(config.HERMES_API_TIMEOUT_MS, 5000));
  try {
    const response = await fetch(
      `${config.HERMES_API_BASE_URL.replace(/\/$/, "")}/models`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${config.HERMES_API_KEY}`
        },
        signal: controller.signal
      }
    );
    if (!response.ok) return false;
    const body = await response.json() as { data?: Array<{ id?: string }> };
    return body.data?.some((model) => model.id === config.HERMES_API_MODEL) ?? false;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
