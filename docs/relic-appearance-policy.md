# 렐릭 외형 표시 정책

- `src/puppets/assets.ts`의 skin-aware resolver만 스킨 ID를 실제 전신·SD 에셋으로 바꾼다.
- 로컬 로비·도감·편성·전투·원정·결과 화면은 `RelicAppearanceManager`가 `RelicSkinManager`의 현재 장착 ID와 resolver를 결합한 결과만 그린다. 씬은 캐릭터별 분기를 만들지 않는다.
- **스토리 대사의 `standing`은 원작 서사 연출을 보존하는 고정 캐스팅 키다.** 따라서 `standing: "torika"`는 장착 스킨을 따라가지 않고 토리카 기본 전신을 사용한다.
- 다른 플레이어의 프로필과 비동기 방어 편성은 로컬 세션을 읽지 않는다. 서버 DTO에 검증된 `equippedSkinId`가 있을 때만 그 스킨을 사용하고, 없거나 알 수 없으면 해당 렐릭 기본 외형으로 돌아간다.

이 정책은 외형 선택과 화면 배치를 분리한다. 새 스킨을 추가할 때 화면을 수정하지 말고 정적 스킨 정의와 두 resolver 표만 확장한다.

## 토리카 추가 외형 기본 해금

- `torika-skin-001`은 `RelicSkinDef.defaultUnlocked`가 선언하는 무료 기본 지급 외형이다. 신규 세션과 저장 마이그레이션은 특정 ID를 복제하지 않고 정적 정의에서 기본 해금 목록을 계산한다.
- 저장 v34는 기존 소유 목록과 기본 해금 목록을 중복 없이 합친다. 현행 버전이라도 기본 해금이 빠진 데이터는 검증 전 로드 정규화에서 보충해 기존 계정이 잠긴 채 남지 않게 한다.
- 따라서 현 단계에는 스킨 상품, 구매 API, 지급 영수증, 중복 구매 처리도 없다. 특히 `src/data/products.ts`, `src/data/shopCatalog.ts`, `src/core/productAcquisition.ts`, `src/api/contracts.ts`, `FakeServer`에 스킨 보상 타입이나 토리카 상품을 미리 추가하지 않는다.
- 향후 다른 스킨의 상점 판매가 승인되면 재화 차감과 지급을 하나의 API/manager 트랜잭션으로 처리하고, 씬은 서버가 확정한 영수증만 적용한다. 중복 정책은 **차단·대체 보상·환급 중 정확히 하나를 먼저 선택**해야 한다.
