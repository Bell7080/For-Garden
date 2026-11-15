import { EMPTY_RELIC_FILTER, RELIC_FILTER_PRESET_AXES, type RelicFilter, type RelicFilterAxis, type RelicFilterPreset } from "./relicFilter";
import { RELIC_SORT_MODES, SORT_DEFAULT_DESCENDING, type RelicSortMode } from "./relicSort";
import { DEFAULT_ROSTER_VIEW, type RosterView } from "./rosterView";
import type { Element, ExcavationProductionCurrency, ReachTier, RelicRarity, Role, SquadId } from "./types";

/**
 * 렐릭 목록이 서는 화면마다 **마지막으로 걸어 둔 필터·정렬**을 기억한다(응태 2026-11-15 — 「각각의 위치에서
 * 필터나 정렬 적용해둔 거 저장되게 유지」).
 *
 * 화면마다 따로 둔다 — 도감에서 SSR만 보는 손이 편성에서도 SSR만 보고 싶은 것은 아니고, 발굴은 생산 재화로,
 * 교류는 도시 특화로 고른다(`RELIC_FILTER_PRESET_AXES`). 값은 기기 선호라 `settings.game.rosterViews`에 남고
 * 계정 설정(`ACCOUNT_GAME_SETTING_KEYS`)에 섞지 않는다.
 *
 * **이름 검색 글은 남기지 않는다** — 한 번 찾고 마는 글이 다음에 열었을 때 목록을 몰래 비워 두면 안 된다.
 */
export type RosterViewScreen = "codex" | "party" | "expedition" | "excavation" | "interaction";

/** 화면마다 필터 판이 세우는 축. 판에 서지 않는 축의 값은 지울 길이 없으므로 기억해도 버린다. */
export const ROSTER_VIEW_SCREEN_PRESET: Readonly<Record<RosterViewScreen, RelicFilterPreset>> = {
  codex: "full",
  party: "battle",
  expedition: "battle",
  excavation: "excavation",
  interaction: "interaction",
};

export const ROSTER_VIEW_SCREENS = Object.keys(ROSTER_VIEW_SCREEN_PRESET) as RosterViewScreen[];

export type StoredRosterViews = Partial<Record<RosterViewScreen, RosterView>>;

const RARITIES = Object.keys({ R: 1, SR: 1, SSR: 1 } satisfies Record<RelicRarity, 1>) as RelicRarity[];
const SQUADS = Object.keys({ fang: 1, gear: 1, eye: 1, rune: 1, rogue: 1, annihilation: 1, "sealed-abyss": 1 } satisfies Record<SquadId, 1>) as SquadId[];
const ELEMENTS = Object.keys({ fire: 1, water: 1, grass: 1, earth: 1, wind: 1 } satisfies Record<Element, 1>) as Element[];
const ROLES = Object.keys({ warrior: 1, tank: 1, assassin: 1, support: 1 } satisfies Record<Role, 1>) as Role[];
const REACHES = Object.keys({ melee: 1, mid: 1, ranged: 1 } satisfies Record<ReachTier, 1>) as ReachTier[];
const CURRENCIES = Object.keys({ gold: 1, cheesecake: 1, rawStone: 1, gems: 1 } satisfies Record<ExcavationProductionCurrency, 1>) as ExcavationProductionCurrency[];

const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

/** 아는 값만, 한 번씩, 정해진 순서로 남긴다. 축이 판에 서지 않으면 비운다. */
function axisValues<T extends string>(value: unknown, known: readonly T[], shown: boolean): T[] {
  if (!shown || !Array.isArray(value)) return [];
  return known.filter((item) => value.includes(item));
}

/**
 * 저장에서 읽은 한 화면의 값을 지금 쓸 수 있는 모양으로 되돌린다.
 *
 * 없어진 옵션(지운 기준·속성·스쿼드), 그 화면 판에 서지 않는 축, 모르는 모양은 **기본값**으로 떨어진다 —
 * 보이지 않는 조건이 목록을 몰래 비우는 일이 없게 한다. 방향은 기준이 바뀌어 버려졌으면 그 기준의 처음 방향이다.
 */
export function normalizeRosterView(value: unknown, screen: RosterViewScreen): RosterView {
  const raw = record(value);
  const f = record(raw.filter);
  const axes = new Set<RelicFilterAxis>(RELIC_FILTER_PRESET_AXES[ROSTER_VIEW_SCREEN_PRESET[screen]]);
  const filter: RelicFilter = {
    ...EMPTY_RELIC_FILTER,
    rarities: axisValues(f.rarities, RARITIES, axes.has("rarity")),
    squads: axisValues(f.squads, SQUADS, axes.has("squad")),
    elements: axisValues(f.elements, ELEMENTS, axes.has("element")),
    roles: axisValues(f.roles, ROLES, axes.has("role")),
    reaches: axisValues(f.reaches, REACHES, axes.has("reach")),
    currencies: axisValues(f.currencies, CURRENCIES, axes.has("currency")),
    specialtyOnly: axes.has("specialty") && f.specialtyOnly === true,
  };
  const known = RELIC_SORT_MODES.includes(raw.sortMode as RelicSortMode);
  const sortMode = known ? raw.sortMode as RelicSortMode : DEFAULT_ROSTER_VIEW.sortMode;
  const descending = known && typeof raw.descending === "boolean" ? raw.descending : SORT_DEFAULT_DESCENDING[sortMode];
  return { filter, sortMode, descending };
}

/** 설정 전체의 `rosterViews`. 모르는 화면 키는 버리고, 아는 화면만 정규화해 남긴다. */
export function normalizeRosterViews(value: unknown): StoredRosterViews {
  const raw = record(value);
  const out: StoredRosterViews = {};
  for (const screen of ROSTER_VIEW_SCREENS) {
    if (screen in raw) out[screen] = normalizeRosterView(raw[screen], screen);
  }
  return out;
}

/** 화면이 열릴 때 세울 값. 기억이 없으면 기본값이다. */
export function rosterViewFor(stored: StoredRosterViews, screen: RosterViewScreen): RosterView {
  const view = stored[screen];
  return view ? normalizeRosterView(view, screen) : DEFAULT_ROSTER_VIEW;
}

/** 두 값이 그 화면에서 같은 것으로 기억되는가(검색 글은 기억하지 않으므로 견주지 않는다). 같으면 다시 저장하지 않는다. */
export function sameRosterView(a: RosterView, b: RosterView, screen: RosterViewScreen): boolean {
  return JSON.stringify(normalizeRosterView(a, screen)) === JSON.stringify(normalizeRosterView(b, screen));
}
