ALTER TABLE product
  ADD COLUMN IF NOT EXISTS sort_order INTEGER;

UPDATE product
SET sort_order = CASE name
  WHEN '바게트' THEN 10
  WHEN '바게트(H)' THEN 20
  WHEN '화바게트' THEN 30
  WHEN '화바게트(H)' THEN 40
  WHEN '깜빠뉴' THEN 50
  WHEN '깜빠뉴 (H)' THEN 60
  WHEN '식 빵' THEN 70
  WHEN '식 빵(H)' THEN 80
  WHEN '호밀빵' THEN 90
  WHEN '호밀빵(H)' THEN 100
  WHEN '블랙올리브' THEN 110
  WHEN '허 브' THEN 120
  WHEN '치아바타' THEN 130
  WHEN '화치아바타' THEN 140
  WHEN '크로와상' THEN 150
  WHEN '뺑오쇼콜라' THEN 160
  WHEN '플레인 스콘' THEN 170
  WHEN '크랜베리 스콘' THEN 180
  WHEN '브 레 첼' THEN 190
  WHEN '앙버터' THEN 200
  WHEN '베이컨 에피' THEN 210
  WHEN '허브치아바타' THEN 220
  WHEN '올리브 치아바타' THEN 230
  WHEN '쌀식빵' THEN 240
  WHEN '단팥빵' THEN 250
  WHEN '소금빵' THEN 260
  WHEN '마늘바게트' THEN 270
  ELSE 10000 + id
END
WHERE sort_order IS NULL;

ALTER TABLE product
  ALTER COLUMN sort_order SET NOT NULL;

ALTER TABLE product
  ALTER COLUMN sort_order SET DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_product_sort_order ON product(sort_order);
