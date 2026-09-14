/**
 * 지층 탐사의 순수 규칙이다.
 *
 * 판 생성·구역 나누기·보상 추첨·공개 판정이 모두 여기 있고 난수는 호출자가 주입한다.
 * 실제 지급과 확정은 언제나 `GameApi` 경계다 — 씬은 이미 정해진 판을 그릴 뿐이다.
 *
 * **보상 내용은 판을 만들 때 이미 정해진다.** 누를 때 굴리면 같은 칸이 언제 눌렸는지에 따라
 * 다른 것이 나오고, 「저 구역이 특별해 보인다」는 판단이 아무것도 가리키지 않게 된다.
 */

import { findStrataLayer, type StrataLayerDefinition, type StrataRewardKind, type StrataZoneTone } from "../data/strataLayers";

/** 판에 깔린 칸 하나다. 서버가 갖고 있다가 공개된 것만 클라이언트에 내려보낸다. */
export interface StrataTile {
  /** 판 왼쪽 위부터 행 우선으로 센 자리다. */
  index: number;
  /** 이 칸이 속한 구역 번호다. 화면은 그 구역의 색만 읽는다. */
  zone: number;
  kind: StrataRewardKind;
  /** 수량이다. 빈 흙과 룬처럼 수가 없는 것은 각각 0과 1이다. */
  amount: number;
  revealed: boolean;
}

/** 판을 나눈 구역 하나다. */
export interface StrataZone {
  index: number;
  tone: StrataZoneTone;
}

/** 지금 진행 중인 한 판이다. 저장에 그대로 직렬화된다. */
export interface StrataBoard {
  layerId: string;
  columns: number;
  rows: number;
  tiles: StrataTile[];
  zones: StrataZone[];
  /** 남은 발굴 횟수다. 0이면 판이 끝났다. */
  digsLeft: number;
}

/** 클라이언트에게 보이는 칸이다. **아직 열지 않은 칸의 내용은 담지 않는다.** */
export interface StrataTileView {
  index: number;
  zone: number;
  revealed: boolean;
  /** 연 칸만 무엇이 나왔는지 갖는다. */
  kind?: StrataRewardKind;
  amount?: number;
}

/** 화면이 받는 판이다. 여기에 없는 것은 화면이 알 수 없다. */
export interface StrataBoardView {
  layerId: string;
  columns: number;
  rows: number;
  zones: StrataZone[];
  tiles: StrataTileView[];
  digsLeft: number;
}

/** 주입된 [0, 1) 난수를 검사한다. 손상된 값을 조용히 0으로 다루지 않는다. */
function roll(random: () => number): number {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new RangeError("탐사 난수는 0 이상 1 미만이어야 합니다.");
  return value;
}

/** 가중치 목록에서 하나를 고른다. 합이 0이면 마지막 항목으로 떨어진다. */
function weightedPick<T>(entries: readonly T[], weightOf: (entry: T) => number, random: () => number): T {
  const weights = entries.map((entry) => Math.max(0, weightOf(entry)));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) return entries[entries.length - 1];
  let cursor = roll(random) * total;
  for (let index = 0; index < entries.length; index += 1) {
    cursor -= weights[index];
    if (cursor < 0) return entries[index];
  }
  return entries[entries.length - 1];
}

/**
 * 구역을 나눈다.
 *
 * 씨앗 칸을 몇 개 찍고 **가장 가까운 씨앗**에 칸을 붙인다 — 칸마다 따로 색을 고르면 구역이
 * 아니라 얼룩이 되어, 「저쪽 구역」이라고 부를 만한 덩어리가 생기지 않는다.
 */
function assignZones(layer: StrataLayerDefinition, random: () => number): { zones: StrataZone[]; zoneOf: number[] } {
  const cells = layer.columns * layer.rows;
  const seeds: number[] = [];
  while (seeds.length < Math.min(layer.zones, cells)) {
    const candidate = Math.floor(roll(random) * cells);
    if (!seeds.includes(candidate)) seeds.push(candidate);
  }
  const tones = Object.keys(layer.toneWeight) as StrataZoneTone[];
  const zones = seeds.map((_, index) => ({ index, tone: weightedPick(tones, (tone) => layer.toneWeight[tone], random) }));
  const zoneOf = Array.from({ length: cells }, (_, cell) => {
    const x = cell % layer.columns;
    const y = Math.floor(cell / layer.columns);
    return seeds.reduce((best, seed, index) => {
      const sx = seed % layer.columns;
      const sy = Math.floor(seed / layer.columns);
      const d = (sx - x) ** 2 + (sy - y) ** 2;
      const bx = seeds[best] % layer.columns;
      const by = Math.floor(seeds[best] / layer.columns);
      return d < (bx - x) ** 2 + (by - y) ** 2 ? index : best;
    }, 0);
  });
  return { zones, zoneOf };
}

/** 새 판을 만든다. 모든 칸의 내용이 이 순간 정해지고 그 뒤로는 바뀌지 않는다. */
export function createStrataBoard(input: { layerId: string; random: () => number }): StrataBoard {
  const layer = findStrataLayer(input.layerId);
  if (layer === undefined) throw new Error("알 수 없는 지층입니다.");
  const { zones, zoneOf } = assignZones(layer, input.random);
  const tiles = zoneOf.map((zone, index) => {
    const tone = zones[zone].tone;
    const row = weightedPick(layer.rewards, (reward) => reward.weight[tone], input.random);
    const span = Math.max(0, row.max - row.min);
    const amount = row.kind === "empty" ? 0 : row.min + Math.round(roll(input.random) * span);
    return { index, zone, kind: row.kind, amount, revealed: false };
  });
  return { layerId: layer.id, columns: layer.columns, rows: layer.rows, tiles, zones, digsLeft: layer.digs };
}

/** 파기 전에 그 칸을 팔 수 있는지 판정한다. 상태를 바꾸지 않는다. */
export function canDigStrataTile(board: StrataBoard, index: number): boolean {
  return board.digsLeft > 0 && board.tiles[index] !== undefined && !board.tiles[index].revealed;
}

/** 칸 하나를 판다. 새 판과 이번에 나온 것을 함께 반환한다. */
export function digStrataTile(board: StrataBoard, index: number): { board: StrataBoard; tile: StrataTile } {
  if (!canDigStrataTile(board, index)) throw new Error("이미 열었거나 팔 수 없는 칸입니다.");
  const tiles = board.tiles.map((tile) => tile.index === index ? { ...tile, revealed: true } : tile);
  return { board: { ...board, tiles, digsLeft: board.digsLeft - 1 }, tile: tiles[index] };
}

/** 판이 끝났는지다. 횟수를 다 쓰면 남은 칸이 있어도 끝이다. */
export function isStrataBoardFinished(board: StrataBoard): boolean {
  return board.digsLeft <= 0 || board.tiles.every((tile) => tile.revealed);
}

/**
 * 화면이 받을 판으로 줄인다.
 *
 * **열지 않은 칸의 내용은 담지 않는다** — 담으면 화면을 뜯어보는 것만으로 어디에 무엇이
 * 있는지 알 수 있어, 색만 보고 고른다는 규칙이 통째로 무너진다.
 */
export function strataBoardView(board: StrataBoard): StrataBoardView {
  return {
    layerId: board.layerId,
    columns: board.columns,
    rows: board.rows,
    zones: board.zones.map((zone) => ({ ...zone })),
    digsLeft: board.digsLeft,
    tiles: board.tiles.map((tile) => tile.revealed
      ? { index: tile.index, zone: tile.zone, revealed: true, kind: tile.kind, amount: tile.amount }
      : { index: tile.index, zone: tile.zone, revealed: false }),
  };
}

/** 이번 판에서 지금까지 캔 것의 합이다. 화면이 따로 세지 않는다. */
export function strataBoardHaul(board: StrataBoardView): Array<{ kind: StrataRewardKind; amount: number }> {
  const totals = new Map<StrataRewardKind, number>();
  for (const tile of board.tiles) {
    if (!tile.revealed || tile.kind === undefined || tile.kind === "empty") continue;
    totals.set(tile.kind, (totals.get(tile.kind) ?? 0) + (tile.amount ?? 0));
  }
  return [...totals].map(([kind, amount]) => ({ kind, amount }));
}
