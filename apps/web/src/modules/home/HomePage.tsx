import { Bell, CalendarDays, CheckCircle2, Target, TrendingUp } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { apiDelete, apiGet, apiPatch, apiPost } from "../../shared/api/client.js";
import type { ListEnvelope } from "../../shared/api/types.js";
import { todayInStoreTime } from "../../shared/time/storeTime.js";

type NotificationDto = {
  id: number;
  title: string;
  severity: "INFO" | "WARN" | "CRITICAL";
  link?: string;
};

type AnnualScheduleDto = {
  id: string;
  date: string;
  title: string;
  note: string;
  tone?: ScheduleTone;
};

type ScheduleTone = "launch" | "close" | "notice";

type AnnualScheduleItem = {
  id?: string;
  month: number;
  day: number;
  title: string;
  note: string;
  tone: ScheduleTone;
};

type ScheduleForm = {
  date: string;
  title: string;
  note: string;
  tone: ScheduleTone | "";
};

type CalendarViewMode = "month" | "year";
type ScheduleActionMode = "none" | "edit" | "delete";

type AnnualGoalNotice = {
  label: string;
  value: string;
  note: string;
};

const monthNames = [
  "1월",
  "2월",
  "3월",
  "4월",
  "5월",
  "6월",
  "7월",
  "8월",
  "9월",
  "10월",
  "11월",
  "12월"
];

const weekdayLabels = ["일", "월", "화", "수", "목", "금", "토"];

const annualScheduleItems: AnnualScheduleItem[] = [
  {
    month: 6,
    day: 26,
    title: "여름깜빠뉴 출시",
    note: "시즌 POP, 진열 위치, 직원 안내 멘트 확인",
    tone: "launch"
  },
  {
    month: 8,
    day: 31,
    title: "여름깜빠뉴 마감",
    note: "잔여 재료, 고객 문의 안내, 다음 시즌 전환 준비",
    tone: "close"
  }
];

const annualGoalNotices: AnnualGoalNotice[] = [
  {
    label: "올해 매출 목표",
    value: "전년 대비 +12%",
    note: "나중에 실제 목표 금액을 입력하면 이 자리에 고정 공지로 보여줍니다."
  },
  {
    label: "운영 목표",
    value: "품절·손실 사유 매일 기록",
    note: "일일 운영 입력률을 높여 생산량 조정과 손실 원인 확인에 사용합니다."
  }
];

function toAnnualScheduleItem(item: AnnualScheduleDto): AnnualScheduleItem {
  const [, monthText = "1", dayText = "1"] = item.date.split("-");
  return {
    id: item.id,
    month: Number(monthText),
    day: Number(dayText),
    title: item.title,
    note: item.note,
    tone: item.tone ?? "notice"
  };
}

function dateFromScheduleItem(item: AnnualScheduleItem, year: string): string {
  return `${year}-${String(item.month).padStart(2, "0")}-${String(item.day).padStart(2, "0")}`;
}

function isCompleteScheduleForm(form: ScheduleForm): form is ScheduleForm & { tone: ScheduleTone } {
  return Boolean(form.date && form.title.trim() && form.tone);
}

function scheduleFormFromItem(item: AnnualScheduleItem, year: string): ScheduleForm {
  return {
    date: dateFromScheduleItem(item, year),
    title: item.title,
    note: item.note,
    tone: item.tone
  };
}

function scheduleBadgeLabel(tone: AnnualScheduleItem["tone"]): string {
  if (tone === "launch") {
    return "출시";
  }
  if (tone === "close") {
    return "마감";
  }
  return "공지";
}

function scheduleBadgeClass(tone: AnnualScheduleItem["tone"]): string {
  if (tone === "launch") {
    return "bg-green/10 text-green";
  }
  if (tone === "close") {
    return "bg-red/10 text-red";
  }
  return "bg-blue/10 text-blue";
}

function getCalendarCells(year: number, month: number): Array<number | null> {
  const firstDay = new Date(year, month - 1, 1).getDay();
  const lastDate = new Date(year, month, 0).getDate();
  const cells: Array<number | null> = Array.from({ length: firstDay }, () => null);

  for (let day = 1; day <= lastDate; day += 1) {
    cells.push(day);
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

export function HomePage() {
  const [date] = useState(todayInStoreTime());
  const [storedScheduleItems, setStoredScheduleItems] = useState<AnnualScheduleItem[]>([]);
  const [scheduleForm, setScheduleForm] = useState<ScheduleForm>({
    date,
    title: "",
    note: "",
    tone: ""
  });
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [editingScheduleForm, setEditingScheduleForm] = useState<ScheduleForm>({
    date,
    title: "",
    note: "",
    tone: ""
  });
  const [calendarViewMode, setCalendarViewMode] = useState<CalendarViewMode>("month");
  const [selectedMonth, setSelectedMonth] = useState(Number(date.slice(5, 7)));
  const [expandedScheduleKeys, setExpandedScheduleKeys] = useState<string[]>([]);
  const [scheduleActionMode, setScheduleActionMode] = useState<ScheduleActionMode>("none");
  const [selectedScheduleIds, setSelectedScheduleIds] = useState<string[]>([]);
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentYear = date.slice(0, 4);
  const allScheduleItems = useMemo(
    () =>
      [...annualScheduleItems, ...storedScheduleItems].sort(
        (left, right) => left.month - right.month || left.day - right.day
      ),
    [storedScheduleItems]
  );
  const scheduleByMonth = useMemo(
    () =>
      monthNames.map((name, index) => ({
        month: index + 1,
        name,
        items: allScheduleItems.filter((item) => item.month === index + 1)
      })),
    [allScheduleItems]
  );
  const visibleScheduleMonths =
    calendarViewMode === "year"
      ? scheduleByMonth
      : scheduleByMonth.filter((month) => month.month === selectedMonth);

  const loadAnnualSchedule = useCallback(async () => {
    const envelope = await apiGet<{ items: AnnualScheduleDto[] }>("/annual-schedule");
    if (!envelope.data) {
      return;
    }
    setStoredScheduleItems(envelope.data.items.map(toAnnualScheduleItem));
  }, []);

  async function addScheduleItem() {
    if (!isCompleteScheduleForm(scheduleForm)) {
      return;
    }
    const envelope = await apiPost<AnnualScheduleDto, ScheduleForm>("/annual-schedule", {
      date: scheduleForm.date,
      title: scheduleForm.title.trim(),
      note: scheduleForm.note.trim(),
      tone: scheduleForm.tone
    });
    if (!envelope.data) {
      return;
    }
    const createdItem = toAnnualScheduleItem(envelope.data);
    setStoredScheduleItems((current) => [...current, createdItem]);
    setSelectedMonth(createdItem.month);
    setCalendarViewMode("month");
    setScheduleForm((current) => ({ ...current, title: "", note: "", tone: "" }));
  }

  function beginScheduleAction(mode: Exclude<ScheduleActionMode, "none">) {
    setScheduleActionMode(mode);
    setSelectedScheduleIds([]);
    cancelEditingSchedule();
    setError(null);
  }

  function cancelScheduleAction() {
    setScheduleActionMode("none");
    setSelectedScheduleIds([]);
  }

  function toggleSelectedSchedule(itemId: string) {
    setSelectedScheduleIds((current) => {
      if (scheduleActionMode === "edit") {
        return current.includes(itemId) ? [] : [itemId];
      }
      return current.includes(itemId)
        ? current.filter((selectedId) => selectedId !== itemId)
        : [...current, itemId];
    });
  }

  function startEditingSchedule(item: AnnualScheduleItem) {
    if (!item.id) {
      return;
    }
    setEditingScheduleId(item.id);
    setEditingScheduleForm(scheduleFormFromItem(item, currentYear));
    cancelScheduleAction();
  }

  function confirmEditingSelection() {
    const [itemId] = selectedScheduleIds;
    const item = storedScheduleItems.find((scheduleItem) => scheduleItem.id === itemId);
    if (!item) {
      setError("수정할 스케줄을 선택해주세요.");
      return;
    }
    startEditingSchedule(item);
  }

  function cancelEditingSchedule() {
    setEditingScheduleId(null);
    setEditingScheduleForm({ date, title: "", note: "", tone: "" });
  }

  async function updateScheduleItem(itemId: string) {
    if (!isCompleteScheduleForm(editingScheduleForm)) {
      return;
    }
    const envelope = await apiPatch<AnnualScheduleDto, ScheduleForm>(`/annual-schedule/${itemId}`, {
      date: editingScheduleForm.date,
      title: editingScheduleForm.title.trim(),
      note: editingScheduleForm.note.trim(),
      tone: editingScheduleForm.tone
    });
    if (!envelope.data) {
      if (envelope.error) {
        setError(envelope.error.message);
      }
      return;
    }
    const updatedItem = toAnnualScheduleItem(envelope.data);
    setStoredScheduleItems((current) =>
      current.map((item) => (item.id === itemId ? updatedItem : item))
    );
    setSelectedMonth(updatedItem.month);
    setCalendarViewMode("month");
    cancelEditingSchedule();
  }

  async function deleteSelectedScheduleItems() {
    if (selectedScheduleIds.length === 0) {
      setError("삭제할 스케줄을 선택해주세요.");
      return;
    }

    for (const itemId of selectedScheduleIds) {
      const envelope = await apiDelete<{ deleted: boolean }>(`/annual-schedule/${itemId}`);
      if (envelope.error) {
        setError(envelope.error.message);
        return;
      }
    }

    setStoredScheduleItems((current) =>
      current.filter((item) => !item.id || !selectedScheduleIds.includes(item.id))
    );
    if (editingScheduleId && selectedScheduleIds.includes(editingScheduleId)) {
      cancelEditingSchedule();
    }
    cancelScheduleAction();
  }

  const loadScheduleNotifications = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const notificationEnvelope = await apiGet<ListEnvelope<NotificationDto>>("/notification");

      if (notificationEnvelope.error) {
        setError(notificationEnvelope.error.message);
        return;
      }

      setNotifications(notificationEnvelope.data.items.slice(0, 5));
    } catch (unknownError) {
      setError(
        unknownError instanceof Error ? unknownError.message : "스케줄 알림을 조회하지 못했습니다."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadScheduleNotifications();
    void loadAnnualSchedule();
  }, [loadAnnualSchedule, loadScheduleNotifications]);

  function renderScheduleItem(item: AnnualScheduleItem, showDate: boolean) {
    const itemKey = item.id ?? `${item.month}-${item.day}-${item.title}`;
    const isLong = `${item.title} ${item.note}`.length > 44;
    const isExpanded = expandedScheduleKeys.includes(itemKey);
    const isEditing = item.id === editingScheduleId;
    const selectionLabel = scheduleActionMode === "delete" ? "삭제" : "수정";

    if (isEditing && item.id) {
      return (
        <div key={itemKey} className="rounded-control bg-cream/70 p-3">
          <div className="grid gap-2">
            <div className="grid gap-2 sm:grid-cols-[10rem_8rem]">
              <label className="grid gap-1">
                <span className="text-xs font-bold text-cocoa">날짜</span>
                <input
                  className="input h-10"
                  type="date"
                  value={editingScheduleForm.date}
                  onChange={(event) =>
                    setEditingScheduleForm((current) => ({ ...current, date: event.target.value }))
                  }
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-bold text-cocoa">구분</span>
                <select
                  className="input h-10"
                  aria-label="수정 스케줄 구분"
                  value={editingScheduleForm.tone}
                  onChange={(event) =>
                    setEditingScheduleForm((current) => ({
                      ...current,
                      tone: event.target.value as ScheduleForm["tone"]
                    }))
                  }
                >
                  <option value="">선택</option>
                  <option value="notice">공지</option>
                  <option value="launch">출시</option>
                  <option value="close">마감</option>
                </select>
              </label>
            </div>
            <label className="grid gap-1">
              <span className="text-xs font-bold text-cocoa">제목</span>
              <input
                className="input h-10"
                value={editingScheduleForm.title}
                onChange={(event) =>
                  setEditingScheduleForm((current) => ({ ...current, title: event.target.value }))
                }
              />
            </label>
            <label className="grid gap-1">
              <span className="text-xs font-bold text-cocoa">메모</span>
              <input
                className="input h-10"
                value={editingScheduleForm.note}
                onChange={(event) =>
                  setEditingScheduleForm((current) => ({ ...current, note: event.target.value }))
                }
              />
            </label>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                className="rounded-control border border-latte bg-white px-3 py-1.5 text-xs font-bold text-cocoa"
                type="button"
                onClick={cancelEditingSchedule}
              >
                취소
              </button>
              <button
                className="rounded-control bg-cocoa px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                type="button"
                disabled={!isCompleteScheduleForm(editingScheduleForm)}
                onClick={() => void updateScheduleItem(item.id!)}
              >
                저장
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div key={itemKey} className="rounded-control bg-cream/70 p-2.5">
        <div className="flex items-start gap-2">
          {scheduleActionMode !== "none" && item.id ? (
            <input
              className="mt-1 h-4 w-4 rounded border-latte accent-cocoa"
              type="checkbox"
              aria-label={`${item.title} ${selectionLabel} 선택`}
              checked={selectedScheduleIds.includes(item.id)}
              onChange={() => toggleSelectedSchedule(item.id!)}
            />
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              {showDate ? (
                <span className="text-sm font-bold text-ink">
                  {item.month}/{item.day}
                </span>
              ) : null}
              <span
                className={[
                  "rounded-full px-2 py-0.5 text-[0.68rem] font-bold",
                  scheduleBadgeClass(item.tone)
                ].join(" ")}
              >
                {scheduleBadgeLabel(item.tone)}
              </span>
            </div>
            <div className={isExpanded ? "" : "max-h-14 overflow-hidden"}>
              <p className="mt-1 text-xs font-bold leading-5 text-ink">{item.title}</p>
              {item.note ? (
                <p className="mt-0.5 text-[0.68rem] leading-4 text-muted">{item.note}</p>
              ) : null}
            </div>
            {isLong ? (
              <button
                className="mt-1 text-xs font-bold text-blue hover:underline"
                type="button"
                onClick={() =>
                  setExpandedScheduleKeys((current) =>
                    current.includes(itemKey)
                      ? current.filter((key) => key !== itemKey)
                      : [...current, itemKey]
                  )
                }
              >
                {isExpanded ? "접기" : "더보기"}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-4">
      <section className="panel min-w-0">
        <div className="panel-heading">
          <div>
            <p className="text-sm text-muted">년도별·월별 공통 행사</p>
            <h2 className="section-title">연간 스케줄 달력</h2>
            <p className="mt-1 text-sm text-muted">
              {currentYear}년 연간 스케줄 · 실제 일정은 나중에 입력받아 여기에 추가하면 됩니다.
            </p>
          </div>
          <CalendarDays className="h-5 w-5 text-bread" aria-hidden="true" />
        </div>
        <div className="mb-4 rounded-control border border-latte bg-cream/50 p-4">
          <h3 className="text-base font-bold text-cocoa">스케줄 입력</h3>
          <div className="mt-3 grid gap-3 lg:grid-cols-[11rem_8rem_minmax(0,1fr)_minmax(0,1.4fr)_auto] lg:items-end">
            <label className="grid gap-2">
              <span className="field-label">날짜</span>
              <input
                className="input"
                type="date"
                value={scheduleForm.date}
                onChange={(event) =>
                  setScheduleForm((current) => ({ ...current, date: event.target.value }))
                }
              />
            </label>
            <label className="grid gap-2">
              <span className="field-label">구분</span>
              <select
                className="input"
                aria-label="스케줄 구분"
                value={scheduleForm.tone}
                onChange={(event) =>
                  setScheduleForm((current) => ({
                    ...current,
                    tone: event.target.value as ScheduleForm["tone"]
                  }))
                }
              >
                <option value="">선택</option>
                <option value="notice">공지</option>
                <option value="launch">출시</option>
                <option value="close">마감</option>
              </select>
            </label>
            <label className="grid gap-2">
              <span className="field-label">제목</span>
              <input
                className="input"
                placeholder="예: 여름깜빠뉴 출시"
                value={scheduleForm.title}
                onChange={(event) =>
                  setScheduleForm((current) => ({ ...current, title: event.target.value }))
                }
              />
            </label>
            <label className="grid gap-2">
              <span className="field-label">메모</span>
              <input
                className="input"
                placeholder="직원이 함께 볼 준비사항"
                value={scheduleForm.note}
                onChange={(event) =>
                  setScheduleForm((current) => ({ ...current, note: event.target.value }))
                }
              />
            </label>
            <button
              className="min-h-11 rounded-control bg-cocoa px-4 font-bold text-white shadow-control disabled:opacity-50"
              type="button"
              disabled={!isCompleteScheduleForm(scheduleForm)}
              onClick={() => void addScheduleItem()}
            >
              추가
            </button>
          </div>
        </div>
        <div className="mb-4 grid gap-3 rounded-control border border-latte bg-white/80 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-cocoa">달력 보기</p>
              <p className="text-xs text-muted">
                기본은 이번 달만 크게 보고, 필요한 달이나 1년 전체는 따로 열어봅니다.
              </p>
            </div>
            <button
              className={[
                "rounded-control border px-3 py-2 text-sm font-bold transition",
                calendarViewMode === "year"
                  ? "border-cocoa bg-cocoa text-white"
                  : "border-latte bg-white text-cocoa hover:border-bread"
              ].join(" ")}
              type="button"
              onClick={() =>
                setCalendarViewMode((current) => (current === "year" ? "month" : "year"))
              }
            >
              {calendarViewMode === "year" ? "선택한 달만 보기" : "1년 전체 보기"}
            </button>
          </div>
          <div className="flex flex-wrap gap-2" aria-label="다른 달 보기">
            {scheduleByMonth.map((month) => (
              <button
                key={month.month}
                className={[
                  "rounded-full border px-3 py-1.5 text-xs font-bold transition",
                  calendarViewMode === "month" && selectedMonth === month.month
                    ? "border-cocoa bg-cocoa text-white"
                    : "border-latte bg-cream/70 text-cocoa hover:border-bread"
                ].join(" ")}
                type="button"
                onClick={() => {
                  setSelectedMonth(month.month);
                  setCalendarViewMode("month");
                }}
              >
                {month.name}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-latte pt-3">
            <button
              className={[
                "rounded-control border px-3 py-2 text-sm font-bold transition",
                scheduleActionMode === "delete"
                  ? "border-red bg-red text-white"
                  : "border-red/30 bg-white text-red hover:bg-red/10"
              ].join(" ")}
              type="button"
              onClick={() => beginScheduleAction("delete")}
            >
              삭제
            </button>
            <button
              className={[
                "rounded-control border px-3 py-2 text-sm font-bold transition",
                scheduleActionMode === "edit"
                  ? "border-cocoa bg-cocoa text-white"
                  : "border-latte bg-white text-cocoa hover:border-bread"
              ].join(" ")}
              type="button"
              onClick={() => beginScheduleAction("edit")}
            >
              수정
            </button>
            {scheduleActionMode !== "none" ? (
              <>
                <span className="text-xs font-bold text-muted">
                  {scheduleActionMode === "delete"
                    ? "삭제할 일정을 체크한 뒤 확인을 누르세요."
                    : "수정할 일정 하나를 체크한 뒤 확인을 누르세요."}
                </span>
                <button
                  className="rounded-control bg-cocoa px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
                  type="button"
                  disabled={selectedScheduleIds.length === 0}
                  onClick={() =>
                    scheduleActionMode === "delete"
                      ? void deleteSelectedScheduleItems()
                      : confirmEditingSelection()
                  }
                >
                  확인
                </button>
                <button
                  className="rounded-control border border-latte bg-white px-3 py-2 text-sm font-bold text-cocoa"
                  type="button"
                  onClick={cancelScheduleAction}
                >
                  취소
                </button>
              </>
            ) : null}
          </div>
        </div>
        <div
          className={
            calendarViewMode === "year" ? "grid gap-3 md:grid-cols-2 xl:grid-cols-3" : "grid gap-3"
          }
        >
          {visibleScheduleMonths.map((month) => {
            const calendarCells = getCalendarCells(Number(currentYear), month.month);
            return (
              <section
                key={month.month}
                className={[
                  "rounded-control border border-latte bg-white/85 p-4 shadow-control",
                  calendarViewMode === "year" ? "min-h-40" : "min-h-[34rem]"
                ].join(" ")}
              >
                <div className="mb-3 flex items-center justify-between border-b border-latte pb-2">
                  <h3
                    className={
                      calendarViewMode === "year"
                        ? "text-lg font-bold text-cocoa"
                        : "text-2xl font-bold text-cocoa"
                    }
                  >
                    {month.name}
                  </h3>
                  <span className="text-xs font-bold text-muted">{currentYear}</span>
                </div>
                {calendarViewMode === "year" ? (
                  month.items.length > 0 ? (
                    <div className="space-y-3">
                      {month.items.map((item) => renderScheduleItem(item, true))}
                    </div>
                  ) : (
                    <div className="grid min-h-24 place-items-center rounded-control border border-dashed border-latte text-sm font-semibold text-muted">
                      등록된 스케줄 없음
                    </div>
                  )
                ) : (
                  <div className="overflow-hidden rounded-control border border-latte bg-white">
                    <div className="grid grid-cols-7 border-b border-latte bg-cream/70 text-center text-xs font-bold text-cocoa">
                      {weekdayLabels.map((weekday) => (
                        <div key={weekday} className="px-2 py-2">
                          {weekday}
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7">
                      {calendarCells.map((day, index) => {
                        const dayItems = day ? month.items.filter((item) => item.day === day) : [];
                        return (
                          <div
                            key={`${month.month}-${day ?? `empty-${index}`}`}
                            className="min-h-28 border-b border-r border-latte/70 p-2 last:border-r-0"
                            aria-label={day ? `${month.name} ${day}일` : undefined}
                          >
                            {day ? (
                              <>
                                <div className="mb-2 text-sm font-bold text-ink">{day}</div>
                                <div className="space-y-1.5">
                                  {dayItems.map((item) => renderScheduleItem(item, false))}
                                </div>
                              </>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </section>

      <section className="panel min-w-0">
        <div className="panel-heading">
          <div>
            <p className="text-sm text-muted">직원 공통 확인사항</p>
            <h2 className="section-title">올해 목표·매출 공지</h2>
          </div>
          <Target className="h-5 w-5 text-green" aria-hidden="true" />
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {annualGoalNotices.map((notice) => (
            <div key={notice.label} className="rounded-control border border-latte bg-cream/70 p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-bold text-cocoa">
                <TrendingUp className="h-4 w-4" aria-hidden="true" />
                {notice.label}
              </div>
              <p className="text-2xl font-bold tracking-[-0.03em] text-ink">{notice.value}</p>
              <p className="mt-2 text-sm leading-6 text-muted">{notice.note}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="panel min-w-0">
        <div className="panel-heading">
          <div>
            <p className="text-sm text-muted">스케줄 관련 최신 알림</p>
            <h2 className="section-title">스케줄 알림</h2>
          </div>
          <Link className="text-sm font-semibold text-blue hover:underline" to="/notification">
            전체 보기
          </Link>
        </div>
        {error ? (
          <div className="mb-4 rounded-control border border-red/20 bg-red/10 px-3 py-2 text-sm font-semibold text-red">
            {error}
          </div>
        ) : null}
        <div className="space-y-3">
          {notifications.map((notification) => (
            <Link
              key={notification.id}
              to={notification.link ?? "/notification"}
              className="flex min-h-12 items-center gap-3 rounded-control border border-stone-200 px-3"
            >
              <Bell className="h-5 w-5 shrink-0 text-bread" aria-hidden="true" />
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
              스케줄 알림 없음
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
