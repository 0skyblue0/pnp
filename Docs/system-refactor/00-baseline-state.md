# 00. Baseline State

## Baseline

- Date: 2026-05-10 KST
- Project root: `/home/pnp`
- Git branch: `master`
- Baseline commit: `ea8eba70f52a27ebe4542b3cb7260e868404bf70`
- Baseline commit message: `chore: create baseline before system refactor`

## Git State

- Initial repository had no commits before the baseline.
- All non-ignored project files were staged and committed.
- Ignored files include actual `.env` files, build output, `node_modules`, Playwright output, logs, and TypeScript build info.
- Sensitive local config was not committed. `.env.example` contains placeholders. `docker-compose.yml` contains development defaults and is part of the executable project contract.

## Current Project Structure

```text
.
├── apps
│   ├── api
│   │   ├── prisma
│   │   ├── src
│   │   │   ├── common
│   │   │   ├── infra
│   │   │   └── modules
│   │   └── tests
│   └── web
│       ├── public
│       ├── src
│       │   ├── app
│       │   ├── modules
│       │   ├── shared
│       │   ├── styles
│       │   └── test
│       └── tests
├── docker
├── docs
├── infra
├── packages
│   └── shared
└── Docs/system-refactor
```

## Main Entrypoints

- API runtime: `apps/api/src/index.ts`
- API composition: `apps/api/src/app.ts`
- API database schema: `apps/api/prisma/schema.prisma`
- Web runtime: `apps/web/src/main.tsx`
- Web routing: `apps/web/src/app/App.tsx`
- Web shell/layout: `apps/web/src/app/layouts/AppLayout.tsx`
- Shared contracts: `packages/shared/src/index.ts`
- Docker runtime: `docker-compose.yml`

## Execution Modes

- Local workspace commands use npm workspaces.
- Docker starts only `api` and `web` services.
- PostgreSQL is not containerized; API connects to a locally installed PostgreSQL through `DATABASE_URL`, defaulting in Compose to `host.docker.internal`.

## Dependencies

- Root: TypeScript, ESLint, Prettier, Vitest.
- API: Fastify, Prisma, Zod, bcryptjs, `@fastify/cookie`, `@fastify/cors`, `@pnp/shared`.
- Web: React, Vite, React Router, React Query, React Hook Form, Zod, Tailwind, lucide-react, `@pnp/shared`.
- Shared: Zod.
- Infra: Docker Compose, Caddy/systemd runbooks, PostgreSQL backup script.

## Build And Test Commands

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`
- `npm run format:check`
- `docker compose up --build -d`
- `docker compose ps`
- Smoke:
  - `curl http://localhost:3001/healthz`
  - `curl http://localhost:3001/api/v1/product`
  - `curl http://localhost:3001/api/v1/production-lot`
  - `curl -I http://localhost:5173/`

## Baseline Verification

- `npm run typecheck`: passed
- `npm run lint`: passed
- `npm test`: passed
- `npm run build`: passed
- `npm run format:check`: passed
- `docker compose ps`: `pnp-api-1` healthy, `pnp-web-1` healthy
- API health smoke: returned `{ "data": { "status": "ok" }, "error": null }`
- Product API smoke: returned envelope with product list
- Production lot API smoke: returned envelope with date `2026-05-10`
- Web smoke: `/` returned HTTP 200

## Baseline Risks

- Several large page/route files hold view, DTO, formatting, form state, and API orchestration together.
- Date/time helpers are duplicated across API modules and web pages.
- Product lookup/create behavior is duplicated in several API modules.
- Web list envelope types are repeated in each page.
- Unused legacy admin pages exist beside the active `ManagementPage`.
- Existing integration tests are light; most API route behavior is not covered by characterization tests.
- Docker Compose contains development defaults. These are not local secrets, but production deployments must override them through environment variables.
