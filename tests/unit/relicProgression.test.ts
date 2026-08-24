import { describe, expect, it } from "vitest";
import { breakthroughBonus, BREAKTHROUGH_STEPS, calculateFinalStats, canBreakThrough, canFeedRelic, canLevelUpRelic, feedRelic, FEED_UNIT, levelUpRelic, nextBreakthrough, relicLevelCap, RELIC_LEVEL_CAP, RELIC_STAR_CAP, relicExpToNext, relicLevelUpCost, relicStars } from "../../src/core/relicProgression";
import type { RelicProgress, Stats } from "../../src/core/types";
import { RelicProgressionManager } from "../../src/managers/RelicProgressionManager";
import type { Session } from "../../src/state/session";
import { createRuneInstance, engraveRune, enhanceRune, type RuneInstance, type RuneStatKey } from "../../src/core/runes";
import { FakeServer } from "../../src/api/FakeServer";
import { createDefaultSettings } from "../../src/core/settings";

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
    settings: createDefaultSettings(),
    completedStoryIds: new Set(), observationRecords: [],
    selectedStageId: null, party: ["rex"], cleared: new Set(), owned: new Set(["rex"]), favorite: "rex", bookmarked: new Set<string>(),
    gachaPityByGroup: { "standard-fossil": { pullsSinceSsr: 0, pickupGuaranteed: false }, "limited-pickup": { pullsSinceSsr: 0, pickupGuaranteed: false } },
    // 보유 렐릭과 성장 레코드는 실제 저장 계약처럼 항상 한 쌍으로 구성한다.
    wallet: { fossil: 0, amber: 0, gems: 0, gold: 0, stamina: 0, dnaFragments: 0, cheesecake: 0 }, relicProgress: {
      rex: { level: 1, exp: 0, breakthrough: 0, bondLevel: 0, bondXp: 0, lastLobbyInteractionDate: "", heartGemSlots: [null, null, null] },
    }, relicFragments: {}, runeInventory: [testRune("vital-seed"), testRune("fang-core")],
    dailyContent: { date: "", restorationEntries: 0, completedIds: [], claimedRewardIds: [] },
    missions: { dailyKey: "", weeklyKey: "", progress: {}, claimedIds: [] },
    // 상품 테스트가 아닌 세션도 최신 저장 계약의 빈 구매 이력을 명시한다.
    productPurchases: {},
    // 테스트 계정은 광고 수령 이력이 없는 UTC 일일 상태로 시작한다.
    dailyAdRewards: { date: "", claimsBySlot: {}, requestIds: [] },
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
    // 별 둘(돌파 1단계)은 일반 공격 피해만 바꾸므로 능력치 수치는 그대로다.
    const early: RelicProgress = { level: 2, exp: 0, breakthrough: 1, bondLevel: 0, bondXp: 0, lastLobbyInteractionDate: "", heartGemSlots: ["vital-seed", null, null] };
    const rune = testRune("growth");
    // 101 → 레벨 2%(103) → 별 0%(103) → 룬 표의 HP 기본 8%(111) 순서다.
    expect(calculateFinalStats(BASE, early, [rune]).hp).toBe(111);

    // 셋째 돌파부터 15%가 붙는다. 103 → 별 15%(118) → Heart Gem 8%(127).
    const broken: RelicProgress = { ...early, breakthrough: 3 };
    expect(calculateFinalStats(BASE, broken, [rune]).hp).toBe(127);
  });

  it("룬 교체 계산은 렐릭 기본 객체를 변경하지 않고 실패 강화는 수치를 올리지 않는다", () => {
    const baseSnapshot = structuredClone(BASE);
    const rune = testRune("immutable");
    const failed = enhanceRune(rune, "hp", 999, 0.99);
    const progress: RelicProgress = { level: 1, exp: 0, breakthrough: 0, bondLevel: 0, bondXp: 0, lastLobbyInteractionDate: "", heartGemSlots: [rune.instanceId, null, null] };
    expect(calculateFinalStats(BASE, progress, [failed]).hp).toBe(calculateFinalStats(BASE, progress, [rune]).hp);
    expect(BASE).toEqual(baseSnapshot);
  });

  it("각인은 선택 옵션만 표의 강화 한 단계만큼 올린다", () => {
    let rune: RuneInstance = testRune("engraved");
    // 고급 룬은 두 주력 옵션에 세 번씩 시도하면 완료된다. 실패 난수로 일반 강화 증가는 배제한다.
    for (const key of ["hp", "atk"] as const) for (let attempt = 0; attempt < 3; attempt += 1) rune = enhanceRune(rune, key, 999, 0.99);
    const engraved = engraveRune(rune, { statKey: "hp", grade: "perfect", valueAdded: 999 });
    const progress: RelicProgress = { level: 1, exp: 0, breakthrough: 0, bondLevel: 0, bondXp: 0, lastLobbyInteractionDate: "", heartGemSlots: [rune.instanceId, null, null] };
    const before = calculateFinalStats(BASE, progress, [rune]);
    const after = calculateFinalStats(BASE, progress, [engraved]);
    expect(after.hp).toBeGreaterThan(before.hp);
    expect(after.atk).toBe(before.atk);
  });

  it("별 효과는 지금까지 뚫은 단계까지만 합쳐진다", () => {
    expect(breakthroughBonus(0)).toEqual({ statPercent: 0, basicDamage: 0, ultimateDamage: 0, readyUltimate: false });
    expect(breakthroughBonus(2)).toMatchObject({ basicDamage: 0.25, ultimateDamage: 0.25, statPercent: 0 });
    expect(breakthroughBonus(BREAKTHROUGH_STEPS.length)).toMatchObject({ statPercent: 15, readyUltimate: true });
  });

  it("별은 돌파 단계 + 1이고 모든 개체가 하나에서 시작한다", () => {
    const manager = new RelicProgressionManager(makeSession());
    expect(manager.getStars("rex")).toBe(1);
    expect(manager.getFragments("rex")).toBe(0);
    expect(relicStars(BREAKTHROUGH_STEPS.length)).toBe(RELIC_STAR_CAP);
    for (const invalid of [-1, BREAKTHROUGH_STEPS.length + 1, 2.5]) expect(() => relicStars(invalid)).toThrow(RangeError);
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
    expect(canBreakThrough(base(), step.fragments, step.cheesecake)).toBe(false); // 레벨이 상한에 못 미친다
    const maxed = { ...base(), level: RELIC_LEVEL_CAP };
    expect(canBreakThrough(maxed, step.fragments, step.cheesecake)).toBe(true);
    expect(canBreakThrough(maxed, step.fragments - 1, step.cheesecake)).toBe(false);
    expect(canBreakThrough(maxed, step.fragments, step.cheesecake - 1)).toBe(false);
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
