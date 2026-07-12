-- Reclassify imported daily-report customer responses that were initially parked under 기타.
-- 기타 remains available, but these operational notes have clear product, purchase, or visitor-flow signals.
WITH classified AS (
  SELECT
    id,
    CASE
      WHEN (coalesce(short_summary, '') || ' ' || coalesce(full_text, '')) ~ '(배달.*많|쿠팡.*많)' THEN 2361
      WHEN (coalesce(short_summary, '') || ' ' || coalesce(full_text, '')) ~ '(배달.*없|배달.*적|배달 주문이 거의|배달 주문건이 적)' THEN 2360
      WHEN (coalesce(short_summary, '') || ' ' || coalesce(full_text, '')) ~ '(객단가.*낮|객단가도.*낮)' THEN 2355
      WHEN (coalesce(short_summary, '') || ' ' || coalesce(full_text, '')) ~ '(객단가.*높)' THEN 2356
      WHEN (coalesce(short_summary, '') || ' ' || coalesce(full_text, '')) ~ '(품절|빵이 없어서|구매하지못|구매하지 못|공백시간|일찍.*소진|이르게 품절)' THEN 2300
      WHEN (coalesce(short_summary, '') || ' ' || coalesce(full_text, '')) ~ '(예약|픽업)' THEN 2330
      WHEN (coalesce(short_summary, '') || ' ' || coalesce(full_text, '')) ~ '(샌드위치.*수요|샌드위치.*구매|샌드위치.*인기|바질치킨)' THEN 2351
      WHEN (coalesce(short_summary, '') || ' ' || coalesce(full_text, '')) ~ '(대량|[0-9]+개씩|여러.*구매)' THEN 2354
      WHEN (coalesce(short_summary, '') || ' ' || coalesce(full_text, '')) ~ '(수요가 높|찾으시는 손님|찾는 손님|많이 구매|대부분.*구매)' THEN 2350
      WHEN (coalesce(short_summary, '') || ' ' || coalesce(full_text, '')) ~ '(쌀빵|건강빵|통밀|통곡물|신제품|계절.*문의|더 많이 만들어)' THEN 2150
      WHEN (coalesce(short_summary, '') || ' ' || coalesce(full_text, '')) ~ '(시식.*좋|극찬|맛있|긍정|만족|좋아한다고)' THEN 2430
      WHEN (coalesce(short_summary, '') || ' ' || coalesce(full_text, '')) ~ '(친절|설명|안내 도와)' THEN 2201
      WHEN (coalesce(short_summary, '') || ' ' || coalesce(full_text, '')) ~ '(주차)' THEN 2480
      WHEN (coalesce(short_summary, '') || ' ' || coalesce(full_text, '')) ~ '(청주|영종도|목동|멀리|지방|여행)' THEN 2410
      WHEN (coalesce(short_summary, '') || ' ' || coalesce(full_text, '')) ~ '(가족)' THEN 2460
      WHEN (coalesce(short_summary, '') || ' ' || coalesce(full_text, '')) ~ '(어린이|아이)' THEN 2461
      WHEN (coalesce(short_summary, '') || ' ' || coalesce(full_text, '')) ~ '(비가|우천|더운|날씨|흐리)' THEN 2470
      WHEN (coalesce(short_summary, '') || ' ' || coalesce(full_text, '')) ~ '(유동인구|방문.*저조|방문수.*저조|한가|뜸하다|4시 이후|오전.*저조)' THEN 2450
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
