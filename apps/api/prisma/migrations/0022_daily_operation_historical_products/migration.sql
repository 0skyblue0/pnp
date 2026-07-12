WITH renamed_products AS (
  UPDATE product
  SET name = CASE
      WHEN name IN ('깜빠뉴(H)', '깜파뉴(H)') THEN '깜빠뉴 (H)'
      WHEN name = '깜파뉴' THEN '깜빠뉴'
      WHEN name = '크로아상' THEN '크로와상'
      WHEN name = '바질치킨' THEN '바질치킨샌드위치'
      ELSE name
    END,
    updated_at = CURRENT_TIMESTAMP
  WHERE name IN ('깜빠뉴(H)', '깜파뉴(H)', '깜파뉴', '크로아상', '바질치킨')
  RETURNING id
), historical_products(name) AS (
  VALUES
    ('멜란자네'),
    ('수프+샌드위치'),
    ('수프+빵'),
    ('아몬드크로와상'),
    ('호라산 통밀'),
    ('바질치킨샌드위치')
), inserted_historical AS (
  INSERT INTO product (name, category, is_seasonal, is_active, updated_at)
  SELECT historical_products.name, NULL, FALSE, FALSE, CURRENT_TIMESTAMP
  FROM historical_products
  WHERE NOT EXISTS (
    SELECT 1 FROM product WHERE product.name = historical_products.name
  )
  RETURNING id
), deactivated_historical AS (
  UPDATE product
  SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
  WHERE name IN (SELECT name FROM historical_products)
  RETURNING id
)
UPDATE product
SET updated_at = CURRENT_TIMESTAMP
WHERE name IN ('깜빠뉴', '깜빠뉴 (H)', '크로와상');
