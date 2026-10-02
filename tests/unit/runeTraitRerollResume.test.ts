import { describe, expect, it } from "vitest";
import { FakeServer } from "../../src/api/FakeServer";
import { createStarterRunes } from "../../src/data/runes";
import { createDefaultSession } from "../../src/state/session";

describe("재해석 버튼", () => {
  it("고르지 않은 후보가 남아 있어도 막히지 않고 같은 후보를 원석 없이 다시 내려준다", async () => {
    const state = createDefaultSession();
    state.wallet.rawStone = 100000;
    state.runeInventory = createStarterRunes(() => 0.5);
    const rune = state.runeInventory[0];
    expect(rune).toBeDefined();
    rune.trait = { id: "vanguard", grade: "rare", upgradeMisses: 0 };
    const api = new FakeServer(state, { latencyMs: 0 });
    const first = await api.rerollRuneTrait({ runeInstanceId: rune!.instanceId, requestId: "a" });
    expect(first.rawStoneSpent).toBeGreaterThan(0);
    const afterFirst = state.wallet.rawStone;
    // 쪽지를 닫은 채로 다시 누른 상황 — 예전에는 RUNE_TRAIT_REROLL_PENDING으로 던져 아무 일도 없어 보였다.
    const again = await api.rerollRuneTrait({ runeInstanceId: rune!.instanceId, requestId: "b" });
    expect(again.candidate).toEqual(first.candidate);
    expect(again.rawStoneSpent).toBe(0);
    expect(state.wallet.rawStone).toBe(afterFirst);
    await api.resolveRuneTraitReroll({ runeInstanceId: rune!.instanceId, keepCandidate: true, requestId: "c" });
    const next = await api.rerollRuneTrait({ runeInstanceId: rune!.instanceId, requestId: "d" });
    expect(next.rawStoneSpent).toBeGreaterThan(0);
  });
});

