# MagicERP External Monthly Sales Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Securely preview MagicERP monthly store sales from 관리 > 외부 연동 and, after approval, select those values in PNP sales analysis without double counting.

**Architecture:** Fastify owns Playwright Chromium through an injectable `MagicErpMonthlyClient`. Credentials live in one preview request only. Preview compares without mutation; approval versions external records; sales analysis selects current approved external months over PNP month aggregates, while daily trends remain PNP-only.

**Tech Stack:** React 18, TypeScript, Fastify 5, Prisma/PostgreSQL, Zod, Playwright Chromium, Vitest, React Testing Library.

## Global Constraints

- Always use web port `5173`.
- Never use `.env` `pos_id`/ `pos_pw` at runtime; never store, log, return, or browser-store credentials.
- In `finally`, close every MagicERP browser context/process, including failed navigation and parse failures.
- External approved values replace rather than add to PNP monthly values. PNP daily/channel/product summaries remain unchanged.
- Preserve the worktree's unrelated changes; stage named files only.

---

### Task 1: Add persistence and Chromium runtime

**Files:**
- Modify: `apps/api/prisma/schema.prisma`, `apps/api/package.json`, `package-lock.json`, `docker/node-dev.Dockerfile`
- Create: `apps/api/prisma/migrations/<timestamp>_add_external_monthly_sales/migration.sql`
- Create: `apps/api/src/modules/external-integration/magicerp.routes.test.ts`

**Interfaces:** Prisma model `ExternalMonthlySale` exposes `provider, storeId, storeName, year, month, salesAmount, salesCount, status, supersededById, approvedAt, createdAt`. Current records use `APPROVED`; replaced records use `SUPERSEDED`.

- [ ] **Step 1: Write the failing delegate test**

```ts
expect(prisma.externalMonthlySale.findMany).toHaveBeenCalledWith(
  expect.objectContaining({ where: { provider: "MAGICERP", status: "APPROVED" } })
);
```

- [ ] **Step 2: Verify RED**

Run: `npm run test -w @pnp/api -- src/modules/external-integration/magicerp.routes.test.ts`  
Expected: FAIL because the delegate/module does not exist.

- [ ] **Step 3: Implement the model/migration/runtime**

```prisma
model ExternalMonthlySale {
  id BigInt @id @default(autoincrement())
  provider String @db.VarChar(20)
  storeId String @map("store_id") @db.VarChar(40)
  storeName String @map("store_name") @db.VarChar(120)
  year Int @db.SmallInt
  month Int @db.SmallInt
  salesAmount Int @map("sales_amount")
  salesCount Int @map("sales_count")
  status String @default("APPROVED") @db.VarChar(20)
  supersededById BigInt? @map("superseded_by_id")
  approvedAt DateTime @default(now()) @map("approved_at") @db.Timestamptz(6)
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  @@index([provider, storeId, year, month, status], map: "idx_external_monthly_sale_current")
  @@map("external_monthly_sale")
}
```

Create equivalent SQL, add `playwright` to API dependencies, and install its browser in Docker after `npm ci`:

```dockerfile
RUN npx playwright install --with-deps chromium
```

- [ ] **Step 4: Verify GREEN**

Run: `npm run prisma:generate -w @pnp/api && npm run test -w @pnp/api -- src/modules/external-integration/magicerp.routes.test.ts`  
Expected: Prisma delegate is available; only unimplemented route behaviors may remain.

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma apps/api/package.json package-lock.json docker/node-dev.Dockerfile apps/api/src/modules/external-integration/magicerp.routes.test.ts
git commit -m "feat: add external monthly sales persistence"
```

### Task 2: Implement isolated MagicERP automation

**Files:**
- Create: `apps/api/src/modules/external-integration/magicerp.client.ts`
- Create: `apps/api/src/modules/external-integration/magicerp.client.test.ts`

**Interfaces:** `MagicErpMonthlyClient.preview({ username, password, year, storeId })` returns `{ storeId, storeName, months: Array<{ month, salesAmount, salesCount }> }`.

- [ ] **Step 1: Write failing client tests**

Mock Playwright and assert login fills `#id`/`#pw`, navigation visits `/magicerp/monthly.asp`, selected radio equals requested store ID, 12 numeric months parse, and cleanup runs on both success/failure.

```ts
await expect(client.preview(input)).rejects.toThrow("MagicERP 월별 결과 형식을 확인할 수 없습니다.");
expect(context.close).toHaveBeenCalledOnce();
expect(browser.close).toHaveBeenCalledOnce();
```

- [ ] **Step 2: Verify RED**

Run: `npm run test -w @pnp/api -- src/modules/external-integration/magicerp.client.test.ts`  
Expected: FAIL because the client is missing.

- [ ] **Step 3: Implement minimal client**

Launch a fresh headless Chromium context with 30-second timeout and `try/finally`. Follow the verified pages: login page → `main.asp` → `/magicerp/monthly.asp`; open `#txtstoreidx`, validate the requested store radio, invoke visible `조회`, parse explicit month/date, sales amount, and count cells. Reject auth failures, missing stores, nonnumeric cells, changed DOM, and results not containing 12 months with credential-free Korean errors. Never log page HTML, credentials, cookies, or session URLs.

- [ ] **Step 4: Verify GREEN**

Run: `npm run test -w @pnp/api -- src/modules/external-integration/magicerp.client.test.ts`  
Expected: PASS with all cleanup assertions.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/external-integration/magicerp.client.ts apps/api/src/modules/external-integration/magicerp.client.test.ts
git commit -m "feat: automate MagicERP monthly lookup"
```

### Task 3: Implement preview and approval APIs

**Files:**
- Create: `apps/api/src/modules/external-integration/magicerp.routes.ts`
- Modify: `apps/api/src/modules/external-integration/magicerp.routes.test.ts`, `apps/api/src/app.ts`

**Interfaces:** `POST /api/v1/external-integrations/magicerp/monthly/preview` accepts credentials/year/store and returns comparison rows plus a signed short-lived `previewToken`. `POST .../approve` accepts store/year/token/selected months and returns approved rows.

- [ ] **Step 1: Write failing route tests**

```ts
expect(body.data?.months[0]).toMatchObject({
  month: 1, pnpSalesAmount: 400000, salesAmount: 500000, hasConflict: true
});
expect(prisma.externalMonthlySale.update).toHaveBeenCalledWith(
  expect.objectContaining({ data: { status: "SUPERSEDED" } })
);
```

- [ ] **Step 2: Verify RED**

Run: `npm run test -w @pnp/api -- src/modules/external-integration/magicerp.routes.test.ts`  
Expected: FAIL because routes are absent.

- [ ] **Step 3: Implement routes**

Validate nonempty credentials, year 2000–2100, and months 1–12. Derive PNP monthly totals with exactly the sales-analysis POS/channel algorithm. Sign `{ storeId, year, months }` with `SESSION_SECRET` for 10 minutes; reject changed/expired data with `409 EXTERNAL_MONTHLY_PREVIEW_STALE`. In one transaction, re-read current rows, mark previous as `SUPERSEDED`, create new `APPROVED` records, and set prior `supersededById`. Register under `/api/v1/external-integrations/magicerp`. Response/error types must contain no username/password.

- [ ] **Step 4: Verify GREEN**

Run: `npm run test -w @pnp/api -- src/modules/external-integration/magicerp.routes.test.ts`  
Expected: PASS, including credential non-disclosure assertions.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/external-integration/magicerp.routes.ts apps/api/src/modules/external-integration/magicerp.routes.test.ts apps/api/src/app.ts
git commit -m "feat: add MagicERP preview and approval APIs"
```

### Task 4: Overlay approved values in sales analysis

**Files:**
- Modify: `apps/api/src/modules/sales-analysis/sales-analysis.routes.ts`, `apps/api/src/modules/sales-analysis/sales-analysis.routes.test.ts`

**Interfaces:** monthly summary adds `pnpSales, pnpCount, externalSales, externalCount, externalStoreName, source: "PNP" | "MAGICERP" | "NONE", hasConflict`; `sales`/`count` hold the selected source.

- [ ] **Step 1: Write a failing no-double-count test**

```ts
expect(body.data?.monthly.find((item) => item.month === "2026-01")).toMatchObject({
  sales: 500000, count: 50, pnpSales: 150000, externalSales: 500000,
  source: "MAGICERP", hasConflict: true
});
expect(body.data?.totalSales).toBe(700000);
```

- [ ] **Step 2: Verify RED**

Run: `npm run test -w @pnp/api -- src/modules/sales-analysis/sales-analysis.routes.test.ts`  
Expected: FAIL because external values are absent.

- [ ] **Step 3: Implement source selection**

Fetch approved MagicERP rows for the selected year. Preserve PNP calculation in `pnpSales`/`pnpCount`; overlay one approved external value per month into displayed `sales`/`count`. Recalculate totals, ticket, target progress, deltas, and max values from selected months. Keep existing daily/channel/product output PNP-only.

- [ ] **Step 4: Verify GREEN**

Run: `npm run test -w @pnp/api -- src/modules/sales-analysis/sales-analysis.routes.test.ts && npm run typecheck -w @pnp/api`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/sales-analysis/sales-analysis.routes.ts apps/api/src/modules/sales-analysis/sales-analysis.routes.test.ts
git commit -m "feat: show approved external sales in analysis"
```

### Task 5: Add accessible external-integration UI

**Files:**
- Create: `apps/web/src/modules/admin/MagicErpIntegrationPanel.tsx`, `apps/web/src/modules/admin/MagicErpIntegrationPanel.test.tsx`
- Modify: `apps/web/src/modules/admin/ManagementPage.tsx`

- [ ] **Step 1: Write failing UI tests**

```tsx
expect(screen.getByText("중복 가능: PNP 일일 기록 400,000원과 차이 100,000원")).toBeInTheDocument();
fireEvent.click(screen.getByRole("button", { name: "승인 후 반영" }));
expect(await screen.findByRole("dialog", { name: "외부 매출 반영 확인" })).toBeInTheDocument();
```

Also cover required fields, disabled loading button, password clearing in `finally`, and selected-month-only approval payload.

- [ ] **Step 2: Verify RED**

Run: `npm run test -w @pnp/web -- src/modules/admin/MagicErpIntegrationPanel.test.tsx`  
Expected: FAIL because panel is absent.

- [ ] **Step 3: Implement panel and tab**

Add `external-integration` to `AdminTab` and `adminTabs`, render a focused panel branch. Use labelled ID/password/year/store controls, password show/hide aria label, `aria-live="polite"` loading/errors, 44px+ actions, keyboard checkboxes, and text plus color collision badges. Use existing `useConfirm` before approval, then clear preview/password and show success.

- [ ] **Step 4: Verify GREEN**

Run: `npm run test -w @pnp/web -- src/modules/admin/MagicErpIntegrationPanel.test.tsx && npm run typecheck -w @pnp/web`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/modules/admin/MagicErpIntegrationPanel.tsx apps/web/src/modules/admin/MagicErpIntegrationPanel.test.tsx apps/web/src/modules/admin/ManagementPage.tsx
git commit -m "feat: add MagicERP management integration tab"
```

### Task 6: Verify deployment, security, and operations

**Files:**
- Modify: `.env.example`, `README.md`, `docs/web-page-guide.md`

- [ ] **Step 1: Run full automated checks**

Run: `npm test && npm run typecheck && npm run lint`  
Expected: PASS.

- [ ] **Step 2: Confirm server port**

Run: `docker compose up --build -d` and `curl -fsS http://127.0.0.1:5173/ >/dev/null`.  
Expected: existing or started web service responds on `5173`; never substitute another port.

- [ ] **Step 3: Execute end-to-end acceptance**

At `https://localhost:5173/staff`, enter credentials manually, preview an ERP store/year, inspect conflicts, approve one selected month, and confirm only that analysis month changes. Confirm the password field, API response, browser console, and API logs contain no credential.

- [ ] **Step 4: Document and commit**

Document Chromium container dependency, UI-only credential rule, preview/approval semantics, and recovery steps for MagicERP DOM/login failures—never secret values.

```bash
git add .env.example README.md docs/web-page-guide.md
git commit -m "docs: document MagicERP integration operations"
```

## Plan self-review

- Coverage: Tasks 1–3 implement storage, automation, preview, collision checks, and approval; Task 4 prevents double counting; Task 5 is the requested accessible UI; Task 6 covers port 5173, security, deployment, and acceptance.
- No placeholders: each task has exact files, test-first behavior, RED/GREEN command, implementation boundary, and commit.
- Types flow consistently: client → preview token → approval persistence → analysis overlay → management panel.
