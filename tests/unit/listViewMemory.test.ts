import { describe, expect, it } from "vitest";
import {
  normalizeFriendListView, normalizeRuneListView, normalizeRuneViews, normalizeTraitBulkResultView,
  RUNE_LIST_SORT_KEYS, RUNE_VIEW_DEFAULT_SORT, RUNE_VIEW_SCREENS, runeViewFor,
} from "../../src/core/listViewMemory";
import { normalizeSettings } from "../../src/core/settings";
import type { InventorySortKey } from "../../src/managers/InventoryManager";

describe("렐릭 밖 목록의 필터·정렬 기억", () => {
  it("룬 목록은 화면마다 기억이 없으면 그 화면의 기본 정렬로 선다", () => {
    for (const screen of RUNE_VIEW_SCREENS) {
      expect(runeViewFor({}, screen).sort).toEqual(RUNE_VIEW_DEFAULT_SORT[screen]);
      expect(runeViewFor({}, screen).filter).toEqual({ rarities: [], parts: [], mainStats: [] });
    }
    expect(RUNE_VIEW_DEFAULT_SORT.traitBulk).toEqual({ key: "enhancement", direction: "desc" });
  });

  it("아는 값만 남기고, 부위가 서지 않는 정비 창은 부위 필터·정렬을 버린다", () => {
    const raw = { filter: { rarities: ["legendary", "nope", "rare"], parts: [2, 9], mainStats: ["atk", "x"] }, sort: { key: "part", direction: "desc" } };
    expect(normalizeRuneListView(raw, "synthesis")).toEqual({ filter: { rarities: ["rare", "legendary"], parts: [2], mainStats: ["atk"] }, sort: { key: "part", direction: "desc" } });
    expect(normalizeRuneListView(raw, "workbench")).toEqual({ filter: { rarities: ["rare", "legendary"], parts: [], mainStats: ["atk"] }, sort: RUNE_VIEW_DEFAULT_SORT.workbench });
    expect(normalizeRuneListView({ sort: { key: "gone" } }, "bag").sort).toEqual(RUNE_VIEW_DEFAULT_SORT.bag);
    expect(normalizeRuneViews({ synthesis: raw, unknown: raw })).not.toHaveProperty("unknown");
  });

  it("정렬 기준 목록이 가방 정렬과 같다", () => {
    const keys: readonly InventorySortKey[] = RUNE_LIST_SORT_KEYS;
    expect(keys).toContain("relic");
  });

  it("친구·특성 결과판도 모르는 값은 기본값으로 떨어진다", () => {
    expect(normalizeFriendListView({ filter: "online", sort: "name", descending: true })).toEqual({ filter: "online", sort: "name", descending: true });
    expect(normalizeFriendListView({ filter: "x", sort: "name" })).toEqual({ filter: "all", sort: "name", descending: false });
    expect(normalizeTraitBulkResultView({ sort: "holder", descending: false })).toEqual({ sort: "holder", descending: false });
    expect(normalizeTraitBulkResultView({ sort: "?" })).toEqual({ sort: "grade", descending: true });
  });

  it("설정 저장을 한 바퀴 돌아도 남는다(없던 저장은 기억 없음 · 한 번에 선택 꺼짐)", () => {
    const empty = normalizeSettings({});
    expect(empty.game.runeViews).toEqual({});
    expect(empty.game.runeMultiPick).toBe(false);
    const saved = normalizeSettings({ game: { runeViews: { synthesis: { filter: { rarities: ["epic"] }, sort: { key: "rarity", direction: "desc" } } }, runeMultiPick: true, friendView: { filter: "favorite", sort: "level", descending: false } } });
    const again = normalizeSettings(JSON.parse(JSON.stringify(saved)));
    expect(again.game.runeViews.synthesis).toEqual({ filter: { rarities: ["epic"], parts: [], mainStats: [] }, sort: { key: "rarity", direction: "desc" } });
    expect(again.game.runeMultiPick).toBe(true);
    expect(again.game.friendView).toEqual({ filter: "favorite", sort: "level", descending: false });
  });
});
