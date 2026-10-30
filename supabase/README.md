# Supabase (게임·홈페이지·어드민 공용 백엔드)

- 마이그레이션은 이 폴더가 원본이다. 테스트 프로젝트에 먼저 적용하고 QA 빌드로 확인한 뒤 운영에 같은 순서로 적용한다. 대시보드에서 손으로 고치지 않는다.
- 프로젝트: `forgarden-test`(ref `rscxzfdnbdmftortrcqt`, 서울, QA 주소용). 운영(`forgarden-prod`)은 베타 시연용으로 먼저 만들고 정식 오픈 직전에 전부 0으로 초기화한다 — `docs/launch-reset.md`.
- `ops/`: 자동 적용되지 않는 운영 스크립트. `launch_reset.sql`(전체 초기화, 기본은 dry-run)과 `launch_reset_verify.sql`(점검). 마이그레이션 폴더에 넣지 않는다.
- 새 표를 만드는 마이그레이션은 같은 변경에서 `ops/launch_reset.sql`·`ops/launch_reset_verify.sql`에 reset/ops/keep 분류를 더한다(`tests/unit/launchReset.test.ts`가 강제).
- `tests/`: 격리된 로컬 PostgreSQL 전용 뼈대와 표본. `npm run test:server-db`, `npm run test:launch-reset`.
- 클라이언트 환경변수: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (공개 키). `service_role` 키는 번들·저장소에 넣지 않는다.
- 계획: `docs/supabase-plan.md`.

## 적용 이력

- [2026-10-29: 길드 기능·오류 수집·약관 동의와 탈퇴 요청](../docs/migrations-2026-10-29.md) — QA/운영 실제 적용 버전, SQL 해시, 누락 보완 내역과 재검증 자료.
- [2026-10-27: 레이드 길드 공유·고대 지층 순위](../docs/migrations-2026-10-27.md)
- [2026-10-25: 재화 로그](../docs/migrations-2026-10-25.md)

원격 이력의 시각은 저장소 파일명과 다를 수 있다. 적용 전에는 위 기록과 실제 함수·스키마를 함께 비교하고, 이력 이름만 보고 SQL을 다시 실행하지 않는다.
