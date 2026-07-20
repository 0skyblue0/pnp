# 웹페이지 기능 및 구현 가이드

이 문서는 현재 `apps/web` 구현을 기준으로 폴앤폴리나 운영 시스템 SPA의 화면 기능, 라우팅, 데이터 연동과 공통 구현 요소를 설명한다. 기획안이 아니라 코드에 존재하는 동작을 기록한 기술 문서다.

## 1. 구성 개요

| 구분 | 구현 |
| --- | --- |
| 클라이언트 | React 18, TypeScript, Vite, Tailwind CSS |
| 라우팅 | `react-router-dom`의 `BrowserRouter` 및 중첩 `Route` |
| 서버 통신 | `fetch` 기반 `apiGet`/`apiPost`/`apiPatch`/`apiPut`/`apiDelete` |
| API 기본 경로 | `VITE_API_BASE_URL` 또는 `/api/v1` |
| 공통 상태 제공 | React Query, 토스트, 확인 대화상자 Provider |
| 아이콘 | `lucide-react` |

진입점은 `apps/web/src/main.tsx`다. `AppProviders`가 화면 전체를 감싸고, `App`이 URL에 맞는 페이지를 선택한다. 프로덕션 빌드에서는 서비스 워커(`/sw.js`)를 등록한다.

```text
main.tsx
└─ AppProviders
   ├─ QueryClientProvider
   ├─ ToastProvider
   └─ ConfirmProvider
      └─ App (BrowserRouter)
         └─ AppLayout (공통 헤더 + 알림 수 + Outlet)
            └─ 기능별 페이지
```

## 2. 전역 레이아웃과 이동

`AppLayout.tsx`는 모든 화면에 다음을 제공한다.

- 브랜드 영역과 현재 날짜(한국어 요일 포함)
- 가로 스크롤을 허용하는 반응형 주요 메뉴
- 알림 화면 링크와 읽지 않은 알림 수 배지. 경로가 바뀔 때마다 `GET /notification?unread=true`로 갱신한다.
- 모바일 최소 폭 320px, 넓은 화면에서는 헤더 메뉴를 가운데 정렬하는 레이아웃

| URL | 화면 | 실제 역할 |
| --- | --- | --- |
| `/` | 리디렉션 | `/home`으로 이동 |
| `/home` | 홈 | 오늘의 업무·예약·반응·매출 목표 및 스케줄 요약 |
| `/daily-log/today` | 일일 운영 | 운영 일지 입력, 엑셀 불러오기, 저장 기록 조회 |
| `/operation` | 리디렉션 | `/daily-log/today`로 이동 |
| `/sales-analysis` | 매출 분석 | 연도별 매출, 목표, 채널, 제품 분석 |
| `/response` | 손님 반응 | 반응 입력 및 분석 화면의 진입점 |
| `/response/new` | 손님 반응 입력 | 반응 입력 화면 직접 진입 |
| `/statistics` | 리디렉션 | `/response?tab=stats`로 이동 |
| `/reservation` | 예약 | 날짜별 예약 등록·검색·상태 변경·삭제 |
| `/regular-customer` | 단골손님 | 단골 목록 및 후보 확인 |
| `/prepaid-ledger` | 선결제 장부 | 선결제 잔액 및 거래 관리 |
| `/staff` | 관리 | 제품, 직원, 공지, 연간 일정, 반응 분류 관리 |
| `/notification` | 알림 | 알림 목록 조회 및 읽음 처리 |

정의되지 않은 경로는 `/home`으로 이동한다.

## 3. 화면별 기능

### 홈 (`HomePage.tsx`)

- 오늘의 일일 운영 작성 여부, 오늘 예약의 전체·대기·픽업완료 수, 오늘 손님 반응 수를 빠른 링크로 표시한다.
- 이번 달 매출 목표, 현재 누적, 남은 목표와 달성률 막대를 계산해 표시한다. 운영 목표와 직원 공지도 함께 표시하며 카드를 누르면 상세 패널을 연다.
- 연간 스케줄, 최근 알림을 보여 준다.
- 초기 로딩에서 일정·공지·알림과 예약/반응/일일운영 데이터를 병렬 요청한다. 홈의 보조 데이터 요청이 일부 실패해도 화면 전체를 막지 않는다.

### 일일 운영 (`DailyLogPage.tsx`)

- 입력과 데이터 조회 모드를 전환한다.
- 입력 모드에는 환경·근무 정보, 제품별 생산·판매(판매량 자동 계산), 채널별 매출과 객단가, 메모·점검 항목이 있다.
- 필수 항목이 비어 있으면 저장 전 누락 항목을 안내하고, 항목을 누르면 해당 입력 영역으로 이동한다.
- `PUT /daily-operation/:date`로 날짜별 일지를 저장하고, 기록을 기간/월/일 단위로 조회·비교·수정·삭제한다.
- `DailyOperationExcelImportPanel`은 엑셀 파일을 Base64로 변환해 미리보기(`POST /import/daily-operation-excel/preview`)한 뒤 반영(`POST /import/daily-operation-excel/apply`)한다.
- 활성 제품 목록은 `GET /product?active=true`에서 받아 입력 행을 구성한다.

### 매출 분석 (`SalesAnalysisPage.tsx`)

- 연도를 선택하면 `GET /sales-analysis/summary?year=YYYY`를 호출한다.
- 월별 목표 달성 흐름, 채널별 매출 비중, 판매 상위 제품, 손실 점검 제품, 정리가 필요한 데이터 목록을 표시한다.

### 손님 반응 (`ResponseInquiryPage.tsx` 및 하위 화면)

- URL 쿼리로 화면 상태를 유지한다. 기본은 반응 입력이며, `?mode=lookup`은 분석 모드, `?mode=lookup&tab=detail`은 상세 기록이다.
- 입력 화면(`ResponseEntryPage`)은 반응 분류를 대/중/소분류로 선택하고 원문을 저장한다. 분류 제안은 `POST /response/suggest`, 저장은 `POST /response`를 사용한다.
- 대표 요약(`StatisticsPage`)은 기간을 선택해 `GET /response/stats`를 호출하고, 확인 필요 건수·분류별 신호·대표 주제·원문 인용을 제공한다.
- 상세 기록(`ResponseListPage`)은 기간, 분류, 확인 필요 여부 등의 조건으로 `GET /response`를 조회한다. 항목 수정·재분류 제안·삭제를 지원한다.

### 예약 (`ReservationPage.tsx`)

- 기준 날짜와 검색어로 예약을 조회하고, 빠른 날짜/픽업 시간 선택을 지원한다.
- 손님 이름·연락처·픽업 일시·제품별 수량·메모로 신규 예약을 등록하거나 기존 예약을 수정한다.
- 예약 상태 변경, 삭제와 활성 제품 목록 로딩을 지원한다.
- 주요 API는 `GET/POST /reservation`, `PATCH /reservation/:id`, `PATCH /reservation/:id/status`, `DELETE /reservation/:id`, `GET /product?active=true`다.

### 단골손님 (`RegularCustomerPage.tsx`)

- 이름 또는 연락처로 저장된 단골을 검색한다.
- 예약·반응 등의 데이터에서 추출된 확인 대상 후보를 별도 목록으로 보여 주며, 후보를 단골로 등록할 수 있다.
- `GET /regular-customer`, `GET /regular-customer/candidates`, `POST /regular-customer`를 사용한다.

### 선결제 장부 (`PrepaidLedgerPage.tsx`)

- 고객명/연락처 검색, 새 선결제 등록, 고객별 상세 장부 조회를 제공한다.
- 일반 사용·공동 사용·충전·메모 수정·거래 삭제와 포인트 적립 완료 여부를 관리한다.
- 공동 선결제는 참여자와 1인 한도를 입력하고, 상세 화면에서 공동 사용 현황을 확인한다.
- `/prepaid-ledger` 및 `/:id/use`, `/:id/shared-use`, `/:id/charge`, `/:id/transactions/:transactionId` API를 사용한다.

### 관리 (`ManagementPage.tsx`)

- 제품: 검색, 신규 등록/수정/삭제, 활성 상태, 시즌, 카테고리, 드래그 또는 상·하단 이동을 통한 노출 순서 변경.
- 직원: 직원 정보의 등록/수정/삭제.
- 홈 목표·공지: 매출/운영/직원 공지와 월별 매출 목표의 등록/수정/삭제.
- 연간 스케줄: 월 이동 캘린더에서 일정, 구분(톤), 메모의 등록/수정/삭제.
- 반응 기준: 대·중·소분류 계층을 생성·수정·활성화·삭제.
- 제품·직원 조회 탭에서 관리 대상 목록을 확인한다.

### 알림 (`NotificationPage.tsx`)

- 알림 목록을 조회하고 개별 알림 또는 전체 알림을 읽음으로 바꾼다.
- `GET /notification`, `PATCH /notification/:id/read`, `PATCH /notification/read-all`을 사용한다.

## 4. 공통 구현 요소

### API와 보안 처리

- `shared/api/client.ts`는 응답을 공통 `ApiEnvelope`로 변환하고 쿠키를 포함(`credentials: "include"`)해 요청한다.
- 변경 요청(POST/PATCH/PUT/DELETE)은 최초에 `GET /auth/csrf`로 CSRF 토큰을 받아 `X-CSRF-Token` 헤더에 넣는다.
- 기본 API 경로는 `/api/v1`이므로 화면의 `/reservation` 요청은 서버의 `/api/v1/reservation`으로 전송된다.

### UI와 접근성

- Tailwind 기반의 공통 클래스(`.panel`, `.input`, `.section-title`, `.dc-card` 등)를 `styles/index.css`에 정의해 밝은 크림/브라운 계열 디자인을 일관되게 사용한다.
- 모바일에서 메뉴와 넓은 표는 잘리지 않도록 최소 폭과 가로 스크롤을 고려한다.
- 탭에는 `role="tablist"`/`role="tab"`/`aria-selected`, 입력 요소에는 한국어 `aria-label`을 부여한다.
- `ConfirmProvider`는 포털 기반 확인 창, 배경 클릭/ESC 취소, 확인 버튼 자동 포커스를 제공한다.
- `ToastProvider`는 성공·오류·정보 토스트를 포털로 표시하고 3.5초 후 자동 해제한다.

### 상태와 데이터 갱신

- 개별 화면은 현재 주로 `useState`, `useEffect`, `useCallback`으로 로컬 상태와 API 로딩을 관리한다.
- React Query Provider는 준비되어 있으며 기본적으로 30초 동안 데이터를 fresh로 간주하고 창 포커스 시 자동 재조회하지 않는다.
- `shared/time/storeTime.ts`는 매장 기준 날짜를 계산하는 유틸리티로, 홈·일일 운영·예약의 날짜 기본값에 사용된다.

## 5. 관련 파일 안내

| 목적 | 주요 위치 |
| --- | --- |
| 라우트 정의 | `apps/web/src/app/App.tsx` |
| 공통 헤더/메뉴 | `apps/web/src/app/layouts/AppLayout.tsx` |
| 페이지별 UI | `apps/web/src/modules/<도메인>/*Page.tsx` |
| API 클라이언트 | `apps/web/src/shared/api/client.ts` |
| 공유 API 타입 | `apps/web/src/shared/api/types.ts`, `packages/shared/src` |
| 공통 UI | `apps/web/src/shared/ui` |
| 서버 라우트 등록 | `apps/api/src/app.ts` |
| API 계약 | `docs/api/openapi.yaml` |
| E2E 테스트 | `apps/web/tests/e2e` |

`apps/web/src/modules/operation/OperationPage.tsx`는 재고 소진·폐기·시식·생산 로트 중심의 별도 운영 화면 구현을 보유하지만, 현재 `App.tsx`의 `/operation`은 일일 운영 화면으로 리디렉션하므로 일반 내비게이션에서는 렌더링되지 않는다.

## 6. 실행과 검증

개발 서버 포트는 프로젝트 규칙에 따라 항상 `5173`이다.

```bash
npm run dev -w @pnp/web
npm run test -w @pnp/web
npm run test:e2e -w @pnp/web
npm run typecheck
```

웹 E2E 테스트는 `apps/web/tests/e2e/home.spec.ts`, `ui-interactions.spec.ts`에 있으며, 컴포넌트/유틸리티 테스트는 각 모듈의 `*.test.tsx`와 `shared/time/storeTime.test.ts`에 있다.
