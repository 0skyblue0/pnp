import { MessageSquareText, RefreshCcw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { apiGet } from "../../shared/api/client.js";
import { Button } from "../../shared/ui/Button.js";

type ListEnvelope<T> = {
  items: T[];
  total: number;
  page: number;
  size: number;
};

type ResponseDto = {
  id: string;
  date: string;
  category:
    | "PRODUCT_REVIEW"
    | "SERVICE_REVIEW"
    | "VISIT_MOTIVE"
    | "REQUEST"
    | "CASUAL_TALK"
    | "COMPLAINT"
    | "USE_CASE";
  sentimentScore: number | null;
  actionPriority: "IMMEDIATE" | "REVIEW" | "RECORD_ONLY" | null;
  isBossFlag: boolean;
  shortSummary: string | null;
  fullText: string | null;
  tags: string[];
  createdAt: string;
};

type FilterState = {
  from: string;
  to: string;
  category: "" | ResponseDto["category"];
  bossOnly: boolean;
};

const categoryLabels: Record<ResponseDto["category"], string> = {
  PRODUCT_REVIEW: "제품 반응",
  SERVICE_REVIEW: "응대 반응",
  VISIT_MOTIVE: "방문 동기",
  REQUEST: "요청",
  CASUAL_TALK: "대화",
  COMPLAINT: "불만",
  USE_CASE: "활용"
};

const priorityLabels: Record<NonNullable<ResponseDto["actionPriority"]>, string> = {
  IMMEDIATE: "즉시",
  REVIEW: "검토",
  RECORD_ONLY: "기록"
};

function todayInStoreTime(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function buildQuery(filters: FilterState): string {
  const params = new URLSearchParams();
  if (filters.from) {
    params.set("from", filters.from);
  }
  if (filters.to) {
    params.set("to", filters.to);
  }
  if (filters.category) {
    params.set("category", filters.category);
  }
  if (filters.bossOnly) {
    params.set("boss_flag", "true");
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function ResponseListPage() {
  const today = todayInStoreTime();
  const [filters, setFilters] = useState<FilterState>({
    from: today,
    to: today,
    category: "",
    bossOnly: false
  });
  const [responses, setResponses] = useState<ResponseDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadResponses = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const envelope = await apiGet<ListEnvelope<ResponseDto>>(`/response${buildQuery(filters)}`);

      if (envelope.error) {
        setError(envelope.error.message);
        return;
      }

      setResponses(envelope.data.items);
    } catch (unknownError) {
      setError(
        unknownError instanceof Error ? unknownError.message : "고객 반응을 조회하지 못했습니다."
      );
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void loadResponses();
  }, [loadResponses]);

  return (
    <div className="mx-auto grid max-w-7xl gap-4">
      <section className="panel min-w-0">
        <div className="panel-heading">
          <div>
            <p className="text-sm text-muted">M3</p>
            <h2 className="section-title">고객 반응 조회</h2>
          </div>
          <Link className="text-sm font-semibold text-blue hover:underline" to="/response/new">
            반응 입력
          </Link>
        </div>

        {error ? (
          <div className="mb-4 rounded-control border border-red/20 bg-red/10 px-3 py-2 text-sm font-semibold text-red">
            {error}
          </div>
        ) : null}

        <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_auto_auto] lg:items-end">
          <label className="grid min-w-0 gap-2">
            <span className="field-label">시작일</span>
            <input
              className="input min-w-0 w-full"
              type="date"
              value={filters.from}
              onChange={(event) =>
                setFilters((current) => ({ ...current, from: event.target.value }))
              }
            />
          </label>
          <label className="grid min-w-0 gap-2">
            <span className="field-label">종료일</span>
            <input
              className="input min-w-0 w-full"
              type="date"
              value={filters.to}
              onChange={(event) =>
                setFilters((current) => ({ ...current, to: event.target.value }))
              }
            />
          </label>
          <label className="grid min-w-0 gap-2">
            <span className="field-label">분류</span>
            <select
              className="input min-w-0 w-full"
              value={filters.category}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  category: event.target.value as FilterState["category"]
                }))
              }
            >
              <option value="">전체</option>
              {Object.entries(categoryLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="inline-flex min-h-11 items-center gap-3 rounded-control border border-stone-300 px-3 font-semibold">
            <input
              className="h-5 w-5 accent-stone-900"
              type="checkbox"
              checked={filters.bossOnly}
              onChange={(event) =>
                setFilters((current) => ({ ...current, bossOnly: event.target.checked }))
              }
            />
            사장 보고
          </label>
          <Button icon={RefreshCcw} type="button" onClick={() => void loadResponses()}>
            {isLoading ? "조회 중" : "조회"}
          </Button>
        </div>
      </section>

      <section className="panel min-w-0">
        <div className="panel-heading">
          <div>
            <p className="text-sm text-muted">입력된 내용</p>
            <h2 className="section-title">반응 목록</h2>
          </div>
          <MessageSquareText className="h-5 w-5 text-bread" aria-hidden="true" />
        </div>
        <div className="space-y-3">
          {responses.map((response) => (
            <article key={response.id} className="rounded-control border border-stone-200 p-3">
              <div className="grid gap-3 lg:grid-cols-[120px_140px_minmax(0,1fr)_auto] lg:items-start">
                <span className="font-semibold">{response.date}</span>
                <span className="rounded-control bg-blue/10 px-2 py-1 text-center text-sm font-semibold text-blue">
                  {categoryLabels[response.category]}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold">{response.shortSummary ?? "요약 없음"}</p>
                  {response.fullText ? (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted">
                      {response.fullText}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
                  {response.actionPriority ? (
                    <span className="rounded-control bg-stone-100 px-2 py-1 text-xs font-semibold">
                      {priorityLabels[response.actionPriority]}
                    </span>
                  ) : null}
                  {response.sentimentScore ? (
                    <span className="rounded-control bg-green/10 px-2 py-1 text-xs font-semibold text-green">
                      만족 {response.sentimentScore}
                    </span>
                  ) : null}
                  {response.isBossFlag ? (
                    <span className="rounded-control bg-amber/10 px-2 py-1 text-xs font-semibold text-amber">
                      보고
                    </span>
                  ) : null}
                </div>
              </div>
              {response.tags.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {response.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-control border border-stone-200 px-2 py-1 text-xs font-semibold text-muted"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
          {!isLoading && responses.length === 0 ? (
            <div className="rounded-control border border-stone-200 px-3 py-6 text-center text-sm font-medium text-muted">
              조회된 고객 반응 없음
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
