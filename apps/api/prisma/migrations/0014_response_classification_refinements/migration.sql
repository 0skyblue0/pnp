-- Add response criteria for common bakery notes that were previously classified as 기타 or product-only.
-- Keep the existing five major groups, but add clearer subcategories for product suggestions,
-- buying demand, delivery, visit flow, weather, family/parking patterns.
INSERT INTO response_criterion (id, parent_id, depth, name, sort_order, is_active)
VALUES
  (2015, 2000, 2, '제품 제안', 6, TRUE),
  (2035, 2002, 2, '구매·수요', 6, TRUE),
  (2036, 2002, 2, '배달·플랫폼', 7, TRUE),
  (2045, 2003, 2, '방문 시간대', 6, TRUE),
  (2046, 2003, 2, '방문객 특성', 7, TRUE),
  (2047, 2003, 2, '날씨 영향', 8, TRUE),
  (2048, 2003, 2, '주차·접근', 9, TRUE),

  (2150, 2015, 3, '쌀빵/건강빵 요청', 1, TRUE),
  (2151, 2015, 3, '신제품 요청', 2, TRUE),
  (2152, 2015, 3, '계절 제품 요청', 3, TRUE),

  (2350, 2035, 3, '특정 제품 수요 높음', 1, TRUE),
  (2351, 2035, 3, '샌드위치 수요', 2, TRUE),
  (2352, 2035, 3, '큰 빵 수요', 3, TRUE),
  (2353, 2035, 3, '여러 종류 구매', 4, TRUE),
  (2354, 2035, 3, '대량 구매', 5, TRUE),
  (2355, 2035, 3, '객단가 낮음', 6, TRUE),
  (2356, 2035, 3, '객단가 높음', 7, TRUE),
  (2360, 2036, 3, '배달 주문 적음', 1, TRUE),
  (2361, 2036, 3, '배달 주문 많음', 2, TRUE),

  (2450, 2045, 3, '유동인구 낮음', 1, TRUE),
  (2451, 2045, 3, '오전 저조', 2, TRUE),
  (2452, 2045, 3, '점심 몰림', 3, TRUE),
  (2453, 2045, 3, '오후 몰림', 4, TRUE),
  (2454, 2045, 3, '4시 이후 저조', 5, TRUE),
  (2460, 2046, 3, '가족 단위', 1, TRUE),
  (2461, 2046, 3, '어린이 손님', 2, TRUE),
  (2470, 2047, 3, '날씨로 방문 감소', 1, TRUE),
  (2471, 2047, 3, '날씨로 방문 증가', 2, TRUE),
  (2480, 2048, 3, '주차지원 요청', 1, TRUE),
  (2481, 2048, 3, '접근 문의', 2, TRUE)
ON CONFLICT (id) DO UPDATE
SET parent_id = EXCLUDED.parent_id,
    depth = EXCLUDED.depth,
    name = EXCLUDED.name,
    sort_order = EXCLUDED.sort_order,
    is_active = TRUE,
    updated_at = NOW();

SELECT setval(pg_get_serial_sequence('response_criterion', 'id'), GREATEST((SELECT MAX(id) FROM response_criterion), 1));
