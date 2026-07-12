-- Remove obsolete inactive customer-response taxonomy rows.
-- These were the first draft criteria kept only for migration fallback; live responses were moved to the active 2000+ taxonomy.
DELETE FROM response_criterion
WHERE is_active = false
  AND id BETWEEN 1000 AND 1999;

-- Manual corrections after bulk AI reclassification: fix context-level misclassifications that affected reports.
WITH target(id, criterion_id, major_criterion_id, middle_criterion_id, minor_criterion_id) AS (
  VALUES
    (442::bigint, 2123, 2000, 2012, 2123),
    (450::bigint, 2330, 2002, 2033, 2330),
    (466::bigint, 2300, 2002, 2030, 2300),
    (511::bigint, 2144, 2000, 2014, 2144),
    (519::bigint, 2144, 2000, 2014, 2144),
    (534::bigint, 2300, 2002, 2030, 2300),
    (538::bigint, 2350, 2002, 2035, 2350),
    (567::bigint, 2144, 2000, 2014, 2144),
    (576::bigint, 2144, 2000, 2014, 2144),
    (591::bigint, 2123, 2000, 2012, 2123),
    (596::bigint, 2144, 2000, 2014, 2144),
    (629::bigint, 2144, 2000, 2014, 2144),
    (637::bigint, 2300, 2002, 2030, 2300)
)
UPDATE customer_response AS response
SET criterion_id = target.criterion_id,
    major_criterion_id = target.major_criterion_id,
    middle_criterion_id = target.middle_criterion_id,
    minor_criterion_id = target.minor_criterion_id,
    llm_assisted = true
FROM target
WHERE response.id = target.id;

-- Mark remaining imported/manual records as reviewed after gateway reclassification.
UPDATE customer_response
SET llm_assisted = true
WHERE llm_assisted = false;
