# 폴앤폴리나 운영 관리 시스템 — 최종 설계서

| 항목 | 내용 |
|------|------|
| 버전 | v1.0 (Final) |
| 작성일 | 2026-05-07 |
| 대상 출시 범위 | Phase 2 (필수), Phase 3 (가능 시) |
| 비고 | 기존 요구사항 명세서 v1.0 + 시스템 설계서 v1.0 + LLM 스켈레톤을 통합한 최종본 |

---

## 0. 변경 이력

| 버전 | 일자 | 변경 내용 |
|------|------|--------|
| 0.1 | 2026-05-06 | 초안(요구사항 → 설계 통합) |
| 0.2 | 2026-05-06 | 4월 실데이터 기반 요구사항 정제 반영 |
| 0.3 | 2026-05-07 | 사장 답변 16건 반영, LLM 미사용 확정 |
| **1.0** | **2026-05-07** | **LLM 스켈레톤(Optional) 추가, 백엔드/프론트엔드 분리, 최종 확정** |

---

## 목차

- [1. 프로젝트 개요](#1-프로젝트-개요)
- [2. 시스템 아키텍처](#2-시스템-아키텍처)
- [3. 백엔드 설계](#3-백엔드-설계)
- [4. 프론트엔드 설계](#4-프론트엔드-설계)
- [5. 비기능 요구사항](#5-비기능-요구사항)
- [6. 보안 설계](#6-보안-설계)
- [7. Phase별 출시 계획](#7-phase별-출시-계획)
- [8. 요구사항 추적성](#8-요구사항-추적성)
- [9. 검증 체크리스트](#9-검증-체크리스트)
- [10. 부록](#10-부록)

---

## 1. 프로젝트 개요

### 1.1 핵심 가치 명제

> **"흩어진 운영 신호(품절·문의·요청·감성)를 모아 의사결정으로 이어주는 것"**

본 시스템의 본질은 매출 분석 도구가 아니다. 4월 실데이터 분석 결과, 매장에서 매일 발생하는 신호 — **빵 슬라이스 요청 3건**, **브레첼 택배 요청 2건**, **뺑오쇼콜라 5일 연속 부재 문의** — 가 자유 서술 안에 묻혀 운영 결정에 반영되지 못하는 문제를 해결하는 것이 1차 목표.

### 1.2 사용자 페르소나

| 역할 | 주요 작업 | 디바이스 |
|------|---------|---------|
| 판매팀 직원 | 일일 운영 로그·반응·컴플레인 입력, 예약 접수, 품절 기록 | 태블릿 (1초~30초 입력) |
| 생산팀 직원 | 일일 생산량·종류 입력, 폐기 기록, 예약 물량 확인 | 태블릿 |
| 운영자(사장) | 보고서 열람, 운영 제안 검토, 컴플레인 처리, 정책 결정 | PC/모바일 |

### 1.3 확정 제약 조건

| 항목 | 확정 사항 |
|------|---------|
| 동시 사용자 | 1~2명 |
| 주 디바이스 | 태블릿 우선 |
| 네트워크 | Wi-Fi 상시 연결 (오프라인 모드 불필요) |
| 권한 모델 | 단일 권한 |
| 외부 채널 알림 | 없음 — 시스템 내 알림 센터만 |
| 개인정보 | POS가 담당, 본 시스템은 식별 토큰만 |
| 저장 정보 | 이름·나이 미저장, 최소 식별만 |
| 택배 가능 제품 | 관리 페이지에서 CRUD |
| 원재료 변경 추적 | 필수 |
| 시식 결정자 | 판매직원 |
| 예약 vs 워크인 | **예약 우선** |
| 생산량 기록 | 도입 |
| LLM 사용 | **기본 비활성** (스켈레톤만 포함, Phase 4+ 옵션) |
| 출시 범위 | Phase 2 (가능 시 Phase 3) |
| 데이터 이관 | 불필요 |

---

## 2. 시스템 아키텍처

### 2.1 논리 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                    [Tablet/PC Browser]                       │
│           Frontend SPA (PWA, 태블릿 우선, 반응형)             │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS/JSON
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  [Application Server]                        │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  REST API                                            │    │
│  │  ┌──────────┬──────────┬──────────┬──────────┐      │    │
│  │  │ M1 일일  │ M2 예약  │ M3 반응  │ M4 컴플  │      │    │
│  │  ├──────────┼──────────┼──────────┼──────────┤      │    │
│  │  │ M5 제안  │ M6 재고  │ M7 매출  │ M8 외부  │      │    │
│  │  ├──────────┼──────────┼──────────┼──────────┤      │    │
│  │  │ M9 고객  │ M10 보고 │ M11 원재료│M12 택배 │      │    │
│  │  ├──────────┴──────────┴──────────┴──────────┤      │    │
│  │  │           M13 알림 센터                     │      │    │
│  │  ├────────────────────────────────────────────┤      │    │
│  │  │     LLM 모듈 (스켈레톤, 비활성)              │      │    │
│  │  └────────────────────────────────────────────┘      │    │
│  │  공통: 인증 / 검증 / 로깅 / 스케줄러                 │    │
│  └────────────────────────┬────────────────────────────┘    │
│                           │                                  │
│  ┌────────────────────────▼─────────────────────────────┐   │
│  │   PostgreSQL  (운영 DB + 시계열)                      │   │
│  │   File Storage (사진 첨부)                           │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────────────┘
                       │ (스케줄러 1일 1회)
                       ▼
        ┌──────────────────────────────┐
        │  외부 API                     │
        │  - 기상청                     │
        │  - 한국환경공단(미세먼지)      │
        │  - 공휴일 API                 │
        └──────────────────────────────┘
```

### 2.2 기술 스택 (확정 권장안)

| 영역 | 선택 | 근거 |
|------|------|------|
| Frontend | React 18 + Vite + TypeScript | 컴포넌트 생태계, PWA 지원, 타입 안정성 |
| UI 라이브러리 | Tailwind CSS + Headless UI | 태블릿 큰 터치 타겟 자유 설계 |
| 상태 관리 | TanStack Query + Zustand | 서버 상태/클라이언트 상태 분리 |
| Backend | Node.js 20 + Fastify + TypeScript | 단일 언어 일관성, 타입 공유 가능 |
| ORM | Prisma | 스키마 우선, 마이그레이션 용이 |
| DB | PostgreSQL 15+ | 시계열·전문 검색·JSONB 지원 |
| 인증 | 세션 쿠키 (HttpOnly, SameSite=Lax) | 단일 매장·단일 권한 단순화 |
| 사진 저장 | 로컬 파일 시스템 (`/var/data/photos`) | 매장 NAS 환경 가정 |
| 호스팅 | 매장 NAS 또는 소형 VPS | 비용·소규모 |
| LLM (옵션) | Anthropic Claude API | 한국어 강세, 프롬프트 캐싱 |

### 2.3 배포 구성

```
[매장 NAS / 단일 호스트]
  ├─ Reverse Proxy (Caddy/Nginx) — HTTPS 종단
  ├─ Frontend Static (빌드 산출물 서빙)
  ├─ Backend API (PM2 또는 systemd)
  ├─ PostgreSQL (단일 인스턴스)
  └─ Cron (외부 API 동기화, 알림 트리거, 백업)
```

---

## 3. 백엔드 설계

### 3.1 도메인 모델 (개념도)

```
┌──────────┐   ┌─────────────┐   ┌──────────────┐
│ Product  │───│ Production  │───│ Stockout     │
└──────────┘   │   Lot       │   └──────────────┘
       │       └─────────────┘
       ├──────────┬─────────────────┐
       ▼          ▼                 ▼
┌──────────┐  ┌──────────┐  ┌──────────────┐
│Reservation│  │Complaint │  │DeliveryEligible│
└────┬─────┘  └─────┬────┘  └──────────────┘
     │              │
     ▼              ▼
┌──────────────────────────┐
│   CustomerCard           │
│   (PII 미보관 — 토큰만)   │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐   ┌──────────────────┐
│   CustomerResponse       │───│ OperationSuggest.│
│   (4축 분류)              │   └──────────────────┘
└──────────────────────────┘

┌──────────────┐  ┌──────────────────┐  ┌──────────────┐
│  Sales       │  │ ExternalFactor   │  │ Notification │
└──────────────┘  └──────────────────┘  └──────────────┘

┌──────────────────────────┐
│ IngredientChangeLog      │
└──────────────────────────┘

┌──────────────────────────┐
│ LlmSuggestion (Optional) │
└──────────────────────────┘
```

### 3.2 데이터베이스 스키마

#### 3.2.1 제품·생산·재고

```sql
-- 제품 마스터
CREATE TABLE product (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(80) NOT NULL,
  category        VARCHAR(40),         -- 식사빵/디저트/샌드위치/기타
  is_seasonal     BOOLEAN DEFAULT FALSE,
  season_start    DATE,
  season_end      DATE,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 생산 로트
CREATE TABLE production_lot (
  id              BIGSERIAL PRIMARY KEY,
  product_id      INT NOT NULL REFERENCES product(id),
  produced_at     TIMESTAMPTZ NOT NULL,
  lot_type        VARCHAR(10) CHECK (lot_type IN ('AM','PM_2ND')),
  quantity        INT NOT NULL,
  staff_note      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_production_lot_date ON production_lot(produced_at, product_id);

-- 품절 로그
CREATE TABLE stockout_log (
  id              BIGSERIAL PRIMARY KEY,
  product_id      INT NOT NULL REFERENCES product(id),
  date            DATE NOT NULL,
  sequence        SMALLINT NOT NULL,    -- 1차/2차 품절
  stockout_at     TIMESTAMPTZ NOT NULL,
  inquiry_after_stockout VARCHAR(10) CHECK (inquiry_after_stockout IN ('NONE','FEW','SOME','MANY','EXTREME')),
  discard_qty     INT DEFAULT 0,
  discard_reason  TEXT,
  related_lot_id  BIGINT REFERENCES production_lot(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_stockout_date_product ON stockout_log(date, product_id);

-- 부재 메뉴 문의
CREATE TABLE absent_inquiry (
  id              BIGSERIAL PRIMARY KEY,
  product_name    VARCHAR(80) NOT NULL,
  product_id      INT REFERENCES product(id),
  date            DATE NOT NULL,
  count           INT DEFAULT 1,
  note            TEXT,
  UNIQUE(product_name, date)
);
```

#### 3.2.2 일일 운영 로그

```sql
CREATE TABLE daily_log (
  id              BIGSERIAL PRIMARY KEY,
  date            DATE UNIQUE NOT NULL,
  weather_summary VARCHAR(80),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE congestion_log (
  id              BIGSERIAL PRIMARY KEY,
  daily_log_id    BIGINT NOT NULL REFERENCES daily_log(id) ON DELETE CASCADE,
  time_slot_start TIME NOT NULL,
  time_slot_end   TIME NOT NULL,
  level           SMALLINT CHECK (level BETWEEN 1 AND 5),
  queue_inside    BOOLEAN DEFAULT FALSE,
  queue_outside   BOOLEAN DEFAULT FALSE,
  est_lost_customers INT DEFAULT 0
);

CREATE TABLE tasting_log (
  id              BIGSERIAL PRIMARY KEY,
  daily_log_id    BIGINT NOT NULL REFERENCES daily_log(id) ON DELETE CASCADE,
  product_id      INT NOT NULL REFERENCES product(id),
  recommended     BOOLEAN DEFAULT FALSE,
  converted_to_sale BOOLEAN,
  note            TEXT
);
```

#### 3.2.3 예약

```sql
CREATE TABLE reservation (
  id                BIGSERIAL PRIMARY KEY,
  contact_token     VARCHAR(64) NOT NULL,    -- POS 연동 키 (해시)
  customer_card_id  UUID REFERENCES customer_card(id),
  pickup_at         TIMESTAMPTZ NOT NULL,
  status            VARCHAR(15) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','READY','COMPLETED','NO_SHOW','CANCELED')),
  cancel_reason     TEXT,
  purpose           VARCHAR(10) CHECK (purpose IN ('GIFT','SELF','UNKNOWN')),
  allergy_note      TEXT,
  memo              TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  completed_at      TIMESTAMPTZ
);
CREATE INDEX idx_reservation_pickup ON reservation(pickup_at, status);

CREATE TABLE reservation_item (
  id              BIGSERIAL PRIMARY KEY,
  reservation_id  BIGINT NOT NULL REFERENCES reservation(id) ON DELETE CASCADE,
  product_id      INT NOT NULL REFERENCES product(id),
  quantity        INT NOT NULL CHECK (quantity > 0)
);
CREATE INDEX idx_reservation_item_product ON reservation_item(product_id);
```

#### 3.2.4 고객 식별 카드 (PII 미보관)

```sql
CREATE TABLE customer_card (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_token       VARCHAR(64) UNIQUE NOT NULL,
  region_si           VARCHAR(20),
  region_gu           VARCHAR(20),
  visit_count         INT DEFAULT 0,
  is_distant          BOOLEAN DEFAULT FALSE,
  has_allergy         BOOLEAN DEFAULT FALSE,
  allergy_summary     TEXT,
  first_seen_at       TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at        TIMESTAMPTZ DEFAULT NOW()
);
```

#### 3.2.5 고객 반응 (4축)

```sql
CREATE TABLE customer_response (
  id                BIGSERIAL PRIMARY KEY,
  date              DATE NOT NULL,
  daily_log_id      BIGINT REFERENCES daily_log(id),
  customer_card_id  UUID REFERENCES customer_card(id),
  category          VARCHAR(20) NOT NULL CHECK (category IN
    ('PRODUCT_REVIEW','SERVICE_REVIEW','VISIT_MOTIVE','REQUEST',
     'CASUAL_TALK','COMPLAINT','USE_CASE')),
  target            VARCHAR(15) CHECK (target IN ('PRODUCT','STORE','STAFF','PRICE','DISPLAY')),
  sentiment_score   SMALLINT CHECK (sentiment_score BETWEEN 1 AND 5),
  action_priority   VARCHAR(15) CHECK (action_priority IN ('IMMEDIATE','REVIEW','RECORD_ONLY')),
  visit_origin      VARCHAR(10) CHECK (visit_origin IN ('FIRST','REVISIT','REGULAR')),
  source            VARCHAR(20) CHECK (source IN ('DIRECT','SNS','RECOMMEND','PASSING','DISTANT_INTENT')),
  is_boss_flag      BOOLEAN DEFAULT FALSE,
  short_summary     VARCHAR(200),
  full_text         TEXT,
  llm_suggestion_id BIGINT,                 -- LLM 제안 적용 시
  llm_assisted      BOOLEAN DEFAULT FALSE,
  created_by        INT REFERENCES staff(id),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_response_date_category ON customer_response(date, category);
CREATE INDEX idx_response_boss_flag ON customer_response(is_boss_flag) WHERE is_boss_flag;
CREATE INDEX idx_response_full_text_trgm ON customer_response USING gin (full_text gin_trgm_ops);

CREATE TABLE response_tag (
  response_id     BIGINT NOT NULL REFERENCES customer_response(id) ON DELETE CASCADE,
  tag_code        VARCHAR(30) NOT NULL,
  PRIMARY KEY (response_id, tag_code)
);

CREATE TABLE response_product (
  response_id     BIGINT NOT NULL REFERENCES customer_response(id) ON DELETE CASCADE,
  product_id      INT NOT NULL REFERENCES product(id),
  PRIMARY KEY (response_id, product_id)
);

CREATE TABLE response_photo (
  id              BIGSERIAL PRIMARY KEY,
  response_id     BIGINT NOT NULL REFERENCES customer_response(id) ON DELETE CASCADE,
  file_url        TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

#### 3.2.6 컴플레인

```sql
CREATE TABLE complaint (
  id                BIGSERIAL PRIMARY KEY,
  date              DATE NOT NULL,
  product_id        INT REFERENCES product(id),
  related_lot_id    BIGINT REFERENCES production_lot(id),
  complaint_type    VARCHAR(20) NOT NULL CHECK (complaint_type IN
    ('QUALITY','PRICE','SERVICE','POLICY','MANUAL_DOUBT')),
  description       TEXT NOT NULL,
  customer_card_id  UUID REFERENCES customer_card(id),
  status            VARCHAR(15) NOT NULL DEFAULT 'RECEIVED'
    CHECK (status IN ('RECEIVED','IN_PROGRESS','RESOLVED','UNRESOLVED')),
  reporter_staff_id INT REFERENCES staff(id),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  resolved_at       TIMESTAMPTZ
);
CREATE INDEX idx_complaint_product_date ON complaint(product_id, date);

CREATE TABLE complaint_action (
  id              BIGSERIAL PRIMARY KEY,
  complaint_id    BIGINT NOT NULL REFERENCES complaint(id) ON DELETE CASCADE,
  action_type     VARCHAR(20) CHECK (action_type IN ('REFUND','REPLACE','FREE_GIFT','EXPLANATION','OTHER')),
  note            TEXT,
  staff_id        INT REFERENCES staff(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

#### 3.2.7 운영 제안 트래커

```sql
CREATE TABLE operation_suggestion (
  id              BIGSERIAL PRIMARY KEY,
  title           VARCHAR(120) NOT NULL,
  description     TEXT,
  threshold       INT DEFAULT 3,
  status          VARCHAR(15) DEFAULT 'PROPOSED'
    CHECK (status IN ('PROPOSED','UNDER_REVIEW','ADOPTED','REJECTED','HOLD')),
  decision_note   TEXT,
  decided_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE suggestion_event (
  id                  BIGSERIAL PRIMARY KEY,
  suggestion_id       BIGINT NOT NULL REFERENCES operation_suggestion(id) ON DELETE CASCADE,
  date                DATE NOT NULL,
  source_response_id  BIGINT REFERENCES customer_response(id),
  note                TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_suggestion_event_sid_date ON suggestion_event(suggestion_id, date);
```

#### 3.2.8 원재료·매뉴얼 변경 로그

```sql
CREATE TABLE ingredient (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(80) NOT NULL,
  current_spec    VARCHAR(200),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ingredient_change_log (
  id              BIGSERIAL PRIMARY KEY,
  changed_at      DATE NOT NULL,
  ingredient_id   INT REFERENCES ingredient(id),
  change_type     VARCHAR(20) CHECK (change_type IN ('INGREDIENT','MANUAL_RECIPE')),
  before_value    VARCHAR(200),
  after_value     VARCHAR(200),
  reason          TEXT,
  affected_product_ids INT[],
  created_by      INT REFERENCES staff(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_ingredient_change_date ON ingredient_change_log(changed_at);
```

#### 3.2.9 택배 가능 제품

```sql
CREATE TABLE delivery_eligible_product (
  id              BIGSERIAL PRIMARY KEY,
  product_id      INT NOT NULL REFERENCES product(id),
  is_eligible     BOOLEAN NOT NULL,
  effective_from  DATE NOT NULL,
  effective_to    DATE,
  caution_note    TEXT,
  updated_by      INT REFERENCES staff(id),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_delivery_eligible_active ON delivery_eligible_product(product_id, effective_from, effective_to);
```

#### 3.2.10 매출

```sql
CREATE TABLE sales_daily (
  date            DATE PRIMARY KEY,
  total_amount    DECIMAL(12,2),
  notes           TEXT,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sales_by_channel (
  id              BIGSERIAL PRIMARY KEY,
  date            DATE NOT NULL,
  channel         VARCHAR(15) CHECK (channel IN
    ('STORE','COUPANG','BAEMIN','OWN_DELIVERY','PARCEL','PHONE_RES')),
  amount          DECIMAL(12,2) NOT NULL,
  order_count     INT,
  UNIQUE(date, channel)
);

CREATE TABLE sales_by_timeslot (
  id              BIGSERIAL PRIMARY KEY,
  date            DATE NOT NULL,
  time_slot_start TIME NOT NULL,
  time_slot_end   TIME NOT NULL,
  amount          DECIMAL(12,2) NOT NULL,
  UNIQUE(date, time_slot_start)
);

CREATE TABLE sales_by_product (
  id              BIGSERIAL PRIMARY KEY,
  date            DATE NOT NULL,
  product_id      INT NOT NULL REFERENCES product(id),
  quantity        INT,
  amount          DECIMAL(12,2),
  UNIQUE(date, product_id)
);
```

#### 3.2.11 외부 환경 변수

```sql
CREATE TABLE external_factor (
  date              DATE PRIMARY KEY,
  weather_main      VARCHAR(15) CHECK (weather_main IN ('SUNNY','CLOUDY','RAIN','SNOW','OTHER')),
  precipitation_mm  DECIMAL(6,2),
  temp_high         DECIMAL(4,1),
  temp_low          DECIMAL(4,1),
  feels_like_avg    DECIMAL(4,1),
  pm10              INT,
  pm25              INT,
  is_holiday        BOOLEAN DEFAULT FALSE,
  holiday_name      VARCHAR(40),
  is_pre_holiday    BOOLEAN DEFAULT FALSE,
  local_event       TEXT,
  fetched_at        TIMESTAMPTZ DEFAULT NOW()
);
```

#### 3.2.12 알림

```sql
CREATE TABLE notification (
  id              BIGSERIAL PRIMARY KEY,
  type            VARCHAR(40) NOT NULL,
  title           VARCHAR(120) NOT NULL,
  body            TEXT,
  link            VARCHAR(200),
  severity        VARCHAR(10) CHECK (severity IN ('INFO','WARN','CRITICAL')),
  is_read         BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  read_at         TIMESTAMPTZ
);
CREATE INDEX idx_notification_unread ON notification(is_read, created_at);
```

#### 3.2.13 직원

```sql
CREATE TABLE staff (
  id              SERIAL PRIMARY KEY,
  username        VARCHAR(40) UNIQUE NOT NULL,
  display_name    VARCHAR(40),
  password_hash   VARCHAR(80) NOT NULL,
  role            VARCHAR(15) CHECK (role IN ('SALES','PRODUCTION','OWNER')),
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

#### 3.2.14 LLM 제안 (스켈레톤, Phase 4+)

```sql
CREATE TABLE llm_suggestion (
  id                  BIGSERIAL PRIMARY KEY,
  source_type         VARCHAR(20) NOT NULL CHECK (source_type IN ('RESPONSE','COMPLAINT','MONTHLY_DIGEST')),
  source_id           BIGINT NOT NULL,
  task_type           VARCHAR(40) NOT NULL,
  provider            VARCHAR(40),
  model_version       VARCHAR(40),
  prompt_version      VARCHAR(20),
  raw_input_hash      VARCHAR(64),
  result_json         JSONB,
  confidence          DECIMAL(4,3),
  status              VARCHAR(15) DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','APPROVED','REJECTED','MODIFIED')),
  reviewed_by         INT REFERENCES staff(id),
  reviewed_at         TIMESTAMPTZ,
  modification_diff   JSONB,
  cost_input_tokens   INT,
  cost_output_tokens  INT,
  latency_ms          INT,
  error               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_llm_suggestion_status ON llm_suggestion(status, task_type);

CREATE TABLE llm_config (
  key             VARCHAR(60) PRIMARY KEY,
  value           TEXT,
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_by      INT REFERENCES staff(id)
);

CREATE TABLE llm_prompt_template (
  id              SERIAL PRIMARY KEY,
  task_type       VARCHAR(40) NOT NULL,
  version         VARCHAR(20) NOT NULL,
  template        TEXT NOT NULL,
  output_schema   JSONB NOT NULL,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(task_type, version)
);
```

#### 3.2.15 감사 로그

```sql
CREATE TABLE audit_log (
  id              BIGSERIAL PRIMARY KEY,
  staff_id        INT REFERENCES staff(id),
  action          VARCHAR(20),         -- CREATE/UPDATE/DELETE
  entity          VARCHAR(40),
  entity_id       VARCHAR(40),
  before_value    JSONB,
  after_value     JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.3 API 설계

#### 3.3.1 공통 규약

- **베이스**: `/api/v1`
- **인증**: 세션 쿠키 (HttpOnly, Secure, SameSite=Lax)
- **응답 포맷**:
  ```json
  { "data": {...}, "error": null }
  { "data": null, "error": { "code": "...", "message": "..." } }
  ```
- **페이지네이션**: `?page=1&size=20`, 응답에 `total, page, size`
- **시간**: ISO 8601 (UTC), 클라이언트가 KST 변환
- **에러 코드 체계**: `MODULE_REASON` (예: `RESERVATION_CONFLICT`, `LLM_DISABLED`)

#### 3.3.2 모듈별 엔드포인트

```
# M1 일일 운영 로그
GET    /daily-log/today
GET    /daily-log/{date}
POST   /daily-log/{date}/congestion
POST   /daily-log/{date}/tasting
POST   /stockout
GET    /stockout?from=&to=&product_id=
PATCH  /stockout/{id}
POST   /absent-inquiry/increment
GET    /absent-inquiry?date=&streak_days=

# M2 예약
GET    /reservation/today
GET    /reservation?from=&to=&status=
POST   /reservation
PATCH  /reservation/{id}/status
GET    /reservation/availability/{date}/{product_id}

# M3 반응
GET    /response?from=&to=&category=&boss_flag=
POST   /response
PATCH  /response/{id}
DELETE /response/{id}
POST   /response/{id}/photo
GET    /response/tags

# M4 컴플레인
GET    /complaint?status=&type=
POST   /complaint
PATCH  /complaint/{id}/status
POST   /complaint/{id}/action
GET    /complaint/{id}/related-changes

# M5 운영 제안
GET    /suggestion?status=
POST   /suggestion
POST   /suggestion/{id}/event
PATCH  /suggestion/{id}/decision
GET    /suggestion/threshold-reached

# M6 재고/생산
GET    /production-lot?date=
POST   /production-lot
GET    /inventory/today
GET    /analysis/stockout-frequent?from=&to=
GET    /analysis/discard-frequent?from=&to=

# M7 매출
POST   /sales/daily
GET    /sales/daily/{date}
GET    /sales/range?from=&to=&group_by=channel|timeslot|product

# M8 외부 변수
GET    /external-factor/{date}
POST   /external-factor/sync

# M9 고객
GET    /customer/{id}
GET    /customer/by-token/{contact_token}
POST   /customer
GET    /customer/{id}/timeline

# M10 보고서
GET    /report/weekly?week=
GET    /report/monthly?year=&month=
GET    /report/insights/dashboard
POST   /report/monthly/{ym}/export

# M11 원재료
GET    /ingredient
POST   /ingredient
GET    /ingredient-change?from=&to=&product_id=
POST   /ingredient-change

# M12 택배
GET    /delivery-eligible/active
GET    /delivery-eligible/all
PUT    /delivery-eligible/{product_id}

# M13 알림
GET    /notification?unread=true
PATCH  /notification/{id}/read
PATCH  /notification/read-all

# 인증
POST   /auth/login
POST   /auth/logout
GET    /me

# LLM (Phase 4+, 기본 비활성)
POST   /llm/classify/response/{response_id}
GET    /llm/suggestion?status=PENDING&task_type=
POST   /llm/suggestion/{id}/approve
POST   /llm/suggestion/{id}/modify
POST   /llm/suggestion/{id}/reject
GET    /llm/suggestion/{id}
POST   /llm/batch/run
GET    /llm/batch/{job_id}/status
GET    /llm/config
PUT    /llm/config/{key}
GET    /llm/usage?from=&to=
```

#### 3.3.3 핵심 API 상세 — 가용 재고 (예약 우선)

```
GET /api/v1/inventory/today

Response:
{
  "data": {
    "date": "2026-05-07",
    "products": [
      {
        "product_id": 12,
        "product_name": "봄날깜빠뉴",
        "produced": 24,
        "reserved_today": 6,
        "sold_walkin": 8,
        "available_walkin": 10,
        "stockout_at": null,
        "warning": null
      },
      {
        "product_id": 8,
        "product_name": "기본깜빠뉴",
        "produced": 12,
        "reserved_today": 8,
        "sold_walkin": 4,
        "available_walkin": 0,
        "stockout_at": "11:30:00",
        "warning": "RESERVATION_HEAVY"
      }
    ]
  }
}
```

> 정책: `available_walkin = produced − reserved − sold_walkin`. 음수면 0 클램핑 + `RESERVATION_HEAVY` 경고 + `RESERVATION_OVER_WALKIN` 알림 자동 생성.

### 3.4 비즈니스 로직 (서비스 레이어)

```
src/
├── modules/
│   ├── daily-log/
│   │   ├── daily-log.controller.ts
│   │   ├── daily-log.service.ts
│   │   └── daily-log.repository.ts
│   ├── reservation/
│   │   ├── reservation.service.ts        # 예약 생성, 상태 전이
│   │   ├── inventory-calculator.ts       # 가용 재고 = produced - reserved - sold
│   │   └── reservation-policy.ts         # 예약 우선 정책 강제
│   ├── response/
│   ├── complaint/
│   │   └── complaint-auto-linker.ts      # 직전 7일 원재료 변경 자동 매칭
│   ├── suggestion/
│   │   └── suggestion-matcher.ts         # 단순 LIKE 매칭 (LLM 미사용 시)
│   ├── production/
│   ├── sales/
│   ├── external-factor/
│   │   └── external-sync.scheduler.ts    # 매일 06:00 cron
│   ├── customer/
│   ├── report/
│   │   └── insight-rules.ts              # 룰 기반 인사이트 (LLM 미사용)
│   ├── ingredient/
│   ├── delivery-eligible/
│   ├── notification/
│   │   └── notification-emitter.ts       # 도메인 이벤트 → 알림 변환
│   └── llm/                              # 스켈레톤 (Phase 4+)
│       ├── adapters/
│       │   ├── llm-adapter.interface.ts
│       │   ├── claude.adapter.ts         # TODO
│       │   ├── openai.adapter.ts         # TODO
│       │   └── local.adapter.ts          # TODO
│       ├── pii-masker.ts
│       ├── prompt-manager.ts
│       ├── schema-validator.ts
│       └── tasks/
│           ├── t1-classify.service.ts
│           ├── t2-suggestion-match.service.ts
│           ├── t3-complaint-extract.service.ts
│           ├── t4-usecase-extract.service.ts
│           └── t5-boss-flag-recommend.service.ts
├── common/
│   ├── auth/
│   ├── audit/
│   ├── errors/
│   ├── validation/
│   └── scheduler/
└── infra/
    ├── db/ (Prisma)
    └── storage/ (file system)
```

### 3.5 외부 통합

| 외부 데이터 | 출처 | 호출 주기 | 비고 |
|------------|------|---------|------|
| 날씨 | 기상청 단기예보 API | 일 1회 06:00 | 매장 위치 격자 고정 |
| 미세먼지 | 한국환경공단 에어코리아 | 일 1회 | 측정소 코드 고정 |
| 공휴일 | 공공데이터포털 특일정보 | 월 1회 | 1년치 캐시 |
| POS 연동 | (Phase 4+) | TBD | CSV 업로드 / Webhook 인터페이스 정의만 |

### 3.6 알림 시스템 (M13)

| 알림 유형 | 트리거 | 등급 |
|---------|------|------|
| `RESERVATION_24H` | 픽업 24h 전 | INFO |
| `RESERVATION_1H` | 픽업 1h 전 | WARN |
| `RESERVATION_DUE` | 픽업 시각 도래 | WARN |
| `RESERVATION_OVER_WALKIN` | 예약 비중 > 50% (제품별) | WARN |
| `SUGGESTION_THRESHOLD` | suggestion.count >= threshold | WARN |
| `ABSENT_INQUIRY_STREAK` | 부재 문의 N일 연속 (기본 3일) | INFO |
| `COMPLAINT_UNRESOLVED` | 컴플레인 N일 미해결 (기본 3일) | CRITICAL |
| `INGREDIENT_CHANGE_COMPLAINT` | 원재료 변경 후 7일 내 관련 컴플레인 | CRITICAL |
| `TASTING_RECOMMEND` | 시즌 한정 D-7 / 폐기 빈번 | INFO |
| `LLM_REVIEW_PENDING` | LLM 제안 검토 대기 (옵션) | INFO |

### 3.7 인증·세션

- 로그인: `POST /auth/login` { username, password }
- 비밀번호 저장: bcrypt (cost factor 12)
- 세션: 서버 사이드 세션 스토어(Redis 옵션 또는 DB), 쿠키는 세션 ID만
- 만료: 8시간 (영업 시간 기준)
- CSRF: SameSite=Lax + 쓰기 API에 헤더 토큰 검증

### 3.8 LLM 모듈 (스켈레톤)

#### 3.8.1 작업 정의 (5종)

| ID | 작업 | 입력 | 출력 |
|----|------|------|------|
| T1 | 자유 서술 4축 분류 | freeText | category/target/sentiment/action_priority/tags |
| T2 | 운영 제안 의미 매칭 | freeText + 등록 suggestion 목록 | matched_ids[] |
| T3 | 컴플레인 구조화 추출 | freeText | type/product/severity/action_hint |
| T4 | 사용법·레시피 추출 | freeText | usecases[] |
| T5 | 인상 스토리 추천 | 월간 반응 모음 | candidates[] |

#### 3.8.2 어댑터 인터페이스 (TypeScript 스켈레톤)

```typescript
export interface LlmAdapter {
  readonly providerName: string;
  readonly modelId: string;
  invoke(args: {
    systemPrompt: string;
    userPrompt: string;
    outputSchema: object;       // JSON Schema
    maxTokens?: number;
    temperature?: number;
    cacheKey?: string;
  }): Promise<LlmInvokeResult>;
}

export interface LlmInvokeResult {
  parsed: unknown;
  raw: string;
  usage: { inputTokens: number; outputTokens: number };
  latencyMs: number;
}

export class ClaudeAdapter implements LlmAdapter {
  // TODO: Phase 4+ — Anthropic SDK 사용, 프롬프트 캐싱 적용
}
```

#### 3.8.3 운영 원칙

- **사람이 최종 결정**: LLM 출력은 `llm_suggestion.status = PENDING`, 직원 승인 시 본 테이블 반영
- **PII 마스킹**: 정규식으로 전화/주민번호/이름 패턴 마스킹 후 호출
- **JSON Schema 강제**: 검증 실패 시 자동 재시도(최대 1회), 그래도 실패면 거절
- **피처 토글**: `feature.llm_classification.enabled = false` 기본값
- **비용 통제**: 일별 토큰 한도 + 임계 도달 시 자동 OFF

### 3.9 백업·로깅·운영

| 항목 | 정책 |
|------|------|
| DB 백업 | 일 1회 자동 풀 백업 + 주 1회 외부 저장 (USB/클라우드) |
| 사진 백업 | 일 1회 증분 백업 |
| 보존 기간 | 1년 이상 |
| 감사 로그 | 모든 PATCH/DELETE → audit_log 기록 |
| 애플리케이션 로그 | JSON 라인 형식, 일 단위 로테이션, 30일 보관 |
| 모니터링 | 헬스체크(`/healthz`) + 외부 API 동기화 실패 알림 |

### 3.10 인덱스·성능

- 핵심 인덱스는 §3.2 각 테이블 정의에 포함
- 한글 부분일치 검색은 `pg_trgm` 확장 + `gin_trgm_ops`
- API 응답 P95 목표: 300ms 이내 (인덱스 가용 시 충분)

---

## 4. 프론트엔드 설계

### 4.1 정보 아키텍처

```
[로그인]
  └─ [홈 — 오늘 한눈에]
      ├─ 오늘의 예약 (1h 임박 강조)
      ├─ 오늘의 가용 재고
      ├─ 알림 위젯
      └─ 빠른 입력 (반응/품절/예약/컴플레인)

[일일 운영]   M1
[예약]        M2
[반응]        M3
[컴플레인]    M4
[제안 트래커] M5
[재고/생산]   M6
[매출]        M7
[고객]        M9
[보고서]      M10
[관리]
   ├─ 제품 마스터
   ├─ 원재료/변경 로그   M11
   ├─ 택배 가능 제품     M12
   └─ 직원
[LLM 검토 큐] (옵션, 활성 시 노출)
```

### 4.2 라우팅 (React Router)

```
/login
/                           → /home
/home
/daily-log/today
/daily-log/:date
/reservation
/reservation/new
/reservation/:id
/response
/response/new
/response/:id
/complaint
/complaint/:id
/suggestion
/suggestion/:id
/inventory
/production
/sales
/customer
/customer/:id
/report
/report/weekly
/report/monthly
/ingredient
/ingredient/change
/delivery-eligible
/staff
/notification
/llm/review                 (옵션)
```

### 4.3 디자인 토큰

```typescript
export const tokens = {
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  touchTarget: { min: 44 },             // px
  font: {
    body: 16,
    bodyTablet: 18,
    input: 18,
    inputTablet: 20,
    h1: 28, h2: 22, h3: 18,
  },
  color: {
    primary: '#8B5A3C',                 // 빵 톤
    bg: '#FAF7F2',
    surface: '#FFFFFF',
    text: '#2A2A2A',
    textMuted: '#6B6B6B',
    info: '#3B82F6',
    warn: '#F59E0B',
    critical: '#DC2626',
    success: '#16A34A',
  },
  radius: { sm: 6, md: 10, lg: 16 },
  shadow: { card: '0 1px 3px rgba(0,0,0,0.08)' },
};
```

### 4.4 컴포넌트 구조

```
src/
├── app/
│   ├── routes/                    # 라우트 컴포넌트
│   ├── layouts/
│   │   ├── AppLayout.tsx          # 사이드바 + 상단 알림 배지
│   │   ├── AuthLayout.tsx
│   │   └── TabletShell.tsx        # 태블릿 가로 모드 최적화
│   └── providers/                 # QueryClient, AuthProvider
├── modules/                       # 백엔드 모듈과 1:1 매칭
│   ├── daily-log/
│   ├── reservation/
│   ├── response/
│   ├── complaint/
│   ├── suggestion/
│   ├── production/
│   ├── sales/
│   ├── customer/
│   ├── report/
│   ├── ingredient/
│   ├── delivery-eligible/
│   ├── notification/
│   └── llm-review/                # 옵션
├── shared/
│   ├── ui/                        # 디자인 시스템 (Button, TagPill, Modal, ...)
│   ├── forms/                     # FastInputForm, QuickTagPicker, ...
│   ├── charts/                    # 매출/품절 차트
│   ├── api/                       # axios/fetch 클라이언트, 타입 공유
│   ├── hooks/
│   └── utils/
└── styles/
```

### 4.5 핵심 화면 명세

#### 4.5.1 홈 — 오늘 한눈에

```
┌────────────────────────────────────────────────────────────┐
│  오늘 2026-05-07 (목) 흐림 12℃-22℃            🔔 5         │
├────────────────────────────────────────────────────────────┤
│  ▸ 오늘의 예약 (5)                                          │
│    14:00 봄날깜빠뉴 ×2  [완료]  [⏰ 1h 임박]                │
│    15:30 호밀빵 ×1     [완료]                              │
│    ...                                                       │
├────────────────────────────────────────────────────────────┤
│  ▸ 오늘의 가용 재고 (예약 차감 반영)                         │
│    봄날깜빠뉴 10  | 기본깜빠뉴 0 ⚠ | 호밀빵 4 | 바게트 5    │
├────────────────────────────────────────────────────────────┤
│  ▸ 알림 (최신 5)                                            │
│    🔴 컴플레인 미해결 3일 경과                              │
│    🟡 운영 제안 임계치 도달 — 빵 슬라이스 (5건)              │
│    ...                                                       │
├────────────────────────────────────────────────────────────┤
│  [+ 반응 입력]  [+ 품절 기록]  [+ 예약 등록]  [+ 컴플레인]   │
└────────────────────────────────────────────────────────────┘
```

#### 4.5.2 4축 반응 입력 (LLM 미사용 — UX가 결정적)

상세 와이어프레임은 §10.A 참조. 입력 시간 목표: **30초 이내**.

#### 4.5.3 가용 재고 (예약 차감)

#### 4.5.4 운영 제안 트래커

#### 4.5.5 알림 센터

(전체 와이어프레임은 §10.A에 수록)

### 4.6 상태 관리

| 종류 | 도구 | 용도 |
|------|------|------|
| 서버 상태 | TanStack Query | API 데이터 캐싱·무효화 |
| 클라이언트 상태 | Zustand | 인증, 토스트, 모달, 로컬 UI 상태 |
| 폼 상태 | React Hook Form + Zod | 입력 검증, 백엔드 스키마와 공유 |

### 4.7 PWA 설정

- `manifest.json`: 매장 태블릿 홈 화면 추가
- Service Worker: 정적 자원 캐싱만 (API 오프라인 동기화는 의도적 제외)
- 디스플레이 모드: `standalone`
- 가로/세로 모두 지원, 가로 1024 기준 우선

### 4.8 LLM 검토 큐 UI (옵션)

피처 토글 ON 시 사이드바에 **"LLM 검토 큐"** 메뉴 노출, 배지에 PENDING 건수 표시. 클릭 시 카드 리스트 + [그대로 승인] / [수정 후 승인] / [거절] 액션. 상세는 §10.B.

### 4.9 접근성·반응형

- WCAG AA 명도 대비
- 키보드 포커스 명확
- 태블릿 가로 1024×768 / 세로 768×1024 모두 동작
- 폰트는 시스템 폰트 + Pretendard (한글)

---

## 5. 비기능 요구사항

| 항목 | 목표 |
|------|------|
| 입력 속도 | 손님 응대 중 1초~30초 완료 |
| API 응답 P95 | 300ms 이하 |
| 화면 전환 | 200ms 이하 |
| 가용성 | 영업 시간 99% (단일 호스트, 일 1회 백업 회복 |
| 동시 사용자 | 1~2명 |
| 데이터 보존 | 1년 이상 |
| 브라우저 | 최신 Chrome/Safari/Edge (태블릿 위주) |

---

## 6. 보안 설계

| 영역 | 정책 |
|------|------|
| HTTPS | 필수, Caddy 자동 인증서 또는 사내 인증서 |
| 비밀번호 | bcrypt(cost=12) |
| 세션 | HttpOnly + Secure + SameSite=Lax 쿠키, 8h 만료 |
| CSRF | 쓰기 API에 토큰 헤더 검증 |
| SQL Injection | Prisma 파라미터 바인딩 |
| XSS | React 기본 escape + DOMPurify (마크다운/사용자 입력 렌더 시) |
| 권한 | 단일 권한 (인증만) |
| 매장 외부 접근 | 방화벽/IP 화이트리스트 권장 |
| 백업 암호화 | 외부 저장 시 AES-256 |
| LLM 호출 시 | PII 마스킹 후 호출, 로그도 마스킹본만 보관 |
| 감사 | 모든 변경에 audit_log 기록 |

---

## 7. Phase별 출시 계획

| Phase | 모듈 | DB | API |
|-------|------|----|-----|
| **Phase 1 (MVP)** | M1, M3, M13 | product, daily_log, congestion_log, tasting_log, stockout_log, absent_inquiry, customer_response, response_*, notification, staff, audit_log | /daily-log, /stockout, /absent-inquiry, /response, /notification, /auth |
| **Phase 2 (필수)** | + M2, M4, M5, M9, M11, M12 | + reservation, reservation_item, customer_card, complaint, complaint_action, operation_suggestion, suggestion_event, ingredient, ingredient_change_log, delivery_eligible_product | + /reservation, /complaint, /suggestion, /customer, /ingredient, /delivery-eligible |
| **Phase 3 (가능 시)** | + M6, M7, M8, M10 | + production_lot, sales_*, external_factor | + /production-lot, /inventory, /sales, /external-factor, /report |
| **Phase 4 (옵션)** | + LLM 활성화 | llm_suggestion 활용 | /llm/* 활성 |

---

## 8. 요구사항 추적성

| 요구사항 ID | 모듈 | 백엔드 반영 | 프론트엔드 반영 |
|-----------|------|------------|---------------|
| US-01 (반응 30초) | M3 | POST /response, response_tag | 4축 입력 화면 §4.5.2 |
| US-02 (품절 1탭) | M1 | POST /stockout | 품절 로그 위젯 |
| US-03 (예약 30초) | M2 | POST /reservation | 예약 새 양식 |
| US-04 (1h 알림) | M2,M13 | RESERVATION_1H 룰 | 알림 센터 |
| US-05 (생산 1분) | M6 | POST /production-lot | 생산 입력 화면 |
| US-06 (제안 임계 알림) | M5,M13 | SUGGESTION_THRESHOLD 룰 | 알림 + 트래커 화면 |
| US-07 (사장 보고 마크) | M3,M10 | response.is_boss_flag | 토글 + 월간 보고서 섹션 |
| US-08 (컴플 ↔ 원재료 자동) | M4,M11 | complaint-auto-linker | 컴플 상세 화면 |
| US-09 (외부 변수 자동) | M8 | external-sync.scheduler | 매출/보고서 위젯 |
| US-10 (원거리 리스트) | M9 | customer.is_distant | 고객 리스트 필터 |
| US-11 (택배 가/불가 즉시) | M12 | GET /delivery-eligible/active | 예약 화면 인라인 표시 |
| US-12 (예약 침식 알림) | M2 | RESERVATION_OVER_WALKIN | 가용 재고 화면 + 알림 |
| US-13 (원재료 후 컴플) | M4,M11 | INGREDIENT_CHANGE_COMPLAINT | 컴플 상세 자동 표시 |

---

## 9. 검증 체크리스트

### 9.1 기능
- [ ] 모든 US-01~US-13 인수 기준 통과
- [ ] 예약 우선 정책 강제 검증 (가용 재고 음수 0 클램핑 + 알림)
- [ ] 컴플레인 ↔ 원재료 변경 7일 자동 연관
- [ ] 운영 제안 임계치 도달 시 자동 알림

### 9.2 비기능
- [ ] 태블릿 1024×768에서 모든 핵심 화면 동작
- [ ] M3 반응 입력 30초 이내 완료 가능
- [ ] 100명/월 손님 반응 + 5년 데이터 = 약 6,000건 성능 무리 없음
- [ ] 백업/복구 절차 문서화 및 1회 실제 복구 시연

### 9.3 보안
- [ ] 비밀번호 bcrypt 적용
- [ ] CSRF 토큰 검증
- [ ] PII 미저장 (DB 검증)
- [ ] LLM 호출 시 PII 마스킹 동작 (옵션 활성 시)

### 9.4 LLM (옵션 활성 시)
- [ ] JSON Schema 검증 100% 적용
- [ ] PENDING 상태에서 본 테이블 미반영
- [ ] 비용 임계 도달 시 자동 OFF

---

## 10. 부록

### 10.A 핵심 화면 와이어프레임

#### 4축 반응 입력

```
┌──────────────────────────────────────────────────┐
│  [◄ 뒤로]   고객 반응 입력         [저장] [취소] │
├──────────────────────────────────────────────────┤
│  카테고리 (1탭)                                   │
│  [제품평가][서비스][방문동기][요청제안]           │
│  [일상대화][컴플레인][사용법·레시피] ⭐           │
│                                                   │
│  대상                                              │
│  [● 제품] [매장] [직원] [가격] [진열]             │
│  → 제품: [🔍 봄날깜빠뉴 ✕] [+ 추가]               │
│                                                   │
│  감성  ☆ ☆ ☆ ☆ ☆                                  │
│  조치  [즉시] [검토] [● 단순 기록]                │
│                                                   │
│  퀵 태그                                           │
│  [멀리서] [선물용] [재방문] [단골] [냉동사용]     │
│  [SNS보고] [택배요청] [+ 더 보기]                 │
│                                                   │
│  방문 동기                                         │
│  [처음] [재방문] [단골] · [SNS] [추천] [지나가다] │
│                                                   │
│  짧은 요약 (200자)                                 │
│  ┌─────────────────────────────────────────────┐ │
│  │ 제주도서 허브빵 대량 구매, 택배 안내         │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  자세한 내용 (선택)                                │
│  ┌─────────────────────────────────────────────┐ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  📷 사진 첨부      ⭐ 사장 보고 마크 [○]          │
└──────────────────────────────────────────────────┘
```

#### 가용 재고

```
┌──────────────────────────────────────────────────┐
│  오늘의 가용 재고               2026-05-07 (목)  │
├──────────────────────────────────────────────────┤
│ 제품          생산  예약  판매  워크인 가용     │
│ 봄날깜빠뉴    24    6     8     10              │
│ 기본깜빠뉴    12    8     4      0  ⚠ 예약과다  │
│ 호밀빵        20    2    14      4              │
│ ...                                              │
├──────────────────────────────────────────────────┤
│ ⚠ 기본깜빠뉴: 예약이 가용량의 67% 차지           │
│   → 생산량 증대 검토                              │
└──────────────────────────────────────────────────┘
```

#### 운영 제안 트래커

```
┌──────────────────────────────────────────────────┐
│  운영 제안 트래커                                 │
├──────────────────────────────────────────────────┤
│ [임계 도달 ⭐] [검토 중] [전체]                   │
│                                                   │
│ ⭐ 빵 슬라이스 서비스          5/3 도달          │
│   누적 5건 [검토 시작]                            │
│                                                   │
│ ⭐ 브레첼 택배                  3/3 도달          │
│   누적 3건 [검토 시작]                            │
└──────────────────────────────────────────────────┘
```

### 10.B LLM 검토 큐 와이어프레임

```
┌────────────────────────────────────────────────────────────┐
│  LLM 분류 검토 큐                       PENDING: 12 ⏳     │
├────────────────────────────────────────────────────────────┤
│  [전체] [반응(8)] [컴플레인(2)] [사용법(2)]                │
│                                                             │
│  ─── 2026-05-07 14:23 (반응 #1284)                          │
│  원문:                                                       │
│  "제주도에서 일부러 오셨다는 손님이 허브빵 8개 사가시고      │
│   택배 안내드렸습니다..."                                    │
│                                                             │
│  LLM 제안:                                                   │
│   카테고리: 방문 동기                                         │
│   대상:     제품(허브빵)                                      │
│   감성:     ★★★★☆ (4/5)                                      │
│   조치:     검토                                              │
│   태그:     [원거리][택배요청][대량구매]                      │
│   요약:     "제주도서 허브빵 8개, 택배 안내"                   │
│                                                              │
│  [✓ 그대로 승인]  [✏ 수정 후 승인]  [✕ 거절]                  │
└────────────────────────────────────────────────────────────┘
```

### 10.C 본 문서가 다루지 않는 것

- 실제 구현 코드 → `/sc:implement` 단계에서 작성
- 픽셀 단위 디자인 → 별도 디자이너 협업
- 부하 테스트 시나리오 → 소규모 사용자라 후순위
- LLM 어댑터 실제 구현 → Phase 4+

---

**핵심 요약 (3줄)**:
1. 본 시스템의 가치는 매출 분석이 아니라 **흩어진 운영 신호를 모아 의사결정으로 잇는 것**이며, 13개 모듈로 구성된다.
2. 백엔드는 **Node.js+Fastify+Prisma+PostgreSQL** 기반 모듈러 모놀리스, 프론트엔드는 **React+TypeScript+Tailwind PWA**로 태블릿 우선.
3. **LLM은 스켈레톤만 포함**하고 기본 비활성, Phase 4+에서 사람 검토 큐와 함께 옵션 활성화한다.
