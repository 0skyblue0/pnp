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
  productionLots: ProductionLotDto[];
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
    productionLots: [
      {
        id: "1",
        productId: 1,
        productName: "바게트",
        producedAt: "2026-05-10T00:00:00.000Z",
        lotType: "AM",
        producedQty: 12,
        staffNote: null
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
    if (method === "GET" && path === "/production-lot") {
      await fulfillJson(route, { ...listEnvelope(state.productionLots), date: "2026-05-10" });
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

test("home production form validates inputs and submits the expected production payload", async ({
  page
}) => {
  const state = defaultState();
  let postedProduction: unknown = null;

  await installApiMock(page, state, async (route, { method, path }) => {
    if (method === "POST" && path === "/production-lot") {
      postedProduction = route.request().postDataJSON();
      const created = {
        id: "2",
        productId: 1,
        productName: "바게트",
        producedAt: "2026-05-10T01:30:00.000Z",
        lotType: "PM_2ND",
        producedQty: 7,
        staffNote: "2차 생산"
      } satisfies ProductionLotDto;
      state.productionLots = [created, ...state.productionLots];
      await fulfillJson(route, created, 201);
      return true;
    }
    return false;
  });

  await page.goto("/home");
  await expect(page.getByRole("heading", { name: "생산 수량 입력" })).toBeVisible();
  await expect(page.getByRole("row", { name: /바게트 12 3 9/ })).toBeVisible();

  const productionPanel = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "생산 수량 입력" }) });

  await productionPanel.getByRole("button", { name: "생산 수량 저장" }).click();
  await expect(page.getByText("생산 제품명을 입력하세요.")).toBeVisible();

  await productionPanel.getByLabel("제품").fill(" 바게트 ");
  await productionPanel.getByLabel("수량").fill("7");
  await productionPanel.getByLabel("로트").selectOption("PM_2ND");
  await productionPanel.getByLabel("생산 시각").fill("2026-05-10T10:30");
  await productionPanel.getByLabel("메모").fill(" 2차 생산 ");
  await productionPanel.getByRole("button", { name: "생산 수량 저장" }).click();

  await expect(page.getByText("생산 수량 저장: 바게트 7개")).toBeVisible();
  expect(postedProduction).toMatchObject({
    productName: "바게트",
    producedQty: 7,
    lotType: "PM_2ND",
    producedAt: "2026-05-10T10:30",
    staffNote: "2차 생산"
  });
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
  const registerPanel = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "예약 등록" }) });

  await registerPanel.getByLabel("손님 이름").fill("예약손님");
  await registerPanel.getByLabel("연락처").fill("010-0000-0000");
  await registerPanel.getByLabel("픽업 날짜").fill("2026-05-10");
  await registerPanel.getByLabel("픽업 시").selectOption("18");
  await registerPanel.getByLabel("픽업 분").selectOption("00");
  await registerPanel.getByLabel("제품 1").selectOption("바게트");
  await registerPanel.getByLabel("수량 1").fill("4");
  await registerPanel.getByLabel("반컷팅").check();
  await registerPanel.getByRole("button", { name: "제품 추가" }).click();
  await registerPanel.getByLabel("제품 2").selectOption("호밀빵");
  await registerPanel.getByLabel("수량 2").fill("2");
  await expect(registerPanel.getByLabel("슬라이스")).toHaveCount(0);
  await registerPanel.getByLabel("메모").fill("쇼핑백 요청");
  await registerPanel.getByRole("button", { name: "저장" }).click();

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

  await expect(page.getByRole("button", { name: "결제완료" })).toHaveCount(0);

  await page.getByRole("button", { name: "픽업완료" }).click();
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
  await page.getByRole("button", { name: "서비스" }).click();
  await page.getByRole("button", { name: "직원" }).click();
  await page.getByRole("button", { name: "친절" }).click();
  await page.getByLabel("짧은 요약").fill("친절 응대가 좋았음");
  await page.getByLabel("자세한 내용").fill("직원 안내가 자세했고 선물 포장 문의가 있었다.");
  await page.getByRole("button", { name: "저장" }).click();

  await expect(page.getByText("저장 완료 #42")).toBeVisible();
  await expect(page.getByLabel("짧은 요약")).toHaveValue("");
  expect(postedResponse).toMatchObject({
    criterionId: 4,
    shortSummary: "친절 응대가 좋았음",
    fullText: "직원 안내가 자세했고 선물 포장 문의가 있었다."
  });
});

test("management staff form validates required fields and creates staff without blank displayName", async ({
  page
}) => {
  const state = defaultState();
  let postedStaff: Record<string, unknown> | null = null;

  await installApiMock(page, state, async (route, { method, path }) => {
    if (method === "POST" && path === "/staff") {
      postedStaff = route.request().postDataJSON() as Record<string, unknown>;
      const created = {
        id: 2,
        username: String(postedStaff.username),
        displayName: null,
        role: postedStaff.role as StaffDto["role"],
        isActive: true,
        createdAt: "2026-05-10T00:00:00.000Z"
      } satisfies StaffDto;
      state.staff = [...state.staff, created];
      await fulfillJson(route, created, 201);
      return true;
    }
    return false;
  });

  await page.goto("/staff");
  const staffPanel = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "직원 조회" }) });

  await staffPanel.getByRole("button", { name: "직원 추가" }).click();
  await staffPanel.getByRole("button", { name: "추가", exact: true }).click();
  await expect(page.getByText("직원 아이디를 입력하세요.")).toBeVisible();

  await staffPanel.getByLabel("아이디").fill("baker2");
  await staffPanel.getByLabel("비밀번호").fill("short");
  await staffPanel.getByRole("button", { name: "추가", exact: true }).click();
  await expect(page.getByText("초기 비밀번호를 8자 이상 입력하세요.")).toBeVisible();

  await staffPanel.getByLabel("비밀번호").fill("validpass1");
  await staffPanel.getByLabel("역할").selectOption("PRODUCTION");
  await staffPanel.getByRole("button", { name: "추가", exact: true }).click();

  await expect(page.getByText("직원 추가: baker2")).toBeVisible();
  expect(postedStaff).toMatchObject({
    username: "baker2",
    password: "validpass1",
    role: "PRODUCTION",
    isActive: true
  });
  expect(postedStaff).not.toHaveProperty("displayName");
});
