# 고대 지층 월간 마이그레이션 적용 기록

2026-10-27 한국 시간. 원격 main `051b375d2430094c97a66272c56879eb1c658747`을 fetch해 최신 상태임을 확인했다.

- 원본: `supabase/migrations/20261103000000_ancient_monthly.sql`
- Git 원본 SHA-256(LF): `cc9e2deedc0b028577d83bd4ea8472508a8db36e1d440649b3a5074b67cccec6`
- 실제 전달 SQL SHA-256(CRLF): `699e12ffd9554fde0ea480a19f7d1776b3f2c5a76267b15c663ae30abe0c72ef`
- 테스트 `rscxzfdnbdmftortrcqt`: `20261027063806_ancient_monthly`
- 운영 `udujahnlyhedlrfbaaow`: `20261027064030_ancient_monthly`

테스트 적용 후 `verify.sql`을 단일 트랜잭션으로 실행해 통과했고 모든 표본을 롤백했다. 월 키별 트리거, 지난달 저장의 이번 달 혼입 차단, 이번 달 순위·정지 계정 제외, 동일 층 시각 보존·최고층 갱신, 월 변경 시 이전 기록 보존, 주간 정산의 지층 제외, 월간 순위 보상·백분율·참여 보상, 우편 중복 지급 방지, 함수 실행 권한을 확인했다.

검증 후 동일 SQL을 운영에 적용했다. 운영의 기존 1970-01-01 상시 순위 1건이 2026-10-01 월별 순위로 이관됐다. 운영에서는 검증용 계정 생성이나 실제 보상 지급을 실행하지 않았다.

적용 후 두 환경의 관련 다섯 함수 정의 해시가 일치한다. 기존 주간 정산 함수 해시는 적용 전후 `ae3ebbae71ca18084cf95a655f147d1b`로 유지된다. 순위 트리거가 활성 상태이며, 기존 상시 순위와 소급 등록 누락은 각각 0건이다. 월간 결과·보상 지급은 양쪽 0건이다. 익명·일반 로그인 역할의 관련 함수 직접 실행은 불가하고 서버 역할의 실행 권한은 유지된다.

Supabase 보안 Advisor에 이번 지층 관련 함수의 지적은 없다. 프로젝트 전반의 기존 RLS 정책 없음·관리자 함수·익명 로그인 정책·비밀번호 유출 방지 설정 안내는 남아 있어 프로젝트 전체 보안 점검 통과를 뜻하지 않는다. 기존 안내의 해석은 [DB linter](https://supabase.com/docs/guides/database/database-linter)와 [비밀번호 보호](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)를 참고한다.

당시 DB 적용에서는 애플리케이션 코드를 변경하지 않았다. 이 적용 기록과 검증 SQL을 저장소에 보관한다.
