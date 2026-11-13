/**
 * 그림이 걸친 격자 셀의 삼각형만 고른다 — PuppetForge v0.42.0 런타임(`PuppetCreature`의
 * `drawableIndices`)이 하는 투명 셀 생략을 이 게임의 indexed 렌더러로 옮긴 것이다.
 *
 * **판정은 PuppetForge `src/core/mesh`의 `alphaCellCoverage` → `vertexMaskFromCells` →
 * `visibleIndices`를 그대로 따른다.** 그 함수들은 패키지 공개 진입점(`puppetforge`·
 * `puppetforge/phaser`)에 없어 가져올 수 없으므로 최소한으로 옮겨 적었다. 편집기가 칠하기와
 * 테두리 채움에 쓰는 마스크와 같은 판정이라, 여기서 다르게 고르면 칠한 정점과 그리는 셀이 갈린다.
 * PuppetForge를 올릴 때 그쪽 판정이 바뀌었는지 함께 본다.
 *
 * 정점 배열·번호·가중치는 그대로다. 그리는 삼각형 목록만 줄어든다.
 * Phaser를 읽지 않는다 — 원화 디코드와 함께 일꾼에서 돈다(`puppetParseWorker.ts`).
 */

/** 알파가 하나라도 있으면 그림으로 본다. (PuppetForge `MESH_ALPHA_THRESHOLD`) */
export const DRAWABLE_ALPHA_THRESHOLD = 1;
/** 선형 필터가 이웃 픽셀을 섞어 오는 폭과 얇은 반투명 외곽을 위한 여유(px). (`MESH_ALPHA_PADDING`) */
export const DRAWABLE_ALPHA_PADDING = 2;

export interface DrawableGrid {
  readonly cols: number;
  readonly rows: number;
  readonly indices: ArrayLike<number>;
}

/** 셀 순서(`row * cols + col`)의 0/1 배열. 셀에 픽셀이 하나라도 그려져 있으면 1이다. */
export function alphaCellCoverage(alpha: ArrayLike<number>, width: number, height: number, cols: number, rows: number): Uint8Array {
  const cells = new Uint8Array(cols * rows);
  if (width <= 0 || height <= 0) return cells;
  const padding = DRAWABLE_ALPHA_PADDING;
  const scaleX = cols / width;
  const scaleY = rows / height;
  const colFrom = (x: number) => Math.max(0, Math.floor((x - padding) * scaleX));
  const colTo = (x: number) => Math.min(cols - 1, Math.ceil((x + 1 + padding) * scaleX) - 1);
  const rowFrom = (y: number) => Math.max(0, Math.floor((y - padding) * scaleY));
  const rowTo = (y: number) => Math.min(rows - 1, Math.ceil((y + 1 + padding) * scaleY) - 1);
  for (let y = 0; y < height; y += 1) {
    const r0 = rowFrom(y);
    const r1 = rowTo(y);
    let x = 0;
    while (x < width) {
      if ((alpha[y * width + x] ?? 0) < DRAWABLE_ALPHA_THRESHOLD) { x += 1; continue; }
      const start = x;
      while (x < width && (alpha[y * width + x] ?? 0) >= DRAWABLE_ALPHA_THRESHOLD) x += 1;
      const c0 = colFrom(start);
      const c1 = colTo(x - 1);
      for (let row = r0; row <= r1; row += 1) cells.fill(1, row * cols + c0, row * cols + c1 + 1);
    }
  }
  return cells;
}

/**
 * 꼭짓점 네 개가 모두 "그림이 걸친 셀"의 꼭짓점인 셀만 남긴 인덱스. 격자 모양이 아니면 `null`
 * (부르는 쪽이 전체 인덱스를 그대로 그린다).
 */
export function drawableIndices(grid: DrawableGrid, alpha: ArrayLike<number>, width: number, height: number): Uint16Array | null {
  const { cols, rows, indices } = grid;
  if (cols <= 0 || rows <= 0 || indices.length !== cols * rows * 6) return null;
  if ((cols + 1) * (rows + 1) > 0x10000) return null;
  const cells = alphaCellCoverage(alpha, width, height, cols, rows);
  const stride = cols + 1;
  const mask = new Uint8Array(stride * (rows + 1));
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (!cells[row * cols + col]) continue;
      const top = row * stride + col;
      mask[top] = 1; mask[top + 1] = 1; mask[top + stride] = 1; mask[top + stride + 1] = 1;
    }
  }
  const kept: number[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const top = row * stride + col;
      if (!mask[top] || !mask[top + 1] || !mask[top + stride] || !mask[top + stride + 1]) continue;
      const start = (row * cols + col) * 6;
      for (let k = 0; k < 6; k += 1) kept.push(indices[start + k] ?? 0);
    }
  }
  return Uint16Array.from(kept);
}

/**
 * 묶음마다 한 번 고른 인덱스. 키는 텍스처 키와 같은 이름에 원화 파일·격자 크기를 붙인 것이다 —
 * 이름만으로는 다른 묶음이 같은 이름을 쓸 때 다른 원화의 셀을 빌려 올 수 있다.
 * 값이 작아(정점 수 × 2바이트 미만) 거주 규칙과 무관하게 남겨 둔다.
 */
const drawable = new Map<string, Uint16Array>();

export function drawableKey(name: string, texture: string, cols: number, rows: number): string {
  return `${name}|${texture}|${cols}x${rows}`;
}

export function registerDrawableIndices(key: string, indices: Uint16Array): void {
  drawable.set(key, indices);
}

export function lookupDrawableIndices(key: string): Uint16Array | undefined {
  return drawable.get(key);
}
