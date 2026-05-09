import {
  CheckCircle2,
  Clock3,
  MessageSquarePlus,
  PackageMinus,
  PackagePlus,
  RefreshCcw,
  Settings
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { apiGet, apiPost } from "../../shared/api/client.js";
import { Button, ButtonLink } from "../../shared/ui/Button.js";

type ListEnvelope<T> = {
  items: T[];
  total: number;
  page: number;
  size: number;
};

type ProductDto = {
  id: number;
  name: string;
  isActive: boolean;
};

type ReservationDto = {
  id: string;
  pickupAt: string;
  status: "PENDING" | "READY" | "COMPLETED" | "NO_SHOW" | "CANCELED";
  items: Array<{
    productId: number;
    productName: string;
    quantity: number;
  }>;
  memo: string | null;
};

type ProductionLotDto = {
  id: string;
  productId: number;
  productName: string;
  producedAt: string;
  lotType: "AM" | "PM_2ND" | null;
  producedQty: number;
  staffNote: string | null;
};

type NotificationDto = {
  id: number;
  title: string;
  severity: "INFO" | "WARN" | "CRITICAL";
  link?: string;
};

type ProductionForm = {
  productName: string;
  producedQty: string;
  producedAt: string;
  lotType: "AM" | "PM_2ND";
  staffNote: string;
};

function todayInStoreTime(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function currentStoreDateTime(): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  })
    .format(new Date())
    .replace(" ", "T");
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(value));
}

function productionFormDefaults(): ProductionForm {
  return {
    productName: "",
    producedQty: "1",
    producedAt: currentStoreDateTime(),
    lotType: "AM",
    staffNote: ""
  };
}

function reservationStatusLabel(reservation: ReservationDto): string {
  const labels = {
    PENDING: "대기",
    READY: "준비",
    COMPLETED: "완료",
    NO_SHOW: "미방문",
    CANCELED: "취소"
  };

  if (reservation.status !== "PENDING") {
    return labels[reservation.status];
  }

  const minutesToPickup = Math.round(
    (new Date(reservation.pickupAt).getTime() - Date.now()) / 60000
  );
  if (minutesToPickup < 0) {
    return "픽업 지남";
  }
  if (minutesToPickup <= 60) {
    return "1h 임박";
  }
  return labels.PENDING;
}

function productSummary(reservation: ReservationDto): string {
  return reservation.items.map((item) => `${item.productName} x${item.quantity}`).join(", ");
}

export function HomePage() {
  const [date] = useState(todayInStoreTime());
  const [productOptions, setProductOptions] = useState<ProductDto[]>([]);
  const [reservations, setReservations] = useState<ReservationDto[]>([]);
  const [productionLots, setProductionLots] = useState<ProductionLotDto[]>([]);
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [productionForm, setProductionForm] = useState<ProductionForm>(productionFormDefaults);
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingProduction, setIsSavingProduction] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadHomeData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [productEnvelope, reservationEnvelope, productionEnvelope, notificationEnvelope] =
        await Promise.all([
          apiGet<ListEnvelope<ProductDto>>("/product?active=true"),
          apiGet<ListEnvelope<ReservationDto>>(`/reservation?from=${date}&to=${date}`),
          apiGet<ListEnvelope<ProductionLotDto>>(`/production-lot?date=${date}`),
          apiGet<ListEnvelope<NotificationDto>>("/notification")
        ]);

      if (productEnvelope.error) {
        setError(productEnvelope.error.message);
        return;
      }
      if (reservationEnvelope.error) {
        setError(reservationEnvelope.error.message);
        return;
      }
      if (productionEnvelope.error) {
        setError(productionEnvelope.error.message);
        return;
      }
      if (notificationEnvelope.error) {
        setError(notificationEnvelope.error.message);
        return;
      }

      setProductOptions(productEnvelope.data.items);
      setReservations(reservationEnvelope.data.items);
      setProductionLots(productionEnvelope.data.items);
      setNotifications(notificationEnvelope.data.items.slice(0, 3));
    } catch (unknownError) {
      setError(
        unknownError instanceof Error ? unknownError.message : "홈 데이터를 조회하지 못했습니다."
      );
    } finally {
      setIsLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void loadHomeData();
  }, [loadHomeData]);

  const inventory = useMemo(() => {
    const products = new Map<number, string>();
    const produced = new Map<number, number>();
    const reserved = new Map<number, number>();

    for (const product of productOptions) {
      products.set(product.id, product.name);
    }

    for (const lot of productionLots) {
      products.set(lot.productId, lot.productName);
      produced.set(lot.productId, (produced.get(lot.productId) ?? 0) + lot.producedQty);
    }

    for (const reservation of reservations) {
      if (reservation.status === "CANCELED" || reservation.status === "NO_SHOW") {
        continue;
      }

      for (const item of reservation.items) {
        products.set(item.productId, item.productName);
        reserved.set(item.productId, (reserved.get(item.productId) ?? 0) + item.quantity);
      }
    }

    return Array.from(products.entries())
      .map(([productId, product]) => {
        const producedQty = produced.get(productId) ?? 0;
        const reservedQty = reserved.get(productId) ?? 0;
        return {
          productId,
          product,
          produced: producedQty,
          reserved: reservedQty,
          available: Math.max(0, producedQty - reservedQty)
        };
      })
      .filter((item) => item.produced > 0 || item.reserved > 0)
      .sort((a, b) => a.product.localeCompare(b.product, "ko"));
  }, [productOptions, productionLots, reservations]);

  async function createProductionLot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    const productName = productionForm.productName.trim();
    const producedQty = Number(productionForm.producedQty);
    if (productName.length === 0) {
      setError("생산 제품명을 입력하세요.");
      return;
    }
    if (!Number.isInteger(producedQty) || producedQty < 1) {
      setError("생산 수량은 1 이상의 정수로 입력하세요.");
      return;
    }

    setIsSavingProduction(true);
    try {
      const envelope = await apiPost<ProductionLotDto, Record<string, unknown>>("/production-lot", {
        productName,
        producedQty,
        producedAt: productionForm.producedAt,
        lotType: productionForm.lotType,
        staffNote: productionForm.staffNote.trim() || undefined
      });

      if (envelope.error) {
        setError(envelope.error.message);
        return;
      }

      setMessage(`생산 수량 저장: ${envelope.data.productName} ${envelope.data.producedQty}개`);
      setProductionForm(productionFormDefaults());
      await loadHomeData();
    } catch (unknownError) {
      setError(
        unknownError instanceof Error ? unknownError.message : "생산 수량을 저장하지 못했습니다."
      );
    } finally {
      setIsSavingProduction(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
      <section className="panel min-w-0">
        <div className="panel-heading">
          <div>
            <p className="text-sm text-muted">{date} 예약 우선 정책 반영</p>
            <h2 className="section-title">오늘의 가용 재고</h2>
          </div>
          <button
            className="inline-flex min-h-10 items-center justify-center rounded-control border border-stone-300 bg-white px-3 font-semibold hover:bg-stone-100"
            type="button"
            onClick={() => void loadHomeData()}
          >
            <RefreshCcw className="h-4 w-4" aria-hidden="true" />
          </button>
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
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-stone-200 text-muted">
              <tr>
                <th className="py-3 pr-4 font-medium">제품</th>
                <th className="px-4 py-3 font-medium">생산</th>
                <th className="px-4 py-3 font-medium">예약</th>
                <th className="py-3 pl-4 font-medium">예약 제외 가용</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {inventory.map((item) => (
                <tr key={item.productId}>
                  <td className="py-3 pr-4 font-medium">{item.product}</td>
                  <td className="px-4 py-3">{item.produced}</td>
                  <td className="px-4 py-3">{item.reserved}</td>
                  <td className="py-3 pl-4">
                    <span
                      className={[
                        "inline-flex min-h-8 items-center rounded-control px-3 font-semibold",
                        item.available === 0 ? "bg-red/10 text-red" : "bg-green/10 text-green"
                      ].join(" ")}
                    >
                      {item.available}
                    </span>
                  </td>
                </tr>
              ))}
              {!isLoading && inventory.length === 0 ? (
                <tr>
                  <td className="py-6 text-center text-sm font-medium text-muted" colSpan={4}>
                    오늘 생산 또는 예약 기록 없음
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel min-w-0">
        <div className="panel-heading">
          <div>
            <p className="text-sm text-muted">M6</p>
            <h2 className="section-title">생산 수량 입력</h2>
          </div>
          <PackagePlus className="h-5 w-5 text-bread" aria-hidden="true" />
        </div>
        <form className="grid gap-3" onSubmit={(event) => void createProductionLot(event)}>
          <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_7rem]">
            <label className="grid min-w-0 gap-2">
              <span className="field-label">제품</span>
              <input
                className="input min-w-0 w-full"
                list="home-production-products"
                value={productionForm.productName}
                onChange={(event) =>
                  setProductionForm((current) => ({
                    ...current,
                    productName: event.target.value
                  }))
                }
              />
              <datalist id="home-production-products">
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
                value={productionForm.producedQty}
                onChange={(event) =>
                  setProductionForm((current) => ({
                    ...current,
                    producedQty: event.target.value
                  }))
                }
              />
            </label>
          </div>
          <div className="grid min-w-0 gap-3 sm:grid-cols-[8rem_minmax(0,1fr)]">
            <label className="grid min-w-0 gap-2">
              <span className="field-label">로트</span>
              <select
                className="input min-w-0 w-full"
                value={productionForm.lotType}
                onChange={(event) =>
                  setProductionForm((current) => ({
                    ...current,
                    lotType: event.target.value as ProductionForm["lotType"]
                  }))
                }
              >
                <option value="AM">AM</option>
                <option value="PM_2ND">PM 2차</option>
              </select>
            </label>
            <label className="grid min-w-0 gap-2">
              <span className="field-label">생산 시각</span>
              <input
                className="input min-w-0 w-full"
                type="datetime-local"
                value={productionForm.producedAt}
                onChange={(event) =>
                  setProductionForm((current) => ({
                    ...current,
                    producedAt: event.target.value
                  }))
                }
              />
            </label>
          </div>
          <label className="grid min-w-0 gap-2">
            <span className="field-label">메모</span>
            <input
              className="input min-w-0 w-full"
              value={productionForm.staffNote}
              onChange={(event) =>
                setProductionForm((current) => ({ ...current, staffNote: event.target.value }))
              }
            />
          </label>
          <Button icon={PackagePlus} type="submit" disabled={isSavingProduction}>
            {isSavingProduction ? "저장 중" : "생산 수량 저장"}
          </Button>
        </form>
        <div className="mt-4 border-t border-stone-200 pt-4">
          <p className="mb-2 text-sm font-semibold text-muted">오늘 생산 기록</p>
          <div className="space-y-2">
            {productionLots.slice(0, 5).map((lot) => (
              <div
                key={lot.id}
                className="grid min-h-11 grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-3 rounded-control border border-stone-200 px-3 text-sm"
              >
                <span className="font-semibold">{formatTime(lot.producedAt)}</span>
                <span className="min-w-0 truncate">{lot.productName}</span>
                <span className="font-semibold">{lot.producedQty}개</span>
              </div>
            ))}
            {!isLoading && productionLots.length === 0 ? (
              <div className="rounded-control border border-stone-200 px-3 py-4 text-center text-sm font-medium text-muted">
                생산 기록 없음
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="panel min-w-0">
        <div className="panel-heading">
          <div>
            <p className="text-sm text-muted">픽업 기준</p>
            <h2 className="section-title">오늘의 예약</h2>
          </div>
          <Clock3 className="h-5 w-5 text-blue" aria-hidden="true" />
        </div>
        <div className="space-y-3">
          {reservations.slice(0, 5).map((reservation) => (
            <div
              key={reservation.id}
              className="grid min-h-14 grid-cols-[64px_1fr_auto] items-center gap-3 rounded-control border border-stone-200 px-3"
            >
              <span className="font-semibold">{formatTime(reservation.pickupAt)}</span>
              <span className="truncate">{productSummary(reservation)}</span>
              <span className="rounded-control bg-blue/10 px-2 py-1 text-xs font-semibold text-blue">
                {reservationStatusLabel(reservation)}
              </span>
            </div>
          ))}
          {!isLoading && reservations.length === 0 ? (
            <div className="rounded-control border border-stone-200 px-3 py-6 text-center text-sm font-medium text-muted">
              오늘 예약 없음
            </div>
          ) : null}
        </div>
      </section>

      <section className="panel min-w-0">
        <div className="panel-heading">
          <div>
            <p className="text-sm text-muted">빠른 입력</p>
            <h2 className="section-title">운영 신호</h2>
          </div>
          <MessageSquarePlus className="h-5 w-5 text-bread" aria-hidden="true" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ButtonLink icon={MessageSquarePlus} to="/response/new">
            반응 입력
          </ButtonLink>
          <ButtonLink icon={PackageMinus} to="/daily-log/today">
            품절 기록
          </ButtonLink>
          <ButtonLink icon={Clock3} to="/reservation">
            예약 등록
          </ButtonLink>
          <ButtonLink icon={Settings} to="/staff">
            관리
          </ButtonLink>
        </div>
      </section>

      <section className="panel min-w-0">
        <div className="panel-heading">
          <div>
            <p className="text-sm text-muted">최신 3건</p>
            <h2 className="section-title">알림</h2>
          </div>
          <Link className="text-sm font-semibold text-blue hover:underline" to="/notification">
            전체 보기
          </Link>
        </div>
        <div className="space-y-3">
          {notifications.map((notification) => (
            <Link
              key={notification.id}
              to={notification.link ?? "/notification"}
              className="flex min-h-12 items-center gap-3 rounded-control border border-stone-200 px-3"
            >
              <CheckCircle2
                className={[
                  "h-5 w-5 shrink-0",
                  notification.severity === "CRITICAL"
                    ? "text-red"
                    : notification.severity === "WARN"
                      ? "text-amber"
                      : "text-blue"
                ].join(" ")}
                aria-hidden="true"
              />
              <span className="min-w-0 truncate">{notification.title}</span>
            </Link>
          ))}
          {!isLoading && notifications.length === 0 ? (
            <div className="rounded-control border border-stone-200 px-3 py-6 text-center text-sm font-medium text-muted">
              알림 없음
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
