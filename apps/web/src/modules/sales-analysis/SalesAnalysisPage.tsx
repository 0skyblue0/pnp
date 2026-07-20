import { useEffect, useMemo, useState } from "react";

import { apiGet } from "../../shared/api/client.js";
import { PageHeader } from "../../shared/ui/PageHeader.js";

const currentYear = new Date().getFullYear();

type MonthlySales = {
  month: string; sales: number; count: number; recordedDays: number; hasRecord: boolean;
  averageTicket: number; targetAmount: number; targetProgressRate: number | null;
  previousSalesChange: number | null; previousSalesChangeRate: number | null;
};
type SalesAnalysisDto = {
  year: number; totalSales: number; totalCount: number; recordedDays: number; recordedMonths: number;
  averageTicket: number; dailyAverageSales: number; targetAmount: number; targetProgressRate: number | null;
  latestRecordedMonth: { month: string; sales: number; count: number; previousSalesChange: number | null; previousSalesChangeRate: number | null } | null;
  monthly: MonthlySales[]; channels: Array<{ name: string; amount: number; count: number; ratio: number }>;
  productTop: Array<{ productName: string; soldQty: number; lossQty: number; tastingQty: number; lossRate: number | null }>;
  lossTop: Array<{ productName: string; soldQty: number; lossQty: number; tastingQty: number; lossRate: number | null }>;
  dataWarnings: string[]; visual: { maxMonthlySales: number; maxDailySales: number };
};

const money = (value: number) => `${Math.round(value).toLocaleString("ko-KR")}원`;
const monthNumber = (month: string) => Number(month.slice(5));
const monthLabel = (month: string) => `${monthNumber(month)}월`;
const percent = (value: number | null | undefined) => value === null || value === undefined ? "목표 미설정" : `${Math.round(value * 100)}%`;
const precisePercent = (value: number | null | undefined) => value === null || value === undefined ? "목표 미설정" : `${(value * 100).toFixed(1)}%`;
const signedMoney = (value: number) => `${value > 0 ? "+" : ""}${money(value)}`;
function comparisonText(item: Pick<MonthlySales, "previousSalesChange" | "previousSalesChangeRate">) {
  if (item.previousSalesChange === null || item.previousSalesChangeRate === null) return "이전 기록 없음";
  return `전월 대비 ${signedMoney(item.previousSalesChange)} · ${Math.abs(Math.round(item.previousSalesChangeRate * 100))}% ${item.previousSalesChange >= 0 ? "증가" : "감소"}`;
}
function targetGapText(sales: number, targetAmount: number) {
  if (targetAmount <= 0) return "목표 미설정";
  const gap = sales - targetAmount;
  return gap >= 0 ? `${money(gap)} 초과` : `${money(Math.abs(gap))} 부족`;
}
function targetStatusClass(progressRate: number | null) {
  if (progressRate === null) return "text-muted";
  if (progressRate >= 1) return "text-green";
  if (progressRate >= .8) return "text-bread";
  return "text-cocoa";
}
function summaryText(data: SalesAnalysisDto | null) {
  if (!data || data.recordedDays === 0) return "선택한 연도에 아직 기록된 매출이 없습니다. 일일 운영 기록이 저장되면 이곳에 흐름이 보입니다.";
  const months = data.monthly.filter((item) => item.hasRecord).map((item) => monthNumber(item.month));
  const range = months[0] === months.at(-1) ? `${months[0]}월` : `${months[0]}~${months.at(-1)}월`;
  return `${range} 매출 기록 ${data.recordedDays}일 기준입니다. 최근 기록월은 ${data.latestRecordedMonth ? `${monthLabel(data.latestRecordedMonth.month)} ${comparisonText(data.latestRecordedMonth)}` : "없음"}입니다.`;
}

function RatioBar({ ratio }: { ratio: number }) {
  return <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--ref-gold-soft)]"><div className="h-full rounded-full bg-bread" style={{ width: `${Math.max(2, Math.min(100, Math.round(ratio * 100)))}%` }} /></div>;
}

export function SalesAnalysisPage() {
  const [year, setYear] = useState(String(currentYear));
  const [data, setData] = useState<SalesAnalysisDto | null>(null);
  const [error, setError] = useState("");
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const yearOptions = useMemo(() => Array.from({ length: 5 }, (_, index) => String(currentYear - index)), []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError("");
      const envelope = await apiGet<SalesAnalysisDto>(`/sales-analysis/summary?year=${year}`);
      if (cancelled) return;
      if (envelope.error) { setError(envelope.error.message); return; }
      setData(envelope.data);
      setSelectedMonth((previous) => previous && envelope.data.monthly.some((item) => item.month === previous) ? previous : envelope.data.latestRecordedMonth?.month ?? envelope.data.monthly[0]?.month ?? null);
    }
    void load();
    return () => { cancelled = true; };
  }, [year]);

  const monthly = data?.monthly ?? [];
  const selected = monthly.find((item) => item.month === selectedMonth) ?? monthly[0];
  const maxMonthly = Math.max(data?.visual.maxMonthlySales ?? 0, ...monthly.map((item) => item.targetAmount));
  const latestTarget = data?.latestRecordedMonth ? monthly.find((item) => item.month === data.latestRecordedMonth?.month)?.targetAmount ?? 0 : 0;

  return (
    <div className="mx-auto grid max-w-[1240px] gap-3 pb-6">
      <section className="ref-card !p-0">
        <PageHeader title="매출 분석" description={data ? `${data.year}년 월별 매출과 목표 흐름` : "POS와 POS 외 일일 운영 기록으로 매출 흐름을 확인합니다."} actions={<div className="flex flex-wrap items-end gap-2"><label className="grid gap-1"><span className="field-label">분석 년도</span><select className="ref-filter-control min-w-28 text-sm font-semibold" value={year} onChange={(event) => setYear(event.target.value)} aria-label="분석 년도">{yearOptions.map((option) => <option key={option} value={option}>{option}년</option>)}</select></label><a className="ref-primary-action inline-flex items-center" href={`/staff?tab=notice&goal=sales&year=${year}`}>월별 목표 입력하러 가기</a></div>} />
        <div className="px-4 pb-4 sm:px-5">
          {error ? <p className="mt-3 rounded-control bg-red/10 px-3 py-2 text-sm font-bold text-red" role="status">{error}</p> : null}
          <div className="mt-3 rounded-control border border-[var(--ref-gold-soft)] bg-[var(--ref-gold-wash)] px-3 py-2"><p className="text-[11px] font-bold text-[var(--ref-gold-strong)]">현장 요약</p><p className="mt-1 text-xs font-semibold text-[var(--ref-text-secondary)]">{summaryText(data)}</p></div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-6" role="group" aria-label="연간 매출 핵심 지표">
            <Kpi label="연간 매출" value={money(data?.totalSales ?? 0)} />
            <Kpi label="등록된 목표 합계" value={data && data.targetAmount > 0 ? money(data.targetAmount) : "목표 미설정"} />
            <Kpi label="매출 건수" value={`${(data?.totalCount ?? 0).toLocaleString("ko-KR")}건`} />
            <Kpi label="객단가" value={money(data?.averageTicket ?? 0)} />
            <Kpi label="기록일 평균" value={money(data?.dailyAverageSales ?? 0)} meta={`기록 ${(data?.recordedDays ?? 0).toLocaleString("ko-KR")}일 기준`} />
            <Kpi label="전체 달성률" value={percent(data?.targetProgressRate)} className={targetStatusClass(data?.targetProgressRate ?? null)} />
          </div>
        </div>
      </section>

      <section className="ref-card" aria-label="매출 비교 시각화">
        <div className="flex flex-wrap items-end justify-between gap-2"><div><h2 className="text-[15px] font-extrabold text-ink">월별 매출 비교</h2><p className="mt-1 text-xs text-muted">골드 막대는 실제 매출, 가는 선은 등록된 월 목표입니다.</p></div><p className="text-xs font-semibold text-muted">선택: {selected ? monthLabel(selected.month) : "기록 없음"}</p></div>
        <div className="mt-4 grid grid-cols-6 gap-x-1 gap-y-3 sm:grid-cols-12" role="list" aria-label="월별 매출 막대">
          {monthly.map((item) => {
            const salesHeight = maxMonthly > 0 && item.hasRecord ? Math.max(6, Math.round(item.sales / maxMonthly * 108)) : 3;
            const targetHeight = maxMonthly > 0 && item.targetAmount > 0 ? Math.max(3, Math.round(item.targetAmount / maxMonthly * 108)) : 0;
            const isSelected = selected?.month === item.month;
            return <div key={item.month} role="listitem"><button type="button" aria-pressed={isSelected} aria-label={`${monthLabel(item.month)} ${item.hasRecord ? `매출 ${money(item.sales)}` : "기록 없음"}`} onClick={() => setSelectedMonth(item.month)} className={`group relative flex min-h-36 w-full flex-col justify-end rounded-control px-1 pb-1 text-center transition hover:bg-[var(--ref-gold-wash)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bread/40 motion-reduce:transition-none ${isSelected ? "bg-[var(--ref-gold-wash)]" : ""}`}>
              <span className="relative mx-auto flex h-28 w-full max-w-10 items-end justify-center border-b border-[var(--ref-line)]"><span className="absolute bottom-0 w-full rounded-t-sm bg-bread/85" style={{ height: `${salesHeight}px` }} /><span className="absolute bottom-0 z-10 w-[calc(100%+4px)] border-t-2 border-[var(--ref-cocoa)]" style={{ bottom: `${targetHeight}px`, visibility: targetHeight ? "visible" : "hidden" }} /></span><span className={`mt-1 text-[11px] font-bold ${isSelected ? "text-bread" : "text-muted"}`}>{monthNumber(item.month)}월</span>
            </button></div>;
          })}
        </div>
        {selected ? <div className="mt-3 grid gap-2 rounded-control border border-[var(--ref-line)] bg-[var(--ref-table-head)] px-3 py-2 text-xs sm:grid-cols-3"><p><b className="text-ink">{monthLabel(selected.month)} 매출</b> {selected.hasRecord ? money(selected.sales) : "기록 없음"}</p><p>목표 {selected.targetAmount > 0 ? money(selected.targetAmount) : "미설정"} · <span className={targetStatusClass(selected.targetProgressRate)}>{precisePercent(selected.targetProgressRate)}</span></p><p className="text-muted">{comparisonText(selected)}</p></div> : null}
      </section>

      <section className="ref-card" aria-label="월별 상세">
        <div className="flex flex-wrap items-end justify-between gap-2"><div><h2 className="text-[15px] font-extrabold text-ink">월별 상세</h2><p className="mt-1 text-xs text-muted">목표, 실제 매출, 건수와 객단가를 한 행에서 확인합니다.</p></div><p className="text-xs text-muted">최근 기록월 목표 차이: <b className="text-ink">{data?.latestRecordedMonth ? targetGapText(data.latestRecordedMonth.sales, latestTarget) : "목표 미설정"}</b></p></div>
        <div className="mt-3 hidden overflow-x-auto md:block"><div className="min-w-[760px]"><div className="grid grid-cols-[64px_1fr_1fr_76px_88px_1.4fr] ref-table-head"><span>월</span><span className="text-right">목표</span><span className="text-right">매출</span><span className="text-right">달성률</span><span className="text-right">건수</span><span className="text-right">객단가 · 비교</span></div>{monthly.map((item) => <div key={item.month} className={`grid grid-cols-[64px_1fr_1fr_76px_88px_1.4fr] ref-table-row ${selected?.month === item.month ? "bg-[var(--ref-gold-wash)]" : ""}`}><b>{monthLabel(item.month)}</b><span className="text-right">{item.targetAmount > 0 ? money(item.targetAmount) : "—"}</span><span className="text-right font-bold">{item.hasRecord ? money(item.sales) : "—"}</span><span className={`text-right font-bold ${targetStatusClass(item.targetProgressRate)}`}>{precisePercent(item.targetProgressRate)}</span><span className="text-right">{item.hasRecord ? `${item.count.toLocaleString("ko-KR")}건` : "—"}</span><span className="text-right text-[11px] text-muted">{item.hasRecord ? `${money(item.averageTicket)} · ${comparisonText(item)}` : "기록 없음"}</span></div>)}</div></div>
        <div className="mt-3 grid gap-2 md:hidden">{monthly.map((item) => <article key={item.month} className={`rounded-control border border-[var(--ref-line)] px-3 py-3 ${selected?.month === item.month ? "bg-[var(--ref-gold-wash)]" : "bg-white"}`}><div className="flex items-center justify-between"><b>{monthLabel(item.month)}</b><span className={targetStatusClass(item.targetProgressRate)}>{precisePercent(item.targetProgressRate)}</span></div><dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs"><div><dt className="text-muted">목표</dt><dd>{item.targetAmount > 0 ? money(item.targetAmount) : "미설정"}</dd></div><div><dt className="text-muted">매출</dt><dd className="font-bold">{item.hasRecord ? money(item.sales) : "기록 없음"}</dd></div><div><dt className="text-muted">건수</dt><dd>{item.hasRecord ? `${item.count.toLocaleString("ko-KR")}건` : "—"}</dd></div><div><dt className="text-muted">객단가</dt><dd>{item.hasRecord ? money(item.averageTicket) : "—"}</dd></div></dl><p className="mt-2 text-[11px] text-muted">{comparisonText(item)}</p></article>)}</div>
      </section>

      <div className="grid gap-3 lg:grid-cols-3">
        <SupportingPanel title="채널별 매출 비중" subtitle="기록된 매출 채널 기준">{(data?.channels ?? []).map((channel) => <div key={channel.name} className="ref-table-row !px-3 !py-2"><div className="flex justify-between gap-2 text-xs"><b>{channel.name}</b><span className="text-bread">{Math.round(channel.ratio * 100)}%</span></div><p className="mt-1 text-[11px] text-muted">{money(channel.amount)} · {channel.count.toLocaleString("ko-KR")}건</p><RatioBar ratio={channel.ratio} /></div>)}</SupportingPanel>
        <SupportingPanel title="많이 팔린 제품" subtitle="판매 수량 상위 제품">{(data?.productTop ?? []).slice(0, 5).map((product) => <p key={product.productName} className="ref-table-row !px-3 !py-2 text-xs"><b>{product.productName}</b><span className="text-muted"> · 판매 {product.soldQty.toLocaleString("ko-KR")}개 · 손실 {product.lossQty.toLocaleString("ko-KR")}개 · 시식 {product.tastingQty.toLocaleString("ko-KR")}개</span></p>)}</SupportingPanel>
        <SupportingPanel title="손실 점검 제품" subtitle="손실 수량과 비율 기준">{(data?.lossTop ?? []).slice(0, 5).map((product) => <p key={product.productName} className="ref-table-row !px-3 !py-2 text-xs"><b>{product.productName}</b><span className="text-muted"> · 손실 {product.lossQty.toLocaleString("ko-KR")}개 · 손실률 {product.lossRate === null ? "계산 없음" : `${Math.round(product.lossRate * 100)}%`}</span></p>)}</SupportingPanel>
      </div>
      {(data?.dataWarnings.length ?? 0) > 0 ? <section className="ref-card"><h2 className="text-[15px] font-extrabold text-ink">데이터 정리 필요</h2><p className="mt-1 text-xs text-muted">분석 화면에서 임의로 고치지 않고 확인할 후보만 표시합니다.</p><div className="mt-3 grid gap-2 md:grid-cols-2">{data?.dataWarnings.map((warning) => <p key={warning} className="rounded-control border border-[var(--ref-gold-soft)] bg-[var(--ref-gold-wash)] px-3 py-2 text-xs font-semibold text-[var(--ref-text-secondary)]">{warning}</p>)}</div></section> : null}
    </div>
  );
}

function Kpi({ label, value, meta, className = "text-ink" }: { label: string; value: string; meta?: string; className?: string }) {
  return <div className="rounded-control border border-[var(--ref-line)] bg-white px-3 py-2.5"><p className="text-[11px] text-muted">{label}</p><p className={`mt-1 text-[17px] font-extrabold ${className}`}>{value}</p>{meta ? <p className="mt-1 text-[10px] text-muted">{meta}</p> : null}</div>;
}
function SupportingPanel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return <section className="ref-card !p-0"><div className="border-b border-[var(--ref-line)] px-4 py-3"><h2 className="text-[15px] font-extrabold text-ink">{title}</h2><p className="mt-1 text-[11px] text-muted">{subtitle}</p></div><div>{children}</div></section>;
}
