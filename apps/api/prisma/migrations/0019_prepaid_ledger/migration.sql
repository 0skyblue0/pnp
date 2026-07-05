CREATE TABLE "prepaid_customer" (
  "id" BIGSERIAL PRIMARY KEY,
  "customer_name" VARCHAR(80) NOT NULL,
  "contact_phone" VARCHAR(40),
  "memo" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "prepaid_transaction" (
  "id" BIGSERIAL PRIMARY KEY,
  "customer_id" BIGINT NOT NULL REFERENCES "prepaid_customer"("id") ON DELETE CASCADE,
  "type" VARCHAR(10) NOT NULL,
  "amount" INTEGER NOT NULL,
  "note" TEXT,
  "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "idx_prepaid_customer_lookup" ON "prepaid_customer" ("customer_name", "contact_phone");
CREATE INDEX "idx_prepaid_transaction_customer_date" ON "prepaid_transaction" ("customer_id", "occurred_at");
