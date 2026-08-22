import type { HeartGemRarity } from "../data/heartGems";

/**
 * 룬 하트 조각.
 *
 * `scripts/prepare_icons.py`가 하트 원화 한 장을 세 조각으로 오려 등급별로 다시 칠한 WebP다.
 * 세 조각을 같은 자리에 겹치면 원래 하트 한 장으로 되돌아간다 — 굽는 쪽에서 항상 같은
 * 중심점을 기준으로 잘랐기 때문이다. `emptyRuneTexture`/`runeTexture`는 그 파일 이름만
 * 조립하고, 실제로 어떤 각도로 잘렸는지는 화면이 알 필요가 없다.
 */
const RARITIES: readonly HeartGemRarity[] = ["uncommon", "rare", "epic", "legendary"];

/** 조각을 잘라 붙이는 기준점(캔버스 세로 비율). `prepare_icons.py`의 `RUNE_CENTER_Y`와 같다. */
export const RUNE_CENTER_Y = 0.44;

/** 조각을 굽는 원본 캔버스 한 변(px). */
export const RUNE_BAKE_SIZE = 256;

/** 룬 등급 색. 초록 고급 → 파랑 희귀 → 보라 영웅 → 빨강 전설 순으로 오른다. */
export const RUNE_ACCENT: Record<HeartGemRarity, number> = {
  uncommon: 0x3fbb56,
  rare: 0x3d90e2,
  epic: 0xa24ee0,
  legendary: 0xe0343c,
};

export function runeTexture(rarity: HeartGemRarity | undefined, index: number): string {
  return rarity ? `rune-${rarity}-${index}` : `rune-empty-${index}`;
}

export const RUNE_ICON_ASSETS: ReadonlyArray<readonly [string, string]> = [
  ...RARITIES.flatMap((rarity) => [0, 1, 2].map((index) => [`rune-${rarity}-${index}`, `/sprites/runes/${rarity}-${index}.webp`] as const)),
  ...[0, 1, 2].map((index) => [`rune-empty-${index}`, `/sprites/runes/empty-${index}.webp`] as const),
];
