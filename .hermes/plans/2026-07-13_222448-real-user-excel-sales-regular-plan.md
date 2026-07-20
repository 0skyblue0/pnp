# 실사용 안정화·엑셀 첨부·매출 분석·단골손님리스트 계획

> **For Hermes:** 이 문서는 구현 전 설계/계획이다. 구현 시에는 `pnp-bakery-operations-ux`, `test-driven-development`, `pnp-daily-operation-import-workflow`, `pnp-commit-cadence`를 함께 사용한다.

**Goal:** 개발자가 아닌 실제 매장 직원/대표가 웹사이트를 쓰면서 겪을 문제를 줄이고, 엑셀 첨부 기반 분류 흐름과 `매출 분석`, `단골손님리스트` 기능을 안전하게 추가한다.

**Architecture:** 기존 PNP 운영 사이트는 일일 운영 기록을 `DailyOperationRecord` JSON(`draft`, `productRows`, `channelRows`, `staffSpecialRows`)으로 저장하고, 손님 반응은 `CustomerResponse` + `ResponseCriterion` 구조로 저장한다. 새 기능은 기존 데이터 구조를 최대한 재사용하되, 엑셀 업로드/분석 결과처럼 반복 조회·검수·재시도가 필요한 데이터는 별도 `ImportJob`/분석 API로 분리한다.

**Tech Stack:** React/Vite web, Fastify API, Prisma/PostgreSQL, existing `xlsx` parser, Hermes classifier sidecar for 손님 반응 AI 분류.

---

## 0. 현재 코드/데이터 기준

확인한 현재 상태:

- 라우팅
  - `apps/web/src/app/App.tsx:20-28`
  - 주요 화면: `/home`, `/daily-log/today`, `/response`, `/reservation`, `/prepaid-ledger`, `/staff`
- 일일 운영 저장 API
  - `apps/api/src/modules/daily-log/daily-operation.routes.ts:52-129`
  - `GET /api/v1/daily-operation?from&to`, `GET/PUT/DELETE /api/v1/daily-operation/:date`
  - 현재 `PUT`은 `draft`, `productRows`, `channelRows`, `staffSpecialRows` 전체를 날짜별 upsert
- 일일 운영 DB
  - `apps/api/prisma/schema.prisma:296-308`
  - `DailyOperationRecord`는 날짜 unique + JSON 4개 필드
- 기존 일일업무보고서 엑셀 파서
  - `apps/api/src/modules/daily-log/excel-import/daily-operation-excel-parser.ts:1-260`
  - 이미 일일 운영 기록 + 손님 반응 후보(`customerResponseRows`)를 파싱할 수 있음
  - 원문 섹션은 `draft.rawSections`로 보존
- 손님 반응 DB/API
  - `apps/api/prisma/schema.prisma:205-250`
  - `CustomerResponse`는 날짜, 대/중/소분류 기준, 요약, 원문, AI 여부를 저장
  - `apps/api/src/modules/response/response.routes.ts`에 대표 요약/반복 주제/주의 신호 로직 존재
- 단골 관련 기존 모델
  - `apps/api/prisma/schema.prisma:151-162`에 `RegularCustomer` 존재
  - 현재 예약 고정 메모용 단순 모델: 이름, 연락처, fixedMemo, active
- 선결제 고객 모델
  - `apps/api/prisma/schema.prisma:164-190`
  - 잔액/사용 내역은 이미 고객 단위로 관리

---

## 1. 실사용자가 겪을 문제점·변수 예측과 개선 설계

### 1.1 실제 사용자 유형

1. 매장 직원
   - 빠르게 입력해야 함
   - 모바일/태블릿/작은 화면 가능성 높음
   - 엑셀/날짜/금액/제품명에 익숙하지만 개발 용어에는 익숙하지 않음
2. 대표/관리자
   - 매출 흐름, 제품별 수요, 단골/예약 흐름을 보고 싶음
   - 숫자의 근거와 원문 기록을 확인하고 싶음
3. 신규 직원
   - 어떤 항목을 어디에 입력해야 하는지 모름
   - 제품명/분류 기준/예약 옵션 실수 가능성 높음

### 1.2 공통 사용 문제

#### A. 접속/서버 문제

예상 문제:
- 사이트 접속 주소를 모름
- 브라우저에서 새로고침 후 빈 화면/오류
- API만 죽고 web은 살아 있는 상태
- 네트워크가 느려 저장 버튼을 여러 번 누름

개선 설계:
- 홈 상단 또는 알림 영역에 `저장 실패 시 새로고침하지 말고 다시 저장 버튼을 눌러주세요` 같은 직원 문구 추가
- 모든 저장 버튼에 중복 클릭 방지 `저장 중` 상태 적용
- API 실패 메시지를 개발자 문구가 아닌 `저장하지 못했습니다. 인터넷/서버 상태 확인 후 다시 눌러주세요.`로 통일
- `/healthz` 또는 API health 실패 시 홈에 `서버 확인 필요` 배너 표시 검토

구현 후보:
- 공통 API 에러 유틸: `apps/web/src/shared/api/client.ts`
- 공통 저장 상태/Toast 패턴: `apps/web/src/shared/ui/Toast.tsx`

#### B. 날짜/시간 실수

예상 문제:
- 오늘이 아닌 날짜에 잘못 저장
- 예약 픽업 날짜와 등록 날짜 혼동
- 월/주 조회 범위가 실제로 어떤 기간인지 모름
- 브라우저 date input이 `MM/DD/YYYY`처럼 표시되어 헷갈림

개선 설계:
- 모든 날짜 입력 옆에 한국어 표시 `2026년 7월 13일 (월)` 보조 텍스트 추가
- 저장 전 확인 문구: `2026년 7월 13일 기록으로 저장합니다.`
- 일일 운영 조회 결과에는 기간을 항상 `YYYY.MM.DD ~ YYYY.MM.DD`로 표시
- 예약/스케줄/일일 운영 날짜 칩은 클릭 후에만 선택 표시

#### C. 입력 누락/중복 저장

예상 문제:
- 일일 운영 필수 항목을 일부 누락
- 제품별 생산/판매 입력 후 매출만 저장하고 제품 입력이 비어 있음
- 같은 날짜 데이터를 덮어쓰는지 새로 저장하는지 모름
- 손님 반응 저장 전 AI 분류만 하고 실제 저장을 안 함

개선 설계:
- 현재 일일 운영의 `빠진 항목` 체크리스트를 유지하되, 저장 버튼 주변에 더 강하게 노출
- 같은 날짜 기존 기록이 있을 때 `이 날짜 기록이 이미 있습니다. 수정 저장합니다.` 표시
- 손님 반응은 단계 표시를 명확히: `1 실제 기록 입력 → 2 AI 분류 → 3 확인 후 저장`
- 저장 완료 후 `방금 저장됨` + 저장 날짜/요약 표시

#### D. 제품명/분류명 혼동

예상 문제:
- 제품명을 손으로 입력하면 오탈자 발생
- 과거 엑셀 제품명과 현재 제품명이 다름
- 손님 반응 기준이 너무 많아 직원이 직접 고르기 어려움

개선 설계:
- 제품 입력은 계속 제품 마스터 기반 드롭다운 사용
- 엑셀 업로드에는 `제품명 매칭 확인` 단계 추가
- 손님 반응은 기본적으로 AI 추천 → 직원 확인 흐름 유지
- 분류 직접 수정은 숨겨두되, 필요 시 열 수 있게 유지

#### E. 화면 밀도/모바일 문제

예상 문제:
- 표가 길어 모바일에서 가로 스크롤 발생
- 카드가 많아 처음 보는 사람이 어디부터 눌러야 하는지 모름
- 관리 탭은 기능이 많아 신규 직원이 실수로 기준 데이터를 변경할 수 있음

개선 설계:
- 홈은 `오늘 해야 할 일`만 우선 노출
- 관리 탭은 `제품/직원/반응 기준/홈 공지/연간 스케줄` 설명을 지금처럼 유지하되 위험 작업(삭제)은 확인 강화
- 표는 모바일에서 요약 카드 + 펼침 상세로 전환
- 실사용 검증은 390x844 모바일 뷰포트와 일반 데스크톱 둘 다 확인

#### F. 데이터 신뢰/근거 문제

예상 문제:
- 분석 숫자가 어떤 기록에서 나온 것인지 모름
- 엑셀에서 가져온 데이터인지 직접 입력한 데이터인지 구분 안 됨
- AI 분류가 틀렸을 때 고칠 수 있는지 모름

개선 설계:
- 모든 분석 수치에는 `근거 보기` 링크 제공
- 엑셀 import 데이터에는 `엑셀에서 가져옴` 배지 + 원본 파일명/시트명 보존
- 손님 반응 AI 분류에는 `AI 분류`/`직원 분류` 배지 유지
- 중요한 자동 분류는 저장 전 검수 화면에서 직원이 수정 가능해야 함

---

## 2. 엑셀 파일 첨부 시 일일 운영·손님 반응 분류 가능성 및 계획

### 2.1 가능성 판단

가능하다. 이미 서버 쪽에 일일업무보고서용 `xlsx` 파서가 있고, 다음을 수행한다.

- 일별 시트 파싱
- 제품 행 파싱
- POS/POS 외 매출 파싱
- 직원 특이사항 일부 파싱
- 원문 섹션 보존
- `서비스내역 및 손님 특이사항`을 손님 반응 후보로 분리

다만 현재는 CLI 중심이다. 개발자가 아닌 사용자가 웹에서 파일을 첨부해 쓰려면 `업로드 → 미리보기 → 매칭 확인 → 저장` 화면이 필요하다.

### 2.2 반드시 필요한 기능

#### A. 웹 업로드 화면

위치 제안:
- `/daily-log/today` 안 `엑셀 불러오기` 버튼
- 또는 관리 탭 안 `엑셀 자료 불러오기` 별도 카드

직원 화면 문구:
- `일일업무보고서 엑셀 불러오기`
- `저장 전 미리보기에서 날짜와 제품명을 확인하세요.`

흐름:
1. 파일 선택
2. 서버에 업로드
3. 서버가 dry-run 파싱
4. 미리보기 표시
5. 직원이 문제 있는 항목 수정/확인
6. `일일 운영에 저장`, `손님 반응 후보 저장` 실행

#### B. ImportJob 모델 추가

새 DB 모델 후보:

```prisma
model ImportJob {
  id             BigInt   @id @default(autoincrement())
  sourceType     String   @map("source_type") @db.VarChar(30) // DAILY_OPERATION_EXCEL
  fileName       String   @map("file_name") @db.VarChar(200)
  fileHash       String   @map("file_hash") @db.VarChar(64)
  status         String   @db.VarChar(20) // DRY_RUN, APPLIED, FAILED
  parsedSummary  Json     @map("parsed_summary")
  warnings       Json
  createdAt      DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  appliedAt      DateTime? @map("applied_at") @db.Timestamptz(6)

  @@index([fileHash], map: "idx_import_job_file_hash")
  @@map("import_job")
}
```

이유:
- 같은 파일 중복 업로드 감지
- 실패/경고 기록 보존
- 어떤 기록이 엑셀에서 왔는지 추적

#### C. API 추가

후보 파일:
- `apps/api/src/modules/import/import.routes.ts`
- `apps/api/src/modules/import/import.schemas.ts`
- `apps/api/src/modules/import/import.routes.test.ts`

엔드포인트:
- `POST /api/v1/import/daily-operation-excel/preview`
  - multipart file 업로드
  - 응답: 날짜별 미리보기, 제품명 매칭 결과, 손님 반응 후보, 경고
- `POST /api/v1/import/daily-operation-excel/apply`
  - preview job id 또는 업로드 token 기준 저장
  - 응답: 저장된 일일 운영 수, 손님 반응 후보 수, 건너뛴 항목

주의:
- 현재 Fastify에 multipart가 없으면 `@fastify/multipart` 의존성 추가 필요
- 파일 크기 제한 필요: 예) 10MB 또는 20MB
- 허용 확장자: `.xlsx`, `.xlsm` 우선. `.xls`는 별도 검토

#### D. 미리보기 UI

후보 파일:
- `apps/web/src/modules/daily-log/DailyLogPage.tsx`에 간단히 넣기보다, 기능이 커지므로 별도 컴포넌트 권장
- `apps/web/src/modules/daily-log/DailyOperationExcelImportPanel.tsx`

미리보기 화면 구조:
1. 상단 요약
   - `읽은 날짜 31일`
   - `일일 운영 저장 가능 31일`
   - `손님 반응 후보 12건`
   - `확인 필요 3건`
2. 날짜별 목록
   - 날짜
   - 매출 합계
   - 제품 행 수
   - 손님 반응 후보 수
   - 경고 배지
3. 제품명 확인
   - `엑셀명` → `사이트 제품명`
   - 자동 매칭/수동 선택/새 비활성 제품으로 보존
4. 손님 반응 후보 확인
   - 원문
   - AI 추천 분류
   - 저장/제외 체크
5. 최종 저장 버튼
   - `확인한 내용만 저장`

#### E. 손님 반응 분류 흐름

현재 파서는 손님 반응 후보의 `shortSummary`, `fullText`만 만들 수 있다. 웹 업로드에서 실제 저장하려면 각 후보를 `CustomerResponse` 기준으로 분류해야 한다.

권장 흐름:
1. 파서가 후보 텍스트 생성
2. API가 후보마다 `/response/suggest`와 같은 분류 로직 재사용
3. 미리보기에서 직원이 확인/수정
4. 저장 시 `CustomerResponse` 생성
5. 엑셀 출처는 `fullText` 앞부분 또는 추후 `sourceMeta` 컬럼으로 보존

중요한 분류 정책:
- 단순 매출/판매 현황은 손님 반응으로 저장하지 않음
- 실제 손님 말/문의/칭찬/불만/방문 이유만 저장
- 제품별 판매 요약은 매출 분석/일일 운영 rawSections에 남김
- `확인 필요`는 불만/환불/위생/이물/품질 위험 등 엄격 기준만

### 2.3 엑셀 업로드의 변수와 대응

| 변수 | 문제 | 대응 |
|---|---|---|
| 파일 양식이 다름 | 셀 위치가 맞지 않음 | 미리보기에서 `알 수 없는 양식` 표시, 원문만 보존 |
| 날짜 셀이 깨짐 | 날짜별 저장 불가 | 시트명 `N일` + 같은 파일의 연월 추론, 실패 시 직원 선택 |
| 제품명 불일치 | 새 제품/오탈자 발생 | 제품명 매칭 단계 필수 |
| 같은 날짜 기존 기록 | 덮어쓰기 위험 | `기존 기록 있음` 표시 후 선택: 건너뛰기/수정 저장 |
| 손님 반응 후보 과다 | 쓸모없는 기록 저장 | 기본은 `손님 말로 보이는 것만 선택`, 나머지는 제외 |
| AI 분류 실패 | 저장 중단 위험 | 직원 직접 분류 또는 `분류 보류`로 저장 가능 |
| 개인정보 | 연락처/이름 포함 가능 | 저장 전 미리보기에서 개인정보 마스킹/주의 표시 |
| 큰 파일/여러 파일 | 브라우저 느림 | 서버 preview job 방식, 진행률 표시 |

### 2.4 구현 순서

1. 기존 parser를 `preview` API에서 호출 가능하도록 순수 함수/서비스로 정리
2. `ImportJob` migration 추가
3. `@fastify/multipart` 기반 업로드 API 추가
4. API 테스트: 정상 파일, 날짜 오류, 제품명 미매칭, 중복 파일, 기존 날짜 충돌
5. 웹 `엑셀 불러오기` 패널 추가
6. 제품명 매칭 UI 추가
7. 손님 반응 후보 검수 UI 추가
8. apply API 추가
9. 브라우저에서 실제 `Docs/User_Send` 엑셀로 dry-run/저장 검증

---

## 3. 매출 분석 기능 계획

### 3.1 목표

대표가 매출을 숫자만 보는 것이 아니라 `언제/어떤 제품/어떤 채널/어떤 원인`으로 매출이 움직였는지 확인하게 한다.

직원용 이름 후보:
- 상단 메뉴: `매출 분석`
- 화면 제목: `매출 흐름 보기`
- 탭: `월별`, `주별`, `제품별`, `채널별`, `특이사항`

### 3.2 데이터 소스

1. `DailyOperationRecord`
   - 총매출 = POS + POS 외 channelRows amount
   - 객수 = POS 건수 + POS 외 건수
   - 객단가 = 총매출 / 객수
   - 제품별 생산/판매/손실/시식/재고 = productRows
2. `AnnualGoalNotice`
   - 월별 매출 목표(`monthlyTargets`)와 비교 가능
3. `CustomerResponse`
   - 매출 기회/놓친 매출/제품 점검 신호와 연결 가능
4. `Reservation`
   - 예약 매출 추정은 아직 결제 금액이 없으므로 바로 매출로 넣지 말고 `예약 건수/제품 수요`로만 표시
5. `PrepaidTransaction`
   - 선결제 충전/사용은 매출 인식 기준을 정해야 함
   - 기본 설계: `사용 차감`을 실제 상품 출고 기준 보조 지표로 표시, POS 매출과 합산하지 않음

### 3.3 1차 기능 범위

#### A. 상단 요약 카드

- 이번 달 누적 매출
- 목표 대비 달성률
- 전월 같은 기간 대비
- 일 평균 매출
- 객단가
- POS / POS 외 비중

주의:
- 데이터 없으면 0 표시, 샘플 금지
- 전월 비교는 같은 일수 기준으로 비교
  - 예: 7월 1~13일 vs 6월 1~13일

#### B. 추세 차트

- 일별 매출 막대/선 차트
- 요일별 평균 매출
- 주차별 합계

차트 라이브러리 선택:
- 현재 의존성 확인 후 없으면 CSS/간단 SVG 우선
- 무거운 chart dependency는 필요성 확인 후 추가

#### C. 제품별 분석

- 판매 수량 TOP 10
- 손실 수량 TOP 10
- 시식 수량 대비 판매 전환 힌트
- 품절/찾는 제품 신호가 있는 제품

주의:
- productRows가 JSON이므로 API에서 안전하게 숫자 변환 필요
- 과거 제품명과 현재 제품명 매칭 문제를 고려해야 함

#### D. 채널별 분석

- POS, 배민 등 POS 외 채널별 매출/건수
- 채널별 객단가
- 채널 비중 변화

#### E. 근거 보기

각 카드/차트에서 클릭하면 해당 날짜 또는 제품의 원본 일일 운영 기록으로 이동:
- `/daily-log/today?mode=lookup&date=YYYY-MM-DD` 또는 현재 라우팅에 맞춰 query 설계

### 3.4 API 설계

새 모듈 후보:
- `apps/api/src/modules/sales-analysis/sales-analysis.routes.ts`
- `apps/api/src/modules/sales-analysis/sales-analysis.service.ts`
- `apps/api/src/modules/sales-analysis/sales-analysis.routes.test.ts`

엔드포인트:
- `GET /api/v1/sales-analysis/summary?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `GET /api/v1/sales-analysis/products?from&to`
- `GET /api/v1/sales-analysis/channels?from&to`

응답 예시:

```ts
type SalesAnalysisSummaryDto = {
  from: string;
  to: string;
  totalSales: number;
  totalCount: number;
  averageTicket: number;
  dailyAverageSales: number;
  previousPeriodChangeRate: number | null;
  targetAmount: number | null;
  targetProgressRate: number | null;
  daily: Array<{ date: string; sales: number; count: number; averageTicket: number }>;
  weekdayAverages: Array<{ weekday: string; averageSales: number; days: number }>;
  channels: Array<{ name: string; amount: number; count: number; ratio: number }>;
};
```

### 3.5 웹 화면 설계

새 파일 후보:
- `apps/web/src/modules/sales-analysis/SalesAnalysisPage.tsx`
- `apps/web/src/app/App.tsx`에 `/sales-analysis` route 추가
- `apps/web/src/app/layouts/AppLayout.tsx`에 메뉴 추가

화면 구조:
1. 기간 선택
   - 이번 달 / 지난 달 / 최근 30일 / 직접 선택
2. 핵심 카드 5개
3. 목표 달성률 progress bar
4. 일별 매출 차트
5. 제품 TOP / 손실 TOP / 채널별 카드
6. 아래쪽 `근거 기록` 목록

직원/대표 문구:
- `이번 달 매출 흐름`
- `목표까지 남은 금액`
- `많이 팔린 제품`
- `손실이 많았던 제품`
- `POS 외 매출`

### 3.6 매출 분석 위험 요소

- 과거 엑셀 데이터의 매출 합계 경고가 있을 수 있음
  - 분석 카드에 `확인 필요 데이터 N일 포함` 표시
- POS 외 채널명이 제각각일 수 있음
  - 채널명 normalization 필요 (`배 민` → `배민` 등)
- 제품명 변경/비활성 제품이 있을 수 있음
  - 분석에서는 과거 이름도 보이게 하되 제품 마스터와 매칭 표시
- 선결제 충전은 매출이 아닐 수 있음
  - 1차에서는 POS/POS 외 기준 매출만 사용

---

## 4. 단골손님리스트 기능 계획

### 4.1 목표

예약, 선결제, 손님 반응에서 반복 등장하는 손님을 직원이 쉽게 찾고, 자주 하는 요청/주의사항을 잊지 않게 한다.

기능 이름 후보:
- 메뉴: `단골손님`
- 화면 제목: `단골손님 리스트`
- 설명: `자주 오시거나 예약·선결제를 자주 쓰는 손님 메모를 모아 봅니다.`

주의:
- CRM 같은 표현 금지
- 개인정보 노출 최소화
- 자동 추정과 직원이 직접 등록한 단골을 구분

### 4.2 현재 활용 가능한 데이터

1. `RegularCustomer`
   - 이미 이름/연락처/고정 메모 저장 가능
   - 현재는 예약 단골 메모 성격
2. `Reservation`
   - `customerName`, `contactPhone`, `items`, `memo`, `pickupAt`, `status`
3. `PrepaidCustomer`
   - 선결제 고객, 잔액, 사용/충전 내역
4. `CustomerResponse`
   - `customerCardId`는 있으나 현재 이름/연락처와 직접 연결된 고객 카드 모델은 없음
   - fullText에 이름이 있을 수 있지만 자동 추출은 개인정보/오탐 주의

### 4.3 데이터 모델 설계

1차 최소 설계는 기존 `RegularCustomer` 확장.

마이그레이션 후보:

```prisma
model RegularCustomer {
  id           BigInt   @id @default(autoincrement())
  customerName String   @map("customer_name") @db.VarChar(80)
  contactPhone String?  @map("contact_phone") @db.VarChar(40)
  fixedMemo    String   @map("fixed_memo") @db.Text
  preferenceMemo String? @map("preference_memo") @db.Text
  cautionMemo String? @map("caution_memo") @db.Text
  source       String   @default("MANUAL") @db.VarChar(20) // MANUAL, RESERVATION, PREPAID
  lastVisitAt  DateTime? @map("last_visit_at") @db.Timestamptz(6)
  reservationCount Int @default(0) @map("reservation_count")
  prepaidUseCount Int @default(0) @map("prepaid_use_count")
  isActive     Boolean  @default(true) @map("is_active")
  createdAt    DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt    DateTime @default(now()) @map("updated_at") @db.Timestamptz(6)
}
```

더 안전한 장기 설계:
- `CustomerCard` 모델을 새로 만들고 Reservation/Prepaid/Response를 연결
- 하지만 1차 구현은 과함. 우선 `RegularCustomer` 확장 + 통합 조회 API가 좋음

### 4.4 단골 산정 기준

자동 후보 기준:
- 예약 2회 이상
- 선결제 고객으로 등록됨
- 같은 이름+연락처가 반복 등장
- 직원이 직접 `단골 등록` 누름

자동 등록은 위험하므로 기본은 `단골 후보`로 보여주고 직원이 확정:
- `단골 후보 3명` 카드
- `단골로 저장` 버튼
- 저장 전 이름/연락처/메모 확인

### 4.5 API 설계

새 모듈 후보:
- `apps/api/src/modules/regular-customer/regular-customer.routes.ts`
- `apps/api/src/modules/regular-customer/regular-customer.schemas.ts`
- `apps/api/src/modules/regular-customer/regular-customer.routes.test.ts`

엔드포인트:
- `GET /api/v1/regular-customer?query=&source=&active=true`
  - 직접 등록 단골 + 예약/선결제 통합 요약
- `GET /api/v1/regular-customer/candidates`
  - 예약/선결제 반복 기준 후보
- `POST /api/v1/regular-customer`
  - 직접 단골 등록
- `PATCH /api/v1/regular-customer/:id`
  - 메모/주의사항/상태 수정
- `DELETE /api/v1/regular-customer/:id`
  - 비활성 처리

응답 예시:

```ts
type RegularCustomerDto = {
  id: string;
  customerName: string;
  contactPhone: string | null;
  fixedMemo: string;
  preferenceMemo: string | null;
  cautionMemo: string | null;
  source: "MANUAL" | "RESERVATION" | "PREPAID";
  reservationCount: number;
  prepaidBalance: number | null;
  prepaidUseCount: number;
  lastVisitAt: string | null;
  recentReservations: Array<{ date: string; products: string; memo: string | null }>;
  recentPrepaidTransactions: Array<{ type: string; amount: number; occurredAt: string }>;
};
```

### 4.6 웹 화면 설계

새 파일 후보:
- `apps/web/src/modules/regular-customer/RegularCustomerPage.tsx`
- `apps/web/src/app/App.tsx`에 `/regular-customer` route 추가
- `apps/web/src/app/layouts/AppLayout.tsx`에 메뉴 추가 또는 `예약`/`선결제 장부` 내부 보조 탭으로 시작

화면 구조:
1. 검색 영역
   - 이름/전화번호 검색
   - `주의 메모 있음`, `예약 단골`, `선결제 손님` 필터
2. 요약 카드
   - 전체 단골
   - 최근 30일 예약 단골
   - 선결제 이용 손님
   - 확인 필요한 메모
3. 단골 리스트 카드
   - 이름 + 연락처 일부 마스킹
   - 최근 방문/예약일
   - 자주 사는 제품
   - 고정 메모
   - 주의 메모
   - `예약 등록에 메모 넣기` / `선결제 장부 보기`
4. 후보 영역
   - `예약이 반복된 손님`
   - `선결제 등록 손님`
   - `단골로 저장`

### 4.7 예약/선결제와 연결

예약 등록 화면:
- 이름/연락처 입력 시 단골 메모 자동 추천
- `단골손님 메모 적용` 버튼
- 예약 메모에 자동으로 덮어쓰지 말고 직원 확인 후 적용

선결제 장부:
- 선결제 고객 카드에 `단골 메모` 바로가기
- 선결제 고객을 단골 후보로 표시

손님 반응:
- 1차에서는 직접 연결하지 않음
- 나중에 고객 카드 모델이 생기면 특정 손님 반응 기록과 연결 가능

### 4.8 개인정보/운영 위험

- 연락처는 목록에서 일부 마스킹: `010-1234-****`
- 검색 시에는 전체 입력 가능
- 삭제는 물리 삭제보다 비활성 처리
- 직원이 보는 메모는 민감할 수 있으므로 과격한 표현을 피하게 안내
- `주의 메모`는 불만 고객 낙인처럼 보이지 않게 `확인 메모` 또는 `챙길 메모` 표현 검토

---

## 5. 구현 우선순위 제안

### 1단계: 실사용 안정화 체크리스트 개선

작업:
- 저장 실패/저장 중/기존 날짜 덮어쓰기 메시지 정리
- 날짜 표시 보강
- 분석 수치 근거 링크 설계
- 모바일 주요 화면 재검증

이유:
- 새 기능 추가 전 기본 사용성을 먼저 안정화해야 함

### 2단계: 엑셀 업로드 preview만 먼저 구현

작업:
- 업로드 API preview
- ImportJob 저장
- 웹 미리보기 화면
- apply는 아직 막고 dry-run/검수만 제공

이유:
- 실제 파일 변수와 오분류 위험을 먼저 확인해야 함

### 3단계: 엑셀 apply 구현

작업:
- 직원이 확인한 일일 운영 기록 저장
- 손님 반응 후보 저장
- 중복 날짜/중복 파일 방지

### 4단계: 매출 분석 1차

작업:
- 기존 `DailyOperationRecord` 기반 API
- `/sales-analysis` 화면
- 월별/최근 30일/직접 기간
- 제품/채널 TOP

이유:
- 이미 일일 운영 데이터가 있고 대표에게 즉시 가치가 큼

### 5단계: 단골손님리스트 1차

작업:
- 기존 `RegularCustomer` 확장
- 예약/선결제 기반 후보 조회
- 직원 확정형 단골 리스트

이유:
- 개인정보/자동 추정 위험이 있으므로 매출 분석보다 한 단계 뒤가 안전

---

## 6. 테스트/검증 계획

### API 테스트

- `apps/api/src/modules/import/import.routes.test.ts`
  - 정상 엑셀 preview
  - 날짜 오류 fallback
  - 제품명 미매칭
  - 기존 날짜 충돌
  - 같은 파일 중복 업로드
  - 손님 반응 후보 생성/제외
- `apps/api/src/modules/sales-analysis/sales-analysis.routes.test.ts`
  - 총매출/객수/객단가 계산
  - 전월 같은 기간 비교
  - 월 목표 대비 달성률
  - 제품별/채널별 집계
- `apps/api/src/modules/regular-customer/regular-customer.routes.test.ts`
  - 직접 등록/수정/비활성
  - 예약 반복 후보
  - 선결제 고객 후보
  - 연락처 검색

### Web 테스트

- `apps/web/src/app/App.test.tsx`
  - 엑셀 업로드 preview UI
  - 제품명 매칭 확인
  - 손님 반응 후보 제외/저장 선택
  - 매출 분석 카드/차트/빈 상태
  - 단골손님 리스트/후보/메모 적용

### 브라우저 검증

포트는 반드시 5173 사용.

- `/daily-log/today`
  - 엑셀 불러오기 버튼/미리보기
  - 기존 일일 운영 저장 흐름 깨지지 않음
- `/response?mode=lookup`
  - 엑셀에서 저장된 손님 반응이 근거와 함께 보임
- `/sales-analysis`
  - 데이터 없음/데이터 있음 모두 확인
  - 모바일 390x844에서 가로 overflow 확인
- `/regular-customer`
  - 검색/후보/메모 카드 확인
- `/reservation`
  - 단골 메모 적용 흐름 확인
- `/prepaid-ledger`
  - 단골 바로가기/후보 연결 확인

전체 명령:

```bash
npm run test
npm run lint
npm run typecheck
npm run build
```

---

## 7. 오픈 질문

1. 엑셀 업로드는 직원이 매일 직접 할 기능인가, 과거 자료 정리용인가?
   - 매일 직접이면 UI를 일일 운영 안에 크게 넣어야 함
   - 과거 정리용이면 관리 탭 쪽이 더 안전
2. 매출 분석에서 선결제 충전/사용을 매출에 포함할지?
   - 기본 제안: 포함하지 않고 별도 보조 지표로 표시
3. 단골손님의 연락처는 모든 직원에게 보여도 되는지?
   - 기본 제안: 목록은 마스킹, 상세/검색 시만 최소 노출
4. 손님 반응 엑셀 후보는 자동 저장할지, 직원 검수 후 저장할지?
   - 기본 제안: 반드시 검수 후 저장
5. 단골 자동 후보 기준은 예약 몇 회부터로 할지?
   - 기본 제안: 2회 이상부터 후보, 직원이 확정

---

## 8. 최종 권장안

가장 안전한 순서:

1. 실사용 안정화 문구/저장/날짜/오류 UX 보강
2. 엑셀 업로드는 `미리보기 전용`부터 출시
3. 실제 저장 apply는 제품명/손님 반응 후보 검수 화면이 안정된 뒤 출시
4. 매출 분석은 `DailyOperationRecord` 기반 1차를 먼저 출시
5. 단골손님리스트는 `RegularCustomer` 확장 + 예약/선결제 후보 기반으로 시작
6. 고객 통합 카드/손님 반응까지 연결하는 고급 CRM식 구조는 나중에 필요해질 때 확장

이렇게 진행하면 개발자가 아닌 실제 직원도 실수 없이 사용할 수 있고, 엑셀/AI/분석 기능이 잘못된 데이터를 조용히 저장하는 위험을 줄일 수 있다.
