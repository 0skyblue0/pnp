import { RefreshCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { apiDelete, apiGet, apiPatch, apiPost } from "../../shared/api/client.js";
import type { ListEnvelope } from "../../shared/api/types.js";
import { productLineup } from "../../shared/productLineup.js";
import { todayInStoreTime } from "../../shared/time/storeTime.js";
import { useConfirm } from "../../shared/ui/ConfirmDialog.js";

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

type ProductDto = {
  id: number;
  name: string;
  isActive: boolean;
};

const modalQuickTimes = Array.from({ length: 10 }, (_, index) => `${String(index + 10).padStart(2, "0")}:00`);
const pickupHours = Array.from({ length: 10 }, (_, index) => String(index + 10).padStart(2, "0"));
const pickupMinutes = ["00", "10", "20", "30", "40", "50"];
const halfCuttableProducts = new Set(["바게트", "깜빠뉴", "호밀빵", "식빵", "식 빵"]);
const sliceableProducts = new Set(["식빵", "식 빵"]);
const productLineupOrder = new Map<string, number>(
  productLineup.map((name, index) => [name, index])
);
let reservationItemIdSequence = 0;

function sortProductNames(productNames: string[]): string[] {
  return [...productNames].sort((left, right) => {
    const leftOrder = productLineupOrder.get(left) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = productLineupOrder.get(right) ?? Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
    return left.localeCompare(right, "ko-KR");
  });
}

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

function defaultPickupAt(): string {
  const value = new Date(Date.now() + 60 * 60 * 1000);
  value.setMinutes(Math.ceil(value.getMinutes() / 10) * 10, 0, 0);
  if (value.getHours() < 11) {
    value.setHours(11, 0, 0, 0);
  }
  if (value.getHours() > 19 || (value.getHours() === 19 && value.getMinutes() > 0)) {
    value.setDate(value.getDate() + 1);
    value.setHours(11, 0, 0, 0);
  }
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

function formatPickupDateTime(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
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
  return value.slice(11, 16) || "11:00";
}

function quickTimeLabel(time: string): string {
  const hour = Number(time.slice(0, 2));
  if (hour <= 12) {
    return `${hour}시`;
  }
  return `${hour - 12}시`;
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

function cuttingOptionChoices(productName: string): Array<{ label: string; value: CuttingOption }> {
  return [
    { label: "없음", value: "NONE" },
    ...(canHalfCut(productName) ? [{ label: "반컷팅", value: "HALF" as const }] : []),
    ...(canSlice(productName) ? [{ label: "슬라이스", value: "SLICE" as const }] : [])
  ];
}

function formatReservationItem(item: ReservationDto["items"][number]): string {
  return `${item.productName} ${item.quantity}개`;
}

function cuttingOptionLabel(cuttingOption: CuttingOption): string {
  if (cuttingOption === "SLICE") {
    return "슬라이스";
  }
  if (cuttingOption === "HALF_SLICE") {
    return "반컷팅+슬라이스";
  }
  if (cuttingOption === "HALF") {
    return "반컷팅";
  }
  return "";
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
  const confirm = useConfirm();
  const [searchParams, setSearchParams] = useSearchParams();
  const [date, setDate] = useState(() => searchParams.get("date") ?? todayInStoreTime());
  const [reservationQuery, setReservationQuery] = useState("");
  const [reservations, setReservations] = useState<ReservationDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ReservationForm>(() => emptyReservationForm());
  const [productOptions, setProductOptions] = useState<string[]>(() => [...productLineup]);

  const sortedReservations = useMemo(
    () =>
      [...reservations].sort(
        (left, right) => new Date(left.pickupAt).getTime() - new Date(right.pickupAt).getTime()
      ),
    [reservations]
  );
  const pendingCount = reservations.filter((reservation) => reservation.status !== "COMPLETED").length;
  const completedCount = reservations.filter((reservation) => reservation.status === "COMPLETED").length;
  const overdueCount = reservations.filter(
    (reservation) => reservation.status !== "COMPLETED" && isPastPickup(reservation.pickupAt)
  ).length;
  const showReservationForm = searchParams.get("form") === "new" || editingId !== null;

  const loadReservations = useCallback(async (lookupDate = date, lookupQuery = reservationQuery) => {
    setIsLoading(true);
    setError(null);

    const params = new URLSearchParams();
    if (lookupQuery.trim()) {
      params.set("query", lookupQuery.trim());
    } else {
      params.set("from", lookupDate);
      params.set("to", lookupDate);
    }
    const reservationEnvelope = await apiGet<ListEnvelope<ReservationDto>>(`/reservation?${params.toString()}`);

    setIsLoading(false);

    if (reservationEnvelope.error) {
      setError(reservationEnvelope.error.message);
      return;
    }
    setReservations(reservationEnvelope.data.items);
  }, [date, reservationQuery]);

  useEffect(() => {
    void loadReservations();
  }, [loadReservations]);

  useEffect(() => {
    let isActive = true;
    async function loadProducts() {
      const envelope = await apiGet<ListEnvelope<ProductDto>>("/product?active=true");
      if (!isActive || envelope.error || envelope.data.items.length === 0) {
        return;
      }
      setProductOptions(sortProductNames(envelope.data.items.map((product) => product.name)));
    }
    void loadProducts();
    return () => {
      isActive = false;
    };
  }, []);

  function setReservationListDate(nextDate: string) {
    setDate(nextDate);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("date", nextDate);
    setSearchParams(nextParams, { replace: true });
  }

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

  function updateReservationItem(
    itemId: string,
    updates: Partial<Pick<ReservationItemForm, "productName" | "quantity" | "cuttingOption">>
  ) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item) => {
        if (item.id !== itemId) {
          return item;
        }
        const productName = updates.productName ?? item.productName;
        const cuttingOption = updates.cuttingOption ?? item.cuttingOption;
        return {
          ...item,
          ...updates,
          productName,
          cuttingOption: normalizedCuttingOption(productName, cuttingOption)
        };
      })
    }));
  }

  function addReservationItem() {
    setForm((current) => ({ ...current, items: [...current.items, emptyReservationItem()] }));
  }

  function removeReservationItem(itemId: string) {
    setForm((current) => ({
      ...current,
      items: current.items.length > 1 ? current.items.filter((item) => item.id !== itemId) : [emptyReservationItem()]
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

    const savedPickupDate = datePart(envelope.data.pickupAt);
    setMessage(editingId ? `예약 수정 #${envelope.data.id}` : `예약 저장 #${envelope.data.id}`);
    setFormErrors([]);
    setEditingId(null);
    setReservationQuery("");
    const nextParams = new URLSearchParams();
    nextParams.set("date", savedPickupDate);
    setSearchParams(nextParams, { replace: true });
    setForm(emptyReservationForm());
    setDate(savedPickupDate);
    await loadReservations(savedPickupDate, "");
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
    const nextParams = new URLSearchParams();
    nextParams.set("date", date);
    setSearchParams(nextParams, { replace: true });
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

  async function deleteReservation(reservation: ReservationDto) {
    setMessage(null);
    setError(null);

    const confirmed = await confirm({
      title: "예약 삭제",
      message: `${reservation.customerName || "선택한 손님"} 예약을 삭제할까요?\n삭제 후에는 예약 목록에서 사라집니다.`,
      confirmLabel: "삭제",
      cancelLabel: "취소",
      tone: "danger"
    });

    if (!confirmed) {
      return;
    }

    const envelope = await apiDelete<{ deleted: boolean }>(`/reservation/${reservation.id}`);

    if (envelope.error) {
      setError(envelope.error.message);
      return;
    }

    setMessage(`예약 삭제 #${reservation.id}`);
    if (editingId === reservation.id) {
      cancelEdit();
    }
    await loadReservations();
  }

  return (
    <div className="relative mx-auto grid max-w-none gap-4">
      {showReservationForm ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-[rgba(43,38,34,0.4)] px-4 pt-[16px]">
          <section
            aria-label={editingId ? "예약 수정" : "새 예약 등록"}
            className="max-h-[calc(100vh-48px)] w-full max-w-[480px] overflow-y-auto rounded-[16px] bg-white px-[28px] py-[20px] shadow-[0_20px_50px_rgba(0,0,0,0.25)]"
          >
            <div className="mb-3 text-[16px] font-bold text-ink">{editingId ? "예약 수정" : "새 예약 등록"}</div>

            {message ? (
              <div className="mb-3 rounded-[9px] bg-green/10 px-[13px] py-[8px] text-[12px] font-semibold text-green">
                {message}
              </div>
            ) : null}
            {error ? (
              <div className="mb-3 rounded-[9px] bg-[#F7E3E1] px-[13px] py-[8px] text-[12px] font-semibold text-red">
                {error}
              </div>
            ) : null}
            {formErrors.length > 0 ? (
              <div className="mb-3 rounded-[9px] bg-[#F7E3E1] px-[13px] py-[8px] text-[12px] font-semibold text-red">
                <p>저장 전 확인해 주세요.</p>
                <ul className="mt-1 list-disc pl-5">
                  {formErrors.map((formError) => (
                    <li key={formError}>{formError}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <label className="mb-2 block">
              <span className="mb-[5px] block text-[11px] text-muted">손님 이름 *</span>
              <input
                aria-label="손님 이름"
                className="w-full rounded-[8px] border border-latte px-[11px] py-[8px] text-[13px] outline-none focus:border-bread"
                value={form.customerName}
                onChange={(event) => setForm((current) => ({ ...current, customerName: event.target.value }))}
              />
            </label>

            <label className="mb-2 block">
              <span className="mb-[5px] block text-[11px] text-muted">연락처 *</span>
              <input
                aria-label="연락처"
                className="w-full rounded-[8px] border border-latte px-[11px] py-[8px] text-[13px] outline-none focus:border-bread"
                inputMode="numeric"
                placeholder="010-0000-0000"
                value={form.contactPhone}
                onChange={(event) =>
                  setForm((current) => ({ ...current, contactPhone: formatPhoneInput(event.target.value) }))
                }
              />
            </label>

            <div className="mb-2">
              <div className="mb-[5px] text-[11px] text-muted">픽업 날짜</div>
              <div className="mb-2 flex gap-[6px]">
                {[
                  ["오늘", 0],
                  ["내일", 1],
                  ["모레", 2]
                ].map(([label, daysFromToday]) => {
                  const target = new Date();
                  target.setDate(target.getDate() + Number(daysFromToday));
                  const isSelected = datePart(form.pickupAt) === formatDateOnly(target);
                  return (
                    <button
                      key={label}
                      type="button"
                      className={[
                        "flex-1 rounded-[8px] py-[5px] text-center text-[12px] font-semibold transition",
                        isSelected ? "bg-bread text-white" : "bg-cream text-cocoa hover:bg-[#EFE6DA]"
                      ].join(" ")}
                      onClick={() => setQuickDate(Number(daysFromToday))}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <input
                aria-label="픽업 날짜"
                className="w-full rounded-[8px] border border-latte px-[11px] py-[8px] text-[13px] outline-none focus:border-bread"
                type="date"
                value={datePart(form.pickupAt)}
                onClick={(event) => event.currentTarget.showPicker()}
                onChange={(event) => setPickupDate(event.target.value)}
              />
            </div>

            <div className="mb-2">
              <div className="mb-[5px] text-[11px] text-muted">픽업 시간</div>
              <div aria-label="픽업 시간 빠른 선택" className="mb-2 grid grid-cols-10 gap-1">
                {modalQuickTimes.map((time) => {
                  const isSelected = timePart(form.pickupAt) === time;
                  return (
                    <button
                      key={time}
                      type="button"
                      className={[
                        "rounded-[8px] px-1 py-[5px] text-[12px] font-semibold transition",
                        isSelected ? "bg-bread text-white" : "bg-cream text-cocoa hover:bg-[#EFE6DA]"
                      ].join(" ")}
                      onClick={() => setQuickTime(time)}
                    >
                      {quickTimeLabel(time)}
                    </button>
                  );
                })}
              </div>
              <div className="grid grid-cols-2 gap-[6px]">
                <select
                  aria-label="픽업 시"
                  className="w-full rounded-[8px] border border-latte px-[11px] py-[8px] text-[13px] outline-none focus:border-bread"
                  value={timePart(form.pickupAt).slice(0, 2)}
                  onChange={(event) => setPickupHour(event.target.value)}
                >
                  {pickupHours.map((hour) => (
                    <option key={hour} value={hour}>{hour}시</option>
                  ))}
                </select>
                <select
                  aria-label="픽업 분"
                  className="w-full rounded-[8px] border border-latte px-[11px] py-[8px] text-[13px] outline-none focus:border-bread"
                  value={timePart(form.pickupAt).slice(3, 5)}
                  onChange={(event) => setPickupMinute(event.target.value)}
                >
                  {pickupMinutes.map((minute) => (
                    <option key={minute} value={minute}>{minute}분</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mb-2">
              <div className="mb-[5px] flex items-center justify-between gap-2">
                <span className="block text-[11px] text-muted">제품 및 수량 *</span>
                <button
                  type="button"
                  className="rounded-full bg-cream px-2.5 py-1 text-[11px] font-bold text-cocoa transition hover:bg-[#EFE6DA]"
                  onClick={addReservationItem}
                >
                  제품 추가
                </button>
              </div>
              <div className="grid gap-2">
                {form.items.map((item, index) => {
                  const rowProductOptions = sortProductNames(
                    item.productName && !productOptions.includes(item.productName)
                      ? [...productOptions, item.productName]
                      : productOptions
                  );
                  const rowCuttingOptions = cuttingOptionChoices(item.productName);
                  return (
                  <div
                    key={item.id}
                    className="grid min-w-0 grid-cols-[minmax(0,1fr)_5.5rem_3.25rem] items-end gap-2 rounded-[10px] border border-latte bg-white px-3 py-2"
                  >
                    <label className="grid min-w-0 gap-1">
                      <span className="text-[10.5px] font-semibold text-muted">제품명</span>
                      <select
                        aria-label={`제품명 ${index + 1}`}
                        className="min-w-0 rounded-[8px] border border-latte bg-white px-[11px] py-[8px] text-[13px] text-ink outline-none transition focus:border-bread"
                        value={item.productName}
                        onChange={(event) => updateReservationItem(item.id, { productName: event.target.value })}
                      >
                        <option value="">제품 선택</option>
                        {rowProductOptions.map((productName) => (
                          <option key={productName} value={productName}>
                            {productName}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid min-w-0 gap-1">
                      <span className="text-[10.5px] font-semibold text-muted">수량</span>
                      <span className="relative block min-w-0">
                        <input
                          aria-label={`수량 ${index + 1}`}
                          className="min-w-0 w-full rounded-[8px] border border-latte px-[9px] py-[8px] pr-7 text-right text-[13px] outline-none focus:border-bread"
                          inputMode="numeric"
                          min="1"
                          type="number"
                          value={item.quantity}
                          onChange={(event) => updateReservationItem(item.id, { quantity: event.target.value })}
                        />
                        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-muted">개</span>
                      </span>
                    </label>
                    <button
                      type="button"
                      className="rounded-[8px] border border-latte bg-cream px-1.5 py-[8px] text-[12px] font-bold text-cocoa transition hover:bg-red/10 hover:text-red disabled:cursor-not-allowed disabled:opacity-45"
                      disabled={form.items.length === 1 && !item.productName.trim()}
                      onClick={() => removeReservationItem(item.id)}
                    >
                      삭제
                    </button>
                    {rowCuttingOptions.length > 1 ? (
                      <div className="col-span-full grid gap-1 pt-1">
                        <div className="text-[10.5px] font-semibold text-muted">컷팅 옵션</div>
                        <div className="flex gap-[6px]">
                          {rowCuttingOptions.map((option) => {
                            const isSelected = normalizedCuttingOption(item.productName, item.cuttingOption) === option.value;
                            return (
                              <button
                                key={option.value}
                                type="button"
                                className={[
                                  "flex-1 rounded-[8px] py-[5px] text-center text-[12px] font-semibold transition",
                                  isSelected ? "bg-bread text-white" : "bg-cream text-cocoa hover:bg-[#EFE6DA]"
                                ].join(" ")}
                                onClick={() => updateReservationItem(item.id, { cuttingOption: option.value })}
                              >
                                {option.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                  );
                })}
              </div>
            </div>


            <div className="mb-3 flex gap-4">
              <label className="flex cursor-pointer items-center gap-[7px]">
                <input
                  className="h-[18px] w-[18px] rounded-[5px] accent-bread"
                  checked={form.isPaid}
                  type="checkbox"
                  onChange={(event) =>
                    setForm((current) => ({ ...current, isPaid: event.target.checked }))
                  }
                />
                <span className="text-[12.5px] text-ink">결제완료</span>
              </label>
              <label className="flex cursor-pointer items-center gap-[7px]">
                <input
                  className="h-[18px] w-[18px] rounded-[5px] accent-bread"
                  checked={form.isBag}
                  type="checkbox"
                  onChange={(event) =>
                    setForm((current) => ({ ...current, isBag: event.target.checked }))
                  }
                />
                <span className="text-[12.5px] text-ink">비닐봉투</span>
              </label>
            </div>

            <label className="mb-[18px] block">
              <span className="mb-[5px] block text-[11px] text-muted">예약 메모</span>
              <textarea
                aria-label="예약 메모"
                className="min-h-[76px] w-full rounded-[8px] border border-latte px-[11px] py-[8px] text-[13px] outline-none focus:border-bread"
                placeholder="예: 깜빠뉴 반씩 따로 포장"
                value={form.memo}
                onChange={(event) => setForm((current) => ({ ...current, memo: event.target.value }))}
              />
            </label>

            <div className="flex gap-[10px]">
              <button
                type="button"
                className="flex-1 rounded-[9px] bg-cream py-[11px] text-center text-[13.5px] font-semibold text-cocoa transition hover:bg-[#EFE6DA]"
                onClick={cancelEdit}
              >
                취소
              </button>
              <button
                type="button"
                className="flex-1 rounded-[9px] bg-bread py-[11px] text-center text-[13.5px] font-semibold text-white transition hover:bg-cocoa"
                onClick={() => void saveReservation()}
              >
                {editingId ? "수정" : "등록"}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      <section className="panel min-w-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="section-title">예약 · {date.replaceAll("-", ".")}</h2>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="grid min-w-40 max-w-full cursor-pointer gap-1">
              <span className="text-[11px] font-semibold text-muted">조회 날짜</span>
              <input
                aria-label="예약 조회 날짜"
                className="input w-40 max-w-full cursor-pointer"
                type="date"
                value={date}
                onClick={(event) => event.currentTarget.showPicker()}
                onChange={(event) => setReservationListDate(event.target.value)}
              />
            </label>
            <label className="grid min-w-48 max-w-full gap-1">
              <span className="text-[11px] font-semibold text-muted">예약 검색</span>
              <input
                aria-label="예약 검색"
                className="input w-52 max-w-full"
                placeholder="이름·연락처·제품·메모"
                value={reservationQuery}
                onChange={(event) => setReservationQuery(event.target.value)}
              />
            </label>
            <button
              type="button"
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[0.9rem] bg-white px-3 text-sm font-extrabold text-cocoa shadow-sm ring-1 ring-latte transition hover:-translate-y-0.5 hover:bg-cream hover:shadow-md active:translate-y-0"
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
          {reservationQuery.trim() ? "다른 날짜까지 검색 중" : `${date.replaceAll("-", ".")} 픽업 체크리스트`} · 전체 {reservations.length}건 / 대기 {pendingCount}건 / 픽업완료 {completedCount}건
          {overdueCount > 0 ? <span className="ml-2 rounded-full bg-red/10 px-2 py-0.5 text-red">픽업 지연 {overdueCount}건</span> : null}
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
        <div className="grid gap-3">
          {sortedReservations.map((reservation) => {
            const isLate = reservation.status !== "COMPLETED" && isPastPickup(reservation.pickupAt);
            const customerName = reservation.customerName || "이름 없음";
            const cuttingBadges = reservation.items
              .map((item) => cuttingOptionLabel(item.cuttingOption))
              .filter((label): label is string => Boolean(label));

            return (
              <article
                key={reservation.id}
                aria-label={`${customerName} 예약`}
                className="dc-card grid gap-3 px-4 py-4 md:grid-cols-[9rem_minmax(0,1fr)] md:gap-4"
              >
                <div className="flex flex-row items-start justify-between gap-3 border-b border-latte pb-3 md:block md:border-b-0 md:border-r md:pb-0 md:pr-4">
                  <div>
                    <div className="text-[11px] font-semibold text-muted">픽업 시간</div>
                    <div className={[
                      "mt-1 text-[17px] font-bold leading-6",
                      isLate ? "text-red" : "text-ink"
                    ].join(" ")}
                    >
                      {formatPickupDateTime(reservation.pickupAt)}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2 md:mt-3 md:flex-col">
                    <button
                      type="button"
                      className="rounded-full border border-latte bg-white px-3 py-1 text-[11px] font-semibold text-cocoa transition hover:bg-cream"
                      onClick={() => startEdit(reservation)}
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      aria-label={`${customerName} 예약 삭제`}
                      className="rounded-full border border-red/20 bg-red/5 px-3 py-1 text-[11px] font-semibold text-red transition hover:bg-red/10"
                      onClick={() => void deleteReservation(reservation)}
                    >
                      삭제
                    </button>
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="text-[15px] font-bold text-ink">{customerName}님</div>
                      <div className="mt-0.5 text-xs font-medium text-muted">{reservation.contactPhone || "연락처 없음"}</div>
                    </div>
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

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {reservation.items.length > 0 ? reservation.items.map((item, itemIndex) => (
                      <span
                        key={`${item.productName}-${itemIndex}`}
                        className="rounded-full bg-cream px-2.5 py-1 text-xs font-semibold text-ink"
                      >
                        {formatReservationItem(item)}
                      </span>
                    )) : <span className="text-xs font-medium text-muted">제품 없음</span>}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {cuttingBadges.map((badge, badgeIndex) => (
                      <span key={`${badge}-${badgeIndex}`} className="rounded-full border border-latte bg-white px-2.5 py-1 text-[11px] font-semibold text-muted">
                        {badge}
                      </span>
                    ))}
                    {reservation.isPaid ? (
                      <span className="rounded-full border border-latte bg-white px-2.5 py-1 text-[11px] font-semibold text-muted">결제완료</span>
                    ) : null}
                    {reservation.isBag ? (
                      <span className="rounded-full border border-latte bg-white px-2.5 py-1 text-[11px] font-semibold text-muted">비닐봉투</span>
                    ) : null}
                  </div>

                  {reservation.memo ? (
                    <div className="mt-3 border-l-2 border-bread bg-cream/50 px-3 py-2 text-xs leading-5 text-ink">
                      <span className="mr-2 font-bold text-cocoa">메모</span>
                      {reservation.memo}
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
          {!isLoading && reservations.length === 0 ? (
            <div className="dc-card px-3 py-8 text-center text-sm font-medium text-muted">
              예약 없음
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
