import type { RelicDef } from "./types";
import { EMPTY_RELIC_FILTER, matchesRelicFilter, relicFilterCount, type RelicFilter } from "./relicFilter";
import { SORT_DEFAULT_DESCENDING, sortRelicsBy, type RelicSortMode } from "./relicSort";

/**
 * 편성 목록(파티·원정·발굴·교류)이 보유 렐릭을 **어떻게 추려 세우는가**.
 *
 * 도감과 같은 두 규칙(`matchesRelicFilter` · `sortRelicsBy`)을 그대로 지나므로 새 기준이나 새 필터 축이
 * 생기면 도감과 편성이 함께 움직인다. 화면이 순서나 조건을 다시 적지 않는다.
 */
export interface RosterView {
  readonly filter: RelicFilter;
  readonly sortMode: RelicSortMode;
  readonly descending: boolean;
}

export const DEFAULT_ROSTER_VIEW: RosterView = {
  filter: EMPTY_RELIC_FILTER,
  sortMode: "number",
  descending: SORT_DEFAULT_DESCENDING.number,
};

/** 기준을 바꾸면 그 기준이 처음 보여 주는 방향으로 되돌린다(도감과 같은 규칙). */
export function withRosterSort(view: RosterView, sortMode: RelicSortMode): RosterView {
  return { ...view, sortMode, descending: SORT_DEFAULT_DESCENDING[sortMode] };
}

/** 걸린 조건 수. 필터 칩의 표식이 읽는다. */
export function rosterFilterCount(view: RosterView): number {
  return relicFilterCount(view.filter);
}

/** 조건에 맞는 렐릭만, 기준·방향대로 세운다. 전투력은 부르는 쪽이 어떻게 세는지 넘긴다. */
export function applyRosterView(relics: readonly RelicDef[], view: RosterView, powerOf: (relic: RelicDef) => number): RelicDef[] {
  return sortRelicsBy(relics.filter((relic) => matchesRelicFilter(relic, view.filter)), view.sortMode, view.descending, powerOf);
}
