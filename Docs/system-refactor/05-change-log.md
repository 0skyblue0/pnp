# 05. Change Log

## Baseline

- Baseline commit: `ea8eba70f52a27ebe4542b3cb7260e868404bf70`
- Baseline verification:
  - `npm run typecheck`: passed
  - `npm run lint`: passed
  - `npm test`: passed
  - `npm run build`: passed
  - `npm run format:check`: passed
  - Docker API/Web: healthy

## Cycle 1

- Changed files:
  - Added `apps/web/src/shared/api/types.ts`
  - Updated active web pages to import `ListEnvelope`
  - Deleted unreachable `apps/web/src/modules/admin/AdminPage.tsx`
  - Deleted unreachable `apps/web/src/modules/admin/StaffPage.tsx`
- Reason:
  - Remove legacy UI code not reachable from router.
  - Reduce duplicated list-envelope type definitions.
- Behavior preservation:
  - Active `/staff` route still renders `ManagementPage`.
  - Type extraction has no runtime effect.
- Verification:
  - `npx prettier --write ...`: passed
  - `npm run typecheck`: passed
  - `npm run lint`: passed
  - `npm test`: passed

## Cycle 2

- Changed files:
  - Added `apps/web/src/shared/time/storeTime.ts`
  - Added `apps/web/src/shared/time/storeTime.test.ts`
  - Updated `AppLayout`, `HomePage`, `ReservationPage`, `DailyLogPage`, `ResponseEntryPage`, `ResponseListPage`
- Reason:
  - Remove duplicated store-date helper logic from page components.
  - Make KST date formatting testable.
- Behavior preservation:
  - Default calls still use current runtime date.
  - Date strings remain `YYYY-MM-DD`.
  - Datetime-local strings remain `YYYY-MM-DDTHH:mm`.
  - Header label remains `YYYY-MM-DD 요일`.
- Verification:
  - `npx prettier --write ...`: passed
  - `npm run typecheck`: passed
  - `npm run lint`: passed
  - `npm test`: passed, including new store-time tests

## Cycle 3

- Changed files:
  - Added `apps/api/src/common/datetime.ts`
  - Added `apps/api/src/common/datetime.test.ts`
  - Added `apps/api/src/modules/product/product-resolver.ts`
  - Updated API route modules that previously had duplicated date or product resolution helpers
- Reason:
  - Centralize duplicated KST/UTC date conversion rules.
  - Centralize product id/name lookup and auto-create behavior.
  - Make current behavior explicit through characterization tests.
- Behavior preservation:
  - No API paths, payloads, DTOs, DB schema, migration, or env keys changed.
  - Date-only values still parse as UTC midnight.
  - Store datetime-local values still parse as Asia/Seoul.
  - Product resolver still throws `PRODUCT_NOT_FOUND` and `PRODUCT_REQUIRED` with the same semantics.
- Verification:
  - `npx prettier --write ...`: passed
  - First `npm run typecheck`: failed on resolver optional-property type compatibility
  - Fixed resolver input type without runtime behavior change
  - `npm run typecheck`: passed
  - `npm run lint`: passed
  - `npm test`: passed, including new API datetime tests

## Final Verification

- `npm run typecheck`: passed
- `npm run lint`: passed
- `npm test`: passed
  - shared: 3 tests
  - api: 8 tests
  - web: 4 tests
- `npm run build`: passed
- `npm run format:check`: passed after formatting two new docs
- `docker compose up --build -d`: passed
- `docker compose ps`: `pnp-api-1` healthy, `pnp-web-1` healthy
- Smoke:
  - `GET /healthz`: passed
  - `GET /api/v1/product`: passed
  - `GET /api/v1/production-lot`: passed
  - `GET /` on web: HTTP 200

## Preserved Interfaces

- API paths and methods unchanged.
- API response envelope unchanged.
- Prisma schema and migrations unchanged.
- Environment variable keys unchanged.
- Docker services and ports unchanged.
- PostgreSQL remains local/host-provided, not containerized.
- Web route paths unchanged.

## Remaining Issues

- Large web pages remain component-heavy. Further decomposition should be covered by page-level UI tests before implementation.
- API route integration tests still do not cover real PostgreSQL write flows.
- React Query is available but not broadly used; changing that is deferred because it may affect loading and caching behavior.
- Delivery-era migration artifacts remain in DB history, but app-level delivery functionality remains removed. Any DB cleanup should be a separate migration plan.
