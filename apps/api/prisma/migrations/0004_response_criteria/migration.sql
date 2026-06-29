DELETE FROM response_photo;
DELETE FROM response_product;
DELETE FROM response_tag;
DELETE FROM customer_response;

DROP INDEX IF EXISTS idx_response_date_category;
DROP INDEX IF EXISTS idx_response_boss_flag;

DROP TABLE IF EXISTS response_photo;
DROP TABLE IF EXISTS response_product;
DROP TABLE IF EXISTS response_tag;

CREATE TABLE response_criterion (
  id SERIAL PRIMARY KEY,
  parent_id INT REFERENCES response_criterion(id),
  depth SMALLINT NOT NULL CHECK (depth IN (1, 2, 3)),
  name VARCHAR(80) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_response_criterion_parent_depth CHECK (
    (depth = 1 AND parent_id IS NULL) OR
    (depth IN (2, 3) AND parent_id IS NOT NULL)
  )
);

CREATE INDEX idx_response_criterion_parent_order
  ON response_criterion(parent_id, sort_order);
CREATE INDEX idx_response_criterion_depth_active
  ON response_criterion(depth, is_active);

ALTER TABLE customer_response
  DROP COLUMN category,
  DROP COLUMN target,
  DROP COLUMN sentiment_score,
  DROP COLUMN action_priority,
  DROP COLUMN visit_origin,
  DROP COLUMN source,
  DROP COLUMN is_boss_flag,
  ADD COLUMN criterion_id INT NOT NULL REFERENCES response_criterion(id),
  ADD COLUMN major_criterion_id INT NOT NULL REFERENCES response_criterion(id),
  ADD COLUMN middle_criterion_id INT REFERENCES response_criterion(id),
  ADD COLUMN minor_criterion_id INT REFERENCES response_criterion(id);

CREATE INDEX idx_response_date_major
  ON customer_response(date, major_criterion_id);
CREATE INDEX idx_response_criterion
  ON customer_response(criterion_id);
