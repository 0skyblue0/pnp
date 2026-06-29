INSERT INTO "annual_goal_notice" ("category", "title", "value", "note", "created_at", "updated_at")
SELECT 'sales', '올해 매출 목표', '전년 대비 +12%', '관리 탭에서 실제 목표 금액과 목표 증가율로 수정해 주세요.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "annual_goal_notice" WHERE "category" = 'sales' AND "title" = '올해 매출 목표'
);

INSERT INTO "annual_goal_notice" ("category", "title", "value", "note", "created_at", "updated_at")
SELECT 'operation', '운영 목표', '신메뉴 개발 및 판매, 일요일 매출 상승, 기계 수리비용 절감', '관리 탭에서 올해 운영 목표를 매장 상황에 맞게 수정해 주세요.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "annual_goal_notice" WHERE "category" = 'operation' AND "title" = '운영 목표'
);
