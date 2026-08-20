import { describe, expect, it } from "vitest";
import { calculateFinalStats } from "../../src/core/relicProgression";
import type { RelicProgress, Stats } from "../../src/core/types";
import { getHeartGem } from "../../src/data/heartGems";
import { RelicProgressionManager } from "../../src/managers/RelicProgressionManager";
import type { Session } from "../../src/state/session";

/** 계산 순서를 쉽게 확인할 수 있도록 모든 능력치가 같은 테스트 기본값을 쓴다. */
const BASE: Stats = { hp: 101, def: 101, res: 101, atk: 101, ap: 101, attackSpeed: 101, moveSpeed: 101, critChance: 101, critDamage: 101, ferocity: 101 };

/** manager 검증 테스트마다 독립된 저장 상태를 만든다. */
function makeSession(): Session {
  return {
    selectedStageId: null, party: ["rex"], cleared: new Set(), owned: new Set(["rex"]), favorite: "rex",
    wallet: { fossil: 0, amber: 0 }, relicProgress: {}, ownedHeartGemIds: ["vital-seed", "fang-core"],
    dailyContent: { date: "", completedIds: [], claimedRewardIds: [] },
  };
}

describe("렐릭 성장 규칙", () => {
  it("기본 능력치에 레벨, DNA, Heart Gem 순으로 단계별 반올림해 적용한다", () => {
    const progress: RelicProgress = { level: 2, levelTitle: "발아체", dnaMastery: 1, heartGemSlots: ["vital-seed", null, null] };
    // 101 → 레벨 2%(103) → DNA 3%(106) → Heart Gem HP 10%(117) 순서다.
    expect(calculateFinalStats(BASE, progress, [getHeartGem("vital-seed")]).hp).toBe(117);
  });

  it("DNA 숙련도의 0과 5는 허용하고 범위 밖과 소수는 거부한다", () => {
    const manager = new RelicProgressionManager(makeSession());
    expect(() => manager.setDnaMastery("rex", 0)).not.toThrow();
    expect(() => manager.setDnaMastery("rex", 5)).not.toThrow();
    for (const invalid of [-1, 6, 2.5]) expect(() => manager.setDnaMastery("rex", invalid)).toThrow(RangeError);
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
    expect(restored.rex).toEqual({ level: 1, levelTitle: "복원체", dnaMastery: 0, heartGemSlots: [null, "fang-core", null] });
    expect(restored.rex.heartGemSlots).toHaveLength(3);
  });
});
