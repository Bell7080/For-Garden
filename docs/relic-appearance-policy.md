# 렐릭 외형 표시 정책

- `src/puppets/assets.ts`의 skin-aware resolver만 스킨 ID를 실제 전신·SD 에셋으로 바꾼다.
- 로컬 로비·도감·편성·전투·원정·결과 화면은 `RelicAppearanceManager`가 `RelicSkinManager`의 현재 장착 ID와 resolver를 결합한 결과만 그린다. 씬은 캐릭터별 분기를 만들지 않는다.
- **스토리 대사의 `standing`은 원작 서사 연출을 보존하는 고정 캐스팅 키다.** 따라서 `standing: "torika"`는 장착 스킨을 따라가지 않고 토리카 기본 전신을 사용한다.
- 다른 플레이어의 프로필과 비동기 방어 편성은 로컬 세션을 읽지 않는다. 서버 DTO에 검증된 `equippedSkinId`가 있을 때만 그 스킨을 사용하고, 없거나 알 수 없으면 해당 렐릭 기본 외형으로 돌아간다.

이 정책은 외형 선택과 화면 배치를 분리한다. 새 스킨을 추가할 때 화면을 수정하지 말고 정적 스킨 정의와 두 resolver 표만 확장한다.
