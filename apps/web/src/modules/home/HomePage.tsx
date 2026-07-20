import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { apiGet } from "../../shared/api/client.js";
import type { ListEnvelope } from "../../shared/api/types.js";
import { todayInStoreTime } from "../../shared/time/storeTime.js";
import { PageHeader } from "../../shared/ui/PageHeader.js";

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
  targetYear: number | null;
  monthlyTargets: MonthlyTargets | null;
  targetTotal: number | null;
};

type MonthKey = "01" | "02" | "03" | "04" | "05" | "06" | "07" | "08" | "09" | "10" | "11" | "12";
type MonthlyTargets = Record<MonthKey, number>;

type ReservationDto = {
  id: string;
  status: "PENDING" | "READY" | "COMPLETED" | "NO_SHOW" | "CANCELED";
};

type ResponseDto = {
  id: string;
};

type DailyOperationRecordDto = {
  date: string;
  draft: {
    posSalesAmount?: string | number | null;
  };
  channelRows: Array<{
    amount?: string | number | null;
  }>;
};

type ScheduleTone = "launch" | "close" | "notice" | "holiday";

type AnnualScheduleItem = {
  id?: string;
  month: number;
  day: number;
  title: string;
  note: string;
  tone: ScheduleTone;
};

type AnnualGoalNotice = {
  id?: string;
  category: AnnualGoalNoticeCategory;
  title: string;
  value: string;
  note: string;
  targetYear: number | null;
  monthlyTargets: MonthlyTargets | null;
  targetTotal: number | null;
};

const goalNoticeCategoryLabels: Record<AnnualGoalNoticeCategory, string> = {
  sales: "매출 목표",
  operation: "운영 목표",
  staff: "직원 공지"
};

function hasSavedDailyOperation(date: string): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.localStorage.getItem(`pnp:daily-operation-draft:${date}`) !== null;
}

function toAnnualGoalNotice(item: AnnualGoalNoticeDto): AnnualGoalNotice {
  return {
    id: item.id,
    category: item.category,
    title: item.title,
    value: item.value,
    note: item.note,
    targetYear: item.targetYear,
    monthlyTargets: item.monthlyTargets,
    targetTotal: item.targetTotal
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

function scheduleItemKey(item: AnnualScheduleItem): string {
  return item.id ?? `static-${item.month}-${item.day}-${item.title}`;
}

function formatCurrency(value: number): string {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

function numeric(value: string | number | null | undefined): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (!value) {
    return 0;
  }
  return Number(value.toString().replace(/[^0-9.-]/g, "")) || 0;
}

function dailyOperationSales(record: DailyOperationRecordDto): number {
  return numeric(record.draft.posSalesAmount) + record.channelRows.reduce((total, row) => total + numeric(row.amount), 0);
}

function monthRangeFor(date: string): { from: string; to: string } {
  const [yearText, monthText] = date.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const lastDay = new Date(year, month, 0).getDate();
  return {
    from: `${yearText}-${monthText}-01`,
    to: `${yearText}-${monthText}-${String(lastDay).padStart(2, "0")}`
  };
}

function percentLabel(value: number, target: number | null): string {
  if (!target || target <= 0) {
    return "0%";
  }
  return `${Math.round((value / target) * 100)}%`;
}

function currentSalesGoal(notices: AnnualGoalNotice[], date: string): AnnualGoalNotice | null {
  const year = Number(date.slice(0, 4));
  return notices.find((notice) => notice.category === "sales" && notice.targetYear === year) ?? null;
}

function currentMonthTarget(notice: AnnualGoalNotice | null, date: string): number | null {
  const month = date.slice(5, 7) as MonthKey;
  return notice?.monthlyTargets?.[month] ?? null;
}

function scheduleDateValue(item: AnnualScheduleItem, year: string): string {
  return `${year}-${String(item.month).padStart(2, "0")}-${String(item.day).padStart(2, "0")}`;
}

function scheduleBadgeLabel(tone: AnnualScheduleItem["tone"]): string {
  if (tone === "launch") {
    return "출시";
  }
  if (tone === "close") {
    return "마감";
  }
  if (tone === "holiday") {
    return "휴무";
  }
  return "공지";
}

export function HomePage() {
  const [date] = useState(todayInStoreTime());
  const [storedScheduleItems, setStoredScheduleItems] = useState<AnnualScheduleItem[]>([]);
  const [storedGoalNotices, setStoredGoalNotices] = useState<AnnualGoalNotice[]>([]);
  const [detailGoalNoticeKey, setDetailGoalNoticeKey] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationDto[]>([]);
  const [todayReservationCount, setTodayReservationCount] = useState(0);
  const [pendingReservationCount, setPendingReservationCount] = useState(0);
  const [todayResponseCount, setTodayResponseCount] = useState(0);
  const [currentMonthSales, setCurrentMonthSales] = useState(0);
  const [dailyOperationSaved, setDailyOperationSaved] = useState(() => hasSavedDailyOperation(date));
  const [error, setError] = useState<string | null>(null);

  const currentYear = date.slice(0, 4);
  const allScheduleItems = useMemo(
    () =>
      [...storedScheduleItems].sort(
        (left, right) => left.month - right.month || left.day - right.day
      ),
    [storedScheduleItems]
  );
  const allGoalNotices = storedGoalNotices;
  const salesGoalNotice = currentSalesGoal(allGoalNotices, date);
  const monthlySalesTarget = currentMonthTarget(salesGoalNotice, date);
  const monthlySalesAchievementPercent = monthlySalesTarget && monthlySalesTarget > 0
    ? Math.min(Math.round((currentMonthSales / monthlySalesTarget) * 100), 100)
    : 0;
  const remainingMonthlySalesTarget = Math.max((monthlySalesTarget ?? 0) - currentMonthSales, 0);
  const operationNotice = allGoalNotices.find((notice) => notice.category === "operation") ?? null;
  const staffNotice = allGoalNotices.find((notice) => notice.category === "staff") ?? null;
  const upcomingScheduleItems = useMemo(
    () =>
      allScheduleItems
        .filter((item) => scheduleDateValue(item, currentYear) >= date)
        .sort((left, right) =>
          scheduleDateValue(left, currentYear).localeCompare(scheduleDateValue(right, currentYear))
        ),
    [allScheduleItems, currentYear, date]
  );
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

  const loadScheduleNotifications = useCallback(async () => {
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
    }
  }, []);

  const loadTodayOverview = useCallback(async () => {
    setDailyOperationSaved(hasSavedDailyOperation(date));
    try {
      const monthRange = monthRangeFor(date);
      const [reservationEnvelope, responseEnvelope, todayDailyEnvelope, monthDailyEnvelope] = await Promise.all([
        apiGet<ListEnvelope<ReservationDto>>(`/reservation?from=${date}&to=${date}`),
        apiGet<ListEnvelope<ResponseDto>>(`/response?from=${date}&to=${date}`),
        apiGet<ListEnvelope<DailyOperationRecordDto>>(`/daily-operation?from=${date}&to=${date}`),
        apiGet<ListEnvelope<DailyOperationRecordDto>>(
          `/daily-operation?from=${monthRange.from}&to=${monthRange.to}`
        )
      ]);

      if (!reservationEnvelope.error) {
        const reservations = reservationEnvelope.data.items;
        setTodayReservationCount(reservations.length);
        setPendingReservationCount(
          reservations.filter((reservation) => reservation.status !== "COMPLETED").length
        );
      }
      if (!responseEnvelope.error) {
        setTodayResponseCount(responseEnvelope.data.items.length);
      }
      if (!todayDailyEnvelope.error) {
        setDailyOperationSaved(todayDailyEnvelope.data.items.length > 0 || hasSavedDailyOperation(date));
      }
      if (!monthDailyEnvelope.error) {
        setCurrentMonthSales(
          monthDailyEnvelope.data.items.reduce((total, record) => total + dailyOperationSales(record), 0)
        );
      }
    } catch {
      // 홈의 오늘 할 일은 보조 정보이므로 일부 API가 실패해도 화면 전체를 막지 않습니다.
    }
  }, [date]);

  useEffect(() => {
    void loadScheduleNotifications();
    void loadAnnualSchedule();
    void loadAnnualGoalNotices();
    void loadTodayOverview();
  }, [loadAnnualGoalNotices, loadAnnualSchedule, loadScheduleNotifications, loadTodayOverview]);

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
          <p className="text-xs font-bold text-cocoa">
            {goalNoticeCategoryLabels[detailGoalNotice.category]}
          </p>
          <p className="mt-1 text-lg font-bold text-ink">{detailGoalNotice.title}</p>
          <dl className="mt-3 grid gap-2 text-sm leading-6">
            <div>
              <dt className="font-bold text-cocoa">공지 내용</dt>
              <dd className="text-ink">{detailGoalNotice.value || "-"}</dd>
            </div>
          </dl>
          {detailGoalNotice.note ? (
            <div className="mt-3 rounded-control border border-latte bg-white px-3 py-2">
              <p className="text-xs font-bold text-cocoa">공지 메모</p>
              <p className="mt-1 text-sm leading-6 text-muted">{detailGoalNotice.note}</p>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  const completedReservationCount = todayReservationCount - pendingReservationCount;

  return (
    <div className="mx-auto grid max-w-none gap-4">
      <PageHeader title="홈" description="오늘의 운영 현황과 이번 달 목표를 빠르게 확인합니다." eyebrow="Paul & Paulina" />
      {error ? (
        <div className="rounded-control border border-red/20 bg-red/10 px-3 py-2 text-sm font-semibold text-red">
          {error}
        </div>
      ) : null}
      <section className="min-w-0">
        <div className="grid gap-3 md:grid-cols-3">
          <Link
            to="/daily-log/today"
            className="app-card min-h-[92px] px-[18px] py-4 transition hover:border-bread focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bread/30 motion-reduce:transition-none"
          >
            <span className="block text-[11.5px] font-medium text-muted">일일 운영 작성</span>
            <span className="mt-3 inline-flex rounded-full bg-[#F7E6C8] px-3 py-1 text-[12px] font-bold text-[#B86A23]">
              {dailyOperationSaved ? "작성 완료" : "작성 전"}
            </span>
          </Link>

          <Link
            to="/reservation?view=list"
            className="app-card min-h-[92px] px-[18px] py-4 transition hover:border-bread focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bread/30 motion-reduce:transition-none"
          >
            <span className="block text-[11.5px] font-medium text-muted">오늘 예약 현황</span>
            <span className="mt-2 flex items-end gap-5">
              <span className="grid gap-0.5">
                <span className="text-[19px] font-extrabold leading-none text-ink">{todayReservationCount}</span>
                <span className="text-[10.5px] font-medium text-muted">전체</span>
              </span>
              <span className="grid gap-0.5">
                <span className="text-[19px] font-extrabold leading-none text-[#C7851E]">{pendingReservationCount}</span>
                <span className="text-[10.5px] font-medium text-muted">대기</span>
              </span>
              <span className="grid gap-0.5">
                <span className="text-[19px] font-extrabold leading-none text-green">{completedReservationCount}</span>
                <span className="text-[10.5px] font-medium text-muted">픽업완료</span>
              </span>
            </span>
          </Link>

          <Link
            to="/response"
            className="app-card min-h-[92px] px-[18px] py-4 transition hover:border-bread focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bread/30 motion-reduce:transition-none"
          >
            <span className="block text-[11.5px] font-medium text-muted">손님 반응 기록</span>
            <span className="mt-2 block text-[21px] font-extrabold leading-tight text-ink">{todayResponseCount}건</span>
          </Link>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <button
          className="app-card px-5 py-[18px] text-left transition hover:border-bread focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bread/30 motion-reduce:transition-none"
          type="button"
          onClick={() => salesGoalNotice ? setDetailGoalNoticeKey(goalNoticeKey(salesGoalNotice)) : undefined}
        >
          <p className="text-[11.5px] text-muted">매출 목표</p>
          <p className="mt-2 text-base font-bold text-ink">
            {monthlySalesTarget !== null ? `${Number(date.slice(5, 7))}월 ${formatCurrency(monthlySalesTarget)}` : "올해 매출 목표 미등록"}
          </p>
          {salesGoalNotice?.targetTotal ? (
            <p className="mt-1 text-xs font-semibold text-cocoa">연간 총합 {formatCurrency(salesGoalNotice.targetTotal)}</p>
          ) : null}
          <div className="mt-3" aria-label={`이번 달 매출 달성률 ${percentLabel(currentMonthSales, monthlySalesTarget)}`}>
            <div className="mb-1.5 flex items-center justify-between text-[10.5px] font-bold text-muted">
              <span>달성률</span>
              <span className="text-bread">{percentLabel(currentMonthSales, monthlySalesTarget)}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-cream ring-1 ring-latte">
              <div
                className="h-full rounded-full bg-bread transition-[width] motion-reduce:transition-none"
                style={{ width: `${monthlySalesAchievementPercent}%` }}
              />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 rounded-control bg-cream/55 px-3 py-2 text-center">
            <div>
              <p className="text-[10.5px] font-bold text-muted">이번 달 달성률</p>
              <p className="mt-0.5 text-sm font-extrabold text-bread">{percentLabel(currentMonthSales, monthlySalesTarget)}</p>
            </div>
            <div>
              <p className="text-[10.5px] font-bold text-muted">현재 누적</p>
              <p className="mt-0.5 text-sm font-extrabold text-ink">{formatCurrency(currentMonthSales)}</p>
            </div>
            <div>
              <p className="text-[10.5px] font-bold text-muted">남은 목표</p>
              <p className="mt-0.5 text-sm font-extrabold text-cocoa">{formatCurrency(remainingMonthlySalesTarget)}</p>
            </div>
          </div>
        </button>
        <button
          className="app-card px-5 py-[18px] text-left transition hover:border-bread focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bread/30 motion-reduce:transition-none"
          type="button"
          onClick={() => operationNotice ? setDetailGoalNoticeKey(goalNoticeKey(operationNotice)) : undefined}
        >
          <p className="text-[11.5px] text-muted">운영 목표</p>
          <p className="mt-2 text-base font-bold text-ink">{operationNotice?.title ?? "운영 목표 미등록"}</p>
          <p className="mt-1 line-clamp-2 text-[13px] leading-6 text-cocoa">{operationNotice?.value ?? "관리 탭에서 운영 목표를 입력해 주세요."}</p>
        </button>
        <button
          className="app-card px-5 py-[18px] text-left transition hover:border-bread focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bread/30 motion-reduce:transition-none"
          type="button"
          onClick={() => staffNotice ? setDetailGoalNoticeKey(goalNoticeKey(staffNotice)) : undefined}
        >
          <p className="text-[11.5px] text-muted">직원 공지</p>
          <p className="mt-2 text-base font-bold text-ink">{staffNotice?.title ?? "직원 공지 미등록"}</p>
          <p className="mt-1 line-clamp-2 text-[13px] leading-6 text-cocoa">{staffNotice?.value ?? "관리 탭에서 직원 공지를 입력해 주세요."}</p>
        </button>
      </section>
      {renderGoalNoticeDetail()}

      <section className="grid gap-3 lg:grid-cols-2">
        <div className="app-card px-5 py-4">
          <p className="mb-3 text-[11.5px] font-semibold uppercase tracking-[0.03em] text-muted">
            연간 스케줄
          </p>
          <div className="divide-y divide-[#F1EAE0]">
            {upcomingScheduleItems.slice(0, 4).map((item) => (
              <div
                key={scheduleItemKey(item)}
                className="grid grid-cols-[3.5rem_2.8rem_1fr] items-center gap-2 py-2.5 text-[12.5px]"
              >
                <span className="text-[11px] font-bold text-muted">
                  {String(item.month).padStart(2, "0")}.{String(item.day).padStart(2, "0")}
                </span>
                <span className="rounded-full bg-[#F4E3D8] px-2 py-0.5 text-center text-[10.5px] text-cocoa">
                  {scheduleBadgeLabel(item.tone)}
                </span>
                <span className="truncate text-ink">{item.title} 일정</span>
              </div>
            ))}
            {upcomingScheduleItems.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted">다가오는 스케줄 없음</div>
            ) : null}
          </div>
        </div>

        <div className="app-card px-5 py-4">
          <p className="mb-3 text-[11.5px] font-semibold uppercase tracking-[0.03em] text-muted">
            알림 ({notifications.length}건)
          </p>
          <div className="divide-y divide-[#F1EAE0]">
            {notifications.slice(0, 3).map((notification) => (
              <Link
                key={notification.id}
                to={notification.link ?? "/notification"}
                className="flex items-start gap-2 py-2.5 text-xs leading-5 text-cocoa"
              >
                <span
                  className={[
                    "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                    notification.severity === "CRITICAL"
                      ? "bg-red"
                      : notification.severity === "WARN"
                        ? "bg-amber"
                        : "bg-bread"
                  ].join(" ")}
                />
                <span className="sr-only">
                  {notification.severity === "CRITICAL"
                    ? "긴급 알림: "
                    : notification.severity === "WARN"
                      ? "주의 알림: "
                      : "안내 알림: "}
                </span>
                <span>{notification.title}</span>
              </Link>
            ))}
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted">알림 없음</div>
            ) : null}
          </div>
        </div>
      </section>

    </div>
  );
}
