import { MinusCircle, Plus, RotateCcw, UserPlus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";

import { apiDelete, apiGet, apiPatch, apiPost } from "../../shared/api/client.js";
import type { ListEnvelope } from "../../shared/api/types.js";
import { useConfirm } from "../../shared/ui/ConfirmDialog.js";

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

type MemoEditForm = {
  memo: string;
};

function emptyNewLedgerForm(): NewLedgerForm {
  return { customerName: "", contactPhone: "", amount: "", memo: "" };
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function formatPhoneInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
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

function lastTransactionText(customer: PrepaidCustomerDto): string {
  const last = customer.transactions[0];
  if (!last) return "거래 내역 없음";
  return `${formatLedgerDate(last.occurredAt)} · ${transactionLabel(last.type)} ${transactionAmountLabel(last)}`;
}

export function PrepaidLedgerPage() {
  const confirm = useConfirm();
  const [customers, setCustomers] = useState<PrepaidCustomerDto[]>([]);
  const [query, setQuery] = useState("");
  const [newForm, setNewForm] = useState<NewLedgerForm>(() => emptyNewLedgerForm());
  const [useForms, setUseForms] = useState<Record<string, UseLedgerForm>>({});
  const [chargeForms, setChargeForms] = useState<Record<string, ChargeLedgerForm>>({});
  const [memoForms, setMemoForms] = useState<Record<string, MemoEditForm>>({});
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [expandedTransactionCustomers, setExpandedTransactionCustomers] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const sortedCustomers = useMemo(() => [...customers].sort((left, right) => right.balance - left.balance), [customers]);
  const totalBalance = useMemo(() => customers.reduce((total, customer) => total + customer.balance, 0), [customers]);
  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === selectedCustomerId) ?? sortedCustomers[0] ?? null,
    [customers, selectedCustomerId, sortedCustomers]
  );

  const loadLedger = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (query.trim()) params.set("query", query.trim());
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
      [customerId]: { amount: current[customerId]?.amount ?? "", note: current[customerId]?.note ?? "", ...next }
    }));
  }

  function setChargeForm(customerId: string, next: Partial<ChargeLedgerForm>) {
    setChargeForms((current) => ({
      ...current,
      [customerId]: { amount: current[customerId]?.amount ?? "", note: current[customerId]?.note ?? "", ...next }
    }));
  }

  function selectCustomer(customer: PrepaidCustomerDto) {
    setSelectedCustomerId(customer.id);
    setMemoForms((current) => ({
      ...current,
      [customer.id]: { memo: current[customer.id]?.memo ?? customer.memo ?? "" }
    }));
  }

  async function saveMemo(customer: PrepaidCustomerDto) {
    setMessage(null);
    setError(null);
    const memo = memoForms[customer.id]?.memo ?? customer.memo ?? "";
    const envelope = await apiPatch<PrepaidCustomerDto, Record<string, unknown>>(`/prepaid-ledger/${customer.id}`, { memo });
    if (envelope.error) {
      setError(envelope.error.message);
      return;
    }
    setMessage(`${customer.customerName}님 메모 수정 완료`);
    await loadLedger();
  }

  async function deleteCustomer(customer: PrepaidCustomerDto) {
    const confirmed = await confirm({
      title: "선결제 장부 삭제",
      message: `${customer.customerName}님 선결제 장부를 삭제할까요?\n기록은 비활성 처리됩니다.`,
      confirmLabel: "삭제",
      tone: "danger"
    });
    if (!confirmed) return;
    setMessage(null);
    setError(null);
    const envelope = await apiDelete<{ deleted: boolean }>(`/prepaid-ledger/${customer.id}`);
    if (envelope.error) {
      setError(envelope.error.message);
      return;
    }
    setMessage(`${customer.customerName}님 선결제 장부 삭제 완료`);
    setSelectedCustomerId((current) => (current === customer.id ? null : current));
    await loadLedger();
  }

  async function createLedger() {
    setMessage(null);
    setError(null);
    const amount = digitsToNumber(newForm.amount);
    if (!newForm.customerName.trim() || amount <= 0) {
      setError("손님 이름과 선결제 금액을 확인해 주세요.");
      return;
    }
    const body: Record<string, unknown> = { customerName: newForm.customerName, amount };
    if (newForm.contactPhone) body.contactPhone = newForm.contactPhone;
    if (newForm.memo) body.memo = newForm.memo;
    const envelope = await apiPost<PrepaidCustomerDto, Record<string, unknown>>("/prepaid-ledger", body);
    if (envelope.error) {
      setError(envelope.error.message);
      return;
    }
    setMessage(`선결제 등록 완료 #${envelope.data.id}`);
    setSelectedCustomerId(envelope.data.id);
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
    const envelope = await apiPost<PrepaidCustomerDto, Record<string, unknown>>(`/prepaid-ledger/${customer.id}/use`, {
      amount,
      note: form.note
    });
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
    const body: Record<string, unknown> = { amount };
    if (form.note) body.note = form.note;
    const envelope = await apiPost<PrepaidCustomerDto, Record<string, unknown>>(`/prepaid-ledger/${customer.id}/charge`, body);
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
    const confirmed = await confirm({
      title: "내역 되돌리기",
      message: `${customer.customerName}님 ${label} 내역을 되돌릴까요?\n${transactionUndoHelp(transaction.type)}`,
      confirmLabel: "되돌리기",
      tone: "danger"
    });
    if (!confirmed) return;
    setMessage(null);
    setError(null);
    const envelope = await apiDelete<PrepaidCustomerDto>(`/prepaid-ledger/${customer.id}/transactions/${transaction.id}`);
    if (envelope.error) {
      setError(envelope.error.message);
      return;
    }
    setMessage(`${label} 되돌리기 완료 #${customer.id}`);
    await loadLedger();
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-4">
      <section className="rounded-[16px] border border-latte bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="section-title">선결제 장부</h2>
            <p className="mt-1 text-sm font-semibold text-cocoa">계산대 모드: 손님 찾고 바로 사용 차감</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="prepaid-search">손님 검색</label>
            <input
              id="prepaid-search"
              aria-label="손님 검색"
              className="input h-10 w-64"
              placeholder="이름 또는 연락처"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <button
              className="inline-flex min-h-10 items-center gap-2 rounded-control bg-bread px-4 text-sm font-bold text-white transition hover:bg-cocoa"
              type="button"
              onClick={() => document.getElementById("new-prepaid-form")?.scrollIntoView({ behavior: "smooth", block: "start" })}
            >
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              새 손님 등록
            </button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_1fr]">
          <div className="rounded-[12px] border border-latte bg-cream/40 px-4 py-3">
            <p className="text-xs font-bold text-muted">1. 손님 찾기</p>
            <p className="mt-1 text-lg font-extrabold text-ink">이름/연락처 검색</p>
          </div>
          <div className="rounded-[12px] border border-latte bg-cream/40 px-4 py-3">
            <p className="text-xs font-bold text-muted">2. 잔액에서 빼기</p>
            <p className="mt-1 text-lg font-extrabold text-bread">사용 금액 입력</p>
          </div>
          <div className="rounded-[12px] border border-latte bg-cream/40 px-4 py-3">
            <p className="text-xs font-bold text-muted">3. 필요하면 충전</p>
            <p className="mt-1 text-lg font-extrabold text-cocoa">충전/되돌리기</p>
          </div>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr]">
          <div className="rounded-[12px] border border-latte bg-white px-4 py-3">
            <p className="text-xs font-bold text-muted">장부 인원</p>
            <p className="mt-1 text-2xl font-extrabold text-ink">{formatCurrency(customers.length)}명</p>
          </div>
          <div className="rounded-[12px] border border-latte bg-white px-4 py-3">
            <p className="text-xs font-bold text-muted">총 남은 선결제</p>
            <p className="mt-1 text-2xl font-extrabold text-bread">{formatCurrency(totalBalance)}원</p>
          </div>
        </div>
        <p className="mt-3 rounded-[12px] border border-latte bg-[#FFF7EC] px-4 py-3 text-sm font-bold leading-6 text-cocoa">
          잘못 눌렀다면 최근 내역의 “되돌리기”를 누른 뒤 정확한 금액으로 다시 입력합니다.
        </p>
      </section>

      {message ? <div className="rounded-control border border-green/20 bg-green/10 px-3 py-2 text-sm font-semibold text-green">{message}</div> : null}
      {error ? <div className="rounded-control border border-red/20 bg-red/10 px-3 py-2 text-sm font-semibold text-red">{error}</div> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(18rem,0.85fr)_minmax(0,1.35fr)]">
        <section className="grid content-start gap-3">
          <div className="rounded-[16px] border border-latte bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-extrabold text-ink">선결제 손님</h3>
              <span className="text-xs font-bold text-muted">잔액 큰 순</span>
            </div>
            <div className="mt-3 grid gap-2">
              {sortedCustomers.map((customer) => {
                const selected = selectedCustomer?.id === customer.id;
                return (
                  <button
                    key={customer.id}
                    type="button"
                    className={[
                      "grid gap-2 rounded-[14px] border px-4 py-3 text-left transition",
                      selected ? "border-bread bg-[#FFF7EC] shadow-control" : "border-latte bg-cream/30 hover:border-bread hover:bg-white"
                    ].join(" ")}
                    onClick={() => selectCustomer(customer)}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span>
                        <span className="block text-base font-extrabold text-ink">{customer.customerName}님</span>
                        <span className="mt-1 block text-xs font-semibold text-muted">{customer.contactPhone || "연락처 없음"}</span>
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 text-sm font-extrabold text-bread ring-1 ring-latte">
                        {formatCurrency(customer.balance)}원
                      </span>
                    </span>
                    <span className="text-xs font-semibold text-cocoa">{lastTransactionText(customer)}</span>
                  </button>
                );
              })}
              {!isLoading && customers.length === 0 ? (
                <p className="rounded-[12px] border border-dashed border-latte px-3 py-10 text-center text-sm font-semibold text-muted">
                  선결제 장부에 등록된 손님이 없습니다.
                </p>
              ) : null}
            </div>
          </div>

          <div id="new-prepaid-form" className="rounded-[16px] border border-latte bg-white p-4">
            <div className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-bread" aria-hidden="true" />
              <h3 className="text-base font-extrabold text-ink">새 손님 등록</h3>
            </div>
            <p className="mt-1 text-xs font-semibold text-muted">처음 선결제하는 손님만 여기에 등록합니다.</p>
            <div className="mt-3 grid gap-3">
              <label className="grid gap-1">
                <span className="field-label">손님 이름</span>
                <input aria-label="새 손님 이름" className="input" placeholder="홍길동" value={newForm.customerName} onChange={(event) => setNewForm((current) => ({ ...current, customerName: event.target.value }))} />
              </label>
              <label className="grid gap-1">
                <span className="field-label">연락처</span>
                <input aria-label="새 손님 연락처" className="input" inputMode="numeric" placeholder="010-0000-0000" value={newForm.contactPhone} onChange={(event) => setNewForm((current) => ({ ...current, contactPhone: formatPhoneInput(event.target.value) }))} />
              </label>
              <label className="grid gap-1">
                <span className="field-label">선결제 금액</span>
                <span className="relative block">
                  <input aria-label="선결제 금액" className="input w-full pr-8 text-right" inputMode="numeric" placeholder="50,000" value={newForm.amount} onChange={(event) => setNewForm((current) => ({ ...current, amount: formatAmountInput(event.target.value) }))} />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted">원</span>
                </span>
              </label>
              <label className="grid gap-1">
                <span className="field-label">메모</span>
                <textarea aria-label="선결제 메모" className="input min-h-20 resize-y" placeholder="예: 바게트 10개 선결제" value={newForm.memo} onChange={(event) => setNewForm((current) => ({ ...current, memo: event.target.value }))} />
              </label>
              <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-control bg-bread px-4 text-sm font-bold text-white transition hover:bg-cocoa" type="button" onClick={() => void createLedger()}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                선결제 등록
              </button>
            </div>
          </div>
        </section>

        <section className="min-w-0">
          {selectedCustomer ? (
            <SelectedCustomerLedger
              customer={selectedCustomer}
              chargeForm={chargeForms[selectedCustomer.id] ?? { amount: "", note: "" }}
              useForm={useForms[selectedCustomer.id] ?? { amount: "", note: "" }}
              memoForm={memoForms[selectedCustomer.id] ?? { memo: selectedCustomer.memo ?? "" }}
              expanded={expandedTransactionCustomers.includes(selectedCustomer.id)}
              setExpandedTransactionCustomers={setExpandedTransactionCustomers}
              setChargeForm={setChargeForm}
              setUseForm={setUseForm}
              setMemoForms={setMemoForms}
              saveMemo={saveMemo}
              chargeBalance={chargeBalance}
              useBalance={useBalance}
              cancelTransaction={cancelTransaction}
              deleteCustomer={deleteCustomer}
            />
          ) : (
            <div className="rounded-[16px] border border-dashed border-latte bg-white px-4 py-16 text-center text-sm font-semibold text-muted">
              손님을 선택하면 충전·사용 차감·최근 내역이 여기에서 열립니다.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function SelectedCustomerLedger(props: {
  customer: PrepaidCustomerDto;
  chargeForm: ChargeLedgerForm;
  useForm: UseLedgerForm;
  memoForm: MemoEditForm;
  expanded: boolean;
  setExpandedTransactionCustomers: Dispatch<SetStateAction<string[]>>;
  setChargeForm: (customerId: string, next: Partial<ChargeLedgerForm>) => void;
  setUseForm: (customerId: string, next: Partial<UseLedgerForm>) => void;
  setMemoForms: Dispatch<SetStateAction<Record<string, MemoEditForm>>>;
  saveMemo: (customer: PrepaidCustomerDto) => Promise<void>;
  chargeBalance: (customer: PrepaidCustomerDto) => Promise<void>;
  useBalance: (customer: PrepaidCustomerDto) => Promise<void>;
  cancelTransaction: (customer: PrepaidCustomerDto, transaction: PrepaidTransactionDto) => Promise<void>;
  deleteCustomer: (customer: PrepaidCustomerDto) => Promise<void>;
}) {
  const {
    customer,
    chargeForm,
    useForm,
    memoForm,
    expanded,
    setExpandedTransactionCustomers,
    setChargeForm,
    setUseForm,
    setMemoForms,
    saveMemo,
    chargeBalance,
    useBalance,
    cancelTransaction,
    deleteCustomer
  } = props;
  const displayedTransactions = expanded ? customer.transactions : customer.transactions.slice(0, 5);

  return (
    <article id="selected-prepaid-detail" aria-label={`${customer.customerName} 선결제 장부`} className="grid gap-3">
      <div className="rounded-[18px] border border-latte bg-white p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div className="min-w-0">
            <p className="text-xs font-extrabold text-bread">현재 선택한 손님</p>
            <h3 className="mt-1 truncate text-2xl font-extrabold text-ink">{customer.customerName}님</h3>
            <p className="mt-1 text-sm font-semibold text-muted">{customer.contactPhone || "연락처 없음"}</p>
            {customer.memo ? <p className="mt-2 rounded-[10px] bg-cream/60 px-3 py-2 text-sm font-semibold text-cocoa">{customer.memo}</p> : null}
          </div>
          <div className="rounded-[16px] bg-bread px-6 py-4 text-right text-white shadow-control">
            <p className="text-xs font-bold opacity-80">현재 잔액</p>
            <p className="mt-1 text-3xl font-extrabold tracking-[-0.04em]">{formatCurrency(customer.balance)}원</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <section className="rounded-[16px] border border-latte bg-white p-4">
          <h3 className="text-base font-extrabold text-ink">사용 차감</h3>
          <p className="mt-1 text-xs font-semibold text-muted">손님이 제품을 가져가면 여기서 잔액을 뺍니다.</p>
          <div className="mt-3 grid gap-2">
            <label className="grid gap-1">
              <span className="text-xs font-semibold text-muted">사용 금액</span>
              <span className="relative block">
                <input aria-label={`${customer.customerName} 사용 금액`} className="input w-full pr-8 text-right" inputMode="numeric" placeholder="5,000" value={useForm.amount} onChange={(event) => setUseForm(customer.id, { amount: formatAmountInput(event.target.value) })} />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted">원</span>
              </span>
            </label>
            <label className="grid gap-1">
              <span className="text-xs font-semibold text-muted">사용 내용</span>
              <input aria-label={`${customer.customerName} 사용 내용`} className="input" placeholder="예: 바게트 픽업" value={useForm.note} onChange={(event) => setUseForm(customer.id, { note: event.target.value })} />
            </label>
            <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-cocoa px-4 text-sm font-bold text-white transition hover:bg-bread" type="button" onClick={() => void useBalance(customer)}>
              <MinusCircle className="h-4 w-4" aria-hidden="true" />
              {customer.customerName} 사용 처리
            </button>
          </div>
        </section>

        <section className="rounded-[16px] border border-latte bg-white p-4">
          <h3 className="text-base font-extrabold text-ink">추가 충전</h3>
          <p className="mt-1 text-xs font-semibold text-muted">선결제 금액을 더 받을 때 잔액을 올립니다.</p>
          <div className="mt-3 grid gap-2">
            <label className="grid gap-1">
              <span className="text-xs font-semibold text-muted">충전 금액</span>
              <span className="relative block">
                <input aria-label={`${customer.customerName} 추가 충전 금액`} className="input w-full pr-8 text-right" inputMode="numeric" placeholder="20,000" value={chargeForm.amount} onChange={(event) => setChargeForm(customer.id, { amount: formatAmountInput(event.target.value) })} />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted">원</span>
              </span>
            </label>
            <label className="grid gap-1">
              <span className="text-xs font-semibold text-muted">충전 메모</span>
              <input aria-label={`${customer.customerName} 추가 충전 메모`} className="input" placeholder="예: 식빵 추가 충전" value={chargeForm.note} onChange={(event) => setChargeForm(customer.id, { note: event.target.value })} />
            </label>
            <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-bread px-4 text-sm font-bold text-white transition hover:bg-cocoa" type="button" onClick={() => void chargeBalance(customer)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              {customer.customerName} 추가 충전
            </button>
          </div>
        </section>
      </div>

      <section className="rounded-[16px] border border-latte bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-extrabold text-ink">최근 내역</h3>
            <p className="mt-1 text-xs font-semibold text-muted">되돌리기는 잘못 누른 바로 그 줄에서 처리합니다.</p>
          </div>
          <button className="rounded-full border border-red/20 bg-red/10 px-3 py-1 text-xs font-bold text-red" type="button" onClick={() => void deleteCustomer(customer)}>
            장부 삭제
          </button>
        </div>
        <div className="mt-3 grid gap-2">
          {displayedTransactions.map((transaction) => (
            <div key={transaction.id} className="grid gap-2 rounded-[12px] border border-latte bg-cream/30 px-3 py-2 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-extrabold ${transactionToneClass(transaction.type)}`}>{transactionLabel(transaction.type)}</span>
                  <span className="font-extrabold text-ink">{transactionAmountLabel(transaction)}</span>
                  <span className="text-xs font-semibold text-muted">{formatLedgerDate(transaction.occurredAt)}</span>
                </div>
                {transaction.note ? <p className="mt-1 min-w-0 text-cocoa">{transaction.note}</p> : null}
              </div>
              <button className="inline-flex min-h-9 items-center justify-center gap-1 rounded-full border border-latte bg-white px-3 py-1 text-xs font-extrabold text-cocoa shadow-sm transition hover:bg-red/10 hover:text-red" type="button" onClick={() => void cancelTransaction(customer, transaction)}>
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                되돌리기
              </button>
            </div>
          ))}
          {customer.transactions.length === 0 ? <p className="rounded-control bg-cream/50 px-3 py-4 text-center text-sm font-semibold text-muted">내역 없음</p> : null}
          {customer.transactions.length > 5 ? (
            <button
              type="button"
              className="rounded-[0.9rem] border border-latte bg-white px-3 py-2 text-xs font-extrabold text-cocoa transition hover:bg-cream"
              onClick={() =>
                setExpandedTransactionCustomers((current) =>
                  current.includes(customer.id) ? current.filter((id) => id !== customer.id) : [...current, customer.id]
                )
              }
            >
              {expanded ? `${customer.customerName} 최근 거래 5개만 보기` : `${customer.customerName} 전체 거래 내역 ${customer.transactions.length}건 보기`}
            </button>
          ) : null}
        </div>
      </section>

      <section className="rounded-[16px] border border-latte bg-white p-4">
        <h3 className="text-base font-extrabold text-ink">손님 메모</h3>
        <label className="mt-3 grid gap-1">
          <span className="text-xs font-bold text-muted">기타 메모</span>
          <textarea aria-label={`${customer.customerName} 기타 메모`} className="input min-h-20 resize-y" value={memoForm.memo} onChange={(event) => setMemoForms((current) => ({ ...current, [customer.id]: { memo: event.target.value } }))} />
        </label>
        <button type="button" className="mt-2 rounded-full border border-latte bg-white px-3 py-1 text-xs font-extrabold text-cocoa shadow-sm transition hover:bg-cream" onClick={() => void saveMemo(customer)}>
          기타 메모 수정
        </button>
      </section>
    </article>
  );
}
