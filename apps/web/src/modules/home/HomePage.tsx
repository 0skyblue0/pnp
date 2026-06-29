import { Bell, CalendarDays, CheckCircle2, Target, TrendingUp } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

type AnnualGoalNoticeCategory = "sales" | "operation" | "staff";

type AnnualGoalNoticeDto = {
  id: string;
  category: AnnualGoalNoticeCategory;
  title: string;
  value: string;
  note: string;
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
type HomeTab = "goal" | "schedule";

type AnnualGoalNotice = {
  id?: string;
  category: AnnualGoalNoticeCategory;
  title: string;
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

function toAnnualGoalNotice(item: AnnualGoalNoticeDto): AnnualGoalNotice {
  return {
    id: item.id,
    category: item.category,
    title: item.title,
    value: item.value,
    note: item.note
  };
}

function goalNoticeKey(item: AnnualGoalNotice): string {
  return item.id ?? `static-${item.category}-${item.title}`;
}

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

function scheduleItemKey(item: AnnualScheduleItem): string {
  return item.id ?? `static-${item.month}-${item.day}-${item.title}`;
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
  const detailScheduleRef = useRef<HTMLDivElement | null>(null);
  const [date] = useState(todayInStoreTime());
  const [storedScheduleItems, setStoredScheduleItems] = useState<AnnualScheduleItem[]>([]);
  const [storedGoalNotices, setStoredGoalNotices] = useState<AnnualGoalNotice[]>([]);
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
  const [activeHomeTab, setActiveHomeTab] = useState<HomeTab>("goal");
  const [calendarViewMode, setCalendarViewMode] = useState<CalendarViewMode>("month");
  const [selectedMonth, setSelectedMonth] = useState(Number(date.slice(5, 7)));
  const [detailScheduleKey, setDetailScheduleKey] = useState<string | null>(null);
  const [detailGoalNoticeKey, setDetailGoalNoticeKey] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentYear = date.slice(0, 4);
  const allScheduleItems = useMemo(
    () =>
      [...storedScheduleItems].sort(
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
  const detailScheduleItem = useMemo(
    () => allScheduleItems.find((item) => scheduleItemKey(item) === detailScheduleKey) ?? null,
    [allScheduleItems, detailScheduleKey]
  );
  const allGoalNotices = storedGoalNotices;
  const detailGoalNotice = useMemo(
    () => allGoalNotices.find((item) => goalNoticeKey(item) === detailGoalNoticeKey) ?? null,
    [allGoalNotices, detailGoalNoticeKey]
  );

  const loadAnnualSchedule = useCallback(async () => {
    const envelope = await apiGet<{ items: AnnualScheduleDto[] }>("/annual-schedule");
    if (!envelope.data) {
      return;
    }
    setStoredScheduleItems(envelope.data.items.map(toAnnualScheduleItem));
  }, []);

  const loadAnnualGoalNotices = useCallback(async () => {
    const envelope = await apiGet<ListEnvelope<AnnualGoalNoticeDto>>("/annual-goal-notice");
    if (!envelope.data) {
      return;
    }
    setStoredGoalNotices(envelope.data.items.map(toAnnualGoalNotice));
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

  function startEditingSchedule(item: AnnualScheduleItem) {
    if (!item.id) {
      return;
    }
    setEditingScheduleId(item.id);
    setEditingScheduleForm(scheduleFormFromItem(item, currentYear));
  }

  function openScheduleDetail(item: AnnualScheduleItem) {
    setDetailScheduleKey(scheduleItemKey(item));
    cancelEditingSchedule();
    setError(null);
  }

  function closeScheduleDetail() {
    setDetailScheduleKey(null);
    cancelEditingSchedule();
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
    setDetailScheduleKey(updatedItem.id ?? null);
    setSelectedMonth(updatedItem.month);
    setCalendarViewMode("month");
    cancelEditingSchedule();
  }

  async function deleteScheduleItem(itemId: string) {
    const envelope = await apiDelete<{ deleted: boolean }>(`/annual-schedule/${itemId}`);
    if (envelope.error) {
      setError(envelope.error.message);
      return false;
    }

    setStoredScheduleItems((current) => current.filter((item) => item.id !== itemId));
    if (editingScheduleId === itemId) {
      cancelEditingSchedule();
    }
    if (detailScheduleKey === itemId) {
      setDetailScheduleKey(null);
    }
    return true;
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
    void loadAnnualGoalNotices();
  }, [loadAnnualGoalNotices, loadAnnualSchedule, loadScheduleNotifications]);

  useEffect(() => {
    if (!detailScheduleKey) {
      return;
    }
    detailScheduleRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [detailScheduleKey]);

  function renderScheduleItem(item: AnnualScheduleItem, showDate: boolean) {
    const itemKey = scheduleItemKey(item);

    const itemContent = (
      <div className="flex items-start gap-2">
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
          <p className="mt-1 text-xs font-bold leading-5 text-ink">{item.title}</p>
        </div>
      </div>
    );

    return (
      <div key={itemKey} className="rounded-control bg-cream/70 p-2.5">
        <button
          className="block w-full text-left"
          type="button"
          aria-label={`${item.title} 상세 보기`}
          onClick={(event) => {
            event.stopPropagation();
            openScheduleDetail(item);
          }}
        >
          {itemContent}
        </button>
      </div>
    );
  }

  function renderScheduleDetail() {
    if (!detailScheduleItem) {
      return null;
    }

    if (editingScheduleId === detailScheduleItem.id) {
      return (
        <div
          className="mb-4 rounded-control border border-cocoa/20 bg-white p-4 shadow-control"
          ref={detailScheduleRef}
          role="region"
          aria-label="스케줄 상세창"
        >
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-muted">선택한 스케줄</p>
              <h3 className="text-lg font-bold text-cocoa">스케줄 상세</h3>
            </div>
            <button
              className="rounded-control border border-latte bg-white px-3 py-1.5 text-xs font-bold text-cocoa"
              type="button"
              onClick={closeScheduleDetail}
            >
              닫기
            </button>
          </div>
          <div className="grid gap-3">
            <div className="grid gap-2 sm:grid-cols-[11rem_8rem]">
              <label className="grid gap-1">
                <span className="field-label">날짜</span>
                <input
                  className="input"
                  aria-label="상세 수정 날짜"
                  type="date"
                  value={editingScheduleForm.date}
                  onChange={(event) =>
                    setEditingScheduleForm((current) => ({ ...current, date: event.target.value }))
                  }
                />
              </label>
              <label className="grid gap-1">
                <span className="field-label">구분</span>
                <select
                  className="input"
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
              <span className="field-label">제목</span>
              <input
                className="input"
                value={editingScheduleForm.title}
                onChange={(event) =>
                  setEditingScheduleForm((current) => ({ ...current, title: event.target.value }))
                }
              />
            </label>
            <label className="grid gap-1">
              <span className="field-label">메모</span>
              <input
                className="input"
                value={editingScheduleForm.note}
                onChange={(event) =>
                  setEditingScheduleForm((current) => ({ ...current, note: event.target.value }))
                }
              />
            </label>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                className="rounded-control border border-latte bg-white px-3 py-2 text-sm font-bold text-cocoa"
                type="button"
                onClick={cancelEditingSchedule}
              >
                취소
              </button>
              <button
                className="rounded-control bg-cocoa px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
                type="button"
                disabled={!isCompleteScheduleForm(editingScheduleForm)}
                onClick={() => void updateScheduleItem(detailScheduleItem.id!)}
              >
                저장
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        className="mb-4 rounded-control border border-cocoa/20 bg-white p-4 shadow-control"
        ref={detailScheduleRef}
        role="region"
        aria-label="스케줄 상세창"
      >
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-muted">선택한 스케줄</p>
            <h3 className="text-lg font-bold text-cocoa">스케줄 상세</h3>
          </div>
          <button
            className="rounded-control border border-latte bg-white px-3 py-1.5 text-xs font-bold text-cocoa"
            type="button"
            onClick={closeScheduleDetail}
          >
            닫기
          </button>
        </div>
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-ink">
              {detailScheduleItem.month}/{detailScheduleItem.day}
            </span>
            <span
              className={[
                "rounded-full px-2 py-0.5 text-xs font-bold",
                scheduleBadgeClass(detailScheduleItem.tone)
              ].join(" ")}
            >
              {scheduleBadgeLabel(detailScheduleItem.tone)}
            </span>
          </div>
          <div className="rounded-control bg-cream/70 p-3">
            <p className="font-bold text-ink">{detailScheduleItem.title}</p>
            {detailScheduleItem.note ? (
              <p className="mt-1 text-sm leading-6 text-muted">{detailScheduleItem.note}</p>
            ) : null}
          </div>
          {detailScheduleItem.id ? (
            <div className="flex flex-wrap justify-end gap-2">
              <button
                className="rounded-control border border-cocoa bg-white px-3 py-2 text-sm font-bold text-cocoa"
                type="button"
                onClick={() => startEditingSchedule(detailScheduleItem)}
              >
                수정
              </button>
              <button
                className="rounded-control bg-red px-3 py-2 text-sm font-bold text-white"
                type="button"
                onClick={() => void deleteScheduleItem(detailScheduleItem.id!)}
              >
                삭제
              </button>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  function renderGoalNoticeDetail() {
    if (!detailGoalNotice) {
      return null;
    }

    return (
      <div
        className="mb-4 rounded-control border border-cocoa/20 bg-white p-4 shadow-control"
        role="region"
        aria-label="목표·공지 상세창"
      >
        <div className="mb-3 flex flex-wrap items-start justify-end gap-3">
          <button
            className="rounded-control border border-latte bg-white px-3 py-1.5 text-xs font-bold text-cocoa"
            type="button"
            onClick={() => setDetailGoalNoticeKey(null)}
          >
            닫기
          </button>
        </div>
        <div className="rounded-control bg-cream/70 p-3">
          <p className="text-sm font-bold text-cocoa">{detailGoalNotice.title}</p>
          <p className="mt-2 text-2xl font-bold tracking-[-0.03em] text-ink">
            {detailGoalNotice.value}
          </p>
          {detailGoalNotice.note ? (
            <p className="mt-2 text-sm leading-6 text-muted">{detailGoalNotice.note}</p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-4">
      <section className="panel min-w-0">
        <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="홈 화면 선택">
          {(
            [
              ["goal", "목표·공지"],
              ["schedule", "스케줄 달력"]
            ] as Array<[HomeTab, string]>
          ).map(([tab, label]) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeHomeTab === tab}
              className={[
                "rounded-control border px-5 py-2 text-sm font-bold transition",
                activeHomeTab === tab
                  ? "border-cocoa bg-cocoa text-white shadow-control"
                  : "border-latte bg-white text-cocoa hover:border-bread"
              ].join(" ")}
              onClick={() => setActiveHomeTab(tab)}
            >
              {label}
            </button>
          ))}
        </div>
        {activeHomeTab === "goal" ? (
          <section className="panel min-w-0">
            <div className="panel-heading">
              <div>
                <p className="text-sm text-muted">직원 공통 확인사항</p>
                <h2 className="section-title">올해 목표·매출 공지</h2>
              </div>
              <Target className="h-5 w-5 text-green" aria-hidden="true" />
            </div>
            {renderGoalNoticeDetail()}
            <div className="grid gap-3 lg:grid-cols-2">
              {allGoalNotices.map((notice) => (
                <button
                  key={goalNoticeKey(notice)}
                  className="rounded-control border border-latte bg-cream/70 p-4 text-left transition hover:border-bread hover:bg-white"
                  type="button"
                  aria-label={`${notice.title} 상세 보기`}
                  onClick={() => setDetailGoalNoticeKey(goalNoticeKey(notice))}
                >
                  <span className="flex items-center gap-2 text-sm font-bold text-cocoa">
                    <TrendingUp className="h-4 w-4" aria-hidden="true" />
                    {notice.title}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ) : null}
        {activeHomeTab === "schedule" ? (
          <section className="panel min-w-0">
            <div className="panel-heading">
              <div>
                <p className="text-sm text-muted">년도별·월별 공통 행사</p>
                <h2 className="section-title">연간 스케줄 달력</h2>
                <p className="mt-1 text-sm text-muted">{currentYear}년 연간 스케줄</p>
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
                    placeholder="일정 제목"
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
            </div>
            {renderScheduleDetail()}
            <div
              className={
                calendarViewMode === "year"
                  ? "grid gap-3 md:grid-cols-2 xl:grid-cols-3"
                  : "grid gap-3"
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
                            const dayItems = day
                              ? month.items.filter((item) => item.day === day)
                              : [];
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
        ) : null}
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
