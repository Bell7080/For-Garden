import { describe, expect, it } from "vitest";
import { breakthroughFragmentCost, breakthroughSlotGrade, BREAKTHROUGH_STEPS, calculateFinalStats, canBreakThrough, isBreakthroughSlotOpen, openedBreakthroughSlots, canFeedRelic, canLevelUpRelic, feedRelic, FEED_UNIT, levelUpRelic, nextBreakthrough, relicLevelCap, RELIC_LEVEL_CAP, BREAKTHROUGH_GRADE_CAP, relicExpToNext, relicLevelUpCost, breakthroughGrade, isGrowthReachable, BREAKTHROUGH_CAP } from "../../src/core/relicProgression";
import { combatPower } from "../../src/core/combatPower";
import type { RelicProgress, Stats } from "../../src/core/types";
import { RelicProgressionManager } from "../../src/managers/RelicProgressionManager";
import { createEmptyRaidState, createInitialPlayerResearchProgress, type Session } from "../../src/state/session";
import { createRuneInstance, engraveRune, enhanceRune, type RuneInstance, type RuneStatKey } from "../../src/core/runes";
import { FakeServer } from "../../src/api/FakeServer";
import { createDefaultSettings } from "../../src/core/settings";
import { createArchaeologyState } from "../../src/core/strataDig";

/** 계산 순서를 쉽게 확인할 수 있도록 모든 능력치가 같은 테스트 기본값을 쓴다. */
const BASE: Stats = { hp: 101, def: 101, res: 101, atk: 101, ap: 101, attackSpeed: 101, moveSpeed: 101, critChance: 101, critDamage: 101, energyGain: 101, lifeSteal: 0, ferocityGain: 0 };


/** 장착 테스트에서 정적 정의 ID와 인스턴스 ID가 우연히 같다고 가정하지 않게 룬을 만든다. */
function testRune(instanceId: string) {
  const values = Object.fromEntries(["hp", "atk", "ap", "def", "res", "moveSpeed", "attackSpeed", "lifeSteal", "critChance", "critDamage", "ferocityGain", "energyGain"].map((key) => [key, 1])) as Record<RuneStatKey, number>;
  return createRuneInstance({ instanceId, baseName: instanceId, rarity: "uncommon", part: 0, statValues: values, random: () => 0 });
}

/** manager 검증 테스트마다 독립된 저장 상태를 만든다. */
function makeSession(): Session {
  return {
    // 이 테스트는 추가 외형을 다루지 않으므로 소유·장착 상태를 비워 둔다.
    ownedRelicSkinIds: new Set(), equippedRelicSkinIds: {},
    discoveredInteractionJournalIds: new Set(), readInteractionJournalIds: new Set(),
    // 교류와 무관한 테스트는 비어 있는 서버 파견 슬롯을 사용한다.
    interaction: { slots: [null], claimedRequestIds: [] },
    // 수식어 manager 테스트가 아닌 세션은 빈 ID 목록을 명시한다.
    earnedProfileModifierIds: [], equippedProfileModifierIds: [],
    playerResearch: createInitialPlayerResearchProgress(),
    // 성장 테스트용 세션에도 직렬화 가능한 기본 발굴 상태를 둔다.
    idleExcavation: { assignedRelicIds: [null, null, null], lastSettledAt: null, unclaimed: { gold: 0, cheesecake: 0, fossil: 0, gems: 0 }, baseStorageSeconds: 14_400, activeProductionMultiplier: 1, storageExtensionExpiresAt: null, retroactiveExcavationGrantVersion: 1 },
    archaeology: createArchaeologyState(),
    settings: createDefaultSettings(),
    completedStoryIds: new Set(), observationRecords: [],
    selectedStageId: null, party: ["rex"], cleared: new Set(), owned: new Set(["rex"]), favorite: "rex", bookmarked: new Set<string>(),
    gachaPityByGroup: { "standard-fossil": { pullsSinceSsr: 0, pickupGuaranteed: false }, "limited-pickup": { pullsSinceSsr: 0, pickupGuaranteed: false } },
    // 보유 렐릭과 성장 레코드는 실제 저장 계약처럼 항상 한 쌍으로 구성한다.
    staminaUpdatedAt: "",
    wallet: { fossil: 0, amber: 0, gems: 0, gold: 0, stamina: 0, dnaFragments: 0, cheesecake: 0 , rawStone: 0}, relicProgress: {
      rex: { level: 1, exp: 0, breakthrough: 0, bondLevel: 0, bondXp: 0, lastLobbyInteractionDate: "", heartGemSlots: [null, null, null] },
    }, relicFragments: {}, itemInventory: [], runeInventory: [testRune("vital-seed"), testRune("fang-core")],
    dailyContent: { date: "", restorationEntries: 0, completedIds: [], claimedRewardIds: [] },
    bounty: { date: "", entries: 0, clearedTierIds: [] },
    missions: { dailyKey: "", weeklyKey: "", progress: {}, claimedIds: [], researchPoints: { daily: 0, weekly: 0 }, claimedResearchStageIds: [] },
    // 상품 테스트가 아닌 세션도 최신 저장 계약의 빈 구매 이력을 명시한다.
    productPurchases: {},
    // 테스트 계정은 광고 수령 이력이 없는 UTC 일일 상태로 시작한다.
    dailyAdRewards: { date: "", claimsBySlot: {}, requestIds: [] },
    // 성장 테스트는 원정 진행과 독립된 빈 상태를 사용한다.
    expedition: { weekKey: "", playsThisWeek: 0, bestScore: 0, allTimeBestScore: 0, lastParty: [], run: null },
    raid: createEmptyRaidState(),
    cakeOperation: { clearedIndex: -1 },
  };
}

describe("렐릭 성장 규칙", () => {
  it("현재 레벨 비용의 정확한 경계에서만 레벨업하고 원본을 변경하지 않는다", () => {
    const progress: RelicProgress = { level: 2, exp: 0, breakthrough: 0, bondLevel: 0, bondXp: 0, lastLobbyInteractionDate: "", heartGemSlots: [null, null, null] };
    expect(relicLevelUpCost(2)).toBe(20);
    expect(canLevelUpRelic(progress, 19)).toBe(false);
    expect(levelUpRelic(progress, 20)).toMatchObject({ progress: { level: 3 }, cheesecake: 0, cost: 20 });
    expect(progress.level).toBe(2);
  });

  it("최대 레벨과 재화 부족에서는 성장 상태를 만들지 않는다", () => {
    const base: RelicProgress = { level: 1, exp: 0, breakthrough: 0, bondLevel: 0, bondXp: 0, lastLobbyInteractionDate: "", heartGemSlots: [null, null, null] };
    expect(() => levelUpRelic(base, 9)).toThrow("치즈케이크가 부족");
    expect(() => levelUpRelic({ ...base, level: RELIC_LEVEL_CAP }, 9999)).toThrow("최대 레벨");
  });
  it("기본 능력치에 레벨, 별, Heart Gem 순으로 단계별 반올림해 적용한다", () => {
    const early: RelicProgress = { level: 2, exp: 0, breakthrough: 1, bondLevel: 0, bondXp: 0, lastLobbyInteractionDate: "", heartGemSlots: ["vital-seed", null, null] };
    const rune = testRune("growth");
    // 101 → 레벨 2%(103) → 별 0%(103) → 룬 표의 HP 기본 8%(111) 순서다.
    expect(calculateFinalStats(BASE, early, [rune], "SR").hp).toBe(111);

    // **돌파는 능력치를 올리지 않는다.** 셋째 돌파에 모든 능력치 15%가 달려 있던 동안에는
    // 어느 개체를 뚫어도 같은 숫자가 올라, 그 개체를 끝까지 키운 이유를 말하지 못했다.
    const broken: RelicProgress = { ...early, breakthrough: 3 };
    expect(calculateFinalStats(BASE, broken, [rune], "SR").hp).toBe(111);
  });

  it("룬 교체 계산은 렐릭 기본 객체를 변경하지 않고 실패 강화는 수치를 올리지 않는다", () => {
    const baseSnapshot = structuredClone(BASE);
    const rune = testRune("immutable");
    const failed = enhanceRune(rune, "hp", 999, 0.99);
    const progress: RelicProgress = { level: 1, exp: 0, breakthrough: 0, bondLevel: 0, bondXp: 0, lastLobbyInteractionDate: "", heartGemSlots: [rune.instanceId, null, null] };
    expect(calculateFinalStats(BASE, progress, [failed], "SR").hp).toBe(calculateFinalStats(BASE, progress, [rune], "SR").hp);
    expect(BASE).toEqual(baseSnapshot);
  });

  it("각인은 선택 옵션만 표의 강화 한 단계만큼 올린다", () => {
    let rune: RuneInstance = testRune("engraved");
    // 고급 룬은 두 주력 옵션에 세 번씩 시도하면 완료된다. 실패 난수로 일반 강화 증가는 배제한다.
    for (const key of ["hp", "atk"] as const) for (let attempt = 0; attempt < 3; attempt += 1) rune = enhanceRune(rune, key, 999, 0.99);
    const engraved = engraveRune(rune, { statKey: "hp", grade: "perfect", valueAdded: 999 });
    const progress: RelicProgress = { level: 1, exp: 0, breakthrough: 0, bondLevel: 0, bondXp: 0, lastLobbyInteractionDate: "", heartGemSlots: [rune.instanceId, null, null] };
    const before = calculateFinalStats(BASE, progress, [rune], "SR");
    const after = calculateFinalStats(BASE, progress, [engraved], "SR");
    expect(after.hp).toBeGreaterThan(before.hp);
    expect(after.atk).toBe(before.atk);
  });

  it("단계가 여는 것은 상한과 슬롯뿐이고 공용 배율은 남아 있지 않다", () => {
    // 한때 단계마다 `basicDamage`·`ultimateDamage`·`statPercent`·`readyUltimate`가 달려 있었다.
    // 그 공용 배율이 도는 동안에는 다섯 등급에 닿은 개체가 종류를 가리지 않고 전투를 궁극기가
    // 찬 채로 시작했고(토리카가 그랬다), 개체 전용 효과가 말하려던 것을 그 공짜 한 방이 덮었다.
    for (const step of BREAKTHROUGH_STEPS) {
      expect(Object.keys(step).sort()).toEqual(["cheesecake", "levelCap", "slot"]);
    }
    // 능력치도 단계가 직접 올리지 않는다 — 돌파가 바꾸는 것은 `breakthroughEffects`뿐이다.
    const plain: RelicProgress = { level: 1, exp: 0, breakthrough: 0, bondLevel: 0, bondXp: 0, lastLobbyInteractionDate: "", heartGemSlots: [null, null, null] };
    expect(calculateFinalStats(BASE, { ...plain, breakthrough: BREAKTHROUGH_STEPS.length }, [], "SR"))
      .toEqual(calculateFinalStats(BASE, plain, [], "SR"));
  });

  it("별은 돌파 단계 + 1이고 모든 개체가 하나에서 시작한다", () => {
    const manager = new RelicProgressionManager(makeSession());
    expect(manager.getBreakthroughGrade("rex")).toBe(1);
    expect(manager.getFragments("rex")).toBe(0);
    expect(breakthroughGrade(BREAKTHROUGH_STEPS.length)).toBe(BREAKTHROUGH_GRADE_CAP);
    for (const invalid of [-1, BREAKTHROUGH_STEPS.length + 1, 2.5]) expect(() => breakthroughGrade(invalid)).toThrow(RangeError);
  });

  it("장착과 해제는 API 응답의 전체 장착표를 세션에 적용한다", async () => {
    const state = makeSession();
    const manager = new RelicProgressionManager(state);
    const api = new FakeServer(state, { latencyMs: 0 });
    // 테스트 룬은 모두 0번 조각이므로 0번 칸에만 들어간다. 자리 규칙은 서버가 지킨다.
    await expect(manager.equipRune("rex", 1, "fang-core", api)).rejects.toMatchObject({ code: "RUNE_SLOT_MISMATCH" });
    await manager.equipRune("rex", 0, "fang-core", api);
    expect(state.relicProgress.rex.heartGemSlots).toEqual(["fang-core", null, null]);
    await manager.unequipRune("rex", 0, api);
    expect(state.relicProgress.rex.heartGemSlots).toEqual([null, null, null]);
  });
});

describe("급여", () => {
  const base = (): RelicProgress => ({ level: 1, exp: 0, breakthrough: 0, bondLevel: 0, bondXp: 0, lastLobbyInteractionDate: "", heartGemSlots: [null, null, null] });

  it("는 치즈케이크를 쓴 만큼만 경험치를 올리고 넘친 경험치는 다음 레벨로 이월한다", () => {
    // 레벨 1은 60 EXP가 필요하다. 한 번에 20씩 오르므로 네 번 먹이면 한 번 오르고 20이 남는다.
    expect(relicExpToNext(1)).toBe(60);
    const result = feedRelic(base(), 100, 4);
    expect(result).toMatchObject({ feeds: 4, cheesecake: 60, levelsGained: 1 });
    expect(result.progress).toMatchObject({ level: 2, exp: 20 });
  });

  it("는 한 번 급여가 경계 경험치를 넘으면 서버 계산 결과에서 정확히 한 레벨 오른다", () => {
    // UI가 레벨을 추측해 올리지 않도록, 단 한 번의 급여로 경계를 넘는 순수 API 규칙을 고정한다.
    const result = feedRelic({ ...base(), exp: relicExpToNext(1) - FEED_UNIT.exp }, FEED_UNIT.cheesecake, 1);
    expect(result).toMatchObject({ feeds: 1, cheesecake: 0, levelsGained: 1 });
    expect(result.progress).toMatchObject({ level: 2, exp: 0 });
  });

  it("는 치즈케이크가 모자라면 가능한 횟수까지만 먹인다", () => {
    const result = feedRelic(base(), 25, 10);
    expect(result).toMatchObject({ feeds: 2, cheesecake: 5 });
  });

  it("는 최대 레벨에서 멈추고 치즈케이크를 더 쓰지 않는다", () => {
    const maxed = { ...base(), level: RELIC_LEVEL_CAP };
    const result = feedRelic(maxed, 1000, 5);
    expect(result).toMatchObject({ feeds: 0, cheesecake: 1000, levelsGained: 0 });
    expect(canFeedRelic(maxed, 1000)).toBe(false);
  });

  it("는 치즈케이크가 한 번치도 없으면 먹일 수 없다", () => {
    expect(canFeedRelic(base(), FEED_UNIT.cheesecake - 1)).toBe(false);
    expect(canFeedRelic(base(), FEED_UNIT.cheesecake)).toBe(true);
  });
});

describe("돌파", () => {
  const base = (): RelicProgress => ({ level: 1, exp: 0, breakthrough: 0, bondLevel: 0, bondXp: 0, lastLobbyInteractionDate: "", heartGemSlots: [null, null, null] });

  it("는 단계마다 레벨 상한을 표대로 연다", () => {
    expect(relicLevelCap(0)).toBe(RELIC_LEVEL_CAP);
    expect(relicLevelCap(1)).toBe(BREAKTHROUGH_STEPS[0].levelCap);
    expect(relicLevelCap(BREAKTHROUGH_STEPS.length)).toBe(BREAKTHROUGH_STEPS[BREAKTHROUGH_STEPS.length - 1].levelCap);
    expect(() => relicLevelCap(BREAKTHROUGH_STEPS.length + 1)).toThrow(RangeError);
  });

  it("는 레벨을 상한까지 채우고 그 개체의 파편이 있어야 할 수 있다", () => {
    const step = nextBreakthrough(0)!;
    const need = breakthroughFragmentCost("SR", 0);
    expect(canBreakThrough("SR", base(), need, step.cheesecake)).toBe(false); // 레벨이 상한에 못 미친다
    const maxed = { ...base(), level: RELIC_LEVEL_CAP };
    expect(canBreakThrough("SR", maxed, need, step.cheesecake)).toBe(true);
    expect(canBreakThrough("SR", maxed, need - 1, step.cheesecake)).toBe(false);
    expect(canBreakThrough("SR", maxed, need, step.cheesecake - 1)).toBe(false);
  });

  it("는 파편 수를 등급이 정하고 마지막 별만 더 든다", () => {
    // 같은 개체를 다시 만나는 빈도가 등급마다 다르므로 파편 수도 등급이 정한다.
    expect(breakthroughFragmentCost("SSR", 0)).toBeLessThan(breakthroughFragmentCost("SR", 0));
    expect(breakthroughFragmentCost("SR", 0)).toBeLessThan(breakthroughFragmentCost("R", 0));
    for (const rarity of ["SSR", "SR", "R"] as const) {
      const last = BREAKTHROUGH_STEPS.length - 1;
      for (let step = 0; step < last; step += 1) {
        expect(breakthroughFragmentCost(rarity, step)).toBe(breakthroughFragmentCost(rarity, 0));
      }
      expect(breakthroughFragmentCost(rarity, last)).toBeGreaterThan(breakthroughFragmentCost(rarity, 0));
    }
    // 치즈케이크도 같은 이유로 단계마다 오른다.
    for (let step = 1; step < BREAKTHROUGH_STEPS.length; step += 1) {
      expect(BREAKTHROUGH_STEPS[step].cheesecake).toBeGreaterThan(BREAKTHROUGH_STEPS[step - 1].cheesecake);
    }
    // SSR 한 장으로 뚫리는 등급이라도 마지막 별은 두 장이 필요하다.
    expect(canBreakThrough("SSR", { ...base(), level: relicLevelCap(3), breakthrough: 3 }, 1, 99_999)).toBe(false);
    expect(canBreakThrough("SSR", { ...base(), level: relicLevelCap(3), breakthrough: 3 }, 2, 99_999)).toBe(true);
  });

  it("는 별마다 다른 슬롯을 열고 순서가 손에 닿는 것부터다", () => {
    expect(BREAKTHROUGH_STEPS.map((step) => step.slot)).toEqual(["basic", "ultimate", "ferocity", "passive"]);
    expect(openedBreakthroughSlots(0)).toEqual([]);
    expect(openedBreakthroughSlots(2)).toEqual(["basic", "ultimate"]);
    expect(isBreakthroughSlotOpen(1, "basic")).toBe(true);
    expect(isBreakthroughSlotOpen(1, "ultimate")).toBe(false);
    expect(isBreakthroughSlotOpen(BREAKTHROUGH_STEPS.length, "passive")).toBe(true);
    // 별 둘이 첫 슬롯을 연다. 표의 첫 줄이 곧 "별 둘로 가는 길"이다.
    expect(breakthroughSlotGrade("basic")).toBe(2);
    expect(breakthroughSlotGrade("passive")).toBe(BREAKTHROUGH_GRADE_CAP);
  });

  it("뒤에는 열린 상한까지 다시 급여할 수 있다", () => {
    const maxed = { ...base(), level: RELIC_LEVEL_CAP };
    expect(canFeedRelic(maxed, 999)).toBe(false);
    expect(canFeedRelic({ ...maxed, breakthrough: 1 }, 999)).toBe(true);
    // 20레벨의 다음 단계는 440 EXP다. 한 번에 20씩 오르므로 스물두 번은 먹여야 한 칸 오른다.
    const fed = feedRelic({ ...maxed, breakthrough: 1 }, 9999, 25);
    expect(fed.progress.level).toBeGreaterThan(RELIC_LEVEL_CAP);
    expect(fed.progress.level).toBeLessThanOrEqual(relicLevelCap(1));
  });
});

describe("전투력", () => {
  it("은 능력치가 오르면 함께 오르고 같은 능력치에는 늘 같은 수를 준다", () => {
    const weak = combatPower(BASE);
    expect(weak).toBe(combatPower({ ...BASE }));
    expect(combatPower({ ...BASE, atk: BASE.atk + 100 })).toBeGreaterThan(weak);
    // 체력 한 점은 공격 한 점보다 가볍다. 수가 큰 능력치가 전투력을 통째로 지배하지 않는다.
    expect(combatPower({ ...BASE, hp: BASE.hp + 10 })).toBeLessThan(combatPower({ ...BASE, atk: BASE.atk + 10 }));
  });
});

/*
 * **화면이 만들 수 없는 성장을 가르치지 않는다.**
 *
 * 돌파는 레벨 상한을 채운 뒤에만 뚫린다(`canBreakThrough`). 그러니 레벨 10에 돌파 1은 어느
 * 손으로도 만들 수 없는 값이고, 적도 플레이어와 같은 성장 축만 쓰므로 같은 규칙을 지나야 한다.
 */
describe("도달 가능한 성장 자리", () => {
  it("은 상한을 채우지 않은 돌파를 거부한다", () => {
    expect(isGrowthReachable(1, 0)).toBe(true);
    expect(isGrowthReachable(RELIC_LEVEL_CAP, 0)).toBe(true);
    // 상한 20을 넘긴 레벨은 돌파 없이는 설 수 없다.
    expect(isGrowthReachable(RELIC_LEVEL_CAP + 1, 0)).toBe(false);
    // 돌파 1은 20레벨을 한 번 찍은 개체만 갖는다. 10레벨 돌파 1은 만들 수 없다.
    expect(isGrowthReachable(10, 1)).toBe(false);
    expect(isGrowthReachable(RELIC_LEVEL_CAP, 1)).toBe(true);
    expect(isGrowthReachable(relicLevelCap(1), 1)).toBe(true);
    expect(isGrowthReachable(relicLevelCap(1) + 1, 1)).toBe(false);
    // 직전 단계의 상한이 곧 하한이다 — 돌파해도 레벨은 그대로이므로.
    expect(isGrowthReachable(relicLevelCap(1) - 1, 2)).toBe(false);
    expect(isGrowthReachable(relicLevelCap(1), 2)).toBe(true);
  });

  it("은 범위를 벗어난 값을 던지지 않고 거짓으로 돌려준다", () => {
    // 검수 목록을 만드는 자리라 한 줄이 던지면 나머지 관문을 보지 못한다.
    expect(isGrowthReachable(0, 0)).toBe(false);
    expect(isGrowthReachable(1.5, 0)).toBe(false);
    expect(isGrowthReachable(1, -1)).toBe(false);
    expect(isGrowthReachable(1, BREAKTHROUGH_CAP + 1)).toBe(false);
  });
});
