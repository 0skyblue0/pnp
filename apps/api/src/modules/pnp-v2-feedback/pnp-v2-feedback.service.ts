import type { AppConfig } from "../../config.js";
import { HttpError } from "../../common/http.js";

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
