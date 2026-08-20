/** 화면 조작에 쓰는 공용 아이콘. 스킬 아이콘과 달리 캐릭터 데이터와 무관하다. */
export const UI_ICON = {
  back: "ui-icon-back",
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
];
