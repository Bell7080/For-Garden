/**
 * 길드 뱃지 — 배경 모양 · 배경색 · 내부 아이콘 · 내부색 네 값을 고르는 커스텀의 **순수 규칙**.
 *
 * 이미지 파일 없이 도형 좌표와 팔레트 표만 갖고, 그리는 일은 `src/ui/GuildBadge.ts` 한 장이 맡는다.
 * 서버는 네 값만 저장하고 같은 표(`isGuildBadge`)로 검증한다 — 표에 없는 값이나 배경색과 내부색이
 * 같은 조합은 거절한다(같은 색이면 아이콘이 배경에 묻힌다).
 * 좌표는 중심이 (0,0)이고 반지름 1짜리 단위 상자 안에 든다.
 */

export type GuildBadgeShapeId = "shield" | "hexagon" | "diamond" | "chip" | "octagon" | "banner" | "crownShield" | "wing";
export type GuildBadgeIconId = "sword" | "star" | "crown" | "heart" | "bolt" | "flame" | "drop" | "leaf" | "mountain" | "cheesecake" | "moon" | "bone";
export type GuildBadgeColorId = "crimson" | "orange" | "amber" | "lime" | "green" | "teal" | "sky" | "blue" | "violet" | "pink" | "silver" | "ink";

export interface GuildBadge {
  shape: GuildBadgeShapeId;
  shapeColor: GuildBadgeColorId;
  icon: GuildBadgeIconId;
  iconColor: GuildBadgeColorId;
}

export const GUILD_BADGE_SHAPES: readonly GuildBadgeShapeId[] = ["shield", "hexagon", "diamond", "chip", "octagon", "banner", "crownShield", "wing"];
export const GUILD_BADGE_ICONS: readonly GuildBadgeIconId[] = ["sword", "star", "crown", "heart", "bolt", "flame", "drop", "leaf", "mountain", "cheesecake", "moon", "bone"];

/** 고정 팔레트 12색. 자유 색상은 가독성이 깨지고 부적절한 디자인을 막기 어렵다. */
export const GUILD_BADGE_COLORS: Readonly<Record<GuildBadgeColorId, number>> = {
  crimson: 0xd9455f, orange: 0xf08a3c, amber: 0xf2c14e, lime: 0xb7d94c, green: 0x4fbf6a, teal: 0x3fbfae,
  sky: 0x5cc4f0, blue: 0x4a7be0, violet: 0x8a63d9, pink: 0xf08ac0, silver: 0xdfe6ee, ink: 0x1c2430,
};
export const GUILD_BADGE_COLOR_IDS = Object.keys(GUILD_BADGE_COLORS) as GuildBadgeColorId[];

/** 8 × 12 × 12 × 12 중 같은 색 조합(8 × 12)을 뺀 가짓수. */
export const GUILD_BADGE_COMBINATIONS = GUILD_BADGE_SHAPES.length * GUILD_BADGE_ICONS.length * GUILD_BADGE_COLOR_IDS.length * (GUILD_BADGE_COLOR_IDS.length - 1);

export type BadgePoint = readonly [number, number];

/** 배경 도형의 윤곽(시계 방향). 모두 단위 상자 안에 든다. */
export const GUILD_BADGE_SHAPE_POINTS: Readonly<Record<GuildBadgeShapeId, readonly BadgePoint[]>> = {
  shield: [[-0.8, -0.85], [0.8, -0.85], [0.8, 0.1], [0.5, 0.55], [0, 0.95], [-0.5, 0.55], [-0.8, 0.1]],
  hexagon: [[-0.5, -0.9], [0.5, -0.9], [1, 0], [0.5, 0.9], [-0.5, 0.9], [-1, 0]],
  diamond: [[0, -1], [0.85, 0], [0, 1], [-0.85, 0]],
  chip: [[-0.55, -0.9], [0.9, -0.9], [0.9, 0.55], [0.55, 0.9], [-0.9, 0.9], [-0.9, -0.55]],
  octagon: [[-0.4, -0.95], [0.4, -0.95], [0.95, -0.4], [0.95, 0.4], [0.4, 0.95], [-0.4, 0.95], [-0.95, 0.4], [-0.95, -0.4]],
  banner: [[-0.75, -0.95], [0.75, -0.95], [0.75, 0.95], [0, 0.55], [-0.75, 0.95]],
  crownShield: [[-0.85, -0.5], [-0.45, -0.95], [0, -0.55], [0.45, -0.95], [0.85, -0.5], [0.8, 0.2], [0, 0.95], [-0.8, 0.2]],
  wing: [[-1, -0.6], [-0.45, -0.85], [0, -0.55], [0.45, -0.85], [1, -0.6], [0.7, 0.2], [0, 0.9], [-0.7, 0.2]],
};

/** 내부 아이콘의 닫힌 윤곽. 배경 안쪽 0.55배 상자에 들어가도록 단위 상자 안에 그린다. */
export const GUILD_BADGE_ICON_POINTS: Readonly<Record<GuildBadgeIconId, readonly BadgePoint[]>> = {
  sword: [[0, -1], [0.18, -0.55], [0.18, 0.35], [0.5, 0.45], [0.5, 0.6], [0.12, 0.6], [0.12, 1], [-0.12, 1], [-0.12, 0.6], [-0.5, 0.6], [-0.5, 0.45], [-0.18, 0.35], [-0.18, -0.55]],
  star: [[0, -1], [0.26, -0.33], [0.95, -0.31], [0.42, 0.14], [0.59, 0.81], [0, 0.43], [-0.59, 0.81], [-0.42, 0.14], [-0.95, -0.31], [-0.26, -0.33]],
  crown: [[-1, 0.7], [-1, -0.6], [-0.5, -0.1], [0, -0.85], [0.5, -0.1], [1, -0.6], [1, 0.7]],
  heart: [[0, 0.9], [-0.9, -0.05], [-0.9, -0.45], [-0.55, -0.8], [-0.2, -0.8], [0, -0.5], [0.2, -0.8], [0.55, -0.8], [0.9, -0.45], [0.9, -0.05]],
  bolt: [[0.3, -1], [-0.6, 0.15], [-0.05, 0.15], [-0.3, 1], [0.65, -0.2], [0.1, -0.2]],
  flame: [[0, -1], [0.55, -0.2], [0.7, 0.35], [0.4, 0.85], [0, 1], [-0.4, 0.85], [-0.7, 0.35], [-0.45, -0.05], [-0.2, 0.2], [-0.1, -0.35]],
  drop: [[0, -1], [0.55, -0.1], [0.7, 0.35], [0.4, 0.8], [0, 0.95], [-0.4, 0.8], [-0.7, 0.35], [-0.55, -0.1]],
  leaf: [[0.9, -0.9], [0.9, 0.1], [0.4, 0.75], [-0.2, 0.75], [-0.9, 0.9], [-0.7, 0.2], [-0.55, -0.4], [-0.1, -0.8]],
  mountain: [[-1, 0.8], [-0.35, -0.35], [-0.1, 0], [0.35, -0.9], [1, 0.8]],
  cheesecake: [[-1, 0.7], [-1, -0.1], [1, -0.7], [1, 0.7]],
  moon: [[0.3, -1], [-0.3, -0.9], [-0.8, -0.4], [-0.8, 0.4], [-0.3, 0.9], [0.3, 1], [-0.1, 0.6], [-0.2, 0], [-0.1, -0.6]],
  bone: [[-0.9, -0.55], [-0.55, -0.8], [-0.25, -0.45], [0.25, -0.45], [0.55, -0.8], [0.9, -0.55], [0.65, -0.1], [0.65, 0.1], [0.9, 0.55], [0.55, 0.8], [0.25, 0.45], [-0.25, 0.45], [-0.55, 0.8], [-0.9, 0.55], [-0.65, 0.1], [-0.65, -0.1]],
};

export const DEFAULT_GUILD_BADGE: GuildBadge = { shape: "shield", shapeColor: "blue", icon: "star", iconColor: "silver" };

const has = (list: readonly string[], value: unknown): boolean => typeof value === "string" && list.includes(value);

/** 표에 있는 값이고 배경색과 내부색이 다를 때만 통과한다. 서버와 화면이 같은 함수를 읽는다. */
export function isGuildBadge(value: unknown): value is GuildBadge {
  if (!value || typeof value !== "object") return false;
  const badge = value as Record<string, unknown>;
  return has(GUILD_BADGE_SHAPES, badge.shape) && has(GUILD_BADGE_ICONS, badge.icon)
    && has(GUILD_BADGE_COLOR_IDS, badge.shapeColor) && has(GUILD_BADGE_COLOR_IDS, badge.iconColor)
    && badge.shapeColor !== badge.iconColor;
}

/** 저장에서 읽은 임의의 값을 뱃지로 되돌린다. 틀린 값은 기본 뱃지로 수렴한다. */
export function normalizeGuildBadge(value: unknown): GuildBadge {
  return isGuildBadge(value) ? { shape: value.shape, shapeColor: value.shapeColor, icon: value.icon, iconColor: value.iconColor } : { ...DEFAULT_GUILD_BADGE };
}

/** 같은 뱃지인가. 변경 비용 판정에 쓴다. */
export const sameGuildBadge = (a: GuildBadge, b: GuildBadge): boolean =>
  a.shape === b.shape && a.shapeColor === b.shapeColor && a.icon === b.icon && a.iconColor === b.iconColor;
