import { describe, expect, it } from "vitest";
import { awakeningBonus, BREAKTHROUGH_STEPS, calculateFinalStats, canBreakThrough, canFeedRelic, canLevelUpRelic, feedRelic, FEED_UNIT, levelUpRelic, nextBreakthrough, relicLevelCap, RELIC_LEVEL_CAP, relicExpToNext, relicLevelUpCost } from "../../src/core/relicProgression";
import type { RelicProgress, Stats } from "../../src/core/types";
import { getHeartGem } from "../../src/data/heartGems";
import { RelicProgressionManager } from "../../src/managers/RelicProgressionManager";
import type { Session } from "../../src/state/session";

/** 계산 순서를 쉽게 확인할 수 있도록 모든 능력치가 같은 테스트 기본값을 쓴다. */
const BASE: Stats = { hp: 101, def: 101, res: 101, atk: 101, ap: 101, attackSpeed: 101, moveSpeed: 101, critChance: 101, critDamage: 101, energyGain: 101 };

/** manager 검증 테스트마다 독립된 저장 상태를 만든다. */
function makeSession(): Session {
  return {
    completedStoryIds: new Set(),
    selectedStageId: null, party: ["rex"], cleared: new Set(), owned: new Set(["rex"]), favorite: "rex", bookmarked: new Set<string>(),
    gachaPityByGroup: { "standard-fossil": { pullsSinceSsr: 0, pickupGuaranteed: false }, "limited-pickup": { pullsSinceSsr: 0, pickupGuaranteed: false } },
    wallet: { fossil: 0, amber: 0, dnaFragments: 0, weeds: 0 }, relicProgress: {}, ownedHeartGemIds: ["vital-seed", "fang-core"],
    dailyContent: { date: "", restorationEntries: 0, completedIds: [], claimedRewardIds: [] },
    missions: { dailyKey: "", weeklyKey: "", progress: {}, claimedIds: [] },
    // 상품 테스트가 아닌 세션도 최신 저장 계약의 빈 구매 이력을 명시한다.
    productPurchases: {},
  };
}

describe("렐릭 성장 규칙", () => {
  it("현재 레벨 비용의 정확한 경계에서만 레벨업하고 원본을 변경하지 않는다", () => {
    const progress: RelicProgress = { level: 2, exp: 0, awakening: 0, breakthrough: 0, bondLevel: 0, bondXp: 0, lastLobbyInteractionDate: "", heartGemSlots: [null, null, null] };
    expect(relicLevelUpCost(2)).toBe(20);
    expect(canLevelUpRelic(progress, 19)).toBe(false);
    expect(levelUpRelic(progress, 20)).toMatchObject({ progress: { level: 3 }, weeds: 0, cost: 20 });
    expect(progress.level).toBe(2);
  });

  it("최대 레벨과 재화 부족에서는 성장 상태를 만들지 않는다", () => {
    const base: RelicProgress = { level: 1, exp: 0, awakening: 0, breakthrough: 0, bondLevel: 0, bondXp: 0, lastLobbyInteractionDate: "", heartGemSlots: [null, null, null] };
    expect(() => levelUpRelic(base, 9)).toThrow("잡초가 부족");
    expect(() => levelUpRelic({ ...base, level: RELIC_LEVEL_CAP }, 9999)).toThrow("최대 레벨");
  });
  it("기본 능력치에 레벨, 각성, Heart Gem 순으로 단계별 반올림해 적용한다", () => {
    // 각성은 3·4단계에서만 능력치를 올린다. 1단계는 일반 공격 피해만 바꾸므로 수치는 그대로다.
    const early: RelicProgress = { level: 2, exp: 0, awakening: 1, breakthrough: 0, bondLevel: 0, bondXp: 0, lastLobbyInteractionDate: "", heartGemSlots: ["vital-seed", null, null] };
    // 101 → 레벨 2%(103) → 각성 0%(103) → Heart Gem HP 10%(113) 순서다.
    expect(calculateFinalStats(BASE, early, [getHeartGem("vital-seed")]).hp).toBe(113);

    // 3단계부터 15%씩 붙는다. 103 → 각성 15%(118) → Heart Gem 10%(130).
    const awakened: RelicProgress = { ...early, awakening: 3 };
    expect(calculateFinalStats(BASE, awakened, [getHeartGem("vital-seed")]).hp).toBe(130);
  });

  it("각성 단계 효과는 열린 단계까지만 합쳐진다", () => {
    expect(awakeningBonus(0)).toEqual({ statPercent: 0, basicDamage: 0, ultimateDamage: 0, readyUltimate: false });
    expect(awakeningBonus(2)).toMatchObject({ basicDamage: 0.25, ultimateDamage: 0.25, statPercent: 0 });
    expect(awakeningBonus(5)).toMatchObject({ statPercent: 30, readyUltimate: true });
  });

  it("각성 단계의 0과 5는 허용하고 범위 밖과 소수는 거부한다", () => {
    const manager = new RelicProgressionManager(makeSession());
    expect(() => manager.setAwakening("rex", 0)).not.toThrow();
    expect(() => manager.setAwakening("rex", 5)).not.toThrow();
    for (const invalid of [-1, 6, 2.5]) expect(() => manager.setAwakening("rex", invalid)).toThrow(RangeError);
  });

  it("젬 한 칸만 갈아 끼우면 같은 젬이 있던 다른 칸은 비운다", () => {
    const manager = new RelicProgressionManager(makeSession());
    manager.setHeartGemSlots("rex", ["vital-seed", null, null]);
    manager.equipHeartGem("rex", 2, "vital-seed");
    expect(manager.getProgress("rex").heartGemSlots).toEqual([null, null, "vital-seed"]);
    manager.equipHeartGem("rex", 2, null);
    expect(manager.getProgress("rex").heartGemSlots).toEqual([null, null, null]);
  });

  it("Heart Gem은 정확히 3슬롯이며 빈 칸은 허용하되 중복과 미보유는 거부한다", () => {
    const state = makeSession();
    const manager = new RelicProgressionManager(state);
    manager.setHeartGemSlots("rex", ["vital-seed", null, "fang-core"]);
    expect(state.relicProgress.rex.heartGemSlots).toEqual(["vital-seed", null, "fang-core"]);
    expect(() => manager.setHeartGemSlots("rex", [null, null])).toThrow(RangeError);
    expect(() => manager.setHeartGemSlots("rex", ["vital-seed", "vital-seed", null])).toThrow(/중복/);
    expect(() => manager.setHeartGemSlots("rex", ["ancient-pulse", null, null])).toThrow(/보유하지 않은/);
  });

  it("성장 상태는 JSON 저장과 복원 뒤에도 3슬롯 형태를 유지한다", () => {
    const state = makeSession();
    new RelicProgressionManager(state).setHeartGemSlots("rex", [null, "fang-core", null]);
    const restored = JSON.parse(JSON.stringify(state.relicProgress)) as Session["relicProgress"];
    expect(restored.rex).toEqual({ level: 1, exp: 0, awakening: 0, breakthrough: 0, bondLevel: 0, bondXp: 0, lastLobbyInteractionDate: "", heartGemSlots: [null, "fang-core", null] });
    expect(restored.rex.heartGemSlots).toHaveLength(3);
  });
});

describe("급여", () => {
  const base = (): RelicProgress => ({ level: 1, exp: 0, awakening: 0, breakthrough: 0, bondLevel: 0, bondXp: 0, lastLobbyInteractionDate: "", heartGemSlots: [null, null, null] });

  it("는 잡초를 쓴 만큼만 경험치를 올리고 넘친 경험치는 다음 레벨로 이월한다", () => {
    // 레벨 1은 60 EXP가 필요하다. 한 번에 20씩 오르므로 네 번 먹이면 한 번 오르고 20이 남는다.
    expect(relicExpToNext(1)).toBe(60);
    const result = feedRelic(base(), 100, 4);
    expect(result).toMatchObject({ feeds: 4, weeds: 60, levelsGained: 1 });
    expect(result.progress).toMatchObject({ level: 2, exp: 20 });
  });

  it("는 잡초가 모자라면 가능한 횟수까지만 먹인다", () => {
    const result = feedRelic(base(), 25, 10);
    expect(result).toMatchObject({ feeds: 2, weeds: 5 });
  });

  it("는 최대 레벨에서 멈추고 잡초를 더 쓰지 않는다", () => {
    const maxed = { ...base(), level: RELIC_LEVEL_CAP };
    const result = feedRelic(maxed, 1000, 5);
    expect(result).toMatchObject({ feeds: 0, weeds: 1000, levelsGained: 0 });
    expect(canFeedRelic(maxed, 1000)).toBe(false);
  });

  it("는 잡초가 한 번치도 없으면 먹일 수 없다", () => {
    expect(canFeedRelic(base(), FEED_UNIT.weeds - 1)).toBe(false);
    expect(canFeedRelic(base(), FEED_UNIT.weeds)).toBe(true);
  });
});

describe("돌파", () => {
  const base = (): RelicProgress => ({ level: 1, exp: 0, awakening: 0, breakthrough: 0, bondLevel: 0, bondXp: 0, lastLobbyInteractionDate: "", heartGemSlots: [null, null, null] });

  it("는 단계마다 레벨 상한을 표대로 연다", () => {
    expect(relicLevelCap(0)).toBe(RELIC_LEVEL_CAP);
    expect(relicLevelCap(1)).toBe(BREAKTHROUGH_STEPS[0].levelCap);
    expect(relicLevelCap(BREAKTHROUGH_STEPS.length)).toBe(BREAKTHROUGH_STEPS[BREAKTHROUGH_STEPS.length - 1].levelCap);
    expect(() => relicLevelCap(BREAKTHROUGH_STEPS.length + 1)).toThrow(RangeError);
  });

  it("는 레벨을 상한까지 채우고 재료가 있어야 할 수 있다", () => {
    const step = nextBreakthrough(0)!;
    const wallet = { dnaFragments: step.dnaFragments, weeds: step.weeds };
    expect(canBreakThrough(base(), wallet)).toBe(false); // 레벨이 상한에 못 미친다
    const maxed = { ...base(), level: RELIC_LEVEL_CAP };
    expect(canBreakThrough(maxed, wallet)).toBe(true);
    expect(canBreakThrough(maxed, { ...wallet, dnaFragments: step.dnaFragments - 1 })).toBe(false);
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
