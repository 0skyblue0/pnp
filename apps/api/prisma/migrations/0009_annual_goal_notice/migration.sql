CREATE TABLE "annual_goal_notice" (
  "id" BIGSERIAL PRIMARY KEY,
  "category" VARCHAR(20) NOT NULL,
  "title" VARCHAR(120) NOT NULL,
  "value" VARCHAR(200) NOT NULL,
  "note" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "idx_annual_goal_notice_category" ON "annual_goal_notice" ("category", "created_at");
