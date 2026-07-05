import { MinusCircle, Plus, RotateCcw, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { apiDelete, apiGet, apiPost } from "../../shared/api/client.js";
import type { ListEnvelope } from "../../shared/api/types.js";
import { Button } from "../../shared/ui/Button.js";

type PrepaidTransactionDto = {
  id: string;
  type: string;
  amount: number;
  note: string | null;
  occurredAt: string;
  createdAt: string;
};

type PrepaidCustomerDto = {
  id: string;
  customerName: string;
  contactPhone: string | null;
  memo: string | null;
  balance: number;
  lastUsedAt: string | null;
  transactions: PrepaidTransactionDto[];
};

type NewLedgerForm = {
  customerName: string;
  contactPhone: string;
  amount: string;
  memo: string;
};

type UseLedgerForm = {
  amount: string;
  note: string;
};

type ChargeLedgerForm = {
  amount: string;
  note: string;
};

function emptyNewLedgerForm(): NewLedgerForm {
  return {
    customerName: "",
    contactPhone: "",
    amount: "",
    memo: ""
  };
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function formatPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) {
    return digits;
  }
  if (digits.length <= 7) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function digitsToNumber(value: string): number {
  return Number(value.replace(/\D/g, ""));
}

function formatAmountInput(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits ? formatCurrency(Number(digits)) : "";
}

function formatLedgerDate(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    weekday: "short"
  }).format(new Date(value));
}

function transactionLabel(type: string): string {
  return type === "USE" ? "사용" : "충전";
}

function transactionAmountLabel(transaction: PrepaidTransactionDto): string {
  const sign = transaction.type === "USE" ? "-" : "+";
  return `${sign}${formatCurrency(transaction.amount)}원`;
}

function transactionToneClass(type: string): string {
  return type === "USE" ? "bg-red/10 text-red" : "bg-green/10 text-green";
}

function transactionUndoHelp(type: string): string {
  return type === "USE" ? "이 사용 금액이 잔액으로 다시 돌아갑니다." : "이 충전 금액이 잔액에서 빠집니다.";
}

export function PrepaidLedgerPage() {
  const [customers, setCustomers] = useState<PrepaidCustomerDto[]>([]);
  const [query, setQuery] = useState("");
  const [newForm, setNewForm] = useState<NewLedgerForm>(() => emptyNewLedgerForm());
  const [useForms, setUseForms] = useState<Record<string, UseLedgerForm>>({});
  const [chargeForms, setChargeForms] = useState<Record<string, ChargeLedgerForm>>({});
  const [expandedTransactionCustomers, setExpandedTransactionCustomers] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const sortedCustomers = useMemo(
    () => [...customers].sort((left, right) => right.balance - left.balance),
    [customers]
  );
  const totalBalance = useMemo(
    () => customers.reduce((total, customer) => total + customer.balance, 0),
    [customers]
  );

  const loadLedger = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (query.trim()) {
      params.set("query", query.trim());
    }
    const envelope = await apiGet<ListEnvelope<PrepaidCustomerDto>>(
      `/prepaid-ledger${params.toString() ? `?${params.toString()}` : ""}`
    );
    setIsLoading(false);

    if (envelope.error) {
      setError(envelope.error.message);
      return;
    }

    setCustomers(envelope.data.items);
  }, [query]);

  useEffect(() => {
    void loadLedger();
  }, [loadLedger]);

  function setUseForm(customerId: string, next: Partial<UseLedgerForm>) {
    setUseForms((current) => ({
      ...current,
      [customerId]: {
        amount: current[customerId]?.amount ?? "",
        note: current[customerId]?.note ?? "",
        ...next
      }
    }));
  }

  function setChargeForm(customerId: string, next: Partial<ChargeLedgerForm>) {
    setChargeForms((current) => ({
      ...current,
      [customerId]: {
        amount: current[customerId]?.amount ?? "",
        note: current[customerId]?.note ?? "",
        ...next
      }
    }));
  }

  async function createLedger() {
    setMessage(null);
    setError(null);
    const amount = digitsToNumber(newForm.amount);
    if (!newForm.customerName.trim() || amount <= 0) {
      setError("손님 이름과 선결제 금액을 확인해 주세요.");
      return;
    }

    const envelope = await apiPost<PrepaidCustomerDto, Record<string, unknown>>("/prepaid-ledger", {
      customerName: newForm.customerName,
      contactPhone: newForm.contactPhone || undefined,
      amount,
      memo: newForm.memo || undefined
    });

    if (envelope.error) {
      setError(envelope.error.message);
      return;
    }

    setMessage(`선결제 등록 완료 #${envelope.data.id}`);
    setNewForm(emptyNewLedgerForm());
    await loadLedger();
  }

  async function useBalance(customer: PrepaidCustomerDto) {
    setMessage(null);
    setError(null);
    const form = useForms[customer.id] ?? { amount: "", note: "" };
    const amount = digitsToNumber(form.amount);
    if (amount <= 0 || !form.note.trim()) {
      setError("사용 금액과 사용 내용을 입력해 주세요.");
      return;
    }

    const envelope = await apiPost<PrepaidCustomerDto, Record<string, unknown>>(
      `/prepaid-ledger/${customer.id}/use`,
      { amount, note: form.note }
    );

    if (envelope.error) {
      setError(envelope.error.message);
      return;
    }

    setMessage(`사용 처리 완료 #${customer.id}`);
    setUseForms((current) => ({ ...current, [customer.id]: { amount: "", note: "" } }));
    await loadLedger();
  }

  async function chargeBalance(customer: PrepaidCustomerDto) {
    setMessage(null);
    setError(null);
    const form = chargeForms[customer.id] ?? { amount: "", note: "" };
    const amount = digitsToNumber(form.amount);
    if (amount <= 0) {
      setError("추가 충전 금액을 입력해 주세요.");
      return;
    }

    const envelope = await apiPost<PrepaidCustomerDto, Record<string, unknown>>(
      `/prepaid-ledger/${customer.id}/charge`,
      { amount, note: form.note || undefined }
    );

    if (envelope.error) {
      setError(envelope.error.message);
      return;
    }

    setMessage(`추가 충전 완료 #${customer.id}`);
    setChargeForms((current) => ({ ...current, [customer.id]: { amount: "", note: "" } }));
    await loadLedger();
  }

  async function cancelTransaction(customer: PrepaidCustomerDto, transaction: PrepaidTransactionDto) {
    const label = `${transactionLabel(transaction.type)} ${formatCurrency(transaction.amount)}원`;
    if (!window.confirm(`${customer.customerName}님 ${label} 내역을 되돌릴까요?\n${transactionUndoHelp(transaction.type)}`)) {
      return;
    }

    setMessage(null);
    setError(null);
    const envelope = await apiDelete<PrepaidCustomerDto>(
      `/prepaid-ledger/${customer.id}/transactions/${transaction.id}`
    );

    if (envelope.error) {
      setError(envelope.error.message);
      return;
    }

    setMessage(`${label} 되돌리기 완료 #${customer.id}`);
    await loadLedger();
  }

  return (
    <div className="mx-auto grid max-w-none gap-4">
      <section className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="section-title">선결제 장부</h2>
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="prepaid-search">손님 검색</label>
            <input
              id="prepaid-search"
              aria-label="손님 검색"
              className="input h-10 w-56"
              placeholder="손님 이름 또는 연락처 검색"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <Button className="dc-action min-h-0" icon={Plus} type="button" onClick={() => document.getElementById("new-prepaid-form")?.scrollIntoView({ behavior: "smooth" })}>
              신규 등록
            </Button>
          </div>
        </div>

        {message ? (
          <div className="mb-4 rounded-control border border-green/20 bg-green/10 px-3 py-2 text-sm font-semibold text-green">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="mb-4 rounded-control border border-red/20 bg-red/10 px-3 py-2 text-sm font-semibold text-red">
            {error}
          </div>
        ) : null}

        <div className="dc-card mb-4 flex gap-7 px-5 py-[15px]">
          <div>
            <p className="text-[11px] text-muted">검색된 손님 수</p>
            <p className="mt-1 text-lg font-bold text-ink">{formatCurrency(customers.length)}명</p>
          </div>
          <div>
            <p className="text-[11px] text-muted">총 잔액 합계</p>
            <p className="mt-1 text-lg font-bold text-bread">합계 {formatCurrency(totalBalance)}원</p>
          </div>
        </div>

        <div className="dc-card overflow-hidden px-[22px] py-2">
          <div className="dc-row-head grid grid-cols-[1fr_1.3fr_1fr_2fr_2.2fr] gap-2">
            <div>이름</div><div>연락처</div><div>잔액</div><div>최근 거래</div><div>액션</div>
          </div>
          {sortedCustomers.map((customer) => {
            const last = customer.transactions[0];
            return (
              <div key={customer.id} className="dc-row grid grid-cols-[1fr_1.3fr_1fr_2fr_2.2fr] gap-2 items-center">
                <div className="font-bold text-ink">{customer.customerName}</div>
                <div className="text-muted">{customer.contactPhone || "-"}</div>
                <div className="font-bold text-ink">잔액 {formatCurrency(customer.balance)}원</div>
                <div className="text-muted">{last ? `${formatLedgerDate(last.occurredAt)} ${transactionLabel(last.type)} ${transactionAmountLabel(last)}` : "-"}</div>
                <div className="flex flex-wrap gap-2">
                  <button className="rounded-full bg-blue/10 px-2 py-1 text-xs font-bold text-blue" type="button" onClick={() => document.getElementById(`${customer.id}-ledger-actions`)?.scrollIntoView({ behavior: "smooth" })}>충전</button>
                  <button className="rounded-full bg-[#F4E3D8] px-2 py-1 text-xs font-bold text-cocoa" type="button" onClick={() => document.getElementById(`${customer.id}-ledger-actions`)?.scrollIntoView({ behavior: "smooth" })}>사용</button>
                  <button className="rounded-full bg-cream px-2 py-1 text-xs font-bold text-muted" type="button" onClick={() => document.getElementById(`${customer.id}-ledger-actions`)?.scrollIntoView({ behavior: "smooth" })}>되돌리기 상세</button>
                  <button className="rounded-full bg-red/10 px-2 py-1 text-xs font-bold text-red" type="button" onClick={() => document.getElementById(`${customer.id}-ledger-actions`)?.scrollIntoView({ behavior: "smooth" })}>삭제</button>
                </div>
              </div>
            );
          })}
          {!isLoading && customers.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm font-medium text-muted">선결제 장부에 등록된 손님이 없습니다.</div>
          ) : null}
        </div>

        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-bold text-cocoa">등록·충전·사용 상세 기능 열기</summary>
        <div className="mt-3 grid gap-4 xl:grid-cols-[minmax(20rem,0.72fr)_minmax(0,1.28fr)]">
          <div className="grid self-start gap-3 rounded-[1.25rem] border border-latte bg-white/75 p-3 shadow-sm">
            <span id="new-prepaid-form" className="sr-only">선결제 손님 신규 등록</span>
            <div className="flex items-center gap-2 rounded-control border border-latte bg-white px-3 py-2">
              <Search className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
              <label className="grid min-w-0 flex-1 gap-1">
                <span className="text-xs font-bold text-muted">손님 검색 상세</span>
                <input
                  aria-label="손님 검색 상세"
                  className="min-w-0 bg-transparent text-sm font-semibold text-ink outline-none"
                  placeholder="이름 또는 연락처"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
            </div>

            <div className="grid gap-3 border-t border-latte pt-3">
              <div>
                <p className="text-sm font-extrabold text-cocoa">새 선결제 등록</p>
                <p className="mt-1 text-xs font-semibold text-muted">처음 충전하는 손님을 등록합니다.</p>
              </div>
              <label className="grid gap-1">
                <span className="field-label">손님 이름</span>
                <input
                  aria-label="새 손님 이름"
                  className="input"
                  placeholder="홍길동"
                  value={newForm.customerName}
                  onChange={(event) => setNewForm((current) => ({ ...current, customerName: event.target.value }))}
                />
              </label>
              <label className="grid gap-1">
                <span className="field-label">연락처</span>
                <input
                  aria-label="새 손님 연락처"
                  className="input"
                  inputMode="numeric"
                  placeholder="010-0000-0000"
                  value={newForm.contactPhone}
                  onChange={(event) =>
                    setNewForm((current) => ({ ...current, contactPhone: formatPhoneInput(event.target.value) }))
                  }
                />
              </label>
              <label className="grid gap-1">
                <span className="field-label">선결제 금액</span>
                <input
                  aria-label="선결제 금액"
                  className="input text-right"
                  inputMode="numeric"
                  placeholder="50,000"
                  value={newForm.amount}
                  onChange={(event) =>
                    setNewForm((current) => ({ ...current, amount: formatAmountInput(event.target.value) }))
                  }
                />
              </label>
              <label className="grid gap-1">
                <span className="field-label">메모</span>
                <textarea
                  aria-label="선결제 메모"
                  className="input min-h-20 resize-y"
                  placeholder="예: 바게트 10개 선결제"
                  value={newForm.memo}
                  onChange={(event) => setNewForm((current) => ({ ...current, memo: event.target.value }))}
                />
              </label>
              <Button icon={Plus} type="button" onClick={() => void createLedger()}>
                선결제 등록
              </Button>
            </div>
          </div>

          <div className="grid content-start gap-3">
            <div className="grid gap-2 rounded-[1.2rem] border border-latte bg-white/85 p-3 shadow-sm sm:grid-cols-3">
              <div>
                <p className="text-xs font-bold text-muted">검색 결과</p>
                <p className="mt-1 text-xl font-extrabold text-ink">{formatCurrency(customers.length)}명</p>
              </div>
              <div>
                <p className="text-xs font-bold text-muted">총 잔액</p>
                <p className="mt-1 text-xl font-extrabold text-blue">{formatCurrency(totalBalance)}원</p>
              </div>
              <div className="rounded-[0.9rem] border border-blue/15 bg-blue/5 px-3 py-2 text-xs font-bold text-blue">
                잘못 눌렀다면 최근 내역의 “되돌리기”를 누른 뒤 정확한 금액으로 다시 입력합니다.
              </div>
            </div>

            {sortedCustomers.map((customer) => {
              const useForm = useForms[customer.id] ?? { amount: "", note: "" };
              const chargeForm = chargeForms[customer.id] ?? { amount: "", note: "" };
              const showAllTransactions = expandedTransactionCustomers.includes(customer.id);
              const displayedTransactions = showAllTransactions
                ? customer.transactions
                : customer.transactions.slice(0, 5);
              return (
                <article
                  key={customer.id}
                  id={`${customer.id}-ledger-actions`}
                  aria-label={`${customer.customerName} 선결제 장부`}
                  className="rounded-[1.35rem] border border-latte bg-white p-3 shadow-sm ring-1 ring-white/70"
                >
                  <div className="grid gap-3 border-b border-latte pb-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-extrabold text-ink">{customer.customerName}님</h3>
                      <p className="text-sm font-semibold text-muted">{customer.contactPhone || "연락처 없음"}</p>
                      {customer.memo ? <p className="mt-1 text-sm font-semibold text-cocoa">{customer.memo}</p> : null}
                    </div>
                    <div className="rounded-[1rem] bg-blue/10 px-4 py-3 text-right">
                      <p className="text-xs font-bold text-blue/80">현재 잔액</p>
                      <p className="mt-1 text-2xl font-extrabold tracking-[-0.03em] text-blue">
                        {formatCurrency(customer.balance)}원
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_18rem]">
                    <div className="grid content-start gap-2">
                      <div>
                        <p className="text-xs font-extrabold text-cocoa">최근 내역</p>
                        <p className="mt-0.5 text-[11px] font-semibold text-muted">
                          {showAllTransactions
                            ? `전체 ${customer.transactions.length}개 내역을 상세히 보여줍니다.`
                            : "최근 5개만 먼저 보여줍니다."}
                        </p>
                      </div>
                      {customer.transactions.length > 0 ? (
                        <div className="grid gap-2">
                          {displayedTransactions.map((transaction) => (
                            <div
                              key={transaction.id}
                              className="grid gap-2 rounded-[0.9rem] border border-latte bg-cream/35 px-3 py-2 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                            >
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-xs font-extrabold ${transactionToneClass(transaction.type)}`}
                                  >
                                    {transactionLabel(transaction.type)}
                                  </span>
                                  <span className="font-extrabold text-ink">{transactionAmountLabel(transaction)}</span>
                                  <span className="text-xs font-semibold text-muted">
                                    {formatLedgerDate(transaction.occurredAt)}
                                  </span>
                                </div>
                                {transaction.note ? <p className="mt-1 min-w-0 text-cocoa">{transaction.note}</p> : null}
                              </div>
                              <button
                                type="button"
                                className="inline-flex min-h-9 items-center justify-center gap-1 rounded-full border border-latte bg-white px-3 py-1 text-xs font-extrabold text-cocoa shadow-sm transition hover:bg-red/10 hover:text-red"
                                onClick={() => void cancelTransaction(customer, transaction)}
                              >
                                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                                되돌리기
                              </button>
                            </div>
                          ))}
                          {customer.transactions.length > 5 ? (
                            <button
                              type="button"
                              className="rounded-[0.9rem] border border-latte bg-white px-3 py-2 text-xs font-extrabold text-cocoa transition hover:bg-cream"
                              onClick={() =>
                                setExpandedTransactionCustomers((current) =>
                                  current.includes(customer.id)
                                    ? current.filter((id) => id !== customer.id)
                                    : [...current, customer.id]
                                )
                              }
                            >
                              {showAllTransactions
                                ? `${customer.customerName} 최근 거래 5개만 보기`
                                : `${customer.customerName} 전체 거래 내역 ${customer.transactions.length}건 보기`}
                            </button>
                          ) : null}
                        </div>
                      ) : (
                        <p className="rounded-control bg-cream/50 px-3 py-4 text-center text-sm font-semibold text-muted">
                          내역 없음
                        </p>
                      )}
                    </div>

                    <div className="grid gap-3 rounded-[1rem] bg-cream/45 p-3">
                      <div className="grid gap-2 border-b border-latte pb-3">
                        <p className="text-sm font-extrabold text-cocoa">추가 충전</p>
                        <label className="grid gap-1">
                          <span className="text-xs font-semibold text-muted">충전 금액</span>
                          <input
                            aria-label={`${customer.customerName} 추가 충전 금액`}
                            className="input text-right"
                            inputMode="numeric"
                            placeholder="20,000"
                            value={chargeForm.amount}
                            onChange={(event) =>
                              setChargeForm(customer.id, { amount: formatAmountInput(event.target.value) })
                            }
                          />
                        </label>
                        <label className="grid gap-1">
                          <span className="text-xs font-semibold text-muted">충전 메모</span>
                          <input
                            aria-label={`${customer.customerName} 추가 충전 메모`}
                            className="input"
                            placeholder="예: 식빵 추가 충전"
                            value={chargeForm.note}
                            onChange={(event) => setChargeForm(customer.id, { note: event.target.value })}
                          />
                        </label>
                        <button
                          type="button"
                          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[0.9rem] bg-white px-3 text-sm font-extrabold text-cocoa shadow-sm ring-1 ring-latte transition hover:-translate-y-0.5 hover:bg-cream hover:shadow-md active:translate-y-0"
                          onClick={() => void chargeBalance(customer)}
                        >
                          <Plus className="h-4 w-4" aria-hidden="true" />
                          {customer.customerName} 추가 충전
                        </button>
                      </div>

                      <div className="grid gap-2">
                        <p className="text-sm font-extrabold text-cocoa">사용 차감</p>
                        <label className="grid gap-1">
                          <span className="text-xs font-semibold text-muted">사용 금액</span>
                          <input
                            aria-label={`${customer.customerName} 사용 금액`}
                            className="input text-right"
                            inputMode="numeric"
                            placeholder="5,000"
                            value={useForm.amount}
                            onChange={(event) => setUseForm(customer.id, { amount: formatAmountInput(event.target.value) })}
                          />
                        </label>
                        <label className="grid gap-1">
                          <span className="text-xs font-semibold text-muted">사용 내용</span>
                          <input
                            aria-label={`${customer.customerName} 사용 내용`}
                            className="input"
                            placeholder="예: 바게트 픽업"
                            value={useForm.note}
                            onChange={(event) => setUseForm(customer.id, { note: event.target.value })}
                          />
                        </label>
                        <button
                          type="button"
                          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[0.9rem] bg-white px-3 text-sm font-extrabold text-cocoa shadow-sm ring-1 ring-latte transition hover:-translate-y-0.5 hover:bg-cream hover:shadow-md active:translate-y-0"
                          onClick={() => void useBalance(customer)}
                        >
                          <MinusCircle className="h-4 w-4" aria-hidden="true" />
                          {customer.customerName} 사용 처리
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}

            {!isLoading && customers.length === 0 ? (
              <div className="rounded-control border border-stone-200 px-3 py-8 text-center text-sm font-medium text-muted">
                선결제 장부에 등록된 손님이 없습니다.
              </div>
            ) : null}
          </div>
        </div>
        </details>
      </section>
    </div>
  );
}
