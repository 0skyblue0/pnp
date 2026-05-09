import { Check, PackagePlus, RefreshCcw, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { apiGet, apiPatch, apiPost } from "../../shared/api/client.js";
import { Button } from "../../shared/ui/Button.js";

type ListEnvelope<T> = {
  items: T[];
  total: number;
  page: number;
  size: number;
};

type ReservationDto = {
  id: string;
  pickupAt: string;
  status: "PENDING" | "READY" | "COMPLETED" | "NO_SHOW" | "CANCELED";
  purpose: "GIFT" | "SELF" | "UNKNOWN" | null;
  allergyNote: string | null;
  memo: string | null;
  cancelReason: string | null;
  items: Array<{
    productId: number;
    productName: string;
    quantity: number;
  }>;
};

type ProductDto = {
  id: number;
  name: string;
  isActive: boolean;
};

type ReservationForm = {
  contactRef: string;
  pickupAt: string;
  purpose: "GIFT" | "SELF" | "UNKNOWN";
  productName: string;
  quantity: string;
  allergyNote: string;
  memo: string;
};

function todayInStoreTime(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function defaultPickupAt(): string {
  const value = new Date(Date.now() + 60 * 60 * 1000);
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  })
    .format(value)
    .replace(" ", "T");
}

function formatPickupAt(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(value));
}

function statusLabel(status: ReservationDto["status"]): string {
  const labels = {
    PENDING: "대기",
    READY: "준비",
    COMPLETED: "완료",
    NO_SHOW: "미방문",
    CANCELED: "취소"
  };
  return labels[status];
}

export function ReservationPage() {
  const [date, setDate] = useState(todayInStoreTime());
  const [reservations, setReservations] = useState<ReservationDto[]>([]);
  const [productOptions, setProductOptions] = useState<ProductDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<ReservationForm>({
    contactRef: "",
    pickupAt: defaultPickupAt(),
    purpose: "UNKNOWN",
    productName: "",
    quantity: "1",
    allergyNote: "",
    memo: ""
  });

  const loadReservations = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const [reservationEnvelope, productEnvelope] = await Promise.all([
      apiGet<ListEnvelope<ReservationDto>>(`/reservation?from=${date}&to=${date}`),
      apiGet<ListEnvelope<ProductDto>>("/product?active=true")
    ]);

    setIsLoading(false);

    if (reservationEnvelope.error) {
      setError(reservationEnvelope.error.message);
      return;
    }
    if (productEnvelope.error) {
      setError(productEnvelope.error.message);
      return;
    }

    setReservations(reservationEnvelope.data.items);
    setProductOptions(productEnvelope.data.items);
  }, [date]);

  useEffect(() => {
    void loadReservations();
  }, [loadReservations]);

  async function createReservation() {
    setMessage(null);
    setError(null);

    const envelope = await apiPost<ReservationDto, Record<string, unknown>>("/reservation", {
      contactRef: form.contactRef,
      pickupAt: form.pickupAt,
      purpose: form.purpose,
      allergyNote: form.allergyNote || undefined,
      memo: form.memo || undefined,
      items: [
        {
          productName: form.productName,
          quantity: Number(form.quantity)
        }
      ]
    });

    if (envelope.error) {
      setError(envelope.error.message);
      return;
    }

    setMessage(`예약 저장 #${envelope.data.id}`);
    setForm({
      contactRef: "",
      pickupAt: defaultPickupAt(),
      purpose: "UNKNOWN",
      productName: "",
      quantity: "1",
      allergyNote: "",
      memo: ""
    });
    await loadReservations();
  }

  async function updateStatus(id: string, status: ReservationDto["status"]) {
    setMessage(null);
    setError(null);

    const envelope = await apiPatch<ReservationDto, Record<string, string>>(
      `/reservation/${id}/status`,
      { status }
    );

    if (envelope.error) {
      setError(envelope.error.message);
      return;
    }

    setMessage(`상태 변경 #${id}`);
    await loadReservations();
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <section className="panel min-w-0">
        <div className="panel-heading">
          <div>
            <p className="text-sm text-muted">M2</p>
            <h2 className="section-title">예약 등록</h2>
          </div>
          <PackagePlus className="h-5 w-5 text-bread" aria-hidden="true" />
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

        <div className="grid gap-3">
          <label className="grid min-w-0 gap-2">
            <span className="field-label">연락 키</span>
            <input
              className="input min-w-0 w-full"
              value={form.contactRef}
              onChange={(event) =>
                setForm((current) => ({ ...current, contactRef: event.target.value }))
              }
            />
          </label>
          <label className="grid min-w-0 gap-2">
            <span className="field-label">픽업</span>
            <input
              className="input min-w-0 w-full"
              type="datetime-local"
              value={form.pickupAt}
              onChange={(event) =>
                setForm((current) => ({ ...current, pickupAt: event.target.value }))
              }
            />
          </label>
          <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_7rem]">
            <label className="grid min-w-0 gap-2">
              <span className="field-label">제품</span>
              <input
                className="input min-w-0 w-full"
                list="reservation-products"
                value={form.productName}
                onChange={(event) =>
                  setForm((current) => ({ ...current, productName: event.target.value }))
                }
              />
              <datalist id="reservation-products">
                {productOptions.map((product) => (
                  <option key={product.id} value={product.name} />
                ))}
              </datalist>
            </label>
            <label className="grid min-w-0 gap-2">
              <span className="field-label">수량</span>
              <input
                className="input min-w-0 w-full text-right"
                inputMode="numeric"
                min="1"
                type="number"
                value={form.quantity}
                onChange={(event) =>
                  setForm((current) => ({ ...current, quantity: event.target.value }))
                }
              />
            </label>
          </div>
          <label className="grid min-w-0 gap-2">
            <span className="field-label">목적</span>
            <select
              className="input min-w-0 w-full"
              value={form.purpose}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  purpose: event.target.value as ReservationForm["purpose"]
                }))
              }
            >
              <option value="UNKNOWN">미확인</option>
              <option value="SELF">본인</option>
              <option value="GIFT">선물</option>
            </select>
          </label>
          <label className="grid min-w-0 gap-2">
            <span className="field-label">알레르기</span>
            <input
              className="input min-w-0 w-full"
              value={form.allergyNote}
              onChange={(event) =>
                setForm((current) => ({ ...current, allergyNote: event.target.value }))
              }
            />
          </label>
          <label className="grid min-w-0 gap-2">
            <span className="field-label">메모</span>
            <textarea
              className="input min-h-24 min-w-0 w-full resize-y"
              value={form.memo}
              onChange={(event) => setForm((current) => ({ ...current, memo: event.target.value }))}
            />
          </label>
          <Button icon={Check} type="button" onClick={() => void createReservation()}>
            저장
          </Button>
        </div>
      </section>

      <section className="panel min-w-0">
        <div className="panel-heading">
          <div>
            <p className="text-sm text-muted">예약 우선</p>
            <h2 className="section-title">예약 목록</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="input w-40 max-w-full"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
            <Button icon={RefreshCcw} type="button" onClick={() => void loadReservations()}>
              {isLoading ? "조회 중" : "새로고침"}
            </Button>
          </div>
        </div>
        <div className="space-y-3">
          {reservations.map((reservation) => (
            <div key={reservation.id} className="rounded-control border border-stone-200 p-3">
              <div className="grid gap-3 md:grid-cols-[120px_1fr_auto] md:items-center">
                <span className="font-semibold">{formatPickupAt(reservation.pickupAt)}</span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold">
                    {reservation.items
                      .map((item) => `${item.productName} x${item.quantity}`)
                      .join(", ")}
                  </span>
                  <span className="block truncate text-sm text-muted">
                    {reservation.memo ?? "메모 없음"}
                  </span>
                </span>
                <span className="rounded-control bg-blue/10 px-2 py-1 text-sm font-semibold text-blue">
                  {statusLabel(reservation.status)}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" onClick={() => void updateStatus(reservation.id, "READY")}>
                  준비
                </Button>
                <Button
                  type="button"
                  onClick={() => void updateStatus(reservation.id, "COMPLETED")}
                >
                  완료
                </Button>
                <button
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-stone-300 bg-white px-4 font-semibold hover:bg-stone-100"
                  type="button"
                  onClick={() => void updateStatus(reservation.id, "CANCELED")}
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                  취소
                </button>
              </div>
            </div>
          ))}
          {!isLoading && reservations.length === 0 ? (
            <div className="rounded-control border border-stone-200 px-3 py-6 text-center text-sm font-medium text-muted">
              예약 없음
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
