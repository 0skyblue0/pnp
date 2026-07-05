import { Check, PackagePlus, RefreshCcw, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { apiGet, apiPatch, apiPost } from "../../shared/api/client.js";
import type { ListEnvelope } from "../../shared/api/types.js";
import { productLineup } from "../../shared/productLineup.js";
import { todayInStoreTime } from "../../shared/time/storeTime.js";
import { Button } from "../../shared/ui/Button.js";

type ReservationDto = {
  id: string;
  customerName: string | null;
  contactPhone: string | null;
  pickupAt: string;
  status: "PENDING" | "READY" | "COMPLETED" | "NO_SHOW" | "CANCELED";
  isPaid: boolean;
  isCut: boolean;
  isBag: boolean;
  purpose: "GIFT" | "SELF" | "UNKNOWN" | null;
  allergyNote: string | null;
  memo: string | null;
  cancelReason: string | null;
  items: Array<{
    productId: number;
    productName: string;
    quantity: number;
    cuttingOption: CuttingOption;
  }>;
};

type CuttingOption = "NONE" | "HALF" | "SLICE" | "HALF_SLICE";

type ReservationForm = {
  customerName: string;
  contactPhone: string;
  pickupAt: string;
  items: ReservationItemForm[];
  isPaid: boolean;
  isBag: boolean;
  memo: string;
};

type ReservationItemForm = {
  id: string;
  productName: string;
  quantity: string;
  cuttingOption: CuttingOption;
};

const quickTimes = ["10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00"];
const pickupHours = Array.from({ length: 13 }, (_, index) => String(index + 8).padStart(2, "0"));
const pickupMinutes = ["00", "10", "20", "30", "40", "50"];
const halfCuttableProducts = new Set(["바게트", "깜빠뉴", "호밀빵", "화이트바게트", "식빵"]);
const sliceableProducts = new Set(["식빵"]);
let reservationItemIdSequence = 0;

function nextReservationItemId(): string {
  reservationItemIdSequence += 1;
  return `reservation-item-${Date.now()}-${reservationItemIdSequence}`;
}

function formatLocalDateTime(value: Date): string {
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

function formatDateOnly(value: Date): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(value);
}

function formatDateWithWeekday(value: string): string {
  const weekday = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    weekday: "short"
  }).format(new Date(`${value}T00:00:00+09:00`));
  return `${value} (${weekday})`;
}

function defaultPickupAt(): string {
  const value = new Date(Date.now() + 60 * 60 * 1000);
  value.setMinutes(Math.ceil(value.getMinutes() / 10) * 10, 0, 0);
  return formatLocalDateTime(value);
}

function emptyReservationForm(): ReservationForm {
  return {
    customerName: "",
    contactPhone: "",
    pickupAt: defaultPickupAt(),
    items: [emptyReservationItem()],
    isPaid: false,
    isBag: false,
    memo: ""
  };
}

function emptyReservationItem(): ReservationItemForm {
  return {
    id: nextReservationItemId(),
    productName: "",
    quantity: "1",
    cuttingOption: "NONE"
  };
}

function formatPickupTimeOnly(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(value));
}

function statusLabel(status: ReservationDto["status"]): string {
  return status === "COMPLETED" ? "픽업완료" : "대기";
}

function isPastPickup(pickupAt: string): boolean {
  return new Date(pickupAt).getTime() < Date.now();
}

function datePart(value: string): string {
  return value.slice(0, 10) || todayInStoreTime();
}

function timePart(value: string): string {
  return value.slice(11, 16) || "10:00";
}

function combineDateTime(date: string, time: string): string {
  return `${date}T${time}`;
}

function canHalfCut(productName: string): boolean {
  return halfCuttableProducts.has(productName);
}

function canSlice(productName: string): boolean {
  return sliceableProducts.has(productName);
}

function isHalfCutSelected(cuttingOption: CuttingOption): boolean {
  return cuttingOption === "HALF" || cuttingOption === "HALF_SLICE";
}

function isSliceSelected(cuttingOption: CuttingOption): boolean {
  return cuttingOption === "SLICE" || cuttingOption === "HALF_SLICE";
}

function cuttingOptionFromFlags(halfCut: boolean, slice: boolean): CuttingOption {
  if (halfCut && slice) {
    return "HALF_SLICE";
  }
  if (halfCut) {
    return "HALF";
  }
  if (slice) {
    return "SLICE";
  }
  return "NONE";
}

function normalizedCuttingOption(productName: string, cuttingOption: CuttingOption): CuttingOption {
  return cuttingOptionFromFlags(
    canHalfCut(productName) && isHalfCutSelected(cuttingOption),
    canSlice(productName) && isSliceSelected(cuttingOption)
  );
}

function formatReservationItem(item: ReservationDto["items"][number]): string {
  return `${item.productName} ${item.quantity}개`;
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

export function ReservationPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [date, setDate] = useState(todayInStoreTime());
  const [reservations, setReservations] = useState<ReservationDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ReservationForm>(() => emptyReservationForm());

  const sortedReservations = useMemo(
    () =>
      [...reservations].sort(
        (left, right) => new Date(left.pickupAt).getTime() - new Date(right.pickupAt).getTime()
      ),
    [reservations]
  );
  const pendingCount = reservations.filter((reservation) => reservation.status !== "COMPLETED").length;
  const completedCount = reservations.filter((reservation) => reservation.status === "COMPLETED").length;
  const productChoices = useMemo(() => {
    const legacyProducts = form.items
      .map((item) => item.productName)
      .filter((productName) => productName && !productLineup.includes(productName));
    return [...new Set([...legacyProducts, ...productLineup])];
  }, [form.items]);
  const showReservationForm = searchParams.get("form") === "new" || editingId !== null;

  const loadReservations = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const reservationEnvelope = await apiGet<ListEnvelope<ReservationDto>>(`/reservation?from=${date}&to=${date}`);

    setIsLoading(false);

    if (reservationEnvelope.error) {
      setError(reservationEnvelope.error.message);
      return;
    }
    setReservations(reservationEnvelope.data.items);
  }, [date]);

  useEffect(() => {
    void loadReservations();
  }, [loadReservations]);

  function setQuickDate(daysFromToday: number) {
    const target = new Date();
    target.setDate(target.getDate() + daysFromToday);
    const nextDate = formatDateOnly(target);
    setForm((current) => ({
      ...current,
      pickupAt: combineDateTime(nextDate, timePart(current.pickupAt))
    }));
  }

  function setQuickTime(time: string) {
    setForm((current) => ({ ...current, pickupAt: combineDateTime(datePart(current.pickupAt), time) }));
  }

  function setPickupDate(nextDate: string) {
    setForm((current) => ({ ...current, pickupAt: combineDateTime(nextDate, timePart(current.pickupAt)) }));
  }

  function setPickupHour(hour: string) {
    setForm((current) => ({
      ...current,
      pickupAt: combineDateTime(datePart(current.pickupAt), `${hour}:${timePart(current.pickupAt).slice(3, 5)}`)
    }));
  }

  function setPickupMinute(minute: string) {
    setForm((current) => ({
      ...current,
      pickupAt: combineDateTime(datePart(current.pickupAt), `${timePart(current.pickupAt).slice(0, 2)}:${minute}`)
    }));
  }

  function updateReservationItem(id: string, key: keyof Omit<ReservationItemForm, "id">, value: string) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item) => {
        if (item.id !== id) {
          return item;
        }
        if (key === "productName") {
          return {
            ...item,
            productName: value,
            cuttingOption: normalizedCuttingOption(value, item.cuttingOption)
          };
        }
        if (key === "cuttingOption") {
          return {
            ...item,
            cuttingOption: normalizedCuttingOption(item.productName, value as CuttingOption)
          };
        }
        return { ...item, [key]: value };
      })
    }));
  }

  function addReservationItem() {
    setForm((current) => ({ ...current, items: [...current.items, emptyReservationItem()] }));
  }

  function removeReservationItem(id: string) {
    setForm((current) => ({
      ...current,
      items: current.items.length === 1 ? current.items : current.items.filter((item) => item.id !== id)
    }));
  }

  function validateForm(): string[] {
    return [
      form.customerName.trim() ? null : "손님 이름을 입력해 주세요.",
      form.contactPhone.trim() ? null : "연락처를 입력해 주세요.",
      form.pickupAt ? null : "픽업 날짜·시간을 입력해 주세요.",
      form.items.some((item) => item.productName.trim()) ? null : "제품을 1개 이상 선택해 주세요.",
      form.items.every((item) => item.productName.trim() && Number(item.quantity) >= 1)
        ? null
        : "각 제품의 수량은 1개 이상으로 입력해 주세요."
    ].filter((validationMessage): validationMessage is string => Boolean(validationMessage));
  }

  function reservationPayload() {
    return {
      contactRef: `${form.customerName} ${form.contactPhone}`.trim(),
      customerName: form.customerName,
      contactPhone: form.contactPhone,
      pickupAt: form.pickupAt,
      isPaid: form.isPaid,
      isBag: form.isBag,
      isCut: form.items.some((item) => normalizedCuttingOption(item.productName, item.cuttingOption) !== "NONE"),
      purpose: "UNKNOWN",
      memo: form.memo || undefined,
      items: form.items.map((item) => ({
        productName: item.productName,
        quantity: Number(item.quantity),
        cuttingOption: normalizedCuttingOption(item.productName, item.cuttingOption)
      }))
    };
  }

  async function saveReservation() {
    setMessage(null);
    setError(null);
    const validationMessages = validateForm();
    setFormErrors(validationMessages);
    if (validationMessages.length > 0) {
      return;
    }

    const envelope = editingId
      ? await apiPatch<ReservationDto, Record<string, unknown>>(
          `/reservation/${editingId}`,
          reservationPayload()
        )
      : await apiPost<ReservationDto, Record<string, unknown>>("/reservation", reservationPayload());

    if (envelope.error) {
      setError(envelope.error.message);
      return;
    }

    setMessage(editingId ? `예약 수정 #${envelope.data.id}` : `예약 저장 #${envelope.data.id}`);
    setFormErrors([]);
    setEditingId(null);
    setSearchParams(new URLSearchParams(), { replace: true });
    setForm(emptyReservationForm());
    setDate(datePart(envelope.data.pickupAt));
    await loadReservations();
  }

  function startEdit(reservation: ReservationDto) {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("form");
    setSearchParams(nextParams, { replace: true });
    setEditingId(reservation.id);
    setMessage(`${reservation.customerName || "선택한 손님"} 예약을 수정합니다. 날짜·시간을 바꾸면 미루기로 처리됩니다.`);
    setError(null);
    setFormErrors([]);
    setForm({
      customerName: reservation.customerName ?? "",
      contactPhone: reservation.contactPhone ?? "",
      pickupAt: formatLocalDateTime(new Date(reservation.pickupAt)),
      items:
        reservation.items.length > 0
          ? reservation.items.map((item) => ({
              id: nextReservationItemId(),
              productName: item.productName,
              quantity: String(item.quantity),
              cuttingOption: normalizedCuttingOption(item.productName, item.cuttingOption ?? "NONE")
            }))
          : [emptyReservationItem()],
      isPaid: reservation.isPaid,
      isBag: reservation.isBag,
      memo: reservation.memo ?? ""
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setMessage(null);
    setFormErrors([]);
    setSearchParams(new URLSearchParams(), { replace: true });
    setForm(emptyReservationForm());
  }

  function openNewReservationForm() {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("form", "new");
    setSearchParams(nextParams, { replace: true });
    setEditingId(null);
    setMessage(null);
    setError(null);
    setFormErrors([]);
    setForm(emptyReservationForm());
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
    <div
      className={[
        "mx-auto grid max-w-none gap-4",
        showReservationForm ? "xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]" : "xl:grid-cols-1"
      ].join(" ")}
    >
      {showReservationForm ? (
        <section className="panel min-w-0">
        <div className="panel-heading">
          <div>
            <p className="text-sm text-muted">픽업 잊지 않기</p>
            <h2 className="section-title">{editingId ? "예약 수정" : "예약 등록"}</h2>
            <p className="mt-1 text-sm text-muted">날짜, 시간, 10분 단위를 버튼과 선택창으로 빠르게 고릅니다.</p>
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
        {formErrors.length > 0 ? (
          <div className="mb-4 rounded-control border border-red/20 bg-red/10 px-3 py-2 text-sm font-semibold text-red">
            <p>저장 전 확인해 주세요.</p>
            <ul className="mt-1 list-disc pl-5">
              {formErrors.map((formError) => (
                <li key={formError}>{formError}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="grid gap-3">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid min-w-0 gap-2">
              <span className="field-label">손님 이름</span>
              <input
                aria-label="손님 이름"
                className="input min-w-0 w-full"
                placeholder="홍길동"
                value={form.customerName}
                onChange={(event) => setForm((current) => ({ ...current, customerName: event.target.value }))}
              />
            </label>
            <label className="grid min-w-0 gap-2">
              <span className="field-label">연락처</span>
              <input
                aria-label="연락처"
                className="input min-w-0 w-full"
                inputMode="numeric"
                placeholder="010-0000-0000"
                value={form.contactPhone}
                onChange={(event) =>
                  setForm((current) => ({ ...current, contactPhone: formatPhoneInput(event.target.value) }))
                }
              />
            </label>
          </div>

          <div className="grid gap-2 rounded-control border border-latte bg-cream/40 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="field-label">픽업 날짜·시간</span>
              <span className="rounded-full bg-white px-3 py-1 text-sm font-bold text-cocoa">
                {formatDateWithWeekday(datePart(form.pickupAt))} {timePart(form.pickupAt)}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 rounded-[1.35rem] bg-white/70 p-1.5 shadow-inner shadow-stone-200/60">
              {[
                ["오늘", 0],
                ["내일", 1],
                ["모레", 2]
              ].map(([label, daysFromToday]) => (
                <button
                  key={label}
                  type="button"
                  className="min-h-12 rounded-[1rem] border border-latte/70 bg-gradient-to-b from-white to-cream px-3 text-sm font-semibold text-cocoa shadow-sm transition hover:-translate-y-0.5 hover:border-cocoa/40 hover:bg-white hover:shadow-md active:translate-y-0"
                  onClick={() => setQuickDate(Number(daysFromToday))}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem_8rem]">
              <label className="grid gap-1">
                <span className="text-xs font-semibold text-muted">날짜</span>
                <input
                  aria-label="픽업 날짜"
                  className="input w-full"
                  type="date"
                  value={datePart(form.pickupAt)}
                  onClick={(event) => event.currentTarget.showPicker()}
                  onChange={(event) => setPickupDate(event.target.value)}
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold text-muted">시</span>
                <select
                  aria-label="픽업 시"
                  className="input w-full"
                  value={timePart(form.pickupAt).slice(0, 2)}
                  onChange={(event) => setPickupHour(event.target.value)}
                >
                  {pickupHours.map((hour) => (
                    <option key={hour} value={hour}>{hour}시</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold text-muted">분</span>
                <select
                  aria-label="픽업 분"
                  className="input w-full"
                  value={timePart(form.pickupAt).slice(3, 5)}
                  onChange={(event) => setPickupMinute(event.target.value)}
                >
                  {pickupMinutes.map((minute) => (
                    <option key={minute} value={minute}>{minute}분</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid grid-cols-4 gap-2 rounded-[1.35rem] bg-white/65 p-1.5 shadow-inner shadow-stone-200/60 sm:grid-cols-5">
              {quickTimes.map((time) => (
                <button
                  key={time}
                  type="button"
                  className={[
                    "min-h-12 rounded-[1rem] border px-2 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:translate-y-0",
                    timePart(form.pickupAt) === time
                      ? "border-cocoa bg-gradient-to-b from-cocoa to-bread text-white shadow-cocoa/20"
                      : "border-latte/70 bg-gradient-to-b from-white to-cream text-cocoa hover:border-cocoa/40 hover:bg-white"
                  ].join(" ")}
                  onClick={() => setQuickTime(time)}
                >
                  {time}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-2 rounded-control border border-latte bg-white/70 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="field-label">제품</span>
              <button
                type="button"
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[0.9rem] bg-white px-3 text-sm font-extrabold text-cocoa shadow-sm ring-1 ring-latte transition hover:-translate-y-0.5 hover:bg-cream hover:shadow-md active:translate-y-0"
                onClick={addReservationItem}
              >
                <PackagePlus className="h-4 w-4" aria-hidden="true" />
                제품 추가
              </button>
            </div>
            <div className="grid gap-2">
              {form.items.map((item, index) => {
                const showHalfCut = canHalfCut(item.productName);
                const showSlice = canSlice(item.productName);
                return (
                  <div key={item.id} className="grid min-w-0 gap-2 rounded-control bg-cream/40 p-2">
                    <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_7rem_auto] sm:items-end">
                      <label className="grid min-w-0 gap-1">
                        <span className="text-xs font-semibold text-muted">제품 {index + 1}</span>
                        <select
                          aria-label={`제품 ${index + 1}`}
                          className="input min-w-0 w-full"
                          value={item.productName}
                          onChange={(event) => updateReservationItem(item.id, "productName", event.target.value)}
                        >
                          <option value="">제품 선택</option>
                          {productChoices.map((productName) => (
                            <option key={productName} value={productName}>
                              {productName}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="grid min-w-0 gap-1">
                        <span className="text-xs font-semibold text-muted">수량</span>
                        <input
                          aria-label={`수량 ${index + 1}`}
                          className="input min-w-0 w-full text-right"
                          inputMode="numeric"
                          min="1"
                          type="number"
                          value={item.quantity}
                          onChange={(event) => updateReservationItem(item.id, "quantity", event.target.value)}
                        />
                      </label>
                      <button
                        type="button"
                        className="inline-flex min-h-10 items-center justify-center gap-1 rounded-[0.9rem] border border-red/20 bg-white px-3 text-sm font-semibold text-red shadow-sm transition hover:-translate-y-0.5 hover:border-red/40 hover:bg-red/5 active:translate-y-0"
                        onClick={() => removeReservationItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        삭제
                      </button>
                    </div>
                    {showHalfCut || showSlice ? (
                      <div className="flex flex-wrap gap-2">
                        {showHalfCut ? (
                          <label className="flex items-center gap-2 rounded-control border border-latte bg-white px-3 py-2 text-sm font-semibold text-cocoa">
                            <input
                              className="h-4 w-4 accent-cocoa"
                              checked={isHalfCutSelected(item.cuttingOption)}
                              type="checkbox"
                              onChange={(event) =>
                                updateReservationItem(
                                  item.id,
                                  "cuttingOption",
                                  cuttingOptionFromFlags(event.target.checked, isSliceSelected(item.cuttingOption))
                                )
                              }
                            />
                            반컷팅
                          </label>
                        ) : null}
                        {showSlice ? (
                          <label className="flex items-center gap-2 rounded-control border border-latte bg-white px-3 py-2 text-sm font-semibold text-cocoa">
                            <input
                              className="h-4 w-4 accent-cocoa"
                              checked={isSliceSelected(item.cuttingOption)}
                              type="checkbox"
                              onChange={(event) =>
                                updateReservationItem(
                                  item.id,
                                  "cuttingOption",
                                  cuttingOptionFromFlags(isHalfCutSelected(item.cuttingOption), event.target.checked)
                                )
                              }
                            />
                            슬라이스
                          </label>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
          <label className="grid min-w-0 gap-2">
            <span className="field-label">메모</span>
            <textarea
              aria-label="메모"
              className="input min-h-20 min-w-0 w-full resize-y"
              value={form.memo}
              onChange={(event) => setForm((current) => ({ ...current, memo: event.target.value }))}
            />
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex items-center gap-2 rounded-control border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-800">
              <input
                className="h-4 w-4 accent-cocoa"
                checked={form.isPaid}
                type="checkbox"
                onChange={(event) =>
                  setForm((current) => ({ ...current, isPaid: event.target.checked }))
                }
              />
              결제완료
            </label>
            <label className="flex items-center gap-2 rounded-control border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-800">
              <input
                className="h-4 w-4 accent-cocoa"
                checked={form.isBag}
                type="checkbox"
                onChange={(event) =>
                  setForm((current) => ({ ...current, isBag: event.target.checked }))
                }
              />
              비닐봉투
            </label>
          </div>
          {editingId ? (
            <div className="rounded-[1rem] border border-cocoa/15 bg-cocoa/5 p-1.5 shadow-sm">
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[0.85rem] bg-gradient-to-r from-cocoa to-bread px-3 text-sm font-extrabold text-white shadow-elegant transition hover:-translate-y-0.5 hover:from-ink hover:to-cocoa active:translate-y-0"
                  onClick={() => void saveReservation()}
                >
                  <Check className="h-4 w-4" aria-hidden="true" />
                  수정 저장
                </button>
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[0.85rem] border border-latte bg-white px-3 text-sm font-extrabold text-cocoa shadow-sm transition hover:-translate-y-0.5 hover:border-cocoa/40 hover:shadow-md active:translate-y-0"
                  onClick={cancelEdit}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                  수정 취소
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button icon={Check} type="button" onClick={() => void saveReservation()}>
                저장
              </Button>
            </div>
          )}
        </div>
        </section>
      ) : null}

      <section className="panel min-w-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="section-title">예약 · {date.replaceAll("-", ".")}</h2>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="sr-only grid min-w-40 max-w-full cursor-pointer gap-1">
              <span className="sr-only">조회 날짜</span>
              <input
                aria-label="예약 조회 날짜"
                className="input w-40 max-w-full cursor-pointer"
                type="date"
                value={date}
                onClick={(event) => event.currentTarget.showPicker()}
                onChange={(event) => setDate(event.target.value)}
              />
            </label>
            <button
              type="button"
              className="sr-only inline-flex min-h-10 items-center justify-center gap-2 rounded-[0.9rem] bg-white px-3 text-sm font-extrabold text-cocoa shadow-sm ring-1 ring-latte transition hover:-translate-y-0.5 hover:bg-cream hover:shadow-md active:translate-y-0"
              onClick={() => void loadReservations()}
            >
              <RefreshCcw className="h-4 w-4" aria-hidden="true" />
              {isLoading ? "조회 중" : "새로고침"}
            </button>
            {!showReservationForm ? (
              <button
                type="button"
                className="dc-action inline-flex min-h-0 items-center justify-center"
                onClick={openNewReservationForm}
              >
                + 새 예약 등록
              </button>
            ) : null}
          </div>
        </div>
        <p className="mb-3 text-xs font-semibold text-muted">
          전체 {reservations.length}건 / 대기 {pendingCount}건 / 픽업완료 {completedCount}건
        </p>
        {!showReservationForm && message ? (
          <div className="mb-4 rounded-control border border-green/20 bg-green/10 px-3 py-2 text-sm font-semibold text-green">
            {message}
          </div>
        ) : null}
        {!showReservationForm && error ? (
          <div className="mb-4 rounded-control border border-red/20 bg-red/10 px-3 py-2 text-sm font-semibold text-red">
            {error}
          </div>
        ) : null}
        <div className="dc-card overflow-hidden px-[22px] py-2">
          <div className="dc-row-head grid grid-cols-[0.7fr_1fr_1.35fr_2.2fr_1fr_1fr_1.15fr_0.7fr] gap-2">
            <div>시간</div><div>이름</div><div>연락처</div><div>제품</div><div>컷팅</div><div>결제</div><div>상태</div><div>수정</div>
          </div>
          {sortedReservations.map((reservation) => {
            const isLate = reservation.status !== "COMPLETED" && isPastPickup(reservation.pickupAt);
            const cuttingText = reservation.items
              .map((item) => item.cuttingOption)
              .filter((option) => option !== "NONE")
              .map((option) => option === "SLICE" ? "슬라이스" : option === "HALF_SLICE" ? "반컷팅+슬라이스" : "반컷팅")
              .join(", ");

            return (
              <div
                key={reservation.id}
                className="dc-row grid grid-cols-[0.7fr_1fr_1.35fr_2.2fr_1fr_1fr_1.15fr_0.7fr] gap-2"
              >
                <div className="font-semibold">{formatPickupTimeOnly(reservation.pickupAt)}</div>
                <div>{reservation.customerName || "-"}</div>
                <div className="text-xs text-muted">{reservation.contactPhone || "-"}</div>
                <div className="text-xs">{reservation.items.map(formatReservationItem).join(", ") || "-"}</div>
                <div className="text-xs text-muted">{cuttingText || "없음"}</div>
                <div className="text-[11.5px]">{reservation.isPaid ? "완료" : "미결제"}</div>
                <div>
                  <button
                    type="button"
                    className={[
                      "rounded-full px-3 py-1 text-[11px] font-bold transition",
                      reservation.status === "COMPLETED"
                        ? "bg-green/10 text-green"
                        : isLate
                          ? "bg-red/10 text-red"
                          : "bg-[#F8E8CF] text-[#B5822C]"
                    ].join(" ")}
                    onClick={() =>
                      void updateStatus(
                        reservation.id,
                        reservation.status === "COMPLETED" ? "PENDING" : "COMPLETED"
                      )
                    }
                  >
                    {statusLabel(reservation.status)}
                  </button>
                </div>
                <button
                  type="button"
                  className="text-xs font-semibold text-cocoa hover:underline"
                  onClick={() => startEdit(reservation)}
                >
                  수정
                </button>
              </div>
            );
          })}
          {!isLoading && reservations.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm font-medium text-muted">
              예약 없음
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
