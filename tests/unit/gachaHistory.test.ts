import { describe, expect, it } from "vitest";
import { FakeServer } from "../../src/api/FakeServer";
import { getBanner, researchBanners } from "../../src/data/banners";
import { appendGachaHistory, GACHA_HISTORY_SLOT_LIMIT, gachaHistoryNewestFirst, gachaHistorySlotCount, isValidGachaHistory, normalizeGachaHistory, type GachaHistoryEntry } from "../../src/core/gachaHistory";
import { canonicalJson } from "../../src/core/jsonShape";
import { SaveManager } from "../../src/state/SaveManager";
import { createDefaultSession } from "../../src/state/session";
import { formatGachaHistoryTime, gachaHistoryRows, GACHA_HISTORY } from "../../src/ui/gachaHistoryLayout";
import { gachaHistoryEntryTint, gachaHistoryPickupRelicId, gachaHistoryPityTotal, gachaHistorySectionOfBanner } from "../../src/ui/gachaHistorySections";

function entry(count: 1 | 10, at = "2026-11-11T09:00:00.000Z"): GachaHistoryEntry {
  return { at, bannerId: "fossil", count, cost: { fossil: count }, pity: 3, slots: Array.from({ length: count }, () => ({ kind: "relic" as const, relicId: "torika" })) };
}

function labSession() {
  const state = createDefaultSession();
  state.cleared.add("1-5");
  state.wallet.fossil = 100;
  return state;
}

describe("연구 기록", () => {
  it("단일·10연 연구가 같은 저장에 묶음으로 남고 칸은 추첨 순서·치른 값·천장을 든다", async () => {
    const state = labSession();
    const server = new FakeServer(state, { latencyMs: 0 });
    const one = await server.pullRelics({ bannerId: "fossil", count: 1 });
    const ten = await server.pullRelics({ bannerId: "fossil", count: 10 });
    const entries = state.gachaHistory!.entries;
    expect(entries.map((item) => item.count)).toEqual([1, 10]);
    expect(entries[0].cost).toEqual({ fossil: 1 });
    expect(entries[1].slots).toHaveLength(10);
    expect(entries[1].pity).toBe(state.gachaPityByGroup[getBanner("fossil").pityGroupId].pullsSinceSsr);
    // 칸은 응답의 결과와 같은 순서·같은 것이다.
    for (const [response, item] of [[one, entries[0]], [ten, entries[1]]] as const) {
      expect(item.slots.map((slot) => slot.kind === "relic" ? slot.relicId : slot.currency))
        .toEqual(response.results.map((result) => result.type === "relic" ? result.relicId : result.currency));
    }
    expect(Number.isNaN(Date.parse(entries[0].at))).toBe(false);
  });

  it("최근 칸 수를 넘으면 가장 오래된 묶음만 통째로 걷는다", () => {
    let state = normalizeGachaHistory(undefined);
    for (let i = 0; i < 12; i += 1) state = appendGachaHistory(state, entry(10, new Date(Date.UTC(2026, 10, 1, i)).toISOString()));
    expect(gachaHistorySlotCount(state)).toBe(GACHA_HISTORY_SLOT_LIMIT);
    expect(state.entries[0].at).toBe(new Date(Date.UTC(2026, 10, 1, 2)).toISOString());
    expect(gachaHistoryNewestFirst(state)[0].at).toBe(new Date(Date.UTC(2026, 10, 1, 11)).toISOString());
  });

  it("저장을 왕복해도 같은 모양이고, jsonb처럼 키 순서가 바뀌어도 거부하지 않는다", async () => {
    const state = labSession();
    const server = new FakeServer(state, { latencyMs: 0 });
    await server.pullRelics({ bannerId: "fossil", count: 10 });
    const saves = new SaveManager(undefined);
    const exported = JSON.parse(JSON.stringify(saves.exportData(state)));
    const reordered = JSON.parse(canonicalJson(exported));
    expect(saves.parse(reordered).gachaHistory).toEqual(state.gachaHistory);
    expect(isValidGachaHistory(reordered.gachaHistory)).toBe(true);
    // 도입 전 저장(기록 없음)도 받는다.
    delete exported.gachaHistory;
    expect(saves.parse(exported).gachaHistory).toEqual({ entries: [] });
  });

  it("목록 자리 — 묶음 머리줄 아래 칸이 이어지고 시각은 숫자만 쓴다", () => {
    const { rows, height } = gachaHistoryRows([1, 10]);
    expect(rows.filter((row) => row.kind === "header")).toHaveLength(2);
    expect(rows.filter((row) => row.kind === "slot")).toHaveLength(11);
    const L = GACHA_HISTORY;
    expect(height).toBe(L.header.height * 2 + L.header.gap * 2 + L.slot.height * 11 + L.groupGap);
    expect(formatGachaHistoryTime("2026-11-11T09:05:00")).toBe("2026.11.11 09:05");
  });
});

describe("연구 기록 — 뽑기별 구분", () => {
  const banners = researchBanners(true);
  it("천장 그룹을 따라 상시·한정 픽업·첫 복원으로 가르고, 두 픽업은 한 갈래다", () => {
    expect(gachaHistorySectionOfBanner("fossil", banners)).toBe("standard");
    expect(gachaHistorySectionOfBanner("amber", banners)).toBe("pickup");
    expect(gachaHistorySectionOfBanner("moonlit", banners)).toBe("pickup");
    expect(gachaHistorySectionOfBanner("welcome", banners)).toBe("welcome");
  });

  it("묶음 머리줄의 분모는 그 배너가 속한 천장 그룹의 확정 횟수다", () => {
    expect(gachaHistoryPityTotal("amber", banners)).toBe(getBanner("amber").highestRarityGuarantee);
    expect(gachaHistoryPityTotal("moonlit", banners)).toBe(gachaHistoryPityTotal("amber", banners));
    expect(gachaHistoryPityTotal("welcome", banners)).toBe(getBanner("welcome").highestRarityGuarantee);
  });

  it("디안·플레샤 픽업은 머리줄 색과 얼굴로 갈린다", () => {
    expect(gachaHistoryEntryTint("amber", banners).accent).not.toBe(gachaHistoryEntryTint("moonlit", banners).accent);
    expect(gachaHistoryPickupRelicId("amber", banners)).toBe("dian");
    expect(gachaHistoryPickupRelicId("moonlit", banners)).toBe("plesha");
    expect(gachaHistoryPickupRelicId("fossil", banners)).toBeUndefined();
  });

  it("머리 판 없이 목록이 머리글 바로 아래에서 흐른다", () => {
    expect(GACHA_HISTORY.viewportTop).toBeGreaterThan(GACHA_HISTORY.captionY);
    expect("summary" in GACHA_HISTORY).toBe(false);
  });
});
