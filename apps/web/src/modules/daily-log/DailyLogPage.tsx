import { ClipboardList, PackageMinus, Plus, RefreshCcw, Soup, UsersRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { apiGet, apiPost } from "../../shared/api/client.js";
import { Button } from "../../shared/ui/Button.js";

type DailyLogDto = {
  id: string;
  date: string;
  congestionLogs: Array<{
    id: string;
    timeSlotStart: string;
    timeSlotEnd: string;
    level: number | null;
    queueInside: boolean;
    queueOutside: boolean;
    estLostCustomers: number;
  }>;
  tastingLogs: Array<{
    id: string;
    productName: string;
    recommended: boolean;
    convertedToSale: boolean | null;
    note: string | null;
  }>;
};

type ListEnvelope<T> = {
  items: T[];
  total: number;
  page: number;
  size: number;
};

type StockoutDto = {
  id: string;
  productName: string;
  date: string;
  sequence: number;
  stockoutAt: string;
  inquiryAfterStockout: "NONE" | "FEW" | "SOME" | "MANY" | "EXTREME" | null;
  discardQty: number;
  discardReason: string | null;
};

type AbsentInquiryDto = {
  id: string;
  productName: string;
  date: string;
  count: number;
  note: string | null;
};

type CongestionForm = {
  timeSlotStart: string;
  timeSlotEnd: string;
  level: string;
  queueInside: boolean;
  queueOutside: boolean;
  estLostCustomers: string;
};

type TastingForm = {
  productName: string;
  recommended: boolean;
  convertedToSale: "UNKNOWN" | "YES" | "NO";
  note: string;
};

type StockoutForm = {
  productName: string;
  sequence: string;
  stockoutAt: string;
  inquiryAfterStockout: "NONE" | "FEW" | "SOME" | "MANY" | "EXTREME";
  discardQty: string;
  discardReason: string;
};

type AbsentForm = {
  productName: string;
  note: string;
};

function todayInStoreTime(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function currentTimeInStore(): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date());
}

function defaultStockoutAt(date: string): string {
  return `${date}T${currentTimeInStore()}`;
}

function formatStockoutTime(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(value));
}

function inquiryLabel(value: StockoutDto["inquiryAfterStockout"]): string {
  if (value === "FEW") {
    return "문의 적음";
  }
  if (value === "SOME") {
    return "문의 보통";
  }
  if (value === "MANY") {
    return "문의 많음";
  }
  if (value === "EXTREME") {
    return "문의 매우 많음";
  }
  return "문의 없음";
}

export function DailyLogPage() {
  const [date, setDate] = useState(todayInStoreTime());
  const [dailyLog, setDailyLog] = useState<DailyLogDto | null>(null);
  const [stockouts, setStockouts] = useState<StockoutDto[]>([]);
  const [absentInquiries, setAbsentInquiries] = useState<AbsentInquiryDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [congestionForm, setCongestionForm] = useState<CongestionForm>({
    timeSlotStart: "12:00",
    timeSlotEnd: "13:00",
    level: "3",
    queueInside: false,
    queueOutside: false,
    estLostCustomers: "0"
  });
  const [tastingForm, setTastingForm] = useState<TastingForm>({
    productName: "",
    recommended: true,
    convertedToSale: "UNKNOWN",
    note: ""
  });
  const [stockoutForm, setStockoutForm] = useState<StockoutForm>({
    productName: "",
    sequence: "1",
    stockoutAt: defaultStockoutAt(date),
    inquiryAfterStockout: "NONE",
    discardQty: "0",
    discardReason: ""
  });
  const [absentForm, setAbsentForm] = useState<AbsentForm>({
    productName: "",
    note: ""
  });

  const totalLostCustomers = useMemo(
    () => dailyLog?.congestionLogs.reduce((total, item) => total + item.estLostCustomers, 0) ?? 0,
    [dailyLog]
  );

  const loadDailyOperations = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const [dailyLogEnvelope, stockoutEnvelope, absentEnvelope] = await Promise.all([
      apiGet<DailyLogDto>(`/daily-log/${date}`),
      apiGet<ListEnvelope<StockoutDto>>(`/stockout?from=${date}&to=${date}`),
      apiGet<ListEnvelope<AbsentInquiryDto>>(`/absent-inquiry?date=${date}`)
    ]);

    setIsLoading(false);

    if (dailyLogEnvelope.error) {
      setError(dailyLogEnvelope.error.message);
      return;
    }
    if (stockoutEnvelope.error) {
      setError(stockoutEnvelope.error.message);
      return;
    }
    if (absentEnvelope.error) {
      setError(absentEnvelope.error.message);
      return;
    }

    setDailyLog(dailyLogEnvelope.data);
    setStockouts(stockoutEnvelope.data.items);
    setAbsentInquiries(absentEnvelope.data.items);
  }, [date]);

  useEffect(() => {
    void loadDailyOperations();
  }, [loadDailyOperations]);

  useEffect(() => {
    setStockoutForm((current) => ({
      ...current,
      stockoutAt: defaultStockoutAt(date)
    }));
  }, [date]);

  async function handleSubmit<TResponse>(
    action: () => Promise<{ error: { message: string } | null; data: TResponse }>
  ) {
    setMessage(null);
    setError(null);

    const envelope = await action();
    if (envelope.error) {
      setError(envelope.error.message);
      return;
    }

    setMessage("저장 완료");
    await loadDailyOperations();
  }

  async function createCongestion() {
    await handleSubmit(() =>
      apiPost<DailyLogDto, Record<string, unknown>>(`/daily-log/${date}/congestion`, {
        timeSlotStart: congestionForm.timeSlotStart,
        timeSlotEnd: congestionForm.timeSlotEnd,
        level: Number(congestionForm.level),
        queueInside: congestionForm.queueInside,
        queueOutside: congestionForm.queueOutside,
        estLostCustomers: Number(congestionForm.estLostCustomers)
      })
    );
  }

  async function createTasting() {
    await handleSubmit(() =>
      apiPost<DailyLogDto, Record<string, unknown>>(`/daily-log/${date}/tasting`, {
        productName: tastingForm.productName,
        recommended: tastingForm.recommended,
        convertedToSale:
          tastingForm.convertedToSale === "UNKNOWN"
            ? undefined
            : tastingForm.convertedToSale === "YES",
        note: tastingForm.note || undefined
      })
    );
    setTastingForm({
      productName: "",
      recommended: true,
      convertedToSale: "UNKNOWN",
      note: ""
    });
  }

  async function createStockout() {
    await handleSubmit(() =>
      apiPost<StockoutDto, Record<string, unknown>>("/stockout", {
        productName: stockoutForm.productName,
        date,
        sequence: Number(stockoutForm.sequence),
        stockoutAt: stockoutForm.stockoutAt,
        inquiryAfterStockout: stockoutForm.inquiryAfterStockout,
        discardQty: Number(stockoutForm.discardQty),
        discardReason: stockoutForm.discardReason || undefined
      })
    );
    setStockoutForm({
      productName: "",
      sequence: "1",
      stockoutAt: defaultStockoutAt(date),
      inquiryAfterStockout: "NONE",
      discardQty: "0",
      discardReason: ""
    });
  }

  async function incrementAbsentInquiry() {
    await handleSubmit(() =>
      apiPost<AbsentInquiryDto, Record<string, unknown>>("/absent-inquiry/increment", {
        productName: absentForm.productName,
        date,
        note: absentForm.note || undefined
      })
    );
    setAbsentForm({ productName: "", note: "" });
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-4">
      <section className="panel">
        <div className="panel-heading">
          <div>
            <p className="text-sm text-muted">M1</p>
            <h2 className="section-title">일일 운영</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="input w-40"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
            <Button icon={RefreshCcw} type="button" onClick={() => void loadDailyOperations()}>
              {isLoading ? "조회 중" : "새로고침"}
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

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-control border border-stone-200 px-3 py-3">
            <p className="text-sm text-muted">혼잡 기록</p>
            <p className="mt-1 text-2xl font-semibold">{dailyLog?.congestionLogs.length ?? 0}</p>
          </div>
          <div className="rounded-control border border-stone-200 px-3 py-3">
            <p className="text-sm text-muted">추정 이탈</p>
            <p className="mt-1 text-2xl font-semibold">{totalLostCustomers}</p>
          </div>
          <div className="rounded-control border border-stone-200 px-3 py-3">
            <p className="text-sm text-muted">품절</p>
            <p className="mt-1 text-2xl font-semibold">{stockouts.length}</p>
          </div>
          <div className="rounded-control border border-stone-200 px-3 py-3">
            <p className="text-sm text-muted">미취급 문의</p>
            <p className="mt-1 text-2xl font-semibold">{absentInquiries.length}</p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="text-sm text-muted">혼잡</p>
              <h2 className="section-title">대기·이탈 기록</h2>
            </div>
            <UsersRound className="h-5 w-5 text-blue" aria-hidden="true" />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="field-label">시작</span>
              <input
                className="input"
                type="time"
                value={congestionForm.timeSlotStart}
                onChange={(event) =>
                  setCongestionForm((current) => ({
                    ...current,
                    timeSlotStart: event.target.value
                  }))
                }
              />
            </label>
            <label className="grid gap-2">
              <span className="field-label">종료</span>
              <input
                className="input"
                type="time"
                value={congestionForm.timeSlotEnd}
                onChange={(event) =>
                  setCongestionForm((current) => ({
                    ...current,
                    timeSlotEnd: event.target.value
                  }))
                }
              />
            </label>
            <label className="grid gap-2">
              <span className="field-label">혼잡도</span>
              <input
                className="input"
                max="5"
                min="1"
                type="number"
                value={congestionForm.level}
                onChange={(event) =>
                  setCongestionForm((current) => ({ ...current, level: event.target.value }))
                }
              />
            </label>
            <label className="grid gap-2">
              <span className="field-label">추정 이탈</span>
              <input
                className="input"
                min="0"
                type="number"
                value={congestionForm.estLostCustomers}
                onChange={(event) =>
                  setCongestionForm((current) => ({
                    ...current,
                    estLostCustomers: event.target.value
                  }))
                }
              />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-3">
            <label className="inline-flex min-h-11 items-center gap-2 rounded-control border border-stone-300 px-3 font-semibold">
              <input
                className="h-5 w-5 accent-stone-900"
                type="checkbox"
                checked={congestionForm.queueInside}
                onChange={(event) =>
                  setCongestionForm((current) => ({
                    ...current,
                    queueInside: event.target.checked
                  }))
                }
              />
              실내 대기
            </label>
            <label className="inline-flex min-h-11 items-center gap-2 rounded-control border border-stone-300 px-3 font-semibold">
              <input
                className="h-5 w-5 accent-stone-900"
                type="checkbox"
                checked={congestionForm.queueOutside}
                onChange={(event) =>
                  setCongestionForm((current) => ({
                    ...current,
                    queueOutside: event.target.checked
                  }))
                }
              />
              외부 대기
            </label>
            <Button icon={Plus} type="button" onClick={() => void createCongestion()}>
              추가
            </Button>
          </div>
          <div className="mt-4 space-y-2">
            {dailyLog?.congestionLogs.map((item) => (
              <div
                key={item.id}
                className="grid min-h-12 grid-cols-[104px_1fr_auto] items-center gap-3 rounded-control border border-stone-200 px-3 text-sm"
              >
                <span className="font-semibold">
                  {item.timeSlotStart}-{item.timeSlotEnd}
                </span>
                <span className="truncate text-muted">
                  혼잡도 {item.level ?? "-"} · 이탈 {item.estLostCustomers}
                </span>
                <span className="font-semibold">
                  {item.queueOutside ? "외부" : item.queueInside ? "실내" : "대기 없음"}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="text-sm text-muted">시식</p>
              <h2 className="section-title">추천·구매 전환</h2>
            </div>
            <Soup className="h-5 w-5 text-bread" aria-hidden="true" />
          </div>
          <div className="grid gap-3">
            <label className="grid gap-2">
              <span className="field-label">제품</span>
              <input
                className="input"
                value={tastingForm.productName}
                onChange={(event) =>
                  setTastingForm((current) => ({ ...current, productName: event.target.value }))
                }
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="inline-flex min-h-11 items-center gap-2 rounded-control border border-stone-300 px-3 font-semibold">
                <input
                  className="h-5 w-5 accent-stone-900"
                  type="checkbox"
                  checked={tastingForm.recommended}
                  onChange={(event) =>
                    setTastingForm((current) => ({
                      ...current,
                      recommended: event.target.checked
                    }))
                  }
                />
                추천함
              </label>
              <label className="grid gap-2">
                <span className="field-label">구매 전환</span>
                <select
                  className="input"
                  value={tastingForm.convertedToSale}
                  onChange={(event) =>
                    setTastingForm((current) => ({
                      ...current,
                      convertedToSale: event.target.value as TastingForm["convertedToSale"]
                    }))
                  }
                >
                  <option value="UNKNOWN">미확인</option>
                  <option value="YES">전환</option>
                  <option value="NO">미전환</option>
                </select>
              </label>
            </div>
            <label className="grid gap-2">
              <span className="field-label">메모</span>
              <input
                className="input"
                value={tastingForm.note}
                onChange={(event) =>
                  setTastingForm((current) => ({ ...current, note: event.target.value }))
                }
              />
            </label>
            <Button icon={Plus} type="button" onClick={() => void createTasting()}>
              추가
            </Button>
          </div>
          <div className="mt-4 space-y-2">
            {dailyLog?.tastingLogs.map((item) => (
              <div
                key={item.id}
                className="grid min-h-12 grid-cols-[1fr_auto] items-center gap-3 rounded-control border border-stone-200 px-3 text-sm"
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{item.productName}</span>
                  <span className="block truncate text-muted">{item.note ?? "메모 없음"}</span>
                </span>
                <span className="font-semibold">
                  {item.convertedToSale === true
                    ? "전환"
                    : item.convertedToSale === false
                      ? "미전환"
                      : "미확인"}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="text-sm text-muted">품절</p>
              <h2 className="section-title">품절 기록</h2>
            </div>
            <PackageMinus className="h-5 w-5 text-red" aria-hidden="true" />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="field-label">제품</span>
              <input
                className="input"
                value={stockoutForm.productName}
                onChange={(event) =>
                  setStockoutForm((current) => ({ ...current, productName: event.target.value }))
                }
              />
            </label>
            <label className="grid gap-2">
              <span className="field-label">시각</span>
              <input
                className="input"
                type="datetime-local"
                value={stockoutForm.stockoutAt}
                onChange={(event) =>
                  setStockoutForm((current) => ({ ...current, stockoutAt: event.target.value }))
                }
              />
            </label>
            <label className="grid gap-2">
              <span className="field-label">회차</span>
              <input
                className="input"
                min="1"
                type="number"
                value={stockoutForm.sequence}
                onChange={(event) =>
                  setStockoutForm((current) => ({ ...current, sequence: event.target.value }))
                }
              />
            </label>
            <label className="grid gap-2">
              <span className="field-label">이후 문의</span>
              <select
                className="input"
                value={stockoutForm.inquiryAfterStockout}
                onChange={(event) =>
                  setStockoutForm((current) => ({
                    ...current,
                    inquiryAfterStockout: event.target.value as StockoutForm["inquiryAfterStockout"]
                  }))
                }
              >
                <option value="NONE">없음</option>
                <option value="FEW">적음</option>
                <option value="SOME">보통</option>
                <option value="MANY">많음</option>
                <option value="EXTREME">매우 많음</option>
              </select>
            </label>
            <label className="grid gap-2">
              <span className="field-label">폐기 수량</span>
              <input
                className="input"
                min="0"
                type="number"
                value={stockoutForm.discardQty}
                onChange={(event) =>
                  setStockoutForm((current) => ({ ...current, discardQty: event.target.value }))
                }
              />
            </label>
            <label className="grid gap-2">
              <span className="field-label">폐기 사유</span>
              <input
                className="input"
                value={stockoutForm.discardReason}
                onChange={(event) =>
                  setStockoutForm((current) => ({
                    ...current,
                    discardReason: event.target.value
                  }))
                }
              />
            </label>
          </div>
          <Button className="mt-3" icon={Plus} type="button" onClick={() => void createStockout()}>
            추가
          </Button>
          <div className="mt-4 space-y-2">
            {stockouts.map((item) => (
              <div
                key={item.id}
                className="grid min-h-12 grid-cols-[1fr_auto] items-center gap-3 rounded-control border border-stone-200 px-3 text-sm"
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{item.productName}</span>
                  <span className="block truncate text-muted">
                    {formatStockoutTime(item.stockoutAt)} · {item.sequence}회차 ·{" "}
                    {inquiryLabel(item.inquiryAfterStockout)}
                  </span>
                </span>
                <span className="font-semibold">폐기 {item.discardQty}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="text-sm text-muted">미취급</p>
              <h2 className="section-title">문의 누적</h2>
            </div>
            <ClipboardList className="h-5 w-5 text-green" aria-hidden="true" />
          </div>
          <div className="grid gap-3">
            <label className="grid gap-2">
              <span className="field-label">제품</span>
              <input
                className="input"
                value={absentForm.productName}
                onChange={(event) =>
                  setAbsentForm((current) => ({ ...current, productName: event.target.value }))
                }
              />
            </label>
            <label className="grid gap-2">
              <span className="field-label">메모</span>
              <input
                className="input"
                value={absentForm.note}
                onChange={(event) =>
                  setAbsentForm((current) => ({ ...current, note: event.target.value }))
                }
              />
            </label>
            <Button icon={Plus} type="button" onClick={() => void incrementAbsentInquiry()}>
              +1
            </Button>
          </div>
          <div className="mt-4 space-y-2">
            {absentInquiries.map((item) => (
              <div
                key={item.id}
                className="grid min-h-12 grid-cols-[1fr_auto] items-center gap-3 rounded-control border border-stone-200 px-3 text-sm"
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{item.productName}</span>
                  <span className="block truncate text-muted">{item.note ?? "메모 없음"}</span>
                </span>
                <span className="rounded-control bg-green/10 px-2 py-1 font-semibold text-green">
                  {item.count}회
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
