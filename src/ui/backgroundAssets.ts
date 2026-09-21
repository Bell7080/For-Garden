/**
 * 배경 원화의 키·파일·부트 적재 범위.
 *
 * Phaser 없는 순수 모듈에 두는 이유는 **부트가 무엇을 미리 읽는가**가 메모리를 정하는 값이고,
 * 그 범위는 눈으로 확인할 수 없어 테스트로만 지킬 수 있기 때문이다. 실제 적재와 해제는
 * `backgrounds.ts`가, 언제까지 남길지는 `backgroundResidency.ts`가 맡는다.
 */

import type { NavKey } from "../core/navTabs";

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
  /**
   * 고고학 상점의 무대 — 고비 사막 발굴 캠프다.
   *
   * 같은 상점 씬을 쓰면서도 배경을 가른다. 중앙 연구소 1층 편의점과 사막 한복판의 발굴
   * 캠프는 파는 것도 파는 사람도 다른 자리라, 같은 그림 위에 서면 상품표만 바뀐 같은
   * 가게로 읽힌다.
   */
  archaeologyShop: "background-archaeology-shop",
  /**
   * 전리품 상점의 무대 — 증표를 받고 물건을 내어 주는 보급 창고다.
   *
   * 레이드 진입 화면(`sortieRaid`)을 무대에 그대로 깔던 때는 상점과 그 앞 화면이 같은
   * 그림이라 어디로 들어온 것인지 배경이 말하지 못했다. 오비·프로티아의 자리를 가른 것과
   * 같은 이유다.
   */
  lootShop: "background-loot-shop",
  /**
   * 연구소 모집판의 **배너 원화**.
   *
   * 배경이 아니라 그 배너가 무엇을 뽑는 판인지 말하는 그림이라, 어느 배너가 어느 원화를
   * 쓰는지는 이 표가 아니라 **배너 데이터**(`Banner.artKey`)가 정한다. 여기 있는 것은
   * 지금 배너 둘이 함께 쓰는 기본 한 장뿐이다.
   */
  recruitFossil: "background-recruit-fossil",
  /**
   * 지층 탐사판의 **아래층** — 겉장을 부순 칸에 드러나는 맨 흙이다.
   *
   * 겉장 넉 장은 여기 키를 두지 않는다. 판이 들고 있는 번호가 곧 키라
   * `strataLayerTextureKey`가 짓고, 아래 목록이 같은 이름으로 경로를 댄다 — 원화가 늘 때
   * 이 표와 그 함수를 함께 고치는 대신 `STRATA_ART_COUNT`만 올리면 된다.
   */
  strataBase: "background-strata-base",
  /**
   * 외형 전시관의 전용 뒷배경 — 금색 납선으로 갈린 스테인드글라스 창의 홀이다.
   *
   * 웹툰 칸 셋이 이 그림의 창살과 같은 문법으로 서므로(금색 납선 · 반투명 유리면) 판 안의
   * 칸과 배경이 한 장으로 읽힌다. 다른 화면과 공유하지 않는다.
   */
  appearance: "background-appearance",
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
   * 따로 갖는다. 어느 모드가 어느 필드에 서는지는 아래 `BATTLE_FIELD_BACKGROUND` 한 표가
   * 갖고, 전투 씬은 모드로 그 표를 한 번 읽는다.
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
   * 도플 중앙 연구소의 **외곽 연구실**이다. 응접실(첫 창구)보다 안쪽으로 한 걸음 들어간
   * 자리이며 교류 두 번째 칸이 쓴다. 응접실과 같이 판 안에 `coverCrop`으로 잘려 들어간다.
   */
  interactionDoppelLab: "background-interaction-doppel-lab",
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
  // 일반 상점은 전용 원화를 쓴다 — 유료 상점(008)과 같은 그림을 나눠 쓰던 때는 두 화면이
  // 같은 자리처럼 보여 무엇을 사는 곳인지 배경이 말하지 못했다.
  [BACKGROUND.shop, "sprites/background/background_013.webp"],
  [BACKGROUND.archaeologyShop, "sprites/background/background_015.webp"],
  [BACKGROUND.lootShop, "sprites/background/background_016.webp"],
  [BACKGROUND.recruitFossil, "sprites/background/background_017.webp"],
  [BACKGROUND.strataBase, "sprites/background/strata_base.webp"],
  // 겉장은 한 번 탐사할 때마다 그중 한 장이 뽑힌다. 키 이름은 `strataLayerTextureKey`가 짓는다.
  ["background-strata-layer-001", "sprites/background/strata_layer_001.webp"],
  ["background-strata-layer-002", "sprites/background/strata_layer_002.webp"],
  ["background-strata-layer-003", "sprites/background/strata_layer_003.webp"],
  ["background-strata-layer-004", "sprites/background/strata_layer_004.webp"],
  [BACKGROUND.appearance, "sprites/background/background_014.webp"],
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
  // 세 콘텐츠의 전투 필드. 부트가 미리 읽지 않으므로 그 전투에 들어갈 때만 메모리를 차지한다.
  [BACKGROUND.cakeField, "sprites/content/Content3_001field.webp"],
  [BACKGROUND.bountyField, "sprites/content/Content4_001field.webp"],
  [BACKGROUND.raidField, "sprites/content/Content5_001field.webp"],
  // 교류 도시 원화는 세로 화면 배경이 아니라 판 안에 잘려 들어가는 가로 그림이다. 그래서
  // 파일 이름도 세로 배경 번호를 쓰지 않고 `interaction_00N`으로 갈라 둔다 — 새 도시 원화가
  // 들어올 때 굽는 스크립트와 이 표가 같은 규칙을 읽는다.
  [BACKGROUND.interactionDoppelParlor, "sprites/background/interaction_001.webp"],
  [BACKGROUND.interactionDoppelLab, "sprites/background/interaction_002.webp"],
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

/**
 * 핵심 화면 다섯이 저마다 까는 배경.
 *
 * **여기만 표를 두는 이유가 있다.** 원화를 세운 표시 객체가 사는 동안만 붙잡는 규칙은
 * "화면이 늘어도 적을 것이 없다"는 것이 장점인데, 그 규칙에는 **남겨 두는 장수**(`BACKGROUND_IDLE_KEEP`)
 * 라는 예산이 하나 있고 그 값은 2다. 그런데 이 다섯은 나란히 놓인 자리라 손이 하루에도 수십 번
 * 오간다 — **자리가 다섯인데 남는 자리가 둘**이면 되돌아오는 걸음이 거의 매번 예산 밖으로
 * 밀려난다. 실제로 크로미움에서 다섯 탭을 열한 번 오가며 재 보니 **열 번이 배경을 다시 읽었고**,
 * 그동안 화면에는 캔버스 클리어색만 남았다가 160ms에 걸쳐 밝아졌다. 탭을 누를 때마다 그
 * 암전과 카메라 전환이 시차를 두고 겹쳐 도는 것이 곧 "번쩍임"이었다.
 *
 * 그래서 이 다섯만 예산에서 빼 `BACKGROUND_PINNED`에 올린다. **부트가 미리 읽지는 않는다** —
 * 한 장이 25.2MB라 다섯을 로비 전에 올리면 v0.84.1에서 고친 그 문제가 되살아난다. 그 화면에
 * 처음 들어갈 때 읽고, 그 뒤로는 내리지 않는다.
 *
 * **표가 썩지 않게 `NavKey`로 못 박는다.** 값이 아니라 키가 `NAV_TABS`와 같은 집합이라, 여섯
 * 번째 탭이 생기면 타입이 먼저 막고 `tests/unit/backgroundResidency.test.ts`가 다시 확인한다.
 */
export const NAV_BACKGROUND: Readonly<Record<NavKey, string>> = {
  archaeology: BACKGROUND.archaeology,
  relics: BACKGROUND.relics,
  lobby: BACKGROUND.lobby,
  lab: BACKGROUND.lab,
  premium: BACKGROUND.premiumShop,
};

/**
 * 전투 모드가 서는 전장 원화.
 *
 * **씬이 모드로 분기하지 않는다.** 예전에는 `addSceneBackground` 호출 한 줄에 삼항 연산이
 * 이어 붙어 있었고, 그래서 모드가 늘 때마다 그 줄이 길어지고 빠뜨린 모드는 조용히 기본
 * 전장(`combat`)으로 떨어졌다 — 현상수배는 필드 원화가 준비돼 있는데도 **진입 화면 배경**
 * (`sortieBounty`)을 전장에 깔고 있었고, 케이크 대작전은 스토리와 같은 6번 전장에 섰다.
 * 콘텐츠마다 다른 장소에서 싸운다는 것이 이 표의 뜻이므로, 새 모드는 여기 한 줄을 더한다.
 */
export const BATTLE_FIELD_BACKGROUND = {
  stage: BACKGROUND.combat,
  // 원정은 층과 보스가 같은 장소에서 이어지므로 한 원화를 나눠 쓴다.
  expedition: BACKGROUND.expeditionField,
  expeditionBoss: BACKGROUND.expeditionField,
  cake: BACKGROUND.cakeField,
  bounty: BACKGROUND.bountyField,
  raid: BACKGROUND.raidField,
} as const;

/** 진입 데이터가 어떤 모드를 들고 와도 표에 있는 키 하나로 수렴시킨다. */
export function battleFieldBackground(mode: keyof typeof BATTLE_FIELD_BACKGROUND | string): string {
  return BATTLE_FIELD_BACKGROUND[mode as keyof typeof BATTLE_FIELD_BACKGROUND] ?? BACKGROUND.combat;
}
