import { describe, expect, it, vi } from "vitest";
import { calculateExpeditionNodeRewards, calculateExpeditionRunScore, expeditionRewardRandom, expeditionRewardRule, generateExpeditionAugmentOffers, validateExpeditionAugmentChoice } from "../../src/core/expeditionRewards";
import { calculateExpeditionNodeScore, expeditionBossDamageScore } from "../../src/core/expeditionScore";
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

  it("여러 확정 노드 점수와 폰토스 피해를 한 판 점수로 합산한다", () => {
    const first = calculateExpeditionNodeScore({ floor: 1, nodeType: "normal", remainingHpPercent: 90, cleared: true });
    const second = calculateExpeditionNodeScore({ floor: 2, nodeType: "normal", remainingHpPercent: 70, cleared: true });
    const score = calculateExpeditionRunScore({ normalNodeScoreTotal: first + second, bossDamageScore: 12_345 });
    expect(score).toEqual({ normalNodeScoreTotal: first + second, bossDamageScore: 12_345, runScore: first + second + 12_345 });
  });

  it("층·종류·잔여 HP 경계만으로 점수를 계산하고 재화 RNG를 입력받지 않는다", () => {
    // 1층 100%의 기준 점수는 190점이며 위험한 노드만 단일 밸런스 배율을 적용한다.
    expect(calculateExpeditionNodeScore({ floor: 1, nodeType: "normal", remainingHpPercent: 100, cleared: true })).toBe(190);
    expect(calculateExpeditionNodeScore({ floor: 2, nodeType: "elite", remainingHpPercent: 50, cleared: true })).toBe(233);
    expect(calculateExpeditionNodeScore({ floor: 2, nodeType: "horde", remainingHpPercent: 50, cleared: true })).toBe(194);
    expect(calculateExpeditionNodeScore({ floor: 20, nodeType: "boss", remainingHpPercent: 100, cleared: true })).toBe(0);
  });

  it("19층을 다 돌아도 노드 총점은 폰토스 피해 점수에 밀린다", () => {
    // 이 원정의 주 점수는 폰토스 타격이다. 지도를 끝까지 도는 것만으로 총점이 결정되면 누가
    // 얼마나 키웠든 모두 비슷한 점수로 마감한다 — 그 회귀를 수치로 고정한다.
    let nodeTotal = 0;
    for (let floor = 1; floor <= 19; floor += 1) {
      nodeTotal += calculateExpeditionNodeScore({ floor, nodeType: "normal", remainingHpPercent: 70, cleared: true });
    }
    // 원 피해 450점(레벨 1 3인 편성의 실측)만으로도 노드 총점의 아홉 배를 넘는다.
    expect(expeditionBossDamageScore(450)).toBeGreaterThan(nodeTotal * 9);
  });

  it("전멸·미클리어와 서버가 거부해야 할 HP·층 경계는 0점이다", () => {
    expect(calculateExpeditionNodeScore({ floor: 1, nodeType: "normal", remainingHpPercent: 0, cleared: false })).toBe(0);
    expect(calculateExpeditionNodeScore({ floor: 1, nodeType: "normal", remainingHpPercent: 101, cleared: true })).toBe(0);
    expect(calculateExpeditionNodeScore({ floor: 0, nodeType: "normal", remainingHpPercent: 100, cleared: true })).toBe(0);
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
