CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE product (
  id SERIAL PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  category VARCHAR(40),
  is_seasonal BOOLEAN DEFAULT FALSE,
  season_start DATE,
  season_end DATE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE staff (
  id SERIAL PRIMARY KEY,
  username VARCHAR(40) UNIQUE NOT NULL,
  display_name VARCHAR(40),
  password_hash VARCHAR(80) NOT NULL,
  role VARCHAR(15) CHECK (role IN ('SALES','PRODUCTION','OWNER')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE daily_log (
  id BIGSERIAL PRIMARY KEY,
  date DATE UNIQUE NOT NULL,
  weather_summary VARCHAR(80),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE congestion_log (
  id BIGSERIAL PRIMARY KEY,
  daily_log_id BIGINT NOT NULL REFERENCES daily_log(id) ON DELETE CASCADE,
  time_slot_start TIME NOT NULL,
  time_slot_end TIME NOT NULL,
  level SMALLINT CHECK (level BETWEEN 1 AND 5),
  queue_inside BOOLEAN DEFAULT FALSE,
  queue_outside BOOLEAN DEFAULT FALSE,
  est_lost_customers INT DEFAULT 0
);

CREATE TABLE tasting_log (
  id BIGSERIAL PRIMARY KEY,
  daily_log_id BIGINT NOT NULL REFERENCES daily_log(id) ON DELETE CASCADE,
  product_id INT NOT NULL REFERENCES product(id),
  recommended BOOLEAN DEFAULT FALSE,
  converted_to_sale BOOLEAN,
  note TEXT
);

CREATE TABLE stockout_log (
  id BIGSERIAL PRIMARY KEY,
  product_id INT NOT NULL REFERENCES product(id),
  date DATE NOT NULL,
  sequence SMALLINT NOT NULL,
  stockout_at TIMESTAMPTZ NOT NULL,
  inquiry_after_stockout VARCHAR(10) CHECK (inquiry_after_stockout IN ('NONE','FEW','SOME','MANY','EXTREME')),
  discard_qty INT DEFAULT 0,
  discard_reason TEXT,
  related_lot_id BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stockout_date_product ON stockout_log(date, product_id);

CREATE TABLE absent_inquiry (
  id BIGSERIAL PRIMARY KEY,
  product_name VARCHAR(80) NOT NULL,
  product_id INT REFERENCES product(id),
  date DATE NOT NULL,
  count INT DEFAULT 1,
  note TEXT,
  UNIQUE(product_name, date)
);

CREATE TABLE customer_response (
  id BIGSERIAL PRIMARY KEY,
  date DATE NOT NULL,
  daily_log_id BIGINT REFERENCES daily_log(id),
  customer_card_id UUID,
  category VARCHAR(20) NOT NULL CHECK (category IN
    ('PRODUCT_REVIEW','SERVICE_REVIEW','VISIT_MOTIVE','REQUEST',
     'CASUAL_TALK','COMPLAINT','USE_CASE')),
  target VARCHAR(15) CHECK (target IN ('PRODUCT','STORE','STAFF','PRICE','DISPLAY')),
  sentiment_score SMALLINT CHECK (sentiment_score BETWEEN 1 AND 5),
  action_priority VARCHAR(15) CHECK (action_priority IN ('IMMEDIATE','REVIEW','RECORD_ONLY')),
  visit_origin VARCHAR(10) CHECK (visit_origin IN ('FIRST','REVISIT','REGULAR')),
  source VARCHAR(20) CHECK (source IN ('DIRECT','SNS','RECOMMEND','PASSING','DISTANT_INTENT')),
  is_boss_flag BOOLEAN DEFAULT FALSE,
  short_summary VARCHAR(200),
  full_text TEXT,
  llm_suggestion_id BIGINT,
  llm_assisted BOOLEAN DEFAULT FALSE,
  created_by INT REFERENCES staff(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_response_date_category ON customer_response(date, category);
CREATE INDEX idx_response_boss_flag ON customer_response(is_boss_flag) WHERE is_boss_flag;
CREATE INDEX idx_response_full_text_trgm ON customer_response USING gin (full_text gin_trgm_ops);

CREATE TABLE response_tag (
  response_id BIGINT NOT NULL REFERENCES customer_response(id) ON DELETE CASCADE,
  tag_code VARCHAR(30) NOT NULL,
  PRIMARY KEY (response_id, tag_code)
);

CREATE TABLE response_product (
  response_id BIGINT NOT NULL REFERENCES customer_response(id) ON DELETE CASCADE,
  product_id INT NOT NULL REFERENCES product(id),
  PRIMARY KEY (response_id, product_id)
);

CREATE TABLE response_photo (
  id BIGSERIAL PRIMARY KEY,
  response_id BIGINT NOT NULL REFERENCES customer_response(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE notification (
  id BIGSERIAL PRIMARY KEY,
  type VARCHAR(40) NOT NULL,
  title VARCHAR(120) NOT NULL,
  body TEXT,
  link VARCHAR(200),
  severity VARCHAR(10) CHECK (severity IN ('INFO','WARN','CRITICAL')),
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

CREATE INDEX idx_notification_unread ON notification(is_read, created_at);

CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  staff_id INT REFERENCES staff(id),
  action VARCHAR(20),
  entity VARCHAR(40),
  entity_id VARCHAR(40),
  before_value JSONB,
  after_value JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
