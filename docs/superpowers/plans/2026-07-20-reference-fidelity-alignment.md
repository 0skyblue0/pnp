# Reference Fidelity Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the delivered `카페 운영 관리 대시보드.dc.html` the visual source of truth for the PNP web dashboard on desktop, while retaining the current product's APIs, routes, data behavior, keyboard support, and genuinely responsive mobile experience.

**Architecture:** Treat the reference HTML as a set of repeatable design primitives, not as static page markup to copy. First replace the global visual contract (palette, shell, density, card/table/control rules); then migrate each route family into the same page anatomy. The existing React state, API requests, and URL semantics remain in place; only presentation markup, shared primitives, and visual regression tests change.

**Tech Stack:** React 18, TypeScript, Tailwind CSS 3, React Router, Vitest + Testing Library, Playwright, Docker Compose.

## Source of Truth and Non-Negotiable Constraints

- Primary visual reference: `Docs/User_Send/카페 운영 관리 대시보드.zip`, extracted for review at `output/playwright/design-comparison/reference/paul&paulina 운영 대시보드.dc.html`.
- Desktop target: the reference's 1194px application frame, 210px cocoa sidebar, and `#f4f0e9` work surface. It is more authoritative than the existing `docs/superpowers/specs/2026-07-20-reference-dashboard-ui-refresh-design.md` where the two conflict.
- Preserve current APIs, data models, routes, form submit behavior, dialogs, URLs, and role/ARIA behavior. Do not introduce mock reference data as product data.
- Keep the current 375px/768px responsive reflow. Do **not** reproduce the reference HTML's fixed-width mobile clipping.
- Retain 44px minimum hit areas and visible focus, even when reference controls are visually 32–36px. Achieve the compact visual size with inner content/padding, not a smaller clickable box.
- Use port `5173` only for visual acceptance. The container serving that port must mount this worktree when validating.

## Visual Acceptance Contract

### Desktop, 1440px viewport

1. The main application is a centered or comfortably framed 1194px work area with a fixed 210px dark sidebar.
2. Sidebar is `#261e18`; inactive navigation uses the muted warm labels from the reference; active navigation is `#c8912f` with dark text. It includes section labels (`운영`, `고객`, `설정`), the unread badge, and staff summary.
3. Main canvas is `#f4f0e9`; page-header strip is `#fbf8f3` with 26px horizontal padding and a `#e7dfd3` bottom rule.
4. Page titles use 19px/800, subtitles 13px, cards 12px radius and a 1px `#e7dfd3` edge. Body rows use 12.5–13px text, 10.5–11.5px metadata, and short vertical rhythm.
5. Data-heavy screens use header controls → compact KPI row → primary chart/table → supporting panels in the same order as the reference. Empty area must not dominate the visible desktop viewport.

### Tablet and mobile

1. At 1024px and below, content remains within the viewport without horizontal page overflow.
2. At 767px and below, the cocoa navigation becomes the existing focus-trapped drawer; the drawer, its active state, grouping, and staff summary use the same reference styling.
3. Tables become labelled card rows or an explicit, labelled horizontal-scroll region. Controls remain 44px hit targets and visible text remains at least 16px for mobile input fields.

### Fidelity threshold

- Each primary route must pass a human side-by-side review against its corresponding reference board at 1440px.
- Difference is acceptable only when it preserves real product behavior or mobile accessibility. Every intentional exception is listed in `docs/cafe-operations-dashboard-design-analysis.md` under a new “implemented exceptions” section.

---

### Task 1: Establish the reference token layer and screenshot baseline

**Files:**
- Modify: `apps/web/tailwind.config.ts`
- Modify: `apps/web/src/styles/index.css`
- Modify: `docs/cafe-operations-dashboard-design-analysis.md`
- Create: `apps/web/src/shared/ui/referenceTokens.test.ts`
- Create: `apps/web/tests/e2e/reference-fidelity.spec.ts`

**Consumes:** Current global tokens and the reference HTML's explicit color/dimension declarations.

**Produces:** Semantic reference tokens and a repeatable 1440px/768px/375px screenshot baseline; no route behavior changes.

- [ ] **Step 1: Write token and browser-test failures**

```tsx
it("exposes the cocoa, gold, canvas, header, and reference card tokens", () => {
  const style = getComputedStyle(document.documentElement);
  expect(style.getPropertyValue("--ref-cocoa").trim()).toBe("#261e18");
  expect(style.getPropertyValue("--ref-gold").trim()).toBe("#c8912f");
  expect(style.getPropertyValue("--ref-canvas").trim()).toBe("#f4f0e9");
});
```

```ts
test("captures the reference routes at the comparison viewports", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/sales-analysis");
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page).toHaveScreenshot("sales-analysis-1440.png", { fullPage: true });
});
```

- [ ] **Step 2: Verify RED**

Run: `npm test -w @pnp/web -- referenceTokens.test.ts` and `npx playwright test tests/e2e/reference-fidelity.spec.ts --update-snapshots=false`.

Expected: the token module/test and screenshot baseline are absent.

- [ ] **Step 3: Implement the reference semantic contract**

Add exact semantic variables and Tailwind aliases; do not use raw color literals in route components:

```css
:root {
  --ref-cocoa: #261e18;
  --ref-gold: #c8912f;
  --ref-gold-strong: #a86e1f;
  --ref-canvas: #f4f0e9;
  --ref-header: #fbf8f3;
  --ref-card: #ffffff;
  --ref-line: #e7dfd3;
  --ref-line-strong: #e0d7c8;
  --ref-text: #261e18;
  --ref-muted: #8a7f73;
}
```

Define `ref-shell`, `ref-page-header`, `ref-card`, `ref-table-head`, `ref-table-row`, `ref-filter-control`, `ref-primary-action`, `ref-secondary-action`, `ref-status-tag`, and `ref-metric-card`. Apply the reference's 8/9/12px radii and compact 10–20px internal spacing, while keeping the global 44px target rule. Record the deliberate mobile exception in the analysis doc.

- [ ] **Step 4: Verify GREEN and capture baseline**

Run: `npm test -w @pnp/web -- referenceTokens.test.ts && npm run typecheck -w @pnp/web && npx playwright test tests/e2e/reference-fidelity.spec.ts --update-snapshots`.

Expected: green unit test and committed screenshots for the current, pre-alignment state.

- [ ] **Step 5: Commit**

Run: `git add apps/web/tailwind.config.ts apps/web/src/styles/index.css apps/web/src/shared/ui/referenceTokens.test.ts apps/web/tests/e2e/reference-fidelity.spec.ts apps/web/tests/e2e/reference-fidelity.spec.ts-snapshots docs/cafe-operations-dashboard-design-analysis.md && git commit -m "test: establish reference fidelity baseline"`.

### Task 2: Replace the global application shell with the reference frame

**Files:**
- Modify: `apps/web/src/app/layouts/AppLayout.tsx`
- Modify: `apps/web/src/app/App.test.tsx`
- Modify: `apps/web/src/styles/index.css`

**Consumes:** Task 1 semantic classes/tokens.

**Produces:** A 210px cocoa desktop sidebar and reference header strip across all routes, while preserving the current accessible mobile drawer.

- [ ] **Step 1: Write shell behavior and visual-state failures**

```tsx
it("groups desktop navigation and marks the active route in the reference sidebar", () => {
  render(<App />);
  expect(screen.getByText("운영")).toBeInTheDocument();
  expect(screen.getByText("고객")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "매출 분석" })).toHaveAttribute("aria-current", "page");
});
```

```ts
test("keeps the reference-styled menu available in the mobile drawer", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/home");
  await page.getByRole("button", { name: "메뉴 열기" }).click();
  await expect(page.getByRole("dialog", { name: "주요 메뉴" })).toBeVisible();
  await expect(page.getByText("운영")).toBeVisible();
});
```

- [ ] **Step 2: Verify RED**

Run: `npm test -w @pnp/web -- App.test.tsx`.

Expected: the current white sidebar has no grouped `운영`/`고객` labels.

- [ ] **Step 3: Implement the frame**

In `AppLayout.tsx`, retain the existing `Navigation`, unread-count fetch, focus trap, escape route, focus restore, and route-close behavior. Split the nav list visually into the reference groups; make desktop `<aside>` use `bg-ref-cocoa`, `text-[#c9bcab]`, 22px/12px/16px padding, and `bg-ref-gold text-ref-cocoa` for active links. Replace the current separate white page/background treatment with a reference header strip and `#f4f0e9` canvas. Keep Lucide icons but make their visual weight secondary to labels.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -w @pnp/web -- App.test.tsx && npm run lint -w @pnp/web && npx playwright test tests/e2e/reference-fidelity.spec.ts --grep "shell"`.

Expected: menu behavior remains accessible and desktop shell screenshot now matches the reference's dark rail/color split.

- [ ] **Step 5: Commit**

Run: `git add apps/web/src/app/layouts/AppLayout.tsx apps/web/src/app/App.test.tsx apps/web/src/styles/index.css apps/web/tests/e2e/reference-fidelity.spec.ts && git commit -m "feat: align application shell to reference frame"`.

### Task 3: Rebuild sales analysis as the canonical reference page

**Files:**
- Modify: `apps/web/src/modules/sales-analysis/SalesAnalysisPage.tsx`
- Modify: `apps/web/src/app/App.test.tsx`
- Modify: `apps/web/tests/e2e/reference-fidelity.spec.ts`

**Consumes:** Existing `SalesAnalysisDto`, data fetch, year selector, and Task 1 primitives.

**Produces:** The closest functional equivalent of the reference's sales-analysis board: compact header/filter strip, KPI row, comparative visual, detail table, and supporting breakdown panels.

- [ ] **Step 1: Write the semantic layout failure**

```tsx
it("orders sales analysis as controls, comparison chart, daily detail, then supporting breakdowns", async () => {
  render(<SalesAnalysisPage />);
  expect(await screen.findByRole("heading", { name: "매출 분석" })).toBeInTheDocument();
  expect(screen.getByRole("group", { name: "연간 매출 핵심 지표" })).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "매출 비교 시각화" })).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "월별 상세" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Verify RED**

Run: `npm test -w @pnp/web -- App.test.tsx`.

Expected: visualisation/detail landmark names do not exist in the current long monthly-progress layout.

- [ ] **Step 3: Implement the reference anatomy without inventing data**

1. Rework the page header into the reference strip: title/subtitle left, year selector and existing goal action right.
2. Keep `SalesAnalysisDto`; map currently available monthly data to the reference-like compact KPI row. Do not display fictitious 2025 comparison or event tags when the API does not provide them.
3. Convert the existing monthly-progress bars into a compact interactive month bar chart region with visible labels, keyboard activation, a text summary, and a selected-month detail panel. The selected value is derived only from `data.monthly`.
4. Render a dense labelled detail table/card-row using actual month, target, sales, progress, count, average ticket, and comparison text. At mobile width use labelled cards, not a clipped desktop grid.
5. Retain channel, top-product, loss-product, and data-warning content as three supporting reference panels with dense 11–13px metadata and `ref-card` rows.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -w @pnp/web -- App.test.tsx && npm run typecheck -w @pnp/web && npx playwright test tests/e2e/reference-fidelity.spec.ts --grep "sales" --update-snapshots`.

Expected: all existing data remains visible, the route no longer leads with a large empty/overspaced card, and the 1440px screenshot has the reference board's information rhythm.

- [ ] **Step 5: Commit**

Run: `git add apps/web/src/modules/sales-analysis/SalesAnalysisPage.tsx apps/web/src/app/App.test.tsx apps/web/tests/e2e/reference-fidelity.spec.ts apps/web/tests/e2e/reference-fidelity.spec.ts-snapshots && git commit -m "feat: align sales analysis with reference board"`.

### Task 4: Apply the reference data-page pattern to home, daily operation, customers, and prepaid

**Files:**
- Modify: `apps/web/src/modules/home/HomePage.tsx`
- Modify: `apps/web/src/modules/daily-log/DailyLogPage.tsx`
- Modify: `apps/web/src/modules/daily-log/DailyOperationExcelImportPanel.tsx`
- Modify: `apps/web/src/modules/reservation/ReservationPage.tsx`
- Modify: `apps/web/src/modules/response/ResponseEntryPage.tsx`
- Modify: `apps/web/src/modules/response/ResponseInquiryPage.tsx`
- Modify: `apps/web/src/modules/response/ResponseListPage.tsx`
- Modify: `apps/web/src/modules/regular-customer/RegularCustomerPage.tsx`
- Modify: `apps/web/src/modules/prepaid-ledger/PrepaidLedgerPage.tsx`
- Modify: `apps/web/src/modules/prepaid-ledger/PrepaidLedgerPage.test.tsx`

**Consumes:** Reference shell, page header, metrics, table rows, compact form controls, and status tags.

**Produces:** All operational routes use the same header → controls → dense content-card hierarchy visible in the reference's daily operations, regular-customer, and prepaid boards.

- [ ] **Step 1: Write route-family failures**

```tsx
it("renders prepaid as a searchable reference-style ledger with a selected-detail region", async () => {
  render(<PrepaidLedgerPage />);
  expect(await screen.findByRole("searchbox", { name: "고객 검색" })).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "거래 내역" })).toBeInTheDocument();
  expect(screen.getByRole("complementary", { name: "선택한 고객 상세" })).toBeInTheDocument();
});
```

```tsx
it("keeps daily operation controls in the compact reference header while preserving names", () => {
  render(<DailyLogPage />);
  expect(screen.getByRole("button", { name: /저장/ })).toBeVisible();
  expect(screen.getByRole("button", { name: /엑셀/ })).toBeVisible();
});
```

- [ ] **Step 2: Verify RED**

Run: `npm test -w @pnp/web -- PrepaidLedgerPage.test.tsx DailyOperationExcelImportPanel.test.tsx App.test.tsx`.

Expected: reference names/regions and the compact header grouping are absent or structurally different.

- [ ] **Step 3: Implement by reference page family**

1. **Home:** use a compact reference header plus a 3–4 metric row, limited agenda/notice panels, and no desktop whitespace below empty values.
2. **Daily operation:** set date/status/actions in the top strip; use compact editable sections, table header bands, dense product rows, and explicit save/error feedback.
3. **Reservation and response:** use title/search/action strip, a primary dense list/table plus a secondary form/detail panel; retain the existing dialogs and live messages.
4. **Regular customers:** match the reference's wide saved-customer table plus narrow candidate panel. Keep actual search/candidate data and make selected rows use the reference pale-gold row treatment.
5. **Prepaid:** match the reference three-tier information hierarchy: selectable compact balances, selected-customer detail/metric strip, transaction table, and shared-prepaid panel. Preserve all real form actions and tabs.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -w @pnp/web -- PrepaidLedgerPage.test.tsx DailyOperationExcelImportPanel.test.tsx App.test.tsx && npm run typecheck -w @pnp/web && npm run lint -w @pnp/web`.

Expected: original API/actions keep working; desktop uses dense panels and mobile collapses into a readable reading order.

- [ ] **Step 5: Commit**

Run: `git add apps/web/src/modules/home/HomePage.tsx apps/web/src/modules/daily-log/DailyLogPage.tsx apps/web/src/modules/daily-log/DailyOperationExcelImportPanel.tsx apps/web/src/modules/reservation/ReservationPage.tsx apps/web/src/modules/response/ResponseEntryPage.tsx apps/web/src/modules/response/ResponseInquiryPage.tsx apps/web/src/modules/response/ResponseListPage.tsx apps/web/src/modules/regular-customer/RegularCustomerPage.tsx apps/web/src/modules/prepaid-ledger/PrepaidLedgerPage.tsx apps/web/src/modules/prepaid-ledger/PrepaidLedgerPage.test.tsx apps/web/src/app/App.test.tsx && git commit -m "feat: align operational pages with reference density"`.

### Task 5: Align management, notifications, components, and state treatments

**Files:**
- Modify: `apps/web/src/modules/admin/ManagementPage.tsx`
- Modify: `apps/web/src/modules/notification/NotificationPage.tsx`
- Modify: `apps/web/src/shared/ui/Button.tsx`
- Modify: `apps/web/src/shared/ui/SegmentedControl.tsx`
- Modify: `apps/web/src/shared/ui/ConfirmDialog.tsx`
- Modify: `apps/web/src/shared/ui/Toast.tsx`
- Modify: `apps/web/src/shared/ui/PageHeader.tsx`
- Modify: `apps/web/src/shared/ui/PageHeader.test.tsx`

**Consumes:** The token and reference-control contract.

**Produces:** Every control, tab, confirmation, toast, and admin screen uses reference visual states without weakening existing accessibility.

- [ ] **Step 1: Write interaction-state failures**

```tsx
it("keeps the management active tab linked to a mounted panel", async () => {
  render(<ManagementPage />);
  const tab = screen.getByRole("tab", { name: "제품 관리" });
  expect(tab).toHaveAttribute("aria-selected", "true");
  expect(document.getElementById(tab.getAttribute("aria-controls") ?? "")).toBeInTheDocument();
});

it("uses a reference primary action without removing the 44px target", () => {
  render(<Button>저장</Button>);
  expect(screen.getByRole("button", { name: "저장" })).toHaveClass("ref-primary-action");
});
```

- [ ] **Step 2: Verify RED**

Run: `npm test -w @pnp/web -- PageHeader.test.tsx App.test.tsx`.

Expected: component state classes or exact active-state treatment are not present.

- [ ] **Step 3: Implement reference states**

Apply the reference's `#261e18` primary action, white bordered secondary action, `#c8912f` active tab underline/pale wash, pale gold selected row, blue holiday/info tag, green positive delta, and red unread/error treatment. Keep all `role="tab"`, mounted panel, arrow-key, focus-trap, `aria-live`, and `role="alert"` behavior already implemented. Dialogs remain visually subdued but keep their accessible focus and 44px close/actions.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -w @pnp/web -- PageHeader.test.tsx App.test.tsx && npm run lint -w @pnp/web`.

Expected: visual state system is shared rather than duplicated in pages, and keyboard/live-region tests remain green.

- [ ] **Step 5: Commit**

Run: `git add apps/web/src/modules/admin/ManagementPage.tsx apps/web/src/modules/notification/NotificationPage.tsx apps/web/src/shared/ui/Button.tsx apps/web/src/shared/ui/SegmentedControl.tsx apps/web/src/shared/ui/ConfirmDialog.tsx apps/web/src/shared/ui/Toast.tsx apps/web/src/shared/ui/PageHeader.tsx apps/web/src/shared/ui/PageHeader.test.tsx apps/web/src/app/App.test.tsx && git commit -m "feat: align shared states to reference system"`.

### Task 6: Execute visual comparison, accessibility regression, and container acceptance

**Files:**
- Modify: `apps/web/tests/e2e/reference-fidelity.spec.ts`
- Modify: `apps/web/tests/e2e/dashboard-layout.spec.ts`
- Modify: `docs/cafe-operations-dashboard-design-analysis.md`
- Create: `output/playwright/reference-fidelity/final/` (generated review artefacts; do not commit unless image snapshots are intentionally versioned)

**Consumes:** Tasks 1–5 and the running `pnp-web-1` service.

**Produces:** Evidence that the deployed 5173 container mounts this branch and visually/behaviorally meets the reference contract.

- [ ] **Step 1: Write final acceptance cases**

```ts
test("sales analysis uses the reference desktop shell and no page-level overflow", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/sales-analysis");
  await expect(page.locator("aside")).toHaveCSS("background-color", "rgb(38, 30, 24)");
  await expect.poll(() => page.locator("body").evaluate((body) => body.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page).toHaveScreenshot("sales-analysis-reference-final.png", { fullPage: true });
});
```

- [ ] **Step 2: Verify RED**

Run the test against the pre-alignment screenshots before final updates.

Expected: snapshot mismatch and/or shell color assertion failure.

- [ ] **Step 3: Run the complete comparison matrix**

Use the rendered reference HTML and live routes:

| Viewport | Routes | Required checks |
|---|---|---|
| 1440×1000 | `/home`, `/daily-log/today`, `/sales-analysis`, `/regular-customer`, `/prepaid-ledger`, `/staff` | cocoa sidebar, compact header, dense card/table hierarchy, no unused desktop canvas |
| 768×1000 | `/home`, `/sales-analysis`, `/prepaid-ledger` | reflow, visible hierarchy, no horizontal page overflow |
| 375×812 | `/home`, `/daily-log/today`, `/sales-analysis`, `/staff` | drawer, one-column reading order, 44px controls, focus ring, reduced motion |

Before browser validation, confirm `pnp-web-1` mounts `/home/pnp/.worktrees/reference-dashboard-ui-refresh`. If it does not, recreate only the `web` service with `docker compose -p pnp -f docker-compose.yml up -d --no-deps --force-recreate web` from this worktree. Do not change the API container.

- [ ] **Step 4: Verify full suite**

Run: `npm test && npm run typecheck && npm run lint && npm run build && npx playwright test tests/e2e/dashboard-layout.spec.ts tests/e2e/reference-fidelity.spec.ts && git diff --check`.

Expected: 0 failures. Inspect final image pairs manually and add the exact intentional differences to the analysis doc.

- [ ] **Step 5: Commit**

Run: `git add apps/web/tests/e2e/reference-fidelity.spec.ts apps/web/tests/e2e/dashboard-layout.spec.ts apps/web/tests/e2e/reference-fidelity.spec.ts-snapshots docs/cafe-operations-dashboard-design-analysis.md && git commit -m "test: verify reference fidelity across dashboard routes"`.

## Plan Self-Review

- The reference file governs shell, palette, compact data hierarchy, controls, and page anatomy; Tasks 1–5 map each of those dimensions to exact existing files.
- Current data/API behavior is explicitly preserved; where the reference shows unavailable comparison/event data, the plan requires a real-data equivalent rather than a fabricated display.
- The plan deliberately preserves the current responsive behavior because the reference HTML is fixed-width at 375px; this is the only planned visual deviation and is documented as an exception.
- Accessibility work already delivered (44px controls, tabs, live regions, focus management, reduced motion) is retained and re-tested in Tasks 5–6.
