# Daily Operation Excel Identical Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render parsed Excel daily-operation records in the exact same summary and detail structure used by the existing `조회된 일지` results before any database write.

**Architecture:** Extract the reusable read-only record-card list from `DailyLookupSection` into `DailyRecordResults`. The lookup retains its filters, comparisons, edit, and delete controls; the import panel converts preview rows to the shared record type and renders the same cards with per-date validation acknowledgement controls and no mutation controls.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Vitest, Testing Library.

## Global Constraints

- The development server remains on port `5173`.
- Existing lookup filters, comparison cards, edit, and delete behavior remain unchanged.
- Preview uses no database mutation and no edit/delete controls.
- A validation warning must include text and values, not color alone.
- The reusable card layout must retain responsive single/two-column behavior without horizontal page scrolling.

---

### Task 1: Extract reusable daily-record result cards

**Files:**
- Create: `apps/web/src/modules/daily-log/DailyRecordResults.tsx`
- Modify: `apps/web/src/modules/daily-log/DailyLogPage.tsx`
- Test: `apps/web/src/modules/daily-log/DailyRecordResults.test.tsx`

**Interfaces:**
- Produces `DailyRecordResults({ records, title, readOnly, warningByDate, acknowledgedDates, onAcknowledgementChange, onEditRecord, onDeleteRecord })`.
- Consumes `DailyOperationSavedRecord` and existing product/sales formatting helpers moved with the component.

- [ ] **Step 1: Write a failing shared-card test**

```tsx
render(<DailyRecordResults records={[record]} title="엑셀 미리보기 일지" readOnly />);
expect(screen.getByRole("heading", { name: "엑셀 미리보기 일지" })).toBeInTheDocument();
expect(screen.getByRole("button", { name: "상세" })).toBeInTheDocument();
expect(screen.queryByRole("button", { name: "수정" })).not.toBeInTheDocument();
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm test -w @pnp/web -- DailyRecordResults.test.tsx`

Expected: module-not-found failure because the shared result component does not yet exist.

- [ ] **Step 3: Implement the shared card component**

Move the existing `조회된 일지` article markup and its detail/product state into `DailyRecordResults`. Preserve labels, `상세/접기`, product `요약/상세`, and responsive grid classes. Only render mutation buttons when `readOnly` is false.

- [ ] **Step 4: Replace the lookup card markup**

```tsx
<DailyRecordResults
  records={records}
  title="조회된 일지"
  readOnly={false}
  onEditRecord={onEditRecord}
  onDeleteRecord={onDeleteRecord}
/>
```

- [ ] **Step 5: Re-run the shared-card test and lookup UI test**

Run: `npm test -w @pnp/web -- DailyRecordResults.test.tsx App.test.tsx`

Expected: exit code 0.

### Task 2: Render imported records through the shared structure

**Files:**
- Modify: `apps/web/src/modules/daily-log/DailyOperationExcelImportPanel.tsx`
- Modify: `apps/web/src/modules/daily-log/DailyOperationExcelImportPanel.test.tsx`

**Interfaces:**
- Consumes preview records with draft/product/channel/staff data from the API.
- Produces an `엑셀 미리보기 일지` shared result list and sends selected warning dates as `acknowledgedDates`.

- [ ] **Step 1: Write a failing import-panel test**

```tsx
expect(await screen.findByRole("heading", { name: "엑셀 미리보기 일지" })).toBeInTheDocument();
fireEvent.click(screen.getByRole("button", { name: "상세" }));
expect(screen.getByRole("group", { name: "기본·점검" })).toBeInTheDocument();
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm test -w @pnp/web -- DailyOperationExcelImportPanel.test.tsx`

Expected: failure because the panel currently renders only compact preview cards.

- [ ] **Step 3: Implement preview conversion and shared rendering**

Expand the preview response type to include `draft`, `productRows`, `channelRows`, and `staffSpecialRows`; map each row to `DailyOperationSavedRecord`. Render the summary metrics and cards through `DailyRecordResults` in read-only mode. Pass warning mismatch data and the acknowledgement state through its props.

- [ ] **Step 4: Re-run the import-panel test**

Run: `npm test -w @pnp/web -- DailyOperationExcelImportPanel.test.tsx`

Expected: exit code 0.

### Task 3: Deliver full verification

**Files:**
- Modify only if a verification command identifies a defect in the files above.

- [ ] **Step 1: Run the complete test suite**

Run: `npm test`

Expected: exit code 0.

- [ ] **Step 2: Run static checks and production build**

Run: `npm run typecheck && npm run lint && npm run build`

Expected: exit code 0.
