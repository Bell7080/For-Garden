# Claude Code 협업 안내

이 문서는 Codex와 Claude Code가 같은 구조와 의존 방향을 유지하기 위한 저장소 진입점이다.

## 필수 구조 규칙

- `src/core`: Phaser를 import하지 않는 순수 게임 규칙만 둔다.
- `src/data`: 캐릭터, 배너, 스테이지처럼 운영 중 늘어나는 정적 정의를 둔다.
- `src/managers`: 여러 씬이 공유하는 수집 상태와 재사용 UI의 공개 진입점을 둔다.
- `src/state`: 직렬화 가능한 진행 데이터 모양과 현재 메모리 세션을 둔다. 씬에서 직접 변경하지
  말고 해당 manager를 통해 변경한다.
- `src/ui`: Phaser 프리팹의 실제 구현과 테마 토큰을 둔다.
- `src/scenes`: 화면 배치와 입력 연결만 담당한다. 게임 규칙과 수집 검증을 복제하지 않는다.
- `src/puppets`: PuppetForge 로딩, 배치, 동작 재생을 전담한다.

## 캐릭터 기능을 추가할 때

1. 캐릭터 정의는 `src/data/relics.ts`에 추가한다.
2. 획득·보유·편성·애착 설정은 `RelicCollectionManager`를 사용한다.
3. 상세 정보는 `CharacterInfoManager`를 생성해 `showRelic` 또는 `showUnit`으로 연다.
4. 새 화면만의 상세 팝업을 복사해 만들지 말고 `src/ui/info.ts`의 공용 프리팹을 확장한다.
5. 전투 수치 규칙은 `src/core`에서 구현하고 Vitest로 고정한다.

## 애니메이션 주의사항

- Puppet ZIP은 `BootScene`에서 미리 파싱하며 `src/puppets/assets.ts`의 캐시를 우회하지 않는다.
- 일회성 동작은 반드시 `playMotion`을 사용한다. 직접 `delayedCall`로 idle 복귀를 만들면 이전
  타이머가 최신 피격·공격 모션을 잘라 재생 끊김처럼 보일 수 있다.
- 캐릭터마다 실제 에셋이 생기기 전까지 `public/puppets`의 두 파일과 tint는 임시 아트다.

## 변경 전 확인

`npm run typecheck`, `npm test`, `npm run build`를 기본 품질 게이트로 실행한다. UI 배치를
바꿨다면 Playwright 또는 수동 스크린샷으로 기존 1080×1920 테마와 겹침을 확인한다.
