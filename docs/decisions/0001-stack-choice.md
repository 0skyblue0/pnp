# 0001. Stack Choice

- 일자: 2026-05-07
- 상태: Accepted
- 결정자: ARCH

## 문제

`FINAL_DESIGN.md`는 태블릿 우선 운영 SPA, 단일 매장 규모의 REST API, PostgreSQL 기반 영속성, 향후 LLM 스켈레톤을 요구한다. 초기 구현 전 확정 스택을 ADR로 남겨 추후 모듈별 PR의 기준선을 고정해야 한다.

## 옵션

- A) React + Vite + TypeScript, Fastify + Prisma + PostgreSQL, npm workspaces
- B) Next.js 풀스택, Prisma + PostgreSQL
- C) NestJS + React 별도 앱, Prisma + PostgreSQL

## 결정

옵션 A를 채택한다.

- 프론트엔드는 React 18 + Vite + TypeScript + Tailwind CSS + Headless UI를 사용한다.
- 백엔드는 Node.js 20 + Fastify + TypeScript + Prisma를 사용한다.
- 데이터베이스는 PostgreSQL 15+를 사용한다.
- 인증은 서버 사이드 세션 쿠키(HttpOnly, Secure, SameSite=Lax)를 기준으로 한다.
- 패키지 관리는 npm workspaces로 `apps/api`, `apps/web`, `packages/shared`를 분리한다.
- LLM은 Phase 4+ 전까지 인터페이스와 비활성 스켈레톤만 둔다.

## 결과

- 모든 공개 API 입출력은 Zod 또는 JSON Schema로 검증한다.
- 백엔드와 프론트엔드의 공통 enum, 응답 envelope, 검증 스키마는 `packages/shared`에 둔다.
- CI는 Node.js 20에서 lint, typecheck, unit test, build를 실행한다.
- Prisma 마이그레이션은 Phase 단위로 누적하며, Phase 1은 M1/M3/M13 및 staff/audit 테이블만 생성한다.
