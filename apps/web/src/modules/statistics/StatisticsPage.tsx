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

type ResponseInsightTopicDto = {
  criterionId: number;
  label: string;
  path: Array<{ id: number; name: string }>;
  count: number;
  ratio: number;
  sampleSummaries: string[];
  items?: Array<{ id: string; date: string; summary: string; text: string }>;
};

type ResponseExecutiveBucketDto = {
  key: string;
  title: string;
  count: number;
  ratio: number;
  summary: string;
  topics: ResponseInsightTopicDto[];
};

type DirectCustomerQuoteDto = {
  id: string;
  date: string;
  text: string;
  summary: string;
  criterionId: number;
  path: Array<{ id: number; name: string }>;
};

type ResponseInsightsDto = {
  headline: string;
  checkNeededCount?: number;
  executiveBuckets?: ResponseExecutiveBucketDto[];
  repeatedTopics: ResponseInsightTopicDto[];
  directQuotes?: DirectCustomerQuoteDto[];
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
    checkNeededCount: 0,
    executiveBuckets: [],
    repeatedTopics: [],
    directQuotes: [],
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
    insights: {
      ...emptyStats.insights,
      ...(data.insights ?? {}),
      directQuotes: data.insights?.directQuotes ?? []
    }
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

function bucketDetailLink(range: DateRange, bucketKey: string): string {
  const params = new URLSearchParams({
    mode: "lookup",
    tab: "detail",
    from: range.from,
    to: range.to,
    insight_bucket: bucketKey
  });

  return `/response?${params.toString()}`;
}

function checkNeededDetailLink(range: DateRange): string {
  const params = new URLSearchParams({
    mode: "lookup",
    tab: "detail",
    from: range.from,
    to: range.to,
    check_needed: "true"
  });

  return `/response?${params.toString()}`;
}

function displayBucketTitle(title: string): string {
  return title === "즉시 확인" ? "주의 신호" : title;
}

function displayHeadline(headline: string): string {
  return headline.replaceAll("즉시 확인을", "주의 신호를").replaceAll("즉시 확인", "주의 신호");
}

function representativeOriginalText(topic: ResponseInsightTopicDto | undefined): string | null {
  const text = topic?.items?.find((item) => item.text.trim().length > 0)?.text.trim();
  return text || null;
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

  const displayTotal = stats.total;
  const displayRepeated = stats.insights.repeatedTopics.slice(0, 5);
  const directQuotes = (stats.insights.directQuotes ?? []).slice(0, 3);
  const displayBuckets = stats.insights.executiveBuckets ?? [];
  const visibleBuckets = displayBuckets.filter(
    (bucket) => bucket.count > 0 || bucket.key !== "serviceRisk"
  );
  const attentionBucket = displayBuckets.find((bucket) => bucket.key === "serviceRisk");
  const topPriorityBuckets = displayBuckets
    .filter((bucket) => bucket.count > 0)
    .sort((left, right) => right.count - left.count)
    .slice(0, 3);
  const checkNeededCount = stats.insights.checkNeededCount ?? 0;
  const maxRepeated = Math.max(...displayRepeated.map((item) => item.count), 1);
  const colors = ["#B5654A", "#3E6EA5", "#B8862B", "#3E7A55", "#B8AEA2"];
  const middleA11y = stats.middle.slice(0, 8);
  const minorA11y = stats.minor.slice(0, 8);
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
        <h2>대표 리포트 접근성 요약</h2>
        <p>{displayHeadline(stats.insights.headline)}</p>
        {stats.insights.repeatedTopics.map((topic) => (
          <Link key={topic.criterionId} to={detailLink(range, topic.criterionId)}>
            {topic.path.map((item) => item.name).join(" > ")} 기록 보기
          </Link>
        ))}
        {middleA11y.map((item) => (
          <p key={`middle-${item.id}`}>
            <span>{item.label}</span> {item.count.toLocaleString("ko-KR")}건 ·{" "}
            {formatPercent(
              item.count,
              stats.major.find((major) => major.id === item.majorCriterionId)?.count ?? stats.total
            )}
          </p>
        ))}
        {minorA11y.map((item) => (
          <p key={`minor-${item.id}`}>
            {item.label} {item.count.toLocaleString("ko-KR")}건 ·{" "}
            {formatPercent(
              item.count,
              stats.middle.find((middle) => middle.id === item.middleCriterionId)?.count ??
                stats.total
            )}
          </p>
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
              onChange={(event) =>
                setRange((current) => ({ ...current, from: event.target.value }))
              }
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

      <div className="flex flex-wrap justify-end gap-[6px]">
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

      {error ? (
        <div className="rounded-[10px] border border-red/20 bg-red/10 px-3 py-2 text-sm font-semibold text-red">
          {error}
        </div>
      ) : null}

      <section className="dc-card-pad">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-3xl">
            <p className="dc-eyebrow">통계 요약</p>
            <h2 className="section-title">대표 리포트</h2>
            <p className="mt-2 text-[15px] font-extrabold leading-7 text-ink">
              {displayHeadline(stats.insights.headline)}
            </p>
            <p className="mt-1 text-xs font-semibold leading-5 text-muted">
              매출 기회, 놓친 매출, 제품 점검, 확인이 필요한 신호를 먼저 판단합니다.
            </p>
            {checkNeededCount > 0 && stats.insights.keyNotes[0] ? (
              <Link
                className="mt-3 inline-flex rounded-full bg-red/10 px-3 py-1 text-xs font-extrabold text-red hover:bg-red/15"
                to={checkNeededDetailLink(range)}
                aria-label={`확인 필요 반응 ${checkNeededCount.toLocaleString("ko-KR")}건 상세 기록 보기`}
              >
                확인 필요 {checkNeededCount.toLocaleString("ko-KR")}건
              </Link>
            ) : null}
            {attentionBucket && attentionBucket.count === 0 ? (
              <span className="mt-3 inline-flex rounded-full bg-green/10 px-3 py-1 text-xs font-extrabold text-green">
                주의 신호 특이사항 없음
              </span>
            ) : null}
          </div>
          <div className="rounded-full bg-cream px-3 py-1 text-xs font-bold text-cocoa">
            {periodLabel} · 총 {displayTotal.toLocaleString("ko-KR")}건
          </div>
        </div>
      </section>

      <section className="dc-card-pad">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="dc-eyebrow">손님이 직접 한 말</p>
            <p className="mt-1 text-xs font-semibold text-muted">
              직원 관찰이나 매출 메모가 아니라 손님 입에서 나온 말만 모았습니다.
            </p>
          </div>
          <span className="rounded-full bg-cream px-3 py-1 text-xs font-bold text-cocoa">
            {directQuotes.length > 0 ? `최대 ${directQuotes.length.toLocaleString("ko-KR")}개` : "직접 발화만"}
          </span>
        </div>
        {directQuotes.length > 0 ? (
          <div className="grid gap-2 md:grid-cols-3">
            {directQuotes.map((quote) => (
              <Link
                key={quote.id}
                className="rounded-[12px] border border-[#F1EAE0] bg-white px-3 py-3 transition hover:bg-cream"
                to={detailLink(range, quote.criterionId)}
                aria-label={`${quote.text} 직접 발화 기록 보기`}
              >
                <p className="truncate text-[13px] font-extrabold text-ink">“{quote.text}”</p>
                <p className="mt-2 truncate text-[11px] font-bold text-muted">
                  {quote.date.slice(5).replace("-", ".")} · {quote.path.map((item) => item.name).join(" > ")}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <p className="rounded-[10px] bg-cream px-3 py-4 text-sm font-semibold text-muted">
            이 기간에는 손님이 직접 한 말로 확인되는 기록이 없습니다.
          </p>
        )}
      </section>

      <section className="dc-card-pad">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="dc-eyebrow">이번 기간 우선순위</p>
            <p className="mt-1 text-xs font-semibold text-muted">
              많이 쌓인 신호부터 바로 확인합니다.
            </p>
          </div>
          <span className="rounded-full bg-cream px-3 py-1 text-xs font-bold text-cocoa">
            상위 {topPriorityBuckets.length.toLocaleString("ko-KR")}개
          </span>
        </div>
        {topPriorityBuckets.length > 0 ? (
          <div className="grid gap-2 md:grid-cols-3">
            {topPriorityBuckets.map((bucket, index) => {
              const topTopic = bucket.topics[0];
              return (
                <Link
                  key={bucket.key}
                  className="rounded-[12px] border border-[#F1EAE0] bg-white px-3 py-3 transition hover:bg-cream"
                  to={bucketDetailLink(range, bucket.key)}
                  aria-label={`${displayBucketTitle(bucket.title)} ${bucket.count.toLocaleString("ko-KR")}건 우선 확인`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-bread px-2 py-0.5 text-[11px] font-extrabold text-white">
                      {index + 1}
                    </span>
                    <span className="text-[11px] font-extrabold text-muted">
                      {bucket.count.toLocaleString("ko-KR")}건
                    </span>
                  </div>
                  <div className="mt-2 text-[13px] font-extrabold text-ink">
                    {displayBucketTitle(bucket.title)}
                  </div>
                  <div className="mt-1 text-[12px] font-semibold leading-5 text-muted">
                    {topTopic ? topTopic.label : "대표 주제 없음"}
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <p className="rounded-[10px] bg-cream px-3 py-4 text-sm font-semibold text-muted">
            조회 기간에 우선 확인할 반응이 없습니다.
          </p>
        )}
      </section>

      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        {visibleBuckets.map((bucket) => (
          <ExecutiveBucketCard
            key={bucket.key}
            bucket={bucket}
            range={range}
            total={displayTotal}
          />
        ))}
      </div>

      <div className="grid gap-[14px]">
        <section className="dc-card-pad">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="dc-eyebrow">많이 반복된 내용 TOP 5</div>
              <p className="mt-1 text-xs font-semibold text-muted">
                같은 이야기가 반복되는 항목만 모았습니다.
              </p>
            </div>
            {stats.insights.checkNeededCount ? (
              <Link
                className="rounded-full bg-red/10 px-3 py-1 text-xs font-extrabold text-red hover:bg-red/15"
                to={checkNeededDetailLink(range)}
                aria-label={`확인 필요 반응 ${stats.insights.checkNeededCount.toLocaleString("ko-KR")}건 상세 기록 보기`}
              >
                확인 필요 {stats.insights.checkNeededCount.toLocaleString("ko-KR")}건
              </Link>
            ) : null}
          </div>
          <div className="grid gap-2">
            {displayRepeated.length > 0 ? (
              displayRepeated.map((topic, index) => (
                <Link
                  key={topic.criterionId}
                  className="block rounded-[10px] border border-[#F1EAE0] px-3 py-2 hover:bg-cream"
                  to={detailLink(range, topic.criterionId)}
                  aria-label={`${topic.path.map((item) => item.name).join(" > ")} 기록 보기`}
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-[12.5px] font-extrabold text-ink">
                      {index + 1}. {topic.path.map((item) => item.name).join(" > ") || topic.label}
                    </span>
                    <span className="text-[11px] font-bold text-muted">
                      {topic.count.toLocaleString("ko-KR")}건
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#F1EAE0]">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(6, Math.round((topic.count / maxRepeated) * 100))}%`,
                        backgroundColor: colors[index % colors.length]
                      }}
                    />
                  </div>
                </Link>
              ))
            ) : (
              <p className="rounded-[10px] bg-cream px-3 py-4 text-sm font-semibold text-muted">
                반복 주제가 쌓이면 여기에 표시됩니다.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function ExecutiveBucketCard({
  bucket,
  range,
  total
}: {
  bucket: ResponseExecutiveBucketDto;
  range: DateRange;
  total: number;
}) {
  const percent = total > 0 ? Math.round((bucket.count / total) * 100) : 0;
  const topTopic = bucket.topics[0];
  const originalText = representativeOriginalText(topTopic);

  return (
    <section className="dc-card-pad">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <div className="text-[11px] font-extrabold text-bread">
            {displayBucketTitle(bucket.title)}
          </div>
          <div className="mt-1 text-[24px] font-extrabold text-ink">
            {bucket.count.toLocaleString("ko-KR")}건
          </div>
        </div>
        <span className="rounded-full bg-cream px-2 py-0.5 text-[11px] font-bold text-cocoa">
          {percent}%
        </span>
      </div>
      <p className="min-h-[38px] text-[11.5px] font-semibold leading-5 text-muted">
        {bucket.summary}
      </p>
      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-[#F1EAE0]"
        aria-label={`${displayBucketTitle(bucket.title)} 비율 ${percent}%`}
      >
        <div
          className="h-full rounded-full bg-bread"
          style={{ width: `${Math.max(percent, bucket.count > 0 ? 5 : 0)}%` }}
        />
      </div>
      {topTopic ? (
        <div className="mt-3 rounded-[10px] bg-cream px-3 py-2">
          <div className="text-[11px] font-extrabold text-cocoa">
            대표 주제 · {topTopic.count.toLocaleString("ko-KR")}건
          </div>
          <div className="mt-0.5 text-[12.5px] font-bold text-ink">{topTopic.label}</div>
          {originalText ? (
            <p className="mt-1 truncate text-[11.5px] font-semibold text-muted">
              “{originalText}”
            </p>
          ) : null}
          <Link
            className="mt-2 inline-flex text-[11px] font-extrabold text-blue hover:underline"
            to={bucketDetailLink(range, bucket.key)}
            aria-label={`${displayBucketTitle(bucket.title)} ${bucket.count.toLocaleString("ko-KR")}건 이 신호 전체 보기`}
          >
            {bucket.count.toLocaleString("ko-KR")}건 이 신호 전체 보기
          </Link>
          <Link
            className="ml-3 mt-2 inline-flex text-[11px] font-extrabold text-cocoa hover:underline"
            to={detailLink(range, topTopic.criterionId)}
            aria-label={`대표 주제 ${topTopic.label} ${topTopic.count.toLocaleString("ko-KR")}건만 보기`}
          >
            대표 주제 {topTopic.count.toLocaleString("ko-KR")}건만 보기
          </Link>
        </div>
      ) : (
        <div className="mt-3 rounded-[10px] bg-cream px-3 py-2 text-[11.5px] font-semibold text-muted">
          아직 대표 주제가 없습니다.
        </div>
      )}
    </section>
  );
}
