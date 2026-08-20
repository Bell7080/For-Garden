# Claude Code 협업 안내

이 문서는 Codex와 Claude Code가 같은 구조와 의존 방향을 유지하기 위한 저장소 진입점이다.

## 필수 구조 규칙

- `src/core`: Phaser를 import하지 않는 순수 게임 규칙만 둔다. 실시간 전투는 `skirmish.ts`가
  좌표와 시간까지 전부 계산하고, 씬은 그 결과를 그리기만 한다. 난수는 인자로 주입한다.
- `src/api`: 씬이 의존하는 서버 인터페이스와 임시 FakeServer 구현을 둔다. 재화 차감과 가챠
  난수 결과는 씬에서 계산하지 말고 반드시 이 경계를 통과시킨다.
- `src/data`: 캐릭터, 배너, 스테이지처럼 운영 중 늘어나는 정적 정의를 둔다.
- `src/managers`: 여러 씬이 공유하는 수집 상태와 재사용 UI의 공개 진입점을 둔다.
- `src/state`: 직렬화 가능한 진행 데이터 모양과 현재 메모리 세션을 둔다. 씬에서 직접 변경하지
  말고 해당 manager를 통해 변경한다.
- `src/ui`: Phaser 프리팹의 실제 구현과 테마 토큰을 둔다. 화면을 벗어나는 뒤로가기는
  `IconButton`의 `addBackButton`만 쓰고, 자리(우하단)와 생김새를 씬마다 다시 정하지 않는다.
- `src/scenes`: 화면 배치와 입력 연결만 담당한다. 게임 규칙과 수집 검증을 복제하지 않는다.
- `src/puppets`: PuppetForge 로딩, 배치, 동작 재생을 전담한다.

## 캐릭터 기능을 추가할 때

1. 캐릭터 정의는 `src/data/relics.ts`에 추가한다.
2. 획득·보유·편성·애착 설정은 `RelicCollectionManager`를 사용한다.
3. 상세 정보는 `CharacterInfoManager`를 생성해 `showRelic` 또는 `showUnit`으로 연다.
4. 새 화면만의 상세 팝업을 복사해 만들지 말고 `src/ui/info.ts`의 공용 프리팹을 확장한다.
5. 캐릭터를 화면에 크게 세울 때는 이미지 상자가 아니라 `src/puppets/anchors.ts`가 찾아 주는
   `중심1`(코어)·`머리1` 관절을 기준으로 배치한다. 그리드·프로필의 얼굴 카드는
   `src/ui/PortraitCard.ts`를 쓰고 화면마다 잘라내기 값을 다시 계산하지 않는다.
6. 전투 수치 규칙은 `src/core`에서 구현하고 Vitest로 고정한다. 공속·이속처럼 난전 진행에
   영향을 주는 수치는 `src/core/skirmish.ts`의 상수와 함께 테스트로 묶는다.

## 애니메이션 주의사항

- Puppet ZIP은 `BootScene`에서 미리 파싱하며 `src/puppets/assets.ts`의 캐시를 우회하지 않는다.
- `puppetforge`는 GitHub 저장소(`github:Bell7080/WebGLE#<커밋 SHA>`)에서 직접 받는다. 반드시
  `Bell7080/WebGLE`의 `main`에 실제로 남아 있는 전체 SHA로 고정한다. 병합 후 삭제된 작업
  브랜치의 커밋을 가리키면 그 커밋이 사라져 `npm install` 자체가 실패한다.
- 현재 고정 커밋은 `b5af06a`(v0.41.0)이며 `pinnedSoft` 반경 감쇠가 게임 Runtime에도 들어 있다.
  범위 없는 GitHub 의존성으로 되돌리면 lockfile이 예전 Runtime을 계속 가리켜 발 고정 영역이
  통째로 딱딱하게 붙고 외곽 정점이 찌그러질 수 있으므로, 버전을 바꿀 때 ZIP과 Runtime을 함께
  회귀 검증한다.
- 최신 PuppetForge를 반영하려면 `main`의 최신 커밋 SHA로 `package.json`을 바꾸고
  `npm install`로 lockfile을 갱신한다. SHA를 그대로 두면 npm은 절대 새 커밋을 가져오지 않는다.
- 일회성 동작은 반드시 `playMotion`을 사용한다. 직접 `delayedCall`로 idle 복귀를 만들면 이전
  타이머가 최신 피격·공격 모션을 잘라 재생 끊김처럼 보일 수 있다.
- 캐릭터마다 실제 에셋이 생기기 전까지 `public/puppets`의 두 파일과 tint는 임시 아트다.

## 변경 전 확인

GitHub Actions는 두지 않는다 — 배포는 Vercel이 맡고 품질 게이트는 로컬에서 돌린다. 커밋 전에
`npm run typecheck`, `npm test`, `npm run build`를 반드시 실행한다. UI 배치를
바꿨다면 Playwright 또는 수동 스크린샷으로 기존 1080×1920 테마와 겹침을 확인한다.

## 입력 및 임시 서버

- Phaser의 `pointerdown`/`pointerup`은 터치와 마우스를 함께 지원한다. 모바일 우선 입력은
  `pointerup`(브라우저의 `touchend`)에서 확정하되 PC 테스트용 마우스 동작도 제거하지 않는다.
- 씬은 `GameApi`만 참조하고 `FakeServer`의 내부 상태를 전제로 삼지 않는다. 실제 백엔드가 생기면
  `src/api/FakeServer.ts`의 공유 인스턴스를 HTTP 구현으로 바꾸고 DTO 규격을 유지한다.
