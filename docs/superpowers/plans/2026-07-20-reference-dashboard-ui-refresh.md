# Reference Dashboard UI Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved dashboard tokens and responsive reference layout to every existing web screen without altering APIs, routes, data, or workflow behavior.

**Architecture:** Create a semantic Tailwind/global-CSS layer and a small set of shared layout primitives. Migrate the global shell first, then each page family, retaining each page's current state and request code.

**Tech Stack:** React 18, TypeScript, Tailwind CSS 3, React Router, Vitest, Testing Library, Playwright.

## Global Constraints

- Use the color, type, spacing, radius, and motion values in `docs/superpowers/specs/2026-07-20-reference-dashboard-ui-refresh-design.md`.
- Preserve URLs, API calls, response types, and business behavior.
- Every interactive control is at least 44px, has visible keyboard focus, and does not rely on color alone.
- Support 375px, 768px, 1024px, and 1440px without page-level horizontal overflow.
- Honor `prefers-reduced-motion`; transitions are 150–200ms and only animate color, opacity, border, or transform.
- Use port 5173 only for browser checks.

---

### Task 1: Establish semantic tokens and primitives

**Files:**
- Modify: `apps/web/tailwind.config.ts`
- Modify: `apps/web/src/styles/index.css`
- Modify: `apps/web/src/shared/ui/Button.tsx`
- Create: `apps/web/src/shared/ui/PageHeader.tsx`
- Create: `apps/web/src/shared/ui/PageHeader.test.tsx`

**Interfaces:**
- Produces `PageHeader({ title, description?, actions?, eyebrow? })`.
- Produces `app-page`, `app-card`, `app-card-muted`, `app-data-head`, `app-data-row`, and `app-status` CSS classes.

- [ ] **Step 1: Write the failing primitive test**

```tsx
it("renders a title, description, and supplied action", () => {
  render(<PageHeader title="매출 분석" description="연간 흐름" actions={<button>목표 설정</button>} />);
  expect(screen.getByRole("heading", { name: "매출 분석" })).toBeInTheDocument();
  expect(screen.getByText("연간 흐름")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "목표 설정" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Verify RED**

Run: `npm test -w @pnp/web -- PageHeader.test.tsx`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the token layer and primitive**

```tsx
export function PageHeader({ title, description, actions, eyebrow }: PageHeaderProps) {
  return <header className="app-page-header"><div>{eyebrow ? <p>{eyebrow}</p> : null}<h1>{title}</h1>{description ? <p>{description}</p> : null}</div>{actions ? <div className="app-page-actions">{actions}</div> : null}</header>;
}
```

Add the approved semantic colors, 8/9/12px radii, 4px spacing scale, focus-visible ring, tabular figures, and reduced-motion override. Restyle Button while preserving its public props.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -w @pnp/web -- PageHeader.test.tsx && npm run typecheck -w @pnp/web`

Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add apps/web/tailwind.config.ts apps/web/src/styles/index.css apps/web/src/shared/ui/Button.tsx apps/web/src/shared/ui/PageHeader.tsx apps/web/src/shared/ui/PageHeader.test.tsx && git commit -m "feat: establish dashboard design tokens"`

### Task 2: Migrate the responsive app shell

**Files:**
- Modify: `apps/web/src/app/layouts/AppLayout.tsx`
- Modify: `apps/web/src/app/App.test.tsx`

**Interfaces:**
- Consumes `PageHeader` through child pages.
- Produces desktop 210px sidebar, labelled mobile menu drawer, notification badge, and responsive main region.

- [ ] **Step 1: Write failing navigation tests**

```tsx
it("opens the labelled mobile navigation control", async () => {
  render(<App />);
  await userEvent.click(screen.getByRole("button", { name: "메뉴 열기" }));
  expect(screen.getByRole("link", { name: "매출 분석" })).toBeVisible();
});
```

- [ ] **Step 2: Verify RED**

Run: `npm test -w @pnp/web -- App.test.tsx`

Expected: FAIL because the mobile menu button is absent.

- [ ] **Step 3: Implement the shell**

Use an `aside` at `lg` and above, a controlled `메뉴 열기` drawer below `lg`, icon+text links, visible active state, user summary, and the approved page canvas/gutters. Keep all routes and unread-count loading intact.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -w @pnp/web -- App.test.tsx && npm run lint -w @pnp/web`

Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add apps/web/src/app/layouts/AppLayout.tsx apps/web/src/app/App.test.tsx && git commit -m "feat: add responsive dashboard shell"`

### Task 3: Migrate home, daily operation, and sales analysis

**Files:**
- Modify: `apps/web/src/modules/home/HomePage.tsx`
- Modify: `apps/web/src/modules/daily-log/DailyLogPage.tsx`
- Modify: `apps/web/src/modules/daily-log/DailyOperationExcelImportPanel.tsx`
- Modify: `apps/web/src/modules/sales-analysis/SalesAnalysisPage.tsx`
- Modify: `apps/web/src/modules/operation/OperationPage.test.tsx`
- Modify: `apps/web/src/app/App.test.tsx`

**Interfaces:**
- Consumes `PageHeader` and shared app classes.
- Produces home summary/goal/3-card layout, daily 360px+fluid desktop grid, and sales KPI/trend/3-card layout.

- [ ] **Step 1: Write failing semantic-layout tests**

```tsx
it("keeps the sales KPI group and target trend identifiable", async () => {
  render(<SalesAnalysisPage />);
  expect(await screen.findByText("연간 매출")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "월별 목표 달성 흐름" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Verify RED**

Run: `npm test -w @pnp/web -- OperationPage.test.tsx App.test.tsx`

Expected: FAIL until the new landmarks/headings exist.

- [ ] **Step 3: Implement the three page families**

Replace local hard-coded surface classes with shared cards and headers. Preserve data/validation/import/save code. Use responsive grids and mobile card rows for tables that cannot fit.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -w @pnp/web -- OperationPage.test.tsx App.test.tsx DailyOperationExcelImportPanel.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add apps/web/src/modules/home/HomePage.tsx apps/web/src/modules/daily-log/DailyLogPage.tsx apps/web/src/modules/daily-log/DailyOperationExcelImportPanel.tsx apps/web/src/modules/sales-analysis/SalesAnalysisPage.tsx apps/web/src/modules/operation/OperationPage.test.tsx apps/web/src/app/App.test.tsx && git commit -m "feat: refresh core dashboard pages"`

### Task 4: Migrate customer, finance, management, and notification pages

**Files:**
- Modify: `apps/web/src/modules/reservation/ReservationPage.tsx`
- Modify: `apps/web/src/modules/response/ResponseInquiryPage.tsx`
- Modify: `apps/web/src/modules/response/ResponseEntryPage.tsx`
- Modify: `apps/web/src/modules/response/ResponseListPage.tsx`
- Modify: `apps/web/src/modules/regular-customer/RegularCustomerPage.tsx`
- Modify: `apps/web/src/modules/prepaid-ledger/PrepaidLedgerPage.tsx`
- Modify: `apps/web/src/modules/admin/ManagementPage.tsx`
- Modify: `apps/web/src/modules/notification/NotificationPage.tsx`
- Create: `apps/web/src/modules/prepaid-ledger/PrepaidLedgerPage.test.tsx`

**Interfaces:**
- Consumes shared header, card, table, badge, and layout classes.
- Produces responsive desktop 2-column layouts which collapse to one reading-order column.

- [ ] **Step 1: Write the failing finance-page test**

```tsx
it("labels the ledger, transaction history, and selected customer detail", async () => {
  render(<PrepaidLedgerPage />);
  expect(await screen.findByRole("heading", { name: "선결제 장부" })).toBeInTheDocument();
  expect(screen.getByText("거래 내역")).toBeInTheDocument();
});
```

- [ ] **Step 2: Verify RED**

Run: `npm test -w @pnp/web -- PrepaidLedgerPage.test.tsx`

Expected: FAIL because the test file and page landmarks are absent.

- [ ] **Step 3: Implement remaining page layouts**

Migrate reservation to list+form, response to input+records, regular customer to list+candidates, prepaid to history+detail, management to tab bar, and notifications to status rows. Preserve current dialogs, form semantics, actions, and URLs.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -w @pnp/web -- PrepaidLedgerPage.test.tsx && npm run typecheck -w @pnp/web`

Expected: PASS.

- [ ] **Step 5: Commit**

Run: `git add apps/web/src/modules/reservation/ReservationPage.tsx apps/web/src/modules/response/ResponseInquiryPage.tsx apps/web/src/modules/response/ResponseEntryPage.tsx apps/web/src/modules/response/ResponseListPage.tsx apps/web/src/modules/regular-customer/RegularCustomerPage.tsx apps/web/src/modules/prepaid-ledger/PrepaidLedgerPage.tsx apps/web/src/modules/prepaid-ledger/PrepaidLedgerPage.test.tsx apps/web/src/modules/admin/ManagementPage.tsx apps/web/src/modules/notification/NotificationPage.tsx && git commit -m "feat: refresh operations customer and finance pages"`

### Task 5: Headless acceptance and regression verification

**Files:**
- Create: `apps/web/e2e/dashboard-layout.spec.ts`
- Modify: `apps/web/playwright.config.ts` if needed

**Interfaces:**
- Produces Playwright checks for 1440px, 768px, and 375px routes at port 5173.

- [ ] **Step 1: Write failing visual acceptance test**

```ts
test("dashboard routes fit every target viewport", async ({ page }) => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 768, height: 900 }, { width: 375, height: 812 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/home");
    expect(await page.locator("body").evaluate((body) => body.scrollWidth <= window.innerWidth)).toBe(true);
  }
});
```

- [ ] **Step 2: Verify RED**

Run: `npm run test:e2e -w @pnp/web -- dashboard-layout.spec.ts`

Expected: FAIL until the test/configuration exists.

- [ ] **Step 3: Configure the 5173-only browser check and complete visual fixes**

Reuse or start only the existing port-5173 development service. Check home, daily operation, sales analysis, and management at all three viewport widths; add focus and reduced-motion assertions where the test suite can express them.

- [ ] **Step 4: Verify full suite**

Run: `npm test && npm run typecheck && npm run lint && npm run test:e2e -w @pnp/web -- dashboard-layout.spec.ts && git diff --check`

Expected: every command exits 0 and the browser sees no page-level horizontal overflow.

- [ ] **Step 5: Commit**

Run: `git add apps/web/e2e/dashboard-layout.spec.ts apps/web/playwright.config.ts && git commit -m "test: verify responsive dashboard layouts"`

## Plan Review

- Tasks 1–2 cover tokens, accessibility, motion, and responsive navigation.
- Tasks 3–4 cover every named screen while preserving existing behavior.
- Task 5 covers the required 5173 headless browser verification and full regression suite.
