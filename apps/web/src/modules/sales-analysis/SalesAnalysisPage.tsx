import { useEffect, useMemo, useState } from "react";

import { apiGet } from "../../shared/api/client.js";

const currentYear = new Date().getFullYear();

type SalesAnalysisDto = {
  year: number;
  totalSales: number;
  totalCount: number;
  averageTicket: number;
  dailyAverageSales: number;
  targetAmount: number;
  targetProgressRate: number | null;
  monthly: Array<{ month: string; sales: number; count: number; targetAmount: number; targetProgressRate: number | null }>;
  channels: Array<{ name: string; amount: number; count: number; ratio: number }>;
  productTop: Array<{ productName: string; soldQty: number; lossQty: number; tastingQty: number }>;
  lossTop: Array<{ productName: string; soldQty: number; lossQty: number; tastingQty: number }>;
  visual: { maxMonthlySales: number; maxDailySales: number };
};

function money(value: number) {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

function percent(value: number | null | undefined) {
  return `${Math.round((value ?? 0) * 100)}%`;
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

  return (
    <div className="mx-auto grid max-w-7xl gap-4">
      <section className="rounded-[14px] border border-latte bg-white p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="section-title">매출 분석</h2>
            <p className="mt-1 text-sm text-muted">년도별·월별 매출 흐름을 그래프와 지표로 확인합니다.</p>
          </div>
          <label className="grid gap-1">
            <span className="field-label">분석 년도</span>
            <select className="input min-w-32" value={year} onChange={(event) => setYear(event.target.value)} aria-label="분석 년도">
              {yearOptions.map((option) => <option key={option} value={option}>{option}년</option>)}
            </select>
          </label>
        </div>
        {error ? <p className="mt-3 rounded-control bg-red/10 px-3 py-2 text-sm font-bold text-red">{error}</p> : null}
        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          <div className="dc-card px-4 py-3"><p className="text-xs text-muted">연간 매출</p><p className="mt-1 text-xl font-extrabold text-ink">{money(data?.totalSales ?? 0)}</p></div>
          <div className="dc-card px-4 py-3"><p className="text-xs text-muted">매출 건수</p><p className="mt-1 text-xl font-extrabold text-ink">{(data?.totalCount ?? 0).toLocaleString("ko-KR")}건</p></div>
          <div className="dc-card px-4 py-3"><p className="text-xs text-muted">객단가</p><p className="mt-1 text-xl font-extrabold text-ink">{money(data?.averageTicket ?? 0)}</p></div>
          <div className="dc-card px-4 py-3"><p className="text-xs text-muted">일 평균</p><p className="mt-1 text-xl font-extrabold text-ink">{money(data?.dailyAverageSales ?? 0)}</p></div>
          <div className="dc-card px-4 py-3"><p className="text-xs text-muted">목표 달성률</p><p className="mt-1 text-xl font-extrabold text-bread">{percent(data?.targetProgressRate)}</p></div>
        </div>
      </section>

      <section className="rounded-[14px] border border-latte bg-white p-5">
        <h3 className="text-base font-extrabold text-ink">월별 매출 그래프</h3>
        <div className="mt-4 grid gap-2">
          {(data?.monthly ?? []).map((item) => {
            const width = maxMonthly > 0 ? Math.max(2, Math.round((item.sales / maxMonthly) * 100)) : 0;
            return (
              <div key={item.month} className="grid gap-2 sm:grid-cols-[5rem_minmax(0,1fr)_8rem] sm:items-center">
                <p className="text-sm font-bold text-cocoa">{Number(item.month.slice(5))}월</p>
                <div className="h-8 overflow-hidden rounded-full bg-cream">
                  <div className="flex h-full items-center rounded-full bg-bread px-3 text-xs font-bold text-white" style={{ width: `${width}%` }}>
                    {item.sales > 0 ? money(item.sales) : ""}
                  </div>
                </div>
                <p className="text-right text-xs font-bold text-muted">목표 {percent(item.targetProgressRate)}</p>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-[14px] border border-latte bg-white p-5">
          <h3 className="text-base font-extrabold text-ink">채널별 매출</h3>
          <div className="mt-3 grid gap-2">
            {(data?.channels ?? []).map((channel) => <p key={channel.name} className="rounded-[9px] bg-cream/60 px-3 py-2 text-sm"><b>{channel.name}</b> · {money(channel.amount)} · {channel.count.toLocaleString("ko-KR")}건</p>)}
          </div>
        </section>
        <section className="rounded-[14px] border border-latte bg-white p-5">
          <h3 className="text-base font-extrabold text-ink">많이 팔린 제품</h3>
          <div className="mt-3 grid gap-2">
            {(data?.productTop ?? []).slice(0, 5).map((product) => <p key={product.productName} className="rounded-[9px] bg-cream/60 px-3 py-2 text-sm"><b>{product.productName}</b> · {product.soldQty.toLocaleString("ko-KR")}개</p>)}
          </div>
        </section>
        <section className="rounded-[14px] border border-latte bg-white p-5">
          <h3 className="text-base font-extrabold text-ink">손실이 많았던 제품</h3>
          <div className="mt-3 grid gap-2">
            {(data?.lossTop ?? []).slice(0, 5).map((product) => <p key={product.productName} className="rounded-[9px] bg-cream/60 px-3 py-2 text-sm"><b>{product.productName}</b> · 손실 {product.lossQty.toLocaleString("ko-KR")}개</p>)}
          </div>
        </section>
      </div>
    </div>
  );
}
