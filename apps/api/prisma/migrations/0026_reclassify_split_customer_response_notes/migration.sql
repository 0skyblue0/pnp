-- Reclassify split imported notes that became too broad under 기타 after splitting multi-note daily reports.
WITH classified AS (
  SELECT
    id,
    CASE
      WHEN coalesce(short_summary, '') ~ '(일찍 마감|마감 되|솔드아웃|거의 소진)' THEN 2300
      WHEN coalesce(short_summary, '') ~ '(수요가 높|찾으시는 손님|찾는 손님|많이 구매|대부분.*구매|구매해가|잘 나갔|꾸준하게|꾸준히|고르게 판매|판매 완료|판매 많|빠르게 판매|매출.*높)' THEN 2350
      WHEN coalesce(short_summary, '') ~ '(쌀빵|건강빵|통밀|통곡물|잡곡|신제품|계절.*문의|더 많이 만들어)' THEN 2150
      WHEN coalesce(short_summary, '') ~ '(시식.*좋|시식 후 구매|구매로 이어|극찬|맛있|맛좋|맛 좋|긍정|만족|칭찬|좋아한다고|최고로|시식 많이|반응 좋)' THEN 2430
      WHEN coalesce(short_summary, '') ~ '(선물)' THEN 2440
      WHEN coalesce(short_summary, '') ~ '(짜다는|짰)' THEN 2120
      WHEN coalesce(short_summary, '') ~ '(점심시간대.*방문 많|방문 몰렸|손님 방문 많)' THEN 2452
      WHEN coalesce(short_summary, '') ~ '(컷팅 문의|비닐.*문의|쇼핑백|봉투 문의|상품권|크림이나 잼|모양이 다른|보관.*문의|요청)' THEN 2144
      ELSE NULL
    END AS criterion_id
  FROM customer_response
  WHERE major_criterion_id = 2004
    AND full_text LIKE '[일일업무보고서 서비스내역 및 손님 특이사항]%'
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
