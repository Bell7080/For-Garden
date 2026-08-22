import type { Element, Role } from "../core/types";

/**
 * 속성·직군 아이콘.
 *
 * 파일은 `scripts/prepare_icons.py`가 원본에서 구운 WebP다. 색도 그 표에서 정하므로 화면은
 * 색을 다시 칠하지 않고 그대로 쓴다 — 같은 속성이 화면마다 다른 색으로 보이지 않게 한다.
 */
export type AffinityIconKey = `element-${Element}` | `role-${Role}`;

export const ELEMENT_ICON: Record<Element, AffinityIconKey> = {
  fire: "element-fire",
  water: "element-water",
  grass: "element-grass",
  earth: "element-earth",
  wind: "element-wind",
};

export const ROLE_ICON: Record<Role, AffinityIconKey> = {
  warrior: "role-warrior",
  tank: "role-tank",
  assassin: "role-assassin",
  support: "role-support",
};

/** 아이콘이 내는 빛의 색. 아트와 같은 계열이라 발광이 색을 흐리지 않는다. */
export const AFFINITY_GLOW: Record<AffinityIconKey, number> = {
  "element-fire": 0xef5b45,
  "element-water": 0x4fa8e4,
  "element-grass": 0x63c172,
  "element-earth": 0xd29b5e,
  "element-wind": 0x86dcc8,
  "role-warrior": 0xe25c54,
  "role-tank": 0x5cb8ea,
  "role-assassin": 0xa87ce6,
  "role-support": 0x9fd45f,
};

/** 부트가 읽을 파일 목록. 키와 경로를 한곳에서만 잇는다. */
export const AFFINITY_ICON_ASSETS: ReadonlyArray<readonly [AffinityIconKey, string]> = [
  ...Object.values(ELEMENT_ICON).map((key) => [key, `/sprites/elements/${key.replace("element-", "")}.webp`] as const),
  ...Object.values(ROLE_ICON).map((key) => [key, `/sprites/roles/${key.replace("role-", "")}.webp`] as const),
];
