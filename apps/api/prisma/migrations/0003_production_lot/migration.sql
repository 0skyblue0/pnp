CREATE TABLE production_lot (
  id BIGSERIAL PRIMARY KEY,
  product_id INT NOT NULL REFERENCES product(id),
  produced_at TIMESTAMPTZ NOT NULL,
  lot_type VARCHAR(10) CHECK (lot_type IN ('AM', 'PM_2ND')),
  quantity INT NOT NULL CHECK (quantity > 0),
  staff_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_production_lot_date ON production_lot(produced_at, product_id);
