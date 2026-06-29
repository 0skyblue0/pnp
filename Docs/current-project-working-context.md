# Current Project Working Context

- Recorded at: 2026-06-28 11:21:53 KST
- Project root: `/home/pnp`
- Git branch: `master`
- Baseline commit in docs: `ea8eba70f52a27ebe4542b3cb7260e868404bf70`
- Current purpose: 폴앤폴리나 운영 관리 시스템 (`pnp-ops`)

## Repository Shape

This is an npm workspace TypeScript monorepo.

- Root workspace package: `package.json`
- Workspaces:
  - `packages/shared`: shared Zod/domain/API envelope contracts
  - `apps/api`: Node.js 20 + Fastify + Prisma API
  - `apps/web`: React + Vite + TypeScript + Tailwind SPA
- Runtime/infra:
  - `docker-compose.yml`: API and web development services
  - `docker/node-dev.Dockerfile`: Node development image
  - `infra/`: Caddy, systemd, backup skeletons
- Documentation:
  - `README.md`: project overview and commands
  - `docs/`: final design, agent governance, ADRs, review checklists, runbooks
  - `Docs/system-refactor/`: baseline, analysis, test/refactor plans, change log, Playwright cases

## Important Local Rules

- Web development server port is always `5173`.
- Do not switch to a different web port. If `5173` is occupied, reuse the existing server or diagnose the conflict.
- API host port in Docker Compose is `3001`, mapped to container port `3000`.
- PostgreSQL is host-provided, not containerized. Compose defaults to `host.docker.internal:5432` with database `pnp` and schema `pnp`.
- Avoid printing secrets or full database URLs. Use placeholders for passwords.

## Main Entrypoints

- API runtime: `apps/api/src/index.ts`
- API composition: `apps/api/src/app.ts`
- API health route: `GET /healthz`
- API prefixes registered in `apps/api/src/app.ts`:
  - `/api/v1/auth`
  - `/api/v1`
  - `/api/v1/production-lot`
  - `/api/v1/reservation`
  - `/api/v1/response`
  - `/api/v1/notification`
- API database schema: `apps/api/prisma/schema.prisma`
- Web runtime: `apps/web/src/main.tsx`
- Web routing: `apps/web/src/app/App.tsx`
- Web shell/layout: `apps/web/src/app/layouts/AppLayout.tsx`
- Shared exports: `packages/shared/src/index.ts`

## Current Web Routes

Defined in `apps/web/src/app/App.tsx`:

- `/home`
- `/operation`
- `/response`
- `/response/new`
- `/statistics` redirects to `/response?tab=stats`
- `/reservation`
- `/daily-log/today`
- `/staff`
- `/notification`
- fallback redirects to `/home`

## Scripts And Verification Commands

Root scripts:

- `npm run typecheck`
- `npm run lint`
- `npm test` or `npm run test`
- `npm run build`
- `npm run format:check`
- `npm run format`

Workspace-specific scripts:

- API: `npm run dev -w @pnp/api`, `npm run prisma:generate -w @pnp/api`, `npm run prisma:migrate:deploy -w @pnp/api`
- Web: `npm run dev -w @pnp/web`, `npm run test:e2e -w @pnp/web`
- Shared: `npm run build -w @pnp/shared`

Docker development:

- `docker compose up --build`
- Web: `http://localhost:5173`
- API: `http://localhost:3001`

## Dependency Snapshot

Root dev tooling:

- TypeScript 5.8
- ESLint 9
- Prettier 3
- Vitest 3

API dependencies:

- Fastify 5
- Prisma 6
- Zod 3
- bcryptjs
- `@fastify/cookie`
- `@fastify/cors`
- `@pnp/shared`

Web dependencies:

- React 18
- Vite 6
- React Router 7
- TanStack React Query 5
- React Hook Form
- Zod
- Zustand
- Tailwind CSS
- Playwright
- Testing Library

Shared dependencies:

- Zod

## Code Size Snapshot

Generated from local scan excluding `.git`, `node_modules`, `dist`, `build`, `coverage`, `test-results`, `.vite`, and `.cache`.

- Files scanned: 141
- Text lines: 22,965
- Tracked files according to git: 114
- Largest extensions by line count:
  - `.json`: 13 files, 9,009 lines
  - `.tsx`: 18 files, 5,696 lines
  - `.ts`: 50 files, 4,070 lines
  - `.md`: 29 files, 3,072 lines
  - `.sql`: 4 files, 249 lines
  - `.yml`: 5 files, 248 lines
  - `.prisma`: 1 file, 232 lines

`pygount` was not installed in this environment, so the size snapshot used a local Node.js line-count script instead of the preferred pygount summary.

## Current Git Working Tree

The working tree is dirty and appears to contain active system-refactor work.

Tracked changes summary from `git diff --stat`:

- 25 tracked files changed
- 1,644 insertions
- 1,744 deletions
- Notable deletions:
  - `apps/web/src/modules/admin/AdminPage.tsx`
  - `apps/web/src/modules/admin/StaffPage.tsx`
- Notable active areas:
  - API Prisma schema and route modules
  - Admin, daily-log, reservation, response, production-lot modules
  - Web app routing/layout and major pages
  - Shared domain contracts
  - E2E tests

Untracked project files/directories currently include:

- `AGENTS.md`
- `agents.md`
- `Docs/system-refactor/*.md`
- `apps/api/prisma/migrations/0004_response_criteria/migration.sql`
- `apps/api/src/common/datetime.ts` and test
- `apps/api/src/modules/product/product-resolver.ts`
- new API route tests for admin/daily-log/response
- `apps/web/src/modules/operation/`
- `apps/web/src/modules/statistics/`
- `apps/web/src/modules/response/ResponseInquiryPage.tsx`
- `apps/web/src/modules/response/responseCriteria.ts`
- `apps/web/src/shared/api/types.ts`
- `apps/web/src/shared/time/`
- `apps/web/tests/e2e/ui-interactions.spec.ts`

Treat all existing modifications as user/work-in-progress unless explicitly instructed otherwise. Do not reset, overwrite, commit, or clean them without confirmation.

## Existing Refactor Documentation

Useful prior context:

- `Docs/system-refactor/00-baseline-state.md`: original baseline, commands, risks, smoke checks
- `Docs/system-refactor/01-system-analysis.md`: system analysis
- `Docs/system-refactor/02-test-plan.md`: test plan
- `Docs/system-refactor/03-refactor-plan.md`: refactor plan
- `Docs/system-refactor/04-agent-reviews.md`: agent reviews
- `Docs/system-refactor/05-change-log.md`: completed cycles and final verification from prior refactor work
- `Docs/system-refactor/06-playwright-ui-test-cases.md`: UI/E2E test cases

## Working Guidance For Future Changes

1. Start with `git status --short` because this tree is actively modified.
2. Read nearby files before editing; do not infer route/schema/component shape.
3. Use patch-based edits for existing files and `write_file` only for new files or full rewrites.
4. Run targeted tests first, then root verification when scope justifies it:
   - API route/schema changes: API vitest plus `npm run typecheck`
   - Web page/routing changes: web vitest, Playwright when UI behavior changes, plus typecheck
   - Shared contract changes: shared tests and all workspace typecheck
5. Preserve current public API envelope and route paths unless the user asks for a breaking change.
6. Preserve Docker/web ports: web `5173`, API host `3001`.
