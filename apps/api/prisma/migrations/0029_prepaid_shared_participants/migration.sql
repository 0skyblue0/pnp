ALTER TABLE "prepaid_customer"
  ADD COLUMN "ledger_type" VARCHAR(20) NOT NULL DEFAULT 'GENERAL',
  ADD COLUMN "shared_limit" INTEGER;

CREATE TABLE "prepaid_participant" (
  "id" BIGSERIAL PRIMARY KEY,
  "customer_id" BIGINT NOT NULL REFERENCES "prepaid_customer"("id") ON DELETE CASCADE,
  "participant_name" VARCHAR(80) NOT NULL,
  "phone_last4" VARCHAR(4) NOT NULL,
  "limit_amount" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "prepaid_transaction"
  ADD COLUMN "participant_id" BIGINT REFERENCES "prepaid_participant"("id") ON DELETE SET NULL;

CREATE UNIQUE INDEX "uq_prepaid_participant_customer_phone" ON "prepaid_participant" ("customer_id", "phone_last4");
CREATE INDEX "idx_prepaid_participant_customer" ON "prepaid_participant" ("customer_id");
CREATE INDEX "idx_prepaid_transaction_participant" ON "prepaid_transaction" ("participant_id");
