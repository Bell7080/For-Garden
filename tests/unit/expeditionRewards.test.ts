import { describe, expect, it, vi } from "vitest";
import { expeditionRewardRandom, expeditionRewardRule, generateExpeditionAugmentOffers, validateExpeditionAugmentChoice } from "../../src/core/expeditionRewards";
import { EXPEDITION_AUGMENTS } from "../../src/data/expeditionAugments";
import { ExpeditionManager } from "../../src/managers/ExpeditionManager";
import { createDefaultSession } from "../../src/state/session";

/** 전투별 증강 제안/대상/저장 불변식을 한 파일에서 고정한다. */
describe("expedition augment rewards", () => {
  it("assigns one normal, two consecutive horde, one advanced elite selection and none to route tradeoffs", () => {
    expect(expeditionRewardRule("normal")).toEqual({ selections: 1, rarity: "common" });
    expect(expeditionRewardRule("horde")).toEqual({ selections: 2, rarity: "common" });
    expect(expeditionRewardRule("elite")).toEqual({ selections: 1, rarity: "advanced" });
    expect(expeditionRewardRule("rest").selections).toBe(0);
    expect(expeditionRewardRule("treasure").selections).toBe(0);
  });

  it("draws only from the requested rarity pool without duplicate candidates", () => {
    for (const rarity of ["common", "advanced"] as const) {
      const offers = generateExpeditionAugmentOffers({ rarity, relics: party(), selections: [], random: expeditionRewardRandom(rarity) });
      expect(new Set(offers.map(({ augmentId }) => augmentId)).size).toBe(offers.length);
      expect(offers.every(({ augmentId }) => EXPEDITION_AUGMENTS.find(({ id }) => id === augmentId)?.rarity === rarity)).toBe(true);
    }
  });

  it("removes impossible personal targets and rejects a target that was not offered", () => {
    const relics = party();
    relics[1] = { relicId: "rex", currentHp: 0, alive: false };
    const offers = generateExpeditionAugmentOffers({ rarity: "common", relics, selections: [], random: () => 0 });
    const personal = offers.find(({ eligibleTargetRelicIds }) => eligibleTargetRelicIds.length > 0);
    // 한 생존자가 있으므로 쓰러진 rex도 휴식에서 부활 가능한 유효 대상이다.
    expect(personal?.eligibleTargetRelicIds).toEqual(["anky", "rex", "spino"]);
    expect(personal && validateExpeditionAugmentChoice(personal, { augmentId: personal.augmentId, targetRelicId: "unknown" }, [])).toBe(false);
    expect(generateExpeditionAugmentOffers({ rarity: "common", relics: relics.map((relic) => ({ ...relic, currentHp: 0, alive: false })), selections: [], random: () => 0 }).every(({ eligibleTargetRelicIds }) => eligibleTargetRelicIds.length === 0)).toBe(true);
  });

  it("enforces non-stackable and per-target maximum stacks", () => {
    const prior = [{ augmentId: "predator-instinct", targetRelicId: "anky" }, { augmentId: "predator-instinct", targetRelicId: "anky" }];
    const offers = generateExpeditionAugmentOffers({ rarity: "common", relics: party(), selections: prior, random: () => 0, candidateCount: 9 });
    expect(offers.find(({ augmentId }) => augmentId === "predator-instinct")?.eligibleTargetRelicIds).toEqual(["rex", "spino"]);
    const repairUsed = generateExpeditionAugmentOffers({ rarity: "common", relics: party(), selections: [{ augmentId: "field-repair" }], random: () => 0, candidateCount: 9 });
    expect(repairUsed.some(({ augmentId }) => augmentId === "field-repair")).toBe(false);
  });

  it("stores generated seed and offers so reconnecting cannot reroll candidates", () => {
    const state = createDefaultSession();
    const manager = new ExpeditionManager(state, { save: vi.fn() }, () => new Date("2026-08-25T12:00:00Z"));
    manager.start(["anky", "rex", "spino"]);
    const node = state.expedition.run?.nodes.find(({ type }) => type === "normal");
    expect(node).toBeDefined();
    const first = manager.beginAugmentReward(node!.id, "normal");
    const saved = structuredClone(state.expedition);
    // 새 매니저는 저장된 상태를 읽으며 RNG를 다시 호출하거나 후보 순서를 바꾸지 않는다.
    const reconnected = new ExpeditionManager({ ...state, expedition: saved }, { save: vi.fn() }, () => new Date("2026-08-25T12:00:00Z"));
    expect(reconnected.beginAugmentReward(node!.id, "normal")).toEqual(first);
    expect(first?.seed).toContain(node!.id);
  });

  it("persists the first horde result before opening and completing its second consecutive choice", () => {
    const state = createDefaultSession();
    const manager = new ExpeditionManager(state, { save: vi.fn() }, () => new Date("2026-08-25T12:00:00Z"));
    manager.start(["anky", "rex", "spino"]);
    const node = state.expedition.run?.nodes.find(({ type }) => type === "horde");
    expect(node).toBeDefined();
    const first = manager.beginAugmentReward(node!.id, "horde")!;
    expect(chooseFirst(manager, first.offers[0])).toBe(true);
    expect(state.expedition.run?.pendingAugmentReward?.round).toBe(2);
    const second = state.expedition.run!.pendingAugmentReward!;
    expect(chooseFirst(manager, second.offers[0])).toBe(true);
    expect(state.expedition.run?.pendingAugmentReward).toBeNull();
    expect(state.expedition.run?.selectedAugments).toHaveLength(2);
  });
});

/** 각 테스트가 변경해도 서로 참조를 공유하지 않는 기본 원정대다. */
function party() {
  return [
    { relicId: "anky", currentHp: 100, alive: true },
    { relicId: "rex", currentHp: 100, alive: true },
    { relicId: "spino", currentHp: 100, alive: true },
  ];
}

/** 전체 후보는 즉시, 개인 후보는 첫 유효 대상을 골라 매니저 검증 경로를 통과시킨다. */
function chooseFirst(manager: ExpeditionManager, offer: { augmentId: string; eligibleTargetRelicIds: string[] }): boolean {
  return manager.chooseAugment({ augmentId: offer.augmentId, ...(offer.eligibleTargetRelicIds[0] ? { targetRelicId: offer.eligibleTargetRelicIds[0] } : {}) });
}
