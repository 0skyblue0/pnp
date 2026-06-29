# 06. Playwright UI Test Cases

## Scope

This suite verifies that the main user-facing buttons and inputs preserve expected behavior at the tablet viewport configured in `apps/web/playwright.config.ts`.

The tests mock `/api/v1/*` responses in Playwright. This keeps the test focused on UI behavior and prevents local PostgreSQL data from being mutated.

## Test Cases

| ID    | Area                     | Expected behavior                                                                                                                                                          | Automation |
| ----- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| UI-01 | Home production input    | Empty product submit shows validation; valid product/quantity/lot/time/memo submits `POST /production-lot` with numeric quantity and trimmed note; success message appears | Automated  |
| UI-02 | Reservation registration | Contact, pickup, product, quantity, purpose, allergy, memo are submitted to `POST /reservation`; status button sends `PATCH /reservation/:id/status`                       | Automated  |
| UI-03 | Customer response entry  | Segment buttons, star score, quick tags, text inputs, boss flag all affect submitted `POST /response` payload; save success clears summary                                 | Automated  |
| UI-04 | Staff management         | Staff add form opens; blank username and short password validations appear; valid staff creation posts role/password without empty `displayName`                           | Automated  |

## Deferred Manual Checks

- Visual overflow checks across additional mobile widths.
- Real PostgreSQL integration for write paths.
- Browser accessibility audit for icon-only buttons that currently do not expose text labels.

## Command

```bash
npm run test:e2e -w @pnp/web
```

## Execution Result

- First run:
  - 3 passed, 2 failed.
  - Failure 1: existing `home.spec.ts` used a non-unique `반응 입력` link selector. The page has both nav and main quick-action links.
  - Failure 2: staff test used a partial `추가` button selector that also matched `직원 추가`.
- Fix:
  - Scoped the home link assertion to `main`.
  - Used exact button matching for the staff form `추가` submit button.
- Final run:
  - `5 passed (3.1s)`
  - Project: `tablet-chrome-1024`

## Automated Coverage Added

- `apps/web/tests/e2e/ui-interactions.spec.ts`
  - Home production input validation and `POST /production-lot` payload.
  - Reservation form and `PATCH /reservation/:id/status` payload.
  - Customer response segmented controls, quick tags, stars, checkbox, and `POST /response` payload.
  - Staff add form validation and `POST /staff` payload with blank `displayName` omitted.
- `apps/web/tests/e2e/home.spec.ts`
  - Existing smoke selector corrected to avoid strict mode ambiguity.
