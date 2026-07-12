-- Second pass for imported report rows still under 기타 after the broad reclassification.
WITH classified AS (
  SELECT
    id,
    CASE
      WHEN (coalesce(short_summary, '') || ' ' || coalesce(full_text, '')) ~ '(시식 후 구매|구매로 이어|맛좋|맛 좋|반응 좋|칭찬)' THEN 2430
      WHEN (coalesce(short_summary, '') || ' ' || coalesce(full_text, '')) ~ '(잘 나갔|꾸준하게|꾸준히|고르게 판매|판매 완료)' THEN 2350
      ELSE NULL
    END AS criterion_id
  FROM customer_response
  WHERE major_criterion_id = 2004
    AND date BETWEEN '2026-05-01'::date AND '2026-06-30'::date
), paths AS (
  SELECT
    classified.id,
    classified.criterion_id,
    minor.parent_id AS middle_criterion_id,
    middle.parent_id AS major_criterion_id
  FROM classified
  JOIN response_criterion minor ON minor.id = classified.criterion_id
  JOIN response_criterion middle ON middle.id = minor.parent_id
  WHERE classified.criterion_id IS NOT NULL
)
UPDATE customer_response response
SET criterion_id = paths.criterion_id,
    major_criterion_id = paths.major_criterion_id,
    middle_criterion_id = paths.middle_criterion_id,
    minor_criterion_id = paths.criterion_id
FROM paths
WHERE response.id = paths.id;
