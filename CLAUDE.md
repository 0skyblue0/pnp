# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

폴앤폴리나 (Paul & Paulina bakery) operations management system. Design docs and domain language are Korean. The authoritative design spec is `docs/FINAL_DESIGN.md`; agent workflow/governance rules are in `docs/AGENTS_MASTER.md` (ADRs go in `docs/decisions/`). The OpenAPI contract lives at `docs/api/openapi.yaml`. Note: `Docs/` (capitalized) holds user-provided business files, not developer documentation.

LLM features are intentionally disabled until Phase 4+ approval — `apps/api/src/modules/llm` is a skeleton (PII masker, Hermes adapter config) only.

## Commands

Requires Node.js >= 20.11. npm workspaces monorepo: `packages/shared`, `apps/api`, `apps/web`.

```bash
npm ci                      # install
npm run lint                # eslint, all workspaces
npm run typecheck           # tsc --noEmit, all workspaces
npm test                    # vitest run, all workspaces
npm run build               # all workspaces
npm run format              # prettier --write .
```

Scope to one workspace with `-w`, e.g. `npm test -w @pnp/api`. Run a single test file by passing it to vitest:

```bash
npm test -w @pnp/api -- src/common/datetime.test.ts
npm test -w @pnp/web -- src/modules/operation/OperationPage.test.tsx
```

Dev servers:

```bash
npm run dev -w @pnp/api     # builds @pnp/shared first, then tsx watch (port 3000)
npm run dev -w @pnp/web     # custom dev server on port 5173
npm run test:e2e -w @pnp/web  # Playwright (tests/e2e, tablet 1024x768 viewport, reuses a running 5173 server)
```

**The web dev server port is always 5173** (rule from AGENTS.md). Never switch to another port; if 5173 is busy, reuse the existing server or find the conflict.

Prisma (run in `apps/api`, needs `DATABASE_URL`):

```bash
npm run prisma:generate -w @pnp/api
npm run prisma:migrate:deploy -w @pnp/api
```

Docker: `docker compose up --build` — web on 5173 (HTTP+HTTPS, self-signed cert), API on host port 3001 (3000 in-network), PostgreSQL is the **host-installed** database reached via `host.docker.internal:5432`.

## Architecture

Three workspaces share one request/response contract:

- **`packages/shared` (`@pnp/shared`)** — Zod schemas, domain constants, and the API envelope. Every API response is `{ data, error: null }` or `{ data: null, error: { code, message, details? } }` (`ok()`/`fail()` in `envelope.ts`), plus pagination helpers. The API imports the built `dist/` (its dev script builds shared first); the web app bypasses the build via a Vite alias straight to `packages/shared/src/index.ts`.

- **`apps/api`** — Fastify 5 + Prisma (PostgreSQL). `src/app.ts` `buildServer()` assembles everything: env config (Zod-validated in `src/config.ts`), a global error handler mapping `HttpError` → envelope error and `ZodError` → 400 `VALIDATION_ERROR`, CORS, cookies, CSRF, then registers each module's routes under `/api/v1/...`. Modules live in `src/modules/<feature>/` as `<feature>.routes.ts` + `<feature>.schemas.ts` plus pure-logic files (e.g. `reservation/inventory-calculator.ts`). Route tests mock Prisma on a stub Fastify instance — no database needed for `npm test`.
  - Auth: single-user cookie session (`pnp_session`, in-memory Map, 8h TTL) plus a CSRF token from `GET /api/v1/auth/csrf` required on mutating requests (`common/security/csrf.ts`).
  - Time: store timezone is Asia/Seoul. Date-only values are stored as UTC midnight; always use the helpers in `src/common/datetime.ts` (`parseDateOnly`, `parseStoreDateTime`, ...) instead of ad-hoc `new Date()` parsing.
  - Prisma schema (`apps/api/prisma/schema.prisma`) maps camelCase fields to snake_case columns via `@map`; keep that convention in new models. Schema changes require a migration in `prisma/migrations/`.

- **`apps/web`** — React 18 + Vite + Tailwind SPA (React Query, Zustand, react-hook-form, react-router). Feature pages live in `src/modules/<feature>/`. All server access goes through `src/shared/api/client.ts` (`apiGet`/`apiPost`...), which unwraps the shared envelope and caches the CSRF token; base URL is `/api/v1`, proxied to the API by the dev server (`VITE_API_PROXY_TARGET`, default `http://localhost:3000`). `npm run dev` runs `scripts/dev-server.mjs`, which wraps Vite with httpolyglot to serve HTTP and HTTPS on the same 5173 port (HTTPS when `VITE_DEV_HTTPS=true`, generating a self-signed cert via openssl).

Primary users are staff on tablets — the Playwright project and UI target a 1024×768 tablet viewport first.
