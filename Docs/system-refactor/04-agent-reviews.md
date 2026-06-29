# 04. Agent Reviews

## Review Protocol

Each change must pass this gate before implementation:

1. Clean Code Architect Agent proposes the change.
2. Data Flow Agent checks semantic/data-flow preservation.
3. Review Agent checks scope, risk, and testability.
4. Refactoring Agent implements only approved changes.
5. Review Agent records post-change results.

## Cycle 1 Approval

### Proposal

- Delete legacy `apps/web/src/modules/admin/AdminPage.tsx` and `StaffPage.tsx`.
- Extract duplicated web `ListEnvelope<T>` type to `apps/web/src/shared/api/types.ts`.
- Update active pages to import the shared type.

### Data Flow Review

- `AdminPage` and `StaffPage` are not imported by `App.tsx` or any source file.
- Active management route remains `/staff -> ManagementPage`.
- `ListEnvelope<T>` is compile-time only and does not change runtime JSON.
- API request/response contracts remain unchanged.

### Review Decision

- Approved.
- Required validation: `rg` import search, typecheck, lint, tests.

## Cycle 2 Approval

### Proposal

- Extract web KST date/datetime formatting helpers to `apps/web/src/shared/time/storeTime.ts`.
- Replace duplicated `todayInStoreTime`, `currentStoreDateTime`, and layout date-label helpers.
- Add deterministic helper tests.

### Data Flow Review

- Existing default calls continue to use current `new Date()`.
- Optional Date parameter is only for testing and does not affect public UI behavior.
- Date strings remain `YYYY-MM-DD`; datetime-local strings remain `YYYY-MM-DDTHH:mm`.

### Review Decision

- Approved.
- Required validation: helper tests, web test, typecheck, lint.

## Cycle 3 Approval

### Proposal

- Extract API date/time helpers to `apps/api/src/common/datetime.ts`.
- Extract product id/name resolver to `apps/api/src/modules/product/product-resolver.ts`.
- Update route modules to use helpers.
- Add characterization tests for date/time helper behavior.

### Data Flow Review

- Date-only parsing must remain UTC midnight.
- KST datetime-local parsing must remain compatible with prior route-local helper behavior.
- Store date range end remains exclusive next-day KST midnight.
- Product resolver must preserve:
  - `productId` lookup by id,
  - `PRODUCT_NOT_FOUND` for invalid id,
  - `PRODUCT_REQUIRED` for missing id/name,
  - reuse first product by exact name,
  - auto-create active product by name.

### Review Decision

- Approved with constraint: do not change Prisma schema, route paths, DTO fields, or error codes.
- Required validation: API helper tests, full typecheck/lint/test/build, Docker smoke.

## Post-Change Reviews

### Cycle 1 Result

- Refactoring Agent changes:
  - Removed unreachable `AdminPage.tsx` and `StaffPage.tsx`.
  - Added `apps/web/src/shared/api/types.ts`.
  - Updated active web pages to import `ListEnvelope`.
- Data Flow Agent review:
  - Runtime API calls and response parsing are unchanged.
  - `/staff` still routes to `ManagementPage`.
  - No DB, env, route path, or public response changes.
- Review Agent result:
  - Approved after implementation.
  - `rg "type ListEnvelope" apps/web/src` shows the type is now defined only once.
  - `npm run typecheck`, `npm run lint`, and `npm test` passed.

### Cycle 2 Result

- Refactoring Agent changes:
  - Added `apps/web/src/shared/time/storeTime.ts`.
  - Added `apps/web/src/shared/time/storeTime.test.ts`.
  - Updated home, reservation, daily log, response entry/list, and app layout to use shared store-time helpers.
- Data Flow Agent review:
  - The helper keeps default behavior based on current time.
  - Tests characterize KST date, datetime-local, and Korean label formatting with a fixed Date.
  - No API requests, route paths, or payload shapes changed.
- Review Agent result:
  - Approved after implementation.
  - `npm run typecheck`, `npm run lint`, and `npm test` passed.

### Cycle 3 Result

- Refactoring Agent changes:
  - Added `apps/api/src/common/datetime.ts`.
  - Added `apps/api/src/common/datetime.test.ts`.
  - Added `apps/api/src/modules/product/product-resolver.ts`.
  - Updated admin, daily-log, production-lot, reservation, and response route modules to use shared helpers.
- Data Flow Agent review:
  - Date-only behavior remains UTC midnight.
  - Datetime-local behavior remains interpreted as Asia/Seoul.
  - Store date end remains exclusive next-day KST midnight.
  - Product resolver behavior and error codes are preserved.
  - Prisma schema and migrations were not changed.
- Review Agent result:
  - Initial typecheck caught an `exactOptionalPropertyTypes` mismatch in the resolver input type.
  - Resolver input type was widened to match Zod-inferred optional fields.
  - `npm run typecheck`, `npm run lint`, and `npm test` passed after the fix.

## Final Review

### Data Flow Agent

- API route paths and methods are unchanged.
- API request/response envelope is unchanged.
- Prisma schema and migrations are unchanged.
- Environment variable keys and Docker service names are unchanged.
- Product auto-create data flow is centralized but semantically unchanged.
- KST date behavior is now characterized by tests and reused through helpers.

### Review Agent

- Three approved cycles were implemented.
- Large UI decomposition and React Query migration were intentionally deferred because they can alter loading behavior and require broader UI regression coverage.
- Legacy admin page deletion is accepted because `rg` showed no imports and `/staff` continues to route to `ManagementPage`.
- Final verification passed:
  - typecheck,
  - lint,
  - tests,
  - build,
  - format check,
  - Docker build/start,
  - API/web smoke checks.
