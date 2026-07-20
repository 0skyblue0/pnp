# Daily Operation Excel Import Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Safely bulk-import monthly daily-operation workbooks while preserving structured fields, exposing actionable validation results, and keeping imported customer responses idempotent.

**Architecture:** Keep the existing workbook parser as the single source of parsing truth. Extend its parsed record with field-level validation details and structured staff/facility data; make the import route consume those results inside one transaction per upload, replacing only prior workbook-originated customer responses for each imported date. The browser preview will show per-date warnings and require explicit acknowledgement for records with validation errors.

**Tech Stack:** TypeScript, Fastify, Prisma/PostgreSQL, React, Vitest, SheetJS (`xlsx`).

## Global Constraints

- Development server port remains `5173`.
- The upload remains limited to `.xlsx`/`.xlsm` files of at most 20 MB.
- `사용법` and `결산` sheets are ignored; blank/non-calendar daily sheets are skipped.
- Existing non-imported customer responses must never be deleted.
- No database migration is required; `DailyOperationRecord` JSON fields remain the persistence format.

---

### Task 1: Make parser output complete structured data and diagnostics

**Files:**
- Modify: `apps/api/src/modules/daily-log/excel-import/daily-operation-excel-parser.ts`
- Modify: `apps/api/src/modules/daily-log/excel-import/daily-operation-excel-parser.test.ts`

**Interfaces:**
- Produces: `ParsedDailyOperationRecord.checks` with field-level mismatch details.
- Produces: `draft.facilityIssue`, `draft.cleaningWork`, and all `staffSpecialRows` categories parsed from the standard workbook rows.

- [ ] **Step 1: Write failing parser tests**

```ts
expect(record.draft.facilityIssue).toBe("냉장고 점검 필요");
expect(record.staffSpecialRows.today.vacation).toBe("지민");
expect(record.checks.productTotalsMatched).toBe(false);
expect(record.checks.mismatches).toContainEqual({ field: "soldQty", expected: 21, actual: 20 });
```

- [ ] **Step 2: Run the parser test file and verify it fails**

Run: `npm test -w @pnp/api -- daily-operation-excel-parser.test.ts`

Expected: failing assertions for missing structured parsing or mismatch diagnostics.

- [ ] **Step 3: Implement minimal parser changes**

```ts
type ImportCheckMismatch = { field: string; expected: number; actual: number };

function parseStaffSpecialRows(sheet: XLSX.WorkSheet): StaffSpecialRows {
  // Read C:I for rows 76 and 77, mapped to dayOff through etc.
}
```

Add a section splitter for facility and cleaning values, retain raw text, normalize aliases from a single map, and include sales/product/sold mismatch details.

- [ ] **Step 4: Re-run the parser test file and verify it passes**

Run: `npm test -w @pnp/api -- daily-operation-excel-parser.test.ts`

Expected: exit code 0.

### Task 2: Make apply idempotent and reject unacknowledged validation errors

**Files:**
- Modify: `apps/api/src/modules/daily-log/excel-import/daily-operation-import.routes.ts`
- Modify: `apps/api/src/modules/daily-log/excel-import/daily-operation-import.routes.test.ts`

**Interfaces:**
- Consumes: `acknowledgedDates?: string[]` in the apply request.
- Produces: one upserted `DailyOperationRecord` per accepted date and exactly one set of workbook-originated `CustomerResponse` rows per date.

- [ ] **Step 1: Write failing route tests**

```ts
expect(response.statusCode).toBe(409);
expect(body.error?.code).toBe("IMPORT_VALIDATION_ACK_REQUIRED");
expect(prisma.customerResponse.deleteMany).toHaveBeenCalledWith({
  where: { date: expect.any(Date), fullText: { startsWith: importedDailyServiceResponsePrefix } }
});
```

- [ ] **Step 2: Run the route test file and verify it fails**

Run: `npm test -w @pnp/api -- daily-operation-import.routes.test.ts`

Expected: failing assertions because apply currently creates responses without replacement or acknowledgement.

- [ ] **Step 3: Implement minimal route changes**

```ts
await app.prisma.$transaction(async (tx) => {
  await tx.dailyOperationRecord.upsert(/* parsed record */);
  await tx.customerResponse.deleteMany({ where: { date, fullText: { startsWith: importedPrefix } } });
  await tx.customerResponse.createMany({ data: selectedCandidates });
});
```

Reject only dates that have mismatches and were not supplied in `acknowledgedDates`; preserve all manually entered customer-response rows.

- [ ] **Step 4: Re-run the route test file and verify it passes**

Run: `npm test -w @pnp/api -- daily-operation-import.routes.test.ts`

Expected: exit code 0.

### Task 3: Surface validation and acknowledgement in the import panel

**Files:**
- Modify: `apps/web/src/modules/daily-log/DailyOperationExcelImportPanel.tsx`
- Modify: `apps/web/src/modules/daily-log/DailyLogPage.test.tsx` or the closest existing daily-log UI test file

**Interfaces:**
- Consumes: preview records with `checks` and `mismatches`.
- Sends: `acknowledgedDates` only for dates explicitly selected by the user.

- [ ] **Step 1: Write a failing UI test**

```tsx
expect(screen.getByText("검증 경고")).toBeInTheDocument();
expect(screen.getByRole("checkbox", { name: /2026-05-07/ })).not.toBeChecked();
```

- [ ] **Step 2: Run the UI test and verify it fails**

Run: `npm test -w @pnp/web -- DailyLogPage.test.tsx`

Expected: failure because the current preview only shows a warning count.

- [ ] **Step 3: Implement minimal UI changes**

```tsx
<label>
  <input type="checkbox" checked={acknowledgedDates.has(record.date)} />
  {record.date} 검증 경고를 확인하고 저장합니다.
</label>
```

Show all parsed dates, their totals, mismatch summary, and an acknowledgement control only for records with warnings.

- [ ] **Step 4: Re-run the UI test and verify it passes**

Run: `npm test -w @pnp/web -- DailyLogPage.test.tsx`

Expected: exit code 0.

### Task 4: Verify the complete import workflow

**Files:**
- Modify only if verification identifies a defect in the files above.

- [ ] **Step 1: Run targeted API and web tests**

Run: `npm test -w @pnp/api -- daily-operation-excel-parser.test.ts daily-operation-import.routes.test.ts && npm test -w @pnp/web -- DailyLogPage.test.tsx`

Expected: exit code 0.

- [ ] **Step 2: Run static checks**

Run: `npm run typecheck && npm run lint`

Expected: exit code 0.

- [ ] **Step 3: Run a no-write production-workbook parse**

Run: `npm run import:daily-operation -w @pnp/api -- --dry-run Docs/User_Send/일일업무보고서_5월.xlsx`

Expected: 31 parsed dates; two non-daily sheets skipped; validation warnings listed without database writes.
