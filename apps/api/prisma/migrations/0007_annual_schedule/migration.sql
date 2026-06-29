CREATE TABLE IF NOT EXISTS annual_schedule (
  id BIGSERIAL PRIMARY KEY,
  date DATE NOT NULL,
  title VARCHAR(120) NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_annual_schedule_date ON annual_schedule(date);
