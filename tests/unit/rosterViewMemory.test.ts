import { describe, expect, it } from "vitest";
import { createDefaultSettings, normalizeSettings } from "../../src/core/settings";
import { DEFAULT_ROSTER_VIEW } from "../../src/core/rosterView";
import { EMPTY_RELIC_FILTER } from "../../src/core/relicFilter";
import { normalizeRosterView, normalizeRosterViews, rosterViewFor, sameRosterView, ROSTER_VIEW_SCREENS } from "../../src/core/rosterViewMemory";
import { ACCOUNT_GAME_SETTING_KEYS } from "../../src/core/settingsOwnership";

describe("렐릭 목록 화면별 필터·정렬 기억", () => {
  it("기억이 없으면 모든 화면이 기본 필터·정렬로 선다", () => {
    const stored = createDefaultSettings().game.rosterViews;
    for (const screen of ROSTER_VIEW_SCREENS) expect(rosterViewFor(stored, screen)).toEqual(DEFAULT_ROSTER_VIEW);
  });

  it("화면마다 따로 기억하고 설정 저장을 왕복한다", () => {
    const settings = createDefaultSettings();
    settings.game.rosterViews = {
      codex: { filter: { ...EMPTY_RELIC_FILTER, rarities: ["SSR"] }, sortMode: "power", descending: true },
      party: { filter: { ...EMPTY_RELIC_FILTER, elements: ["fire", "water"] }, sortMode: "rarity", descending: false },
    };
    const back = normalizeSettings(JSON.parse(JSON.stringify(settings))).game.rosterViews;
    expect(rosterViewFor(back, "codex").filter.rarities).toEqual(["SSR"]);
    expect(rosterViewFor(back, "codex").sortMode).toBe("power");
    expect(rosterViewFor(back, "party").filter.elements).toEqual(["fire", "water"]);
    expect(rosterViewFor(back, "party").descending).toBe(false);
    expect(rosterViewFor(back, "expedition")).toEqual(DEFAULT_ROSTER_VIEW);
  });

  it("없어진 옵션·모르는 기준은 기본값으로 떨어진다", () => {
    const view = normalizeRosterView({ filter: { elements: ["fire", "ice"], roles: "tank" }, sortMode: "level", descending: true }, "party");
    expect(view.filter.elements).toEqual(["fire"]);
    expect(view.filter.roles).toEqual([]);
    expect(view.sortMode).toBe(DEFAULT_ROSTER_VIEW.sortMode);
    expect(view.descending).toBe(DEFAULT_ROSTER_VIEW.descending);
    expect(normalizeRosterView("망가진 값", "codex")).toEqual(DEFAULT_ROSTER_VIEW);
    expect(normalizeRosterViews({ unknownScreen: { sortMode: "power" } })).toEqual({});
  });

  it("그 화면 필터 판에 서지 않는 축은 기억해도 버린다", () => {
    const filter = { ...EMPTY_RELIC_FILTER, rarities: ["SR"], currencies: ["gold"], reaches: ["melee"], specialtyOnly: true };
    const party = normalizeRosterView({ filter, sortMode: "number", descending: false }, "party");
    expect(party.filter).toEqual({ ...EMPTY_RELIC_FILTER, reaches: ["melee"] });
    const excavation = normalizeRosterView({ filter, sortMode: "number", descending: false }, "excavation");
    expect(excavation.filter).toEqual({ ...EMPTY_RELIC_FILTER, rarities: ["SR"], currencies: ["gold"] });
    const interaction = normalizeRosterView({ filter, sortMode: "number", descending: false }, "interaction");
    expect(interaction.filter.specialtyOnly).toBe(true);
    expect(interaction.filter.rarities).toEqual([]);
  });

  it("검색 글은 기억하지 않는다", () => {
    const view = normalizeRosterView({ filter: { ...EMPTY_RELIC_FILTER, query: "토리카" }, sortMode: "number", descending: false }, "codex");
    expect(view.filter.query).toBe("");
    expect(sameRosterView({ ...DEFAULT_ROSTER_VIEW, filter: { ...EMPTY_RELIC_FILTER, query: "a" } }, DEFAULT_ROSTER_VIEW, "codex")).toBe(true);
  });

  it("기기 선호라 계정 설정에 섞지 않는다", () => {
    expect(ACCOUNT_GAME_SETTING_KEYS as readonly string[]).not.toContain("rosterViews");
  });
});
