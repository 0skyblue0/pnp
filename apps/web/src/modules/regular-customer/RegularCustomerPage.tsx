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
    <div className="app-page grid gap-4">
      <section className="app-card">
        <PageHeader title="단골손님 리스트" description="예약·선결제에서 자주 보이는 손님과 직원이 저장한 고정 메모를 모아 봅니다." actions={<div className="flex gap-2">
            <input className="input min-w-56" aria-label="단골손님 검색" placeholder="이름 또는 연락처" value={query} onChange={(event) => setQuery(event.target.value)} />
            <button className="min-h-11 rounded-control bg-bread px-4 py-2 text-sm font-bold text-white" type="button" onClick={() => void load()}>검색</button>
          </div>} />
        {message ? <p role="status" className="mt-3 rounded-control bg-green/10 px-3 py-2 text-sm font-bold text-green">{message}</p> : null}
        {error ? <p role="alert" className="mt-3 rounded-control bg-red/10 px-3 py-2 text-sm font-bold text-red">{error}</p> : null}
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="dc-card px-4 py-3"><p className="text-xs text-muted">저장된 단골</p><p className="mt-1 text-2xl font-extrabold text-ink">{items.length}</p></div>
          <div className="dc-card px-4 py-3"><p className="text-xs text-muted">단골 후보</p><p className="mt-1 text-2xl font-extrabold text-ink">{candidates.length}</p></div>
          <div className="dc-card px-4 py-3"><p className="text-xs text-muted">운영 기준</p><p className="mt-1 text-sm font-bold text-cocoa">후보는 직원 확인 후 저장</p></div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <section className="app-card p-5">
          <h3 className="text-base font-extrabold text-ink">저장된 단골손님</h3>
          <div className="mt-3 grid gap-2">
            {items.map((item) => (
              <article key={item.id} className="rounded-[12px] border border-latte bg-cream/40 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-extrabold text-ink">{item.customerName}님</p>
                    <p className="mt-1 text-sm text-muted">{item.maskedPhone ?? "연락처 없음"}</p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-cocoa">저장됨</span>
                </div>
                <p className="mt-3 rounded-[9px] bg-white px-3 py-2 text-sm leading-6 text-cocoa">{item.fixedMemo || "저장된 메모 없음"}</p>
              </article>
            ))}
            {items.length === 0 ? <p className="rounded-[12px] border border-dashed border-latte px-3 py-8 text-center text-sm text-muted">저장된 단골손님이 없습니다.</p> : null}
          </div>
        </section>

        <section className="app-card p-5">
          <h3 className="text-base font-extrabold text-ink">확인할 단골 후보</h3>
          <p className="mt-1 text-xs text-muted">자동으로 저장하지 않고 직원이 확인한 손님만 단골 리스트에 넣습니다.</p>
          <div className="mt-3 grid gap-2">
            {candidates.map((candidate, index) => (
              <article key={`${candidate.source}-${candidate.customerName}-${index}`} className="rounded-[12px] border border-latte bg-cream/40 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-extrabold text-ink">{candidate.customerName}님</p>
                    <p className="mt-1 text-sm text-muted">{candidate.maskedPhone ?? "연락처 없음"} · {candidate.reason}</p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-cocoa">{candidate.source === "PREPAID" ? "선결제" : "예약"}</span>
                </div>
                {candidate.fixedMemo ? <p className="mt-3 rounded-[9px] bg-white px-3 py-2 text-sm text-cocoa">{candidate.fixedMemo}</p> : null}
                <button className="mt-3 rounded-control bg-bread px-4 py-2 text-sm font-bold text-white" type="button" onClick={() => void saveCandidate(candidate)}>단골로 저장</button>
              </article>
            ))}
            {candidates.length === 0 ? <p className="rounded-[12px] border border-dashed border-latte px-3 py-8 text-center text-sm text-muted">현재 단골 후보가 없습니다.</p> : null}
          </div>
        </section>
      </div>
    </div>
  );
}
