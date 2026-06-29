import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "./App.js";
import { AppLayout } from "./layouts/AppLayout.js";
import { AppProviders } from "./providers/AppProviders.js";
import { DailyLogPage } from "../modules/daily-log/DailyLogPage.js";
import { HomePage } from "../modules/home/HomePage.js";
import { ResponseEntryPage } from "../modules/response/ResponseEntryPage.js";
import { ResponseInquiryPage } from "../modules/response/ResponseInquiryPage.js";

const ACTIVE_NAV_CLASS = "from-cocoa";

describe("App", () => {
  beforeEach(() => {
    window.localStorage.clear();
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

  it("renders the annual schedule home as the first experience", () => {
    render(
      <AppProviders>
        <App />
      </AppProviders>
    );

    expect(screen.getByRole("heading", { name: "연간 스케줄 달력" })).toBeInTheDocument();
    expect(screen.getByLabelText("스케줄 구분")).toBeInTheDocument();
    expect(screen.getByText(/2026년 연간 스케줄/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "6월" })).toBeInTheDocument();
    const june26 = screen.getByLabelText("6월 26일");
    expect(within(june26).getByText("26")).toBeInTheDocument();
    expect(within(june26).getByText("여름깜빠뉴 출시")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "8월" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "1년 전체 보기" }));
    expect(screen.getByRole("heading", { name: "8월" })).toBeInTheDocument();
    expect(screen.getByText("8/31")).toBeInTheDocument();
    expect(screen.getByText("여름깜빠뉴 마감")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "올해 목표·매출 공지" })).toBeInTheDocument();
    expect(screen.getByText("올해 매출 목표")).toBeInTheDocument();
    expect(screen.getByText("운영 목표")).toBeInTheDocument();
    expect(screen.queryByText("시즌 상품 목표")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "오늘의 가용 재고" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "생산 수량 입력" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "오늘의 예약" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "운영 신호" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "스케줄 알림" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /손님 반응/ }).length).toBeGreaterThan(0);
  });

  it("adds staff schedules through the home input and places them under the matching calendar day", async () => {
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      const url = input instanceof Request ? input.url : String(input);

      if (url.endsWith("/auth/csrf")) {
        return new Response(JSON.stringify({ data: { csrfToken: "test-token" }, error: null }), {
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.includes("/annual-schedule") && (!init?.method || init.method === "GET")) {
        return new Response(JSON.stringify({ data: { items: [] }, error: null }), {
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.endsWith("/annual-schedule") && init?.method === "POST") {
        return new Response(
          JSON.stringify({
            data: {
              id: "202",
              date: "2026-06-29",
              title: "직원 추가 일정",
              note: "추가 메모",
              tone: "notice"
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
      <MemoryRouter initialEntries={["/home"]}>
        <Routes>
          <Route path="/home" element={<HomePage />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText("스케줄 구분"), { target: { value: "notice" } });
    fireEvent.change(screen.getByLabelText("제목"), { target: { value: "직원 추가 일정" } });
    fireEvent.change(screen.getByLabelText("메모"), { target: { value: "추가 메모" } });
    fireEvent.click(screen.getByRole("button", { name: "추가" }));

    const dayCell = await screen.findByLabelText("6월 29일");
    expect(within(dayCell).getByText("직원 추가 일정")).toBeInTheDocument();
    expect(within(dayCell).getByText("추가 메모")).toBeInTheDocument();
    expect(screen.getByLabelText("제목")).toHaveValue("");
    expect(screen.getByLabelText("스케줄 구분")).toHaveValue("");
  });

  it("lets staff select stored annual schedules before editing or deleting them", async () => {
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

      if (url.includes("/annual-schedule") && (!init?.method || init.method === "GET")) {
        return new Response(
          JSON.stringify({
            data: {
              items: [
                {
                  id: "101",
                  date: "2026-06-30",
                  title: "직원 입력 일정",
                  note: "처음 메모",
                  tone: "notice"
                }
              ]
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
              title: "수정된 일정",
              note: "수정 메모",
              tone: "launch"
            },
            error: null
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      }

      if (url.endsWith("/annual-schedule/101") && init?.method === "DELETE") {
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
      <MemoryRouter initialEntries={["/home"]}>
        <Routes>
          <Route path="/home" element={<HomePage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("직원 입력 일정")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "6월" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "8월" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "수정" }));
    fireEvent.click(screen.getByLabelText("직원 입력 일정 수정 선택"));
    fireEvent.click(screen.getByRole("button", { name: "확인" }));
    fireEvent.change(screen.getByLabelText("수정 스케줄 구분"), { target: { value: "launch" } });
    fireEvent.change(screen.getByDisplayValue("직원 입력 일정"), {
      target: { value: "수정된 일정" }
    });
    fireEvent.change(screen.getByDisplayValue("처음 메모"), { target: { value: "수정 메모" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    expect(await screen.findByText("수정된 일정")).toBeInTheDocument();
    expect(screen.getByText("수정 메모")).toBeInTheDocument();
    expect(screen.getAllByText("출시").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    fireEvent.click(screen.getByLabelText("수정된 일정 삭제 선택"));
    fireEvent.click(screen.getByRole("button", { name: "확인" }));
    await screen.findByText("여름깜빠뉴 출시");
    expect(screen.queryByText("수정된 일정")).not.toBeInTheDocument();
  });

  it("shows only the five main bakery work tabs", () => {
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
    ).toEqual(["홈", "일일 운영", "손님 반응", "예약", "관리"]);
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
    expect(screen.getByRole("tab", { name: "통계" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "상세 조회" })).toHaveAttribute(
      "aria-selected",
      "false"
    );

    expect((await screen.findAllByText("제품")).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "주요 사항" })).toBeInTheDocument();
    expect(screen.getByText("16건 중 제품 비중이 가장 큽니다.")).toBeInTheDocument();
    expect(screen.getAllByText(/제품 > 맛 > 바게트/).length).toBeGreaterThan(0);
    expect(screen.getByText("12건 · 75%")).toBeInTheDocument();
    expect(screen.getAllByText("맛").length).toBeGreaterThan(0);
    expect(screen.getByText("9건 · 75%")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "원형" })).not.toBeInTheDocument();
  });

  it("switches from statistics to detailed response lookup inside the lookup screen", async () => {
    render(
      <MemoryRouter initialEntries={["/response?mode=lookup"]}>
        <Routes>
          <Route path="/response" element={<ResponseInquiryPage />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("tab", { name: "상세 조회" }));

    expect(screen.getByRole("tab", { name: "상세 조회" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "상세 조회" })).toBeInTheDocument();
    expect(await screen.findByText("조회된 고객 반응 없음")).toBeInTheDocument();
  });

  it("organizes the daily operation page with fixed products, non-POS sales, and staff check tables", async () => {
    render(
      <MemoryRouter initialEntries={["/daily-log/today"]}>
        <Routes>
          <Route path="/daily-log/today" element={<DailyLogPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "매장 운영일지" })).toBeInTheDocument();
    expect(screen.queryByText(/엑셀 대체/)).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("tablist", { name: "일일 운영 입력 분류" }))
        .getAllByRole("tab")
        .map((tab) => tab.textContent)
    ).toEqual(["기본 정보", "제품", "매출", "메모·점검"]);
    expect(screen.getByLabelText("작성자")).toBeInTheDocument();
    expect(screen.getByLabelText("외부온도")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "매출" }));
    expect(screen.getByLabelText("POS 매출액")).toBeInTheDocument();
    expect(screen.getByLabelText("POS 매출건수")).toBeInTheDocument();
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
    expect(screen.getByLabelText("POS 외 매출액")).toHaveTextContent("15,000원");
    expect(screen.getByLabelText("POS 외 매출건수")).toHaveTextContent("5건");
    expect(screen.getAllByText("35,000원").length).toBeGreaterThan(0);
    expect(screen.getAllByText("10건").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("tab", { name: "제품" }));
    expect(screen.getByText("바게트")).toBeInTheDocument();
    expect(screen.getByText("치킨샌드위치")).toBeInTheDocument();
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

    fireEvent.click(screen.getByRole("button", { name: "일일 운영 저장" }));
    fireEvent.click(screen.getByRole("tab", { name: "조회" }));
    expect(screen.getByLabelText("조회 방식")).toBeInTheDocument();
    expect(screen.getByText("전체 1일 / 조회 1일")).toBeInTheDocument();
    expect(screen.getByText("총매출")).toBeInTheDocument();
    expect(screen.getAllByText("35,000원").length).toBeGreaterThan(0);
    expect(screen.getByText("일 평균 매출")).toBeInTheDocument();
    expect(screen.getAllByText("객단가").length).toBeGreaterThan(0);
    expect(screen.getByText("이전 기간 대비")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("조회 방식"), { target: { value: "week" } });
    expect(screen.getByText("전주 대비")).toBeInTheDocument();
    expect(screen.getByText("+100%")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "상세" }));
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

    fireEvent.click(screen.getByRole("tab", { name: "입력" }));

    fireEvent.click(screen.getByRole("tab", { name: "메모·점검" }));
    expect(screen.getByLabelText("제품의견/손실")).toBeInTheDocument();
    expect(screen.queryByLabelText("제품의견/손실칸")).not.toBeInTheDocument();
    expect(screen.getByLabelText("위생 점검자")).toBeInTheDocument();
    expect(screen.getByLabelText("최종 점검자")).toBeInTheDocument();
    expect(screen.getByLabelText("첫 출근자 이름")).toBeInTheDocument();
    expect(screen.getByLabelText("첫 출근자 출근시간")).toBeInTheDocument();
    expect(screen.getByLabelText("최종퇴근자 이름")).toBeInTheDocument();
    expect(screen.getByLabelText("최종퇴근자 퇴근시간")).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /금일/ })).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /내일/ })).toBeInTheDocument();
    expect(screen.getByText("휴무")).toBeInTheDocument();
    expect(screen.getByText("기타사항")).toBeInTheDocument();
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
                { id: 2, parentId: 1, depth: 2, name: "품목", sortOrder: 1, isActive: true },
                { id: 3, parentId: 2, depth: 3, name: "바게트", sortOrder: 1, isActive: true },
                { id: 4, parentId: null, depth: 1, name: "서비스", sortOrder: 2, isActive: true }
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
              shortSummary: "바게트 품목 상태 불만",
              criterionPath: [
                { id: 1, parentId: null, depth: 1, name: "제품" },
                { id: 2, parentId: 1, depth: 2, name: "품목" },
                { id: 3, parentId: 2, depth: 3, name: "바게트" }
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

    render(<ResponseEntryPage />);

    fireEvent.change(await screen.findByLabelText("손님 반응 내용"), {
      target: { value: "바게트가 딱딱하다는 불만이 있었다." }
    });
    fireEvent.click(screen.getByRole("button", { name: "AI 분류하기" }));

    expect(await screen.findByText("AI 추천 적용됨: 제품 > 품목 > 바게트")).toBeInTheDocument();
    expect(screen.getByLabelText("요약")).toHaveValue("바게트 품목 상태 불만");
    expect(screen.getByText("선택 기준: AI 추천 · 제품 > 품목 > 바게트")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "서비스" }));

    expect(screen.getByText("선택 기준: 서비스")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    expect(await screen.findByText("저장 완료 #77")).toBeInTheDocument();
    expect(postedResponse).toMatchObject({
      criterionId: 4,
      shortSummary: "바게트 품목 상태 불만",
      fullText: "바게트가 딱딱하다는 불만이 있었다.",
      llmAssisted: true
    });
  });
});
