# 홈·일일 운영·손님 반응·예약·선결제·관리 화면 수정 계획

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** 사용자가 요청한 홈, 일일 운영, 손님 반응, 예약, 선결제 장부, 관리 화면 요구사항을 실제 API/DB 연동과 화면 동작까지 반영한다.

**Architecture:** 현재 웹은 React/Vite(`apps/web`) 단일 화면 컴포넌트 중심이고, API는 Fastify + Prisma(`apps/api`)로 구성되어 있다. 홈 공지·연간 스케줄·예약·손님 반응·선결제는 이미 일부 API/DB가 있으므로 확장/정리하고, 일일 운영 작성 데이터는 현재 브라우저 localStorage 기반이라 서버 저장 모델/API를 새로 추가하는 방향이 안전하다.

**Tech Stack:** React, TypeScript, Tailwind class styling, Fastify, Prisma/PostgreSQL, Vitest/Testing Library, Playwright.

---

## 현재 확인한 상태

### 홈 화면

- `apps/web/src/modules/home/HomePage.tsx`
  - 메인 상단 날짜가 `HomePage.tsx:670-672`에 별도로 표시된다. 요청의 “헤더 날짜 아님”은 이 부분 제거로 해석한다.
  - 오늘 카드 3개는 `HomePage.tsx:673-712`에 있다.
  - 바로 아래에 하드코딩 매출 목표/직원 공지 2컬럼 카드가 `HomePage.tsx:715-730`에 있다. 요청대로 제거/대체 대상이다.
  - 관리 탭에서 읽은 `annual-goal-notice` 데이터는 이미 `storedGoalNotices`로 로드한다.
  - 연간 스케줄 요약은 `allScheduleItems.slice(0, 4)`만 보여주며, 현재 날짜 이후 필터가 없다(`HomePage.tsx:732-756`).
- `apps/api/src/modules/annual-goal-notice/annual-goal-notice.routes.ts`
  - 현재 공지는 `category/title/value/note` 단일 구조다.
  - 매출 목표를 “매월 12개월 금액 + 최종 총합”으로 저장하려면 API 스키마/DB 구조 변경이 필요하다.

### 일일 운영 화면

- `apps/web/src/modules/daily-log/DailyLogPage.tsx`
  - 전체 작성/조회 데이터가 localStorage(`pnp:daily-operation-draft:*`)와 샘플 `providedDailyOperationRecords`에 의존한다.
  - 조회/수정 기능은 이미 있다: `loadRecordForEdit`, `deleteRecord`, `DailyLookupSection`.
  - 다만 요청의 “과거 데이터 조회 및 수정”을 실제 직원 공유 데이터로 보려면 서버 저장 API가 필요하다.
  - 시설 점검 시간 입력은 `WorkerTimeInput`에서 00:00~23:30 전체 30분 단위 한 개 select로 되어 있다(`DailyLogPage.tsx:1796-1845`). 요청처럼 시/분 분리, 첫 출근 05~09, 최종퇴근 16~20, 체크박스 오버라이드가 필요하다.
- `apps/api/src/modules/daily-log/daily-log.routes.ts`
  - 기존 `DailyLog`는 날씨/notes/congestion/tasting 정도만 관리한다. 현재 웹의 운영일지 전체 draft/product/channel/staffSpecialRows 저장 API는 없다.

### 손님 반응 화면

- `apps/web/src/modules/response/ResponseInquiryPage.tsx`
  - 반응 분석 탭은 `StatisticsPage`를 렌더링한다.
- `apps/web/src/modules/statistics/StatisticsPage.tsx`
  - 이미 `GET /response/stats?from=&to=`를 호출한다(`StatisticsPage.tsx:248-261`).
  - 그러나 데이터가 없으면 실제 0건 대신 화면용 fallback 샘플이 노출된다(`displayTotal || 4`, `displayMajor` fallback, `displayRepeated` fallback). “실제 데이터를 받아오게”는 이 fallback 제거가 핵심이다.
  - 기간 선택은 버튼만 있고 달력형 시작/종료 선택이 없다.
- `apps/api/src/modules/response/response.routes.ts`
  - `/response/stats`는 실제 DB 통계를 반환한다. 백엔드 기본 연결은 되어 있다.

### 예약 화면

- `apps/web/src/modules/reservation/ReservationPage.tsx`
  - 현재 조회는 단일 날짜만 `GET /reservation?from=${date}&to=${date}`로 호출한다(`ReservationPage.tsx:220-233`).
  - 날짜 input과 새로고침 버튼이 `sr-only`라 사용자가 직접 다른 날짜를 찾기 어렵다(`ReservationPage.tsx:671-690`).
  - 검색어 상태/검색 UI는 없다.
- `apps/api/src/modules/reservation/reservation.routes.ts`
  - list API는 `from/to/status`만 지원한다. 다른 날짜 조회는 API가 이미 가능하지만, 검색 기능은 쿼리 확장이 필요하다.

### 선결제 장부 화면

- `apps/web/src/modules/prepaid-ledger/PrepaidLedgerPage.tsx`
  - 신규 등록, 충전, 사용, 거래 되돌리기는 이미 API 연결되어 있다.
  - 상단 표의 `삭제` 버튼은 단순 스크롤만 하고 실제 삭제 API가 없다(`PrepaidLedgerPage.tsx:321-325`). 요청의 “각 버튼들 실제 동작”에 포함된다.
  - 상세 기능은 `<details>`를 열면 검색 결과 전체 손님의 상세 카드가 모두 나온다(`PrepaidLedgerPage.tsx:335-601`). 요청대로 표에서 선택한 손님 1명만 상세 표시하도록 변경해야 한다.
  - 메모 수정 기능은 없다.
- `apps/api/src/modules/prepaid-ledger/prepaid-ledger.routes.ts`
  - `GET`, `POST`, `POST /:id/use`, `POST /:id/charge`, `DELETE /:id/transactions/:transactionId`는 있다.
  - 고객 메모 수정, 고객 삭제/비활성 API는 없다.

### 관리 화면 홈 공지 관리 탭

- `apps/web/src/modules/admin/ManagementPage.tsx`
  - 홈 공지 관리는 현재 `공지 종류`, `공지 제목`, `공지 내용`, `공지 메모` 단일 폼이다(`ManagementPage.tsx:957-1017`).
  - 매출 목표가 12개월 금액 입력/총합 표시 구조가 아니다.
  - 운영 목표/직원 공지는 이미 제목/내용 구조에 가깝지만, 매출 목표와 동일한 `value` 필드를 공유한다.

---

## 확정된 사용자 결정사항

- 매출 목표는 **연도별**로 저장한다. 예: 2026년 1~12월 목표, 2027년 1~12월 목표를 별도 관리한다.
- 기존에 등록되어 있던 `매출 목표` 공지는 새 12개월 목표 구조로 자동 이전하지 않아도 된다. 사용자가 새 화면에서 **다시 입력하는 방식 허용**.
- 선결제 장부의 충전/사용 이력은 직원이 최근 실수를 바로 되돌리기 쉽도록 **최신 내역 → 오래된 내역** 순서로 표시한다.
- 일일 운영 과거 데이터는 **새 저장값부터 서버에 저장**한다. 기존 각 브라우저 localStorage 임시 기록은 자동 이전하지 않는다.

---

## 구현 계획

### Task 1: 홈 공지/매출 목표 데이터 모델 확장 설계 및 테스트 추가

**Objective:** 매출 목표를 연도별 12개월 금액으로 저장하고, 운영 목표/직원 공지는 제목+내용으로 유지할 수 있게 API 계약을 확정한다.

**Files:**

- Modify: `apps/api/prisma/schema.prisma`
- Modify: `apps/api/src/modules/annual-goal-notice/annual-goal-notice.routes.ts`
- Modify: `apps/web/src/modules/admin/ManagementPage.tsx`
- Modify: `apps/web/src/modules/home/HomePage.tsx`
- Test: `apps/web/src/app/App.test.tsx`
- Test: add/extend API route tests if existing annual goal tests are present or create `apps/api/src/modules/annual-goal-notice/annual-goal-notice.routes.test.ts`

**Approach:**

- 기존 `AnnualGoalNotice` 테이블에 `targetYear` 정수 필드와 `monthlyTargets` JSON 필드(또는 월별 정수 컬럼 12개)를 추가한다.
- 구현 난이도와 향후 확장을 고려하면 JSON 필드가 빠르다. 단, 타입 검증은 API에서 엄격히 한다.
- API DTO는 기존 호환을 위해 `value`를 유지하되, `category: sales`일 때 `targetYear`, `monthlyTargets: { "01": number, ..., "12": number }`, `targetTotal`을 반환한다.
- `operation/staff`는 `title/value/note`를 그대로 쓴다.
- 기존 `sales` 공지는 새 구조로 자동 변환하지 않는다. 새 연도별 매출 목표는 관리 화면에서 다시 입력한다.

**Validation:**

- sales 공지는 12개월 입력이 모두 숫자이며 0 이상이어야 한다.
- sales 공지는 `targetYear`가 현재 연도 전후로 합리적인 4자리 연도인지 확인한다. 기본값은 오늘 날짜의 연도다.
- `targetTotal`은 서버가 합산해서 반환한다. 브라우저가 보낸 총합은 믿지 않는다.

---

### Task 2: 관리 > 홈 공지 관리 탭 수정

**Objective:** 관리 탭에서 매출 목표는 12개월 목표 금액을 입력하고 총합을 확인하며, 운영 목표/직원 공지는 제목+내용만 간단히 입력하게 한다.

**Files:**

- Modify: `apps/web/src/modules/admin/ManagementPage.tsx`
- Test: `apps/web/src/app/App.test.tsx`

**UI plan:**

- 탭 제목은 `홈 공지 관리` 유지.
- 공지 종류 선택:
  - `매출 목표`: `목표 연도` 선택/입력 + 1월~12월 금액 입력 그리드, `최종 총합 금액` 자동 표시.
  - `운영 목표`: `공지 제목`, `공지 내용`, 선택 메모.
  - `직원 공지`: `공지 제목`, `공지 내용`, 선택 메모.
- 매출 목표 카드 목록에는 `2026년 매출 목표`, `총합 n원`, `이번 달 n원`을 표시한다. 홈에서는 오늘 날짜의 연도와 월에 맞는 매출 목표를 선택한다.
- 운영/직원 공지 카드에는 제목/내용을 표시한다.

**Tests:**

- 매출 목표 선택 시 12개월 입력이 보인다.
- 목표 연도 입력/선택이 보이고 저장 payload에 포함된다.
- 월별 금액 입력 시 총합이 갱신된다.
- 저장 payload에 `monthlyTargets`가 포함된다.
- 운영 목표/직원 공지는 제목/내용 저장 payload가 유지된다.

---

### Task 3: 홈 화면 레이아웃 요구사항 반영

**Objective:** 메인 날짜 제거, 3개 오늘 카드 바로 아래에 매출 목표/운영 목표/직원 공지 3컬럼 배치, 기존 하드코딩 2컬럼 매출/직원 공지 제거, 연간 스케줄 미래 일정만 가까운 순 표시.

**Files:**

- Modify: `apps/web/src/modules/home/HomePage.tsx`
- Test: `apps/web/src/app/App.test.tsx`

**Implementation details:**

- `HomePage.tsx:670-672` 날짜 표시 제거.
- `HomePage.tsx:715-730` 기존 2컬럼 매출 목표/직원 공지 카드 제거.
- 오늘 카드 3개(`일일 운영 작성`, `오늘 예약 현황`, `손님 반응 기록`) 바로 아래에 `md:grid-cols-3` 카드 배치:
  1. `매출 목표`: 현재 월(`todayInStoreTime()` 기준)의 월 목표 금액 표시. 월 목표가 없으면 `이번 달 매출 목표 미등록`.
  2. `운영 목표`: 관리에서 작성한 operation 최신/대표 공지 표시.
  3. `직원 공지`: 관리에서 작성한 staff 최신/대표 공지 표시.
- 매출 목표 월 갱신: 현재 날짜의 **연도와 월**에 해당하는 매출 목표를 홈 카드에 표시한다. 월이 바뀌면 같은 연도의 다음 월 목표를 보여주고, 연도가 바뀌면 새 연도의 목표를 찾는다.
- 현재 연도 목표가 없으면 과거/다른 연도 목표를 대신 보여주지 않고 `올해 매출 목표 미등록`으로 표시한다.
- 연간 스케줄 요약:
  - `dateFromScheduleItem(item, currentYear)`로 실제 날짜를 만들고 `>= today`인 항목만 남긴다.
  - 날짜 오름차순 정렬 후 `slice(0, 4)` 표시.
  - 오늘 이전 일정은 홈 요약에 노출하지 않는다.

**Tests:**

- 홈에서 오늘 카드 다음에 매출 목표/운영 목표/직원 공지 카드가 보인다.
- 기존 하드코딩 “4,800만원 중 오늘 목표 확인”이 사라진다.
- 2026년 7월이면 2026년 7월 목표, 2027년 1월이면 2027년 1월 목표가 선택된다.
- 과거 스케줄은 보이지 않고 미래 스케줄만 가까운 순으로 보인다.

---

### Task 4: 일일 운영 시간 선택 컨트롤 수정

**Objective:** 시설 점검사항의 첫 출근자/최종퇴근자 시간을 시/분 분리 선택으로 바꾸고, 기본 범위와 오버라이드를 적용한다.

**Files:**

- Modify: `apps/web/src/modules/daily-log/DailyLogPage.tsx`
- Test: `apps/web/src/app/App.test.tsx`

**Implementation details:**

- `WorkerTimeInput` props에 `startHour`, `endHour`, `defaultTime`, `overrideLabel` 추가.
- 기본 모드:
  - 첫 출근자: 시 `05`~`09`, 분 `00`/`30`.
  - 최종퇴근자: 시 `16`~`20`, 분 `00`/`30`.
- UI:
  - 이름 input + 시 select + 분 select + `직접 수정` 체크박스.
  - 체크박스 미선택 시 지정 범위 select만 제공.
  - 체크박스 선택 시 임의 시간 입력(`type=time` 또는 00~23/00~59 select)을 노출한다.
- 저장 값은 기존 `HH:mm` 문자열(`firstWorkerTime`, `lastWorkerTime`) 유지.
- 기본값은 첫 출근자 `06:00`, 최종퇴근자 `19:30` 유지.

**Tests:**

- 첫 출근자 시 옵션에 05~09만 있다.
- 최종퇴근자 시 옵션에 16~20만 있다.
- 분 옵션은 00/30만 있다.
- 직접 수정 체크 시 임의 시간 입력이 가능하고 저장 값이 바뀐다.

---

### Task 5: 일일 운영 과거 데이터 서버 저장/조회/수정 추가

**Objective:** 현재 localStorage 기반 일일 운영 작성/조회/수정을 서버 DB 기반으로 전환해 직원들이 같은 과거 데이터를 조회·수정할 수 있게 한다.

**Files:**

- Modify: `apps/api/prisma/schema.prisma`
- Create or extend: `apps/api/src/modules/daily-log/daily-operation.routes.ts` or extend `daily-log.routes.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/web/src/modules/daily-log/DailyLogPage.tsx`
- Test: `apps/api/src/modules/daily-log/daily-log.routes.test.ts`
- Test: `apps/web/src/app/App.test.tsx`

**API plan:**

- Add model such as `DailyOperationRecord`:
  - `id`, `date @unique`, `draft Json`, `productRows Json`, `channelRows Json`, `staffSpecialRows Json`, `createdAt`, `updatedAt`.
- Endpoints:
  - `GET /daily-operation?from=YYYY-MM-DD&to=YYYY-MM-DD`
  - `GET /daily-operation/:date`
  - `PUT /daily-operation/:date` upsert full record
  - `DELETE /daily-operation/:date`
- Keep existing daily-log endpoints untouched for stockout/tasting/congestion compatibility.

**Frontend plan:**

- Replace `loadStoredDailyRecords`, `saveDraft`, `deleteRecord` with API calls.
- 기존 localStorage 임시 기록은 서버로 자동 이전하지 않는다. 새 저장분부터 `PUT /daily-operation/:date`로 서버에 저장한다.
- API 연결 후 production view에서는 샘플/제공 기록을 실제처럼 섞어 보여주지 않는다. API에 저장된 기록이 없으면 “저장된 일지 없음”으로 표시한다.
- `loadRecordForEdit(record)` can remain the edit flow: 조회에서 `수정` → 입력 폼으로 불러오기 → 저장하면 same date upsert.

**Tests:**

- 저장 클릭이 `PUT /daily-operation/:date`를 호출한다.
- 조회 모드가 `GET /daily-operation?from=&to=`를 호출한다.
- 상세 `수정` 클릭 후 저장하면 같은 날짜가 갱신된다.
- 삭제가 API delete 후 목록에서 제거된다.

**Migration note:**

- DB migration 후 `npm run prisma:generate --workspace @pnp/api`와 API 컨테이너 재빌드/마이그레이션이 필요하다.

---

### Task 6: 손님 반응 분석 탭을 실제 데이터만 표시하도록 정리

**Objective:** 반응 분석 탭에서 백엔드 실제 통계만 표시하고 샘플 fallback을 제거한다.

**Files:**

- Modify: `apps/web/src/modules/statistics/StatisticsPage.tsx`
- Test: `apps/web/src/app/App.test.tsx`

**Implementation details:**

- `displayTotal = stats.total || 4` 제거. 실제 0이면 0건 표시.
- `displayMajor` fallback 샘플 제거. 실제 배열이 비면 “조회 기간에 등록된 손님 반응 없음” 상태 표시.
- `displayRepeated` fallback 샘플 제거.
- `AI 분류율`, `미해결 이슈`처럼 실제 계산이 아닌 고정값은 제거하거나 실제 데이터 기반으로 바꾼다.
  - 안전한 기본: `AI 분류율`은 API가 값을 주지 않으면 숨김/`-` 표시.
  - `미해결 이슈`는 현재 별도 상태가 없으므로 제거 권장.

**Tests:**

- `/response/stats`가 total 0을 반환하면 샘플 “식감이 딱딱하다는 의견” 등이 보이지 않는다.
- total/count가 API 응답 그대로 표시된다.

---

### Task 7: 손님 반응 분석 기간 달력 범위 선택 추가

**Objective:** 반응 분석 탭에서 달력을 눌러 시작일/종료일을 순서대로 선택할 수 있게 한다.

**Files:**

- Modify: `apps/web/src/modules/statistics/StatisticsPage.tsx`
- Test: `apps/web/src/app/App.test.tsx`

**Implementation details:**

- `calendarSelectionStart: string | null` 상태 추가.
- 월 달력 UI 추가. 현재 선택 월은 `range.to` 또는 today 기준.
- 날짜 버튼 클릭 규칙:
  - 첫 클릭: `calendarSelectionStart` 저장, `range={from: day, to: day}` 임시 표시.
  - 두 번째 클릭: 시작/종료를 오름차순 정렬해서 `range` 확정, `calendarSelectionStart=null`.
- 기존 빠른 버튼(이번달/지난달/이번주 등)은 유지.

**Tests:**

- 날짜 2개를 클릭하면 `/response/stats?from=첫날&to=둘째날`이 호출된다.
- 뒤 날짜를 먼저 눌러도 range가 자동 정렬된다.

---

### Task 8: 예약 다른 날짜 조회 및 검색 기능 추가

**Objective:** 예약 화면에서 날짜를 숨기지 않고 직접 조회할 수 있게 하며, 이름/연락처/제품/메모 검색으로 다른 날짜 예약도 찾게 한다.

**Files:**

- Modify: `apps/api/src/modules/reservation/reservation.schemas.ts`
- Modify: `apps/api/src/modules/reservation/reservation.routes.ts`
- Modify: `apps/web/src/modules/reservation/ReservationPage.tsx`
- Test: `apps/web/src/app/App.test.tsx`
- Test: API reservation route tests if present or add one.

**API plan:**

- `GET /reservation` query에 `query`, optional `from`, `to` 추가/확장.
- 검색 대상:
  - `customerName contains query`
  - `contactPhone contains query`
  - `memo contains query`
  - `items.product.name contains query` (Prisma relation filter)
- 검색어가 있을 때 기본 날짜 필터는 적용하지 않거나, UI에서 “전체 날짜 검색” 모드로 호출한다.

**Frontend plan:**

- 예약 리스트 상단에 보이는 컨트롤 배치:
  - `조회 날짜` date input(현재 sr-only 제거)
  - `다른 날짜 조회` 버튼 또는 날짜 변경 즉시 조회
  - `예약 검색` input
  - 검색 시 `GET /reservation?query=...`로 전체 날짜에서 검색
  - 검색어가 비어 있으면 `from=date&to=date`로 해당 날짜 조회
- 검색 결과에는 날짜도 보여야 한다. 현재 목록은 시간만 보이므로 `YYYY.MM.DD (요일) HH:mm` 또는 날짜+시간 표시로 변경.

**Tests:**

- 날짜 변경 시 해당 날짜 API 호출.
- 검색어 입력 시 from/to 없이 query API 호출.
- 검색 결과가 다른 날짜 예약도 날짜와 함께 표시된다.

---

### Task 9: 선결제 장부 버튼/API 완성

**Objective:** 상단 표의 충전/사용/되돌리기 상세/삭제 버튼이 실제 동작하고, 선택한 손님 1명만 상세 영역에 표시되게 한다.

**Files:**

- Modify: `apps/api/src/modules/prepaid-ledger/prepaid-ledger.schemas.ts`
- Modify: `apps/api/src/modules/prepaid-ledger/prepaid-ledger.routes.ts`
- Modify: `apps/web/src/modules/prepaid-ledger/PrepaidLedgerPage.tsx`
- Test: `apps/web/src/app/App.test.tsx`
- Add API route tests if needed.

**API plan:**

- `PATCH /prepaid-ledger/:id` for memo/contact/name update, especially memo edit.
- `DELETE /prepaid-ledger/:id` to deactivate customer (`isActive=false`) after confirmation.
- Existing `DELETE /:id/transactions/:transactionId` remains transaction undo.

**Frontend plan:**

- Add `selectedCustomerId` state.
- 상단 표 버튼:
  - `충전`: selectedCustomerId 설정 + 상세 열기 + 충전 금액 input focus.
  - `사용`: selectedCustomerId 설정 + 상세 열기 + 사용 금액 input focus.
  - `되돌리기 상세`: selectedCustomerId 설정 + 상세 열기 + 최근 내역 영역 표시.
  - `삭제`: confirm 후 `DELETE /prepaid-ledger/:id` 호출.
- `<details>` 안의 상세 고객 목록은 `selectedCustomer` 1명만 렌더링한다.
- 상세 최소 정보:
  - 충전/사용 이력은 **최신 내역 → 오래된 내역** 순서로 표시한다.
  - 각 거래 `되돌리기` 유지.
  - 기타 메모 표시 및 `메모 수정` 버튼/저장.

**Tests:**

- 표에서 특정 손님 `충전` 클릭 시 그 손님 상세만 보인다.
- 다른 손님 정보는 상세 영역에 보이지 않는다.
- 메모 수정 저장이 PATCH를 호출한다.
- 삭제 버튼이 DELETE를 호출하고 목록에서 제거된다.

---

### Task 10: 전체 검증 및 브라우저 확인

**Objective:** 변경 범위가 크므로 API/웹 테스트와 실제 화면 확인까지 완료한다.

**Commands:**

- `npm run test --workspace @pnp/web -- App.test.tsx`
- `npm run test --workspace @pnp/api`
- `npm run lint --workspace @pnp/web`
- `npm run lint --workspace @pnp/api`
- `npm run typecheck --workspace @pnp/web`
- `npm run typecheck --workspace @pnp/api`
- `npm run build --workspace @pnp/web`
- `npm run build --workspace @pnp/api`

**If Prisma schema changes:**

- `npm run prisma:generate --workspace @pnp/api`
- `docker compose up -d --build api`
- `docker compose exec -T api npm run prisma:migrate:deploy -w @pnp/api`
- Verify: API `/healthz`.

**Browser verification:**

- Port 5173 only.
- Open and screenshot:
  - `/home`
  - `/daily-log/today`
  - `/response?mode=lookup`
  - `/reservation`
  - `/prepaid-ledger`
  - `/admin` or management route currently used by app shell
- Check browser console for errors.
- For any smoke test data created in shared DB, delete it before final report.

---

## 작업 워크플로우 설계

### Phase 0: 작업 시작 전 안전 점검

1. `git status --short`로 사용자 파일/미추적 파일 확인.
2. 현재 미추적 파일(`Docs/User_Send/...xlsx`, `Docs/User_Send/...zip`)은 사용자 제공 자료로 보이며 이번 작업에서 건드리지 않는다.
3. 변경 범위가 넓으므로 기능 묶음별로 테스트 가능한 단위로 나누어 진행한다.
4. DB migration이 들어가는 작업은 API/Prisma 테스트를 먼저 통과시킨 뒤 웹 연결을 진행한다.

### Phase 1: 데이터 구조/API 기반 작업

1. `annual_goal_notice` 확장
   - `targetYear`, `monthlyTargets` 추가.
   - sales category validation을 연도별 12개월 목표 기준으로 변경.
   - 기존 sales 공지는 자동 변환하지 않는다. 필요 시 화면에서 “기존 형식 공지”로만 읽거나 새 입력을 유도한다.
2. `daily_operation_record` 신규 추가
   - 새 저장분부터 서버 저장.
   - 기존 localStorage 자동 이전 없음.
3. `reservation` 검색 query 확장.
4. `prepaid-ledger` 고객 메모 수정/PATCH, 고객 삭제/비활성 DELETE 추가.

### Phase 2: 웹 화면 연결 작업

1. 관리 화면 홈 공지 관리
   - 매출 목표: 목표 연도 + 12개월 금액 + 총합.
   - 운영 목표/직원 공지: 제목 + 내용 중심.
2. 홈 화면
   - 메인 날짜 제거.
   - 오늘 3카드 바로 아래 목표/공지 3카드 배치.
   - 오늘 날짜의 연도/월에 맞는 매출 목표 표시.
   - 연간 스케줄은 미래 일정만 가까운 순으로 표시.
3. 일일 운영
   - 시간 컨트롤 먼저 수정.
   - 저장/조회/수정/삭제를 서버 API로 연결.
4. 손님 반응 분석
   - 샘플 fallback 제거.
   - 달력 범위 선택 추가.
5. 예약
   - 보이는 날짜 조회 컨트롤과 전체 날짜 검색 추가.
6. 선결제 장부
   - 선택한 손님 1명 상세만 표시.
   - 거래 내역은 최신순 유지.
   - 충전/사용/되돌리기/삭제/메모수정 버튼을 실제 API와 연결.

### Phase 3: 검증 순서

1. API 단위 테스트: annual-goal, daily-operation, reservation query, prepaid-ledger.
2. 웹 단위 테스트: 홈, 관리, 일일 운영, 손님 반응, 예약, 선결제.
3. 타입/린트/빌드:
   - `npm run test --workspace @pnp/web -- App.test.tsx`
   - `npm run test --workspace @pnp/api`
   - `npm run lint --workspace @pnp/web`
   - `npm run lint --workspace @pnp/api`
   - `npm run typecheck --workspace @pnp/web`
   - `npm run typecheck --workspace @pnp/api`
   - `npm run build --workspace @pnp/web`
   - `npm run build --workspace @pnp/api`
4. Prisma 변경 시:
   - `npm run prisma:generate --workspace @pnp/api`
   - `docker compose up -d --build api`
   - `docker compose exec -T api npm run prisma:migrate:deploy -w @pnp/api`
   - `/healthz` 확인.
5. 브라우저 확인은 5173 포트만 사용:
   - `/home`
   - `/daily-log/today`
   - `/response?mode=lookup`
   - `/reservation`
   - `/prepaid-ledger`
   - 관리 화면
6. 화면 확인 후 console error와 스크린샷으로 최종 확인.
7. 검증용으로 만든 실제 DB 데이터가 있으면 삭제 후 완료 보고.

### Phase 4: 커밋 cadence

작업 범위가 큰 기능 묶음이므로 다음 단위로 커밋하는 것이 안전하다.

1. `feat: support yearly monthly sales targets`
2. `feat: update home dashboard goal and schedule cards`
3. `feat: persist daily operation records on server`
4. `feat: connect response statistics to real data ranges`
5. `feat: add reservation search and date lookup`
6. `feat: complete prepaid ledger customer detail actions`

---

## Recommended implementation order

1. 홈/관리 공지 데이터 model/API/UI first, because 홈 요구사항 depends on 관리 입력.
2. 홈 layout/schedule filtering.
3. 일일 운영 time control, then server persistence.
4. 손님 반응 stats cleanup and calendar range.
5. 예약 search/date lookup.
6. 선결제 selected-customer detail and missing APIs.
7. Full verification and screenshots.

---

## Risks / tradeoffs

- 일일 운영은 현재 localStorage 중심이라 서버 저장 전환이 가장 큰 변경이다. DB migration이 필요하고, 기존 브라우저에 저장된 임시 기록은 자동으로 서버에 올라가지 않는다. 필요하면 별도 “기존 브라우저 기록 가져오기” 버튼을 후속으로 만들 수 있다.
- 매출 목표 12개월 저장은 기존 `annual_goal_notice.value` 단일 문자열과 구조가 다르다. 사용자가 기존 매출 목표 재입력을 허용했으므로 자동 변환은 하지 않는다.
- 손님 반응 분석은 이미 백엔드 통계를 호출하지만, 화면이 샘플 fallback을 섞어 보여 실제 데이터처럼 보일 위험이 있다. fallback 제거 후 실제 데이터가 없으면 화면이 0건/빈 상태로 보인다.
- 선결제 거래는 최신순으로 확정되었다. 되돌리기 버튼도 최신 내역을 먼저 찾기 쉽게 유지한다.

---

## 남은 질문

- 현재 없음. 구현 중 파괴적 데이터 삭제, 실제 결제/정산에 영향을 주는 규칙 변경, 또는 기존 운영 데이터 일괄 이전이 필요해지는 경우에만 추가 확인한다.

---

## Files likely to change summary

- `apps/web/src/modules/home/HomePage.tsx`
- `apps/web/src/modules/daily-log/DailyLogPage.tsx`
- `apps/web/src/modules/response/ResponseInquiryPage.tsx` if needed
- `apps/web/src/modules/statistics/StatisticsPage.tsx`
- `apps/web/src/modules/reservation/ReservationPage.tsx`
- `apps/web/src/modules/prepaid-ledger/PrepaidLedgerPage.tsx`
- `apps/web/src/modules/admin/ManagementPage.tsx`
- `apps/web/src/app/App.test.tsx`
- `apps/api/prisma/schema.prisma`
- `apps/api/src/app.ts`
- `apps/api/src/modules/annual-goal-notice/annual-goal-notice.routes.ts`
- `apps/api/src/modules/daily-log/daily-log.routes.ts` or new daily operation route module
- `apps/api/src/modules/reservation/reservation.routes.ts`
- `apps/api/src/modules/reservation/reservation.schemas.ts`
- `apps/api/src/modules/prepaid-ledger/prepaid-ledger.routes.ts`
- `apps/api/src/modules/prepaid-ledger/prepaid-ledger.schemas.ts`
- relevant API/web tests
