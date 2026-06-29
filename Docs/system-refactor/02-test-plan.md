# 02. Test Plan

## Test Strategy Agent

The refactor must preserve current behavior. The test strategy is to run the same baseline suite before and after each refactor cycle, and to add characterization tests for extracted helpers before relying on them.

## Baseline Commands

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`
- `npm run format:check`
- `docker compose ps`
- `curl http://localhost:3001/healthz`
- `curl http://localhost:3001/api/v1/product`
- `curl http://localhost:3001/api/v1/production-lot`
- `curl -I http://localhost:5173/`

## Baseline Results

| Command                  | Result                         |
| ------------------------ | ------------------------------ |
| `npm run typecheck`      | Passed                         |
| `npm run lint`           | Passed                         |
| `npm test`               | Passed: shared 3, api 4, web 1 |
| `npm run build`          | Passed                         |
| `npm run format:check`   | Passed                         |
| `docker compose ps`      | API and web healthy            |
| API health smoke         | Passed                         |
| Product API smoke        | Passed                         |
| Production lot API smoke | Passed                         |
| Web HTTP smoke           | Passed                         |

## Current Automated Tests

- `packages/shared/src/envelope.test.ts`
  - envelope success/failure shape
  - pagination query defaults
- `apps/api/tests/health.test.ts`
  - Fastify health endpoint envelope
- `apps/api/src/modules/reservation/inventory-calculator.test.ts`
  - reservation pressure arithmetic
- `apps/api/src/modules/llm/pii-masker.test.ts`
  - basic PII masking
- `apps/api/src/common/datetime.test.ts`
  - date-only UTC semantics
  - KST datetime-local semantics
  - exclusive store-date range end
  - time-only helper shape
- `apps/web/src/app/App.test.tsx`
  - renders the home screen and response entry navigation with mocked fetch
- `apps/web/src/shared/time/storeTime.test.ts`
  - KST store date
  - datetime-local shape
  - layout date label shape
- `apps/web/tests/e2e/home.spec.ts`
  - Playwright smoke exists but is not part of `npm test`

## Characterization Tests To Add

1. API date/time helper tests
   - `YYYY-MM-DD` parses to UTC midnight, preserving current date-only semantics.
   - KST datetime-local input parses to the same UTC instant as current route-local helper behavior.
   - store date end is exclusive next-day KST midnight.
   - time-only parsing/formatting remains compatible with congestion logs.

2. Web store-time helper tests
   - KST date label generation remains deterministic for a fixed Date.
   - datetime-local formatting remains `YYYY-MM-DDTHH:mm`.

3. Shared API type extraction compile coverage
   - `ListEnvelope<T>` extraction is verified through TypeScript and existing page tests.

4. Dead-code removal safety
   - `rg` import search must show `AdminPage` and `StaffPage` are not imported before deletion.

## Smoke Tests

Run after each cycle when Docker is available:

- `docker compose ps`
- `curl http://localhost:3001/healthz`
- `curl http://localhost:3001/api/v1/production-lot`
- `curl -I http://localhost:5173/`

## Regression Areas

- CSRF write path: `apiPost`, `apiPatch`, `apiDelete`.
- Product auto-create when writing reservation, stockout/tasting, production lot.
- KST date filtering for today, daily log, reservations, production lot.
- Response entry/list date filters.
- Product/staff management CRUD contract.

## Manual Verification Needed

- Visual layout of large pages after helper extraction because jsdom tests do not inspect actual browser layout.
- Creating a staff member with blank display name and valid password.
- Creating a production lot from home.
- Creating a customer response and confirming it appears in response list.
- Reservation form at narrow tablet width.

## Commands For Final Verification

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`
- `npm run format:check`
- `docker compose up --build -d`
- `docker compose ps`
- smoke curl checks listed above

## Final Verification Results

| Command                        | Result                                                    |
| ------------------------------ | --------------------------------------------------------- |
| `npm run typecheck`            | Passed                                                    |
| `npm run lint`                 | Passed                                                    |
| `npm test`                     | Passed: shared 3, api 8, web 4                            |
| `npm run build`                | Passed                                                    |
| `npm run format:check`         | Initially failed on two new docs; passed after formatting |
| `docker compose up --build -d` | Passed                                                    |
| `docker compose ps`            | API and web healthy                                       |
| API health smoke               | Passed                                                    |
| Product API smoke              | Passed                                                    |
| Production lot API smoke       | Passed                                                    |
| Web HTTP smoke                 | Passed                                                    |
