import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { apiGet } from "../../shared/api/client.js";
import { todayInStoreTime } from "../../shared/time/storeTime.js";

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
  daily?: Array<{ date: string; count: number }>;
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
  daily: Array<{ date: string; count: number }>;
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
  daily: [],
  insights: {
    headline: "조회 기간에 등록된 손님 반응이 없습니다.",
    repeatedTopics: [],
    keyNotes: ["기록이 쌓이면 상위 반복 내용과 주의 사항이 자동으로 표시됩니다."]
  }
};


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

function monthLabel(range: DateRange): string | null {
  const [fromYear, fromMonth, fromDay] = parseDateParts(range.from);
  const [toYear, toMonth] = parseDateParts(range.to);
  const expected = monthRange(`${fromYear}-${String(fromMonth).padStart(2, "0")}-01`, 0);

  if (
    fromYear === toYear &&
    fromMonth === toMonth &&
    fromDay === 1 &&
    range.from === expected.from &&
    range.to === expected.to
  ) {
    return `${fromYear}년 ${fromMonth}월`;
  }

  return null;
}

function weekRange(value: string, offset = 0): DateRange {
  const [year, month, day] = parseDateParts(value);
  const base = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = base.getUTCDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(Date.UTC(year, month - 1, day + mondayOffset + offset * 7));
  const sunday = new Date(
    Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate() + 6)
  );

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
    daily: (data.daily ?? []).map((item) => ({ date: item.date, count: Number(item.count) || 0 })),
    insights: data.insights ?? emptyStats.insights
  };
}

function buildQuery(range: DateRange): string {
  const params = new URLSearchParams({ from: range.from, to: range.to });
  return params.toString();
}

function detailLink(range: DateRange, criterionId: number): string {
  const params = new URLSearchParams({
    mode: "lookup",
    tab: "detail",
    from: range.from,
    to: range.to,
    criterion_id: criterionId.toString()
  });

  return `/response?${params.toString()}`;
}


export function StatisticsPage() {
  const today = todayInStoreTime();
  const [range, setRange] = useState<DateRange>(recentThirtyDays(today));
  const [stats, setStats] = useState<NormalizedStats>(emptyStats);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const clearStats = useCallback(() => {
    setStats(emptyStats);
  }, []);

  const loadStats = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    if (!range.from || !range.to || range.from > range.to) {
      setError("조회 기간을 확인하세요.");
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

      setStats(normalizeStats(envelope.data));
    } catch (unknownError) {
      if (requestId !== requestIdRef.current) {
        return;
      }

      clearStats();
      setError(unknownError instanceof Error ? unknownError.message : "통계를 조회하지 못했습니다.");
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [clearStats, range]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const displayTotal = stats.total;
  const displayMajor = stats.major.slice(0, 5);
  const displayRepeated = stats.insights.repeatedTopics.slice(0, 4);
  const colors = ["#B5654A", "#3E6EA5", "#B8862B", "#3E7A55", "#B8AEA2"];
  const donutStops = displayMajor.reduce<{ cursor: number; stops: string[] }>((acc, item, index) => {
    const pct = displayTotal > 0 ? (item.count / displayTotal) * 100 : 0;
    const next = acc.cursor + pct;
    acc.stops.push(`${colors[index % colors.length]} ${acc.cursor}% ${next}%`);
    return { cursor: next, stops: acc.stops };
  }, { cursor: 0, stops: [] }).stops.join(", ");
  const maxMajor = Math.max(...displayMajor.map((item) => item.count), 1);
  const middleA11y = stats.middle.slice(0, 8);
  const minorA11y = stats.minor.slice(0, 8);
  const dailyTrend = stats.daily.slice(-31).map((item) => {
    const [, month = "0", day = "0"] = item.date.split("-");
    return {
      ...item,
      label: `${Number(month)}/${Number(day)}`
    };
  });
  const maxDaily = Math.max(...dailyTrend.map((item) => item.count), 1);
  const selectedMonthLabel = monthLabel(range);
  const periodLabel =
    selectedMonthLabel ??
    (range.from === recentThirtyDays(today).from && range.to === recentThirtyDays(today).to
      ? "최근 30일"
      : `${range.from.replaceAll("-", ".")} ~ ${range.to.replaceAll("-", ".")}`);
  const periodOptions: Array<{ label: string; range: DateRange }> = [
    { label: "이번달", range: monthRange(today, 0) },
    { label: "지난달", range: monthRange(today, -1) },
    { label: "이번주", range: weekRange(today, 0) },
    { label: "지난주", range: weekRange(today, -1) },
    { label: "최근 30일", range: recentThirtyDays(today) }
  ];
  const monthOptions = Array.from({ length: 6 }, (_, index) => {
    const optionRange = monthRange(today, -index);
    return {
      label: monthLabel(optionRange) ?? optionRange.from.slice(0, 7),
      range: optionRange
    };
  });

  return (
    <div className="grid gap-[14px]">
      <section className="sr-only">
        <h2>주요 사항</h2>
        <p>{stats.insights.headline}</p>
        {stats.insights.repeatedTopics.map((topic) => (
          <Link key={topic.criterionId} to={detailLink(range, topic.criterionId)}>
            {topic.path.map((item) => item.name).join(" > ")} 기록 보기
          </Link>
        ))}
        {middleA11y.map((item) => (
          <p key={`middle-${item.id}`}><span>{item.label}</span> {item.count.toLocaleString("ko-KR")}건 · {formatPercent(item.count, stats.major.find((major) => major.id === item.majorCriterionId)?.count ?? stats.total)}</p>
        ))}
        {minorA11y.map((item) => (
          <p key={`minor-${item.id}`}>{item.label} {item.count.toLocaleString("ko-KR")}건 · {formatPercent(item.count, stats.middle.find((middle) => middle.id === item.middleCriterionId)?.count ?? stats.total)}</p>
        ))}
      </section>
      <div className="flex items-center justify-between gap-3">
        <div className="text-[12px] text-muted">
          기준 기간: <span className="font-bold text-ink">{periodLabel}</span>
          {isLoading ? <span className="ml-2 text-cocoa">조회 중</span> : null}
        </div>
        <div className="flex flex-wrap justify-end gap-[6px]">
          <label className="grid gap-1 text-[11px] font-semibold text-muted">
            시작 날짜
            <input
              className="rounded-control border border-latte bg-white px-2 py-1 text-cocoa"
              aria-label="반응 분석 시작 날짜"
              type="date"
              value={range.from}
              onChange={(event) => setRange((current) => ({ ...current, from: event.target.value }))}
            />
          </label>
          <label className="grid gap-1 text-[11px] font-semibold text-muted">
            종료 날짜
            <input
              className="rounded-control border border-latte bg-white px-2 py-1 text-cocoa"
              aria-label="반응 분석 종료 날짜"
              type="date"
              value={range.to}
              onChange={(event) => setRange((current) => ({ ...current, to: event.target.value }))}
            />
          </label>
          {periodOptions.map((option) => {
            const isActive = range.from === option.range.from && range.to === option.range.to;
            return (
              <button
                key={option.label}
                className={[
                  "rounded-full border border-latte px-[13px] py-[6px] text-[11.5px] font-semibold transition",
                  isActive ? "bg-bread text-white" : "bg-white text-cocoa hover:bg-cream"
                ].join(" ")}
                type="button"
                onClick={() => setRange(option.range)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <section className="rounded-[14px] border border-latte bg-white px-4 py-3">
        <div className="mb-2">
          <p className="text-xs font-extrabold text-bread">월별 빠른 조회</p>
          <p className="mt-1 text-[11.5px] font-semibold text-muted">한 달 단위로 손님 반응 흐름과 반복 주제를 바로 비교합니다.</p>
        </div>
        <div className="flex flex-wrap gap-[6px]">
          {monthOptions.map((option) => {
            const isActive = range.from === option.range.from && range.to === option.range.to;
            return (
              <button
                key={option.label}
                className={[
                  "rounded-full border border-latte px-[13px] py-[7px] text-[12px] font-bold transition",
                  isActive ? "bg-cocoa text-white" : "bg-cream text-cocoa hover:bg-[#F4E3D8]"
                ].join(" ")}
                type="button"
                aria-pressed={isActive}
                onClick={() => setRange(option.range)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </section>

      {error ? (
        <div className="rounded-[10px] border border-red/20 bg-red/10 px-3 py-2 text-sm font-semibold text-red">{error}</div>
      ) : null}

      <section className="rounded-[14px] border border-latte bg-white px-4 py-3">
        <p className="text-xs font-extrabold text-bread">현장 요약</p>
        <p className="mt-1 text-sm font-bold leading-6 text-ink">{stats.insights.headline}</p>
        {stats.insights.keyNotes.length > 0 ? (
          <p className="mt-1 text-xs font-semibold leading-5 text-muted">{stats.insights.keyNotes[0]}</p>
        ) : null}
      </section>

      <div className="grid gap-3 md:grid-cols-4">
        <MetricCard label="총 반응 건수" value={`${displayTotal}건`} />
        <MetricCard label="분류된 반응" value={`${displayTotal}건`} />
        <MetricCard label="반복 주제" value={`${displayRepeated.length}건`} />
        <MetricCard label="확인 필요" value={displayTotal === 0 ? "0건" : `${stats.insights.keyNotes.length}건`} danger={stats.insights.keyNotes.length > 0} />
      </div>

      <div className="grid gap-[14px] lg:grid-cols-2">
        <section className="dc-card-pad flex items-center gap-5">
          <div
            className="grid h-[104px] w-[104px] shrink-0 place-items-center rounded-full"
            style={{ background: `conic-gradient(${donutStops || "#E9E1D3 0 100%"})` }}
          >
            <div className="grid h-[62px] w-[62px] place-items-center rounded-full bg-white text-center">
              <div>
                <div className="text-[15px] font-extrabold text-ink">{displayTotal}</div>
                <div className="text-[9px] text-muted">총 건수</div>
              </div>
            </div>
          </div>
          <div className="grid flex-1 gap-[6px]">
            {displayMajor.map((item, index) => (
              <div key={item.id} className="flex items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />
                <span className="flex-1 text-[11.5px] text-ink">{item.label}</span>
                <span className="text-[11px] text-muted">{item.count}건 · {formatPercent(item.count, displayTotal)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="dc-card-pad">
          <div className="dc-eyebrow mb-[6px]">선택 기간 일별 추이</div>
          <p className="mb-[12px] text-[11.5px] font-semibold leading-5 text-muted">
            조회 기간 안에서 날짜별로 등록된 손님 반응 건수를 보여줍니다. 막대가 높을수록 그날 기록된 반응이 많습니다.
          </p>
          <div className="flex h-[88px] items-end gap-[4px] overflow-hidden">
            {dailyTrend.length > 0 ? dailyTrend.map((item) => (
              <div key={item.date} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-[6px]">
                <div className="text-[11px] font-bold text-ink">{item.count}</div>
                <div
                  className="w-full max-w-[16px] rounded-t-[5px] bg-bread"
                  style={{ height: `${Math.max(4, Math.round((item.count / maxDaily) * 100))}%` }}
                />
                <div className="truncate text-[9px] text-muted">{item.label}</div>
              </div>
            )) : (
              <div className="grid h-full flex-1 place-items-center rounded-[10px] bg-cream text-xs font-semibold text-muted">
                날짜별 반응 없음
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-[14px] lg:grid-cols-2">
        <section className="dc-card-pad">
          <div className="dc-eyebrow mb-[14px]">대분류별 통계</div>
          <div className="grid gap-2">
            {displayMajor.map((item, index) => (
              <Link key={item.id} className="block rounded-[8px] px-2 py-1.5 hover:bg-cream" to={detailLink(range, item.id)} aria-label={`${item.label} 전체 기록 보기`}>
                <div className="mb-[5px] flex justify-between">
                  <span className="text-[12.5px] font-semibold text-ink">{item.label}</span>
                  <span className="text-[11.5px] text-muted">{item.count}건</span>
                </div>
                <div className="h-2 overflow-hidden rounded bg-[#F1EAE0]">
                  <div
                    className="h-full rounded"
                    style={{ width: `${Math.max(4, Math.round((item.count / maxMajor) * 100))}%`, backgroundColor: colors[index % colors.length] }}
                  />
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="dc-card-pad">
          <div className="dc-eyebrow mb-3">반복 주제</div>
          {displayRepeated.map((topic, index) => (
            <Link key={topic.criterionId} className="flex items-start gap-[10px] border-b border-[#F1EAE0] py-[9px] hover:bg-cream last:border-b-0" to={detailLink(range, topic.criterionId)} aria-label={`${topic.path.map((item) => item.name).join(" > ")} 기록 보기`}>
              <span className="mt-1.5 h-[7px] w-[7px] shrink-0 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />
              <div className="flex-1">
                <div className="text-[12.5px] font-semibold text-ink">
                  {topic.label} <span className="font-normal text-muted">· {topic.count}건</span>
                </div>
                <div className="mt-0.5 text-[11.5px] text-muted">예시: “{topic.sampleSummaries[0] ?? "기록 없음"}”</div>
              </div>
            </Link>
          ))}
        </section>
      </div>

      <section className="dc-card-pad">
        <div className="dc-eyebrow mb-3">상세 내용 바로 열기</div>
        {displayRepeated.map((topic) => (
          <Link key={`detail-${topic.criterionId}`} className="block border-b border-[#F1EAE0] py-[10px] hover:bg-cream last:border-b-0" to={detailLink(range, topic.criterionId)}>
            <div className="mb-1 flex justify-between">
              <span className="text-[11px] text-muted">{range.to.slice(5).replace("-", ".")} · {topic.path.map((item) => item.name).join(" > ")}</span>
              <span className="rounded-full bg-[#F4E3D8] px-2 py-0.5 text-[10px] font-semibold text-cocoa">전체 보기</span>
            </div>
            <div className="text-[13px] text-ink">{topic.sampleSummaries[0] ?? topic.label}</div>
          </Link>
        ))}
      </section>
    </div>
  );
}

function MetricCard({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <section className="dc-card-pad">
      <div className="mb-[6px] text-[11px] text-muted">{label}</div>
      <div className={["text-[19px] font-bold", danger ? "text-red" : "text-ink"].join(" ")}>{value}</div>
    </section>
  );
}
