# Supabase (게임·홈페이지·어드민 공용 백엔드)

- 마이그레이션은 이 폴더가 원본이다. 테스트 프로젝트에 먼저 적용하고 QA 빌드로 확인한 뒤 운영에 같은 순서로 적용한다. 대시보드에서 손으로 고치지 않는다.
- 프로젝트: `forgarden-test`(ref `rscxzfdnbdmftortrcqt`, 서울). 운영(`forgarden-prod`)은 오픈 준비 시점에 만든다.
- 클라이언트 환경변수: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (공개 키). `service_role` 키는 번들·저장소에 넣지 않는다.
- 계획: `docs/supabase-plan.md`.
