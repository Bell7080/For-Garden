import { describe, expect, it } from "vitest";
import { EMPTY_RUNE_LIST_FILTER, nextRuneTraitView, runeListFilterCount, runeListMatches, type RuneListEntry, type RuneListToggles } from "../../src/core/runeListFilter";
import { normalizeSettings, createDefaultSettings } from "../../src/core/settings";

const rune = (patch: Partial<RuneListEntry> = {}): RuneListEntry => ({ rarity: "rare", part: 1, mainStats: [{ key: "atk" }, { key: "hp" }], ...patch });
const toggles: RuneListToggles = { showEquipped: true, trait: "all", bookmarkedOnly: false };
const match = (entry: RuneListEntry, over: Partial<{ toggles: RuneListToggles; filter: typeof EMPTY_RUNE_LIST_FILTER; text: string; equipped: boolean; searchText: string }> = {}) =>
  runeListMatches(entry, { filter: over.filter ?? EMPTY_RUNE_LIST_FILTER, toggles: over.toggles ?? toggles, text: over.text ?? "" }, { equipped: over.equipped ?? false, searchText: over.searchText ?? "희귀 룬 공격력" });

describe("룬 목록 거르기", () => {
  it("아무 조건도 없으면 모두 남는다", () => {
    expect(match(rune())).toBe(true);
    expect(runeListFilterCount(EMPTY_RUNE_LIST_FILTER)).toBe(0);
  });
  it("특성 토글은 전체 → 있음 → 없음으로 돌고 그대로 거른다", () => {
    expect(nextRuneTraitView("all")).toBe("with");
    expect(nextRuneTraitView("with")).toBe("without");
    expect(nextRuneTraitView("without")).toBe("all");
    const traited = rune({ trait: { id: "x" } });
    expect(match(traited, { toggles: { ...toggles, trait: "with" } })).toBe(true);
    expect(match(rune(), { toggles: { ...toggles, trait: "with" } })).toBe(false);
    expect(match(traited, { toggles: { ...toggles, trait: "without" } })).toBe(false);
    expect(match(rune(), { toggles: { ...toggles, trait: "without" } })).toBe(true);
  });
  it("장착 룬 끄기·즐겨찾기만은 토글대로 거른다", () => {
    expect(match(rune(), { equipped: true, toggles: { ...toggles, showEquipped: false } })).toBe(false);
    expect(match(rune(), { toggles: { ...toggles, bookmarkedOnly: true } })).toBe(false);
    expect(match(rune({ bookmarked: true }), { toggles: { ...toggles, bookmarkedOnly: true } })).toBe(true);
  });
  it("필터는 축 안은 OR, 축끼리는 AND다", () => {
    const filter = { rarities: ["rare", "epic"] as const, parts: [1] as const, mainStats: ["def", "atk"] as const };
    expect(match(rune(), { filter: { ...filter, rarities: [...filter.rarities], parts: [...filter.parts], mainStats: [...filter.mainStats] } })).toBe(true);
    expect(match(rune({ part: 0 }), { filter: { ...EMPTY_RUNE_LIST_FILTER, parts: [1] } })).toBe(false);
    expect(match(rune(), { filter: { ...EMPTY_RUNE_LIST_FILTER, mainStats: ["res"] } })).toBe(false);
    expect(runeListFilterCount({ rarities: ["rare"], parts: [0, 1], mainStats: ["atk"] })).toBe(4);
  });
  it("검색은 공백·대소문자를 무시하고 검색 글에 들어 있으면 남는다", () => {
    expect(match(rune(), { text: "  공격 " })).toBe(true);
    expect(match(rune(), { text: "방어" })).toBe(false);
    expect(match(rune(), { text: "ATK", searchText: "Rare rune Atk" })).toBe(true);
  });
  it("토글이 생기기 전의 저장은 모두 보이는 쪽으로 읽는다", () => {
    const old = createDefaultSettings() as unknown as { game: { runeBag: Record<string, unknown> } };
    old.game.runeBag = { showHolder: true, showEquipped: false };
    const settings = normalizeSettings(old);
    expect(settings.game.runeBag).toEqual({ showHolder: true, showEquipped: false, trait: "all", bookmarkedOnly: false });
    old.game.runeBag = { trait: "bogus" };
    expect(normalizeSettings(old).game.runeBag.trait).toBe("all");
  });
});
