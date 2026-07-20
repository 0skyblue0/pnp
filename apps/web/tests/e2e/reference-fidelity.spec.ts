import { expect, test } from "@playwright/test";

const fixedDate = "2026-07-20";

const list = <T>(items: T[]) => ({ items, total: items.length, page: 1, size: 100 });
const success = <T>(data: T) => ({ data, error: null });

const dailyRecord = {
  id: "reference-fixture-daily-operation",
  date: fixedDate,
  draft: {
    date: fixedDate,
    author: "기준 운영자",
    outsideTemp: "26",
    insideTemp: "23",
    outsideHumidity: "60",
    insideHumidity: "48",
    weather: "맑음",
    posSalesAmount: "180000",
    posSalesCount: "18",
    nonPosSalesAmount: "0",
    nonPosSalesCount: "0",
    productOpinionAndLoss: "기준선 확인",
    facilityIssue: "",
    cleaningWork: "완료",
    instructions: "",
    tomorrowPrep: "반죽 준비",
    firstWorker: "기준 운영자",
    firstWorkerTime: "08:00",
    lastWorker: "기준 운영자",
    lastWorkerTime: "18:00",
    hygieneChecker: "기준 운영자",
    finalChecker: "기준 운영자"
  },
  productRows: [
    {
      productName: "기준 식빵",
      producedQty: "20",
      lossQty: "1",
      tastingQty: "1",
      otherInQty: "0",
      otherOutQty: "0",
      stockQty: "4",
      soldQty: "14",
      manualSold: false
    }
  ],
  channelRows: [{ name: "배민", count: "4", amount: "40000" }],
  staffSpecialRows: {
    today: { dayOff: "", vacation: "", lateEarly: "", support: "", birthday: "", newStaff: "", etc: "" },
    tomorrow: { dayOff: "", vacation: "", lateEarly: "", support: "", birthday: "", newStaff: "", etc: "" }
  },
  createdAt: "2026-07-20T00:00:00.000Z",
  updatedAt: "2026-07-20T00:00:00.000Z"
};

const salesSummary = {
  year: 2026,
  totalSales: 1_020_000,
  totalCount: 102,
  recordedDays: 6,
  recordedMonths: 1,
  averageTicket: 10_000,
  dailyAverageSales: 170_000,
  targetAmount: 1_200_000,
  targetProgressRate: 0.85,
  latestRecordedMonth: {
    month: "2026-07",
    sales: 1_020_000,
    count: 102,
    previousSalesChange: 120_000,
    previousSalesChangeRate: 0.13
  },
  monthly: Array.from({ length: 12 }, (_, index) => {
    const month = String(index + 1).padStart(2, "0");
    const hasRecord = index === 6;
    return {
      month: `2026-${month}`,
      sales: hasRecord ? 1_020_000 : 0,
      count: hasRecord ? 102 : 0,
      recordedDays: hasRecord ? 6 : 0,
      hasRecord,
      averageTicket: hasRecord ? 10_000 : 0,
      targetAmount: 100_000,
      targetProgressRate: hasRecord ? 10.2 : 0,
      previousSalesChange: hasRecord ? 120_000 : null,
      previousSalesChangeRate: hasRecord ? 0.13 : null
    };
  }),
  channels: [{ name: "POS", amount: 900_000, count: 90, ratio: 0.88 }],
  productTop: [{ productName: "기준 식빵", soldQty: 84, lossQty: 6, tastingQty: 6, lossRate: 0.06 }],
  lossTop: [{ productName: "기준 식빵", soldQty: 84, lossQty: 6, tastingQty: 6, lossRate: 0.06 }],
  dataWarnings: [],
  visual: { maxMonthlySales: 1_020_000, maxDailySales: 220_000 }
};

const fixtures: Record<string, unknown> = {
  "/annual-schedule": { items: [] },
  "/annual-goal-notice": list([]),
  "/notification": list([]),
  "/reservation": list([]),
  "/response": list([]),
  "/daily-operation": list([dailyRecord]),
  "/product": list([{ id: 1, name: "기준 식빵", isActive: true, sortOrder: 1 }]),
  "/sales-analysis/summary": salesSummary
};

const comparisonRoutes = [
  {
    path: "/home",
    heading: "홈",
    readyText: "작성 완료",
    apiPaths: ["/annual-schedule", "/annual-goal-notice", "/notification", "/reservation", "/response", "/daily-operation"]
  },
  {
    path: "/sales-analysis",
    heading: "매출 분석",
    readyText: "1,020,000원",
    apiPaths: ["/notification", "/sales-analysis/summary"]
  },
  {
    path: "/daily-log/today",
    heading: "일일 운영 기록",
    readyText: "기준 식빵",
    apiPaths: ["/notification", "/product", "/daily-operation"]
  }
] as const;

const comparisonViewports = [
  { width: 1440, height: 1000, label: "1440" },
  { width: 768, height: 1000, label: "768" },
  { width: 375, height: 812, label: "375" }
] as const;

test("captures deterministic reference routes including sales analysis at the comparison viewports", async ({ page }) => {
  const requestedApiPaths = new Set<string>();
  await page.clock.install({ time: new Date("2026-07-20T09:00:00+09:00") });
  await page.context().clearCookies();
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/api/v1", "");
    const fixture = fixtures[path];
    if (!fixture) {
      throw new Error(`Missing reference fidelity fixture for ${path}`);
    }

    requestedApiPaths.add(path);
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(success(fixture)) });
  });

  for (const viewport of comparisonViewports) {
    await page.setViewportSize(viewport);

    for (const route of comparisonRoutes) {
      requestedApiPaths.clear();
      await page.goto(route.path, { waitUntil: "domcontentloaded" });
      await expect(page.locator('meta[name="pnp-ui-source"]')).toHaveAttribute(
        "content",
        "reference-fidelity-alignment-task-1"
      );
      if (route.path === "/sales-analysis") {
        await expect(page.locator('meta[name="pnp-ui-reference-sales"]')).toHaveAttribute(
          "content",
          "reference-fidelity-alignment-task-3"
        );
      }
      await expect(page.getByRole("main")).toBeVisible();
      await expect(page.getByRole("heading", { name: route.heading })).toBeVisible();
      await expect.poll(() => page.locator("body").innerText()).toContain(route.readyText);
      await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
      await page.evaluate(async () => document.fonts.ready);

      for (const apiPath of route.apiPaths) {
        await expect.poll(() => requestedApiPaths.has(apiPath)).toBe(true);
      }

      await expect(page).toHaveScreenshot(`${route.path.slice(1)}-${viewport.label}.png`, {
        fullPage: true
      });
    }
  }
});

test("keeps the reference shell menu available in the mobile drawer", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/home");

  await page.getByRole("button", { name: "메뉴 열기" }).click();

  const drawer = page.getByRole("dialog", { name: "주요 메뉴" });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText("운영", { exact: true })).toBeVisible();
  await expect(drawer.getByText("고객", { exact: true })).toBeVisible();
});

test("verifies the desktop reference shell frame at 1440px", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.clock.install({ time: new Date("2026-07-20T09:00:00+09:00") });
  await page.context().clearCookies();
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/v1", "");
    const fixture = fixtures[path];
    if (!fixture) {
      throw new Error(`Missing reference shell fixture for ${path}`);
    }
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(success(fixture)) });
  });

  await page.goto("/home", { waitUntil: "networkidle" });
  await expect(page.locator('meta[name="pnp-ui-reference-shell"]')).toHaveAttribute(
    "content",
    "reference-fidelity-alignment-task-2"
  );

  const sidebar = page.locator("aside");
  await expect(sidebar).toHaveCSS("width", "210px");
  await expect(sidebar).toHaveCSS("background-color", "rgb(38, 30, 24)");
  await expect(page.getByText("운영", { exact: true }).first()).toHaveCSS("color", "rgb(138, 124, 107)");
  await expect(page.getByRole("link", { name: "일일 운영" }).first()).toHaveCSS("color", "rgb(201, 188, 171)");
  await expect(page.getByRole("link", { name: "홈", exact: true }).first()).toHaveCSS("background-color", "rgb(200, 145, 47)");
  await expect(page.locator("aside + div")).toHaveCSS("background-color", "rgb(244, 240, 233)");
  await expect(page.locator("header.ref-page-header")).toHaveCSS("background-color", "rgb(251, 248, 243)");
  await expect(page).toHaveScreenshot("reference-shell-desktop-1440.png", { fullPage: true });
});
