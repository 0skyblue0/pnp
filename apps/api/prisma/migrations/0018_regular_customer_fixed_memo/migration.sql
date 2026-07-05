CREATE TABLE "regular_customer" (
  "id" BIGSERIAL PRIMARY KEY,
  "customer_name" VARCHAR(80) NOT NULL,
  "contact_phone" VARCHAR(40),
  "fixed_memo" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "idx_regular_customer_lookup" ON "regular_customer" ("customer_name", "contact_phone");
