import Phaser from "phaser";
import { slantedRect, toPoints } from "./holo";

/**
 * 급여 버튼의 생김새 — **치즈케이크 한 조각**이다.
 *
 * 어두운 유리 판에 노란 테만 두르던 때는 정보창의 다른 판과 같은 무게라, 가장 자주 누르는 버튼이
 * 화면에 녹아 있었다. 크림빛 면(치즈) 아래로 구운 껍질 띠(크러스트)가 깔리고, 판 밑으로 같은 모양의
 * 짙은 두께가 한 뼘 내려가 **눌러지는 덩어리**로 읽힌다. 실루엣은 화면 전체의 문법(기울인 판)을
 * 그대로 쓰고, 광택 그라데이션 없이 단색 면과 윗변의 얇은 반짝임 한 줄로만 만든다. 반짝이는 조각은
 * 동그라미가 아니라 어긋나게 깎은 마름모다.
 */
export const FEED_BUTTON = {
  /** 치즈 면. */
  cream: 0xfff1c9,
  /** 면을 두르는 버터빛 테 — 켜진 판의 제 색. */
  rim: 0xffc94a,
  /** 아래 띠 — 구운 껍질. */
  crust: 0xd08a3a,
  /** 껍질의 짙은 결(위쪽 경계선). */
  crustLine: 0x8f5420,
  /** 판 밑의 두께 — 눌러지는 덩어리로 읽힌다. */
  base: 0x7a4716,
  /** 꺼진 판. 크림을 잿빛으로 누른다. */
  offFace: 0x4a4132,
  offRim: 0x6b5d45,
  /** 글자와 값줄 — 밝은 크림 위라 검정보다 부드러운 짙은 갈색. */
  ink: "#5a3410",
  /** 값줄 판(크림 면에 박힌 창). */
  window: 0x5a3410,
  rimWidth: 6,
  depth: 9,
  /** 아래 껍질 띠가 판 높이에서 차지하는 몫. */
  crustRatio: 0.18,
  slant: 16,
  sparkle: 0xffffff,
} as const;

export interface FeedPlate {
  /**
   * 켜진 판(면 + 두께 + 반짝이). Graphics 한 장이다 — 컨테이너로 감싸면 부모 버튼의 `getBounds`가
   * 그 빈 컨테이너의 자리까지 끌어들여 버튼 자리를 엉뚱하게 잰다.
   */
  readonly on: Phaser.GameObjects.Graphics;
  /** 꺼진 판. 켜진 판 아래에 깔린다. */
  readonly off: Phaser.GameObjects.Graphics;
}

/** 치즈케이크 판 한 장. 가운데를 (0, 0)으로 그린다. */
export function drawFeedPlate(scene: Phaser.Scene, width: number, height: number, slant: number = FEED_BUTTON.slant): FeedPlate {
  const spec = FEED_BUTTON;
  const shape = slantedRect(width, height, slant);
  const inner = slantedRect(width - spec.rimWidth * 2, height - spec.rimWidth * 2, slant * 0.8);

  const off = scene.add.graphics();
  off.fillStyle(0x000000, 0.3).fillPoints(toPoints(offset(shape, 4, spec.depth + 4)), true);
  off.fillStyle(spec.offRim, 0.9).fillPoints(toPoints(shape), true);
  off.fillStyle(spec.offFace, 0.95).fillPoints(toPoints(inner), true);

  const g = scene.add.graphics();
  // 두께 — 같은 판을 아래로 민 짙은 덩어리, 그 아래 옅은 그림자.
  g.fillStyle(0x000000, 0.32).fillPoints(toPoints(offset(shape, 6, spec.depth + 6)), true);
  g.fillStyle(spec.base, 1).fillPoints(toPoints(offset(shape, 0, spec.depth)), true);
  // 버터빛 테와 크림 면.
  g.fillStyle(spec.rim, 1).fillPoints(toPoints(shape), true);
  g.fillStyle(spec.cream, 1).fillPoints(toPoints(inner), true);
  // 아래 껍질 띠 — 면의 아랫부분을 같은 기울기로 잘라 칠한다.
  const crust = crustBand(inner, spec.crustRatio);
  g.fillStyle(spec.crust, 1).fillPoints(toPoints(crust), true);
  g.lineStyle(3, spec.crustLine, 0.9).beginPath();
  g.moveTo(crust[0], crust[1]).lineTo(crust[2], crust[3]).strokePath();
  // 윗변의 반짝임 한 줄.
  const hw = width / 2 - spec.rimWidth;
  const top = -height / 2 + spec.rimWidth + 6;
  g.fillStyle(spec.sparkle, 0.7).fillRect(-hw * 0.62, top, hw * 1.1, 5);
  // 양 위 모서리의 작은 반짝이 — 어긋나게 깎은 마름모.
  g.fillStyle(spec.rim, 1);
  for (const [sx, sy, size] of [[-hw + 22, -height / 2 + 24, 9], [hw - 30, -height / 2 + 20, 7]] as const) {
    g.fillPoints(toPoints([sx, sy - size, sx + size * 0.8, sy - 1, sx, sy + size * 0.9, sx - size * 0.7, sy + 1]), true);
  }
  return { on: g, off };
}

/** 값줄을 담는 창 — 크림 면에 박힌 짙은 갈색 판. 밝은 값 글자가 그 위에서 또렷하다. */
export function drawFeedWindow(scene: Phaser.Scene, width: number, height: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  const shape = slantedRect(width, height, 8);
  g.fillStyle(FEED_BUTTON.window, 0.92).fillPoints(toPoints(shape), true);
  g.fillStyle(0xffffff, 0.12).fillRect(-width / 2 + 10, -height / 2 + 3, width - 24, 3);
  return g;
}

function offset(flat: readonly number[], dx: number, dy: number): number[] {
  return flat.map((value, index) => value + (index % 2 === 0 ? dx : dy));
}

/**
 * 판 아래쪽 `ratio`만큼의 띠. 판이 기울어 있으므로 좌우 변을 따라 같은 기울기로 자른다.
 * `slantedRect`의 점 차례는 왼위 · 오위 · 오아래 · 왼아래다.
 */
export function crustBand(shape: readonly number[], ratio: number): number[] {
  const [lx0, y0, rx0, , rx1, y1, lx1] = shape;
  const t = 1 - ratio;
  const lerp = (a: number, b: number): number => a + (b - a) * t;
  const cut = y0 + (y1 - y0) * t;
  // 왼쪽 변은 왼위 → 왼아래, 오른쪽 변은 오위 → 오아래다.
  return [lerp(lx0, lx1), cut, lerp(rx0, rx1), cut, rx1, y1, lx1, y1];
}
