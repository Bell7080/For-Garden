/** 화면 조작에 쓰는 공용 아이콘. 스킬 아이콘과 달리 캐릭터 데이터와 무관하다. */
export const UI_ICON = {
  back: "ui-icon-back",
  /** 로비 가방과 인벤토리 작업판을 잇는 전용 홀로그램 픽토그램. */
  bag: "ui-icon-bag",
  /** 지층 탐사의 남은 횟수를 말하는 곡괭이. 재화가 아니라 조작 횟수다. */
  pickaxe: "ui-icon-pickaxe",
  /** 광고를 보고 받는 자리의 얼굴 — 스테미나 광고 칸, 발굴·빠른 원정의 광고 버튼이 같은 그림이다. */
  ad: "ui-icon-ad",
} as const;

export type UiIconKey = (typeof UI_ICON)[keyof typeof UI_ICON];

/**
 * BootScene이 한 번에 적재하는 목록.
 *
 * SVG는 `load.svg`로 원하는 크기에 맞춰 래스터화한다. `load.image`로 읽으면 브라우저가 정한
 * 기본 크기로 그려져 확대할 때 흐려진다.
 */
export const UI_ICON_ASSETS: ReadonlyArray<readonly [UiIconKey, string, number]> = [
  [UI_ICON.back, "sprites/ui/back.svg", 96],
  [UI_ICON.bag, "sprites/ui/bag.svg", 96],
];

/**
 * 이미 구워 둔 WebP로 오는 UI 아이콘.
 *
 * 위 목록은 `load.svg`로 원하는 크기에 맞춰 래스터화하지만, 원화로 그려 온 아이콘은 벡터가
 * 아니라 그림 한 장이라 그대로 읽는다 — 같은 목록에 섞으면 SVG 파서가 읽지 못해 조용히 빈
 * 텍스처가 된다.
 */
export const UI_RASTER_ICON_ASSETS: ReadonlyArray<readonly [UiIconKey, string]> = [
  [UI_ICON.pickaxe, "sprites/ui/pickaxe.webp"],
  [UI_ICON.ad, "sprites/ui/ad.webp"],
];
