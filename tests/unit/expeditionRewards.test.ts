import { describe, expect, it, vi } from "vitest";
import { calculateExpeditionNodeRewards, expeditionNodeRewardScore, expeditionRewardRandom, expeditionRewardRule, generateExpeditionAugmentOffers, validateExpeditionAugmentChoice } from "../../src/core/expeditionRewards";
import { EXPEDITION_NODE_REWARD_BALANCE } from "../../src/data/expedition";
import { EXPEDITION_AUGMENTS } from "../../src/data/expeditionAugments";
import { ExpeditionManager } from "../../src/managers/ExpeditionManager";
import { createDefaultSession } from "../../src/state/session";

/** 전투별 증강 제안/대상/저장 불변식을 한 파일에서 고정한다. */
describe("expedition augment rewards", () => {
  it("런 상한을 넘지 않고 음수·미등록 누적 재화를 거부한다", () => {
    const almostCapped = { gold: EXPEDITION_NODE_REWARD_BALANCE.gold.runCap - 2 };
    expect(calculateExpeditionNodeRewards({ nodeType: "elite", accumulated: almostCapped, random: () => 0.999 }).gold).toBe(2);
    expect(() => calculateExpeditionNodeRewards({ nodeType: "normal", accumulated: { gold: -1 }, random: () => 0 })).toThrow("INVALID_EXPEDITION_REWARD_STATE");
    expect(() => calculateExpeditionNodeRewards({ nodeType: "normal", accumulated: { hacked: 1 }, random: () => 0 })).toThrow("INVALID_EXPEDITION_REWARD_STATE");
  });

  it("일반 노드 클리어 보상은 종류를 가리지 않고 그대로 더해 주간 누적 점수로 환산한다", () => {
    expect(expeditionNodeRewardScore({ cheesecake: 8, gold: 260, fossil: 6 })).toBe(274);
    expect(expeditionNodeRewardScore({})).toBe(0);
    // 전멸로 보상이 없는 노드는 점수도 없다.
    expect(expeditionNodeRewardScore({ gold: 0 })).toBe(0);
  });

  it("보물은 보석을 보장하고 증강을 제공하지 않는다", () => {
    expect(calculateExpeditionNodeRewards({ nodeType: "treasure", accumulated: {}, random: () => 0 }).gems).toBeGreaterThanOrEqual(3);
    expect(expeditionRewardRule("treasure")).toEqual({ selections: 0, rarity: null });
  });
  it("assigns one normal, two consecutive horde, one SSR elite selection and none to route tradeoffs", () => {
    expect(expeditionRewardRule("normal")).toEqual({ selections: 1, rarity: "sr" });
    expect(expeditionRewardRule("horde")).toEqual({ selections: 2, rarity: "sr" });
    expect(expeditionRewardRule("elite")).toEqual({ selections: 1, rarity: "ssr" });
    expect(expeditionRewardRule("rest").selections).toBe(0);
    expect(expeditionRewardRule("treasure").selections).toBe(0);
  });

  it("draws only from the requested rarity pool without duplicate candidates", () => {
    for (const rarity of ["sr", "ssr"] as const) {
      const offers = generateExpeditionAugmentOffers({ rarity, relics: party(), selections: [], random: expeditionRewardRandom(rarity) });
      expect(new Set(offers.map(({ augmentId }) => augmentId)).size).toBe(offers.length);
      expect(offers.every(({ augmentId }) => EXPEDITION_AUGMENTS.find(({ id }) => id === augmentId)?.rarity === rarity)).toBe(true);
    }
  });

  it("removes impossible personal targets and rejects a target that was not offered", () => {
    const relics = party();
    relics[1] = { relicId: "rex", currentHp: 0, alive: false };
    const offers = generateExpeditionAugmentOffers({ rarity: "sr", relics, selections: [], random: () => 0 });
    const personal = offers.find(({ eligibleTargetRelicIds }) => eligibleTargetRelicIds.length > 0);
    // 한 생존자가 있으므로 쓰러진 rex도 휴식에서 부활 가능한 유효 대상이다.
    expect(personal?.eligibleTargetRelicIds).toEqual(["anky", "rex", "spino"]);
    expect(personal && validateExpeditionAugmentChoice(personal, { augmentId: personal.augmentId, targetRelicId: "unknown" }, [])).toBe(false);
    expect(generateExpeditionAugmentOffers({ rarity: "sr", relics: relics.map((relic) => ({ ...relic, currentHp: 0, alive: false })), selections: [], random: () => 0 }).every(({ eligibleTargetRelicIds }) => eligibleTargetRelicIds.length === 0)).toBe(true);
  });

  it("최대 중첩에 도달한 후보를 제거하고 저장 뒤 변조된 재선택도 거절한다", () => {
    const def = EXPEDITION_AUGMENTS.find(({ id }) => id === "predator-instinct")!;
    const prior = Array.from({ length: def.maxStacks }, () => ({ augmentId: def.id, targetRelicId: "anky" }));
    const offers = generateExpeditionAugmentOffers({ rarity: "sr", relics: party(), selections: prior, random: () => 0, candidateCount: 99 });
    expect(offers.some(({ augmentId }) => augmentId === def.id)).toBe(false);
    // 오래 저장된 제안 DTO를 다시 보내도 현재 런의 중첩 수를 기준으로 서버 경계가 거절한다.
    expect(validateExpeditionAugmentChoice({ augmentId: def.id, eligibleTargetRelicIds: ["anky"] }, { augmentId: def.id, targetRelicId: "anky" }, prior)).toBe(false);
  });

  it("이미 선택한 배타 그룹의 다른 후보와 조작된 선택 DTO를 거절한다", () => {
    const prior = [{ augmentId: "reinforced-core" }];
    const offers = generateExpeditionAugmentOffers({ rarity: "sr", relics: party(), selections: prior, random: () => 0, candidateCount: 99 });
    expect(offers.some(({ augmentId }) => augmentId === "echo-circuit")).toBe(false);
    expect(offers.some(({ augmentId }) => augmentId === "reinforced-core")).toBe(true);
    expect(validateExpeditionAugmentChoice({ augmentId: "echo-circuit", eligibleTargetRelicIds: [] }, { augmentId: "echo-circuit" }, prior)).toBe(false);
  });

  it("후보 풀이 요청 수보다 작으면 더미 없이 가능한 후보만 결정적으로 표시한다", () => {
    const remaining = new Set(["field-repair", "formation-barrier"]);
    const prior = EXPEDITION_AUGMENTS.filter(({ rarity, id }) => rarity === "sr" && !remaining.has(id))
      .flatMap((def) => Array.from({ length: def.maxStacks }, () => ({ augmentId: def.id, ...(def.target === "relic" ? { targetRelicId: "anky" } : {}) })));
    const input = { rarity: "sr" as const, relics: party(), selections: prior, candidateCount: 3 };
    const first = generateExpeditionAugmentOffers({ ...input, random: expeditionRewardRandom("saved-prior") });
    const restored = generateExpeditionAugmentOffers({ ...input, selections: structuredClone(prior), random: expeditionRewardRandom("saved-prior") });
    expect(first).toEqual(restored);
    expect(first).toHaveLength(2);
    expect(new Set(first.map(({ augmentId }) => augmentId))).toEqual(remaining);
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
