ALTER TABLE "annual_goal_notice"
  ADD COLUMN "target_year" SMALLINT,
  ADD COLUMN "monthly_targets" JSONB;

CREATE INDEX "idx_annual_goal_notice_category_year"
  ON "annual_goal_notice"("category", "target_year");

CREATE TABLE "daily_operation_record" (
  "id" BIGSERIAL PRIMARY KEY,
  "date" DATE NOT NULL UNIQUE,
  "draft" JSONB NOT NULL,
  "product_rows" JSONB NOT NULL,
  "channel_rows" JSONB NOT NULL,
  "staff_special_rows" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "idx_daily_operation_record_date"
  ON "daily_operation_record"("date");
