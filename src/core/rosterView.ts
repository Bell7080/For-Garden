import type { RelicDef } from "./types";
import { EMPTY_RELIC_FILTER, matchesRelicFilter, relicFilterCount, type RelicFilter, type RelicFilterContext } from "./relicFilter";
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

/** 처음 여는 목록은 강한 순(전투력 내림차순)이다(응태 2026-11-28). 한 번 바꾸면 화면마다 그 값을 기억한다. */
export const DEFAULT_ROSTER_VIEW: RosterView = {
  filter: EMPTY_RELIC_FILTER,
  sortMode: "power",
  descending: SORT_DEFAULT_DESCENDING.power,
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
export function applyRosterView(relics: readonly RelicDef[], view: RosterView, powerOf: (relic: RelicDef) => number, context: RelicFilterContext = {}): RelicDef[] {
  return sortRelicsBy(relics.filter((relic) => matchesRelicFilter(relic, view.filter, context)), view.sortMode, view.descending, powerOf);
}

/**
 * 편성 목록에서 **지금 자리에 선 렐릭을 자리 순서대로 맨 앞에** 올리고, 나머지는 받은 순서(필터·정렬)를 그대로 둔다.
 * 목록에 없는 자리(빈 칸·필터에 걸러진 렐릭)는 건너뛴다 — 필터를 우회해 걸러진 렐릭을 다시 세우지 않는다.
 * 그리드와 정보창의 좌우 넘김이 같은 함수를 읽어 두 순서가 갈리지 않는다.
 */
export function deployedFirst<T extends { readonly id: string }>(relics: readonly T[], picked: readonly (string | null | undefined)[]): T[] {
  const byId = new Map(relics.map((relic) => [relic.id, relic]));
  const front: T[] = [];
  for (const id of picked) {
    const relic = id ? byId.get(id) : undefined;
    if (relic && !front.includes(relic)) front.push(relic);
  }
  return [...front, ...relics.filter((relic) => !front.includes(relic))];
}
