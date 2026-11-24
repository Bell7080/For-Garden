/**
 * 특성 일괄 부여 결과 창(`RuneTraitBulkResultPopup`)의 자리와 줄 순서 — Phaser 없이 읽히도록 따로 둔다
 * (단위 테스트가 같은 값을 읽는다).
 *
 * 창은 위에서부터 **머리줄(몇 개에 붙었나 · 오른쪽에 정렬 칩) → 등급 칩 줄 → 흐르는 룬 줄**이다. 줄 하나가 룬 하나이고
 * 왼쪽부터 룬 액자 · 붙은 특성(등급 + 이름) · 그 룬을 낀 렐릭이 선다. 창 높이는 줄 수에서 거꾸로 구하고,
 * `maxRows`를 넘으면 창은 그대로 두고 목록만 흐른다.
 */
import { RUNE_TRAIT_GRADES, type RuneTraitGrade } from "../core/runeTraits";
import type { RuneRarity } from "../core/runes";

export const TRAIT_BULK_RESULT = {
  width: 920,
  padding: 40,
  /** 창 윗변에서 머리줄 가운데까지. 제목표가 윗변에 걸터앉으므로 그만큼 비운다. */
  headlineY: 84,
  headlineSize: 34,
  /** 창 윗변에서 등급 칩 줄 가운데까지. */
  chipsY: 146,
  chip: { height: 46, padX: 22, gap: 12, size: 24 },
  /** 창 윗변에서 흐르는 목록 창 윗변까지. */
  viewportTop: 196,
  row: { height: 108, gap: 10, frame: 84, face: 66, band: 8, gradeSize: 26, nameSize: 30, subSize: 22, holderSize: 24, holderWidth: 250 },
  /** 처음부터 보이는 줄 수의 상한 — 넘으면 목록이 흐른다. */
  maxRows: 8,
  /** 머리줄 오른쪽 끝의 정렬 칩(기준 + 방향) — 도감·룬 가방과 같은 `SortControl` 한 장. */
  sort: { width: 220, dirWidth: 62, height: 54, gap: 10, size: 24 },
  /** 목록 창 밑변에서 창 밑변까지. */
  bottom: 40,
} as const;

export type TraitBulkResultSort = "grade" | "holder";

export interface TraitBulkResultEntry {
  instanceId: string;
  rarity: RuneRarity;
  traitGrade: RuneTraitGrade;
  /** 이 룬을 낀 렐릭. 아무도 끼지 않았으면 없다. */
  holderId?: string;
}

function gradeRank(grade: RuneTraitGrade): number {
  return RUNE_TRAIT_GRADES.indexOf(grade);
}

const RARITY_ORDER: readonly RuneRarity[] = ["uncommon", "rare", "epic", "legendary"];

/**
 * 줄 순서.
 *
 * - `grade`: 붙은 특성 등급이 높은 것부터, 같으면 룬 등급이 높은 것부터.
 * - `holder`: 낀 렐릭끼리 모이고(렐릭 순서는 `holderOrder` — 도감 순서), 아무도 끼지 않은 룬은 맨 뒤다.
 *   한 렐릭 안에서는 다시 특성 등급순이다.
 *
 * 마지막 기준은 받은 순서(서버가 돌려준 순서)라 같은 결과는 늘 같은 줄로 선다.
 */
export function sortTraitBulkResult<T extends TraitBulkResultEntry>(entries: readonly T[], mode: TraitBulkResultSort, holderOrder: ReadonlyMap<string, number>, descending = true): T[] {
  const indexed = entries.map((entry, index) => ({ entry, index }));
  const byGrade = (a: TraitBulkResultEntry, b: TraitBulkResultEntry): number =>
    gradeRank(b.traitGrade) - gradeRank(a.traitGrade) || RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity);
  const holderRank = (entry: TraitBulkResultEntry): number =>
    entry.holderId === undefined ? Number.MAX_SAFE_INTEGER : holderOrder.get(entry.holderId) ?? Number.MAX_SAFE_INTEGER - 1;
  indexed.sort((a, b) => {
    if (mode === "holder") {
      const holder = holderRank(a.entry) - holderRank(b.entry);
      if (holder !== 0) return holder;
      if (a.entry.holderId !== b.entry.holderId) return (a.entry.holderId ?? "").localeCompare(b.entry.holderId ?? "");
    }
    return byGrade(a.entry, b.entry) || a.index - b.index;
  });
  const sorted = indexed.map(({ entry }) => entry);
  // 방향 칩을 뒤집으면 줄 전체가 거꾸로 선다 — 등급순은 낮은 등급부터, 장착자순은 안 낀 룬부터.
  return descending ? sorted : sorted.reverse();
}

/** 붙은 특성 등급마다 몇 개인지 — 높은 등급부터, 0개인 등급은 빠진다. */
export function traitBulkGradeCounts(entries: readonly Pick<TraitBulkResultEntry, "traitGrade">[]): { grade: RuneTraitGrade; count: number }[] {
  return [...RUNE_TRAIT_GRADES].reverse()
    .map((grade) => ({ grade, count: entries.filter((entry) => entry.traitGrade === grade).length }))
    .filter(({ count }) => count > 0);
}

export function traitBulkResultRowStep(): number {
  return TRAIT_BULK_RESULT.row.height + TRAIT_BULK_RESULT.row.gap;
}

/** 목록 줄 하나의 가운데 y(목록 창 윗변 기준). */
export function traitBulkResultRowY(index: number): number {
  return index * traitBulkResultRowStep() + TRAIT_BULK_RESULT.row.height / 2;
}

/** 줄 수에서 목록 창 높이와 창 높이를 구한다. */
export function traitBulkResultSize(rowCount: number): { viewHeight: number; contentHeight: number; height: number } {
  const L = TRAIT_BULK_RESULT;
  const step = traitBulkResultRowStep();
  const shown = Math.max(1, Math.min(rowCount, L.maxRows));
  const viewHeight = shown * step - L.row.gap;
  const contentHeight = Math.max(0, rowCount * step - L.row.gap);
  const height = L.viewportTop + viewHeight + L.bottom;
  return { viewHeight, contentHeight, height };
}

/** 목록 창 안의 y(창 윗변 기준, 스크롤 반영 전)에서 몇 번째 줄인지. 줄 사이 틈이면 없다. */
export function traitBulkResultRowAt(localY: number, rowCount: number): number | undefined {
  if (localY < 0) return undefined;
  const step = traitBulkResultRowStep();
  const index = Math.floor(localY / step);
  if (index >= rowCount) return undefined;
  return localY - index * step <= TRAIT_BULK_RESULT.row.height ? index : undefined;
}
