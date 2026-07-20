import { MessageSquareText, RefreshCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { apiDelete, apiGet, apiPatch, apiPost } from "../../shared/api/client.js";
import type { ListEnvelope } from "../../shared/api/types.js";
import { todayInStoreTime } from "../../shared/time/storeTime.js";
import { PageHeader } from "../../shared/ui/PageHeader.js";
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
  llmAssisted: boolean;
  createdAt: string;
};

function recentThirtyDaysRange(): { from: string; to: string } {
  const to = new Date(todayInStoreTime());
  const from = new Date(to);
  from.setDate(to.getDate() - 29);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

type FilterState = {
  from: string;
  to: string;
  criterionId: string;
  insightBucket: string;
  checkNeeded: boolean;
  keyword: string;
};

const insightBucketLabels: Record<string, string> = {
  salesStrength: "잘 팔리는 신호",
  missedSales: "놓친 매출 신호",
  productImprovements: "제품 개선 신호",
  visitFlow: "방문 흐름 신호",
  serviceRisk: "주의 신호"
};

const INITIAL_VISIBLE_RESPONSE_COUNT = 20;

type ResponseEditDraft = {
  date: string;
  criterionId: string;
  shortSummary: string;
  fullText: string;
  llmAssisted: boolean;
};

type ResponseSuggestionDto = {
  criterionId: number;
  criterionPath: CriterionPathItem[];
  shortSummary: string;
  reason: string;
};

const sourceLinePattern = /^\s*(?:\[[^\]]+\]|출처:|source:)/i;

function visibleResponseText(value: string | null): string {
  return (value ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !sourceLinePattern.test(line))
    .join("\n")
    .trim();
}

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
  if (filters.insightBucket) {
    params.set("insight_bucket", filters.insightBucket);
  }
  if (filters.checkNeeded) {
    params.set("check_needed", "true");
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

function criterionPathFromSelection(
  criteria: ResponseCriterionDto[],
  criterion: ResponseCriterionDto | undefined
): CriterionPathItem[] {
  if (!criterion) {
    return [];
  }

  const byId = new Map(criteria.map((item) => [item.id, item]));
  const path: CriterionPathItem[] = [criterion];
  let current = criterion;
  while (current.parentId) {
    const parent = byId.get(current.parentId);
    if (!parent) {
      break;
    }
    path.unshift(parent);
    current = parent;
  }
  return path;
}

function monthRange(date: Date): { from: string; to: string } {
  const from = new Date(date.getFullYear(), date.getMonth(), 1);
  const to = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export function ResponseListPage() {
  const [searchParams] = useSearchParams();
  const defaultRange = recentThirtyDaysRange();
  const [filters, setFilters] = useState<FilterState>({
    from: searchParams.get("from") ?? defaultRange.from,
    to: searchParams.get("to") ?? defaultRange.to,
    criterionId: searchParams.get("criterion_id") ?? "",
    insightBucket: searchParams.get("insight_bucket") ?? "",
    checkNeeded: searchParams.get("check_needed") === "true",
    keyword: ""
  });
  const [criteria, setCriteria] = useState<ResponseCriterionDto[]>([]);
  const [responses, setResponses] = useState<ResponseDto[]>([]);
  const [totalResponses, setTotalResponses] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingCriteria, setIsLoadingCriteria] = useState(false);
  const [editingResponseId, setEditingResponseId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<ResponseEditDraft | null>(null);
  const [savingResponseId, setSavingResponseId] = useState<string | null>(null);
  const [suggestingResponseId, setSuggestingResponseId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_RESPONSE_COUNT);
  const [error, setError] = useState<string | null>(null);

  const criterionOptions = useMemo(() => flattenCriteria(criteria), [criteria]);
  const selectedCriterion = useMemo(
    () => criterionOptions.find((criterion) => criterion.id.toString() === filters.criterionId),
    [criterionOptions, filters.criterionId]
  );
  const selectedCriterionLabel = criterionPathLabel(
    criterionPathFromSelection(criterionOptions, selectedCriterion)
  );
  const selectedCriterionPath = useMemo(
    () => criterionPathFromSelection(criterionOptions, selectedCriterion),
    [criterionOptions, selectedCriterion]
  );
  const selectedMajorFilterId = selectedCriterionPath[0]?.id.toString() ?? "";
  const selectedMiddleFilterId = selectedCriterionPath[1]?.id.toString() ?? "";
  const selectedMinorFilterId = selectedCriterionPath[2]?.id.toString() ?? "";
  const majorFilterOptions = useMemo(() => criteriaByParent(criteria, null), [criteria]);
  const middleFilterOptions = useMemo(
    () => (selectedMajorFilterId ? criteriaByParent(criteria, Number(selectedMajorFilterId)) : []),
    [criteria, selectedMajorFilterId]
  );
  const minorFilterOptions = useMemo(
    () => (selectedMiddleFilterId ? criteriaByParent(criteria, Number(selectedMiddleFilterId)) : []),
    [criteria, selectedMiddleFilterId]
  );
  const filteredResponses = useMemo(() => {
    const keyword = filters.keyword.trim().toLocaleLowerCase("ko-KR");
    if (!keyword) {
      return responses;
    }

    return responses.filter((response) => {
      const haystack = [
        response.date,
        criterionPathLabel(response.criterionPath),
        response.shortSummary ?? "",
        visibleResponseText(response.fullText)
      ]
        .join(" ")
        .toLocaleLowerCase("ko-KR");
      return haystack.includes(keyword);
    });
  }, [filters.keyword, responses]);
  const visibleResponses = useMemo(
    () => filteredResponses.slice(0, visibleCount),
    [filteredResponses, visibleCount]
  );

  const loadCriteria = useCallback(async () => {
    setIsLoadingCriteria(true);

    try {
      const envelope = await apiGet<ListEnvelope<ResponseCriterionDto>>(
        "/response-criteria?active=true"
      );

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
      setTotalResponses(envelope.data.total);
    } catch (unknownError) {
      setError(
        unknownError instanceof Error ? unknownError.message : "고객 반응을 조회하지 못했습니다."
      );
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  const applyRange = (range: { from: string; to: string }) => {
    setFilters((current) => ({ ...current, ...range }));
  };

  const resetFilters = () => {
    setFilters({
      ...recentThirtyDaysRange(),
      criterionId: "",
      insightBucket: "",
      checkNeeded: false,
      keyword: ""
    });
  };

  useEffect(() => {
    void loadCriteria();
  }, [loadCriteria]);

  useEffect(() => {
    void loadResponses();
  }, [loadResponses]);

  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE_RESPONSE_COUNT);
  }, [filters.from, filters.to, filters.criterionId, filters.insightBucket, filters.checkNeeded, filters.keyword]);

  const startEditing = (response: ResponseDto) => {
    setEditingResponseId(response.id);
    setEditDraft({
      date: response.date,
      criterionId: response.criterionId.toString(),
      shortSummary: response.shortSummary ?? "",
      fullText: visibleResponseText(response.fullText),
      llmAssisted: response.llmAssisted
    });
    setError(null);
  };

  const cancelEditing = () => {
    setEditingResponseId(null);
    setEditDraft(null);
  };

  const saveEditing = async (responseId: string) => {
    if (!editDraft) {
      return;
    }

    if (!editDraft.date || !editDraft.criterionId || editDraft.shortSummary.trim().length === 0) {
      setError("날짜, 기준, 한 줄 요약을 확인하세요.");
      return;
    }

    setSavingResponseId(responseId);
    setError(null);

    try {
      const envelope = await apiPatch<ResponseDto, Record<string, unknown>>(
        `/response/${responseId}`,
        {
          date: editDraft.date,
          criterionId: Number(editDraft.criterionId),
          shortSummary: editDraft.shortSummary.trim(),
          fullText: editDraft.fullText.trim() || undefined,
          llmAssisted: editDraft.llmAssisted
        }
      );

      if (envelope.error) {
        setError(envelope.error.message);
        return;
      }

      setResponses((current) =>
        current.map((response) => (response.id === responseId ? envelope.data : response))
      );
      cancelEditing();
    } catch (unknownError) {
      setError(
        unknownError instanceof Error ? unknownError.message : "고객 반응을 수정하지 못했습니다."
      );
    } finally {
      setSavingResponseId(null);
    }
  };

  const suggestEditing = async (responseId: string) => {
    if (!editDraft) {
      return;
    }

    const fullText = editDraft.fullText.trim();
    if (!fullText) {
      setError("AI 분류할 실제 기록 내용을 입력하세요.");
      return;
    }

    setSuggestingResponseId(responseId);
    setError(null);

    try {
      const envelope = await apiPost<ResponseSuggestionDto, { fullText: string }>(
        "/response/suggest",
        {
          fullText
        }
      );

      if (envelope.error) {
        setError(envelope.error.message);
        return;
      }

      setEditDraft((current) =>
        current
          ? {
              ...current,
              criterionId: envelope.data.criterionId.toString(),
              shortSummary: envelope.data.shortSummary,
              llmAssisted: true
            }
          : current
      );
    } catch (unknownError) {
      setError(
        unknownError instanceof Error ? unknownError.message : "AI 분류를 실행하지 못했습니다."
      );
    } finally {
      setSuggestingResponseId(null);
    }
  };

  const deleteResponse = async (response: ResponseDto) => {
    if (!window.confirm(`이 반응을 삭제할까요?\n${response.shortSummary ?? "요약 없음"}`)) {
      return;
    }

    setSavingResponseId(response.id);
    setError(null);

    try {
      const envelope = await apiDelete<{ deleted: boolean }>(`/response/${response.id}`);

      if (envelope.error) {
        setError(envelope.error.message);
        return;
      }

      setResponses((current) => current.filter((item) => item.id !== response.id));
      if (editingResponseId === response.id) {
        cancelEditing();
      }
    } catch (unknownError) {
      setError(
        unknownError instanceof Error ? unknownError.message : "고객 반응을 삭제하지 못했습니다."
      );
    } finally {
      setSavingResponseId(null);
    }
  };

  return (
    <div className="app-page grid gap-4">
      <section className="app-card min-w-0">
        <PageHeader eyebrow="고객 반응" title="상세 조회" actions={<Link className="text-sm font-semibold text-blue hover:underline" to="/response/new">
            반응 입력
          </Link>} />

        {error ? (
          <div className="mb-4 rounded-control border border-red/20 bg-red/10 px-3 py-2 text-sm font-semibold text-red">
            {error}
          </div>
        ) : null}

        <div className="mb-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-full border border-latte bg-white px-3 py-1 text-xs font-bold text-cocoa transition hover:bg-cream"
            onClick={() => applyRange(recentThirtyDaysRange())}
          >
            최근 30일
          </button>
          <button
            type="button"
            className="rounded-full border border-latte bg-white px-3 py-1 text-xs font-bold text-cocoa transition hover:bg-cream"
            onClick={() => applyRange(monthRange(new Date(todayInStoreTime())))}
          >
            이번달
          </button>
          <button
            type="button"
            className="rounded-full border border-latte bg-white px-3 py-1 text-xs font-bold text-cocoa transition hover:bg-cream"
            onClick={() => {
              const date = new Date(todayInStoreTime());
              date.setMonth(date.getMonth() - 1);
              applyRange(monthRange(date));
            }}
          >
            지난달
          </button>
          <button
            type="button"
            className="rounded-full border border-latte bg-white px-3 py-1 text-xs font-bold text-muted transition hover:bg-cream"
            onClick={resetFilters}
          >
            초기화
          </button>
        </div>

        <div className="grid gap-3 lg:grid-cols-[140px_140px_minmax(150px,0.8fr)_minmax(150px,0.8fr)_minmax(150px,0.8fr)_minmax(180px,1fr)_auto_auto] lg:items-end">
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
            <span className="field-label">대분류 기준</span>
            <select
              className="input min-w-0 w-full"
              disabled={isLoadingCriteria}
              value={selectedMajorFilterId}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  criterionId: event.target.value,
                  insightBucket: ""
                }))
              }
            >
              <option value="">전체</option>
              {majorFilterOptions.map((criterion) => (
                <option key={criterion.id} value={criterion.id}>
                  {criterion.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid min-w-0 gap-2">
            <span className="field-label">중분류 기준</span>
            <select
              className="input min-w-0 w-full"
              disabled={isLoadingCriteria || !selectedMajorFilterId || middleFilterOptions.length === 0}
              value={selectedMiddleFilterId}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  criterionId: event.target.value || selectedMajorFilterId,
                  insightBucket: ""
                }))
              }
            >
              <option value="">전체</option>
              {middleFilterOptions.map((criterion) => (
                <option key={criterion.id} value={criterion.id}>
                  {criterion.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid min-w-0 gap-2">
            <span className="field-label">세부 기준</span>
            <select
              className="input min-w-0 w-full"
              disabled={isLoadingCriteria || !selectedMiddleFilterId || minorFilterOptions.length === 0}
              value={selectedMinorFilterId}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  criterionId: event.target.value || selectedMiddleFilterId || selectedMajorFilterId,
                  insightBucket: ""
                }))
              }
            >
              <option value="">전체</option>
              {minorFilterOptions.map((criterion) => (
                <option key={criterion.id} value={criterion.id}>
                  {criterion.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid min-w-0 gap-2">
            <span className="field-label">내용 검색</span>
            <input
              className="input min-w-0 w-full"
              placeholder="예: 깜빠뉴, 품절, 컷팅"
              value={filters.keyword}
              onChange={(event) =>
                setFilters((current) => ({ ...current, keyword: event.target.value }))
              }
            />
          </label>
          <label className="flex min-h-10 items-center gap-2 text-sm font-semibold text-cocoa lg:pb-1">
            <input
              type="checkbox"
              checked={filters.checkNeeded}
              onChange={(event) =>
                setFilters((current) => ({ ...current, checkNeeded: event.target.checked }))
              }
            />
            확인 필요만
          </label>
          <Button icon={RefreshCcw} type="button" onClick={() => void loadResponses()}>
            {isLoading ? "조회 중" : "조회"}
          </Button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-muted">
          <span className="rounded-full bg-cream px-3 py-1 text-cocoa">
            {filters.from} ~ {filters.to}
          </span>
          <span className="rounded-full bg-cream px-3 py-1 text-cocoa">
            기준: {selectedCriterion ? selectedCriterionLabel : "전체"}
          </span>
          {filters.insightBucket ? (
            <span className="rounded-full bg-blue/10 px-3 py-1 text-blue">
              신호: {insightBucketLabels[filters.insightBucket] ?? filters.insightBucket}
            </span>
          ) : null}
          {filters.checkNeeded ? (
            <span className="rounded-full bg-red/10 px-3 py-1 text-red">확인 필요만</span>
          ) : null}
          {filters.keyword.trim() ? (
            <span className="rounded-full bg-blue/10 px-3 py-1 text-blue">
              검색: {filters.keyword.trim()}
            </span>
          ) : null}
        </div>
      </section>

      <section className="panel min-w-0">
        <div className="panel-heading">
          <div>
            <p className="text-sm text-muted">입력된 내용</p>
            <h2 className="section-title">반응 목록</h2>
            <p className="mt-1 text-xs font-semibold text-muted">
              {visibleResponses.length}건 표시 / 조회 결과 {totalResponses}건
              {totalResponses >= 100 ? " · 최근 100건까지 표시" : ""}
            </p>
          </div>
          <MessageSquareText className="h-5 w-5 text-bread" aria-hidden="true" />
        </div>
        <div className="space-y-3">
          {visibleResponses.map((response) => (
            <article key={response.id} className="rounded-control border border-stone-200 p-3">
              {editingResponseId === response.id && editDraft ? (
                <div className="grid gap-3">
                  <div className="grid gap-3 lg:grid-cols-[150px_minmax(220px,1fr)]">
                    <label className="grid gap-1">
                      <span className="field-label">날짜</span>
                      <input
                        className="input"
                        type="date"
                        value={editDraft.date}
                        onChange={(event) =>
                          setEditDraft((current) =>
                            current ? { ...current, date: event.target.value } : current
                          )
                        }
                      />
                    </label>
                    <label className="grid gap-1">
                      <span className="field-label">기준</span>
                      <select
                        className="input"
                        value={editDraft.criterionId}
                        onChange={(event) =>
                          setEditDraft((current) =>
                            current ? { ...current, criterionId: event.target.value } : current
                          )
                        }
                      >
                        {criterionOptions.map((criterion) => (
                          <option key={criterion.id} value={criterion.id}>
                            {criterionOptionLabel(criterion)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label className="grid gap-1">
                    <span className="field-label">한 줄 요약</span>
                    <input
                      className="input"
                      value={editDraft.shortSummary}
                      onChange={(event) =>
                        setEditDraft((current) =>
                          current ? { ...current, shortSummary: event.target.value } : current
                        )
                      }
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="field-label">실제 기록 내용</span>
                    <textarea
                      className="input min-h-28"
                      value={editDraft.fullText}
                      onChange={(event) =>
                        setEditDraft((current) =>
                          current ? { ...current, fullText: event.target.value } : current
                        )
                      }
                    />
                  </label>
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      className="inline-flex min-h-10 items-center justify-center rounded-control border border-bread bg-cream px-4 text-[13px] font-semibold text-cocoa transition hover:bg-[#F4E3D8]"
                      onClick={() => void suggestEditing(response.id)}
                    >
                      {suggestingResponseId === response.id ? "AI 분류 중" : "AI 분류하기"}
                    </button>
                    <button
                      type="button"
                      className="inline-flex min-h-10 items-center justify-center rounded-control border border-latte bg-white px-4 text-[13px] font-semibold text-cocoa transition hover:bg-cream"
                      onClick={cancelEditing}
                    >
                      취소
                    </button>
                    <Button type="button" onClick={() => void saveEditing(response.id)}>
                      {savingResponseId === response.id ? "저장 중" : "저장"}
                    </Button>
                    <button
                      type="button"
                      className="inline-flex min-h-10 items-center justify-center rounded-control border border-red/20 bg-white px-4 text-[13px] font-semibold text-red transition hover:bg-red/10"
                      onClick={() => void deleteResponse(response)}
                    >
                      {savingResponseId === response.id ? "삭제 중" : "삭제"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid gap-3 lg:grid-cols-[120px_minmax(180px,260px)_minmax(0,1fr)_auto] lg:items-start">
                  <span className="font-semibold">{response.date}</span>
                  <span className="min-w-0 rounded-control bg-blue/10 px-2 py-1 text-left text-sm font-semibold text-blue sm:text-center">
                    {criterionPathLabel(response.criterionPath)}
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold">{response.shortSummary ?? "요약 없음"}</p>
                    {visibleResponseText(response.fullText) ? (
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted [overflow-wrap:anywhere]">
                        {visibleResponseText(response.fullText)}
                      </p>
                    ) : null}
                    <span className="mt-2 inline-flex rounded-full bg-[#F4E3D8] px-2 py-1 text-[11px] font-bold text-cocoa">
                      {response.llmAssisted ? "AI 분류" : "직원 분류"}
                    </span>
                  </div>
                  <div className="flex shrink-0 gap-2 lg:justify-end">
                    <button
                      type="button"
                      className="inline-flex min-h-10 items-center justify-center rounded-control border border-latte bg-white px-4 text-[13px] font-semibold text-cocoa transition hover:bg-cream"
                      onClick={() => startEditing(response)}
                    >
                      수정
                    </button>
                  </div>
                </div>
              )}
            </article>
          ))}
          {visibleCount < filteredResponses.length ? (
            <button
              type="button"
              className="mx-auto inline-flex min-h-10 items-center justify-center rounded-control border border-latte bg-white px-5 text-[13px] font-semibold text-cocoa transition hover:bg-cream"
              onClick={() => setVisibleCount((current) => current + INITIAL_VISIBLE_RESPONSE_COUNT)}
            >
              더 보기 ({filteredResponses.length - visibleResponses.length}건 남음)
            </button>
          ) : null}
          {!isLoading && responses.length === 0 ? (
            <div className="rounded-control border border-stone-200 px-3 py-6 text-center text-sm font-medium text-muted">
              조회된 고객 반응 없음
            </div>
          ) : null}
          {!isLoading && responses.length > 0 && filteredResponses.length === 0 ? (
            <div className="rounded-control border border-stone-200 px-3 py-6 text-center text-sm font-medium text-muted">
              검색어와 맞는 고객 반응 없음
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
