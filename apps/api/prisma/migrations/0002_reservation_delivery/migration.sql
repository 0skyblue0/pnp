CREATE TABLE reservation (
  id BIGSERIAL PRIMARY KEY,
  contact_token VARCHAR(64) NOT NULL,
  customer_card_id UUID,
  pickup_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(15) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','READY','COMPLETED','NO_SHOW','CANCELED')),
  cancel_reason TEXT,
  purpose VARCHAR(10) CHECK (purpose IN ('GIFT','SELF','UNKNOWN')),
  allergy_note TEXT,
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_reservation_pickup ON reservation(pickup_at, status);

CREATE TABLE reservation_item (
  id BIGSERIAL PRIMARY KEY,
  reservation_id BIGINT NOT NULL REFERENCES reservation(id) ON DELETE CASCADE,
  product_id INT NOT NULL REFERENCES product(id),
  quantity INT NOT NULL CHECK (quantity > 0)
);

CREATE INDEX idx_reservation_item_product ON reservation_item(product_id);

CREATE TABLE delivery_eligible_product (
  id BIGSERIAL PRIMARY KEY,
  product_id INT NOT NULL REFERENCES product(id),
  is_eligible BOOLEAN NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE,
  caution_note TEXT,
  updated_by INT REFERENCES staff(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_delivery_eligible_active ON delivery_eligible_product(product_id, effective_from, effective_to);
