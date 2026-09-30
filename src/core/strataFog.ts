/**
 * 아직 캐지 않은 땅 위에 깔리는 안개의 순수 계산이다.
 *
 * 구역의 성질(색)을 칸마다 사각형으로 칠하면 판이 색 타일이 되어, 「저쪽 어딘가가 다르다」가
 * 아니라 「이 칸이 파랗다」로 읽힌다. 안개는 **구역 하나를 한 덩어리로** 덮고 가장자리가
 * 번져 이웃 구역과 스며든다 — 레이더에 잡힌 불특정한 영역처럼 어디까지가 그 구역인지는
 * 대략만 읽힌다.
 *
 * 여기서는 낮은 해상도의 알파 밭만 만든다. 화면이 그것을 캔버스에 구워 늘려 그린다(선형
 * 보간이 가장자리를 한 번 더 풀어 준다). Phaser를 읽지 않아 같은 입력이 늘 같은 밭을 낸다.
 */

import type { StrataZoneTone } from "../data/strataLayers";

export interface StrataFogInput {
  columns: number;
  rows: number;
  /** 칸마다의 구역 색. 판의 칸 순서(행 우선)다. */
  toneOfTile: readonly StrataZoneTone[];
  /** 이미 판 칸. 안개는 파낸 자리를 덮지 않는다. */
  revealed: readonly boolean[];
  /** 칸 하나가 밭에서 차지하는 픽셀 수다. */
  resolution: number;
  /**
   * 경계를 일렁이게 비트는 정도. 두 겹의 안개가 서로 다른 값을 받아 겹치면 경계가 살아 움직이는
   * 것처럼 읽힌다. 0이면 칸 경계 그대로다.
   */
  warp?: { amplitude: number; frequency: number; phase: number };
}

export interface StrataFog {
  width: number;
  height: number;
  /** 색마다의 알파 밭(0~1). 흙빛은 칠하지 않으므로 넣지 않는다. */
  fields: Partial<Record<StrataZoneTone, Float32Array>>;
}

/** 안개가 번지는 폭(칸 대비). 클수록 이웃 구역과 더 넓게 스며든다. */
const FOG_SPREAD_CELLS = 0.55;
const FOG_BLUR_PASSES = 3;

/** 양 끝을 늘려 붙이는 상자 흐림 한 방향이다. 끝에서 옅어지지 않아 판 가장자리까지 안개가 찬다. */
function boxBlur(source: Float32Array, width: number, height: number, radius: number, horizontal: boolean): Float32Array {
  const out = new Float32Array(source.length);
  const span = radius * 2 + 1;
  const lineCount = horizontal ? height : width;
  const lineLength = horizontal ? width : height;
  for (let line = 0; line < lineCount; line += 1) {
    const at = (position: number): number => {
      const clamped = Math.min(lineLength - 1, Math.max(0, position));
      return horizontal ? line * width + clamped : clamped * width + line;
    };
    let sum = 0;
    for (let offset = -radius; offset <= radius; offset += 1) sum += source[at(offset)];
    for (let position = 0; position < lineLength; position += 1) {
      out[at(position)] = sum / span;
      sum += source[at(position + radius + 1)] - source[at(position - radius)];
    }
  }
  return out;
}

/** 안개 밭을 만든다. */
export function strataFogFields(input: StrataFogInput): StrataFog {
  const { columns, rows, toneOfTile, revealed, resolution } = input;
  const width = Math.max(1, columns * resolution);
  const height = Math.max(1, rows * resolution);
  const warp = input.warp ?? { amplitude: 0, frequency: 1, phase: 0 };
  const radius = Math.max(1, Math.round(resolution * FOG_SPREAD_CELLS));
  const tones = new Set<StrataZoneTone>();
  toneOfTile.forEach((tone, index) => { if (tone !== "soil" && !revealed[index]) tones.add(tone); });
  const fields: Partial<Record<StrataZoneTone, Float32Array>> = {};
  for (const tone of tones) {
    let field: Float32Array = new Float32Array(width * height);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        // 칸 경계를 사인으로 비틀어 표본을 잡는다 — 같은 구역이라도 두 겹이 서로 다른 경계를 그린다.
        const sx = x + Math.sin((y / resolution) * warp.frequency + warp.phase) * warp.amplitude * resolution;
        const sy = y + Math.cos((x / resolution) * warp.frequency * 0.83 + warp.phase * 1.3) * warp.amplitude * resolution;
        const column = Math.min(columns - 1, Math.max(0, Math.floor(sx / resolution)));
        const row = Math.min(rows - 1, Math.max(0, Math.floor(sy / resolution)));
        const cell = row * columns + column;
        if (toneOfTile[cell] === tone && !revealed[cell]) field[y * width + x] = 1;
      }
    }
    for (let pass = 0; pass < FOG_BLUR_PASSES; pass += 1) {
      field = boxBlur(boxBlur(field, width, height, radius, true), width, height, radius, false);
    }
    fields[tone] = field;
  }
  return { width, height, fields };
}

/** 색 하나의 안개가 가장 짙을 때의 색과 진하기다. */
export interface FogTone { color: number; alpha: number }

/**
 * 색마다의 밭을 RGBA 한 장으로 합친다. 캔버스 `ImageData`(비-프리멀티플라이)에 그대로 넣는다.
 *
 * 겹치는 곳은 알파를 더하되 1을 넘기지 않고, 색은 알파로 가중해 평균한다 — 이웃 구역이
 * 스며드는 자리에서 두 색이 섞여 보인다.
 */
export function composeStrataFog(fog: StrataFog, tones: Readonly<Record<StrataZoneTone, FogTone>>, gain = 1): Uint8ClampedArray {
  const out = new Uint8ClampedArray(fog.width * fog.height * 4);
  const entries = (Object.keys(fog.fields) as StrataZoneTone[]).map((tone) => ({ field: fog.fields[tone]!, tone: tones[tone] }));
  for (let pixel = 0; pixel < fog.width * fog.height; pixel += 1) {
    let alpha = 0; let red = 0; let green = 0; let blue = 0;
    for (const { field, tone } of entries) {
      const a = field[pixel] * tone.alpha * gain;
      if (a <= 0) continue;
      alpha += a;
      red += ((tone.color >> 16) & 255) * a; green += ((tone.color >> 8) & 255) * a; blue += (tone.color & 255) * a;
    }
    if (alpha <= 0) continue;
    const at = pixel * 4;
    out[at] = red / alpha; out[at + 1] = green / alpha; out[at + 2] = blue / alpha;
    out[at + 3] = Math.min(1, alpha) * 255;
  }
  return out;
}
