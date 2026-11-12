/**
 * 한 번에 급여 쪽지의 결과 자리 — Phaser 없이 읽혀 테스트가 같은 값을 잰다.
 *
 * 칸은 **1 → 5 → 10 → MAX** 차례로 두 줄에 선다(위 1·5, 아래 10·MAX). 차례가 곧 세기라, 색도 같은 차례로
 * 짙고 뜨거워진다 — 상큼한 민트 → 하늘빛 → 핫핑크 → 불꽃빛 다홍(금빛 테). 칸 사이에는 **누름 여백**
 * (`FEED_BULK_SAFE_GAP` 이상)을 두어 엄지가 옆 칸을 함께 누르지 않게 한다. 판 높이·폭은 손으로 적지 않고
 * 칸 크기와 여백에서 거꾸로 구한다.
 */
import type { FeedPlatePalette } from "./feedButtonSkin";

export type FeedBulkTier = "one" | "five" | "ten" | "max";

export interface FeedBulkTone extends FeedPlatePalette {
  /** 값줄 창의 색 — 제 색을 짙게 누른 판. */
  window: number;
  /** 이름 글자를 두르는 획(제 색의 가장 짙은 결). */
  stroke: string;
}

/** 단계마다 색 한 벌 — 1에서 MAX로 갈수록 강렬해진다. */
export const FEED_BULK_TONES: Readonly<Record<FeedBulkTier, FeedBulkTone>> = {
  one: { cream: 0x3fd98a, rim: 0xb6ffd8, crust: 0x1f9e63, crustLine: 0x0e5e3a, base: 0x0c4a2e, window: 0x0d3d27, stroke: "#0b3a24" },
  five: { cream: 0x3fb2ff, rim: 0xc2e9ff, crust: 0x1f74d1, crustLine: 0x0f3f80, base: 0x0d3266, window: 0x0b2a55, stroke: "#0a2850" },
  ten: { cream: 0xff4fa8, rim: 0xffc6e4, crust: 0xc81f7a, crustLine: 0x7a0c48, base: 0x5e0937, window: 0x4d0830, stroke: "#4a072c" },
  max: { cream: 0xff5626, rim: 0xffd34d, crust: 0xc4210e, crustLine: 0x7a1205, base: 0x5c0d04, window: 0x4a0a03, stroke: "#470902" },
};

/** 엄지가 옆 칸을 함께 누르지 않을 최소 여백(px). */
export const FEED_BULK_SAFE_GAP = 56;

const BUTTON = { width: 248, height: 140 } as const;
const GAP = { x: 72, y: 64 } as const;
const PAD = { x: 52, top: 64, bottom: 60 } as const;

/** 판 — 몸판은 사탕빛 자두색, 강조선은 분홍이다. */
export const FEED_BULK_PANEL = {
  fill: 0x2a1330,
  accent: 0xff9ad5,
  width: BUTTON.width * 2 + GAP.x + PAD.x * 2,
  height: BUTTON.height * 2 + GAP.y + PAD.top + PAD.bottom,
  button: BUTTON,
  /** 이름 줄과 값줄의 칸 안 높이. */
  labelY: -40,
  priceY: 16,
  priceWidth: 204,
} as const;

export interface FeedBulkSpot {
  tier: FeedBulkTier;
  levels: number | "max";
  x: number;
  y: number;
}

/** 네 칸의 자리 — 판 가운데가 (0, 0)이다. 위 줄 1·5, 아래 줄 10·MAX. */
export function feedBulkSpots(): FeedBulkSpot[] {
  const x = (BUTTON.width + GAP.x) / 2;
  const centerY = (PAD.top - PAD.bottom) / 2;
  const y = (BUTTON.height + GAP.y) / 2;
  return [
    { tier: "one", levels: 1, x: -x, y: centerY - y },
    { tier: "five", levels: 5, x, y: centerY - y },
    { tier: "ten", levels: 10, x: -x, y: centerY + y },
    { tier: "max", levels: "max", x, y: centerY + y },
  ];
}

/**
 * 판의 반짝이 — 칸 사이 빈 띠와 가장자리에만 흩는다(칸을 덮지 않는다). 난수 없이 정해 두어 열 때마다 같다.
 * 모양은 어긋나게 깎은 마름모(`kind: "diamond"`)와 네 갈래 별(`"star"`)뿐이다.
 */
export interface FeedBulkSparkle {
  x: number;
  y: number;
  size: number;
  color: number;
  kind: "diamond" | "star";
}

export function feedBulkSparkles(): FeedBulkSparkle[] {
  const W = FEED_BULK_PANEL.width / 2;
  const H = FEED_BULK_PANEL.height / 2;
  const centerY = (PAD.top - PAD.bottom) / 2;
  const mint = FEED_BULK_TONES.one.rim;
  const sky = FEED_BULK_TONES.five.rim;
  const pink = FEED_BULK_TONES.ten.rim;
  const gold = FEED_BULK_TONES.max.rim;
  return [
    // 네 칸이 만나는 한가운데 — 가장 큰 별.
    { x: 0, y: centerY, size: 22, color: gold, kind: "star" },
    // 칸 사이 세로 띠.
    { x: 0, y: centerY - 96, size: 9, color: pink, kind: "diamond" },
    { x: 0, y: centerY + 100, size: 10, color: mint, kind: "diamond" },
    // 칸 사이 가로 띠.
    { x: -W + 30, y: centerY, size: 9, color: sky, kind: "diamond" },
    { x: W - 30, y: centerY, size: 12, color: pink, kind: "star" },
    { x: -150, y: centerY - 2, size: 8, color: mint, kind: "diamond" },
    { x: 154, y: centerY + 2, size: 8, color: gold, kind: "diamond" },
    // 아래 가장자리.
    { x: -W + 40, y: H - 26, size: 10, color: pink, kind: "star" },
    { x: 0, y: H - 24, size: 8, color: sky, kind: "diamond" },
    { x: W - 60, y: H - 22, size: 9, color: mint, kind: "diamond" },
  ];
}

/**
 * 쪽지 가운데 — 급여 버튼 바로 아래에 뜨고, 판이 화면 밖으로 나가지 않게 좌우만 붙잡는다.
 * 정보창과 E2E가 같은 값을 읽는다.
 */
export function feedBulkNoteCenter(button: { centerX: number; bottom: number }, screenWidth: number): { x: number; y: number } {
  const margin = 24;
  const half = FEED_BULK_PANEL.width / 2;
  return {
    x: Math.min(Math.max(button.centerX, half + margin), screenWidth - half - margin),
    y: button.bottom + 126 + (FEED_BULK_PANEL.height - 220) / 2,
  };
}
