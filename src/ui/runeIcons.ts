import type { HeartGemRarity } from "../data/heartGems";
import Phaser from "phaser";
import type { RuneInstance, RuneMainStatKey, RunePart } from "../core/runes";
import { drawGlyph } from "./glyphs";
import { chipPoints, drawInnerVignette, drawLayer, drawShapeInnerGlow, drawShapeOutline } from "./holo";
import { clipShapeByDiagonal, runeBackdropBands, scaleShape, type RuneBackdropSide } from "./runeBackdrop";
import { runePieceFit } from "./runePieceContent";
import { STAT_TONE } from "./statTones";
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
  uncommon: 0x4fd66a,
  rare: 0x5fd4ff,
  epic: 0xe070f5,
  legendary: 0xff4a54,
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
 * 액자 한 칸 안에 서는 조각 하나.
 *
 * 하트를 이루는 자리(정보창의 젬 슬롯)와 달리, 액자에는 조각 하나만 서므로 캔버스가 아니라
 * **보이는 그림**을 칸 한가운데에 맞춘다(`runePieceFit`) — 그러지 않으면 1번은 왼쪽 위,
 * 2번은 오른쪽 위, 3번은 아래로 쏠려 앉고 그만큼 작게 보인다.
 */
function addFittedRuneIcon(scene: Phaser.Scene, frameSize: number, rarity: HeartGemRarity | undefined, part: RunePart): Phaser.GameObjects.Container {
  const fit = runePieceFit(part, frameSize, RUNE_FRAME_FILL);
  const icon = scene.add.container(0, 0);
  const place = (image: Phaser.GameObjects.Image, dx: number, dy: number): Phaser.GameObjects.Image =>
    image.setOrigin(0.5, RUNE_CENTER_Y).setDisplaySize(fit.size, fit.size).setPosition(fit.x + dx, fit.y + dy);
  // 그림자 거리는 캔버스가 아니라 **보이는 그림**을 따라간다. 캔버스를 따르면 조각마다 여백이
  // 달라 그림자만 저 혼자 멀리 떨어진다.
  const offset = fit.content * 0.045;
  if (rarity) {
    icon.add(place(scene.add.image(0, 0, runeTexture(rarity, part)), offset, offset * 1.2).setTint(0x05070a).setAlpha(0.5));
    icon.add(place(scene.add.image(0, 0, runeTexture(rarity, part)), 0, 0));
  } else {
    icon.add(place(scene.add.image(0, 0, runeTexture(undefined, part)), 0, 0).setAlpha(0.5));
  }
  return icon;
}

/**
 * 액자 한 변 대비 조각이 차지하는 비율.
 *
 * 잘린 모서리와 안쪽 비네트에 그림이 닿지 않는 선에서 최대한 크게 잡는다. 1에 가까우면
 * 조각의 뾰족한 끝이 액자 선을 넘고, 작으면 그림이 큰 칸 한가운데에 떠 액자만 커 보인다.
 */
const RUNE_FRAME_FILL = 0.6;

/** 각인까지 마친 룬이 두르는 금빛. 완성된 보석 하나뿐인 색이라 다른 표식과 섞지 않는다. */
export const RUNE_ENGRAVE_GOLD = 0xffc861;

/** 액자 한 칸이 받는 선택 값들. 자리(part)와 등급처럼 반드시 있어야 하는 것만 인자로 둔다. */
export interface RuneFrameOptions {
  /** 위/아래 대각 면 색을 정하는 두 주 옵션. 빈 자리에는 없다. */
  mainStats?: readonly [{ key: RuneMainStatKey }, { key: RuneMainStatKey }];
  /** 각인까지 마친 룬. 액자 안쪽에 금빛 발광이 돈다. */
  engraved?: boolean;
}

/**
 * 액자에 담긴 룬 한 칸.
 *
 * 조각 하나만 덩그러니 놓으면 어디까지가 그림인지 알 수 없어 바탕 원화 위에서 떠 보였다.
 * 그림 한 장을 담는 칸이라 화면의 **액자 예외**를 그대로 쓴다 — 불투명하게 채우고 사방을
 * 두른 뒤 테두리 안쪽만 눌러, 조각이 그 안에서 한 뼘 떠 있게 한다. 판때기가 아니라 액자다.
 *
 * 뒷배경은 두 주 옵션의 **실제 능력치 색**(`STAT_TONE`)이고, 평평한 색면이 아니라 가운데로
 * 갈수록 밝아지는 발광이다 — 한 겹을 진하게 깔면 색이 탁하게 가라앉아 조각까지 함께 흐려진다.
 * 칠하는 도형은 액자 도형을 대각선으로 잘라 쓰므로 깎인 모서리 밖으로 새지 않는다.
 */
export function addRuneFrame(
  scene: Phaser.Scene,
  x: number,
  y: number,
  size: number,
  rarity: HeartGemRarity | undefined,
  part: RunePart,
  options: RuneFrameOptions = {},
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
  if (options.mainStats) frame.add(drawRuneBackdrop(scene, shape, size, options.mainStats));
  // 안쪽 비네트는 가장자리를 **살짝만** 눌러 준다. 깊게 누르면 뒷배경 색이 액자 안에서
  // 검게 가라앉아 두 주 옵션이 무슨 색인지 가장자리에서 읽히지 않는다.
  frame.add(drawInnerVignette(scene, 0, 0, shape, { strength: 0.3, depth: 0.2 }));
  frame.add(drawShapeOutline(scene, 0, 0, shape, { color: accent, alpha: rarity ? 0.9 : 0.35, width: 3 }));
  frame.add(addFittedRuneIcon(scene, size, rarity, part));
  // 각인 발광은 조각 **위**에 두른다. 아래에 깔면 불투명한 조각이 빛을 가려 액자 가장자리에만
  // 남고, 다 자란 보석이라기보다 테두리를 한 겹 더 두른 것처럼 보인다.
  if (options.engraved) frame.add(drawShapeInnerGlow(scene, 0, 0, shape, { color: RUNE_ENGRAVE_GOLD, strength: 0.42, depth: 0.3 }));
  return frame;
}

/**
 * 목록에 서는 룬 카드 한 장.
 *
 * 가방과 장착용 가방이 같은 한 장을 쓴다 — 화면마다 카드를 다시 만들면 한쪽만 옛 모습으로
 * 남는다. 카드에 글을 얹지 않는 이유는 룬에서 먼저 읽어야 하는 것이 등급 색·자리 조각·주
 * 옵션 색이고, 이름과 옵션 수치는 눌러서 여는 쪽지의 몫이기 때문이다.
 */
export function addRuneCard(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  rune: RuneCardModel,
  options: { dimmed?: boolean } = {},
): Phaser.GameObjects.Container {
  const engraved = rune.engravings.length > 0;
  const card = scene.add.container(x, y);
  const shape = chipPoints(width, height, { bevel: { topLeft: width * 0.19, topRight: 0, bottomRight: width * 0.19, bottomLeft: 0 } });
  card.add(drawLayer(scene, 0, 0, shape, { fill: 0x151a21, alpha: 0.96, edge: engraved ? RUNE_ENGRAVE_GOLD : RUNE_ACCENT[rune.rarity], edgeAlpha: engraved ? 0.9 : 0.35 }));
  const frameSize = Math.min(width, height) * 0.89;
  card.add(addRuneFrame(scene, 0, 0, frameSize, rune.rarity, rune.part, { mainStats: rune.mainStats, engraved }));
  // 잠금·즐겨찾기는 쪽지에서 켜지만 읽는 자리는 목록이다. 켜진 것만 액자 **안쪽** 왼쪽 위에
  // 작게 서고 꺼진 것은 자리를 비운다 — 회색 표식이 카드마다 늘어서면 액자보다 먼저 읽히고,
  // 카드 모서리에 붙이면 깎인 모서리 밖으로 반쯤 빠져나가 붙인 스티커처럼 보인다.
  const marks: number[] = [];
  if (rune.locked) marks.push(RUNE_CARD_MARK.lock);
  if (rune.bookmarked) marks.push(RUNE_CARD_MARK.bookmark);
  marks.forEach((color, index) => {
    const spot = runeMarkSpot(frameSize, index);
    card.add(drawLayer(scene, spot.x, spot.y, chipPoints(RUNE_CARD_MARK.plate, RUNE_CARD_MARK.plate, {
      bevel: { topLeft: RUNE_CARD_MARK.plate * 0.34, topRight: 0, bottomRight: RUNE_CARD_MARK.plate * 0.34, bottomLeft: 0 },
    }), { fill: 0x05070a, alpha: 0.72 }));
    card.add(drawGlyph(scene, index === 0 && rune.locked ? "lock" : "bookmark", spot.x, spot.y, RUNE_CARD_MARK.size, color));
  });
  // 이미 누군가 끼고 있는 룬은 옅어진다. 고르러 들어가는 헛걸음을 카드에서 미리 막는다.
  if (options.dimmed) card.setAlpha(0.72);
  return card;
}

/** 카드 한 장이 읽는 룬의 최소 모양. 세공 이력이나 이름까지 알 필요가 없다. */
export type RuneCardModel = Pick<RuneInstance, "rarity" | "part" | "mainStats" | "engravings" | "locked" | "bookmarked">;

/** 카드 위 표식의 크기와 색. 자물쇠가 먼저 서고 별이 그 옆에 붙는다. */
const RUNE_CARD_MARK = { size: 20, plate: 30, gap: 34, lock: 0x9fd8ff, bookmark: 0xf2c744 } as const;

/**
 * 표식 한 장이 서는 자리.
 *
 * 액자 왼쪽 위 모서리는 대각선으로 깎여 있어, 두 변에서 같은 만큼만 들어가면 표식의 모서리가
 * 그 빗변을 넘는다. 깎인 깊이의 절반에 표식 반지름을 더해 **깎임 안쪽**에서 시작한다.
 */
function runeMarkSpot(frameSize: number, index: number): { x: number; y: number } {
  const bevel = frameSize * 0.2;
  const inset = bevel / 2 + RUNE_CARD_MARK.plate / 2 + 4;
  return { x: -frameSize / 2 + inset + index * RUNE_CARD_MARK.gap, y: -frameSize / 2 + inset };
}

/**
 * 두 주 옵션이 대각선으로 나눠 가지는 발광 뒷배경.
 *
 * 같은 조각을 조금씩 줄여 겹겹이 더하면 가운데가 밝고 가장자리는 비쳐, 색이 면을 덮지 않고
 * 빛으로 남는다. 줄이는 기준이 액자 중심이고 대각선도 그 중심을 지나므로 조각이 줄어도
 * 두 색의 경계는 같은 자리에 그대로 선다.
 */
function drawRuneBackdrop(
  scene: Phaser.Scene,
  shape: number[],
  size: number,
  mainStats: readonly [{ key: RuneMainStatKey }, { key: RuneMainStatKey }],
): Phaser.GameObjects.Container {
  const backdrop = scene.add.container(0, 0);
  const sides: readonly [RuneBackdropSide, RuneMainStatKey][] = [["upper", mainStats[0].key], ["lower", mainStats[1].key]];
  // 바닥 한 겹은 **그냥 칠한다.** 겹쳐 밝아지는 합성만으로는 어두운 색(방어·저항)이 검은 판에
  // 묻혀 두 옵션이 무슨 색인지 갈리지 않는다. 이 한 겹이 색을 세우고, 그 위의 발광이 가운데를
  // 밝힌다.
  const base = scene.add.graphics();
  for (const [side, key] of sides) {
    base.fillStyle(STAT_TONE[key], RUNE_BACKDROP_BASE_ALPHA);
    base.fillPoints(toGeomPoints(clipShapeByDiagonal(shape, size, size, side)), true);
  }
  backdrop.add(base);
  const glow = scene.add.graphics();
  glow.setBlendMode(Phaser.BlendModes.ADD);
  for (const { factor, alpha } of runeBackdropBands()) {
    const band = scaleShape(shape, factor);
    for (const [side, key] of sides) {
      glow.fillStyle(STAT_TONE[key], alpha);
      glow.fillPoints(toGeomPoints(clipShapeByDiagonal(band, size, size, side)), true);
    }
  }
  backdrop.add(glow);
  return backdrop;
}

/** 바닥 한 겹의 진하기. 색을 세우되 조각을 덮지 않는 선이다. */
const RUNE_BACKDROP_BASE_ALPHA = 0.34;

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
  // 각인은 완성을 뜻하는 금빛이라 빛무리를 조금 더 넓게 잡는다 — 크기가 아니라 빛으로 구분한다.
  engrave: { shadow: 0x1a1200, halo: 0xffd166, glow: 0xffe9a8, body: 0xffc233, bloom: 1.25 },
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
  // 각인도 **같은 다이아**다. 모양까지 바꾸면 한 줄 안에서 다른 종류의 표식으로 읽히고, 크게
  // 키우면 그 칸 하나가 룬 전체보다 먼저 눈에 들어온다. 완성은 색(노란 발광)이 말한다.
  addGlowStar(scene, parent, x, y, outer, RUNE_MARK[kind], 4);
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
  // 양 끝의 깎임과 가운데 빗금은 **살짝만** 준다. 크게 깎으면 막대가 두 조각으로 부러진
  // 것처럼 보여, 두 값이 한 줄을 나눠 가진다는 것이 오히려 읽히지 않는다.
  const bevel = height * 0.5;
  /** 빗금의 기울기. 조각 둘 사이에 이만큼의 틈을 두어 `/` 한 줄이 살아 있게 한다. */
  const slant = height * 0.38;
  const gap = 3;
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
  graphics.lineStyle(2, 0xffffff, 0.75);
  graphics.lineBetween(split - slant / 2, bottomY + 2, split + slant / 2, topY - 2);
  parent.add(graphics);
}
