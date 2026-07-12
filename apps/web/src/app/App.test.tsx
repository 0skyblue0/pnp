import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "./App.js";
import { AppLayout } from "./layouts/AppLayout.js";
import { AppProviders } from "./providers/AppProviders.js";
import { ManagementPage } from "../modules/admin/ManagementPage.js";
import { DailyLogPage, type DailyOperationSavedRecord } from "../modules/daily-log/DailyLogPage.js";
import { providedDailyOperationRecords } from "../modules/daily-log/providedDailyOperationRecords.js";
import { ResponseEntryPage } from "../modules/response/ResponseEntryPage.js";
import { ResponseInquiryPage } from "../modules/response/ResponseInquiryPage.js";
import { todayInStoreTime } from "../shared/time/storeTime.js";
import { ConfirmProvider } from "../shared/ui/ConfirmDialog.js";
import { ToastProvider } from "../shared/ui/Toast.js";

const ACTIVE_NAV_CLASS = "from-cocoa";
const monthlyTargetsFixture = {
  "01": 0,
  "02": 0,
  "03": 0,
  "04": 0,
  "05": 0,
  "06": 0,
  "07": 48_000_000,
  "08": 0,
  "09": 0,
  "10": 0,
  "11": 0,
  "12": 0
};

describe("App", () => {
  let scrollIntoViewMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    window.localStorage.clear();
    scrollIntoViewMock = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              data: { items: [], total: 0, page: 1, size: 0 },
              error: null
            }),
            {
              headers: { "Content-Type": "application/json" }
            }
          )
      )
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows the main bakery work tabs", () => {
    render(
      <MemoryRouter initialEntries={["/home"]}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/home" element={<div />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    const navigation = screen.getByRole("navigation");
    expect(
      within(navigation)
        .getAllByRole("link")
        .map((link) => link.textContent)
    ).toEqual(["홈", "일일 운영", "손님 반응", "예약", "선결제 장부", "관리"]);
    expect(screen.getByRole("link", { name: "Paul & Paulina 홈" })).toHaveAttribute(
      "href",
      "/home"
    );
  });

  it("lets staff manage home goal and sales notices from the management tab", async () => {
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = input instanceof Request ? input.url : String(input);

      if (url.endsWith("/auth/csrf")) {
        return new Response(JSON.stringify({ data: { csrfToken: "test-token" }, error: null }), {
          headers: { "Content-Type": "application/json" }
        });
      }
      if (
        url.includes("/product") ||
        url.includes("/staff") ||
        url.includes("/response-criteria")
      ) {
        return new Response(
          JSON.stringify({ data: { items: [], total: 0, page: 1, size: 0 }, error: null }),
          { headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.endsWith("/annual-schedule") && (!init?.method || init.method === "GET")) {
        return new Response(
          JSON.stringify({
            data: {
              items: [
                {
                  id: "101",
                  date: "2026-06-30",
                  title: "여름 신메뉴 출시",
                  note: "진열 준비",
                  tone: "launch"
                }
              ]
            },
            error: null
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.endsWith("/annual-schedule") && init?.method === "POST") {
        return new Response(
          JSON.stringify({
            data: {
              id: "202",
              date: "2026-07-10",
              title: "직원 교육",
              note: "오전 공유",
              tone: "notice"
            },
            error: null
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.endsWith("/annual-schedule/101") && init?.method === "PATCH") {
        return new Response(
          JSON.stringify({
            data: {
              id: "101",
              date: "2026-06-30",
              title: "수정된 연간 일정",
              note: "수정 메모",
              tone: "close"
            },
            error: null
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.endsWith("/annual-goal-notice") && (!init?.method || init.method === "GET")) {
        return new Response(
          JSON.stringify({
            data: {
              items: [
                {
                  id: "301",
                  category: "sales",
                  title: "올해 매출 목표",
                  value: "전년 대비 +8%",
                  note: "월별 매출을 함께 확인",
                  targetYear: 2026,
                  monthlyTargets: monthlyTargetsFixture,
                  targetTotal: 48_000_000
                }
              ],
              total: 1,
              page: 1,
              size: 1
            },
            error: null
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.endsWith("/annual-goal-notice") && init?.method === "POST") {
        return new Response(
          JSON.stringify({
            data: {
              id: "302",
              category: "staff",
              title: "직원 공지",
              value: "주말 응대 집중",
              note: "신입 직원과 함께 확인"
            },
            error: null
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.endsWith("/annual-goal-notice/301") && init?.method === "PATCH") {
        return new Response(
          JSON.stringify({
            data: {
              id: "301",
              category: "operation",
              title: "운영 목표",
              value: "일요일 매출 상승",
              note: "시식 안내 강화"
            },
            error: null
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.endsWith("/annual-goal-notice/301") && init?.method === "DELETE") {
        return new Response(JSON.stringify({ data: { deleted: true }, error: null }), {
          headers: { "Content-Type": "application/json" }
        });
      }
      return new Response(JSON.stringify({ data: null, error: { message: url } }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    });

    render(
      <ConfirmProvider>
        <ManagementPage />
      </ConfirmProvider>
    );

    expect(
      await screen.findByRole("heading", { name: "홈 목표·매출 공지 관리" })
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "관리" })).toBeInTheDocument();
    expect(screen.getByText("전체 제품")).toBeInTheDocument();
    expect(screen.getByText("활성 제품")).toBeInTheDocument();
    expect(screen.getByText("전체 직원")).toBeInTheDocument();
    expect(screen.getByText("활성 직원")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "제품 관리" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "직원 관리" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "반응 기준 관리" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "홈 공지 관리" })).toBeInTheDocument();
    expect(screen.getAllByText("제품명").length).toBeGreaterThan(0);
    expect(screen.getAllByText("카테고리").length).toBeGreaterThan(0);
    expect(screen.getAllByText("시즌").length).toBeGreaterThan(0);
    expect(screen.getAllByText("기간").length).toBeGreaterThan(0);
    expect(screen.getAllByText("상태").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "반응 기준 관리" }));
    expect(
      screen.getByText(/대분류\(제품·서비스·응대·구매·운영·손님경험·기타\)/)
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "홈 공지 관리" }));
    expect(screen.getByText(/홈 화면에 노출되는 매출 목표 공지/)).toBeInTheDocument();
    expect(screen.getByText("직원 공지 등록 및 수정")).toBeInTheDocument();
    expect(screen.getByText("2026년 매출 목표")).toBeInTheDocument();
    expect(screen.getByText("총합 48,000,000원")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "홈 공지 추가" }));
    fireEvent.change(screen.getByLabelText("공지 종류"), { target: { value: "staff" } });
    fireEvent.change(screen.getByLabelText("공지 제목"), { target: { value: "직원 공지" } });
    fireEvent.change(screen.getByLabelText("공지 내용"), { target: { value: "주말 응대 집중" } });
    fireEvent.change(screen.getByLabelText("공지 메모"), {
      target: { value: "신입 직원과 함께 확인" }
    });
    fireEvent.click(screen.getByRole("button", { name: "공지 저장" }));

    expect(await screen.findByText("홈 공지 추가: 직원 공지")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "올해 매출 목표 수정" }));
    fireEvent.change(screen.getByLabelText("공지 종류"), { target: { value: "operation" } });
    fireEvent.change(screen.getByLabelText("공지 제목"), { target: { value: "운영 목표" } });
    fireEvent.change(screen.getByLabelText("공지 내용"), { target: { value: "일요일 매출 상승" } });
    fireEvent.change(screen.getByLabelText("공지 메모"), { target: { value: "시식 안내 강화" } });
    fireEvent.click(screen.getByRole("button", { name: "공지 저장" }));

    expect(await screen.findByText("홈 공지 수정 완료")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "올해 매출 목표 삭제" }));
    const goalNoticeConfirmDialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(goalNoticeConfirmDialog).getByRole("button", { name: "삭제" }));
    expect(await screen.findByText("홈 공지 삭제 완료")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "연간 스케줄 관리" }));
    expect(screen.getByText("연간 스케줄 등록 및 수정")).toBeInTheDocument();
    expect(screen.getByText("여름 신메뉴 출시")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "스케줄 추가" }));
    fireEvent.change(screen.getByLabelText("스케줄 날짜"), { target: { value: "2026-07-10" } });
    fireEvent.change(screen.getByLabelText("스케줄 구분"), { target: { value: "notice" } });
    fireEvent.change(screen.getByLabelText("스케줄 제목"), { target: { value: "직원 교육" } });
    fireEvent.change(screen.getByLabelText("스케줄 메모"), { target: { value: "오전 공유" } });
    fireEvent.click(screen.getByRole("button", { name: "스케줄 저장" }));
    expect(await screen.findByText("스케줄 추가: 직원 교육")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "여름 신메뉴 출시 수정" }));
    fireEvent.change(screen.getByLabelText("스케줄 제목"), {
      target: { value: "수정된 연간 일정" }
    });
    fireEvent.change(screen.getByLabelText("스케줄 메모"), { target: { value: "수정 메모" } });
    fireEvent.change(screen.getByLabelText("스케줄 구분"), { target: { value: "close" } });
    fireEvent.click(screen.getByRole("button", { name: "스케줄 저장" }));
    expect(await screen.findByText("스케줄 수정 완료")).toBeInTheDocument();
  });

  it("keeps the customer response tab active on response entry route", () => {
    render(
      <MemoryRouter initialEntries={["/response/new"]}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/response/new" element={<div />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    const navigation = screen.getByRole("navigation");
    const responseLink = within(navigation).getByRole("link", { name: "손님 반응" });

    expect(responseLink).toHaveClass(ACTIVE_NAV_CLASS);
  });

  it("shows the daily operation tab as active on the daily log route", () => {
    render(
      <MemoryRouter initialEntries={["/daily-log/today"]}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/daily-log/today" element={<div />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    const navigation = screen.getByRole("navigation");
    const operationLink = within(navigation).getByRole("link", { name: "일일 운영" });

    expect(operationLink).toHaveClass(ACTIVE_NAV_CLASS);
  });

  it("keeps reservation quick dates while allowing calendar date picking and hourly pickup tabs", async () => {
    render(
      <AppProviders>
        <App />
      </AppProviders>
    );

    fireEvent.click(screen.getByRole("link", { name: "예약" }));
    fireEvent.click(await screen.findByRole("button", { name: "+ 새 예약 등록" }));

    const modal = await screen.findByRole("region", { name: "새 예약 등록" });
    expect(within(modal).getByText("손님 이름 *")).toBeInTheDocument();
    expect(within(modal).getByText("연락처 *")).toBeInTheDocument();
    expect(within(modal).getByText("픽업 날짜")).toBeInTheDocument();
    expect(within(modal).getByText("픽업 시간")).toBeInTheDocument();
    expect(within(modal).getByText("제품 및 수량 *")).toBeInTheDocument();
    expect(within(modal).getByRole("combobox", { name: "제품명 1" })).toBeInTheDocument();
    expect(within(modal).getByRole("option", { name: "제품 선택" })).toBeInTheDocument();
    expect(within(modal).queryByRole("option", { name: "예: 깜빠뉴" })).not.toBeInTheDocument();
    expect(within(modal).queryByRole("textbox", { name: "제품명 1" })).not.toBeInTheDocument();
    expect(within(modal).queryByText("컷팅 옵션")).not.toBeInTheDocument();
    expect(within(modal).queryByRole("combobox", { name: "컷팅 옵션 1" })).not.toBeInTheDocument();
    expect(
      within(modal).queryByRole("button", { name: "반컷팅+슬라이스" })
    ).not.toBeInTheDocument();
    const firstProductSelect = within(modal).getByRole("combobox", { name: "제품명 1" });
    expect(firstProductSelect).not.toHaveClass("bg-cream");
    expect(firstProductSelect).not.toHaveClass("text-cocoa");
    expect(firstProductSelect).not.toHaveClass("font-semibold");
    expect(firstProductSelect).toHaveClass("text-ink");
    expect(within(modal).queryByRole("button", { name: "없음" })).not.toBeInTheDocument();
    expect(within(modal).queryByRole("button", { name: "반컷팅" })).not.toBeInTheDocument();

    fireEvent.change(firstProductSelect, { target: { value: "바게트" } });
    expect(within(modal).getByText("컷팅 옵션")).toBeInTheDocument();
    expect(within(modal).getByRole("button", { name: "없음" })).toBeInTheDocument();
    expect(within(modal).getByRole("button", { name: "반컷팅" })).toBeInTheDocument();
    expect(within(modal).queryByRole("button", { name: "슬라이스" })).not.toBeInTheDocument();

    fireEvent.change(firstProductSelect, { target: { value: "화바게트" } });
    expect(within(modal).getByText("컷팅 옵션")).toBeInTheDocument();
    expect(within(modal).getByRole("button", { name: "없음" })).toBeInTheDocument();
    expect(within(modal).getByRole("button", { name: "반컷팅" })).toBeInTheDocument();
    expect(within(modal).queryByRole("button", { name: "슬라이스" })).not.toBeInTheDocument();

    fireEvent.change(firstProductSelect, { target: { value: "화바게트(H)" } });
    expect(within(modal).queryByText("컷팅 옵션")).not.toBeInTheDocument();
    expect(within(modal).queryByRole("button", { name: "반컷팅" })).not.toBeInTheDocument();

    fireEvent.change(firstProductSelect, { target: { value: "식 빵" } });
    expect(within(modal).getByRole("button", { name: "반컷팅" })).toBeInTheDocument();
    expect(within(modal).getByRole("button", { name: "슬라이스" })).toBeInTheDocument();

    fireEvent.change(firstProductSelect, { target: { value: "크로와상" } });
    expect(within(modal).queryByText("컷팅 옵션")).not.toBeInTheDocument();
    expect(within(modal).queryByRole("button", { name: "반컷팅" })).not.toBeInTheDocument();
    expect(within(modal).queryByRole("button", { name: "슬라이스" })).not.toBeInTheDocument();
    expect(within(modal).getByLabelText("예약 메모")).not.toHaveClass("sr-only");
    fireEvent.click(within(modal).getByRole("button", { name: "제품 추가" }));
    expect(within(modal).getByRole("combobox", { name: "제품명 2" })).toBeInTheDocument();
    expect(within(modal).queryByRole("combobox", { name: "컷팅 옵션 2" })).not.toBeInTheDocument();
    expect(within(modal).getByText("결제완료")).toBeInTheDocument();
    expect(within(modal).getByText("비닐봉투")).toBeInTheDocument();
    expect(within(modal).getByRole("button", { name: "취소" })).toBeInTheDocument();
    expect(within(modal).getByRole("button", { name: "등록" })).toBeInTheDocument();
    const todayButton = within(modal).getByRole("button", { name: "오늘" });
    const tomorrowButton = within(modal).getByRole("button", { name: "내일" });
    const dayAfterTomorrowButton = within(modal).getByRole("button", { name: "모레" });
    expect(todayButton).toBeInTheDocument();
    expect(tomorrowButton).toBeInTheDocument();
    expect(dayAfterTomorrowButton).toBeInTheDocument();
    expect(todayButton).not.toHaveClass("bg-bread");
    expect(tomorrowButton).not.toHaveClass("bg-bread");
    expect(dayAfterTomorrowButton).not.toHaveClass("bg-bread");
    fireEvent.click(tomorrowButton);
    expect(tomorrowButton).toHaveClass("bg-bread");
    expect(todayButton).not.toHaveClass("bg-bread");
    expect(dayAfterTomorrowButton).not.toHaveClass("bg-bread");
    expect(within(modal).getByLabelText("픽업 날짜")).toHaveAttribute("type", "date");
    expect(within(modal).getByLabelText("픽업 날짜")).not.toHaveClass("sr-only");

    const quickTimeGroup = within(modal).getByLabelText("픽업 시간 빠른 선택");
    expect(quickTimeGroup).toHaveClass("grid-cols-10");
    expect(quickTimeGroup).not.toHaveClass("flex-wrap");
    expect(within(quickTimeGroup).getByRole("button", { name: "10시" })).toBeInTheDocument();
    expect(within(quickTimeGroup).getByRole("button", { name: "11시" })).toBeInTheDocument();
    expect(within(quickTimeGroup).getByRole("button", { name: "1시" })).toBeInTheDocument();
    expect(within(quickTimeGroup).getByRole("button", { name: "7시" })).toBeInTheDocument();
    expect(within(modal).queryByRole("button", { name: "11:00" })).not.toBeInTheDocument();
    expect(within(modal).queryByRole("button", { name: "13:00" })).not.toBeInTheDocument();
    expect(within(modal).queryByRole("button", { name: "19:00" })).not.toBeInTheDocument();
    expect(within(modal).queryByRole("button", { name: "09:00" })).not.toBeInTheDocument();
    expect(within(modal).queryByRole("button", { name: "12:30" })).not.toBeInTheDocument();
    expect(within(modal).queryByRole("button", { name: "19:30" })).not.toBeInTheDocument();

    const hourSelect = within(modal).getByLabelText("픽업 시");
    const minuteSelect = within(modal).getByLabelText("픽업 분");
    expect(hourSelect.closest("div")).not.toHaveClass("sr-only");
    expect(minuteSelect.closest("div")).not.toHaveClass("sr-only");
    expect(within(hourSelect).queryByRole("option", { name: "08시" })).not.toBeInTheDocument();
    expect(within(hourSelect).getByRole("option", { name: "10시" })).toBeInTheDocument();
    expect(within(hourSelect).getByRole("option", { name: "19시" })).toBeInTheDocument();
    expect(within(hourSelect).queryByRole("option", { name: "20시" })).not.toBeInTheDocument();
    expect(within(minuteSelect).getByRole("option", { name: "00분" })).toBeInTheDocument();
    expect(within(minuteSelect).getByRole("option", { name: "10분" })).toBeInTheDocument();
    expect(within(minuteSelect).getByRole("option", { name: "50분" })).toBeInTheDocument();
  });

  it("shows readable reservation cards and lets staff delete a saved reservation", async () => {
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      const method = init?.method ?? "GET";

      if (url.endsWith("/auth/csrf")) {
        return new Response(JSON.stringify({ data: { csrfToken: "test-token" }, error: null }), {
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.includes("/product")) {
        return new Response(
          JSON.stringify({ data: { items: [], total: 0, page: 1, size: 0 }, error: null }),
          { headers: { "Content-Type": "application/json" } }
        );
      }

      if (url.includes("/reservation/r-1") && method === "DELETE") {
        return new Response(JSON.stringify({ data: { deleted: true }, error: null }), {
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.includes("/reservation?") && method === "GET") {
        return new Response(
          JSON.stringify({
            data: {
              items: [
                {
                  id: "r-1",
                  customerName: "김예약",
                  contactPhone: "010-1234-5678",
                  pickupAt: "2026-07-12T15:10:00.000Z",
                  status: "PENDING",
                  isPaid: true,
                  isCut: true,
                  isBag: true,
                  purpose: "UNKNOWN",
                  allergyNote: null,
                  memo: "깜빠뉴 반씩 따로 포장",
                  cancelReason: null,
                  items: [
                    { productId: 1, productName: "깜빠뉴", quantity: 2, cuttingOption: "HALF" },
                    { productId: 2, productName: "크로와상", quantity: 3, cuttingOption: "NONE" }
                  ]
                }
              ],
              total: 1,
              page: 1,
              size: 1
            },
            error: null
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ data: { items: [], total: 0, page: 1, size: 0 }, error: null }),
        {
          headers: { "Content-Type": "application/json" }
        }
      );
    });

    render(
      <AppProviders>
        <App />
      </AppProviders>
    );

    fireEvent.click(screen.getByRole("link", { name: "예약" }));

    const reservationCard = await screen.findByRole("article", { name: "김예약 예약" });
    expect(within(reservationCard).getByText("김예약님")).toBeInTheDocument();
    expect(within(reservationCard).getByText("깜빠뉴 2개")).toBeInTheDocument();
    expect(within(reservationCard).getByText("크로와상 3개")).toBeInTheDocument();
    expect(within(reservationCard).getByText("반컷팅")).toBeInTheDocument();
    expect(within(reservationCard).getByText("비닐봉투")).toBeInTheDocument();
    expect(within(reservationCard).getByText("결제완료")).toBeInTheDocument();
    expect(within(reservationCard).getByText("깜빠뉴 반씩 따로 포장")).toBeInTheDocument();

    fireEvent.click(within(reservationCard).getByRole("button", { name: "김예약 예약 삭제" }));
    const confirmDialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(confirmDialog).getByRole("button", { name: "삭제" }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/reservation/r-1"),
        expect.objectContaining({ method: "DELETE" })
      )
    );
    expect(await screen.findByText("예약 삭제 #r-1")).toBeInTheDocument();
  });

  it("renders statistics inside the integrated lookup screen", async () => {
    vi.mocked(fetch).mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            data: {
              total: 16,
              major: [
                { criterionId: 1, name: "제품", depth: 1, parentId: null, count: 12, ratio: 0.75 },
                { criterionId: 2, name: "요청", depth: 1, parentId: null, count: 4, ratio: 0.25 }
              ],
              middle: [
                {
                  criterionId: 3,
                  majorCriterionId: 1,
                  name: "맛",
                  depth: 2,
                  parentId: 1,
                  count: 9,
                  ratio: 0.5625
                },
                {
                  criterionId: 4,
                  majorCriterionId: 1,
                  name: "포장",
                  depth: 2,
                  parentId: 1,
                  count: 3,
                  ratio: 0.1875
                },
                {
                  criterionId: 5,
                  majorCriterionId: 2,
                  name: "예약",
                  depth: 2,
                  parentId: 2,
                  count: 4,
                  ratio: 0.25
                }
              ],
              minor: [
                {
                  criterionId: 6,
                  majorCriterionId: 1,
                  middleCriterionId: 3,
                  name: "바게트",
                  depth: 3,
                  parentId: 3,
                  count: 6,
                  ratio: 0.375
                },
                {
                  criterionId: 7,
                  majorCriterionId: 1,
                  middleCriterionId: 3,
                  name: "식감",
                  depth: 3,
                  parentId: 3,
                  count: 3,
                  ratio: 0.1875
                }
              ],
              daily: [
                { date: "2026-07-10", count: 2 },
                { date: "2026-07-11", count: 5 },
                { date: "2026-07-12", count: 9 }
              ],
              insights: {
                headline: "16건 중 제품 비중이 가장 큽니다.",
                keyNotes: [
                  "불만 12건은 우선 확인이 필요합니다.",
                  "가장 반복된 세부 내용은 제품 > 맛 > 바게트입니다.",
                  "대표님 보고에는 상위 반복 내용 2개만 먼저 보이면 충분합니다."
                ],
                repeatedTopics: [
                  {
                    criterionId: 6,
                    label: "바게트",
                    path: [
                      { id: 1, name: "제품" },
                      { id: 3, name: "맛" },
                      { id: 6, name: "바게트" }
                    ],
                    count: 6,
                    ratio: 0.375,
                    sampleSummaries: ["바게트 맛 불만 반복"]
                  }
                ]
              }
            },
            error: null
          }),
          {
            headers: { "Content-Type": "application/json" }
          }
        )
    );

    render(
      <MemoryRouter initialEntries={["/response?mode=lookup"]}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/response" element={<ResponseInquiryPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    const navigation = screen.getByRole("navigation");
    expect(within(navigation).getByRole("link", { name: "손님 반응" })).toHaveClass(
      ACTIVE_NAV_CLASS
    );
    expect(screen.getByRole("tab", { name: "요약 보기" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "상세 기록" })).toHaveAttribute(
      "aria-selected",
      "false"
    );

    expect((await screen.findAllByText("제품")).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "주요 사항" })).toBeInTheDocument();
    expect(screen.getAllByText("16건 중 제품 비중이 가장 큽니다.").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/제품 > 맛 > 바게트/).length).toBeGreaterThan(0);
    expect(screen.getByText("12건 · 75%")).toBeInTheDocument();
    expect(screen.getAllByText("맛").length).toBeGreaterThan(0);
    expect(screen.getByText("9건 · 75%")).toBeInTheDocument();
    expect(screen.getByText("월별 빠른 조회")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "2026년 7월" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    expect(screen.getByRole("button", { name: "2026년 6월" })).toBeInTheDocument();
    expect(screen.getByText("월별 핵심 보기")).toBeInTheDocument();
    expect(screen.getByText("가장 많은 대분류")).toBeInTheDocument();
    expect(screen.queryByText("선택 기간 일별 추이")).not.toBeInTheDocument();
    expect(screen.queryByText(/날짜별로 등록된 손님 반응 건수/)).not.toBeInTheDocument();
    expect(screen.queryByText("5월 보고")).not.toBeInTheDocument();
    expect(screen.queryByText("추천 기능")).not.toBeInTheDocument();
    const topicLink = screen.getAllByRole("link", { name: "제품 > 맛 > 바게트 기록 보기" })[0];
    expect(topicLink).toHaveAttribute(
      "href",
      "/response?mode=lookup&tab=detail&from=2026-06-13&to=2026-07-12&criterion_id=6"
    );
    expect(screen.getByRole("link", { name: "제품 전체 기록 보기" })).toHaveAttribute(
      "href",
      "/response?mode=lookup&tab=detail&from=2026-06-13&to=2026-07-12&criterion_id=1"
    );
    expect(screen.queryByRole("button", { name: "원형" })).not.toBeInTheDocument();
  });

  it("switches from statistics to detailed response lookup inside the lookup screen", async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("/response-criteria")) {
        return new Response(
          JSON.stringify({
            data: {
              items: [
                { id: 6, parentId: null, depth: 1, name: "바게트", sortOrder: 1, isActive: true }
              ],
              total: 1,
              page: 1,
              size: 1
            },
            error: null
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ data: { items: [], total: 0, page: 1, size: 0 }, error: null }),
        { headers: { "Content-Type": "application/json" } }
      );
    });

    render(
      <MemoryRouter
        initialEntries={[
          "/response?mode=lookup&tab=detail&from=2026-05-01&to=2026-05-31&criterion_id=6"
        ]}
      >
        <Routes>
          <Route path="/response" element={<ResponseInquiryPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole("tab", { name: "상세 기록" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "상세 조회" })).toBeInTheDocument();
    expect(screen.getByLabelText("시작일")).toHaveValue("2026-05-01");
    expect(screen.getByLabelText("종료일")).toHaveValue("2026-05-31");
    expect(await screen.findByLabelText("기준")).toHaveValue("6");
    expect(await screen.findByText("조회된 고객 반응 없음")).toBeInTheDocument();
  });

  it("lets staff edit and delete responses from the detail lookup screen", async () => {
    let responseItem = {
      id: "101",
      date: "2026-05-30",
      criterionId: 6,
      majorCriterionId: 1,
      middleCriterionId: 3,
      minorCriterionId: 6,
      criterionPath: [
        { id: 1, name: "제품" },
        { id: 3, name: "맛" },
        { id: 6, name: "바게트" }
      ],
      shortSummary: "갓 나온 크로와상 시식 반응 좋음",
      fullText: "[일일업무보고서]\n\n갓 나온 크로와상 시식 반응 좋음",
      createdAt: "2026-07-12T00:00:00.000Z"
    };
    vi.stubGlobal(
      "confirm",
      vi.fn(() => true)
    );
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.endsWith("/auth/csrf")) {
        return new Response(JSON.stringify({ data: { csrfToken: "test-token" }, error: null }), {
          headers: { "Content-Type": "application/json" }
        });
      }
      if (url.includes("/response-criteria")) {
        return new Response(
          JSON.stringify({
            data: {
              items: [
                { id: 1, parentId: null, depth: 1, name: "제품", sortOrder: 1, isActive: true },
                { id: 3, parentId: 1, depth: 2, name: "맛", sortOrder: 1, isActive: true },
                { id: 6, parentId: 3, depth: 3, name: "바게트", sortOrder: 1, isActive: true }
              ],
              total: 3,
              page: 1,
              size: 3
            },
            error: null
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes("/response/101") && init?.method === "PATCH") {
        const bodyText = typeof init.body === "string" ? init.body : "{}";
        const body = JSON.parse(bodyText) as { shortSummary: string; fullText: string };
        responseItem = {
          ...responseItem,
          shortSummary: body.shortSummary,
          fullText: body.fullText
        };
        return new Response(JSON.stringify({ data: responseItem, error: null }), {
          headers: { "Content-Type": "application/json" }
        });
      }
      if (url.includes("/response/101") && init?.method === "DELETE") {
        return new Response(JSON.stringify({ data: { deleted: true }, error: null }), {
          headers: { "Content-Type": "application/json" }
        });
      }
      return new Response(
        JSON.stringify({
          data: { items: [responseItem], total: 1, page: 1, size: 1 },
          error: null
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    });

    render(
      <MemoryRouter
        initialEntries={["/response?mode=lookup&tab=detail&from=2026-05-30&to=2026-05-30"]}
      >
        <Routes>
          <Route path="/response" element={<ResponseInquiryPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("갓 나온 크로와상 시식 반응 좋음")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "수정" }));
    fireEvent.change(screen.getByDisplayValue("갓 나온 크로와상 시식 반응 좋음"), {
      target: { value: "크로와상 시식 후 구매로 이어짐" }
    });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => {
      expect(screen.getByText("크로와상 시식 후 구매로 이어짐")).toBeInTheDocument();
    });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/response/101"),
      expect.objectContaining({ method: "PATCH" })
    );

    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    await waitFor(() => {
      expect(screen.queryByText("크로와상 시식 후 구매로 이어짐")).not.toBeInTheDocument();
    });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/response/101"),
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("organizes the daily operation page with fixed products, non-POS sales, and staff check tables", async () => {
    let dailyOperationApiItems = providedDailyOperationRecords.map((record, index) => ({
      id: String(index + 1),
      date: record.draft.date,
      draft: record.draft,
      productRows: record.productRows,
      channelRows: record.channelRows,
      staffSpecialRows: record.staffSpecialRows,
      createdAt: record.savedAt,
      updatedAt: record.savedAt
    }));

    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.endsWith("/auth/csrf")) {
        return new Response(JSON.stringify({ data: { csrfToken: "test-token" }, error: null }), {
          headers: { "Content-Type": "application/json" }
        });
      }
      if (url.includes("/daily-operation") && (!init?.method || init.method === "GET")) {
        return new Response(
          JSON.stringify({
            data: {
              items: dailyOperationApiItems,
              total: dailyOperationApiItems.length,
              page: 1,
              size: dailyOperationApiItems.length
            },
            error: null
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes("/daily-operation/") && init?.method === "PUT") {
        const bodyText = typeof init.body === "string" ? init.body : "{}";
        const body = JSON.parse(bodyText) as Pick<
          DailyOperationSavedRecord,
          "draft" | "productRows" | "channelRows" | "staffSpecialRows"
        >;
        const saved = {
          id: "999",
          date: body.draft.date,
          draft: body.draft,
          productRows: body.productRows,
          channelRows: body.channelRows,
          staffSpecialRows: body.staffSpecialRows,
          createdAt: "2026-07-06T00:00:00.000Z",
          updatedAt: "2026-07-06T00:00:00.000Z"
        };
        dailyOperationApiItems = [
          saved,
          ...dailyOperationApiItems.filter((record) => record.date !== saved.date)
        ];
        return new Response(
          JSON.stringify({
            data: saved,
            error: null
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes("/daily-operation/") && init?.method === "DELETE") {
        const date = decodeURIComponent(url.split("/daily-operation/")[1] ?? "");
        dailyOperationApiItems = dailyOperationApiItems.filter((record) => record.date !== date);
        return new Response(JSON.stringify({ data: { deleted: true }, error: null }), {
          headers: { "Content-Type": "application/json" }
        });
      }
      return new Response(
        JSON.stringify({ data: { items: [], total: 0, page: 1, size: 0 }, error: null }),
        {
          headers: { "Content-Type": "application/json" }
        }
      );
    });

    render(
      <ConfirmProvider>
        <MemoryRouter initialEntries={["/daily-log/today"]}>
          <Routes>
            <Route path="/daily-log/today" element={<DailyLogPage />} />
          </Routes>
        </MemoryRouter>
      </ConfirmProvider>
    );

    expect(await screen.findByRole("heading", { name: "매장 운영일지" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "데이터 조회" }));
    expect(screen.getByLabelText("조회 방식")).toHaveValue("month");
    expect(screen.getByLabelText("조회 월")).toHaveValue("2026-05");
    expect(screen.getAllByText("69,703,800원").length).toBeGreaterThan(0);
    expect(screen.getByText(/전체 31일 \/ 조회 31일/)).toBeInTheDocument();
    const firstDetailButton = screen.getAllByRole("button", { name: "상세" }).at(0);
    if (!firstDetailButton) {
      throw new Error("상세 버튼이 필요합니다.");
    }
    fireEvent.click(firstDetailButton);
    expect(screen.getAllByText(/닭가슴살 재고 확인 필요합니다/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/구름빵 반죽 작업 있습니다/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("tab", { name: "입력" }));
    expect(screen.queryByText(/엑셀 대체/)).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("tablist", { name: "일일 운영 입력 분류" }))
        .getAllByRole("tab")
        .map((tab) => tab.textContent)
    ).toEqual(["기본 정보", "제품", "매출", "메모·점검"]);
    expect(screen.getByRole("heading", { name: "환경 · 근무 정보" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "제품별 생산 · 판매" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "매출 요약" })).toBeInTheDocument();
    expect(screen.getByLabelText("작성자")).toBeInTheDocument();
    expect(screen.getByLabelText("외부온도")).toBeInTheDocument();
    expect(screen.getByLabelText("외부온도").parentElement).toHaveTextContent("℃");
    expect(screen.getByLabelText("외부습도").parentElement).toHaveTextContent("%");
    expect(screen.getByLabelText("외부온도")).toHaveValue("0");
    expect(screen.getByLabelText("내부온도")).toHaveValue("0");
    expect(screen.getByLabelText("외부습도")).toHaveValue("0");
    expect(screen.getByLabelText("내부습도")).toHaveValue("0");
    expect(screen.getByRole("button", { name: "폭염" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "한파" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "일일 운영 저장" }));
    expect(
      screen.getByText("일일 운영 작성 완료 전 빠진 항목을 확인해 주세요.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "기본 정보: 작성자" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("작성자"), { target: { value: "대표" } });
    fireEvent.change(screen.getByLabelText("외부온도"), { target: { value: "22" } });
    fireEvent.change(screen.getByLabelText("내부온도"), { target: { value: "24" } });
    fireEvent.change(screen.getByLabelText("외부습도"), { target: { value: "60" } });
    fireEvent.change(screen.getByLabelText("내부습도"), { target: { value: "55" } });
    fireEvent.change(screen.getByLabelText("날씨"), { target: { value: "맑음" } });

    fireEvent.click(screen.getByRole("tab", { name: "매출" }));
    expect(screen.getByLabelText("POS 매출액")).toBeInTheDocument();
    expect(screen.getByLabelText("POS 매출건수")).toBeInTheDocument();
    expect(screen.getByLabelText("POS 매출액").parentElement).toHaveTextContent("원");
    expect(screen.getByLabelText("POS 매출건수").parentElement).toHaveTextContent("건");
    expect(screen.getByLabelText("POS 매출액")).toHaveValue("0");
    expect(screen.getByLabelText("POS 매출건수")).toHaveValue("0");
    expect(screen.getByLabelText("선물 매출액")).toHaveValue("0");
    expect(screen.getByLabelText("선물 매출건수")).toHaveValue("0");
    expect(screen.getByLabelText("POS 외 매출액")).toHaveTextContent("0원");
    expect(screen.getByRole("heading", { name: "POS 외 매출" })).toBeInTheDocument();
    for (const channel of ["선물", "쿠팡이츠", "배민", "제로페이", "택배", "납품"]) {
      expect(screen.getByText(channel)).toBeInTheDocument();
    }
    fireEvent.change(screen.getByLabelText("POS 매출액"), { target: { value: "20000" } });
    fireEvent.change(screen.getByLabelText("POS 매출건수"), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText("선물 매출액"), { target: { value: "10000" } });
    fireEvent.change(screen.getByLabelText("선물 매출건수"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("배민 매출액"), { target: { value: "5000" } });
    fireEvent.change(screen.getByLabelText("배민 매출건수"), { target: { value: "3" } });
    expect(screen.getByLabelText("POS 매출액")).toHaveValue("20,000");
    expect(screen.getByLabelText("선물 매출액")).toHaveValue("10,000");
    expect(screen.getByLabelText("배민 매출액")).toHaveValue("5,000");
    expect(screen.getByLabelText("POS 외 매출액")).toHaveTextContent("15,000원");
    expect(screen.getByLabelText("POS 외 매출건수")).toHaveTextContent("5건");
    expect(screen.getAllByText("35,000원").length).toBeGreaterThan(0);
    expect(screen.getAllByText("10건").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("tab", { name: "제품" }));
    expect(screen.getByText("바게트")).toBeInTheDocument();
    expect(screen.getByText("치킨샌드위치")).toBeInTheDocument();
    expect(screen.getByText("생산량(개)")).toBeInTheDocument();
    expect(screen.getByText("판매량(개)")).toBeInTheDocument();
    expect(screen.getByText("기타(+)/(-)")).toBeInTheDocument();
    expect(screen.getByLabelText("바게트 기타 입고 +")).toBeInTheDocument();
    expect(screen.getByLabelText("바게트 기타 출고 -")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("바게트 생산량"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("바게트 기타 입고 +"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("바게트 기타 출고 -"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("바게트 손실량"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("바게트 시식량"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("바게트 재고량"), { target: { value: "4" } });
    expect(screen.getAllByText("2").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("호밀쇼콜라오렌지 판매량 직접입력").length).toBeGreaterThan(0);
    expect(screen.getByText("자동 계산")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "메모·점검" }));
    expect(screen.getByText("제품의견/손실")).toBeInTheDocument();
    expect(screen.getByText("시설/장비 특이사항")).toBeInTheDocument();
    expect(screen.getByText("청결/위생 관련업무")).toBeInTheDocument();
    expect(screen.getByText("직원 특이사항")).toBeInTheDocument();
    expect(screen.getByText("시설 점검사항")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("제품의견/손실"), {
      target: { value: "닭가슴살 재고 확인 필요합니다" }
    });
    fireEvent.change(screen.getByLabelText("시설/장비 특이사항"), {
      target: { value: "냉장고 점검 필요" }
    });
    fireEvent.change(screen.getByLabelText("지시 및 전달사항"), {
      target: { value: "오후 진열대 보충" }
    });
    fireEvent.change(screen.getByLabelText("내일 준비사항"), {
      target: { value: "구름빵 반죽 작업 있습니다" }
    });
    fireEvent.change(screen.getByLabelText("청결/위생 관련업무"), {
      target: { value: "오븐 주변 청소 완료" }
    });
    fireEvent.change(screen.getByLabelText("첫 출근자 이름"), { target: { value: "아침직원" } });
    fireEvent.change(screen.getByLabelText("첫 출근자 출근시간 시"), { target: { value: "07" } });
    fireEvent.change(screen.getByLabelText("최종퇴근자 이름"), { target: { value: "마감직원" } });
    fireEvent.change(screen.getByLabelText("최종퇴근자 퇴근시간 시"), { target: { value: "20" } });
    fireEvent.change(screen.getByLabelText("위생 점검자"), { target: { value: "위생담당" } });
    fireEvent.change(screen.getByLabelText("최종 점검자"), { target: { value: "마감담당" } });

    fireEvent.click(screen.getByRole("button", { name: "일일 운영 저장" }));
    expect(await screen.findByText(/서버에 저장되었습니다/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "데이터 조회" }));
    expect(screen.getByLabelText("조회 방식")).toBeInTheDocument();
    expect(screen.getByLabelText("나열 방식")).toHaveValue("desc");
    fireEvent.change(screen.getByLabelText("조회 방식"), { target: { value: "date" } });
    expect(screen.getByText("조회 날짜")).toBeInTheDocument();
    expect(screen.getAllByText(todayInStoreTime()).length).toBeGreaterThan(0);
    expect(screen.getByLabelText("조회 날짜")).toHaveValue(todayInStoreTime());
    expect(screen.getByRole("tab", { name: "데이터 조회" })).toBeInTheDocument();
    expect(
      screen.getAllByText(
        (_content, element) => element?.textContent?.includes("조회 1일") ?? false
      ).length
    ).toBeGreaterThan(0);
    expect(screen.getByText("총매출")).toBeInTheDocument();
    expect(screen.getAllByText("35,000원").length).toBeGreaterThan(0);
    expect(screen.getByText("일 평균 매출")).toBeInTheDocument();
    expect(screen.getAllByText("객단가").length).toBeGreaterThan(0);
    expect(screen.getByText("이전 기간 대비")).toBeInTheDocument();
    const savedRecord = screen.getByRole("article", { name: `${todayInStoreTime()} 일지 요약` });
    const savedRecordTable = within(savedRecord).getByRole("table", {
      name: `${todayInStoreTime()} 일지 한줄 요약`
    });
    const savedRecordRow = within(savedRecordTable).getByRole("row", {
      name: /POS 매출액 20,000원/
    });
    expect(savedRecordRow).toHaveTextContent(`날짜${todayInStoreTime()}`);
    expect(savedRecordRow).toHaveTextContent("작성자대표");
    expect(savedRecordRow).toHaveTextContent("POS 매출액20,000원");
    expect(savedRecordRow).toHaveTextContent("POS 외 매출액15,000원");
    expect(savedRecordRow).toHaveTextContent("총매출액35,000원");
    expect(savedRecordRow).toHaveTextContent("매출건수10건");
    expect(savedRecordRow).toHaveTextContent("객단가3,500원");
    expect(savedRecordRow).toHaveTextContent("제품판매량2개");
    expect(savedRecordRow).toHaveTextContent("메모2건");
    expect(savedRecordRow).toHaveTextContent("상세");
    expect(within(savedRecordRow).queryByText("구름빵 반죽 작업 있습니다")).not.toBeInTheDocument();
    expect(within(savedRecordRow).queryByText("오후 진열대 보충")).not.toBeInTheDocument();
    expect(within(savedRecord).queryByText("제품의견/손실")).not.toBeInTheDocument();
    expect(within(savedRecord).queryByText("오븐 주변 청소 완료")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("조회 방식"), { target: { value: "week" } });
    fireEvent.change(screen.getByLabelText("기준 날짜"), { target: { value: "2026-05-10" } });
    expect(screen.getByText("2026-05-10 ~ 2026-05-16")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("기준 날짜"), { target: { value: todayInStoreTime() } });
    expect(screen.getByText("전주 대비")).toBeInTheDocument();
    expect(screen.getByText("+100%")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "상세" }));
    const expandedRecord = screen.getByRole("article", { name: `${todayInStoreTime()} 일지 요약` });
    const expandedActionCell = within(expandedRecord).getAllByRole("cell").at(10);
    expect(
      within(expandedActionCell!)
        .getAllByRole("button")
        .map((button) => button.textContent)
    ).toEqual(["접기"]);
    expect(
      within(expandedRecord)
        .getAllByRole("button")
        .map((button) => button.textContent)
    ).toEqual(expect.arrayContaining(["접기", "수정", "삭제"]));
    expect(within(expandedRecord).getByText("메모 원문")).toBeInTheDocument();
    expect(within(expandedRecord).getByRole("group", { name: "기본·점검" })).toHaveTextContent(
      "온습도"
    );
    expect(within(expandedRecord).getByRole("group", { name: "제품 합계" })).toHaveTextContent(
      "생산"
    );
    const expandedText = expandedRecord.textContent ?? "";
    expect(expandedText.indexOf("내일 준비")).toBeLessThan(expandedText.indexOf("지시/전달"));
    expect(expandedText.indexOf("지시/전달")).toBeLessThan(expandedText.indexOf("청결/위생"));
    expect(expandedText.indexOf("청결/위생")).toBeLessThan(expandedText.indexOf("제품의견/손실"));
    expect(within(expandedRecord).getByText("구름빵 반죽 작업 있습니다")).toBeInTheDocument();
    expect(within(expandedRecord).getByText("오후 진열대 보충")).toBeInTheDocument();
    expect(within(expandedRecord).getByText("오븐 주변 청소 완료")).toBeInTheDocument();
    expect(within(expandedRecord).getByText("닭가슴살 재고 확인 필요합니다")).toBeInTheDocument();
    expect(within(expandedRecord).getAllByText("구름빵 반죽 작업 있습니다")).toHaveLength(1);
    expect(within(expandedRecord).getAllByText("오후 진열대 보충")).toHaveLength(1);
    const productSummaryTabs = screen.getByRole("tablist", { name: /제품합계 보기/ });
    expect(within(productSummaryTabs).getByRole("tab", { name: "요약" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    fireEvent.click(within(productSummaryTabs).getByRole("tab", { name: "상세" }));
    expect(within(productSummaryTabs).getByRole("tab", { name: "상세" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByRole("columnheader", { name: "입력 내용" })).toBeInTheDocument();
    expect(screen.getAllByText("바게트").length).toBeGreaterThan(0);
    expect(screen.getByText(/생산 10/)).toHaveTextContent("기타+ 3");
    expect(screen.queryByText(/치킨샌드위치.*생산/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "수정" }));
    expect(screen.getByRole("tab", { name: "입력" })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(screen.getByRole("tab", { name: "매출" }));
    expect(screen.getByLabelText("POS 매출액")).toHaveValue("20,000");
    expect(screen.getByLabelText("선물 매출액")).toHaveValue("10,000");
    fireEvent.click(screen.getByRole("tab", { name: "제품" }));
    expect(screen.getByLabelText("바게트 생산량")).toHaveValue("10");

    fireEvent.click(screen.getByRole("tab", { name: "데이터 조회" }));
    fireEvent.change(screen.getByLabelText("조회 방식"), { target: { value: "date" } });
    fireEvent.click(screen.getByRole("button", { name: "상세" }));
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    const deleteRecordDialog = await screen.findByRole("alertdialog");
    expect(
      within(deleteRecordDialog).getByText(`${todayInStoreTime()} 일지를 삭제할까요?`)
    ).toBeInTheDocument();
    fireEvent.click(within(deleteRecordDialog).getByRole("button", { name: "삭제" }));
    expect(await screen.findByText("선택한 일일 운영 일지를 삭제했습니다.")).toBeInTheDocument();
    expect(screen.queryByText("닭가슴살 재고 확인 필요합니다")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("조회 방식"), { target: { value: "month" } });
    fireEvent.change(screen.getByLabelText("나열 방식"), { target: { value: "asc" } });
    let sortedRecords = screen.getAllByRole("article", { name: /일지 요약/ });
    expect(sortedRecords[0]).toHaveAccessibleName("2026-05-01 일지 요약");
    fireEvent.change(screen.getByLabelText("나열 방식"), { target: { value: "desc" } });
    sortedRecords = screen.getAllByRole("article", { name: /일지 요약/ });
    expect(sortedRecords[0]).toHaveAccessibleName("2026-05-31 일지 요약");

    fireEvent.click(screen.getByRole("tab", { name: "입력" }));

    fireEvent.click(screen.getByRole("tab", { name: "메모·점검" }));
    expect(screen.getByLabelText("제품의견/손실")).toBeInTheDocument();
    expect(screen.queryByLabelText("제품의견/손실칸")).not.toBeInTheDocument();
    expect(screen.getByLabelText("위생 점검자")).toBeInTheDocument();
    expect(screen.getByLabelText("최종 점검자")).toBeInTheDocument();
    expect(screen.getByLabelText("첫 출근자 이름")).toBeInTheDocument();
    expect(screen.getByLabelText("첫 출근자 출근시간 시")).toHaveRole("combobox");
    expect(screen.getByLabelText("첫 출근자 출근시간 분")).toHaveRole("combobox");
    expect(
      within(screen.getByLabelText("첫 출근자 출근시간 시")).getByRole("option", { name: "07시" })
    ).toBeInTheDocument();
    expect(
      within(screen.getByLabelText("첫 출근자 출근시간 분")).getByRole("option", { name: "30분" })
    ).toBeInTheDocument();
    expect(
      within(screen.getByLabelText("첫 출근자 출근시간 분")).queryByRole("option", { name: "01분" })
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("최종퇴근자 이름")).toBeInTheDocument();
    expect(screen.getByLabelText("최종퇴근자 퇴근시간 시")).toHaveRole("combobox");
    expect(screen.getByLabelText("최종퇴근자 퇴근시간 분")).toHaveRole("combobox");
    expect(
      within(screen.getByLabelText("최종퇴근자 퇴근시간 시")).getByRole("option", { name: "20시" })
    ).toBeInTheDocument();
    expect(
      within(screen.getByLabelText("최종퇴근자 퇴근시간 분")).getByRole("option", { name: "30분" })
    ).toBeInTheDocument();
    expect(
      within(screen.getByLabelText("최종퇴근자 퇴근시간 분")).queryByRole("option", {
        name: "01분"
      })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("row", { name: /금일/ })).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /내일/ })).toBeInTheDocument();
    expect(screen.getByText("휴무")).toBeInTheDocument();
    expect(screen.getByText("생일")).toBeInTheDocument();
    expect(screen.getByText("신입")).toBeInTheDocument();
    expect(screen.queryByText("생일 신입")).not.toBeInTheDocument();
    expect(screen.getByLabelText("금일 생일")).toBeInTheDocument();
    expect(screen.getByLabelText("금일 신입")).toBeInTheDocument();
    expect(screen.getByText("기타사항")).toBeInTheDocument();
  });

  it("preserves imported raw Excel sections when editing and saving a daily operation record", async () => {
    const rawSections = {
      source: {
        fileName: "일일업무보고서_5월.xlsx",
        sheetName: "1일",
        importedAt: "2026-07-12T00:00:00.000Z"
      },
      sections: {
        serviceAndCustomerNotes: {
          label: "4. 서비스내역 및 손님 특이사항",
          rows: [57, 58, 59, 60],
          text: "원문 손님 특이사항"
        }
      }
    };
    const importedRecord = {
      ...providedDailyOperationRecords[0]!,
      draft: { ...providedDailyOperationRecords[0]!.draft, rawSections }
    };
    let savedBody: Pick<
      DailyOperationSavedRecord,
      "draft" | "productRows" | "channelRows" | "staffSpecialRows"
    > | null = null;
    const dailyOperationApiItems = [
      {
        id: "raw-1",
        date: importedRecord.draft.date,
        draft: importedRecord.draft,
        productRows: importedRecord.productRows,
        channelRows: importedRecord.channelRows,
        staffSpecialRows: importedRecord.staffSpecialRows,
        createdAt: importedRecord.savedAt,
        updatedAt: importedRecord.savedAt
      }
    ];

    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.endsWith("/auth/csrf")) {
        return new Response(JSON.stringify({ data: { csrfToken: "test-token" }, error: null }), {
          headers: { "Content-Type": "application/json" }
        });
      }
      if (url.includes("/daily-operation") && (!init?.method || init.method === "GET")) {
        return new Response(
          JSON.stringify({
            data: { items: dailyOperationApiItems, total: 1, page: 1, size: 1 },
            error: null
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes("/daily-operation/") && init?.method === "PUT") {
        savedBody = JSON.parse(
          typeof init.body === "string" ? init.body : "{}"
        ) as typeof savedBody;
        return new Response(
          JSON.stringify({
            data: {
              id: "raw-1",
              date: savedBody?.draft.date,
              draft: savedBody?.draft,
              productRows: savedBody?.productRows,
              channelRows: savedBody?.channelRows,
              staffSpecialRows: savedBody?.staffSpecialRows,
              createdAt: importedRecord.savedAt,
              updatedAt: "2026-07-12T00:00:00.000Z"
            },
            error: null
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ data: { items: [], total: 0, page: 1, size: 0 }, error: null }),
        {
          headers: { "Content-Type": "application/json" }
        }
      );
    });

    render(
      <ConfirmProvider>
        <MemoryRouter initialEntries={["/daily-log/today"]}>
          <Routes>
            <Route path="/daily-log/today" element={<DailyLogPage />} />
          </Routes>
        </MemoryRouter>
      </ConfirmProvider>
    );

    fireEvent.click(await screen.findByRole("tab", { name: "데이터 조회" }));
    fireEvent.click(await screen.findByRole("button", { name: "상세" }));
    fireEvent.click(screen.getByRole("button", { name: "수정" }));
    fireEvent.click(screen.getByRole("button", { name: "일일 운영 저장" }));

    await waitFor(() => expect(savedBody?.draft.rawSections).toEqual(rawSections));
  });

  it("applies the AI suggestion into editable response fields", async () => {
    let postedResponse: unknown = null;
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = input instanceof Request ? input.url : String(input);

      if (url.endsWith("/auth/csrf")) {
        return new Response(JSON.stringify({ data: { csrfToken: "test-token" }, error: null }), {
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.includes("/response-criteria")) {
        return new Response(
          JSON.stringify({
            data: {
              items: [
                { id: 1, parentId: null, depth: 1, name: "제품", sortOrder: 1, isActive: true },
                { id: 2, parentId: 1, depth: 2, name: "식감", sortOrder: 1, isActive: true },
                { id: 3, parentId: 2, depth: 3, name: "딱딱함", sortOrder: 1, isActive: true },
                {
                  id: 4,
                  parentId: null,
                  depth: 1,
                  name: "서비스·응대",
                  sortOrder: 2,
                  isActive: true
                }
              ],
              total: 4,
              page: 1,
              size: 4
            },
            error: null
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      }

      if (url.endsWith("/response/suggest") && init?.method === "POST") {
        return new Response(
          JSON.stringify({
            data: {
              criterionId: 3,
              shortSummary: "바게트 식감 딱딱함 반응",
              criterionPath: [
                { id: 1, parentId: null, depth: 1, name: "제품" },
                { id: 2, parentId: 1, depth: 2, name: "식감" },
                { id: 3, parentId: 2, depth: 3, name: "딱딱함" }
              ]
            },
            error: null
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      }

      if (url.endsWith("/response") && init?.method === "POST") {
        if (typeof init.body !== "string") {
          throw new Error("Expected string response body");
        }
        postedResponse = JSON.parse(init.body);
        return new Response(JSON.stringify({ data: { id: "77" }, error: null }), {
          headers: { "Content-Type": "application/json" }
        });
      }

      return new Response(JSON.stringify({ data: null, error: { message: url } }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    });

    const showPicker = vi.fn();
    Object.defineProperty(window.HTMLInputElement.prototype, "showPicker", {
      configurable: true,
      value: showPicker
    });

    render(
      <ToastProvider>
        <ResponseEntryPage />
      </ToastProvider>
    );

    fireEvent.click(screen.getByText("날짜"));
    expect(showPicker).toHaveBeenCalled();

    fireEvent.change(await screen.findByLabelText("손님 반응 내용"), {
      target: { value: "바게트가 딱딱하다는 불만이 있었다." }
    });
    fireEvent.click(screen.getByRole("button", { name: "AI 분류하기" }));

    expect(await screen.findByText("AI 추천 적용됨: 제품 > 식감 > 딱딱함")).toBeInTheDocument();
    expect(screen.getByLabelText("요약")).toHaveValue("바게트 식감 딱딱함 반응");
    expect(screen.getByText("선택 기준: AI 추천 · 제품 > 식감 > 딱딱함")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "서비스·응대" }));

    expect(screen.getByText("선택 기준: 서비스·응대")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    expect(await screen.findByText("저장 완료 #77")).toBeInTheDocument();
    expect(postedResponse).toMatchObject({
      criterionId: 4,
      shortSummary: "바게트 식감 딱딱함 반응",
      fullText: "바게트가 딱딱하다는 불만이 있었다.",
      llmAssisted: true
    });
    expect(screen.getByLabelText("요약")).toHaveValue("");
    expect(screen.getByLabelText("손님 반응 내용")).toHaveValue("");
    expect(screen.getByText("선택 기준: 미선택")).toBeInTheDocument();
  });

  it("alerts staff and keeps classification stopped when AI suggestion API fails", async () => {
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = input instanceof Request ? input.url : String(input);

      if (url.endsWith("/auth/csrf")) {
        return new Response(JSON.stringify({ data: { csrfToken: "test-token" }, error: null }), {
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.includes("/response-criteria")) {
        return new Response(
          JSON.stringify({
            data: {
              items: [
                { id: 1, parentId: null, depth: 1, name: "제품", sortOrder: 1, isActive: true },
                { id: 2, parentId: 1, depth: 2, name: "식감", sortOrder: 1, isActive: true },
                { id: 3, parentId: 2, depth: 3, name: "딱딱함", sortOrder: 1, isActive: true }
              ],
              total: 3,
              page: 1,
              size: 3
            },
            error: null
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      }

      if (url.endsWith("/response/suggest") && init?.method === "POST") {
        return new Response(
          JSON.stringify({
            data: null,
            error: {
              code: "HERMES_NOT_CONFIGURED",
              message: "AI 분류 API가 설정되지 않았습니다. 관리자에게 연결 상태를 확인해 주세요."
            }
          }),
          { status: 503, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response(JSON.stringify({ data: null, error: { message: url } }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    });

    render(
      <ToastProvider>
        <ResponseEntryPage />
      </ToastProvider>
    );

    fireEvent.change(await screen.findByLabelText("손님 반응 내용"), {
      target: { value: "청주에서 방문한 손님 계셨습니다." }
    });
    fireEvent.click(screen.getByRole("button", { name: "AI 분류하기" }));

    const errorToast = await screen.findByRole("alert");
    expect(errorToast).toHaveTextContent(
      "AI 분류 API가 설정되지 않았습니다. 관리자에게 연결 상태를 확인해 주세요."
    );
    expect(
      screen.getAllByText(
        "AI 분류 API가 설정되지 않았습니다. 관리자에게 연결 상태를 확인해 주세요."
      ).length
    ).toBeGreaterThan(0);
    expect(screen.getByText("선택 기준: 미선택")).toBeInTheDocument();
    expect(screen.getByLabelText("요약")).toHaveValue("");
    expect(screen.queryByText(/AI 추천 적용됨/)).not.toBeInTheDocument();
  });

  it("keeps response entry guidance visible and requires the original customer words", async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("/response-criteria")) {
        return new Response(
          JSON.stringify({
            data: {
              items: [
                { id: 1, parentId: null, depth: 1, name: "제품", sortOrder: 1, isActive: true }
              ],
              total: 1,
              page: 1,
              size: 1
            },
            error: null
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response(JSON.stringify({ data: { csrfToken: "test-token" }, error: null }), {
        headers: { "Content-Type": "application/json" }
      });
    });

    render(
      <ToastProvider>
        <ResponseEntryPage />
      </ToastProvider>
    );

    expect(await screen.findByText("1. 손님이 한 말 입력")).toBeVisible();
    expect(
      screen.getByText("불만뿐 아니라 칭찬, 문의, 품절, 장거리 방문, 제품 제안도 남겨주세요.")
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "청주에서 일부러 방문했다고 하심" })).toBeVisible();
    expect(screen.getByLabelText("날짜")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "제품" }));
    fireEvent.change(screen.getByLabelText("요약"), { target: { value: "요약만 입력" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    expect(await screen.findByText("손님이 한 말을 적어주세요.")).toBeInTheDocument();
  });

  it("shows detailed response lookup tabs, hides inactive criteria by default, and marks manual records accurately", async () => {
    vi.mocked(fetch).mockImplementation(async (input) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("/response-criteria")) {
        expect(url).toContain("active=true");
        return new Response(
          JSON.stringify({
            data: {
              items: [
                { id: 1, parentId: null, depth: 1, name: "제품", sortOrder: 1, isActive: true },
                { id: 2, parentId: 1, depth: 2, name: "식감", sortOrder: 1, isActive: true }
              ],
              total: 2,
              page: 1,
              size: 2
            },
            error: null
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({
          data: {
            items: [
              {
                id: "101",
                date: "2026-06-13",
                criterionId: 2,
                majorCriterionId: 1,
                middleCriterionId: 2,
                minorCriterionId: null,
                criterionPath: [
                  { id: 1, parentId: null, depth: 1, name: "제품" },
                  { id: 2, parentId: 1, depth: 2, name: "식감" }
                ],
                shortSummary: "직원이 직접 분류한 반응",
                fullText: "원문",
                llmAssisted: false,
                createdAt: "2026-07-12T00:00:00.000Z"
              }
            ],
            total: 1,
            page: 1,
            size: 1
          },
          error: null
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    });

    render(
      <MemoryRouter initialEntries={["/response?mode=lookup&tab=detail"]}>
        <Routes>
          <Route path="/response" element={<ResponseInquiryPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole("tab", { name: "요약 보기" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "상세 기록" })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByLabelText("기준")).not.toHaveTextContent("비활성");
    expect(await screen.findByText("직원이 직접 분류한 반응")).toBeInTheDocument();
    expect(screen.getByText("직원 분류")).toBeInTheDocument();
    expect(screen.queryByText("AI 분류")).not.toBeInTheDocument();
  });

  it("lets staff manage prepaid customer balances without a paper ledger", async () => {
    const transactions = [
      {
        id: "t1",
        type: "CHARGE",
        amount: 50000,
        note: "바게트 10개 선결제",
        occurredAt: "2026-07-01T09:00:00.000Z",
        createdAt: "2026-07-01T09:00:00.000Z"
      },
      {
        id: "t2",
        type: "USE",
        amount: 12000,
        note: "화이트바게트 픽업",
        occurredAt: "2026-07-01T10:00:00.000Z",
        createdAt: "2026-07-01T10:00:00.000Z"
      },
      {
        id: "t3",
        type: "CHARGE",
        amount: 10000,
        note: "추가 선결제 3",
        occurredAt: "2026-07-01T11:00:00.000Z",
        createdAt: "2026-07-01T11:00:00.000Z"
      },
      {
        id: "t4",
        type: "USE",
        amount: 3000,
        note: "사용 내역 4",
        occurredAt: "2026-07-01T12:00:00.000Z",
        createdAt: "2026-07-01T12:00:00.000Z"
      },
      {
        id: "t5",
        type: "CHARGE",
        amount: 7000,
        note: "추가 선결제 5",
        occurredAt: "2026-07-01T13:00:00.000Z",
        createdAt: "2026-07-01T13:00:00.000Z"
      },
      {
        id: "t6",
        type: "USE",
        amount: 2000,
        note: "여섯번째 상세 내역",
        occurredAt: "2026-07-01T14:00:00.000Z",
        createdAt: "2026-07-01T14:00:00.000Z"
      }
    ];
    const customer = {
      id: "1",
      customerName: "김선결",
      contactPhone: "010-1234-5678",
      memo: "단골 선결제",
      balance: 38000,
      lastUsedAt: "2026-07-01T10:00:00.000Z",
      transactions
    };
    let createdBody: unknown = null;
    let usedBody: unknown = null;
    let chargedBody: unknown = null;
    let cancelledTransactionPath: string | null = null;

    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = input instanceof Request ? input.url : String(input);

      if (url.endsWith("/auth/csrf")) {
        return new Response(JSON.stringify({ data: { csrfToken: "test-token" }, error: null }), {
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.includes("/prepaid-ledger") && (!init?.method || init.method === "GET")) {
        return new Response(
          JSON.stringify({ data: { items: [customer], total: 1, page: 1, size: 1 }, error: null }),
          { headers: { "Content-Type": "application/json" } }
        );
      }

      if (url.endsWith("/prepaid-ledger") && init?.method === "POST") {
        createdBody = typeof init.body === "string" ? JSON.parse(init.body) : init.body;
        return new Response(
          JSON.stringify({
            data: {
              ...customer,
              id: "2",
              customerName: "박충전",
              contactPhone: "010-7777-7777",
              balance: 30000,
              transactions: []
            },
            error: null
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      }

      if (url.endsWith("/prepaid-ledger/1/use") && init?.method === "POST") {
        usedBody = typeof init.body === "string" ? JSON.parse(init.body) : init.body;
        return new Response(
          JSON.stringify({ data: { ...customer, balance: 33000 }, error: null }),
          { headers: { "Content-Type": "application/json" } }
        );
      }

      if (url.endsWith("/prepaid-ledger/1/charge") && init?.method === "POST") {
        chargedBody = typeof init.body === "string" ? JSON.parse(init.body) : init.body;
        return new Response(
          JSON.stringify({ data: { ...customer, balance: 58000 }, error: null }),
          { headers: { "Content-Type": "application/json" } }
        );
      }

      if (url.endsWith("/prepaid-ledger/1/transactions/t2") && init?.method === "DELETE") {
        cancelledTransactionPath = new URL(url, "http://localhost").pathname;
        return new Response(
          JSON.stringify({
            data: { ...customer, balance: 50000, transactions: transactions.slice(1) },
            error: null
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ data: { items: [], total: 0, page: 1, size: 0 }, error: null }),
        {
          headers: { "Content-Type": "application/json" }
        }
      );
    });

    render(
      <AppProviders>
        <App />
      </AppProviders>
    );

    fireEvent.click(screen.getByRole("link", { name: "선결제 장부" }));

    expect(await screen.findByRole("heading", { name: "선결제 장부" })).toBeInTheDocument();
    expect(screen.getByLabelText("손님 검색")).toBeInTheDocument();
    expect(screen.getByText("검색 결과")).toBeInTheDocument();
    expect(screen.getByText("총 잔액")).toBeInTheDocument();
    expect(screen.getByText("김선결님")).toBeInTheDocument();
    expect(screen.getByText("현재 잔액")).toBeInTheDocument();
    expect(screen.getAllByText("38,000원")).toHaveLength(2);
    expect(screen.getByText("화이트바게트 픽업")).toBeInTheDocument();
    expect(screen.getByText("현재 선택한 손님")).toBeInTheDocument();
    expect(screen.queryByText("여섯번째 상세 내역")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "김선결 전체 거래 내역 6건 보기" }));
    expect(screen.getByText("여섯번째 상세 내역")).toBeInTheDocument();
    expect(
      screen.getByText(
        "잘못 눌렀다면 최근 내역의 “되돌리기”를 누른 뒤 정확한 금액으로 다시 입력합니다."
      )
    ).toBeInTheDocument();

    const cancelButtons = screen.getAllByRole("button", { name: "되돌리기" });
    expect(cancelButtons).toHaveLength(6);
    const cancelButton = cancelButtons[1] as HTMLElement;
    fireEvent.click(cancelButton);
    const cancelTransactionDialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(cancelTransactionDialog).getByRole("button", { name: "되돌리기" }));
    await waitFor(() =>
      expect(cancelledTransactionPath).toBe("/api/v1/prepaid-ledger/1/transactions/t2")
    );
    expect(await screen.findByText("사용 12,000원 되돌리기 완료 #1")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("새 손님 이름"), { target: { value: "박충전" } });
    fireEvent.change(screen.getByLabelText("새 손님 연락처"), { target: { value: "01077777777" } });
    fireEvent.change(screen.getByLabelText("선결제 금액"), { target: { value: "30000" } });
    fireEvent.change(screen.getByLabelText("선결제 메모"), { target: { value: "식빵 선결제" } });
    fireEvent.click(screen.getByRole("button", { name: "선결제 등록" }));

    await waitFor(() =>
      expect(createdBody).toMatchObject({
        customerName: "박충전",
        contactPhone: "010-7777-7777",
        amount: 30000,
        memo: "식빵 선결제"
      })
    );
    expect(await screen.findByText("선결제 등록 완료 #2")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("김선결 추가 충전 금액"), {
      target: { value: "20000" }
    });
    fireEvent.change(screen.getByLabelText("김선결 추가 충전 메모"), {
      target: { value: "식빵 추가 충전" }
    });
    fireEvent.click(screen.getByRole("button", { name: "김선결 추가 충전" }));

    await waitFor(() =>
      expect(chargedBody).toMatchObject({ amount: 20000, note: "식빵 추가 충전" })
    );
    expect(await screen.findByText("추가 충전 완료 #1")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("김선결 사용 금액"), { target: { value: "5000" } });
    fireEvent.change(screen.getByLabelText("김선결 사용 내용"), {
      target: { value: "크로와상 사용" }
    });
    fireEvent.click(screen.getByRole("button", { name: "김선결 사용 처리" }));

    await waitFor(() => expect(usedBody).toMatchObject({ amount: 5000, note: "크로와상 사용" }));
    expect(await screen.findByText("사용 처리 완료 #1")).toBeInTheDocument();
  });
});
