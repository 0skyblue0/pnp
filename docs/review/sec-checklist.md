# SEC Checklist

- [ ] 비밀번호는 bcrypt cost 12 이상으로 저장한다.
- [ ] 세션 쿠키는 HttpOnly, Secure, SameSite=Lax이다.
- [ ] 쓰기 API는 CSRF 헤더 토큰을 검증한다.
- [ ] Prisma 파라미터 바인딩을 사용하고 raw SQL 입력 결합이 없다.
- [ ] 사용자 입력을 HTML로 렌더링할 때 DOMPurify 또는 동등한 방어가 있다.
- [ ] 이름, 나이, 전화번호 등 PII를 저장하지 않는다.
- [ ] 응답 DTO와 로그에 PII가 포함되지 않는다.
- [ ] LLM 호출 전 PII 마스킹이 적용된다.
- [ ] 백업 외부 저장 시 암호화 절차가 있다.
