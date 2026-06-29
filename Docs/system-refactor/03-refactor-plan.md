# 03. Refactor Plan

## Objectives

- Preserve existing behavior, API contracts, DB schema, environment variable semantics, and UX flows.
- Improve maintainability through helper extraction, dead-code removal, and clearer shared types.
- Avoid risky rewrites of large page components unless covered by characterization tests.

## Improvement Candidates

| Priority | Area                   | Problem                                                  | Strategy                                            | Risk       |
| -------- | ---------------------- | -------------------------------------------------------- | --------------------------------------------------- | ---------- |
| P1       | Legacy admin pages     | `AdminPage` and `StaffPage` are not routed or imported   | Delete unreachable files after import search        | Low        |
| P1       | Web list envelopes     | `ListEnvelope<T>` duplicated in pages                    | Extract to `shared/api/types.ts` and update imports | Low        |
| P1       | Web store date helpers | `todayInStoreTime` and datetime formatting duplicated    | Extract to `shared/time/storeTime.ts` with tests    | Low        |
| P2       | API date/time helpers  | date parsing/formatting duplicated across route files    | Extract to `common/datetime.ts` with tests          | Low-medium |
| P2       | API product resolver   | product id/name resolution duplicated across route files | Extract to `modules/product/product-resolver.ts`    | Low-medium |
| P3       | Large page components  | Home, daily log, management, reservation pages are large | Defer major decomposition; document future work     | Medium     |
| P3       | React Query underuse   | provider exists but manual state is used                 | Defer; changing data lifecycle may alter UX         | Medium     |

## Approved Directory Structure Direction

Target is incremental, not a framework rewrite:

```text
apps/api/src
├── common
│   ├── datetime.ts
│   ├── http.ts
│   └── security
├── infra
└── modules
    ├── product
    │   └── product-resolver.ts
    └── <feature>

apps/web/src
├── app
├── modules
├── shared
│   ├── api
│   │   ├── client.ts
│   │   └── types.ts
│   ├── time
│   │   └── storeTime.ts
│   └── ui
└── styles
```

## Refactoring Cycle Plan

### Cycle 1: Low-Risk Cleanup

- Remove unreachable legacy admin pages.
- Add web shared API envelope type.
- Update active web pages to import the shared type.
- Run tests and record result.

### Cycle 2: Web Helper Extraction

- Add `shared/time/storeTime.ts`.
- Add characterization tests for fixed KST date formatting.
- Update web pages/layout to use the helper.
- Run tests and record result.

### Cycle 3: API Helper Extraction

- Add `common/datetime.ts` and tests.
- Update API routes to use the shared date/time helpers.
- Add `modules/product/product-resolver.ts`.
- Update reservation, daily-log, production-lot routes to use it.
- Run tests, build, lint, smoke tests, and record result.

## Rollback Plan

- Baseline rollback: `git reset --hard ea8eba70f52a27ebe4542b3cb7260e868404bf70`
- Per-cycle rollback:
  - Review `git diff`.
  - Revert only the cycle's changed files if tests fail and the defect is not immediately obvious.
- DB rollback:
  - Not applicable. This refactor must not change Prisma schema or migrations.

## Deferred Work

- Split large React pages into hooks/components after adding route-specific UI tests.
- Add API route integration tests backed by a disposable PostgreSQL instance or an isolated test schema.
- Replace manual fetch state with React Query gradually, if UX behavior is explicitly approved.
- Remove delivery migration artifact only through a separate DB migration plan; not part of this structural refactor.
