import type { HeartGemRarity } from "../data/heartGems";
import Phaser from "phaser";

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

/**
 * 목록에서 쓰는 완성 룬 아이콘이다.
 *
 * 세 자산은 굽기 단계에서 같은 중심을 공유하므로 여기서도 정확히 같은 좌표에 포갠다. 가방과
 * 정보창이 별도 합성 이미지를 만들지 않고 이 컨테이너 하나를 공유하도록 공개 함수로 둔다.
 */
export function addRuneIcon(scene: Phaser.Scene, x: number, y: number, size: number, rarity: HeartGemRarity): Phaser.GameObjects.Container {
  const icon = scene.add.container(x, y);
  for (let index = 0; index < 3; index += 1) {
    icon.add(scene.add.image(0, 0, runeTexture(rarity, index)).setOrigin(0.5, RUNE_CENTER_Y).setDisplaySize(size, size));
  }
  return icon;
}

export const RUNE_ICON_ASSETS: ReadonlyArray<readonly [string, string]> = [
  ...RARITIES.flatMap((rarity) => [0, 1, 2].map((index) => [`rune-${rarity}-${index}`, `/sprites/runes/${rarity}-${index}.webp`] as const)),
  ...[0, 1, 2].map((index) => [`rune-empty-${index}`, `/sprites/runes/empty-${index}.webp`] as const),
];
