# 2026-11-14 최신 main 마이그레이션 적용

게임 main `85129d26`과 어드민 main `2ca16fc`의 마이그레이션 목록을 원격 적용 이력 및 기존 적용 기록과 대조했다.
미적용 변경은 게임의 `20261125000000_device_sessions.sql` 1개였다. 기존 이력은 원본 파일명과 적용 시각이 다르므로 이름과 기존 검증 기록을 함께 확인하고 재실행하지 않았다.

| 원본 | QA 실제 버전 | 운영 실제 버전 |
| --- | --- | --- |
| `20261125000000_device_sessions.sql` | `20261114000626` | `20261114000707` |

- QA: `rscxzfdnbdmftortrcqt`, 운영: `udujahnlyhedlrfbaaow`.
- 원본 Git blob: `aabba76e342dc98aab4ad43161aa5f1898f880eb`.
- 원본 SHA-256: `8b51b9e0f168193167d3a26601c6c4a181a972e3f4b3fe0e66ffb587b271d494`.
- QA에 먼저 원본 SQL을 적용하고 권한 검증 후 운영에 같은 SQL을 적용했다.
- 두 환경에서 적용 전에는 표와 RPC 두 개가 없음을 확인했고, 적용 후 원격 이력의 `device_sessions` 항목을 확인했다.
- 두 환경 모두 `player_device_sessions` RLS 활성화, anon/authenticated의 표 SELECT·INSERT·UPDATE·DELETE 차단을 확인했다.
- `server_claim_device_session(uuid,text)`와 `server_device_session(uuid)` 모두 anon/authenticated 실행 차단, service_role 실행 허용을 확인했다.
- 두 함수 모두 빈 `search_path` 설정을 확인했고, 존재하지 않는 사용자 ID로 세션 조회 시 null을 반환하는 읽기 동작을 두 환경에서 검증했다.
- 보안 advisor ERROR는 두 환경 모두 0건이다. 서버 전용 표의 정책 없음 INFO 및 기존 인증·SECURITY DEFINER 관련 WARN은 남아 있다. 실제 사용자 기기를 교체하는 원격 동작 검증은 하지 않았다.
- 출시 초기화는 실행하지 않았다. 신규 표는 최신 main에서 이미 초기화 및 검증 스크립트의 분류에 포함돼 있다.

같은 변경에서 아르테 스킬 아트를 추가했다. 256px 흰 실루엣 WebP 네 장을 기존 변환 도구로 생성하고 등록했다. 새 네 장의 테두리 검사값은 3.7–7.1로 기준 40 이하다. 전체 아트 검사에는 기존 `keris/ultimate` 경고가 남아 있다.

푸시 전 추가된 main `c588864c`의 픽업 교대 변경까지 반영했다. 최종 v0.456.2에서 타입 검사·일반 빌드 통과, 단위 테스트 504파일·5,679개 통과(1개 건너뜀). 최신 잠금 파일로 의존성을 다시 설치했고, 빌드의 Git 조회와 테스트는 샌드박스 프로세스 제한을 피한 실행으로 검증했다.
