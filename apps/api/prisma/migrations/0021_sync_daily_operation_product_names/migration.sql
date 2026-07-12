WITH requested_products(name, position) AS (
  VALUES
    ('바게트', 1),
    ('바게트(H)', 2),
    ('화바게트', 3),
    ('화바게트(H)', 4),
    ('깜빠뉴', 5),
    ('깜빠뉴(H)', 6),
    ('식 빵', 7),
    ('식 빵(H)', 8),
    ('호밀빵', 9),
    ('호밀빵(H)', 10),
    ('블랙올리브', 11),
    ('허 브', 12),
    ('치아바타', 13),
    ('화치아바타', 14),
    ('크로아상', 15),
    ('뺑오쇼콜라', 16),
    ('플레인 스콘', 17),
    ('크랜베리 스콘', 18),
    ('브 레 첼', 19),
    ('스틱브레첼', 20),
    ('버터브레첼', 21),
    ('호밀쇼콜라오렌지', 22),
    ('호밀비트', 23),
    ('호밀후르츠', 24),
    ('구름빵', 25),
    ('무화과 호밀스틱', 26),
    ('봄날깜빠뉴', 27),
    ('봄날깜빠뉴(H)', 28),
    ('여름메밀빵', 29),
    ('여름메밀빵(H)', 30),
    ('가을애깜빠뉴', 31),
    ('가을애깜빠뉴(H)', 32),
    ('슈톨렌', 33),
    ('미니파네토네(여름)', 34),
    ('파네토네', 35),
    ('햄치즈샌드위치', 36),
    ('치킨샌드위치', 37)
), renamed_products AS (
  UPDATE product
  SET name = '크로아상', updated_at = CURRENT_TIMESTAMP
  WHERE name = '크로와상'
  RETURNING id
), inserted_products AS (
  INSERT INTO product (name, category, is_seasonal, is_active, updated_at)
  SELECT requested_products.name, NULL, FALSE, TRUE, CURRENT_TIMESTAMP
  FROM requested_products
  WHERE NOT EXISTS (
    SELECT 1 FROM product WHERE product.name = requested_products.name
  )
  RETURNING id
), activated_requested_products AS (
  UPDATE product
  SET is_active = TRUE, updated_at = CURRENT_TIMESTAMP
  WHERE name IN (SELECT name FROM requested_products)
  RETURNING id
)
UPDATE product
SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
WHERE is_active = TRUE
  AND name NOT IN (SELECT name FROM requested_products);
