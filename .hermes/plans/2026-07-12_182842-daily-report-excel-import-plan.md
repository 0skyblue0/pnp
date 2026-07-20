# 일일 업무 보고서 5월/6월 Excel 자동 적재 기획

**대상 파일**

- `Docs/User_Send/일일업무보고서_5월.xlsx`
- `Docs/User_Send/일일업무보고서 6월.xlsx`

**확인한 코드/DB 기준**

- DB 스키마: `apps/api/prisma/schema.prisma`
- 일일 운영 저장 API: `apps/api/src/modules/daily-log/daily-operation.routes.ts`
- 화면 데이터 타입: `apps/web/src/modules/daily-log/DailyLogPage.tsx`
- 현재 제품 라인업: `apps/web/src/shared/productLineup.ts`
- 제품 동기화 마이그레이션: `apps/api/prisma/migrations/0021_sync_daily_operation_product_names/migration.sql`

---

## 1. Excel 양식 구조 요약

두 파일은 같은 구조다.

- 시트 구성
  - `사용법`
  - `1일` ~ `31일`
  - `결산`
- 5월 파일은 31일 모두 실제 데이터가 있음.
- 6월 파일도 `31일` 시트가 있으나, 6월 31일은 존재하지 않으므로 사실상 빈 템플릿/잔여 시트다. 자동 적재 시 날짜 파싱 실패 또는 비존재 날짜는 제외해야 한다.

### 일별 시트 주요 위치

- 기본 정보
  - `C2`: 날짜 문자열. 예: `2026년  5월  1일 ( 금요일)`, `2026 년 6 월 1 일 ( 월요일)`
  - `C3`: 지점명. 예: `여의도`
  - `F3`: 작성자
  - `H3`: 누계 매출액. 수식은 `G11` 참조인 경우가 많아 실제 일매출과 같을 수 있음. 월 누계로 신뢰하면 안 됨.
  - `E6:I6`: 날씨, 외부온도, 내부온도, 외부습도, 내부습도 실제 입력값
- 매출
  - `C11`: POS 매출액
  - `D11`: POS 매출건수
  - `E11`: POS 외 매출액. 수식 `SUM(E55:I56)`
  - `F11`: POS 외 매출건수. 수식 `SUM(E53:I54)`
  - `G11`: 총 매출액. 수식 `C11+E11`
  - `H11`: 총 매출건수. 수식 `D11+F11`
  - `I11`: 객단가. 수식 `G11/H11`
- 제품 판매량
  - 행 `13` ~ `50`
  - `B`: 제품명
  - `C`: 생산량
  - `D`: 손실량
  - `E`: 시식량
  - `F`: 기타 In/Out
  - `H`: 재고량
  - `I`: 판매량
  - `51행`: 제품 합계
- POS 외 채널
  - `D52:I52`: 선물, 쿠팡이츠, 배민, 제로페이, 택배, 납품
  - `D53:I53`: 매출건수
  - `D55:I55`: 매출액
  - 일부 값은 빈칸으로 남아 있음. 빈칸은 0으로 정규화해야 함.
- 메모/운영 텍스트
  - `57`~`60행`: 서비스내역 및 손님 특이사항
  - `61`~`64행`: 제품의견 / 손실
  - `65`~`69행`: 매장 관리
  - `70`~`72행`: 지시 및 전달사항
  - `73`~`74행`: 내일 준비사항
  - `75`~`77행`: 직원 특이사항
  - `78`~`80행`: 시설 점검사항

### 결산 시트

- 일별 시트를 합산하는 수식 중심 시트다.
- 주요 월 합계는 아래와 같이 계산되어 있음.
  - POS 매출액/건수
  - POS 외 매출액/건수
  - 총 매출액/건수
  - 객단가
  - 제품별 누계 생산/손실/시식/기타/재고/판매
  - 제품별 판매율/로스율/재고율
- 단, `#VALUE!`, `#DIV/0!`가 존재한다. 특히 월별 제품 판매량 합계/비율은 오류값이 포함될 수 있으므로 DB 적재 원천으로 삼기보다, 일별 데이터 적재 후 서버에서 재계산하는 것이 안전하다.

---

## 2. Excel과 현재 DB/API 호환성 평가

### 결론

현재 `daily_operation_record` 테이블은 JSON 구조라서 Excel 일별 데이터를 거의 그대로 적재할 수 있다. 다만 검색/통계/검증까지 고려하면 “그대로 JSON 저장”만으로는 부족하고, 최소한 파서 검증과 제품명 정규화가 필요하다.

현재 DB 모델:

```text
DailyOperationRecord
- date: Date @unique
- draft: Json
- productRows: Json
- channelRows: Json
- staffSpecialRows: Json
```

현재 화면/API 타입:

```text
DailyOperationDraft
- date, author
- outsideTemp, insideTemp, outsideHumidity, insideHumidity, weather
- posSalesAmount, posSalesCount, nonPosSalesAmount, nonPosSalesCount
- productOpinionAndLoss, facilityIssue, cleaningWork, instructions, tomorrowPrep
- firstWorker, firstWorkerTime, lastWorker, lastWorkerTime, hygieneChecker, finalChecker

ProductRow
- productName, producedQty, lossQty, tastingQty, otherInQty, otherOutQty, stockQty, soldQty, manualSold

ChannelRow
- name, count, amount

StaffSpecialRows
- today/tomorrow x dayOff/vacation/lateEarly/support/birthday/newStaff/etc
```

### 잘 맞는 항목

- 날짜별 1건 저장: Excel 일별 시트 1개 = `daily_operation_record.date` 1건과 잘 맞음.
- 기본 운영 정보: 작성자, 날씨, 온도/습도, POS 매출/건수는 `draft`에 저장 가능.
- POS 외 채널: 선물/쿠팡이츠/배민/제로페이/택배/납품은 `channelRows`에 저장 가능.
- 제품별 수량: 생산/손실/시식/기타/재고/판매는 `productRows`에 저장 가능.
- 직원 특이사항: 일정 부분은 `staffSpecialRows`로 저장 가능.

### 주의가 필요한 항목

1. 날짜 파싱
   - 5월/6월 파일 날짜 문자열의 공백이 일정하지 않다.
   - 예: `2026년  5월  1일`, `2026 년 6 월 1 일`, `202 년  월  일`
   - 정규식으로 숫자만 추출하고, 실제 달력에 존재하는 날짜인지 검증해야 한다.

2. 수식 셀
   - `E11`, `F11`, `G11`, `H11`, `I11`, `51행`, `결산`은 수식 기반이다.
   - 적재 시 수식 결과값을 믿되, 서버에서 다시 합산하여 검산해야 한다.
   - 결산 시트는 오류값이 있어 원천 적재 대상에서 제외하고 검산 참고용으로만 사용한다.

3. 제품명 정규화
   - Excel/기존 DB/화면 표기를 사용자 기준으로 정정한다.
   - 정식 표기: `깜빠뉴`, `깜빠뉴 (H)`, `배민`, `크로와상`.
   - `호라산 통밀`과 `호밀빵`은 별도 제품으로 관리한다.
   - `바질치킨`은 `바질치킨샌드위치`로 정규화하며, `치킨샌드위치`와 별도 제품으로 관리한다.
   - `멜란자네`, `수프+샌드위치`, `수프+빵`, `아몬드크로와상`, `호라산 통밀`, `바질치킨샌드위치`는 과거 데이터 보존용으로 제품 등록하되 미사용 상태로 둔다.

4. 제품 수량 단위
   - `(H)` 반 단위 제품 때문에 `15.5`, `406.5` 같은 소수 판매량이 존재한다.
   - DB/화면 타입은 문자열 JSON이라 저장은 가능하지만, 향후 정규화 테이블로 옮기면 `Int`가 아니라 `Decimal`이 필요하다.

5. POS 외 매출
   - 현재 화면은 `draft.nonPosSalesAmount`, `draft.nonPosSalesCount`도 갖고 있지만 실제 합산은 `channelRows`에서 재계산한다.
   - 적재 시 `draft.nonPosSalesAmount/count`와 `channelRows` 합계가 다르면 경고를 남기고 `channelRows`를 기준으로 삼는 편이 안전하다.

---

## 3. Excel에는 있으나 현재 DB/화면에서 직접 관리하지 않는 정보

정정: 아래 표현의 “관리하지 않는다”는 뜻은 “웹페이지에 전혀 입력/표시 항목이 없다”는 의미가 아니다. 현재 웹페이지도 같은 성격의 데이터를 `draft`, `channelRows`, `staffSpecialRows` 같은 JSON 필드로 다루고 있다. 여기서 말한 미관리/비구조화는 “엑셀의 각 섹션이 DB 컬럼 또는 별도 테이블로 1:1 정규화되어 관리되지는 않는다”는 의미다.

따라서 표현을 다음처럼 수정한다.

- 현재 웹페이지에서 다루는 동일/유사 데이터가 있다.
- 다만 Excel 원문 섹션명과 웹 입력 필드가 완전히 1:1 대응하지 않는 부분이 있다.
- DB는 `daily_operation_record`의 JSON에 저장하므로 보존은 가능하지만, 섹션별 검색/집계/검산을 위한 별도 컬럼·테이블은 아직 없다.
- 자동 적재 시에는 기존 웹 필드에 최대한 매핑하고, 매핑이 애매한 원문은 `rawSections` 같은 import 메타 JSON에 함께 보존하는 것이 안전하다.

### A. 제품 라인업에 없는 제품명

현재 `apps/web/src/shared/productLineup.ts` 및 `0021_sync_daily_operation_product_names` 기준으로 추가가 필요한 과거 데이터 보존용 제품:

- `멜란자네`
- `수프+샌드위치`
- `수프+빵`
- `아몬드크로와상`
- `호라산 통밀`
- `바질치킨샌드위치`

등록 방침:

- 위 제품들은 현재 사용하지 않는 품목이지만 과거 데이터 보존이 필요하므로 제품 등록한다.
- 등록 후 `isActive=false`로 전환해 현재 운영 입력 기본 목록에는 노출하지 않는다.
- 과거 데이터 조회에서는 해당 제품명이 보존되어 보여야 한다.

정규화/매핑 확정 항목:

- `깜파뉴` -> `깜빠뉴`
- `깜파뉴(H)`, `깜빠뉴(H)` -> `깜빠뉴 (H)`
- `배 민` -> `배민`
- `크로아상`/`크로와상` 표기는 `크로와상`으로 통일
- `바질치킨` -> `바질치킨샌드위치`
- `호라산 통밀`은 `호밀빵`과 별도 제품
- `바질치킨샌드위치`는 `치킨샌드위치`와 별도 제품

### B. Excel 텍스트 섹션의 세부 구분

현재 화면에는 `productOpinionAndLoss`, `cleaningWork`, `instructions`, `tomorrowPrep`, `facilityIssue` 등 일부 입력칸이 있으나 Excel 섹션 구분과 1:1은 아니다.

Excel에는 아래 정보가 더 세밀하게 분리되어 있다.

- 서비스내역 및 손님 특이사항
- 제품의견 / 손실
- 매장 관리
- 지시 및 전달사항
- 내일 준비사항
- 직원 특이사항
- 시설 점검사항

현재 임시 데이터/화면에서는 “서비스내역 및 손님 특이사항”과 “제품의견 / 손실”이 `productOpinionAndLoss`에 합쳐져 들어간 흔적이 있다. 자동 적재 시에는 원문 보존을 위해 최소한 내부 JSON에 섹션별 원문을 남기는 것이 좋다.

### C. 근무/점검 세부 정보

Excel 하단에는 다음과 같은 근무/점검류 정보가 있다.

- 휴무 인원
- 당일/익일 직원 특이사항으로 보이는 행
- 첫 출근자
- 첫 출근 시간으로 보이는 소수값. 예: `0.25`, `0.2916666667` = Excel 시간값 06:00, 07:00 추정
- 위생/최종/시설 점검 성격의 텍스트

현재 `StaffSpecialRows`는 일부 저장 가능하지만, Excel 행 의미를 정확히 나눠 담기에는 부족하다. 적재 파서에서 원문과 해석값을 함께 보관해야 한다.

### D. 월 결산 지표

결산 시트에는 월 누계와 판매율/로스율/재고율이 있으나 현재 DB에는 월 결산 테이블이 없다.

권장 판단:

- 결산 시트 자체는 적재하지 않는다.
- 일별 데이터 적재 후 서버에서 월 합계를 재계산한다.
- 결산 시트의 수치는 “검산용”으로만 사용한다.

---

## 4. 자동 적재 기능 기획

### 목표

과거 Excel 일일 업무 보고서를 서버 DB의 `daily_operation_record`로 자동 적재하고, 사용자가 웹의 일일 운영 조회에서 5월/6월 과거 데이터를 확인할 수 있게 한다.

### 적재 범위 1차안

1차 적재 대상:

- 2026년 5월 일별 실제 데이터 31건
- 2026년 6월 일별 실제 데이터 30건
- 총 61건

제외 대상:

- `사용법` 시트
- `결산` 시트
- 6월 `31일` 시트: 비존재 날짜/빈 템플릿

### 데이터 변환 규칙

#### `draft`

- `date`: `YYYY-MM-DD`
- `author`: `F3`
- `weather`: `E6`
- `outsideTemp`: `F6`
- `insideTemp`: `G6`
- `outsideHumidity`: `H6`
- `insideHumidity`: `I6`
- `posSalesAmount`: `C11`
- `posSalesCount`: `D11`
- `nonPosSalesAmount`: `E11` 또는 채널 합계 재계산값
- `nonPosSalesCount`: `F11` 또는 채널 합계 재계산값
- `productOpinionAndLoss`: 1차 구현에서는 서비스/손님 특이사항 + 제품의견/손실을 합쳐 저장하되, 원문 섹션별 값은 별도 `draft.importSourceSections` 또는 `draft.rawSections` 같은 JSON 확장 필드에 보존 권장
- `cleaningWork`: 매장 관리
- `instructions`: 지시 및 전달사항
- `tomorrowPrep`: 내일 준비사항
- `facilityIssue`: 시설 점검사항
- `firstWorker`, `firstWorkerTime`, `lastWorker`, `lastWorkerTime`, `hygieneChecker`, `finalChecker`: Excel 행 해석이 불명확하므로 가능한 범위만 채우고 원문 보존

#### `productRows`

각 행 `13`~`50`을 아래로 매핑:

- `productName`: `B열`, 정규화 적용
- `producedQty`: `C열`, 빈칸은 `0`
- `lossQty`: `D열`, 빈칸은 `0`
- `tastingQty`: `E열`, 빈칸은 `0`
- `otherInQty` / `otherOutQty`: `F열` 값이 양수면 In, 음수면 Out 절대값
- `stockQty`: `H열`, 빈칸은 `0`
- `soldQty`: `I열`, 빈칸은 `0`
- `manualSold`: 기존 화면 규칙과 동일하게 수동 판매 제품이면 `true`

#### `channelRows`

- 채널명은 `D52:I52`
- 건수는 `D53:I53`
- 금액은 `D55:I55`
- `배 민`은 `배민`으로 정규화
- 빈칸은 `0`

#### `staffSpecialRows`

1차 구현에서는 보수적으로 처리:

- `today.dayOff`: 직원 특이사항의 `휴무` 아래 첫 번째 실제 이름 행
- `tomorrow.dayOff`: 다음 이름 행이 있으면 저장
- 나머지 카테고리는 빈 문자열
- 원문 행은 `draft.rawSections.staffSpecial`로 보존 권장

#### 웹 필드 우선 매핑 + `rawSections` 원문 보존

자동 적재의 기본 원칙은 “현재 웹페이지가 이미 다루는 필드에는 최대한 매핑하고, 애매한 Excel 원문은 버리지 않고 JSON 내부에 함께 보존”이다.

1. 현재 웹 필드에 우선 매핑
   - `draft.productOpinionAndLoss`: Excel의 `서비스내역 및 손님 특이사항` + `제품의견 / 손실`을 합쳐 저장한다. 현재 웹 메모 영역에서 가장 가까운 필드다.
   - `draft.cleaningWork`: Excel의 `매장 관리`를 저장한다.
   - `draft.instructions`: Excel의 `지시 및 전달사항`을 저장한다.
   - `draft.tomorrowPrep`: Excel의 `내일 준비사항`을 저장한다.
   - `draft.facilityIssue`: Excel의 `시설 점검사항`을 저장한다.
   - `staffSpecialRows.today.dayOff`, `staffSpecialRows.tomorrow.dayOff`: Excel의 `직원 특이사항` 중 휴무자/익일 휴무자로 해석 가능한 행을 저장한다.

2. 매핑이 애매한 Excel 원문은 `draft.rawSections`에 보존
   - Excel의 구역명, 행 번호, 원문 텍스트를 함께 남긴다.
   - 웹 필드에 합쳐 들어간 값도 원문 구분을 잃지 않도록 `rawSections`에는 섹션별로 다시 저장한다.
   - 향후 별도 컬럼/테이블로 승격할 때 원문을 다시 Excel에서 꺼낼 필요가 없게 한다.

권장 `rawSections` 구조:

```json
{
  "source": {
    "fileName": "일일업무보고서_5월.xlsx",
    "sheetName": "1일",
    "importedAt": "ISO-8601"
  },
  "sections": {
    "serviceAndCustomerNotes": {
      "label": "4. 서비스내역 및 손님 특이사항",
      "rows": [57, 58, 59, 60],
      "text": "..."
    },
    "productOpinionAndLoss": {
      "label": "5. 제품의견 / 손실",
      "rows": [61, 62, 63, 64],
      "text": "..."
    },
    "storeManagement": { "label": "6. 매장 관리", "rows": [65, 66, 67, 68, 69], "text": "..." },
    "instructions": { "label": "7. 지시 및 전달사항", "rows": [70, 71, 72], "text": "..." },
    "tomorrowPrep": { "label": "8. 내일 준비사항", "rows": [73, 74], "text": "..." },
    "staffSpecial": { "label": "9. 직원 특이사항", "rows": [75, 76, 77], "text": "..." },
    "facilityCheck": { "label": "10. 시설 점검사항", "rows": [78, 79, 80], "text": "..." }
  }
}
```

3. 추후 승격 기준
   - 같은 섹션을 검색/필터해야 한다면 별도 컬럼 또는 JSON path index를 검토한다.
   - 직원 근무/휴무를 캘린더·인사 기능과 연결해야 한다면 `staff_special_log` 같은 별도 테이블로 승격한다.
   - 시설 점검을 체크리스트/이력으로 관리해야 한다면 `facility_check_log` 같은 별도 테이블로 승격한다.
   - 제품의견/손실을 생산 품질 이슈와 연결해야 한다면 `production_note` 또는 기존 생산/손실 도메인과 연결한다.
   - 승격 전까지는 `draft.rawSections`를 원본 보존 저장소로 취급한다.

### 검증 규칙

적재 전 파서가 아래 검증을 해야 한다.

1. 날짜 검증
   - 날짜 파싱 성공
   - 파일 월과 시트 날짜 일치
   - 실제 달력에 존재하는 날짜
2. 매출 검산
   - `C11 + 채널금액합계 = G11`
   - `D11 + 채널건수합계 = H11`
   - 불일치 시 적재는 가능하되 경고 리포트 생성
3. 제품 합계 검산
   - 제품 행 `13:50` 합계와 `51행` 비교
   - 소수점 허용
4. 제품명 검증
   - 정규화 후 제품 라인업에 존재하는지 확인
   - 미등록 제품은 경고 후 `productRows`에는 남기되, 별도 리포트에 기록
5. 중복 적재 방지
   - `date` unique 기준으로 upsert
   - 이미 존재하는 날짜는 dry-run에서 “갱신 예정”으로 표시
6. 원문 보존 검증
   - Excel 하단 섹션 중 원문 텍스트가 있는 행은 반드시 `draft.rawSections.sections.*.text`에 포함되어야 한다.
   - 웹 필드에 매핑된 값과 `rawSections` 원문이 함께 존재해야 한다.
   - 원문이 있었는데 웹 필드/`rawSections` 양쪽 모두 비어 있으면 dry-run에서 오류로 처리한다.

---

## 5. 구현 계획

### Task 0: 의존성/타입 설계 확정

**Objective:** 평가에서 남은 불확실성을 구현 전에 제거한다.

**현재 확인 결과:**

- 루트 `package.json`은 npm workspaces 구조다.
- API 패키지는 `apps/api/package.json`이며 `tsx`, `vitest`, `typescript`, `zod`, `@prisma/client`를 이미 사용한다.
- 현재 Excel 파서 의존성은 없다.
- Python `openpyxl`은 현재 환경에 설치되어 있지 않았으므로 Python 기반 파서는 기본안에서 제외한다.

**결정:**

- Excel 파서는 API workspace에 Node 패키지 `xlsx`를 추가해 구현한다.
- 추가 명령: `npm install xlsx -w @pnp/api`
- CLI 실행은 기존 devDependency `tsx`를 사용한다.
- API package script 추가:
  - `"import:daily-operation": "tsx src/modules/daily-log/excel-import/daily-operation-excel-import.cli.ts"`

**타입 확장 결정:**

- `DailyOperationDraft`에 optional `rawSections?: DailyOperationRawSections`를 추가한다.
- API body schema는 기존 `z.record(z.string(), z.unknown())`라 서버 저장은 이미 가능하지만, 웹 타입이 보존하지 못하면 화면 왕복 중 삭제될 수 있으므로 웹 타입에 명시한다.

**제품 표시 정책 결정:**

- `product` 마스터에는 과거 보존용 제품을 `is_active=false`로 등록한다.
- 현재 입력용 기본 제품 목록은 활성 제품 중심으로 유지한다.
- 과거 조회/저장 데이터의 `productRows`는 JSON에 저장된 제품명 기준으로 그대로 표시한다.
- 즉, “현재 입력 목록”과 “과거 저장 기록 표시”를 분리한다.

**완료 조건:**

- `apps/api/package.json`에 `xlsx`와 import script가 반영된다.
- `package-lock.json`이 갱신된다.
- 웹 타입에 `DailyOperationRawSections`가 추가된다.
- `npm run typecheck`에서 타입 오류가 없어야 한다.

### Task 1: Excel 파서 유틸 추가

파일:

- Create: `apps/api/src/modules/daily-log/excel-import/daily-operation-excel-parser.ts`
- Create: `apps/api/src/modules/daily-log/excel-import/daily-operation-excel-parser.test.ts`

내용:

- `.xlsx`를 읽어 시트 목록 추출
- `사용법`, `결산` 제외
- `1일`~`31일` 중 실제 날짜가 유효한 시트만 파싱
- 셀 주소 기반으로 `draft`, `productRows`, `channelRows`, `staffSpecialRows` 생성
- `draft.rawSections` 생성
- 파서 반환 타입은 적재 데이터와 검산 리포트를 분리한다.

권장 반환 구조:

```ts
type ParsedDailyOperationWorkbook = {
  records: ParsedDailyOperationRecord[];
  warnings: ImportWarning[];
  skippedSheets: Array<{ sheetName: string; reason: string }>;
};

type ParsedDailyOperationRecord = {
  date: string;
  draft: DailyOperationDraft;
  productRows: ProductRow[];
  channelRows: ChannelRow[];
  staffSpecialRows: StaffSpecialRows;
  checks: {
    salesMatched: boolean;
    productTotalsMatched: boolean;
    rawSectionsPreserved: boolean;
  };
};
```

주의:

- Excel 값은 수식 자체가 아니라 계산된 셀 값 기준으로 읽는다.
- 수식 결과가 없거나 오류값이면 파서가 직접 재계산 가능한 항목은 재계산하고 warning을 남긴다.
- `결산` 시트는 적재하지 않지만, dry-run 검산 참고용으로 월 합계와 일별 합산이 맞는지 비교할 수 있다.

### Task 2: 제품명 정규화 테이블 추가

파일:

- Modify: `apps/api/src/modules/daily-log/excel-import/daily-operation-excel-parser.ts`
- Test: `apps/api/src/modules/daily-log/excel-import/daily-operation-excel-parser.test.ts`

정규화 확정 규칙:

```text
깜파뉴 -> 깜빠뉴
깜파뉴(H) -> 깜빠뉴 (H)
깜빠뉴(H) -> 깜빠뉴 (H)
배 민 -> 배민
허 브  -> 허 브
치아바타  -> 치아바타
크로아상 -> 크로와상
바질치킨 -> 바질치킨샌드위치
```

제품 등록/활성 상태 확정:

```text
호라산 통밀: 호밀빵과 별도 제품, 등록 후 미사용 처리
바질치킨샌드위치: 치킨샌드위치와 별도 제품, 등록 후 미사용 처리
멜란자네: 등록 후 미사용 처리
수프+샌드위치: 등록 후 미사용 처리
수프+빵: 등록 후 미사용 처리
아몬드크로와상: 등록 후 미사용 처리
```

### Task 3: Dry-run CLI 추가

파일:

- Create: `apps/api/src/modules/daily-log/excel-import/daily-operation-excel-import.cli.ts`
- Modify: `apps/api/package.json`

명령 예:

```bash
npm --workspace apps/api run import:daily-operation -- --dry-run Docs/User_Send/일일업무보고서_5월.xlsx Docs/User_Send/일일업무보고서\ 6월.xlsx
```

출력:

- 파싱 대상 날짜 수
- 제외 시트
- 미등록/미확정 제품명
- 매출 검산 불일치 목록
- 제품 합계 불일치 목록
- rawSections 원문 보존 누락 목록
- 실제 upsert 예정 건수

### Task 4: 실제 적재 CLI 구현

파일:

- Modify: `apps/api/src/modules/daily-log/excel-import/daily-operation-excel-import.cli.ts`

동작:

- dry-run 통과 후 `--apply` 옵션일 때만 DB upsert
- `dailyOperationRecord.upsert({ where: { date } ... })` 사용
- 기존 웹 API와 동일한 JSON 구조로 저장하되, `draft.rawSections`에 Excel 원문 섹션을 함께 저장
- 적재 결과를 날짜별 성공/갱신/실패로 출력

### Task 4-1: rawSections 표시/보존 회귀 테스트 추가

파일 후보:

- Modify: `apps/web/src/modules/daily-log/DailyLogPage.tsx`
- Test: `apps/web/src/app/App.test.tsx`

목표:

- 기존 웹 필드는 기존대로 표시/저장된다.
- `draft.rawSections`가 포함된 과거 적재 데이터도 화면 로딩/저장/조회 과정에서 손실되지 않는다.
- 당장 화면에 원문 섹션 전체를 별도 표시하지 않더라도, API 왕복 후 JSON에서 삭제되지 않아야 한다.

검증:

- API 응답 fixture에 `draft.rawSections`를 포함한다.
- 조회/수정/저장 후 PUT payload에 `rawSections`가 유지되는지 테스트한다.
- 저장 UI에서 사용자가 일반 필드를 수정해도 import 원문 메타가 사라지지 않아야 한다.

### Task 4-2: 하단 직원/시설 행 해석을 보수적으로 고정

파일 후보:

- Modify: `apps/api/src/modules/daily-log/excel-import/daily-operation-excel-parser.ts`
- Test: `apps/api/src/modules/daily-log/excel-import/daily-operation-excel-parser.test.ts`

결정:

- `직원 특이사항`, `첫 출근자`, 시간값 등 해석이 애매한 행은 1차 적재에서 원문 보존을 우선한다.
- 명확히 `휴무` 라벨 아래 이름으로 식별되는 값만 `staffSpecialRows.today.dayOff` / `staffSpecialRows.tomorrow.dayOff`에 매핑한다.
- Excel 시간 소수값(`0.25`, `0.291666...`)은 사람이 읽을 수 있는 `HH:mm`으로 변환해 `rawSections.facilityCheck.text`에 보존하되, 확정 전에는 `firstWorkerTime`에 자동 입력하지 않는다.
- `firstWorker`, `lastWorker`, `hygieneChecker`, `finalChecker`는 확실한 이름/라벨 매칭이 없으면 빈 문자열로 둔다.

검증:

- 5월 1일, 5월 31일, 6월 1일, 6월 30일 샘플을 테스트 fixture로 둔다.
- 각 샘플에서 하단 원문 섹션이 `rawSections`에 빠짐없이 들어가는지 확인한다.
- 해석이 불명확한 값이 잘못된 웹 필드로 자동 입력되지 않는지 확인한다.

### Task 5: 제품 라인업/DB 제품 보강 반영

파일 후보:

- Modify: `apps/web/src/shared/productLineup.ts`
- Create: `apps/api/prisma/migrations/0022_add_excel_daily_operation_products/migration.sql`

반영할 제품:

- `멜란자네`
- `수프+샌드위치`
- `수프+빵`
- `아몬드크로와상`
- `호라산 통밀`
- `바질치킨샌드위치`

반영 방침:

- 과거 데이터 보존을 위해 `product`에는 등록한다.
- 현재 사용하지 않는 품목이므로 `is_active=false`로 둔다.
- `호라산 통밀`은 `호밀빵`과 별도 제품이다.
- `바질치킨샌드위치`는 `치킨샌드위치`와 별도 제품이다.
- `바질치킨`으로 들어온 과거 Excel 값은 적재 시 `바질치킨샌드위치`로 정규화한다.
- 일일 운영 과거 조회 화면에서는 비활성 제품이라도 해당 날짜의 JSON에 저장된 제품명/수량을 표시해야 한다.

### Task 6: 검증

실행할 검증:

```bash
npm run test
npm run lint
npm run typecheck
npm run build
```

적재 검증:

1. dry-run에서 61건 파싱 확인
2. 5월 1일 샘플 확인
   - POS 매출액: 2,012,600
   - POS 외 매출액: 220,700
   - 총 매출액: 2,233,300
   - 제품 합계 생산량: 530
   - 제품 합계 판매량: 451
3. 6월 1일 샘플 확인
   - POS 매출액: 1,759,400
   - POS 외 매출액: 156,400
   - 총 매출액: 1,915,800
   - 제품 합계 생산량: 502
   - 제품 합계 판매량: 406.5
4. 6월 31일 제외 확인
5. 웹 `/daily-log/today` 조회 탭에서 2026-05, 2026-06 기간 조회 확인
6. 로컬 DB 실제 적재 검증
   - dry-run 통과 후 로컬/테스트 DB에서 `--apply` 실행
   - `/api/v1/daily-operation?from=2026-05-01&to=2026-06-30` API 응답 확인
   - 응답 `total`이 61인지 확인
   - 5월 1일/6월 1일 레코드에 `draft.rawSections`가 존재하는지 확인
   - 비활성 제품(`멜란자네`, `호라산 통밀`, `바질치킨샌드위치` 등)이 과거 JSON 조회에서는 보이는지 확인
7. 웹 화면 검증
   - 개발 서버는 AGENTS.md 기준 포트 `5173`만 사용
   - 5월/6월 기간 조회 스크린샷으로 총매출/일평균/객단가/전기간 비교 영역 확인
   - 과거 레코드 상세 조회 시 제품 행과 메모 필드가 누락되지 않는지 확인

---

## 6. 최종 판단

- Excel의 일별 운영 데이터는 현재 `daily_operation_record` JSON 구조와 호환성이 높다.
- 단, 제품명 불일치와 Excel 수식 오류 때문에 결산 시트 그대로 적재는 위험하다.
- 안전한 방향은 “일별 시트만 파싱 -> JSON upsert -> 서버/화면에서 월 집계 재계산”이다.
- 현재 웹페이지가 이미 다루는 필드에는 최대한 매핑하고, Excel 섹션 구분이 애매하거나 합쳐지는 값은 `draft.rawSections`에 원문으로 보존한다.
- 1차 적재에서는 JSON 보존을 우선하고, 검색/집계/인사/시설/품질 관리 요구가 생기는 섹션만 이후 별도 컬럼 또는 테이블로 승격한다.

---

## 7. 구현 완성도 평가

평가 보완점을 반영한 현재 계획서 기준 구현 완성도는 **93/100점**으로 평가한다.

### 충분히 구체화된 부분

- 적재 대상 파일과 범위가 명확하다: 5월 31건 + 6월 30건 = 총 61건.
- 제외 대상이 명확하다: `사용법`, `결산`, 6월 `31일` 빈 템플릿.
- Excel 셀 주소 기준 매핑이 대부분 확정되어 있다.
- 현재 DB/API 구조와의 호환성 판단이 끝났다.
- 제품명 정규화 규칙과 과거 보존용 비활성 제품 등록 방침이 확정되었다.
- dry-run, 검산, 실제 upsert, 테스트/빌드 검증 흐름이 포함되어 있다.
- 웹 필드 매핑과 `rawSections` 원문 보존 방침이 추가되어 데이터 손실 위험이 낮아졌다.
- Excel 파서 라이브러리를 API workspace의 `xlsx`로 결정했다.
- `DailyOperationDraft.rawSections` optional 타입 확장 방향을 확정했다.
- 비활성 제품의 “현재 입력 목록 제외 / 과거 조회 표시” 정책을 확정했다.
- 직원/시설 하단 행은 보수적 매핑 + 원문 보존으로 고정했다.
- 실제 DB 적재 후 API 조회 및 웹 화면 검증 절차를 추가했다.

### 남은 리스크와 구현 중 확인 사항

1. `xlsx` 수식 캐시 한계
   - `.xlsx` 파일 안에 계산 결과 캐시가 없거나 오류값이면 수식 결과를 바로 읽지 못할 수 있다.
   - 일별 총액/합계는 파서가 직접 재계산하도록 계획에 반영했다.

2. 기존 화면 저장 로직의 unknown 필드 보존
   - `rawSections`가 타입에 추가되어도, 상태 초기화/저장 로직에서 객체를 재생성하며 누락될 수 있다.
   - Task 4-1의 왕복 보존 테스트로 반드시 확인한다.

3. 비활성 제품과 입력 UI 분리
   - 제품 마스터에는 비활성 과거 제품이 존재하지만, 현재 일일 입력 기본 목록에 섞이면 직원 사용성이 나빠진다.
   - 과거 조회는 저장 JSON 기준, 신규 입력은 활성 라인업 기준이라는 테스트가 필요하다.

4. 실제 적재 환경
   - 로컬/테스트 DB에서 먼저 검증한 뒤 운영 DB 적재를 진행해야 한다.
   - 운영 적재 전에는 dry-run 리포트와 변경될 날짜 목록을 확인한다.

5. 원문 개인정보/민감정보 확인
   - Excel 원문 메모에 연락처나 개인식별 정보가 섞여 있을 수 있다.
   - `rawSections` 보존 전 마스킹이 필요한 항목이 있는지 dry-run 리포트에서 확인한다.

### 구현 착수 가능 여부

구현 착수 가능하다. 다만 첫 구현은 반드시 아래 순서가 안전하다.

1. 의존성/타입 설계 확정: `xlsx` 설치, import script, `rawSections` 타입
2. Excel 파서 + 단위 테스트
3. dry-run 리포트
4. 제품 마스터 비활성 등록 마이그레이션
5. `rawSections` 타입/왕복 보존 테스트
6. 직원/시설 하단 행 보수적 매핑 테스트
7. 실제 upsert CLI
8. 로컬 DB 적재 후 API/웹 조회 검증

이 순서대로 진행하면 과거 데이터 손실 없이 자동 적재 기능을 구현할 수 있다.
