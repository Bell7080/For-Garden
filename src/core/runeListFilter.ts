import type { RuneMainStatKey, RunePart, RuneRarity } from "./runes";

/**
 * 룬 목록(가방 룬 탭 · 장착 가방 · 특성 연구 · 합성 고르기)이 함께 쓰는 거르기 규칙.
 *
 * 화면은 조건을 고르기만 하고 어느 룬이 남는지는 이 함수 하나가 정한다 — 네 판이 저마다 거르면
 * 같은 조건에서 남는 룬이 판마다 갈린다. Phaser를 읽지 않아 테스트가 같은 규칙을 그대로 읽는다.
 */
export interface RuneListFilter {
  /** 한 축 안은 OR, 축끼리는 AND다(도감 필터와 같다). 비어 있으면 그 축은 거르지 않는다. */
  readonly rarities: readonly RuneRarity[];
  readonly parts: readonly RunePart[];
  /** 두 주 옵션 중 하나라도 고른 능력치면 남는다. */
  readonly mainStats: readonly RuneMainStatKey[];
}

export const EMPTY_RUNE_LIST_FILTER: RuneListFilter = { rarities: [], parts: [], mainStats: [] };

/** 특성 유무 토글의 세 자리 — 전체 → 특성 있음 → 특성 없음 → 전체. */
export type RuneTraitView = "all" | "with" | "without";
export const RUNE_TRAIT_VIEWS: readonly RuneTraitView[] = ["all", "with", "without"];

export function nextRuneTraitView(view: RuneTraitView): RuneTraitView {
  return RUNE_TRAIT_VIEWS[(RUNE_TRAIT_VIEWS.indexOf(view) + 1) % RUNE_TRAIT_VIEWS.length];
}

/** 토글 줄이 읽는 값(`settings.game.runeBag`)에서 거르기에 쓰는 몫. */
export interface RuneListToggles {
  readonly showEquipped: boolean;
  readonly trait: RuneTraitView;
  readonly bookmarkedOnly: boolean;
}

/** 거르기에 필요한 룬의 모양만 받는다. */
export interface RuneListEntry {
  readonly rarity: RuneRarity;
  readonly part: RunePart;
  readonly mainStats: readonly { readonly key: RuneMainStatKey }[];
  readonly trait?: unknown;
  readonly bookmarked?: boolean;
}

export interface RuneListQuery {
  readonly filter: RuneListFilter;
  readonly toggles: RuneListToggles;
  /** 검색 글. 앞뒤 공백은 무시하고 대소문자를 가리지 않는다. */
  readonly text: string;
}

/** 필터 버튼의 표식 수 — 걸린 칩 수. 검색 글과 토글은 제 자리가 따로 말하므로 세지 않는다. */
export function runeListFilterCount(filter: RuneListFilter): number {
  return filter.rarities.length + filter.parts.length + filter.mainStats.length;
}

/**
 * 이 룬이 목록에 남는가.
 *
 * `searchText`는 그 룬을 검색할 때 읽는 글(이름·부위·등급·옵션·특성 이름)이고, `equipped`는 누군가
 * 끼고 있는지다 — 둘 다 언어·저장을 아는 화면이 만들어 넘긴다.
 */
export function runeListMatches(rune: RuneListEntry, query: RuneListQuery, context: { equipped: boolean; searchText: string }): boolean {
  const { filter, toggles } = query;
  if (!toggles.showEquipped && context.equipped) return false;
  if (toggles.trait === "with" && rune.trait === undefined) return false;
  if (toggles.trait === "without" && rune.trait !== undefined) return false;
  if (toggles.bookmarkedOnly && !rune.bookmarked) return false;
  if (filter.rarities.length > 0 && !filter.rarities.includes(rune.rarity)) return false;
  if (filter.parts.length > 0 && !filter.parts.includes(rune.part)) return false;
  if (filter.mainStats.length > 0 && !rune.mainStats.some(({ key }) => filter.mainStats.includes(key))) return false;
  const needle = query.text.trim().toLocaleLowerCase();
  return needle === "" || context.searchText.toLocaleLowerCase().includes(needle);
}
