import { MessageSquareText, RefreshCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { apiGet } from "../../shared/api/client.js";
import type { ListEnvelope } from "../../shared/api/types.js";
import { Button } from "../../shared/ui/Button.js";
import {
  criteriaByParent,
  criterionPathLabel,
  type CriterionPathItem,
  type ResponseCriterionDto
} from "./responseCriteria.js";

type ResponseDto = {
  id: string;
  date: string;
  criterionId: number;
  majorCriterionId: number;
  middleCriterionId: number | null;
  minorCriterionId: number | null;
  criterionPath: CriterionPathItem[];
  shortSummary: string | null;
  fullText: string | null;
  createdAt: string;
};

const importedResponseRange = { from: "2026-05-01", to: "2026-05-31" };

type FilterState = {
  from: string;
  to: string;
  criterionId: string;
};

function buildQuery(filters: FilterState): string {
  const params = new URLSearchParams();
  if (filters.from) {
    params.set("from", filters.from);
  }
  if (filters.to) {
    params.set("to", filters.to);
  }
  if (filters.criterionId) {
    params.set("criterion_id", filters.criterionId);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

function flattenCriteria(
  criteria: ResponseCriterionDto[],
  parentId: number | null = null
): ResponseCriterionDto[] {
  return criteriaByParent(criteria, parentId).flatMap((criterion) => [
    criterion,
    ...flattenCriteria(criteria, criterion.id)
  ]);
}

function criterionOptionLabel(criterion: ResponseCriterionDto): string {
  const prefix = criterion.depth > 1 ? `${"  ".repeat(criterion.depth - 1)}- ` : "";
  return `${prefix}${criterion.name}${criterion.isActive ? "" : " (비활성)"}`;
}

export function ResponseListPage() {
  const [filters, setFilters] = useState<FilterState>({
    from: importedResponseRange.from,
    to: importedResponseRange.to,
    criterionId: ""
  });
  const [criteria, setCriteria] = useState<ResponseCriterionDto[]>([]);
  const [responses, setResponses] = useState<ResponseDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingCriteria, setIsLoadingCriteria] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const criterionOptions = useMemo(() => flattenCriteria(criteria), [criteria]);

  const loadCriteria = useCallback(async () => {
    setIsLoadingCriteria(true);

    try {
      const envelope = await apiGet<ListEnvelope<ResponseCriterionDto>>("/response-criteria");

      if (envelope.error) {
        setError(envelope.error.message);
        return;
      }

      setCriteria(envelope.data.items);
    } catch (unknownError) {
      setError(
        unknownError instanceof Error ? unknownError.message : "반응 기준을 조회하지 못했습니다."
      );
    } finally {
      setIsLoadingCriteria(false);
    }
  }, []);

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
    void loadCriteria();
  }, [loadCriteria]);

  useEffect(() => {
    void loadResponses();
  }, [loadResponses]);

  return (
    <div className="mx-auto grid max-w-7xl gap-4">
      <section className="panel min-w-0">
        <div className="panel-heading">
          <div>
            <p className="text-sm text-muted">고객 반응</p>
            <h2 className="section-title">상세 조회</h2>
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

        <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1.4fr_auto] lg:items-end">
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
            <span className="field-label">기준</span>
            <select
              className="input min-w-0 w-full"
              disabled={isLoadingCriteria}
              value={filters.criterionId}
              onChange={(event) =>
                setFilters((current) => ({ ...current, criterionId: event.target.value }))
              }
            >
              <option value="">전체</option>
              {criterionOptions.map((criterion) => (
                <option key={criterion.id} value={criterion.id}>
                  {criterionOptionLabel(criterion)}
                </option>
              ))}
            </select>
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
              <div className="grid gap-3 lg:grid-cols-[120px_minmax(180px,260px)_minmax(0,1fr)] lg:items-start">
                <span className="font-semibold">{response.date}</span>
                <span className="rounded-control bg-blue/10 px-2 py-1 text-center text-sm font-semibold text-blue">
                  {criterionPathLabel(response.criterionPath)}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold">{response.shortSummary ?? "요약 없음"}</p>
                  {response.fullText ? (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted">
                      {response.fullText}
                    </p>
                  ) : null}
                </div>
              </div>
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
