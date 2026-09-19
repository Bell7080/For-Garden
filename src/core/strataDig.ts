/**
 * 지층 탐사의 순수 규칙이다.
 *
 * 판 생성·구역 나누기·보상 추첨·공개 판정이 모두 여기 있고 난수는 호출자가 주입한다.
 * 실제 지급과 확정은 언제나 `GameApi` 경계다 — 씬은 이미 정해진 판을 그릴 뿐이다.
 *
 * **보상 내용은 판을 만들 때 이미 정해진다.** 누를 때 굴리면 같은 칸이 언제 눌렸는지에 따라
 * 다른 것이 나오고, 「저 구역이 특별해 보인다」는 판단이 아무것도 가리키지 않게 된다.
 */

import { findStrataLayer, STRATA_ART_COUNT, STRATA_CHARGE, type StrataLayerDefinition, type StrataRewardKind, type StrataZoneTone } from "../data/strataLayers";
import { timeAccrualWindow } from "./timeAccrual";
import type { RuneTrait } from "./runeTraits";

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
  /** 어느 지도 유적에서 시작했는지다. 구 저장 판은 없을 수 있어 선택 필드다. */
  siteId?: string;
  /**
   * 이 판의 겉장 원화 번호(1부터).
   *
   * **판을 열 때 한 번 뽑고 그 뒤로는 바뀌지 않는다.** 화면이 그릴 때마다 고르면 앱을 껐다
   * 켤 때나 탭을 오갈 때마다 파던 땅의 그림이 바뀐다.
   */
  art: number;
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
  siteId?: string;
  art: number;
  columns: number;
  rows: number;
  zones: StrataZone[];
  tiles: StrataTileView[];
  /** 이 지층에서 한 판에 허용한 총 굴착 횟수다. 남은 횟수와 함께 짧은 진행 표기에 쓴다. */
  digsMax: number;
  /** 아직 사용할 수 있는 굴착 횟수다. 0이면 마지막 결과를 확인한 뒤 판을 닫는다. */
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
  // 이미 찍은 자리가 다시 나오면 **다음 빈 칸으로 옮겨 앉는다** — 다시 굴리면 난수가 같은
  // 값만 돌려주는 환경(고정 시드 테스트·손상된 주입)에서 영영 끝나지 않는다.
  while (seeds.length < Math.min(layer.zones, cells)) {
    let candidate = Math.floor(roll(random) * cells);
    while (seeds.includes(candidate)) candidate = (candidate + 1) % cells;
    seeds.push(candidate);
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
export function createStrataBoard(input: { layerId: string; siteId?: string; random: () => number }): StrataBoard {
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
  const art = 1 + Math.floor(roll(input.random) * STRATA_ART_COUNT);
  return { layerId: layer.id, ...(input.siteId ? { siteId: input.siteId } : {}), art, columns: layer.columns, rows: layer.rows, tiles, zones, digsLeft: layer.digs };
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
  const layer = findStrataLayer(board.layerId);
  // 저장 판은 생성 때 검증되지만 손상된 저장이나 서버 구현 오류를 조용히 화면 숫자로 만들지 않는다.
  if (layer === undefined) throw new Error("알 수 없는 지층의 탐사판입니다.");
  return {
    layerId: board.layerId,
    ...(board.siteId ? { siteId: board.siteId } : {}),
    art: board.art,
    columns: board.columns,
    rows: board.rows,
    zones: board.zones.map((zone) => ({ ...zone })),
    digsMax: layer.digs,
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

/**
 * 고고학의 저장 상태다.
 *
 * 진행 중인 판을 저장에 남기는 이유는, 판을 여는 데 횟수를 하나 치렀기 때문이다 — 앱을 껐다
 * 켜면 사라지는 판이면 그 횟수가 조용히 사라진다.
 */
export interface ArchaeologyState {
  /** 남은 탐사 횟수다. */
  charges: number;
  /** 마지막 충전 정산 기준점이다. 없으면 다음 정산이 지금을 기준으로 잡는다. */
  chargesUpdatedAt: string | null;
  /** 진행 중인 판. 없으면 기록 화면만 선다. */
  board: StrataBoard | null;
  /** 서버가 확정한 유적별 해금/완료 진행이다. 해금은 완료와 분리해 운영 보상에도 쓸 수 있다. */
  unlockedSiteIds: string[];
  completedSiteIds: string[];
  /** 마지막으로 고른 유적 ID다. 지도 좌표가 아니라 의미 있는 선택만 저장해 카탈로그 이동에 견딘다. */
  lastSelectedSiteId: string | null;
  /**
   * 재해석해 두고 아직 고르지 않은 특성 후보다.
   *
   * 서버가 들고 있는 이유는 **고르기 전에 앱이 꺼져도 원석이 사라지지 않게** 하기 위해서다 —
   * 후보를 화면만 들고 있으면 돌아온 사람은 값만 치르고 아무것도 받지 못한다.
   */
  pendingReroll: { runeInstanceId: string; candidate: RuneTrait } | null;
}

/** 새 계정의 고고학 상태다. 횟수는 가득 찬 채로 시작한다. */
export function createArchaeologyState(): ArchaeologyState {
  return { charges: STRATA_CHARGE.max, chargesUpdatedAt: null, board: null, unlockedSiteIds: ["garden-gate"], completedSiteIds: [], lastSelectedSiteId: null, pendingReroll: null };
}

/** 서버 시각까지 끝난 구간만 채운다. 시각이 역행하면 기준점을 뒤로 옮기지 않는다. */
export function settleStrataCharges(charges: number, updatedAt: string | null, now: Date): { charges: number; updatedAt: string } {
  const safe = Math.min(STRATA_CHARGE.max, Math.max(0, Math.floor(Number.isFinite(charges) ? charges : 0)));
  const accrual = timeAccrualWindow(updatedAt, now, Math.max(0, STRATA_CHARGE.max - safe) * STRATA_CHARGE.intervalMs);
  if (!accrual.accepted) return { charges: safe, updatedAt: updatedAt ?? now.toISOString() };
  const nowIso = new Date(accrual.window.serverNowMs).toISOString();
  if (safe >= STRATA_CHARGE.max || accrual.initialized) return { charges: safe, updatedAt: nowIso };
  const recovered = Math.min(STRATA_CHARGE.max - safe, Math.floor(accrual.window.elapsedMs / STRATA_CHARGE.intervalMs));
  const nextMs = safe + recovered >= STRATA_CHARGE.max ? accrual.window.serverNowMs : accrual.window.startMs + recovered * STRATA_CHARGE.intervalMs;
  return { charges: safe + recovered, updatedAt: new Date(nextMs).toISOString() };
}

/** 다음 한 번이 차는 시각이다. 가득 찼으면 null이다. */
export function nextStrataChargeAt(charges: number, updatedAt: string): string | null {
  if (charges >= STRATA_CHARGE.max) return null;
  return new Date(Date.parse(updatedAt) + STRATA_CHARGE.intervalMs).toISOString();
}
