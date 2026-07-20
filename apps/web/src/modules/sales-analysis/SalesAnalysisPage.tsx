import { useEffect, useMemo, useState } from "react";

import { apiGet } from "../../shared/api/client.js";
import { PageHeader } from "../../shared/ui/PageHeader.js";

const currentYear = new Date().getFullYear();

type MonthlySales = {
  month: string;
  sales: number;
  count: number;
  recordedDays: number;
  hasRecord: boolean;
  averageTicket: number;
  targetAmount: number;
  targetProgressRate: number | null;
  previousSalesChange: number | null;
  previousSalesChangeRate: number | null;
};

type SalesAnalysisDto = {
  year: number;
  totalSales: number;
  totalCount: number;
  recordedDays: number;
  recordedMonths: number;
  averageTicket: number;
  dailyAverageSales: number;
  targetAmount: number;
  targetProgressRate: number | null;
  latestRecordedMonth: {
    month: string;
    sales: number;
    count: number;
    previousSalesChange: number | null;
    previousSalesChangeRate: number | null;
  } | null;
  monthly: MonthlySales[];
  channels: Array<{ name: string; amount: number; count: number; ratio: number }>;
  productTop: Array<{ productName: string; soldQty: number; lossQty: number; tastingQty: number; lossRate: number | null }>;
  lossTop: Array<{ productName: string; soldQty: number; lossQty: number; tastingQty: number; lossRate: number | null }>;
  dataWarnings: string[];
  visual: { maxMonthlySales: number; maxDailySales: number };
};

function money(value: number) {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

function percent(value: number | null | undefined) {
  if (value === null || value === undefined) return "목표 미설정";
  return `${Math.round(value * 100)}%`;
}

function precisePercent(value: number | null | undefined) {
  if (value === null || value === undefined) return "목표 미설정";
  return `${(value * 100).toFixed(1)}%`;
}

function signedMoney(value: number) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${money(value)}`;
}

function monthNumber(month: string) {
  return Number(month.slice(5));
}

function monthLabel(month: string) {
  return `${monthNumber(month)}월`;
}

function comparisonText(item: { previousSalesChange: number | null; previousSalesChangeRate: number | null }) {
  if (item.previousSalesChange === null || item.previousSalesChangeRate === null) {
    return "이전 기록 없음";
  }
  const direction = item.previousSalesChange >= 0 ? "증가" : "감소";
  return `전월 대비 ${signedMoney(item.previousSalesChange)} · ${Math.abs(Math.round(item.previousSalesChangeRate * 100))}% ${direction}`;
}

function targetGapText(sales: number, targetAmount: number) {
  if (targetAmount <= 0) return "목표 미설정";
  const gap = sales - targetAmount;
  if (gap >= 0) return `${money(gap)} 초과`;
  return `${money(Math.abs(gap))} 부족`;
}

function targetStatusClass(progressRate: number | null) {
  if (progressRate === null) return "text-muted";
  if (progressRate >= 1) return "text-green";
  if (progressRate >= 0.8) return "text-bread";
  return "text-cocoa";
}

function progressWidth(progressRate: number | null) {
  if (progressRate === null) return 0;
  return Math.max(2, Math.min(100, Math.round(progressRate * 100)));
}

function summaryText(data: SalesAnalysisDto | null) {
  if (!data || data.recordedDays === 0) {
    return "선택한 연도에 아직 기록된 매출이 없습니다. 일일 운영 기록이 저장되면 이곳에 흐름이 보입니다.";
  }
  const monthRange = data.monthly.filter((item) => item.hasRecord).map((item) => monthNumber(item.month));
  const firstMonth = monthRange[0];
  const lastMonth = monthRange.at(-1);
  const rangeText = firstMonth === lastMonth ? `${firstMonth}월` : `${firstMonth}~${lastMonth}월`;
  const latestText = data.latestRecordedMonth ? `${monthLabel(data.latestRecordedMonth.month)} ${comparisonText(data.latestRecordedMonth)}` : "최근 월 비교 없음";
  return `${rangeText} 매출 기록 ${data.recordedDays}일 기준입니다. 최근 기록월은 ${latestText}입니다.`;
}

function RatioBar({ ratio }: { ratio: number }) {
  const width = Math.max(2, Math.min(100, Math.round(ratio * 100)));
  return (
    <div className="mt-2 h-2 overflow-hidden rounded-full bg-cream">
      <div className="h-full rounded-full bg-bread" style={{ width: `${width}%` }} />
    </div>
  );
}

function TargetProgressBar({ progressRate }: { progressRate: number | null }) {
  return (
    <div className="mt-2 h-2 overflow-hidden rounded-full bg-cream">
      <div className="h-full rounded-full bg-bread" style={{ width: `${progressWidth(progressRate)}%` }} />
    </div>
  );
}

export function SalesAnalysisPage() {
  const [year, setYear] = useState(String(currentYear));
  const [data, setData] = useState<SalesAnalysisDto | null>(null);
  const [error, setError] = useState("");
  const yearOptions = useMemo(() => Array.from({ length: 5 }, (_, index) => String(currentYear - index)), []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError("");
      const envelope = await apiGet<SalesAnalysisDto>(`/sales-analysis/summary?year=${year}`);
      if (cancelled) return;
      if (envelope.error) {
        setError(envelope.error.message);
        return;
      }
      setData(envelope.data);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [year]);

  const maxMonthly = data?.visual.maxMonthlySales ?? 0;
  const latestMonthTarget = data?.latestRecordedMonth ? data.monthly.find((item) => item.month === data.latestRecordedMonth?.month)?.targetAmount ?? 0 : 0;
  const latestTargetGap = data?.latestRecordedMonth ? targetGapText(data.latestRecordedMonth.sales, latestMonthTarget) : "목표 미설정";

  return (
    <div className="mx-auto grid max-w-7xl gap-4">
      <section className="app-card">
        <PageHeader
          title="매출 분석"
          description="POS와 POS 외 일일 운영 기록으로 매출 흐름을 확인합니다."
          actions={<div className="flex flex-wrap items-end gap-2">
            <a className="inline-flex min-h-11 items-center rounded-control bg-bread px-4 text-sm font-extrabold text-white transition hover:bg-cocoa focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bread/30 motion-reduce:transition-none" href={`/staff?tab=notice&goal=sales&year=${year}`}>
              월별 목표 입력하러 가기
            </a>
            <label className="grid gap-1">
              <span className="field-label">분석 년도</span>
              <select className="input min-w-32" value={year} onChange={(event) => setYear(event.target.value)} aria-label="분석 년도">
                {yearOptions.map((option) => <option key={option} value={option}>{option}년</option>)}
              </select>
            </label>
          </div>}
        />
        {error ? <p className="mt-3 rounded-control bg-red/10 px-3 py-2 text-sm font-bold text-red">{error}</p> : null}
        <div className="mt-4 rounded-[12px] border border-latte bg-cream/40 px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-cocoa">현장 요약</p>
          <p className="mt-1 text-sm font-bold text-ink">{summaryText(data)}</p>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-6" role="group" aria-label="연간 매출 핵심 지표">
          <div className="dc-card px-4 py-3"><p className="text-xs text-muted">연간 매출</p><p className="mt-1 text-xl font-extrabold text-ink">{money(data?.totalSales ?? 0)}</p></div>
          <div className="dc-card px-4 py-3"><p className="text-xs text-muted">등록된 목표 합계</p><p className="mt-1 text-xl font-extrabold text-ink">{data && data.targetAmount > 0 ? money(data.targetAmount) : "목표 미설정"}</p></div>
          <div className="dc-card px-4 py-3"><p className="text-xs text-muted">매출 건수</p><p className="mt-1 text-xl font-extrabold text-ink">{(data?.totalCount ?? 0).toLocaleString("ko-KR")}건</p></div>
          <div className="dc-card px-4 py-3"><p className="text-xs text-muted">객단가</p><p className="mt-1 text-xl font-extrabold text-ink">{money(data?.averageTicket ?? 0)}</p></div>
          <div className="dc-card px-4 py-3"><p className="text-xs text-muted">기록일 평균</p><p className="mt-1 text-xl font-extrabold text-ink">{money(data?.dailyAverageSales ?? 0)}</p><p className="mt-1 text-xs text-muted">기록 {(data?.recordedDays ?? 0).toLocaleString("ko-KR")}일 기준</p></div>
          <div className="dc-card px-4 py-3"><p className="text-xs text-muted">전체 달성률</p><p className={`mt-1 text-xl font-extrabold ${targetStatusClass(data?.targetProgressRate ?? null)}`}>{percent(data?.targetProgressRate)}</p><TargetProgressBar progressRate={data?.targetProgressRate ?? null} /></div>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="rounded-[12px] border border-latte bg-cream/30 px-4 py-3">
            <p className="text-xs text-muted">최근 기록월 목표 차이</p>
            <p className="mt-1 text-lg font-extrabold text-ink">{latestTargetGap}</p>
          </div>
          <div className="rounded-[12px] border border-latte bg-cream/30 px-4 py-3">
            <p className="text-xs text-muted">목표 입력 위치</p>
            <p className="mt-1 text-sm font-bold text-cocoa">관리 &gt; 홈 공지/목표 관리에서 월별 목표액을 입력합니다.</p>
          </div>
          <div className="rounded-[12px] border border-latte bg-cream/30 px-4 py-3">
            <p className="text-xs text-muted">달성률 기준</p>
            <p className="mt-1 text-sm font-bold text-cocoa">100% 이상 초과, 80~99% 근접, 80% 미만 점검으로 봅니다.</p>
          </div>
        </div>
      </section>

      <section className="app-card">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h3 className="text-base font-extrabold text-ink">월별 목표 달성 흐름</h3>
          <p className="text-xs text-muted">매출과 목표액, 달성률, 부족/초과 금액을 같이 봅니다.</p>
        </div>
        <div className="mt-4 grid gap-2">
          {(data?.monthly ?? []).map((item) => {
            const width = maxMonthly > 0 && item.hasRecord ? Math.max(2, Math.round((item.sales / maxMonthly) * 100)) : 0;
            return (
              <div key={item.month} className={`grid gap-2 rounded-[12px] px-2 py-2 sm:grid-cols-[5rem_minmax(0,1fr)_18rem] sm:items-center ${item.hasRecord ? "" : "opacity-45"}`}>
                <p className="text-sm font-bold text-cocoa">{monthNumber(item.month)}월</p>
                <div>
                  <div className="h-8 overflow-hidden rounded-full bg-cream">
                    <div className="flex h-full items-center rounded-full bg-bread px-3 text-xs font-bold text-white" style={{ width: `${width}%` }}>
                      {item.hasRecord ? money(item.sales) : ""}
                    </div>
                  </div>
                  {item.targetAmount > 0 ? (
                    <p className="mt-1 text-xs font-bold text-muted">목표 {money(item.targetAmount)} · 달성률 <span className={targetStatusClass(item.targetProgressRate)}>{precisePercent(item.targetProgressRate)}</span> · {targetGapText(item.sales, item.targetAmount)}</p>
                  ) : (
                    <p className="mt-1 text-xs font-bold text-muted">월 목표 미설정</p>
                  )}
                </div>
                <p className="text-right text-xs font-bold text-muted">
                  {item.hasRecord ? `${item.count.toLocaleString("ko-KR")}건 · 객단가 ${money(item.averageTicket)} · ${comparisonText(item)}` : "기록 없음"}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="app-card">
          <h3 className="text-base font-extrabold text-ink">채널별 매출 비중</h3>
          <div className="mt-3 grid gap-2">
            {(data?.channels ?? []).map((channel) => (
              <div key={channel.name} className="rounded-[9px] bg-cream/60 px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <b>{channel.name}</b>
                  <span className="font-bold text-cocoa">{Math.round(channel.ratio * 100)}%</span>
                </div>
                <p className="mt-1 text-xs text-muted">{money(channel.amount)} · {channel.count.toLocaleString("ko-KR")}건</p>
                <RatioBar ratio={channel.ratio} />
              </div>
            ))}
          </div>
        </section>
        <section className="app-card">
          <h3 className="text-base font-extrabold text-ink">많이 팔린 제품</h3>
          <div className="mt-3 grid gap-2">
            {(data?.productTop ?? []).slice(0, 5).map((product) => <p key={product.productName} className="rounded-[9px] bg-cream/60 px-3 py-2 text-sm"><b>{product.productName}</b> · 판매 {product.soldQty.toLocaleString("ko-KR")}개 · 손실 {product.lossQty.toLocaleString("ko-KR")}개 · 시식 {product.tastingQty.toLocaleString("ko-KR")}개</p>)}
          </div>
        </section>
        <section className="app-card">
          <h3 className="text-base font-extrabold text-ink">손실 점검 제품</h3>
          <div className="mt-3 grid gap-2">
            {(data?.lossTop ?? []).slice(0, 5).map((product) => <p key={product.productName} className="rounded-[9px] bg-cream/60 px-3 py-2 text-sm"><b>{product.productName}</b> · 손실 {product.lossQty.toLocaleString("ko-KR")}개 · 손실률 {product.lossRate === null ? "계산 없음" : `${Math.round(product.lossRate * 100)}%`}</p>)}
          </div>
        </section>
      </div>

      {(data?.dataWarnings.length ?? 0) > 0 ? (
        <section className="app-card">
          <h3 className="text-base font-extrabold text-ink">데이터 정리 필요</h3>
          <p className="mt-1 text-sm text-muted">분석 화면에서 임의로 고치지는 않고, 관리/일일 운영 기록에서 확인할 후보만 보여줍니다.</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {data?.dataWarnings.map((warning) => <p key={warning} className="rounded-[9px] bg-cream/60 px-3 py-2 text-sm font-bold text-cocoa">{warning}</p>)}
          </div>
        </section>
      ) : null}
    </div>
  );
}
