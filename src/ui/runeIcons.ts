import type { HeartGemRarity } from "../data/heartGems";
import Phaser from "phaser";
import { addGlowStar, type StarTones } from "./stars";

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

/**
 * 세공 결과 표식의 색.
 *
 * 성공은 푸른 별로 박히고, 실패는 다크체리로 가라앉는다 — 실패도 "아무 일 없음"이 아니라
 * 한 번 새겨진 자국이라 자리를 지킨다. 각인은 맨 뒤에 노란 별 하나로 크게 박힌다.
 * 모양과 겹은 성급 별과 같은 `stars.ts` 규칙을 그대로 쓴다.
 */
export const RUNE_MARK: Readonly<Record<"success" | "fail" | "engrave", StarTones>> = {
  success: { shadow: 0x04121e, halo: 0x7fd8ff, glow: 0xbdeaff, body: 0x3aa8ff },
  // 다크체리는 빛무리를 줄여 옆의 성공 별보다 뒤로 물러난다.
  fail: { shadow: 0x14040a, halo: 0x8e2038, glow: 0xb03a52, body: 0x6e1526, bloom: 0.45 },
  engrave: { shadow: 0x1a1200, halo: 0xffd166, glow: 0xffe9a8, body: 0xffc233 },
};

/** 아직 시도하지 않은 칸. 자리는 지키되 눈에 먼저 들어오지 않게 옅은 테두리만 남긴다. */
export function addEmptyRuneMark(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, x: number, y: number, outer: number): void {
  parent.add(scene.add.star(x, y, 5, outer * 0.42, outer, 0x000000, 0.22).setStrokeStyle(2, 0x8a929c, 0.3));
}

/** 세공 결과 별 하나. 성공·실패·각인이 같은 모양을 쓰고 색과 크기만 다르다. */
export function addRuneMark(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  x: number,
  y: number,
  outer: number,
  kind: "success" | "fail" | "engrave",
): void {
  addGlowStar(scene, parent, x, y, outer, RUNE_MARK[kind]);
}

/**
 * 성공과 실패를 한 줄로 보여 주는 발광 선.
 *
 * 막대 두 개를 나란히 두지 않고 **한 줄을 갈라** 쓴다 — 성공과 실패는 늘 합쳐서 하나이므로,
 * 한 줄이 좌우로 밀리는 모습이 곧 확률의 변화다. 채움 위에 같은 색을 크게 한 겹 더 깔아
 * 선 자체가 빛나는 것처럼 보이게 한다.
 */
export function addChanceLine(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  x: number,
  y: number,
  width: number,
  chance: number,
): void {
  const clamped = Math.max(0, Math.min(1, chance));
  const height = 10;
  const split = width * clamped;
  const left = x - width / 2;
  const glow = scene.add.graphics();
  // 발광은 본체보다 두껍고 옅게 깔아 선 주위로 번지게 한다.
  glow.fillStyle(RUNE_MARK.success.halo, 0.22);
  glow.fillRect(left, y - height, split, height * 2);
  glow.fillStyle(RUNE_MARK.fail.halo, 0.16);
  glow.fillRect(left + split, y - height, width - split, height * 2);
  const bar = scene.add.graphics();
  bar.fillStyle(RUNE_MARK.success.body, 1);
  bar.fillRect(left, y - height / 2, split, height);
  bar.fillStyle(RUNE_MARK.fail.body, 1);
  bar.fillRect(left + split, y - height / 2, width - split, height);
  // 가르는 지점에 밝은 눈금 하나. 어디까지가 성공인지 숫자를 읽기 전에 보인다.
  bar.fillStyle(0xffffff, 0.85);
  bar.fillRect(left + split - 1.5, y - height, 3, height * 2);
  parent.add([glow, bar]);
}
