/**
 * 게이지 채움 안에 깔리는 안개 결의 순수 계산이다.
 *
 * 고고학 탐사 판의 안개(`strataFog.ts`)와 같은 문법을 게이지 한 줄의 크기로 옮긴 것이다 —
 * 경계를 사인으로 비튼 얼룩진 덩어리가 채움을 덮고, 덩어리와 빈 곳의 **한가운데에 밝은 경계선**이
 * 서며, 두 겹이 서로 다른 결을 그려 진하기만 엇갈리면 살아 움직이는 것처럼 읽힌다.
 *
 * 예전에는 흰 사다리꼴 띠 하나가 채움 위를 미끄러졌다. 가장자리가 칼같이 끊긴 네모라 일렁임이
 * 아니라 「네모가 지나간다」로 읽혔다.
 *
 * Phaser를 읽지 않는다. 같은 입력이 늘 같은 픽셀을 내고, 화면은 그것을 캔버스에 굽기만 한다.
 */

export interface GaugeFogInput {
  /** 구울 캔버스의 픽셀 크기. */
  width: number;
  height: number;
  /** 그 줄의 채움 색. 안개는 이 색을 흰빛 쪽으로 들어 올린 톤이다. */
  color: number;
  /** 결을 가르는 번호. 두 겹이 서로 다른 값을 받아 다른 경계를 그린다. */
  variant: number;
  /** 줄마다 결을 어긋나게 하는 값. 같은 화면의 여러 줄이 같은 무늬로 서지 않게 한다. */
  seed?: number;
}

/** 안개가 가장 짙을 때의 진하기. 겹쳐 밝아지는 합성이라 눈금·수치보다 먼저 읽히지 않게 옅게 둔다. */
export const GAUGE_FOG_ALPHA = 0.26;
/** 경계선이 흰빛 쪽으로 들어 올리는 몫. */
const EDGE_LIFT = 0.5;
/** 덩어리 안쪽이 흰빛 쪽으로 들어 올리는 몫. 채움 색과 같으면 더해도 보이지 않는다. */
const BODY_LIFT = 0.12;

/** 0~1 사이의 얼룩 밭. 좌표를 게이지 높이 단위로 재서 덩어리가 줄 굵기에 맞는 크기로 선다. */
export function gaugeFogField(x: number, y: number, height: number, variant: number, seed = 0): number {
  const u = x / Math.max(1, height);
  const v = y / Math.max(1, height);
  const phase = variant * 2.17 + seed * 1.31;
  // 가로로 긴 줄이라 가로 주파수를 낮게 잡는다 — 덩어리가 줄을 따라 길게 흐른다.
  const warpX = u + Math.sin(v * 3.1 + phase) * 0.45;
  const warpY = v + Math.cos(u * 0.9 + phase * 1.4) * 0.35;
  const a = Math.sin(warpX * 1.05 + phase) * Math.cos(warpY * 2.4 - phase * 0.7);
  const b = Math.sin(warpX * 2.3 - warpY * 1.6 + phase * 1.9) * 0.5;
  return Math.min(1, Math.max(0, 0.5 + (a + b) * 0.42));
}

/** 캔버스 `ImageData`(비-프리멀티플라이)에 그대로 넣는 RGBA 한 장. */
export function gaugeFogPixels(input: GaugeFogInput): Uint8ClampedArray {
  const width = Math.max(1, Math.round(input.width));
  const height = Math.max(1, Math.round(input.height));
  const out = new Uint8ClampedArray(width * height * 4);
  const r = (input.color >> 16) & 255; const g = (input.color >> 8) & 255; const b = input.color & 255;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const f = gaugeFogField(x, y, height, input.variant, input.seed);
      // 덩어리: 0.42 아래는 비우고 0.78에서 가득 — 빈 곳이 남아야 덩어리가 덩어리로 읽힌다.
      const body = Math.min(1, Math.max(0, (f - 0.42) / 0.36));
      // 경계선: 덩어리 가장자리(0.5 언저리)에서 봉우리. 탐사 판 안개와 같은 방법이다.
      const edge = Math.max(0, 1 - Math.abs(f - 0.5) * 7);
      const alpha = Math.min(1, body * body * (3 - 2 * body) + edge * 0.7) * GAUGE_FOG_ALPHA;
      if (alpha <= 0) continue;
      const lift = Math.min(1, BODY_LIFT + edge * EDGE_LIFT);
      const at = (y * width + x) * 4;
      out[at] = r + (255 - r) * lift;
      out[at + 1] = g + (255 - g) * lift;
      out[at + 2] = b + (255 - b) * lift;
      out[at + 3] = alpha * 255;
    }
  }
  return out;
}

/**
 * 훑는 빛띠의 진하기(0~1). 띠 가운데에서 가장 밝고 양 끝으로 부드럽게 녹는다.
 *
 * `offset`은 띠 가운데에서 잰 거리를 띠 반폭으로 나눈 값이다. 끝이 끊긴 네모가 아니라 녹는
 * 가장자리여야 빛이 지나간 것으로 읽힌다.
 */
export function gaugeSweepAlpha(offset: number): number {
  const t = Math.min(1, Math.abs(offset));
  return (1 + Math.cos(Math.PI * t)) / 2;
}
