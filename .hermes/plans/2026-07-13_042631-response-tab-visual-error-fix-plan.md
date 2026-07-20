# 손님 반응 탭 시각/오류 점검 및 개선 계획

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** 손님 반응 탭을 직원이 빠르게 기록하고 대표가 신뢰할 수 있게 분석하는 화면으로 정리하면서, 현재 보이는 시각적 아쉬움과 오류처럼 보이는 동작을 제거한다.

**Architecture:** 현재 구조는 `ResponseInquiryPage`가 입력/분석 모드를 나누고, 입력은 `ResponseEntryPage`, 상세 기록은 `ResponseListPage`, 대표 요약은 `StatisticsPage`가 담당한다. 개선은 이 컴포넌트 경계를 유지하되, 상단 정보 구조와 카드 밀도, 상태 배지, 필터/목록 표시를 정리하고 필요한 경우 API 통계 분류 로직을 보강한다.

**Tech Stack:** React, TypeScript, Vite, Tailwind utility classes, Fastify API, Prisma, Vitest/Testing Library.

---

## 1. 현재 확인한 사실

### 라이브 상태

- Web: `http://127.0.0.1:5173/response` 정상 렌더링.
- API: `http://127.0.0.1:3001/healthz` 정상 응답.
- Docker: `pnp-api-1`, `pnp-web-1` healthy.
- 브라우저 콘솔: `/response`, 입력/분석 전환, AI 분류 실행 후 콘솔 에러 없음.
- 실제 AI 분류 샘플: `청주에서 일부러 방문한 손님이 계셨습니다.` → `손님경험 > 장거리 방문 > 장거리손님`으로 정상 추천됨.
- 최근 30일 상세 조회: 58건 표시.
- 전체 응답 API: 총 224건.

### 관련 파일

- `apps/web/src/modules/response/ResponseInquiryPage.tsx`
- `apps/web/src/modules/response/ResponseEntryPage.tsx`
- `apps/web/src/modules/response/ResponseListPage.tsx`
- `apps/web/src/modules/statistics/StatisticsPage.tsx`
- `apps/api/src/modules/response/response.routes.ts`
- `apps/api/src/modules/response/response.schemas.ts`
- 테스트:
  - `apps/web/src/app/App.test.tsx`
  - `apps/api/src/modules/response/response.routes.test.ts`

---

## 2. 발견한 시각적 아쉬움과 오류적 문제

### A. 입력 화면: 좌우 균형은 좋지만 “입력 순서”가 실제 행동 순서와 어긋남

현 화면은 왼쪽 입력, 오른쪽 최근 기록 2열이라 큰 구조는 괜찮다. 다만 현재 순서는 다음과 같다.

1. 날짜
2. 대분류/중분류/소분류
3. 한 줄 요약
4. 예시 문구
5. 실제 기록 내용
6. AI 분류
7. 저장

실제 직원 흐름은 “실제 기록 내용 입력 → AI 분류 → 직원 확인 → 요약/저장”인데, 화면은 분류 버튼 묶음이 실제 기록보다 먼저 나온다. 처음 보는 직원은 먼저 분류를 수동으로 골라야 하는 화면으로 이해할 가능성이 높다.

### B. 입력 화면: 예시 문구 위치가 늦고, 버튼을 눌렀을 때 AI 분류까지 바로 이어지지 않음

예시 문구는 좋은 장치지만 현재는 `한 줄 요약` 아래에 있고, 클릭하면 `실제 기록 내용`만 채운다. 직원 입장에서는 예시 클릭 후 다음 행동이 명확하지 않다. 예시는 “기록 내용 입력칸 위”에 두고, 클릭 후 AI 분류 버튼을 자연스럽게 누를 수 있게 배치하는 편이 낫다.

### C. 입력 화면: 대분류/중분류/소분류 버튼이 늘어나면 입력폼이 길어짐

AI 추천 후 `손님경험` 아래 중분류 버튼이 많이 노출된다. 추천이 성공했는데도 전체 수동 분류 버튼이 크게 펼쳐져 화면을 밀어낸다. 추천 결과와 수동 수정 영역을 분리하지 않으면, 직원은 “추천 완료”보다 “선택지가 너무 많음”을 먼저 보게 된다.

### D. 입력 화면: 최근 기록 배지가 모두 `AI 분류`로 보여 신뢰도 구분이 약함

현재 최근 기록 카드에서는 `llmAssisted`가 true면 `AI 분류`, false면 `직원 분류`로 표시한다. 코드상은 맞지만 실제 화면의 최근 4건이 모두 `AI 분류`라서 직원이 “검토 완료”인지 “AI가 그냥 붙인 값”인지 구분하기 어렵다. AI 추천 후 직원이 확인했다는 단계가 UI에 충분히 표현되지 않는다.

### E. 대표 요약: 첫 화면 정보가 많고, 날짜/월별 조회가 리포트보다 먼저 커 보임

대표 요약은 기능적으로는 잘 구성되어 있다. 그러나 첫 화면에서 다음 요소가 모두 위쪽에 몰린다.

- 기준 기간 텍스트
- 시작/종료 날짜
- 이번달/지난달/이번주/지난주/최근 30일
- 월별 빠른 조회 카드
- 대표 리포트 카드
- 5개 축 카드
- 반복 주제 TOP 5
- 주요 반응 근거

월별 빠른 조회가 별도 큰 카드라 리포트보다 먼저 시선을 가져간다. 대표가 처음 봐야 할 것은 “이번 기간 요약과 5개 축”이므로 월별 조회는 더 작게 접거나 날짜 필터와 합쳐야 한다.

### F. 대표 요약: `즉시 확인`과 `확인 필요`가 이중으로 보임

상단 대표 리포트에 `즉시 확인 3건`, 반복 주제 카드 헤더에 `확인 필요 3건`, 5개 축에는 `즉시 확인 6건`이 함께 보인다. 두 숫자가 다른 이유는 정의가 다르기 때문이지만, 사용자는 오류처럼 느낄 수 있다.

- `즉시 확인 6건`: 서비스/위험 축 전체로 분류된 기록
- `확인 필요 3건`: 더 강한 위험 조건에 걸린 기록

두 용어를 명확히 분리하거나, 하나의 표현 체계로 맞춰야 한다.

### G. 대표 요약: 5개 축 카드가 좁은 5열이라 텍스트가 답답함

1280px 화면에서 5개 카드가 한 줄로 들어가며 각 카드 폭이 좁다. 내부에 대표 주제, 예시 2개, 링크 2개가 들어가서 카드마다 정보 밀도가 높다. 대표용 첫 화면이라면 카드당 핵심 숫자/대표 주제 1개만 보이고 예시는 아래 `주요 반응 근거`로 내려가는 편이 낫다.

### H. 상세 기록: 목록이 너무 길어 한 화면에서 끝없이 이어짐

상세 기록은 최근 30일 58건을 한 페이지에 전부 보여준다. 기능적으로는 빠르지만, 직원/대표 입장에서는 “목록이 끝나지 않는 화면”처럼 보인다. 페이지네이션 또는 “처음 20건 + 더 보기”가 필요하다.

### I. 상세 기록: 필터 기준 select가 실제 DOM/접근성 트리에서 매우 길다

화면상 select는 접혀 있지만, 접근성 스냅샷과 body text에는 전체 기준 목록이 길게 잡힌다. 시각적으로도 기준 select 하나에 전체 트리(대/중/소분류)를 넣어 두어 찾기 어렵다. 특히 `기타 > 기타 > 기타`, `제품 > 맛 > 맛있음`, `손님경험 > 긍정 반응 > 맛있음`처럼 유사명이 많아 실수 가능성이 있다.

### J. 상세 기록: 수동/AI 상태 표현이 혼란스럽다

`ResponseListPage.tsx`에서는 `llmAssisted`가 false인 경우 `AI 재분류 필요`라고 표시한다. 수동으로 정확히 분류한 기록도 “AI 재분류 필요”처럼 보일 수 있어 오류적 표현이다. 입력 화면 최근 기록은 같은 조건에서 `직원 분류`라고 표시하므로 화면 간 표현도 불일치한다.

### K. 상세 기록: 수정/삭제 버튼이 모든 행에 강하게 반복됨

58건이 모두 보이는 목록에서 각 행 오른쪽에 수정/삭제가 반복되어, 실제 기록보다 삭제 버튼이 계속 눈에 들어온다. 운영 화면에서 삭제는 위험 동작이므로 기본 행에서는 작게 낮추거나, 행 선택/상세 펼침 안으로 넣는 것이 안전하다.

### L. API/분석 로직: `즉시 확인` 축 분류가 다소 넓을 수 있음

`apps/api/src/modules/response/response.routes.ts`의 `classifyExecutiveBuckets`는 `operationImprovementWords`에 `대기`, `줄`, `응대`, `포장`, `가격` 등이 포함되면 `serviceRisk`에 넣는다. 이 때문에 즉시 확인 축이 실제 `확인 필요`보다 넓어질 수 있다. 표현을 “운영 확인”으로 바꾸거나, `serviceRisk`와 `checkNeeded`의 정의를 더 명확히 나눠야 한다.

---

## 3. 개선 방향

### 원칙

1. 손님 반응 입력은 “먼저 실제 기록을 남기는 화면”으로 보이게 한다.
2. AI는 자동 저장이 아니라 “추천 후 직원 확인” 도구로 보이게 한다.
3. 대표 요약은 첫 화면에서 숫자를 줄이고 핵심 판단축만 남긴다.
4. 상세 기록은 “검토/수정 가능한 목록”이지 무한 로그처럼 보이지 않게 한다.
5. `AI 분류`, `직원 분류`, `확인 필요`, `즉시 확인` 같은 상태 단어는 화면마다 같은 의미로 쓴다.

---

## 4. 작업 계획

### Task 1: 상세 기록의 수동 분류 배지 문구 오류 수정

**Objective:** 수동 또는 imported 기록을 `AI 재분류 필요`로 오해하지 않게 만든다.

**Files:**
- Modify: `apps/web/src/modules/response/ResponseListPage.tsx:651-653`
- Test: `apps/web/src/app/App.test.tsx`

**Steps:**
1. `ResponseListPage.tsx`에서 `response.llmAssisted ? "AI 분류" : "AI 재분류 필요"`를 `response.llmAssisted ? "AI 분류" : "직원 분류"`로 변경한다.
2. 기존 테스트 중 상세 기록 배지를 확인하는 부분이 있으면 `직원 분류`를 기대하게 수정한다.
3. 가능하면 `AI 재분류 필요` 문구가 화면에 남지 않는 회귀 테스트를 추가한다.

**Validation:**
- `npm run test --workspace @pnp/web -- App.test.tsx`
- 브라우저 `/response?mode=lookup&tab=detail`에서 수동 기록이 `직원 분류`로 보이는지 확인.

---

### Task 2: 입력 화면 순서를 실제 업무 흐름에 맞게 재배치

**Objective:** 직원이 “실제 기록 입력 → AI 분류 → 기준 확인 → 저장” 순서로 자연스럽게 쓰게 한다.

**Files:**
- Modify: `apps/web/src/modules/response/ResponseEntryPage.tsx`
- Test: `apps/web/src/app/App.test.tsx`

**Steps:**
1. 날짜 입력은 유지한다.
2. `예시 문구`와 `실제 기록 내용`을 대분류 버튼보다 위로 이동한다.
3. `AI 분류하기` 버튼을 실제 기록 내용 바로 아래로 이동한다.
4. 대분류/중분류/소분류 수동 버튼 묶음은 `분류 확인/수정` 섹션으로 이름을 바꾼다.
5. `한 줄 요약`은 AI 추천 결과 아래에 두어 추천 후 수정하는 흐름으로 만든다.
6. 저장 버튼은 맨 아래에 단독 primary 버튼으로 둔다.

**Recommended visible order:**
1. 날짜
2. 예시 문구
3. 실제 기록 내용
4. AI 분류하기
5. 선택 기준 / 분류 확인·수정
6. 한 줄 요약
7. 저장

**Validation:**
- `/response` 브라우저 확인.
- 예시 클릭 → 실제 기록 내용 입력됨 → AI 분류 버튼 활성화 확인.
- `청주에서 일부러 방문한 손님이 계셨습니다.` 입력 → AI 추천 경로 정상 확인.

---

### Task 3: AI 추천 후 분류 버튼 과노출 줄이기

**Objective:** 추천이 끝난 뒤 화면이 복잡해지는 문제를 줄인다.

**Files:**
- Modify: `apps/web/src/modules/response/ResponseEntryPage.tsx`

**Steps:**
1. 선택 기준 박스를 더 눈에 띄게 정리한다.
   - 예: `AI 추천 결과` / `손님경험 > 장거리 방문 > 장거리손님`
2. 수동 분류 버튼은 기본 노출하되, AI 추천 성공 후에는 `분류 직접 수정` 버튼을 눌렀을 때만 전체 버튼 묶음을 펼치는 방식을 검토한다.
3. 단, 접근성/테스트가 복잡해질 경우 1차 개선에서는 버튼 묶음을 유지하고 제목/간격만 정리한다.

**Validation:**
- AI 추천 전/후 화면 비교 스크린샷.
- 대분류/중분류/소분류가 모바일에서 가로 overflow를 만들지 않는지 확인.

---

### Task 4: 대표 요약 상단 필터 밀도 축소

**Objective:** 대표가 리포트를 먼저 보고, 날짜 조정은 보조 기능으로 보게 한다.

**Files:**
- Modify: `apps/web/src/modules/statistics/StatisticsPage.tsx:415-488`
- Test: `apps/web/src/app/App.test.tsx`

**Steps:**
1. `월별 빠른 조회` 큰 카드를 제거하거나 날짜 필터 오른쪽의 작은 월 버튼 그룹으로 합친다.
2. `한 달 단위로...` 설명 문장은 삭제 또는 `sr-only`로만 남긴다.
3. 상단은 다음 구조로 단순화한다.
   - 왼쪽: `기준 기간: 최근 30일`
   - 오른쪽: 시작/종료 날짜 + 빠른 버튼
   - 아래 한 줄: 6개월 월별 버튼(작게)
4. 리포트 카드가 첫 화면에서 더 위로 올라오게 한다.

**Validation:**
- `/response?mode=lookup` 첫 화면 스크린샷에서 대표 리포트가 날짜/월별 조회보다 시각적으로 우선하는지 확인.

---

### Task 5: `즉시 확인` / `확인 필요` 용어 정리

**Objective:** 3건과 6건이 동시에 보여 오류처럼 느껴지는 문제를 해결한다.

**Files:**
- Modify: `apps/web/src/modules/statistics/StatisticsPage.tsx`
- Potentially Modify: `apps/api/src/modules/response/response.routes.ts`
- Test: `apps/api/src/modules/response/response.routes.test.ts`, `apps/web/src/app/App.test.tsx`

**Option A: UI 문구만 정리**
- 5개 축의 `즉시 확인`을 `운영 확인` 또는 `주의 신호`로 변경한다.
- `확인 필요 N건`은 더 강한 위험 필터로 유지한다.
- 설명을 추가한다: `확인 필요는 컴플레인·환불·위생·품질 문제처럼 바로 확인할 기록입니다.`

**Option B: API 정의까지 정리**
- `serviceRisk` bucket을 `operationalRisk` 또는 `attentionSignals`로 바꾸고 title을 `주의 신호`로 변경한다.
- `checkNeededCount`는 별도 drill-down 필터로 유지한다.

**Recommendation:** 먼저 Option A로 UI 혼란을 줄인다. API key 변경은 영향 범위가 커서 필요할 때 별도 작업으로 진행한다.

**Validation:**
- 대표 요약에서 `즉시 확인 6건`과 `확인 필요 3건`이 서로 모순처럼 보이지 않아야 한다.
- `확인 필요 N건` 클릭 시 `/response?mode=lookup&tab=detail&check_needed=true`로 이동하고 체크박스가 켜져야 한다.

---

### Task 6: 5개 축 카드 밀도 낮추기

**Objective:** 대표 요약의 첫 행 카드가 좁고 답답해 보이는 문제를 줄인다.

**Files:**
- Modify: `apps/web/src/modules/statistics/StatisticsPage.tsx:523-711`

**Steps:**
1. 1280px 기준 5열 대신 `xl:grid-cols-5`를 유지할지 재검토한다.
2. 추천안:
   - `lg:grid-cols-3 xl:grid-cols-5` 대신 `lg:grid-cols-3 2xl:grid-cols-5` 또는 `xl:grid-cols-3`로 넓게 배치.
   - 카드 내부 예시 2개는 삭제하고 `대표 주제`와 `N건 전체 보기`만 남긴다.
   - 실제 예시는 아래 `주요 반응 근거` 섹션에서만 보여준다.
3. 카드 문구를 짧게 줄인다.

**Validation:**
- `/response?mode=lookup`에서 첫 화면 카드가 읽기 쉬운지 스크린샷 확인.
- 모바일/좁은 화면에서도 가로 overflow 없음 확인.

---

### Task 7: 상세 기록 목록을 “처음 20건 + 더 보기”로 변경

**Objective:** 58건 전체가 한 번에 이어지는 긴 로그 느낌을 줄인다.

**Files:**
- Modify: `apps/web/src/modules/response/ResponseListPage.tsx`
- Optional API: 현재 API size 최대 100 지원. 우선 프론트 표시 제한으로 충분.
- Test: `apps/web/src/app/App.test.tsx`

**Steps:**
1. `visibleCount` state를 추가하고 기본 20으로 둔다.
2. `filteredResponses.slice(0, visibleCount)`만 렌더링한다.
3. 하단에 `더 보기` 버튼을 추가한다.
4. 필터가 변경되면 `visibleCount`를 20으로 reset한다.
5. 헤더 문구를 `20건 표시 / 조회 결과 58건`처럼 정확히 바꾼다.

**Validation:**
- 상세 기록에서 초기 표시가 20건으로 제한되는지 확인.
- 더 보기 클릭 시 추가 표시되는지 확인.
- 검색어 필터 후 표시 수 reset 확인.

---

### Task 8: 상세 기록 기준 필터를 단계형으로 바꾸기

**Objective:** 긴 select 하나로 모든 기준을 고르는 오류 가능성을 줄인다.

**Files:**
- Modify: `apps/web/src/modules/response/ResponseListPage.tsx`

**Steps:**
1. 단일 `기준` select는 1차 개선에서 유지하되, 다음 개선안 중 하나를 선택한다.
2. 추천안 A: `대분류`, `중분류`, `소분류` 3단계 select로 분리.
3. 추천안 B: 현재 select는 유지하되 `대분류만 빠른 버튼` + `세부 기준 select`로 분리.
4. 현재 PNP 기준 수가 많으므로 A가 더 명확하다.
5. URL query는 최종 선택 criterion id 하나만 `criterion_id`로 유지한다.

**Validation:**
- `제품` 선택 후 제품 하위 중/소분류만 보이는지 확인.
- `전체` 초기화가 정상 작동하는지 확인.
- 기존 `criterion_id` 링크로 들어와도 선택 상태가 복원되는지 확인.

---

### Task 9: 삭제 액션 노출 낮추기

**Objective:** 목록 전체에 삭제 버튼이 과하게 반복되어 위험 동작이 눈에 띄는 문제를 줄인다.

**Files:**
- Modify: `apps/web/src/modules/response/ResponseListPage.tsx`

**Steps:**
1. 기본 행에는 `수정`만 노출한다.
2. `삭제`는 수정 모드 안 또는 `더보기`/`관리` 버튼 안으로 이동한다.
3. 삭제 확인 문구는 현재처럼 유지하되, 날짜와 요약을 함께 보여준다.
4. 테스트에서 삭제 버튼 접근 방식 변경을 반영한다.

**Validation:**
- 기본 상세 목록에서 삭제 버튼이 과하게 반복되지 않는지 확인.
- 수정 모드 또는 확장 메뉴에서 삭제 가능하며 확인창이 뜨는지 확인.

---

### Task 10: 실제 데이터/분석 신뢰성 회귀 테스트 추가

**Objective:** 대표 리포트가 넓은 키워드 때문에 잘못된 축에 들어가는 문제를 막는다.

**Files:**
- Modify: `apps/api/src/modules/response/response.routes.test.ts`

**Test cases:**
1. `청주에서 일부러 방문한 손님`은 `방문 흐름`에 들어가고 `장거리손님` 기준으로 추천된다.
2. `치즈 치아바타가 짜다는 평`은 `매출 기회`가 아니라 `제품 점검` 또는 `확인 필요` 쪽으로 분류된다.
3. `품절로 구매 못함`은 `놓친 매출`에 들어간다.
4. `환불`, `불만`, `위생`, `이물` 단어는 `checkNeededCount`에 포함된다.
5. `직원 메모`는 대표 축 계산에서 제외 또는 낮은 우선순위로 처리된다.

**Validation:**
- `npm run test --workspace @pnp/api -- response.routes.test.ts`

---

## 5. 우선순위

### 1순위: 오류처럼 보이는 표현/상태 정리

1. 상세 기록 `AI 재분류 필요` → `직원 분류`.
2. `즉시 확인`/`확인 필요` 용어 정리.
3. 대표 요약에서 중복/혼란 링크와 배지 정리.

### 2순위: 첫 화면 시각 개선

1. 입력 화면 순서 재배치.
2. 대표 요약 월별 조회 카드 축소.
3. 5개 축 카드 밀도 낮추기.

### 3순위: 긴 목록/필터 사용성 개선

1. 상세 기록 20건 + 더 보기.
2. 기준 필터 단계형 개선.
3. 삭제 액션 노출 낮추기.

### 4순위: 분석 정확도 보강

1. API 회귀 테스트 추가.
2. `serviceRisk`/`checkNeeded` 정의 분리 검토.

---

## 6. 검증 계획

### 집중 테스트

```bash
npm run test --workspace @pnp/web -- App.test.tsx
npm run test --workspace @pnp/api -- response.routes.test.ts
```

### 전체 검증

```bash
npm run lint
npm run typecheck
npm run build
npm run test
```

### 브라우저 검증

1. `/response`
   - 입력 화면 첫 화면 구성 확인.
   - 예시 문구 클릭 확인.
   - `청주에서 일부러 방문한 손님이 계셨습니다.` AI 분류 확인.
   - 저장하지 않고 화면 상태만 검증.

2. `/response?mode=lookup`
   - 대표 요약 첫 화면에서 대표 리포트가 먼저 읽히는지 확인.
   - 5개 축 카드 밀도 확인.
   - `확인 필요` 링크 클릭이 상세 기록 필터로 이어지는지 확인.

3. `/response?mode=lookup&tab=detail`
   - 목록 표시 수와 더 보기 확인.
   - 기준 필터 사용성 확인.
   - `직원 분류`/`AI 분류` 배지 확인.
   - 수정/삭제 액션 위치 확인.

4. 콘솔/레이아웃
   - 각 경로에서 브라우저 콘솔 에러 없음 확인.
   - `document.documentElement.scrollWidth <= window.innerWidth` 확인.

---

## 7. 리스크와 주의점

- 현재 `/response`에서 AI 분류가 실제로 정상 동작하므로, 분류 API 자체를 크게 바꾸기보다 UI/표현부터 정리하는 편이 안전하다.
- `serviceRisk` API key를 바꾸면 기존 링크와 테스트가 함께 바뀌므로, 이번 개선은 표시 문구 변경 중심으로 먼저 진행하는 것이 좋다.
- 상세 기록 기준 필터를 3단계로 바꾸면 URL query 복원 로직이 필요하다. 먼저 목록 길이/배지/삭제 노출을 정리한 뒤 진행하는 것이 안전하다.
- 대표 요약은 이미 사용자 기억에 남은 “대표용, 객관적, 액션 지향” 방향과 맞아야 한다. 과한 디자인 장식이나 차트 추가는 피한다.
- 현재 이전 요청의 `AppLayout.tsx` 변경이 uncommitted 상태다. 구현 시 이 변경과 섞어 커밋할지, 별도 커밋할지 먼저 `git status --short`로 확인해야 한다.

---

## 8. 추천 실행 순서

1. Task 1, 5를 먼저 처리해 오류처럼 보이는 표현을 제거한다.
2. Task 2, 4, 6으로 첫 화면 구성을 정리한다.
3. Task 7, 9로 상세 기록의 사용성을 개선한다.
4. Task 8은 별도 작업으로 진행한다.
5. Task 10으로 분석 로직 회귀 테스트를 보강한다.
6. 전체 테스트/브라우저 검증 후 커밋한다.
