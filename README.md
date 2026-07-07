# PnP Operations

폴앤폴리나 운영 관리 시스템 구현 저장소입니다.

## Structure

- `apps/api`: Node.js 20 + Fastify + Prisma API
- `apps/web`: React + Vite + TypeScript + Tailwind SPA
- `packages/shared`: shared Zod schemas, API envelope, domain constants
- `docs`: final design, agent governance, ADRs, review checklists, OpenAPI
- `infra`: Caddy, systemd, backup skeletons

## Commands

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

The local runtime target is Node.js 20. The current scaffold intentionally keeps LLM disabled until Phase 4+ approval.

## Docker Development

The Docker development environment pins Node.js to `node:20.19-bookworm-slim`.

```bash
docker compose up --build
```

Services:

- Web: `http://localhost:5173` and `https://localhost:5173` (HTTPS uses a self-signed local certificate)
- API: `http://localhost:3001` on the host, `http://api:3000` inside Compose
- PostgreSQL: host-installed PostgreSQL through `host.docker.internal:5432`

The web dev server proxies `/api/*` to the API container. Docker Compose enables both HTTP and HTTPS on the same `5173` port; HTTPS uses a self-signed local certificate, so the browser may show a one-time certificate warning. The API container runs Prisma generate before starting Fastify.

Set `DATABASE_URL` before running Compose when your local PostgreSQL credentials differ:

```bash
DATABASE_URL=postgresql://user:password@host.docker.internal:5432/pnp?schema=pnp docker compose up --build
```

Run migrations against the local PostgreSQL database explicitly:

```bash
docker compose run --rm api npm run prisma:migrate:deploy -w @pnp/api
```
