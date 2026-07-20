import { useCallback, useEffect, useState } from "react";

import { apiGet, apiPost } from "../../shared/api/client.js";
import { PageHeader } from "../../shared/ui/PageHeader.js";

type RegularCustomerDto = {
  id: string;
  customerName: string;
  maskedPhone: string | null;
  contactPhone: string | null;
  fixedMemo: string;
};

type RegularCustomerCandidateDto = {
  customerName: string;
  contactPhone: string | null;
  maskedPhone: string | null;
  source: "RESERVATION" | "PREPAID";
  reason: string;
  fixedMemo: string;
};

export function RegularCustomerPage() {
  const [items, setItems] = useState<RegularCustomerDto[]>([]);
  const [candidates, setCandidates] = useState<RegularCustomerCandidateDto[]>([]);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    const [listEnvelope, candidateEnvelope] = await Promise.all([
      apiGet<{ items: RegularCustomerDto[] }>(`/regular-customer${query ? `?query=${encodeURIComponent(query)}` : ""}`),
      apiGet<{ items: RegularCustomerCandidateDto[] }>("/regular-customer/candidates")
    ]);
    if (listEnvelope.error) {
      setError(listEnvelope.error.message);
    } else {
      setItems(listEnvelope.data.items);
    }
    if (!candidateEnvelope.error) {
      setCandidates(candidateEnvelope.data.items);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveCandidate(candidate: RegularCustomerCandidateDto) {
    const body: { customerName: string; contactPhone?: string; fixedMemo?: string } = {
      customerName: candidate.customerName,
      fixedMemo: candidate.fixedMemo || candidate.reason
    };
    if (candidate.contactPhone) {
      body.contactPhone = candidate.contactPhone;
    }
    const envelope = await apiPost<RegularCustomerDto, { customerName: string; contactPhone?: string; fixedMemo?: string }>(
      "/regular-customer",
      body
    );
    if (envelope.error) {
      setError(envelope.error.message);
      return;
    }
    setMessage(`${envelope.data.customerName}님을 단골손님 리스트에 저장했습니다.`);
    await load();
  }

  return (
    <div className="mx-auto grid w-full max-w-[1240px] gap-3 pb-6">
      <section className="ref-card !p-0">
        <PageHeader title="단골손님 리스트" description="예약·선결제에서 자주 보이는 손님과 직원이 저장한 고정 메모를 모아 봅니다." actions={<div className="flex w-full flex-wrap gap-2 sm:w-auto sm:flex-nowrap">
            <input className="input w-full min-w-0 sm:w-auto sm:min-w-56" aria-label="단골손님 검색" placeholder="이름 또는 연락처" value={query} onChange={(event) => setQuery(event.target.value)} />
            <button className="ref-primary-action" type="button" onClick={() => void load()}>검색</button>
          </div>} />
        {message ? <p role="status" className="mx-4 mb-3 rounded-control bg-green/10 px-3 py-2 text-sm font-bold text-green">{message}</p> : null}
        {error ? <p role="alert" className="mx-4 mb-3 rounded-control bg-red/10 px-3 py-2 text-sm font-bold text-red">{error}</p> : null}
      </section>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <section className="ref-card !p-0">
          <div className="border-b border-[var(--ref-line)] px-4 py-3"><h2 className="text-[15px] font-extrabold text-ink">저장된 단골손님</h2><p className="mt-1 text-xs text-muted">이름, 연락처와 고정 메모를 한 행에서 확인합니다.</p></div>
          <div className="hidden grid-cols-[1fr_1fr_1.8fr] ref-table-head md:grid"><span>이름</span><span>연락처</span><span>고정 메모</span></div>
          <div>
            {items.map((item) => (
              <article key={item.id} className="grid gap-1 ref-table-row md:grid-cols-[1fr_1fr_1.8fr] md:gap-3">
                <p className="font-extrabold text-ink">{item.customerName}님</p><p className="text-muted">{item.maskedPhone ?? "연락처 없음"}</p><p className="text-[12px] text-[var(--ref-text-secondary)]">{item.fixedMemo || "저장된 메모 없음"}</p>
              </article>
            ))}
            {items.length === 0 ? <p className="px-4 py-12 text-center text-sm font-semibold text-muted">저장된 단골손님이 없습니다.</p> : null}
          </div>
        </section>

        <section className="ref-card !p-0">
          <div className="border-b border-[var(--ref-line)] px-4 py-3"><h2 className="text-[15px] font-extrabold text-ink">확인할 단골 후보</h2><p className="mt-1 text-xs text-muted">직원이 확인한 손님만 목록에 저장합니다.</p></div>
          <div>
            {candidates.map((candidate, index) => (
              <article key={`${candidate.source}-${candidate.customerName}-${index}`} className="ref-table-row">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-extrabold text-ink">{candidate.customerName}님</p>
                    <p className="mt-1 text-[12px] text-muted">{candidate.maskedPhone ?? "연락처 없음"} · {candidate.reason}</p>
                  </div>
                  <span className="ref-status-tag">{candidate.source === "PREPAID" ? "선결제" : "예약"}</span>
                </div>
                {candidate.fixedMemo ? <p className="mt-2 text-[12px] text-[var(--ref-text-secondary)]">{candidate.fixedMemo}</p> : null}
                <button className="ref-secondary-action mt-3" type="button" onClick={() => void saveCandidate(candidate)}>단골로 저장</button>
              </article>
            ))}
            {candidates.length === 0 ? <p className="px-4 py-12 text-center text-sm font-semibold text-muted">현재 단골 후보가 없습니다.</p> : null}
          </div>
        </section>
      </div>
    </div>
  );
}
