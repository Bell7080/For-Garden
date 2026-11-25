import { EMPTY_RUNE_LIST_FILTER, type RuneListFilter } from "./runeListFilter";
import type { RuneMainStatKey, RunePart, RuneRarity } from "./runes";
import { FRIEND_FILTERS, FRIEND_SORT_MODES, defaultFriendSortDirection, type FriendFilter, type FriendSortMode } from "./social";

/**
 * 렐릭 밖의 목록(룬 목록 · 친구 · 특성 일괄 부여 결과)이 **마지막으로 걸어 둔 필터·정렬**을 기억한다
 * (응태 2026-11-25 — 「필터 한번 바꾸면 저장되게, 다른 곳들도」). 렐릭 목록은 `rosterViewMemory.ts`가 맡는다.
 *
 * 화면마다 따로 둔다 — 합성은 각인 마친 같은 등급을, 장착은 자리 하나를 찾는 손이라 같은 조건을 바라지 않는다.
 * 값은 기기 선호라 `settings.game`에 남고 계정 설정에 섞지 않는다. **검색 글은 남기지 않는다**(렐릭 목록과 같다).
 * 없어진 옵션·모르는 모양은 그 화면의 기본값으로 떨어진다 — 보이지 않는 조건이 목록을 몰래 비우지 않게 한다.
 */

/** 룬 목록의 정렬 기준. 가방 정렬(`InventoryManager`)이 같은 목록을 읽는다. */
export const RUNE_LIST_SORT_KEYS = ["acquired", "rarity", "part", "enhancement", "equipped", "relic", "trait"] as const;
export type RuneListSortKey = (typeof RUNE_LIST_SORT_KEYS)[number];
export interface RuneListSort { key: RuneListSortKey; direction: "asc" | "desc" }

/** 룬 목록이 서는 화면 — 가방 · 룬 정비 창 · 특성 연구 고르기 · 합성 고르기 · 특성 일괄 부여 · 일괄 세공. */
export const RUNE_VIEW_SCREENS = ["bag", "workbench", "research", "synthesis", "traitBulk", "bulkCraft"] as const;
export type RuneViewScreen = (typeof RUNE_VIEW_SCREENS)[number];

export interface RuneListView { filter: RuneListFilter; sort: RuneListSort }
export type StoredRuneViews = Partial<Record<RuneViewScreen, RuneListView>>;

/** 화면마다 처음 정렬. 특성 일괄 부여는 세공 많은 순으로 연다(다듬은 룬에 특성을 주는 손이다). */
export const RUNE_VIEW_DEFAULT_SORT: Readonly<Record<RuneViewScreen, RuneListSort>> = {
  bag: { key: "relic", direction: "asc" },
  workbench: { key: "relic", direction: "asc" },
  research: { key: "relic", direction: "asc" },
  synthesis: { key: "relic", direction: "asc" },
  traitBulk: { key: "enhancement", direction: "desc" },
  bulkCraft: { key: "relic", direction: "asc" },
};

/** 부위가 하나로 정해진 목록(룬 정비 창)에는 부위 필터·정렬이 서지 않는다 — 기억해도 버린다. */
export const RUNE_VIEW_SHOWS_PARTS: Readonly<Record<RuneViewScreen, boolean>> = {
  bag: true, workbench: false, research: true, synthesis: true, traitBulk: true, bulkCraft: true,
};

const RARITIES: readonly RuneRarity[] = ["uncommon", "rare", "epic", "legendary"];
const PARTS: readonly RunePart[] = [0, 1, 2];
const MAIN_STATS: readonly RuneMainStatKey[] = ["hp", "atk", "ap", "def", "res"];

const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const pick = <T>(value: unknown, known: readonly T[]): T[] => Array.isArray(value) ? known.filter((item) => value.includes(item)) : [];

export function normalizeRuneListView(value: unknown, screen: RuneViewScreen): RuneListView {
  const raw = record(value);
  const f = record(raw.filter);
  const parts = RUNE_VIEW_SHOWS_PARTS[screen];
  const filter: RuneListFilter = {
    ...EMPTY_RUNE_LIST_FILTER,
    rarities: pick(f.rarities, RARITIES),
    parts: parts ? pick(f.parts, PARTS) : [],
    mainStats: pick(f.mainStats, MAIN_STATS),
  };
  const s = record(raw.sort);
  const fallback = RUNE_VIEW_DEFAULT_SORT[screen];
  const key = RUNE_LIST_SORT_KEYS.includes(s.key as RuneListSortKey) && (parts || s.key !== "part") ? s.key as RuneListSortKey : undefined;
  const sort: RuneListSort = key
    ? { key, direction: s.direction === "desc" ? "desc" : s.direction === "asc" ? "asc" : fallback.direction }
    : { ...fallback };
  return { filter, sort };
}

export function normalizeRuneViews(value: unknown): StoredRuneViews {
  const raw = record(value);
  const out: StoredRuneViews = {};
  for (const screen of RUNE_VIEW_SCREENS) {
    if (screen in raw) out[screen] = normalizeRuneListView(raw[screen], screen);
  }
  return out;
}

/** 화면이 열릴 때 세울 값. 기억이 없으면 그 화면의 기본값이다. */
export function runeViewFor(stored: StoredRuneViews, screen: RuneViewScreen): RuneListView {
  return normalizeRuneListView(stored[screen] ?? {}, screen);
}

/** 친구 목록의 필터·정렬. */
export interface FriendListView { filter: FriendFilter; sort: FriendSortMode; descending: boolean }
export const DEFAULT_FRIEND_LIST_VIEW: FriendListView = { filter: "all", sort: "lastActive", descending: true };

export function normalizeFriendListView(value: unknown): FriendListView {
  const raw = record(value);
  const filter = FRIEND_FILTERS.includes(raw.filter as FriendFilter) ? raw.filter as FriendFilter : DEFAULT_FRIEND_LIST_VIEW.filter;
  const known = FRIEND_SORT_MODES.includes(raw.sort as FriendSortMode);
  const sort = known ? raw.sort as FriendSortMode : DEFAULT_FRIEND_LIST_VIEW.sort;
  const descending = known && typeof raw.descending === "boolean" ? raw.descending : defaultFriendSortDirection(sort);
  return { filter, sort, descending };
}

/** 특성 일괄 부여 결과판의 정렬. */
export const TRAIT_BULK_RESULT_SORTS = ["grade", "holder"] as const;
export type TraitBulkResultSortKey = (typeof TRAIT_BULK_RESULT_SORTS)[number];
export interface TraitBulkResultView { sort: TraitBulkResultSortKey; descending: boolean }
export const DEFAULT_TRAIT_BULK_RESULT_VIEW: TraitBulkResultView = { sort: "grade", descending: true };

export function normalizeTraitBulkResultView(value: unknown): TraitBulkResultView {
  const raw = record(value);
  const known = TRAIT_BULK_RESULT_SORTS.includes(raw.sort as TraitBulkResultSortKey);
  return {
    sort: known ? raw.sort as TraitBulkResultSortKey : DEFAULT_TRAIT_BULK_RESULT_VIEW.sort,
    descending: typeof raw.descending === "boolean" ? raw.descending : DEFAULT_TRAIT_BULK_RESULT_VIEW.descending,
  };
}

/** 같은 값이면 다시 저장하지 않는다. */
export function sameListView(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
