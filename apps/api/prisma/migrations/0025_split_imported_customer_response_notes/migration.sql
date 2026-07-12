-- Split imported daily-report customer responses by line and '/' so each operational note is classified independently.
WITH source_rows AS (
  SELECT
    id,
    date,
    CASE
      WHEN strpos(full_text, E'\n\n') > 0 THEN substring(full_text from 1 for strpos(full_text, E'\n\n') - 1)
      ELSE '[일일업무보고서 서비스내역 및 손님 특이사항]'
    END AS header,
    CASE
      WHEN strpos(full_text, E'\n\n') > 0 THEN substring(full_text from strpos(full_text, E'\n\n') + 2)
      ELSE coalesce(full_text, '')
    END AS body,
    llm_assisted,
    created_by,
    created_at
  FROM customer_response
  WHERE full_text LIKE '[일일업무보고서 서비스내역 및 손님 특이사항]%'
    AND date BETWEEN '2026-05-01'::date AND '2026-06-30'::date
), split_notes AS (
  SELECT
    source_rows.id AS source_id,
    source_rows.date,
    source_rows.header,
    trim(note.value) AS note,
    source_rows.llm_assisted,
    source_rows.created_by,
    source_rows.created_at,
    note.ordinality
  FROM source_rows
  CROSS JOIN LATERAL regexp_split_to_table(source_rows.body, E'\\s*(?:/|\\n)+\\s*') WITH ORDINALITY AS note(value, ordinality)
  WHERE trim(note.value) <> ''
), classified AS (
  SELECT
    split_notes.*,
    CASE
      WHEN note ~ '(배달.*많|쿠팡.*많)' THEN 2361
      WHEN note ~ '(배달.*없|배달.*적|배달 주문이 거의|배달 주문건이 적)' THEN 2360
      WHEN note ~ '(객단가.*낮|객단가도.*낮)' THEN 2355
      WHEN note ~ '(객단가.*높)' THEN 2356
      WHEN note ~ '(품절|빵이 없어서|구매하지못|구매하지 못|공백시간|일찍.*소진|이르게 품절)' THEN 2300
      WHEN note ~ '(일찍 마감|마감 되|솔드아웃|거의 소진)' THEN 2300
      WHEN note ~ '(예약|픽업)' THEN 2330
      WHEN note ~ '(샌드위치.*수요|샌드위치.*구매|샌드위치.*인기|바질치킨)' THEN 2351
      WHEN note ~ '(대량|[0-9]+개씩|여러.*구매)' THEN 2354
      WHEN note ~ '(수요가 높|찾으시는 손님|찾는 손님|많이 구매|대부분.*구매|구매해가|잘 나갔|꾸준하게|꾸준히|고르게 판매|판매 완료|판매 많|빠르게 판매|매출.*높)' THEN 2350
      WHEN note ~ '(쌀빵|건강빵|통밀|통곡물|잡곡|신제품|계절.*문의|더 많이 만들어)' THEN 2150
      WHEN note ~ '(시식.*좋|시식 후 구매|구매로 이어|극찬|맛있|맛좋|맛 좋|긍정|만족|칭찬|좋아한다고|최고로)' THEN 2430
      WHEN note ~ '(시식 많이|반응 좋)' THEN 2430
      WHEN note ~ '(선물)' THEN 2440
      WHEN note ~ '(짜다는|짰)' THEN 2120
      WHEN note ~ '(친절|설명|안내 도와)' THEN 2201
      WHEN note ~ '(주차)' THEN 2480
      WHEN note ~ '(청주|영종도|목동|멀리|지방|여행)' THEN 2410
      WHEN note ~ '(가족)' THEN 2460
      WHEN note ~ '(어린이|아이)' THEN 2461
      WHEN note ~ '(비가|우천|더운|날씨|흐리)' THEN 2470
      WHEN note ~ '(점심시간대.*방문 많|방문 몰렸|손님 방문 많)' THEN 2452
      WHEN note ~ '(유동인구|방문.*저조|방문수.*저조|한가|뜸하다|4시 이후|오전.*저조)' THEN 2450
      WHEN note ~ '(컷팅 문의|비닐.*문의|쇼핑백|봉투 문의|상품권|크림이나 잼|모양이 다른|보관.*문의|요청)' THEN 2144
      ELSE 2502
    END AS criterion_id
  FROM split_notes
), paths AS (
  SELECT
    classified.*,
    minor.parent_id AS middle_criterion_id,
    middle.parent_id AS major_criterion_id
  FROM classified
  JOIN response_criterion minor ON minor.id = classified.criterion_id
  JOIN response_criterion middle ON middle.id = minor.parent_id
), deleted AS (
  DELETE FROM customer_response response
  USING source_rows
  WHERE response.id = source_rows.id
)
INSERT INTO customer_response (
  date,
  criterion_id,
  major_criterion_id,
  middle_criterion_id,
  minor_criterion_id,
  short_summary,
  full_text,
  llm_assisted,
  created_by,
  created_at
)
SELECT
  date,
  criterion_id,
  major_criterion_id,
  middle_criterion_id,
  criterion_id,
  left(note, 200),
  header || E'\n\n' || note,
  llm_assisted,
  created_by,
  created_at
FROM paths
ORDER BY date, source_id, ordinality;
