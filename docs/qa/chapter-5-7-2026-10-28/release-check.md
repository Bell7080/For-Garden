# 5~7장 배경 적용 및 배포 설정 점검

- 점검 시작 기준: main `8c8b8c8f`, v0.389.0. 이후 `d0ed1944`(v0.390.1)까지 통합했다.
- 승인된 PNG에서 변환한 WebP 4장만 공개 자산에 추가했다. 원본은 output/chapter-5-7-backgrounds/v1에 보관한다.
- 5·6장 지도: map_ch56.webp, 전장: field_ch56.webp.
- 7장 지도: map_ch7.webp, 전장: field_ch7.webp.
- 점검 중 최신 main에 5~7장 스토리·관문 구현이 추가되어 함께 통합했다. 이번 배경 변경은 해당 관문에 새 원화를 연결하며 스토리·적 구성은 main 구현을 유지한다.
- 5·6장은 노드 진행을 위→아래로 전환해 하강 구도에 맞췄다. 스크롤·선택·미리보기는 같은 행 계산을 쓴다. 7장은 기존 아래→위 진행으로 하단 감금동→상단 제3지부 흐름을 따른다.

## DB

- QA: rscxzfdnbdmftortrcqt, 운영: udujahnlyhedlrfbaaow.
- guild_leader_succession, guild_rank_rewards, guild_war_attack까지 두 DB 적용 이력을 확인했다.
- 미적용: supabase/migrations/20261114100000_guild_rename.sql.
- 두 DB 모두 server_guild_call_attack 래퍼가 없고, 최상위 server_guild_call 함수에 renameGuild 구현이 없는 것을 별도 SQL로 확인했다.
- 적용한다면 기존 guild_war_attack 다음에 QA 검증→운영 순서로 진행해야 한다. 이번 요청은 점검이므로 DB를 변경하지 않았다.

## Vercel 환경변수

- forgarden 및 forgarden-test의 production·preview 대상에 SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY가 등록되어 있다.
- 운영의 서버·클라이언트 URL은 운영 DB를, QA의 두 URL은 QA DB를 가리킨다.
- 운영: FORGARDEN_BUILD=production, FORGARDEN_QA_TOOLS=0. QA: FORGARDEN_BUILD=qa, FORGARDEN_QA_TOOLS=1.
- 서비스 키는 복호화하거나 출력하지 않았다. 등록 여부를 확인했으며 비공개 키의 실제 값·유효성을 이 점검만으로 단정하지 않는다.
- SUPABASE_ANON_KEY는 VITE_SUPABASE_PUBLISHABLE_KEY로 대체 가능한 선택 설정이다. 웹은 동일 출처 API를 사용하므로 VITE_GAME_API_ORIGIN도 필수 키가 아니다. WebView 출처는 cors.ts 기본 허용 목록에 있다.
- 필수 키 등록 누락은 발견하지 못했으며 환경변수를 변경하지 않았다.

## 최종 검사

- 타입 검사, production 클라이언트 빌드, production 서버 번들 재생성 통과.
- 전체 단위 검사: 5,108개 통과·4개 건너뜀. 새 방향 테스트의 0/-0 비교 1건은 좌표 비교식만 보정하고 관련 5개 파일 66개 검사를 재실행해 모두 통과했다.
- production/qa/test 저장·디버그 분리 및 출시 fixture 차단 검사 통과.
