# 운영 콘솔·계측·운영 일정·출시 시각 DB 검사

이 폴더는 재실행 가능한 격리 DB 검증 자료다. 적용 결과는 [정식 적용 기록](../../migrations-2026-11-10.md)을 따른다.

```sh
node docs/qa/ops-console-migration/local-check.mjs
```

필요 조건: Node.js, Docker CLI와 로컬 Docker 소켓, 로컬 `postgres:17-alpine` 이미지,
게임과 나란히 있는 `../For-Garden-Admin` 체크아웃.
검증 기준은 게임 `136e6bf6`와 어드민 `c5823fc`다.

실행기는 네트워크 없는 일회용 DB를 만들고 Supabase 뼈대·원본 마이그레이션을 적용한다.
공유 DB URL이나 토큰을 사용하지 않는다. Docker 연결 환경변수를 제거하고 로컬 소켓을 명시한다.
성공·실패 모두 종료 시 임시 컨테이너를 제거한다.

- `verify.sql`: 운영 콘솔 v3/v4의 기능·중복 처리·권한 경계.
- `verify-analytics-schedule.sql`: 계측·저장 보존·집계·일정·감사 로그·RLS.
- `verify-launch-at.sql`: 출시 전 null 보존, 시각·공개 설정·권한.
- `verify-deployed.sql`: 원격 적용 후 읽기 전용 스키마·권한 점검. 위 8개 모두 적용된 DB가 전제다.

`verify.sql`·`verify-analytics-schedule.sql`·`verify-launch-at.sql`은 **격리 DB 전용**이다.
롤백하더라도 표본 계정·역할·환불·우편·일정·출시 시각을 다루므로 공유 QA·운영에 실행하지 않는다.
