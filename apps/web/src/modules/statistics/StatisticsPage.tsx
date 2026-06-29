import { BarChart3, RefreshCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { apiGet } from "../../shared/api/client.js";
import { todayInStoreTime } from "../../shared/time/storeTime.js";
import { Button } from "../../shared/ui/Button.js";


type CriterionStatsDto = {
  criterionId: number | null;
  name: string;
  depth: number | null;
  parentId: number | null;
  count: number;
  ratio?: number | null;
  majorCriterionId?: number;
  middleCriterionId?: number | null;
};

type ResponseStatsDto = {
  from: string;
  to: string;
  total: number;
  major: CriterionStatsDto[];
  middle: CriterionStatsDto[];
  minor: CriterionStatsDto[];
  insights?: ResponseInsightsDto;
};

type ResponseInsightsDto = {
  headline: string;
  repeatedTopics: Array<{
    criterionId: number;
    label: string;
    path: Array<{ id: number; name: string }>;
    count: number;
    ratio: number;
    sampleSummaries: string[];
  }>;
  keyNotes: string[];
};

type ChartItem = {
  id: number;
  label: string;
  count: number;
};

type MajorStats = ChartItem;

type MiddleStats = ChartItem & {
  majorCriterionId: number;
};

type MinorStats = ChartItem & {
  majorCriterionId: number;
  middleCriterionId: number;
};

type NormalizedStats = {
  total: number;
  major: MajorStats[];
  middle: MiddleStats[];
  minor: MinorStats[];
  insights: ResponseInsightsDto;
};

type DateRange = {
  from: string;
  to: string;
};

const emptyStats: NormalizedStats = {
  total: 0,
  major: [],
  middle: [],
  minor: [],
  insights: {
    headline: "조회 기간에 등록된 손님 반응이 없습니다.",
    repeatedTopics: [],
    keyNotes: ["기록이 쌓이면 상위 반복 내용과 주의 사항이 자동으로 표시됩니다."]
  }
};

const chartColors = ["#2563EB", "#15803D", "#D97706", "#8B5A3C", "#DC2626", "#4B5563"];

function parseDateParts(value: string): [number, number, number] {
  const [year = "0", month = "1", day = "1"] = value.split("-");
  return [Number(year), Number(month), Number(day)];
}

function addDays(value: string, days: number): string {
  const [year, month, day] = parseDateParts(value);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function monthRange(value: string, offset: number): DateRange {
  const [year, month] = parseDateParts(value);
  const firstDay = new Date(Date.UTC(year, month - 1 + offset, 1));
  const lastDay = new Date(Date.UTC(year, month + offset, 0));

  return {
    from: firstDay.toISOString().slice(0, 10),
    to: lastDay.toISOString().slice(0, 10)
  };
}

function weekRange(value: string, offset = 0): DateRange {
  const [year, month, day] = parseDateParts(value);
  const base = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = base.getUTCDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(Date.UTC(year, month - 1, day + mondayOffset + offset * 7));
  const sunday = new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate() + 6));

  return {
    from: monday.toISOString().slice(0, 10),
    to: sunday.toISOString().slice(0, 10)
  };
}

function recentThirtyDays(value: string): DateRange {
  return {
    from: addDays(value, -29),
    to: value
  };
}

function formatPercent(count: number, total: number): string {
  if (total <= 0) {
    return "0%";
  }

  return `${Math.round((count / total) * 100)}%`;
}

function normalizeMajor(items: CriterionStatsDto[]): MajorStats[] {
  return items
    .filter(
      (item): item is CriterionStatsDto & { criterionId: number } => item.criterionId !== null
    )
    .map((item) => ({
      id: item.criterionId,
      label: item.name,
      count: Number(item.count) || 0
    }))
    .filter((item) => item.count > 0)
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

function normalizeMiddle(items: CriterionStatsDto[]): MiddleStats[] {
  return items
    .filter(
      (item): item is CriterionStatsDto & { criterionId: number; majorCriterionId: number } =>
        item.criterionId !== null && item.majorCriterionId !== undefined
    )
    .map((item) => ({
      id: item.criterionId,
      majorCriterionId: item.majorCriterionId,
      label: item.name,
      count: Number(item.count) || 0
    }))
    .filter((item) => item.count > 0)
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

function normalizeMinor(items: CriterionStatsDto[]): MinorStats[] {
  return items
    .filter(
      (
        item
      ): item is CriterionStatsDto & {
        criterionId: number;
        majorCriterionId: number;
        middleCriterionId: number;
      } =>
        item.criterionId !== null &&
        item.majorCriterionId !== undefined &&
        item.middleCriterionId !== null &&
        item.middleCriterionId !== undefined
    )
    .map((item) => ({
      id: item.criterionId,
      majorCriterionId: item.majorCriterionId,
      middleCriterionId: item.middleCriterionId,
      label: item.name,
      count: Number(item.count) || 0
    }))
    .filter((item) => item.count > 0)
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

function normalizeStats(data: ResponseStatsDto): NormalizedStats {
  return {
    total: Number(data.total) || 0,
    major: normalizeMajor(data.major ?? []),
    middle: normalizeMiddle(data.middle ?? []),
    minor: normalizeMinor(data.minor ?? []),
    insights: data.insights ?? emptyStats.insights
  };
}

function buildQuery(range: DateRange): string {
  const params = new URLSearchParams({ from: range.from, to: range.to });
  return params.toString();
}

function barWidth(count: number, max: number): string {
  if (max <= 0) {
    return "0%";
  }

  return `${Math.max(4, Math.round((count / max) * 100))}%`;
}

function SelectableBarChart({
  items,
  selectedId,
  total,
  onSelect
}: {
  items: ChartItem[];
  selectedId: number | null;
  total: number;
  onSelect: (id: number) => void;
}) {
  const maxCount = Math.max(...items.map((item) => item.count), 0);

  return (
    <div className="grid gap-3">
      {items.map((item) => {
        const isSelected = item.id === selectedId;

        return (
          <button
            key={item.id}
            className={[
              "grid min-w-0 gap-2 rounded-control border p-3 text-left transition",
              isSelected
                ? "border-stone-900 bg-stone-50"
                : "border-stone-200 bg-white hover:border-stone-400"
            ].join(" ")}
            type="button"
            onClick={() => onSelect(item.id)}
          >
            <div className="flex min-w-0 items-center justify-between gap-3">
              <span className="truncate text-sm font-semibold text-ink">{item.label}</span>
              <span className="shrink-0 text-sm font-semibold text-muted">
                {item.count.toLocaleString("ko-KR")}건 · {formatPercent(item.count, total)}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-stone-100">
              <div
                className="h-full rounded-full bg-blue"
                style={{ width: barWidth(item.count, maxCount) }}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}

function BreakdownBarChart({ items, total }: { items: ChartItem[]; total: number }) {
  const maxCount = Math.max(...items.map((item) => item.count), 0);

  return (
    <div className="grid gap-3">
      {items.map((item, index) => (
        <div key={item.id} className="grid gap-2 rounded-control border border-stone-200 p-3">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <span className="truncate text-sm font-semibold text-ink">{item.label}</span>
            <span className="shrink-0 text-sm font-semibold text-muted">
              {item.count.toLocaleString("ko-KR")}건 · {formatPercent(item.count, total)}
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-stone-100">
            <div
              className="h-full rounded-full"
              style={{
                backgroundColor: chartColors[index % chartColors.length],
                width: barWidth(item.count, maxCount)
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function StatisticsPage() {
  const today = todayInStoreTime();
  const [range, setRange] = useState<DateRange>(monthRange(today, 0));
  const [stats, setStats] = useState<NormalizedStats>(emptyStats);
  const [selectedMajorId, setSelectedMajorId] = useState<number | null>(null);
  const [selectedMiddleId, setSelectedMiddleId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const clearStats = useCallback(() => {
    setStats(emptyStats);
    setSelectedMajorId(null);
    setSelectedMiddleId(null);
  }, []);

  const loadStats = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (!range.from || !range.to) {
      setError("시작일과 종료일을 선택하세요.");
      clearStats();
      setIsLoading(false);
      return;
    }

    if (range.from > range.to) {
      setError("시작일은 종료일보다 늦을 수 없습니다.");
      clearStats();
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const envelope = await apiGet<ResponseStatsDto>(`/response/stats?${buildQuery(range)}`);

      if (requestId !== requestIdRef.current) {
        return;
      }

      if (envelope.error) {
        setError(envelope.error.message);
        clearStats();
        return;
      }

      const nextStats = normalizeStats(envelope.data);
      setStats(nextStats);
      setSelectedMajorId((current) => {
        if (nextStats.major.some((item) => item.id === current)) {
          return current;
        }

        return nextStats.major[0]?.id ?? null;
      });
    } catch (unknownError) {
      if (requestId !== requestIdRef.current) {
        return;
      }

      clearStats();
      setError(
        unknownError instanceof Error ? unknownError.message : "통계를 조회하지 못했습니다."
      );
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [clearStats, range]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const selectedMajor = useMemo(
    () => stats.major.find((item) => item.id === selectedMajorId) ?? null,
    [selectedMajorId, stats.major]
  );
  const middleItems = useMemo(
    () => stats.middle.filter((item) => item.majorCriterionId === selectedMajorId),
    [selectedMajorId, stats.middle]
  );

  useEffect(() => {
    setSelectedMiddleId((current) => {
      if (middleItems.some((item) => item.id === current)) {
        return current;
      }

      return middleItems[0]?.id ?? null;
    });
  }, [middleItems]);

  const selectedMiddle = useMemo(
    () => middleItems.find((item) => item.id === selectedMiddleId) ?? null,
    [middleItems, selectedMiddleId]
  );
  const minorItems = useMemo(
    () => stats.minor.filter((item) => item.middleCriterionId === selectedMiddleId),
    [selectedMiddleId, stats.minor]
  );

  const majorTotal = selectedMajor?.count ?? 0;
  const middleTotal = selectedMiddle?.count ?? 0;

  return (
    <div className="mx-auto grid max-w-7xl gap-4">
      <section className="panel min-w-0">
        <div className="panel-heading">
          <div>
            <p className="text-sm text-muted">조회</p>
            <h2 className="section-title">월별·주별 보고</h2>
          </div>
          <div className="rounded-control bg-stone-100 px-3 py-2 text-sm font-semibold text-stone-700">
            총 {stats.total.toLocaleString("ko-KR")}건
          </div>
        </div>

        {error ? (
          <div className="mb-4 rounded-control border border-red/20 bg-red/10 px-3 py-2 text-sm font-semibold text-red">
            {error}
          </div>
        ) : null}

        <div className="grid gap-3 xl:grid-cols-[1fr_1fr_auto_auto] xl:items-end">
          <label className="grid min-w-0 gap-2">
            <span className="field-label">시작일</span>
            <input
              className="input min-w-0 w-full"
              type="date"
              value={range.from}
              max={range.to || undefined}
              onChange={(event) =>
                setRange((current) => ({ ...current, from: event.target.value }))
              }
            />
          </label>
          <label className="grid min-w-0 gap-2">
            <span className="field-label">종료일</span>
            <input
              className="input min-w-0 w-full"
              type="date"
              value={range.to}
              min={range.from || undefined}
              onChange={(event) => setRange((current) => ({ ...current, to: event.target.value }))}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              className="min-h-11 rounded-control border border-stone-300 bg-white px-3 text-sm font-semibold text-stone-800 hover:bg-stone-100"
              type="button"
              onClick={() => setRange(monthRange(today, 0))}
            >
              이번달
            </button>
            <button
              className="min-h-11 rounded-control border border-stone-300 bg-white px-3 text-sm font-semibold text-stone-800 hover:bg-stone-100"
              type="button"
              onClick={() => setRange(monthRange(today, -1))}
            >
              지난달
            </button>
            <button
              className="min-h-11 rounded-control border border-stone-300 bg-white px-3 text-sm font-semibold text-stone-800 hover:bg-stone-100"
              type="button"
              onClick={() => setRange(weekRange(today, 0))}
            >
              이번주
            </button>
            <button
              className="min-h-11 rounded-control border border-stone-300 bg-white px-3 text-sm font-semibold text-stone-800 hover:bg-stone-100"
              type="button"
              onClick={() => setRange(weekRange(today, -1))}
            >
              지난주
            </button>
            <button
              className="min-h-11 rounded-control border border-stone-300 bg-white px-3 text-sm font-semibold text-stone-800 hover:bg-stone-100"
              type="button"
              onClick={() => setRange(recentThirtyDays(today))}
            >
              최근 30일
            </button>
          </div>
          <Button icon={RefreshCcw} type="button" onClick={() => void loadStats()}>
            {isLoading ? "조회 중" : "조회"}
          </Button>
        </div>
      </section>

      <section className="panel min-w-0 border-cocoa/20 bg-white/95">
        <div className="panel-heading">
          <div>
            <p className="text-sm text-muted">대표님 보고 핵심</p>
            <h2 className="section-title">주요 사항</h2>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
          <div className="rounded-control border border-latte/80 bg-cream/40 p-4">
            <p className="text-lg font-bold text-cocoa">{stats.insights.headline}</p>
            <ul className="mt-3 grid gap-2 text-sm font-semibold text-stone-700">
              {stats.insights.keyNotes.map((note) => (
                <li key={note} className="flex gap-2">
                  <span className="text-cocoa">•</span>
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="grid gap-2">
            <p className="field-label">많이 반복된 내용</p>
            {stats.insights.repeatedTopics.length > 0 ? (
              stats.insights.repeatedTopics.slice(0, 3).map((topic, index) => (
                <div key={topic.criterionId} className="rounded-control border border-stone-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-bold text-ink">
                      {index + 1}. {topic.path.map((item) => item.name).join(" > ")}
                    </span>
                    <span className="shrink-0 text-sm font-bold text-cocoa">
                      {topic.count.toLocaleString("ko-KR")}건 · {formatPercent(topic.count, stats.total)}
                    </span>
                  </div>
                  {topic.sampleSummaries.length > 0 ? (
                    <p className="mt-2 truncate text-sm text-muted">예: {topic.sampleSummaries[0]}</p>
                  ) : null}
                </div>
              ))
            ) : (
              <div className="rounded-control border border-stone-200 px-3 py-6 text-center text-sm font-medium text-muted">
                반복 내용 없음
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(360px,1.1fr)]">
        <section className="panel min-w-0">
          <div className="panel-heading">
            <div>
              <p className="text-sm text-muted">전체 흐름</p>
              <h2 className="section-title">대분류 비율</h2>
            </div>
            <BarChart3 className="h-5 w-5 text-blue" aria-hidden="true" />
          </div>

          {stats.major.length > 0 ? (
            <SelectableBarChart
              items={stats.major}
              selectedId={selectedMajorId}
              total={stats.total}
              onSelect={setSelectedMajorId}
            />
          ) : (
            <div className="rounded-control border border-stone-200 px-3 py-10 text-center text-sm font-medium text-muted">
              조회된 통계 없음
            </div>
          )}
        </section>

        <section className="panel min-w-0">
          <div className="panel-heading">
            <div>
              <p className="text-sm text-muted">{selectedMajor ? selectedMajor.label : "대분류 선택 필요"}</p>
              <h2 className="section-title">선택 분류 상세</h2>
            </div>
            <BarChart3 className="h-5 w-5 text-bread" aria-hidden="true" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <p className="field-label mb-2">중분류</p>
              {middleItems.length > 0 ? (
                <SelectableBarChart
                  items={middleItems}
                  selectedId={selectedMiddleId}
                  total={majorTotal}
                  onSelect={setSelectedMiddleId}
                />
              ) : (
                <div className="rounded-control border border-stone-200 px-3 py-10 text-center text-sm font-medium text-muted">
                  선택한 대분류의 중분류 통계 없음
                </div>
              )}
            </div>
            <div>
              <p className="field-label mb-2">소분류</p>
              {minorItems.length > 0 ? (
                <BreakdownBarChart items={minorItems} total={middleTotal} />
              ) : (
                <div className="rounded-control border border-stone-200 px-3 py-10 text-center text-sm font-medium text-muted">
                  선택한 중분류의 소분류 통계 없음
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
