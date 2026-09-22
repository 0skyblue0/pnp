import { expect, type Page, type Route, test } from "@playwright/test";

type ApiEnvelope<T> = {
  data: T | null;
  error: { code: string; message: string } | null;
};

type ProductDto = {
  id: number;
  name: string;
  category: string | null;
  isSeasonal: boolean;
  seasonStart: string | null;
  seasonEnd: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type StaffDto = {
  id: number;
  username: string;
  displayName: string | null;
  role: "SALES" | "PRODUCTION" | "OWNER" | null;
  isActive: boolean;
  createdAt: string;
};

type ReservationDto = {
  id: string;
  customerName: string | null;
  contactPhone: string | null;
  pickupAt: string;
  status: "PENDING" | "READY" | "COMPLETED" | "NO_SHOW" | "CANCELED";
  isPaid: boolean;
  isCut: boolean;
  purpose: "GIFT" | "SELF" | "UNKNOWN" | null;
  allergyNote: string | null;
  memo: string | null;
  cancelReason: string | null;
  items: Array<{
    productId: number;
    productName: string;
    quantity: number;
    cuttingOption: "NONE" | "HALF" | "SLICE" | "HALF_SLICE";
  }>;
};

type NotificationDto = {
  id: number;
  title: string;
  severity: "INFO" | "WARN" | "CRITICAL";
  link?: string;
};

type ResponseCriterionDto = {
  id: number;
  parentId: number | null;
  depth: 1 | 2 | 3;
  name: string;
  sortOrder: number;
  isActive: boolean;
};

type MockState = {
  products: ProductDto[];
  staff: StaffDto[];
  reservations: ReservationDto[];
  notifications: NotificationDto[];
  responseCriteria: ResponseCriterionDto[];
};

type OverrideHandler = (
  route: Route,
  context: {
    method: string;
    path: string;
    url: URL;
  }
) => Promise<boolean> | boolean;

function ok<T>(data: T): ApiEnvelope<T> {
  return { data, error: null };
}

async function fulfillJson<T>(route: Route, data: T, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(ok(data))
  });
}

function listEnvelope<T>(items: T[]) {
  return {
    items,
    total: items.length,
    page: 1,
    size: items.length
  };
}

function defaultState(): MockState {
  return {
    products: [
      {
        id: 1,
        name: "바게트",
        category: "식사빵",
        isSeasonal: false,
        seasonStart: null,
        seasonEnd: null,
        isActive: true,
        createdAt: "2026-05-10T00:00:00.000Z",
        updatedAt: "2026-05-10T00:00:00.000Z"
      },
      {
        id: 2,
        name: "호밀빵",
        category: "식사빵",
        isSeasonal: false,
        seasonStart: null,
        seasonEnd: null,
        isActive: true,
        createdAt: "2026-05-10T00:00:00.000Z",
        updatedAt: "2026-05-10T00:00:00.000Z"
      }
    ],
    staff: [
      {
        id: 1,
        username: "owner",
        displayName: "대표",
        role: "OWNER",
        isActive: true,
        createdAt: "2026-05-10T00:00:00.000Z"
      }
    ],
    reservations: [
      {
        id: "77",
        customerName: "기존손님",
        contactPhone: "010-1111-2222",
        pickupAt: "2026-05-10T06:00:00.000Z",
        status: "PENDING",
        isPaid: false,
        isCut: false,
        purpose: "UNKNOWN",
        allergyNote: null,
        memo: "기존 예약",
        cancelReason: null,
        items: [{ productId: 1, productName: "바게트", quantity: 3, cuttingOption: "NONE" }]
      }
    ],
    notifications: [
      {
        id: 1,
        title: "예약 확인 필요",
        severity: "WARN",
        link: "/reservation"
      }
    ],
    responseCriteria: [
      { id: 1, parentId: null, depth: 1, name: "제품", sortOrder: 1, isActive: true },
      { id: 2, parentId: null, depth: 1, name: "서비스", sortOrder: 2, isActive: true },
      { id: 3, parentId: 2, depth: 2, name: "직원", sortOrder: 1, isActive: true },
      { id: 4, parentId: 3, depth: 3, name: "친절", sortOrder: 1, isActive: true }
    ]
  };
}

async function installApiMock(page: Page, state = defaultState(), override?: OverrideHandler) {
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const path = url.pathname.replace(/^\/api\/v1/, "") || "/";

    if (override && (await override(route, { method, path, url }))) {
      return;
    }

    if (method === "GET" && path === "/auth/csrf") {
      await fulfillJson(route, { csrfToken: "playwright-csrf-token" });
      return;
    }
    if (method === "GET" && path === "/product") {
      await fulfillJson(route, listEnvelope(state.products));
      return;
    }
    if (method === "GET" && path === "/staff") {
      await fulfillJson(route, listEnvelope(state.staff));
      return;
    }
    if (method === "GET" && path === "/response-criteria") {
      const active = url.searchParams.get("active");
      const items =
        active === null
          ? state.responseCriteria
          : state.responseCriteria.filter((criterion) => String(criterion.isActive) === active);
      await fulfillJson(route, listEnvelope(items));
      return;
    }
    if (method === "GET" && path === "/reservation") {
      await fulfillJson(route, listEnvelope(state.reservations));
      return;
    }
    if (method === "GET" && path === "/notification") {
      await fulfillJson(route, listEnvelope(state.notifications));
      return;
    }
    if (method === "GET" && path.startsWith("/daily-log/")) {
      await fulfillJson(route, {
        id: "1",
        date: "2026-05-10",
        congestionLogs: [],
        tastingLogs: [],
        createdAt: "2026-05-10T00:00:00.000Z",
        updatedAt: "2026-05-10T00:00:00.000Z"
      });
      return;
    }
    if (method === "GET" && (path === "/stockout" || path === "/absent-inquiry")) {
      await fulfillJson(route, listEnvelope([]));
      return;
    }
    if (method === "GET" && path === "/response") {
      await fulfillJson(route, listEnvelope([]));
      return;
    }
    if (method === "GET" && path === "/annual-goal-notice") {
      await fulfillJson(route, listEnvelope([]));
      return;
    }
    if (method === "GET" && path === "/annual-schedule") {
      await fulfillJson(route, { items: [] });
      return;
    }

    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({
        data: null,
        error: { code: "UNHANDLED_TEST_ROUTE", message: `${method} ${path}` }
      })
    });
  });
}

test("home daily operation quick link opens the current daily operation workspace", async ({ page }) => {
  await installApiMock(page);
  await page.goto("/home");
  const dailyOperationLink = page.getByRole("main").getByRole("link", { name: /^일일 운영 작성/ });
  await expect(dailyOperationLink).toHaveAttribute("href", "/daily-log/today");
  await dailyOperationLink.click();
  await expect(page).toHaveURL(/\/daily-log\/today$/);
  await expect(page.getByRole("heading", { name: "일일 운영 기록" })).toBeVisible();
});

test("reservation form submits entered fields and status buttons patch the selected reservation", async ({
  page
}) => {
  const state = defaultState();
  let postedReservation: unknown = null;
  let patchedStatus: unknown = null;

  await installApiMock(page, state, async (route, { method, path }) => {
    if (method === "POST" && path === "/reservation") {
      postedReservation = route.request().postDataJSON();
      const created = {
        id: "88",
        customerName: "예약손님",
        contactPhone: "010-0000-0000",
        pickupAt: "2026-05-10T09:00:00.000Z",
        status: "PENDING",
        isPaid: false,
        isCut: true,
        purpose: "GIFT",
        allergyNote: "견과류",
        memo: "쇼핑백 요청",
        cancelReason: null,
        items: [
          { productId: 1, productName: "바게트", quantity: 4, cuttingOption: "HALF" },
          { productId: 2, productName: "호밀빵", quantity: 2, cuttingOption: "NONE" }
        ]
      } satisfies ReservationDto;
      state.reservations = [created];
      await fulfillJson(route, created, 201);
      return true;
    }
    if (method === "PATCH" && path === "/reservation/88/status") {
      patchedStatus = route.request().postDataJSON();
      state.reservations = state.reservations.map((reservation) =>
        reservation.id === "88" ? { ...reservation, status: "COMPLETED" } : reservation
      );
      await fulfillJson(route, state.reservations[0]);
      return true;
    }
    return false;
  });

  await page.goto("/reservation");
  await page.getByRole("button", { name: "+ 새 예약 등록" }).click();
  const registerPanel = page.locator('section[aria-label="새 예약 등록"]');
  await expect(registerPanel).toBeVisible();

  await registerPanel.getByLabel("손님 이름").fill("예약손님");
  await registerPanel.getByLabel("연락처").fill("010-0000-0000");
  await registerPanel.getByLabel("픽업 날짜").fill("2026-05-10");
  await registerPanel.getByLabel("픽업 시", { exact: true }).selectOption("18");
  await registerPanel.getByLabel("픽업 분", { exact: true }).selectOption("00");
  await registerPanel.getByLabel("제품명 1").selectOption("바게트");
  await registerPanel.getByLabel("수량 1").fill("4");
  await registerPanel.getByRole("button", { name: "반컷팅", exact: true }).click();
  await registerPanel.getByRole("button", { name: "제품 추가" }).click();
  await registerPanel.getByLabel("제품명 2").selectOption("호밀빵");
  await registerPanel.getByLabel("수량 2").fill("2");
  await expect(registerPanel.getByRole("button", { name: "슬라이스", exact: true })).toHaveCount(0);
  await registerPanel.getByLabel("예약 메모").fill("쇼핑백 요청");
  await registerPanel.getByRole("button", { name: "등록", exact: true }).click();

  await expect(page.getByText("예약 저장 #88")).toBeVisible();
  expect(postedReservation).toMatchObject({
    contactRef: "예약손님 010-0000-0000",
    customerName: "예약손님",
    contactPhone: "010-0000-0000",
    pickupAt: "2026-05-10T18:00",
    isCut: true,
    memo: "쇼핑백 요청",
    items: [
      { productName: "바게트", quantity: 4, cuttingOption: "HALF" },
      { productName: "호밀빵", quantity: 2, cuttingOption: "NONE" }
    ]
  });

  const savedReservation = page.getByRole("article", { name: "예약손님 예약" });
  await expect(savedReservation).toBeVisible();
  await savedReservation.getByRole("button", { name: "대기" }).click();
  await expect(page.getByText("상태 변경 #88")).toBeVisible();
  expect(patchedStatus).toEqual({ status: "COMPLETED" });
});

test("response entry buttons and inputs produce the expected response payload", async ({
  page
}) => {
  let postedResponse: unknown = null;

  await installApiMock(page, defaultState(), async (route, { method, path }) => {
    if (method === "POST" && path === "/response") {
      postedResponse = route.request().postDataJSON();
      await fulfillJson(route, { id: "42" }, 201);
      return true;
    }
    return false;
  });

  await page.goto("/response/new");
  await page.getByRole("button", { name: "서비스", exact: true }).click();
  await page.getByRole("button", { name: "직원", exact: true }).click();
  await page.getByRole("button", { name: "친절", exact: true }).click();
  await page.getByLabel("한 줄 요약").fill("친절 응대가 좋았음");
  await page.getByLabel("실제 기록 내용").fill("직원 안내가 자세했고 선물 포장 문의가 있었다.");
  await page.getByRole("button", { name: "저장" }).click();

  await expect(page.getByText("저장 완료 #42")).toBeVisible();
  await expect(page.getByLabel("한 줄 요약")).toHaveValue("");
  expect(postedResponse).toMatchObject({
    criterionId: 4,
    shortSummary: "친절 응대가 좋았음",
    fullText: "직원 안내가 자세했고 선물 포장 문의가 있었다."
  });
});

test("management staff tab displays the current team roster", async ({ page }) => {
  await installApiMock(page);
  await page.goto("/staff");
  await page.getByRole("tab", { name: "직원 관리" }).click();
  const staffPanel = page.getByRole("tabpanel", { name: "직원 관리" });
  await expect(staffPanel).toContainText("대표");
  await expect(staffPanel).toContainText("owner");
});
