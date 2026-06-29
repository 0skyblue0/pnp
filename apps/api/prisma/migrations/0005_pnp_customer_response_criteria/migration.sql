-- Replace test/demo response criteria with the PNP customer-response taxonomy.
-- Existing criteria are kept for historical foreign-key safety, but hidden from active entry screens.
UPDATE response_criterion
SET is_active = FALSE,
    updated_at = NOW();

INSERT INTO response_criterion (id, parent_id, depth, name, sort_order, is_active)
VALUES
  (1000, NULL, 1, '불만', 1, TRUE),
  (1001, NULL, 1, '손님경험', 2, TRUE),
  (1002, NULL, 1, '운영보고', 3, TRUE),
  (1003, NULL, 1, '기타', 4, TRUE),

  (1010, 1000, 2, '제품', 1, TRUE),
  (1011, 1000, 2, '서비스', 2, TRUE),
  (1012, 1000, 2, '매장환경', 3, TRUE),
  (1013, 1000, 2, '위생', 4, TRUE),
  (1020, 1001, 2, '제안기타', 1, TRUE),
  (1021, 1001, 2, '일상', 2, TRUE),
  (1030, 1002, 2, '제품보고', 1, TRUE),
  (1031, 1002, 2, '현상보고', 2, TRUE),
  (1040, 1003, 2, '기타', 1, TRUE),

  (1100, 1010, 3, '맛', 1, TRUE),
  (1101, 1010, 3, '퀄리티', 2, TRUE),
  (1102, 1010, 3, '품절', 3, TRUE),
  (1110, 1011, 3, '응대지연', 1, TRUE),
  (1111, 1011, 3, '안내부족', 2, TRUE),
  (1112, 1011, 3, '주문오류', 3, TRUE),
  (1113, 1011, 3, '진열', 4, TRUE),
  (1114, 1011, 3, '포장불량', 5, TRUE),
  (1115, 1011, 3, '누락', 6, TRUE),
  (1120, 1012, 3, '청결', 1, TRUE),
  (1121, 1012, 3, '분위기', 2, TRUE),
  (1122, 1012, 3, '동선/대기', 3, TRUE),
  (1123, 1012, 3, '주차/접근', 4, TRUE),
  (1130, 1013, 3, '이물발견', 1, TRUE),
  (1131, 1013, 3, '변질이상', 2, TRUE),
  (1132, 1013, 3, '표시정보부족', 3, TRUE),
  (1200, 1020, 3, '신제품', 1, TRUE),
  (1201, 1020, 3, '기존제품', 2, TRUE),
  (1202, 1020, 3, '운영개선', 3, TRUE),
  (1203, 1020, 3, '협업이벤트제안', 4, TRUE),
  (1204, 1020, 3, '온라인스토어', 5, TRUE),
  (1210, 1021, 3, '장거리손님', 1, TRUE),
  (1211, 1021, 3, '칭찬', 2, TRUE),
  (1212, 1021, 3, '분류미정', 3, TRUE),
  (1300, 1030, 3, '품절/재고부족', 1, TRUE),
  (1301, 1030, 3, '수요', 2, TRUE),
  (1302, 1030, 3, '문의', 3, TRUE),
  (1310, 1031, 3, '방문패턴', 1, TRUE),
  (1311, 1031, 3, '구매패턴', 2, TRUE),
  (1312, 1031, 3, '이용방법/보관', 3, TRUE),
  (1400, 1040, 3, '기타', 1, TRUE);

SELECT setval(pg_get_serial_sequence('response_criterion', 'id'), GREATEST((SELECT MAX(id) FROM response_criterion), 1));
