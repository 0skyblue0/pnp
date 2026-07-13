import { MinusCircle, Plus, UserPlus, Users } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction
} from "react";

import { apiDelete, apiGet, apiPatch, apiPost } from "../../shared/api/client.js";
import type { ListEnvelope } from "../../shared/api/types.js";
import { useConfirm } from "../../shared/ui/ConfirmDialog.js";

type PrepaidTransactionDto = {
  id: string;
  participantId: string | null;
  type: string;
  amount: number;
  note: string | null;
  occurredAt: string;
  createdAt: string;
};

type PrepaidParticipantDto = {
  id: string;
  participantName: string;
  phoneLast4: string;
  limitAmount: number;
  usedAmount: number;
  remainingAmount: number;
  lastUsedAt: string | null;
};

type PrepaidCustomerDto = {
  id: string;
  customerName: string;
  contactPhone: string | null;
  memo: string | null;
  ledgerType: "GENERAL" | "SHARED";
  sharedLimit: number | null;
  balance: number;
  lastUsedAt: string | null;
  transactions: PrepaidTransactionDto[];
  participants: PrepaidParticipantDto[];
};

type NewLedgerForm = {
  ledgerType: "GENERAL" | "SHARED";
  customerName: string;
  contactPhone: string;
  amount: string;
  sharedLimit: string;
  participantsText: string;
  memo: string;
};

type LedgerForm = {
  amount: string;
  note: string;
};

type SharedUseForm = {
  name: string;
  phoneLast4: string;
  amount: string;
  note: string;
};

type SharedUsageSummary = {
  key: string;
  name: string;
  phoneLast4: string;
  total: number;
  count: number;
  lastUsedAt: string;
};

type MemoEditForm = {
  memo: string;
};

type DetailMode = "DETAIL" | "CHARGE" | "USE";

function emptyNewLedgerForm(): NewLedgerForm {
  return {
    ledgerType: "GENERAL",
    customerName: "",
    contactPhone: "",
    amount: "",
    sharedLimit: "",
    participantsText: "",
    memo: ""
  };
}

function emptySharedUseForm(): SharedUseForm {
  return { name: "", phoneLast4: "", amount: "", note: "" };
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
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(value));
}

function transactionLabel(type: string): string {
  return type === "USE" ? "사용" : "충전";
}

function transactionAmountLabel(transaction: PrepaidTransactionDto): string {
  const sign = transaction.type === "USE" ? "-" : "+";
  return `${sign}${formatCurrency(transaction.amount)}`;
}

function transactionToneClass(type: string): string {
  return type === "USE" ? "bg-[#F4E3D8] text-[#8C4A32]" : "bg-[#EAF1F7] text-[#3B6EA5]";
}

function lastTransactionText(customer: PrepaidCustomerDto): string {
  const last = customer.transactions[0];
  if (!last) return "거래 내역 없음";
  return `${formatLedgerDate(last.occurredAt)} ${transactionLabel(last.type)} ${transactionAmountLabel(last)}`;
}

function parseSharedLimitText(value: string | null | undefined): number {
  if (!value) return 0;
  const match = value.match(/(?:1인\s*한도|한도|각)\s*([0-9,]+)\s*원?/);
  const amount = match?.[1];
  return amount ? Number(amount.replace(/,/g, "")) : 0;
}

function suggestedSharedLimit(customer: PrepaidCustomerDto): number {
  const memoLimit = parseSharedLimitText(customer.memo);
  if (memoLimit > 0) return memoLimit;
  for (const transaction of customer.transactions) {
    const limit = parseSharedLimitText(transaction.note);
    if (limit > 0) return limit;
  }
  return 0;
}

function parseSharedUseNote(note: string | null): { name: string; phoneLast4: string } | null {
  if (!note?.includes("공동 사용")) return null;
  const named = note.match(/공동 사용\s*-\s*(.+?)\((\d{4})\)/);
  const namedUser = named?.[1];
  const namedPhone = named?.[2];
  if (namedUser && namedPhone) return { name: namedUser.trim(), phoneLast4: namedPhone };
  const phoneOnly = note.match(/공동 사용\s*-\s*뒷자리\s*(\d{4})/);
  const phoneOnlyLast4 = phoneOnly?.[1];
  if (phoneOnlyLast4) return { name: "이름 없음", phoneLast4: phoneOnlyLast4 };
  return null;
}

function parseParticipantLines(
  value: string,
  defaultLimit: number
): Array<{ participantName: string; phoneLast4: string; limitAmount: number }> {
  return value
    .split(/\n|,/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const phoneLast4 = line.replace(/\D/g, "").slice(-4);
      const participantName = line
        .replace(/\(?\d{4}\)?/g, "")
        .replace(/[-/]/g, " ")
        .trim();
      return phoneLast4.length === 4 && participantName
        ? { participantName, phoneLast4, limitAmount: defaultLimit }
        : null;
    })
    .filter(
      (
        participant
      ): participant is { participantName: string; phoneLast4: string; limitAmount: number } =>
        Boolean(participant)
    );
}

function sharedUsageSummaries(customer: PrepaidCustomerDto): SharedUsageSummary[] {
  const summaries = new Map<string, SharedUsageSummary>();
  for (const transaction of customer.transactions) {
    if (transaction.type !== "USE") continue;
    const parsed = parseSharedUseNote(transaction.note);
    if (!parsed) continue;
    const key = parsed.phoneLast4;
    const current = summaries.get(key) ?? {
      key,
      name: parsed.name,
      phoneLast4: parsed.phoneLast4,
      total: 0,
      count: 0,
      lastUsedAt: transaction.occurredAt
    };
    current.name = parsed.name !== "이름 없음" ? parsed.name : current.name;
    current.total += transaction.amount;
    current.count += 1;
    if (new Date(transaction.occurredAt).getTime() > new Date(current.lastUsedAt).getTime()) {
      current.lastUsedAt = transaction.occurredAt;
    }
    summaries.set(key, current);
  }
  return [...summaries.values()].sort((left, right) => right.total - left.total);
}

export function PrepaidLedgerPage() {
  const confirm = useConfirm();
  const [customers, setCustomers] = useState<PrepaidCustomerDto[]>([]);
  const [query, setQuery] = useState("");
  const [newForm, setNewForm] = useState<NewLedgerForm>(() => emptyNewLedgerForm());
  const [useForms, setUseForms] = useState<Record<string, LedgerForm>>({});
  const [sharedUseForms, setSharedUseForms] = useState<Record<string, SharedUseForm>>({});
  const [chargeForms, setChargeForms] = useState<Record<string, LedgerForm>>({});
  const [memoForms, setMemoForms] = useState<Record<string, MemoEditForm>>({});
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [detailMode, setDetailMode] = useState<DetailMode>("DETAIL");
  const [showNewForm, setShowNewForm] = useState(false);
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
  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === selectedCustomerId) ?? null,
    [customers, selectedCustomerId]
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
    setSelectedCustomerId((current) => {
      if (current && envelope.data.items.some((customer) => customer.id === current))
        return current;
      return null;
    });
  }, [query]);

  useEffect(() => {
    void loadLedger();
  }, [loadLedger]);

  function setUseForm(customerId: string, next: Partial<LedgerForm>) {
    setUseForms((current) => ({
      ...current,
      [customerId]: {
        amount: current[customerId]?.amount ?? "",
        note: current[customerId]?.note ?? "",
        ...next
      }
    }));
  }

  function setChargeForm(customerId: string, next: Partial<LedgerForm>) {
    setChargeForms((current) => ({
      ...current,
      [customerId]: {
        amount: current[customerId]?.amount ?? "",
        note: current[customerId]?.note ?? "",
        ...next
      }
    }));
  }

  function setSharedUseForm(customerId: string, next: Partial<SharedUseForm>) {
    setSharedUseForms((current) => {
      const previous = current[customerId] ?? emptySharedUseForm();
      return {
        ...current,
        [customerId]: {
          name: next.name ?? previous.name,
          phoneLast4: next.phoneLast4 ?? previous.phoneLast4,
          amount: next.amount ?? previous.amount,
          note: next.note ?? previous.note
        }
      };
    });
  }

  function openCustomer(customer: PrepaidCustomerDto, mode: DetailMode) {
    setSelectedCustomerId(customer.id);
    setDetailMode(mode);
    setMemoForms((current) => ({
      ...current,
      [customer.id]: { memo: current[customer.id]?.memo ?? customer.memo ?? "" }
    }));
  }

  async function saveMemo(customer: PrepaidCustomerDto) {
    setMessage(null);
    setError(null);
    const memo = memoForms[customer.id]?.memo ?? customer.memo ?? "";
    const envelope = await apiPatch<PrepaidCustomerDto, Record<string, unknown>>(
      `/prepaid-ledger/${customer.id}`,
      { memo }
    );
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
    const sharedLimit = digitsToNumber(newForm.sharedLimit);
    if (newForm.ledgerType === "SHARED" && sharedLimit <= 0) {
      setError("공동 선결제는 1인 한도를 입력해 주세요.");
      return;
    }
    const body: Record<string, unknown> = {
      customerName: newForm.customerName,
      amount,
      ledgerType: newForm.ledgerType
    };
    if (newForm.contactPhone) body.contactPhone = newForm.contactPhone;
    if (newForm.memo) body.memo = newForm.memo;
    if (newForm.ledgerType === "SHARED") {
      body.sharedLimit = sharedLimit;
      const participants = parseParticipantLines(newForm.participantsText, sharedLimit);
      if (participants.length > 0) body.participants = participants;
    }
    const envelope = await apiPost<PrepaidCustomerDto, Record<string, unknown>>(
      "/prepaid-ledger",
      body
    );
    if (envelope.error) {
      setError(envelope.error.message);
      return;
    }
    setMessage(`선결제 등록 완료 #${envelope.data.id}`);
    setSelectedCustomerId(envelope.data.id);
    setDetailMode("DETAIL");
    setShowNewForm(false);
    setNewForm(emptyNewLedgerForm());
    await loadLedger();
  }

  async function useBalance(customer: PrepaidCustomerDto) {
    setMessage(null);
    setError(null);
    const form = useForms[customer.id] ?? { amount: "", note: "" };
    const amount = digitsToNumber(form.amount);
    if (amount <= 0) {
      setError("사용 금액을 입력해 주세요.");
      return;
    }
    const body: Record<string, unknown> = { amount };
    if (form.note.trim()) body.note = form.note;
    const envelope = await apiPost<PrepaidCustomerDto, Record<string, unknown>>(
      `/prepaid-ledger/${customer.id}/use`,
      body
    );
    if (envelope.error) {
      setError(envelope.error.message);
      return;
    }
    setMessage(`사용 처리 완료 #${customer.id}`);
    setUseForms((current) => ({ ...current, [customer.id]: { amount: "", note: "" } }));
    setDetailMode("DETAIL");
    await loadLedger();
  }

  async function useSharedBalance(customer: PrepaidCustomerDto) {
    setMessage(null);
    setError(null);
    const form = sharedUseForms[customer.id] ?? emptySharedUseForm();
    const amount = digitsToNumber(form.amount);
    const phoneLast4 = form.phoneLast4.replace(/\D/g, "").slice(-4);
    const participant = customer.participants.find((item) => item.phoneLast4 === phoneLast4);
    const remainingLimit = participant?.remainingAmount ?? customer.sharedLimit ?? 0;
    const participantName = form.name.trim() || participant?.participantName || "";
    if (amount <= 0 || phoneLast4.length < 4 || !participantName) {
      setError("공동 사용은 이름, 휴대폰 뒷자리 4자리, 사용 금액을 입력해 주세요.");
      return;
    }
    const userLabel = `${participantName}(${phoneLast4})`;
    if (amount > remainingLimit) {
      setError(`${userLabel}님 남은 한도는 ${formatCurrency(remainingLimit)}원입니다.`);
      return;
    }
    const envelope = await apiPost<PrepaidCustomerDto, Record<string, unknown>>(
      `/prepaid-ledger/${customer.id}/shared-use`,
      {
        amount,
        participantName,
        phoneLast4,
        ...(form.note.trim() ? { note: form.note.trim() } : {})
      }
    );
    if (envelope.error) {
      setError(envelope.error.message);
      return;
    }
    setMessage(`${userLabel} 공동 사용 처리 완료 #${customer.id}`);
    setSharedUseForms((current) => ({ ...current, [customer.id]: emptySharedUseForm() }));
    setDetailMode("DETAIL");
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
    const envelope = await apiPost<PrepaidCustomerDto, Record<string, unknown>>(
      `/prepaid-ledger/${customer.id}/charge`,
      body
    );
    if (envelope.error) {
      setError(envelope.error.message);
      return;
    }
    setMessage(`추가 충전 완료 #${customer.id}`);
    setChargeForms((current) => ({ ...current, [customer.id]: { amount: "", note: "" } }));
    setDetailMode("DETAIL");
    await loadLedger();
  }

  async function deleteTransaction(
    customer: PrepaidCustomerDto,
    transaction: PrepaidTransactionDto
  ) {
    const label = `${transactionLabel(transaction.type)} ${formatCurrency(transaction.amount)}원`;
    const confirmed = await confirm({
      title: "내역 삭제",
      message: `${customer.customerName}님 ${label} 내역을 삭제할까요?\n잘못 입력한 내역만 삭제하고, 필요하면 정확한 금액으로 다시 입력해 주세요.`,
      confirmLabel: "삭제",
      tone: "danger"
    });
    if (!confirmed) return;
    setMessage(null);
    setError(null);
    const envelope = await apiDelete<PrepaidCustomerDto>(
      `/prepaid-ledger/${customer.id}/transactions/${transaction.id}`
    );
    if (envelope.error) {
      setError(envelope.error.message);
      return;
    }
    setMessage(`${label} 내역 삭제 완료 #${customer.id}`);
    setDetailMode("DETAIL");
    await loadLedger();
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-4">
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="section-title">선결제 장부</h2>
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="prepaid-search">
              손님 검색
            </label>
            <input
              id="prepaid-search"
              aria-label="손님 검색"
              className="input h-10 w-64"
              placeholder="손님 이름 또는 연락처 검색"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <button
              className="inline-flex min-h-10 items-center gap-2 rounded-control bg-bread px-4 text-sm font-bold text-white transition hover:bg-cocoa"
              type="button"
              onClick={() => setShowNewForm((current) => !current)}
            >
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              신규 등록
            </button>
          </div>
        </div>

        <div className="rounded-[14px] border border-latte bg-white px-5 py-4">
          <div className="flex flex-wrap gap-8">
            <div>
              <p className="text-[11px] font-semibold text-muted">검색된 손님 수</p>
              <p className="mt-1 text-xl font-extrabold text-ink">
                {formatCurrency(customers.length)}명
              </p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-muted">총 잔액</p>
              <p className="mt-1 text-xl font-extrabold text-bread">
                {formatCurrency(totalBalance)}원
              </p>
            </div>
          </div>
        </div>
      </section>

      {message ? (
        <div className="rounded-control border border-green/20 bg-green/10 px-3 py-2 text-sm font-semibold text-green">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-control border border-red/20 bg-red/10 px-3 py-2 text-sm font-semibold text-red">
          {error}
        </div>
      ) : null}

      {showNewForm ? (
        <NewPrepaidForm
          form={newForm}
          setForm={setNewForm}
          createLedger={createLedger}
          onClose={() => setShowNewForm(false)}
        />
      ) : null}

      <section className="rounded-[14px] border border-latte bg-white px-5 py-3">
        <div className="grid grid-cols-[1fr_1.25fr_0.9fr_1.6fr_1.7fr] gap-2 border-b border-[#EFE8DC] px-1 py-3 text-[11.5px] font-bold text-muted">
          <div>이름</div>
          <div>연락처</div>
          <div>잔액</div>
          <div>최근 거래</div>
          <div>액션</div>
        </div>
        <div>
          {sortedCustomers.map((customer) => (
            <div
              key={customer.id}
              className="grid grid-cols-[1fr_1.25fr_0.9fr_1.6fr_1.7fr] items-center gap-2 border-b border-[#F5F0E7] px-1 py-3 text-sm text-ink last:border-b-0"
            >
              <button
                type="button"
                className="text-left font-bold text-ink underline-offset-4 hover:underline"
                onClick={() => openCustomer(customer, "DETAIL")}
              >
                {customer.customerName}님
              </button>
              <div className="text-[12.5px] font-semibold text-muted">
                {customer.contactPhone || "연락처 없음"}
              </div>
              <div className="font-extrabold">{formatCurrency(customer.balance)}원</div>
              <div className="text-[12.5px] font-semibold text-muted">
                {lastTransactionText(customer)}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-[8px] bg-[#EAF1F7] px-3 py-1.5 text-xs font-bold text-[#3B6EA5]"
                  onClick={() => openCustomer(customer, "CHARGE")}
                >
                  충전
                </button>
                <button
                  type="button"
                  className="rounded-[8px] bg-[#F4E3D8] px-3 py-1.5 text-xs font-bold text-[#8C4A32]"
                  onClick={() => openCustomer(customer, "USE")}
                >
                  사용
                </button>
                <button
                  type="button"
                  className="rounded-[8px] bg-[#F5F0E7] px-3 py-1.5 text-xs font-bold text-muted"
                  onClick={() => openCustomer(customer, "DETAIL")}
                >
                  세부내역
                </button>
                <button
                  type="button"
                  className="rounded-[8px] bg-red/10 px-3 py-1.5 text-xs font-bold text-red"
                  onClick={() => void deleteCustomer(customer)}
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
          {!isLoading && customers.length === 0 ? (
            <p className="px-3 py-12 text-center text-sm font-semibold text-muted">
              선결제 장부에 등록된 손님이 없습니다.
            </p>
          ) : null}
        </div>
      </section>

      {selectedCustomer ? (
        <SelectedCustomerDetail
          customer={selectedCustomer}
          mode={detailMode}
          chargeForm={chargeForms[selectedCustomer.id] ?? { amount: "", note: "" }}
          useForm={useForms[selectedCustomer.id] ?? { amount: "", note: "" }}
          sharedUseForm={sharedUseForms[selectedCustomer.id] ?? emptySharedUseForm()}
          memoForm={memoForms[selectedCustomer.id] ?? { memo: selectedCustomer.memo ?? "" }}
          setChargeForm={setChargeForm}
          setUseForm={setUseForm}
          setSharedUseForm={setSharedUseForm}
          setMemoForms={setMemoForms}
          chargeBalance={chargeBalance}
          useBalance={useBalance}
          useSharedBalance={useSharedBalance}
          saveMemo={saveMemo}
          deleteTransaction={deleteTransaction}
        />
      ) : null}
    </div>
  );
}

function NewPrepaidForm(props: {
  form: NewLedgerForm;
  setForm: Dispatch<SetStateAction<NewLedgerForm>>;
  createLedger: () => Promise<void>;
  onClose: () => void;
}) {
  const { form, setForm, createLedger, onClose } = props;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/35 px-4 py-6"
      role="presentation"
    >
      <section
        id="new-prepaid-form"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-prepaid-title"
        className="w-full max-w-3xl rounded-[18px] border border-latte bg-white p-5 shadow-xl"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-bread" aria-hidden="true" />
            <h3 id="new-prepaid-title" className="text-base font-extrabold text-ink">
              신규 등록
            </h3>
          </div>
          <button
            type="button"
            className="rounded-full border border-latte bg-white px-3 py-1 text-xs font-extrabold text-cocoa hover:bg-cream"
            onClick={onClose}
          >
            닫기
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-[12px] bg-cream p-1">
          {(["GENERAL", "SHARED"] as const).map((ledgerType) => (
            <button
              key={ledgerType}
              type="button"
              className={`min-h-10 rounded-[10px] text-sm font-extrabold ${form.ledgerType === ledgerType ? "bg-white text-bread shadow-sm" : "text-muted"}`}
              onClick={() => setForm((current) => ({ ...current, ledgerType }))}
            >
              {ledgerType === "GENERAL" ? "일반" : "공동"}
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="grid gap-1">
            <span className="field-label">손님 이름</span>
            <input
              aria-label="새 손님 이름"
              className="input"
              placeholder="홍길동"
              value={form.customerName}
              onChange={(event) =>
                setForm((current) => ({ ...current, customerName: event.target.value }))
              }
            />
          </label>
          <label className="grid gap-1">
            <span className="field-label">연락처</span>
            <input
              aria-label="새 손님 연락처"
              className="input"
              inputMode="numeric"
              placeholder="010-0000-0000"
              value={form.contactPhone}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  contactPhone: formatPhoneInput(event.target.value)
                }))
              }
            />
          </label>
          <label className="grid gap-1">
            <span className="field-label whitespace-nowrap">선결제 금액</span>
            <span className="relative block">
              <input
                aria-label="선결제 금액"
                className="input w-full pr-8 text-right"
                inputMode="numeric"
                placeholder="50,000"
                value={form.amount}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    amount: formatAmountInput(event.target.value)
                  }))
                }
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted">
                원
              </span>
            </span>
          </label>
        </div>
        {form.ledgerType === "SHARED" ? (
          <div className="mt-3 grid gap-3 rounded-[12px] border border-[#E8D6C7] bg-[#FFFBF6] p-3 md:grid-cols-[0.8fr_1.4fr]">
            <label className="grid gap-1">
              <span className="field-label">1인 한도</span>
              <span className="relative block">
                <input
                  aria-label="공동 선결제 1인 한도"
                  className="input w-full pr-8 text-right"
                  inputMode="numeric"
                  placeholder="30,000"
                  value={form.sharedLimit}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      sharedLimit: formatAmountInput(event.target.value)
                    }))
                  }
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted">
                  원
                </span>
              </span>
            </label>
            <label className="grid gap-1">
              <span className="field-label">
                참여자 <span className="font-normal">(선택)</span>
              </span>
              <textarea
                aria-label="공동 선결제 참여자"
                className="input min-h-16 resize-y"
                placeholder="예: 홍길동 1234, 이영희 5678"
                value={form.participantsText}
                onChange={(event) =>
                  setForm((current) => ({ ...current, participantsText: event.target.value }))
                }
              />
            </label>
          </div>
        ) : null}
        <label className="mt-3 grid gap-1">
          <span className="field-label">메모</span>
          <textarea
            aria-label="선결제 메모"
            className="input min-h-20 resize-y"
            placeholder="예: 법인카드 5명 각 30,000원 / 뒷자리 1234, 5678 확인"
            value={form.memo}
            onChange={(event) => setForm((current) => ({ ...current, memo: event.target.value }))}
          />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="inline-flex min-h-10 items-center justify-center rounded-control border border-latte bg-white px-5 text-sm font-bold text-cocoa transition hover:bg-cream"
            onClick={onClose}
          >
            취소
          </button>
          <button
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-control bg-bread px-5 text-sm font-bold text-white transition hover:bg-cocoa"
            type="button"
            onClick={() => void createLedger()}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            선결제 등록
          </button>
        </div>
      </section>
    </div>
  );
}

function SelectedCustomerDetail(props: {
  customer: PrepaidCustomerDto;
  mode: DetailMode;
  chargeForm: LedgerForm;
  useForm: LedgerForm;
  sharedUseForm: SharedUseForm;
  memoForm: MemoEditForm;
  setChargeForm: (customerId: string, next: Partial<LedgerForm>) => void;
  setUseForm: (customerId: string, next: Partial<LedgerForm>) => void;
  setSharedUseForm: (customerId: string, next: Partial<SharedUseForm>) => void;
  setMemoForms: Dispatch<SetStateAction<Record<string, MemoEditForm>>>;
  chargeBalance: (customer: PrepaidCustomerDto) => Promise<void>;
  useBalance: (customer: PrepaidCustomerDto) => Promise<void>;
  useSharedBalance: (customer: PrepaidCustomerDto) => Promise<void>;
  saveMemo: (customer: PrepaidCustomerDto) => Promise<void>;
  deleteTransaction: (
    customer: PrepaidCustomerDto,
    transaction: PrepaidTransactionDto
  ) => Promise<void>;
}) {
  const {
    customer,
    mode,
    chargeForm,
    useForm,
    sharedUseForm,
    memoForm,
    setChargeForm,
    setUseForm,
    setSharedUseForm,
    setMemoForms,
    chargeBalance,
    useBalance,
    useSharedBalance,
    saveMemo,
    deleteTransaction
  } = props;

  const sharedLimit = customer.sharedLimit ?? suggestedSharedLimit(customer);
  const sharedSummaries =
    customer.participants.length > 0
      ? customer.participants
      : sharedUsageSummaries(customer).map((summary) => ({
          id: summary.key,
          participantName: summary.name,
          phoneLast4: summary.phoneLast4,
          limitAmount: sharedLimit,
          usedAmount: summary.total,
          remainingAmount: sharedLimit > 0 ? Math.max(sharedLimit - summary.total, 0) : 0,
          lastUsedAt: summary.lastUsedAt
        }));
  const selectedSharedPhone = sharedUseForm.phoneLast4.replace(/\D/g, "").slice(-4);
  const selectedParticipant = selectedSharedPhone
    ? sharedSummaries.find((summary) => summary.phoneLast4 === selectedSharedPhone)
    : undefined;
  const selectedSharedRemaining = selectedParticipant?.remainingAmount ?? sharedLimit;

  return (
    <article
      id="selected-prepaid-detail"
      aria-label={`${customer.customerName} 선결제 장부`}
      className="rounded-[14px] border border-latte bg-white p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#EFE8DC] pb-4">
        <div>
          <p className="text-xs font-extrabold text-bread">현재 선택한 손님</p>
          <h3 className="mt-1 text-2xl font-extrabold text-ink">{customer.customerName}님</h3>
          <p className="mt-1 text-sm font-semibold text-muted">
            {customer.contactPhone || "연락처 없음"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold text-muted">현재 잔액</p>
          <p className="mt-1 text-3xl font-extrabold text-bread">
            {formatCurrency(customer.balance)}원
          </p>
        </div>
      </div>

      {mode === "USE" ? (
        <section className="mt-4 rounded-[12px] bg-[#F4E3D8]/60 p-4">
          <h3 className="text-base font-extrabold text-ink">사용</h3>
          <div className="mt-3 grid gap-2 md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto] md:items-end">
            <label className="grid gap-1">
              <span className="text-xs font-semibold text-muted">사용 금액</span>
              <input
                aria-label={`${customer.customerName} 사용 금액`}
                className="input text-right"
                inputMode="numeric"
                placeholder="5,000"
                value={useForm.amount}
                onChange={(event) =>
                  setUseForm(customer.id, { amount: formatAmountInput(event.target.value) })
                }
              />
            </label>
            <label className="grid gap-1">
              <span className="text-xs font-semibold text-muted">
                사용 내용 <span className="font-normal">(선택)</span>
              </span>
              <input
                aria-label={`${customer.customerName} 사용 내용`}
                className="input"
                placeholder="안 적어도 사용 처리 가능"
                value={useForm.note}
                onChange={(event) => setUseForm(customer.id, { note: event.target.value })}
              />
            </label>
            <button
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-control bg-cocoa px-4 text-sm font-bold text-white transition hover:bg-bread md:col-span-2 lg:col-span-1"
              type="button"
              onClick={() => void useBalance(customer)}
            >
              <MinusCircle className="h-4 w-4" aria-hidden="true" />
              {customer.customerName} 사용 처리
            </button>
          </div>

          <div className="mt-4 rounded-[12px] border border-[#E8D6C7] bg-white/70 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <Users className="mt-0.5 h-4 w-4 text-cocoa" aria-hidden="true" />
                <div>
                  <h4 className="text-sm font-extrabold text-ink">공동 사용</h4>
                  <p className="mt-1 text-xs font-semibold text-muted">
                    등록된 사람을 선택하고 남은 한도 안에서 차감합니다.
                  </p>
                </div>
              </div>
              {sharedLimit > 0 ? (
                <span className="rounded-full bg-cream px-3 py-1 text-xs font-extrabold text-cocoa">
                  1인 한도 {formatCurrency(sharedLimit)}원
                </span>
              ) : null}
            </div>

            <div className="mt-3 grid gap-2 md:grid-cols-[1fr_0.9fr_1fr_auto] md:items-end">
              <label className="grid gap-1">
                <span className="text-xs font-semibold text-muted">이름</span>
                <input
                  aria-label={`${customer.customerName} 공동 사용자 이름`}
                  className="input"
                  placeholder={selectedParticipant?.participantName ?? "홍길동"}
                  value={sharedUseForm.name}
                  onChange={(event) => setSharedUseForm(customer.id, { name: event.target.value })}
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold text-muted">뒷자리</span>
                <input
                  aria-label={`${customer.customerName} 공동 사용자 휴대폰 뒷자리`}
                  className="input text-center"
                  inputMode="numeric"
                  placeholder="1234"
                  value={sharedUseForm.phoneLast4}
                  onChange={(event) =>
                    setSharedUseForm(customer.id, {
                      phoneLast4: event.target.value.replace(/\D/g, "").slice(0, 4)
                    })
                  }
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold text-muted">이번 사용</span>
                <input
                  aria-label={`${customer.customerName} 공동 사용 금액`}
                  className="input text-right"
                  inputMode="numeric"
                  placeholder={
                    selectedSharedRemaining ? formatCurrency(selectedSharedRemaining) : "30,000"
                  }
                  value={sharedUseForm.amount}
                  onChange={(event) =>
                    setSharedUseForm(customer.id, { amount: formatAmountInput(event.target.value) })
                  }
                />
              </label>
              <button
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-control bg-ink px-4 text-sm font-bold text-white transition hover:bg-cocoa"
                type="button"
                onClick={() => void useSharedBalance(customer)}
              >
                차감
              </button>
            </div>
            <label className="mt-2 grid gap-1">
              <span className="text-xs font-semibold text-muted">
                메모 <span className="font-normal">(선택)</span>
              </span>
              <input
                aria-label={`${customer.customerName} 공동 사용 메모`}
                className="input"
                placeholder="예: 법인카드 5명 중 1명"
                value={sharedUseForm.note}
                onChange={(event) => setSharedUseForm(customer.id, { note: event.target.value })}
              />
            </label>
            <p className="mt-2 text-xs font-bold text-cocoa">
              {selectedParticipant
                ? `${selectedParticipant.participantName}(${selectedParticipant.phoneLast4}) 사용 ${formatCurrency(selectedParticipant.usedAmount)}원 · 남은 한도 ${formatCurrency(selectedParticipant.remainingAmount)}원`
                : "뒷자리를 입력하면 이 사람이 이미 쓴 금액과 남은 한도를 바로 확인할 수 있습니다."}
            </p>
          </div>
        </section>
      ) : null}

      {mode === "CHARGE" ? (
        <section className="mt-4 rounded-[12px] bg-[#EAF1F7] p-4">
          <h3 className="text-base font-extrabold text-ink">충전</h3>
          <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1.5fr_auto] md:items-end">
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
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-control bg-bread px-4 text-sm font-bold text-white transition hover:bg-cocoa"
              type="button"
              onClick={() => void chargeBalance(customer)}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {customer.customerName} 추가 충전
            </button>
          </div>
        </section>
      ) : null}

      <section className="mt-4">
        {sharedSummaries.length > 0 ? (
          <div className="mb-4 rounded-[12px] border border-[#E8D6C7] bg-[#FFFBF6] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-extrabold text-ink">공동 사용 현황</h3>
              {sharedLimit > 0 ? (
                <p className="text-xs font-bold text-cocoa">
                  1인 한도 {formatCurrency(sharedLimit)}원 기준
                </p>
              ) : null}
            </div>
            <div className="mt-3 grid grid-cols-[1fr_0.9fr_0.9fr_0.9fr] gap-2 border-b border-[#EFE8DC] px-1 py-2 text-[11.5px] font-bold text-muted">
              <div>사용자</div>
              <div>사용 합계</div>
              <div>남은 한도</div>
              <div>마지막</div>
            </div>
            {sharedSummaries.map((summary) => (
              <div
                key={summary.id}
                className="grid grid-cols-[1fr_0.9fr_0.9fr_0.9fr] gap-2 border-b border-[#F5F0E7] px-1 py-2 text-sm last:border-b-0"
              >
                <div className="font-bold text-ink">
                  {summary.participantName}({summary.phoneLast4})
                </div>
                <div className="font-extrabold text-cocoa">
                  {formatCurrency(summary.usedAmount)}원
                </div>
                <div className="font-bold text-ink">
                  남은 한도 {formatCurrency(summary.remainingAmount)}원
                </div>
                <div className="text-muted">
                  {summary.lastUsedAt ? formatLedgerDate(summary.lastUsedAt) : "-"}
                </div>
              </div>
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-extrabold text-ink">세부내역</h3>
          <p className="text-xs font-semibold text-muted">
            잘못 입력한 내역은 이곳에서 삭제합니다.
          </p>
        </div>
        <div className="mt-3 grid grid-cols-[0.7fr_0.8fr_0.9fr_2fr_auto] gap-2 border-b border-[#EFE8DC] px-1 py-2 text-[11.5px] font-bold text-muted">
          <div>구분</div>
          <div>금액</div>
          <div>날짜</div>
          <div>내용</div>
          <div>관리</div>
        </div>
        {customer.transactions.map((transaction) => (
          <div
            key={transaction.id}
            className="grid grid-cols-[0.7fr_0.8fr_0.9fr_2fr_auto] items-center gap-2 border-b border-[#F5F0E7] px-1 py-3 text-sm last:border-b-0"
          >
            <div>
              <span
                className={`rounded-full px-2 py-1 text-xs font-extrabold ${transactionToneClass(transaction.type)}`}
              >
                {transactionLabel(transaction.type)}
              </span>
            </div>
            <div className="font-extrabold text-ink">{transactionAmountLabel(transaction)}원</div>
            <div className="text-muted">{formatLedgerDate(transaction.occurredAt)}</div>
            <div className="text-cocoa">{transaction.note || "-"}</div>
            <button
              type="button"
              className="rounded-[8px] bg-red/10 px-3 py-1.5 text-xs font-bold text-red"
              onClick={() => void deleteTransaction(customer, transaction)}
            >
              내역 삭제
            </button>
          </div>
        ))}
        {customer.transactions.length === 0 ? (
          <p className="py-8 text-center text-sm font-semibold text-muted">내역 없음</p>
        ) : null}
      </section>

      <section className="mt-4 border-t border-[#EFE8DC] pt-4">
        <h3 className="text-base font-extrabold text-ink">손님 메모</h3>
        <label className="mt-3 grid gap-1">
          <span className="text-xs font-bold text-muted">기타 메모</span>
          <textarea
            aria-label={`${customer.customerName} 기타 메모`}
            className="input min-h-20 resize-y"
            value={memoForm.memo}
            onChange={(event) =>
              setMemoForms((current) => ({
                ...current,
                [customer.id]: { memo: event.target.value }
              }))
            }
          />
        </label>
        <button
          type="button"
          className="mt-2 rounded-full border border-latte bg-white px-3 py-1 text-xs font-extrabold text-cocoa shadow-sm transition hover:bg-cream"
          onClick={() => void saveMemo(customer)}
        >
          기타 메모 수정
        </button>
      </section>
    </article>
  );
}
