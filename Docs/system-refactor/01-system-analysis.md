# 01. System Analysis

## System Analyst Agent

### Architecture

The repository is a TypeScript npm workspace with three packages:

- `packages/shared`: shared API envelope helpers and domain enums/schemas.
- `apps/api`: Fastify API, Prisma persistence, Zod request validation.
- `apps/web`: React/Vite SPA, feature pages, shared API client and UI controls.

The dependency direction is:

```text
apps/api ─┐
          ├──> packages/shared
apps/web ─┘
```

No package should import from an application sibling. The API owns persistence. The web app talks to the API through `apps/web/src/shared/api/client.ts`.

### Entrypoints And Control Flow

- `apps/api/src/index.ts`
  - Loads env config.
  - Builds Fastify app.
  - Starts listening on `HOST`/`PORT`.
- `apps/api/src/app.ts`
  - Installs CORS, cookie handling, CSRF protection, Prisma.
  - Registers route modules under `/api/v1`.
  - Standardizes Zod and `HttpError` handling into the shared envelope.
- `apps/web/src/main.tsx`
  - Mounts React.
  - Installs `AppProviders`.
  - Registers service worker in production.
- `apps/web/src/app/App.tsx`
  - Defines SPA routes and redirects.
- `docker-compose.yml`
  - Runs `api` and `web`.
  - Runs Prisma generate and migrate deploy before API dev server.
  - Uses host PostgreSQL, not a DB container.

## Module Roles

### API Modules

- `common/http.ts`: `HttpError`, `sendOk`, `sendError`, shared envelope response boundary.
- `common/security/csrf.ts`: double-submit CSRF cookie/header validation for unsafe HTTP methods.
- `config.ts`: environment schema and production session-secret guard.
- `infra/db/prisma.ts`: Fastify Prisma decorator and disconnect lifecycle hook.
- `modules/auth`: CSRF token, bootstrap login, logout, current user.
- `modules/admin`: product and staff CRUD.
- `modules/daily-log`: daily log creation, congestion, tasting, stockout, absent inquiry.
- `modules/production-lot`: production quantity create/list.
- `modules/reservation`: reservation create/list/status/availability.
- `modules/response`: customer response create/list/update/delete and tags.
- `modules/notification`: notification create/list/read/read-all.
- `modules/llm`: disabled LLM adapter and PII masker skeleton.

### Web Modules

- `app/layouts/AppLayout.tsx`: navigation shell and date header.
- `modules/home`: operational dashboard, production input, inventory summary, reservation summary, notifications.
- `modules/response`: customer response entry and query pages.
- `modules/reservation`: reservation entry and status management.
- `modules/daily-log`: daily operation logs, stockout, tasting, absent inquiry.
- `modules/notification`: notification center.
- `modules/admin/ManagementPage.tsx`: active product/staff management page.
- `modules/admin/AdminPage.tsx`, `StaffPage.tsx`: legacy pages not routed.
- `shared/api/client.ts`: fetch wrapper with CSRF-aware write calls.
- `shared/ui`: Button and segmented controls.

### Shared Package

- `domain.ts`: response categories, tags, notification enums and Zod schemas.
- `envelope.ts`: API success/failure envelope and pagination query schema.

## Data Flow Agent

### Request/Response Contract

All API responses use:

```ts
{ data: T, error: null } | { data: null, error: { code, message, details? } }
```

This envelope is public and must not change during refactoring.

### Write Request Flow

```text
Web form
  -> apiPost/apiPatch/apiDelete
  -> GET /api/v1/auth/csrf if no cached token
  -> write request with X-CSRF-Token
  -> Fastify CSRF hook
  -> route Zod parse
  -> Prisma write
  -> sendOk envelope
```

### Read Request Flow

```text
Web page useEffect/useCallback
  -> apiGet
  -> Fastify route
  -> route query Zod parse
  -> Prisma read
  -> DTO conversion
  -> sendOk envelope
```

### Persistence Flow

- Prisma schema maps TypeScript models to PostgreSQL snake_case tables.
- Migrations:
  - `0001_phase_1_mvp`: initial MVP tables.
  - `0002_reservation_delivery`: reservation and delivery-era tables.
  - `0003_production_lot`: production lot table.
- Current application intentionally does not expose delivery functionality.
- `DATABASE_URL` and schema selection are public deployment contracts.

### Domain Data Flows

- Product/staff:
  - `ManagementPage` -> `/product`, `/staff` -> `product`, `staff`.
- Production:
  - `HomePage` -> `/production-lot` -> `production_lot`, resolving or creating `product`.
- Home inventory:
  - Fetches active products, reservations for selected date, production lots for selected date, notifications.
  - Computes display-only availability as produced quantity minus non-canceled/non-no-show reserved quantity.
- Reservation:
  - Reservation page posts contact ref and item list.
  - API hashes contact ref into `contact_token`.
  - Product may be resolved by id or created by name.
- Daily log:
  - Daily log page creates/get-or-creates `daily_log`, and records congestion, tasting, stockout, absent inquiry.
- Customer response:
  - Entry page posts response content, tags, product links.
  - List page filters by date/category/boss flag.
- Notification:
  - Notifications are listed and marked read through `/notification`.

## Clean Code Architect Agent

### Structural Findings

- API date/time parsing and formatting are duplicated in admin, daily-log, production-lot, reservation, response routes.
- API product resolution by `productId` or `productName` is duplicated in daily-log, production-lot, and reservation.
- Web `ListEnvelope<T>` and KST date helpers are duplicated across many pages.
- Page components are large and mix DTO types, formatting, API orchestration, form state, and rendering.
- Active management route uses `ManagementPage`; legacy `AdminPage` and `StaffPage` are unreachable.
- React Query is installed and provided, but pages mostly use manual `useEffect` state. This is not changed in this refactor because it would alter data-loading behavior and risk UX regressions.

## External Dependencies

- PostgreSQL through Prisma.
- Browser fetch API.
- Docker Compose for API/web runtime.
- Caddy/systemd/backup scripts for deployment support.
- No current external third-party business API is called by app code.

## Public Interfaces And Change-Protected Areas

Do not change during this refactor:

- API paths, HTTP methods, request/response JSON shape.
- Shared API envelope.
- Prisma schema and existing migration semantics.
- Environment variable keys and meanings.
- Docker service names, exposed ports, and PostgreSQL host usage.
- Auth, CSRF, bootstrap credential flow.
- Web route paths and navigation semantics.
- Existing business rules:
  - reservation contact hashing,
  - product auto-create by name in relevant write flows,
  - KST store-date handling,
  - notification envelope and severity semantics.

## Review Agent Notes

- Low-risk refactors can proceed if they only move duplicated helpers and update imports.
- Deleting unused web pages is allowed only after import search proves they are unreachable.
- Large page decomposition is useful but must be incremental and covered by tests; avoid UI restructuring in this pass.
- Any DB schema change is out of scope for this refactor.
