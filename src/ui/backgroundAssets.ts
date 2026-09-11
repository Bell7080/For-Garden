/**
 * 배경 원화의 키·파일·부트 적재 범위.
 *
 * Phaser 없는 순수 모듈에 두는 이유는 **부트가 무엇을 미리 읽는가**가 메모리를 정하는 값이고,
 * 그 범위는 눈으로 확인할 수 없어 테스트로만 지킬 수 있기 때문이다. 실제 적재와 해제는
 * `backgrounds.ts`가, 언제까지 남길지는 `backgroundResidency.ts`가 맡는다.
 */

/** 화면 용도별 배경 키. 파일 번호와 실제 사용처의 대응을 한 곳에서 관리한다. */
export const BACKGROUND = {
  lobby: "background-lobby",
  relics: "background-relics",
  info: "background-info",
  battleArea: "background-battle-area",
  lab: "background-lab",
  /** 편성부터 실제 전투까지 이어지는 6번 전장 원화다. */
  combat: "background-combat",
  /** 스테이지 진행과 함께 아래에서 위로 움직이는 장축 지도 원화다. */
  stageMap: "background-stage-map",
  /** 화석을 손질하는 작업실. 장기 탐사(고고학) 전용이다. */
  archaeology: "background-archaeology",
  /** 유료 상점의 흰 쇼케이스. 인게임 재화 교환소(무역)와는 다른 자리다. */
  premiumShop: "background-premium-shop",
  /** 일반 상품과 성장 재화를 진열하는 상점 쇼케이스 배경 키다. */
  shop: "background-shop",
  /** 발굴 연출이 덮는 발굴장. 검은 판 대신 이 원화를 깔고 그 위를 눌러 어둡게 한다. */
  excavation: "background-excavation",
  /** 캐릭터 카드 안, 인물 뒤에 깔리는 원화. 등급색 필터를 통과해 은은하게만 남는다. */
  cardBackdrop: "background-card-backdrop",
  /** 진행 중인 원정에서 층과 분기를 고르는 전용 상승 지도다(Content2_001map). */
  expeditionMap: "background-expedition-map",
  /** 원정 노드에 진입한 뒤 교전 UI 아래에 까는 전용 전투 필드다(Content2_001field). */
  expeditionField: "background-expedition-field",
  /** 인물이 없는 침수 도시 원경이다(Content2_001background). 기록 화면과 순위 팝업의 환경층을 맡는다. */
  expeditionRanking: "background-expedition-ranking",
  /**
   * 케이크 대작전·현상수배·레이드의 **전투 필드**다(ContentN_001field).
   *
   * 원정 필드(`expeditionField`)와 같은 자리·같은 세로 규격이고, 콘텐츠마다 다른 장소라 키를
   * 따로 갖는다. **아직 어느 화면도 읽지 않는다** — 세 콘텐츠의 전투가 아직 없기 때문이다.
   * 원화가 먼저 준비돼 미리 등록만 해 두었고, 전투를 붙일 때 `addSceneBackground`에 이 키를
   * 넘기면 된다(경로·해제 규칙은 이미 이 표와 `backgroundResidency.ts`가 갖는다).
   */
  cakeField: "background-cake-field",
  bountyField: "background-bounty-field",
  raidField: "background-raid-field",
  /** 케이크 대작전 진입 화면 배경이다(Content3_001background). */
  sortieCake: "background-sortie-cake",
  /** 현상수배 진입 화면 배경이다(Content4_001background). */
  sortieBounty: "background-sortie-bounty",
  /** 레이드 진입 화면 배경이다(Content5_001background). */
  sortieRaid: "background-sortie-raid",
  /**
   * 복제인간 연구 도시 **도플**의 중앙 응접실이다. 교류 첫 창구가 쓰는 가로 원화이며,
   * 화면 배경이 아니라 층 버튼과 도시 쪽지 안에서 `coverCrop`으로 잘려 들어간다.
   */
  interactionDoppelParlor: "background-interaction-doppel-parlor",
  /**
   * 타이틀(로딩) 화면 전용 원화다. 화면 자체가 로딩 화면이라 다른 배경처럼 이 표의
   * `BACKGROUND_ASSETS`(로딩 단계 안에서 읽힘)로 적재할 수 없다 — `TitleScene`이
   * 씬 진입 직후 이 키로 직접 읽는다.
   */
  title: "background-title",
} as const;

/**
 * 배경 키와 파일의 유일한 대응표.
 *
 * **이 목록 전부를 부트에서 읽지 않는다.** 한 장이 디코드되면 25MB라 열여덟 장이면 로비에
 * 닿기도 전에 텍스처만 434MB가 되고, 그대로 모바일에 패키징하면 화면을 보기 전에 죽는다
 * (v0.84.1까지 그랬다). 지금은 `addSceneBackground`가 필요한 순간에 읽고 쓰는 곳이 사라지면
 * 내린다 — 남기는 규칙은 `backgroundResidency.ts`가 갖는다. 부트가 미리 읽는 것은 아래
 * `BACKGROUND_BOOT_KEYS`뿐이다.
 */
export const BACKGROUND_ASSETS = [
  // 일반 배경 스프라이트는 PuppetForge 번들과 분리한 공용 자산 경로에서 읽는다.
  [BACKGROUND.lobby, "sprites/background/background_001.webp"],
  [BACKGROUND.relics, "sprites/background/background_002.webp"],
  [BACKGROUND.info, "sprites/background/background_003.webp"],
  [BACKGROUND.battleArea, "sprites/background/background_004.webp"],
  // 5번 원화는 발굴 설비가 있는 연구소 전용 배경이다.
  [BACKGROUND.lab, "sprites/background/background_005.webp"],
  [BACKGROUND.combat, "sprites/background/background_006.webp"],
  [BACKGROUND.stageMap, "sprites/background/map_001.webp"],
  [BACKGROUND.archaeology, "sprites/background/background_007.webp"],
  [BACKGROUND.premiumShop, "sprites/background/background_008.webp"],
  // 일반 상점은 완성된 흰 쇼케이스 원화를 쓰되 유료 상점과 독립된 texture key를 유지한다.
  [BACKGROUND.shop, "sprites/background/background_008.webp"],
  [BACKGROUND.excavation, "sprites/background/background_009.webp"],
  [BACKGROUND.cardBackdrop, "sprites/background/background_010.webp"],
  // 원정 지도 WebP는 화면 배경 표가 키와 경로를 단독 소유하며 원본 복제본을 만들지 않는다.
  [BACKGROUND.expeditionMap, "sprites/content/Content2_001map.webp"],
  // 원정 전투 필드 WebP도 이미 배포 형식이므로 그대로 적재한다.
  [BACKGROUND.expeditionField, "sprites/content/Content2_001field.webp"],
  // 아래 세 콘텐츠의 배경 WebP도 같은 이유로 그대로 적재한다.
  [BACKGROUND.expeditionRanking, "sprites/content/Content2_001background.webp"],
  [BACKGROUND.sortieCake, "sprites/content/Content3_001background.webp"],
  [BACKGROUND.sortieBounty, "sprites/content/Content4_001background.webp"],
  [BACKGROUND.sortieRaid, "sprites/content/Content5_001background.webp"],
  // 세 콘텐츠의 전투 필드. 쓰는 화면이 생기기 전이지만 경로를 여기 두어야 그 화면이 키 하나만
  // 넘기면 되고, 부트가 미리 읽지 않으므로 지금 메모리를 차지하지 않는다.
  [BACKGROUND.cakeField, "sprites/content/Content3_001field.webp"],
  [BACKGROUND.bountyField, "sprites/content/Content4_001field.webp"],
  [BACKGROUND.raidField, "sprites/content/Content5_001field.webp"],
  // 교류 도시 원화는 세로 화면 배경이 아니라 판 안에 잘려 들어가는 가로 그림이다.
  [BACKGROUND.interactionDoppelParlor, "sprites/background/background_012.webp"],
  // 타이틀은 TitleScene이 직접 먼저 읽지만(그 화면이 곧 로딩 화면이다) 경로가 이 표에 있어야
  // 로비로 넘어간 뒤 25MB를 내리고, 되돌아왔을 때 다시 읽을 수 있다.
  [BACKGROUND.title, "sprites/background/background_011.webp"],
] as const;

/**
 * 부트가 미리 읽는 배경.
 *
 * 로비는 타이틀 다음 화면이라 늦게 읽으면 그 전환에서만 배경이 비고, 카드 뒷배경은 어느
 * 화면에나 카드가 서므로 붙잡아 둔다(`BACKGROUND_PINNED`). 나머지 열여섯 장은 그 화면에
 * 들어갈 때 읽는다.
 */
export const BACKGROUND_BOOT_KEYS: readonly string[] = [BACKGROUND.lobby, BACKGROUND.cardBackdrop];
