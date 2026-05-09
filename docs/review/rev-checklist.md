# REV Checklist

## Round 1

- [ ] 구현 범위가 `FINAL_DESIGN.md`의 관련 섹션과 일치한다.
- [ ] API 응답 envelope 형식을 지킨다.
- [ ] Zod 또는 JSON Schema 검증이 있다.
- [ ] 예약 우선 정책 영향이 검토되었다.
- [ ] 명백한 데이터 손실 또는 핵심 기능 불능이 없다.

## Round 2

- [ ] 인증/세션/CSRF 흐름이 보안 설계와 맞다.
- [ ] PII가 DB, 응답, 로그에 노출되지 않는다.
- [ ] 인덱스가 필요한 조회 경로에 반영되었다.
- [ ] 에러 코드가 `MODULE_REASON` 형식이다.

## Round 3

- [ ] 변경 라인 단위 테스트 커버리지 80% 이상이다.
- [ ] 관련 QA 인수 기준이 통과했다.
- [ ] Medium 이하 잔여 이슈는 추적 이슈가 있다.
- [ ] CI lint/typecheck/test/build가 통과했다.
