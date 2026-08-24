import type { HeartGemRarity } from "../data/heartGems";
import Phaser from "phaser";
import type { RunePart } from "../core/runes";
import { chipPoints, drawInnerVignette, drawShapeOutline } from "./holo";
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
 * 목록에서 쓰는 룬 아이콘이다.
 *
 * 룬 하나는 하트 한 장이 아니라 **자기 조각 하나**다. 어느 칸에 들어가는 룬인지가 생김새로
 * 먼저 읽혀야 하기 때문이다. 세 칸을 다 채우면 세 조각이 같은 중심에서 만나 하트 한 장이
 * 된다 — 조각들은 굽기 단계에서 같은 중심을 공유한다.
 */
export function addRuneIcon(scene: Phaser.Scene, x: number, y: number, size: number, rarity: HeartGemRarity, part: RunePart): Phaser.GameObjects.Container {
  const icon = scene.add.container(x, y);
  // 조각 하나만 그리므로 그림자를 함께 깔아야 액자 위에 떠 있는 것처럼 보인다.
  icon.add(scene.add.image(size * 0.04, size * 0.05, runeTexture(rarity, part)).setOrigin(0.5, RUNE_CENTER_Y).setDisplaySize(size, size).setTint(0x05070a).setAlpha(0.5));
  icon.add(scene.add.image(0, 0, runeTexture(rarity, part)).setOrigin(0.5, RUNE_CENTER_Y).setDisplaySize(size, size));
  return icon;
}

/**
 * 액자에 담긴 룬 한 칸.
 *
 * 조각 하나만 덩그러니 놓으면 어디까지가 그림인지 알 수 없어 바탕 원화 위에서 떠 보였다.
 * 그림 한 장을 담는 칸이라 화면의 **액자 예외**를 그대로 쓴다 — 불투명하게 채우고 사방을
 * 두른 뒤 테두리 안쪽만 눌러, 조각이 그 안에서 한 뼘 떠 있게 한다. 판때기가 아니라 액자다.
 */
export function addRuneFrame(
  scene: Phaser.Scene,
  x: number,
  y: number,
  size: number,
  rarity: HeartGemRarity | undefined,
  part: RunePart,
): Phaser.GameObjects.Container {
  const accent = rarity ? RUNE_ACCENT[rarity] : 0x5a636e;
  const frame = scene.add.container(x, y);
  const shape = chipPoints(size, size, { bevel: { topLeft: size * 0.2, topRight: 0, bottomRight: size * 0.2, bottomLeft: 0 } });
  const plate = scene.add.graphics();
  plate.fillStyle(0x000000, 0.5);
  plate.translateCanvas(4, 6);
  plate.fillPoints(toGeomPoints(shape), true);
  plate.translateCanvas(-4, -6);
  plate.fillStyle(rarity ? 0x0d131b : 0x0a0d12, 1);
  plate.fillPoints(toGeomPoints(shape), true);
  frame.add(plate);
  frame.add(drawInnerVignette(scene, 0, 0, shape, { strength: 0.55 }));
  frame.add(drawShapeOutline(scene, 0, 0, shape, { color: accent, alpha: rarity ? 0.9 : 0.35, width: 3 }));
  // 조각은 액자를 가득 채운다. 조각 원화에 이미 여백이 있어, 여기서 더 줄이면 그림이 칸
  // 한가운데에 작게 떠 액자만 커 보인다.
  frame.add(rarity
    ? addRuneIcon(scene, 0, 0, size * 0.98, rarity, part)
    : scene.add.image(0, 0, runeTexture(undefined, part)).setOrigin(0.5, RUNE_CENTER_Y).setDisplaySize(size * 0.98, size * 0.98).setAlpha(0.5));
  return frame;
}

/** 평평한 좌표 배열을 Phaser가 받는 점 목록으로 바꾼다. */
function toGeomPoints(flat: number[]): Phaser.Geom.Point[] {
  const points: Phaser.Geom.Point[] = [];
  for (let i = 0; i < flat.length; i += 2) points.push(new Phaser.Geom.Point(flat[i], flat[i + 1]));
  return points;
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
  parent.add(scene.add.star(x, y, 4, outer * 0.34, outer, 0x000000, 0.22).setStrokeStyle(2, 0x8a929c, 0.3));
}

/**
 * 세공 결과 표식 하나.
 *
 * 세공 칸은 십자로 뻗는 다이아(꼭짓점 넷)다 — 성급 별과 한 화면에서 섞이지 않게 모양을 가른다.
 * 각인만 별(꼭짓점 다섯)로 남겨, 한 룬에 한 번뿐인 결과가 다른 종류로 읽히게 한다.
 */
export function addRuneMark(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  x: number,
  y: number,
  outer: number,
  kind: "success" | "fail" | "engrave",
): void {
  addGlowStar(scene, parent, x, y, outer, RUNE_MARK[kind], kind === "engrave" ? 5 : 4);
}

/**
 * 성공과 실패를 한 줄로 나눠 가지는 발광 막대.
 *
 * 양 끝은 화면의 다른 면과 같은 결로 **어긋나게** 깎는다(왼쪽은 위, 오른쪽은 아래). 가운데는
 * 수직 눈금이 아니라 비스듬한 `/`로 가른다 — 두 값이 맞물려 하나를 이룬다는 것이 선 모양에서
 * 먼저 읽히고, 시도할 때마다 그 빗금이 좌우로 미끄러진다.
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
  const height = 16;
  const bevel = height * 0.9;
  // 빗금의 기울기. 조각 둘 사이에 이만큼의 틈을 두어 `/` 한 줄이 살아 있게 한다.
  const slant = height * 0.72;
  const gap = 5;
  const left = x - width / 2;
  const right = x + width / 2;
  const split = left + width * clamped;
  const topY = y - height / 2;
  const bottomY = y + height / 2;
  const success = [
    left + bevel, topY,
    split + slant / 2 - gap / 2, topY,
    split - slant / 2 - gap / 2, bottomY,
    left, bottomY,
  ];
  const fail = [
    split + slant / 2 + gap / 2, topY,
    right, topY,
    right - bevel, bottomY,
    split - slant / 2 + gap / 2, bottomY,
  ];
  const toPolygon = (flat: number[]): Phaser.Geom.Point[] => {
    const points: Phaser.Geom.Point[] = [];
    for (let i = 0; i < flat.length; i += 2) points.push(new Phaser.Geom.Point(flat[i], flat[i + 1]));
    return points;
  };
  const graphics = scene.add.graphics();
  // 같은 조각을 조금 키워 옅게 한 겹 더 깔면 막대 자체가 빛나 보인다.
  const glow = (flat: number[], color: number): void => {
    const points = toPolygon(flat).map((point) => new Phaser.Geom.Point(point.x, y + (point.y - y) * 1.9));
    graphics.fillStyle(color, 0.16);
    graphics.fillPoints(points, true);
  };
  glow(success, RUNE_MARK.success.halo);
  glow(fail, RUNE_MARK.fail.halo);
  graphics.fillStyle(RUNE_MARK.success.body, 1);
  graphics.fillPoints(toPolygon(success), true);
  graphics.fillStyle(RUNE_MARK.fail.body, 1);
  graphics.fillPoints(toPolygon(fail), true);
  // 가르는 빗금 한 줄. 어디까지가 성공인지 숫자를 읽기 전에 보인다.
  graphics.lineStyle(3, 0xffffff, 0.9);
  graphics.lineBetween(split - slant / 2, bottomY + 3, split + slant / 2, topY - 3);
  parent.add(graphics);
}
