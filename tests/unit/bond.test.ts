import { describe, expect, it } from "vitest";
import { BOND_LEVEL_MAX, BOND_TOTAL_XP_BY_LEVEL, BOND_XP_MAX, bondAwakeningPoints, bondStatBonus, bondStatPercent, bondLevelForXp, bondXpToNext, grantBondXp, grantDailyLobbyBondXp, isValidBondAwakening, storyVictoryBondXp } from "../../src/core/bond";
import { createInitialRelicProgress } from "../../src/state/session";
import { calculateFinalStats } from "../../src/core/relicProgression";

/** Phaser나 저장소 없이 유대의 날짜·상한·능력치 몫 경계를 검증한다. */
describe("bond rules", () => {
  it("같은 UTC 날짜의 로비 상호작용은 경험치를 한 번만 지급한다", () => {
    const first = grantDailyLobbyBondXp(createInitialRelicProgress(), "2026-08-20");
    const repeated = grantDailyLobbyBondXp(first.progress, "2026-08-20");
    const tomorrow = grantDailyLobbyBondXp(repeated.progress, "2026-08-21");
    expect([first.xpGained, repeated.xpGained, tomorrow.xpGained]).toEqual([5, 0, 5]);
  });
  it("10레벨까지의 누적 경험치는 예전 표 그대로이고 11레벨부터 가파르게 오른다", () => {
    expect(BOND_TOTAL_XP_BY_LEVEL.slice(0, 11)).toEqual([0, 20, 50, 90, 140, 200, 270, 350, 440, 540, 650]);
    expect(bondXpToNext(10)).toBeGreaterThan(bondXpToNext(9));
    expect(bondXpToNext(20)).toBeGreaterThan(bondXpToNext(11) * 5);
    expect(bondLevelForXp(BOND_TOTAL_XP_BY_LEVEL[10])).toBe(10);
    expect(bondLevelForXp(BOND_TOTAL_XP_BY_LEVEL[25] - 1)).toBe(24);
  });
  it("큰 보상도 기록 끝을 넘지 않는다", () => {
    const result = grantBondXp(createInitialRelicProgress(), Number.MAX_SAFE_INTEGER);
    expect(result.progress).toMatchObject({ bondLevel: BOND_LEVEL_MAX, bondXp: BOND_XP_MAX });
  });
  it("스토리 승리 유대는 장마다 1씩 더 준다", () => {
    expect(storyVictoryBondXp(1)).toBe(12);
    expect(storyVictoryBondXp(9)).toBe(20);
  });
  it("유대 각성은 11~20레벨에 하나씩, 그 뒤 10레벨마다 하나씩 생긴다", () => {
    expect([0, 10, 11, 15, 20, 29, 30, 40, 55].map(bondAwakeningPoints)).toEqual([0, 0, 1, 5, 10, 10, 11, 12, 13]);
  });
  it("각성 배분은 가진 몫을 넘지 못하고 정수여야 한다", () => {
    expect(isValidBondAwakening(undefined, 0)).toBe(true);
    expect(isValidBondAwakening({ atk: 3, hp: 2 }, 15)).toBe(true);
    expect(isValidBondAwakening({ atk: 6 }, 15)).toBe(false);
    expect(isValidBondAwakening({ atk: 1.5 }, 15)).toBe(false);
    expect(isValidBondAwakening({ attackSpeed: 1 }, 15)).toBe(false);
    expect(isValidBondAwakening({ atk: -1 }, 15)).toBe(false);
  });
  it("각성 한 점은 고른 능력치 하나에 2%를 더한다", () => {
    expect(bondStatBonus({ bondLevel: 12, bondAwakening: { atk: 2 } })).toEqual({ hp: 10, def: 10, res: 10, atk: 14, ap: 10 });
  });
  it("유대 레벨마다 오각형 다섯을 1%씩 올리고 상한에서 멈춘다", () => {
    expect(bondStatPercent(0)).toBe(0);
    expect(bondStatPercent(1)).toBe(1);
    expect(bondStatPercent(10)).toBe(10);
    expect(bondStatPercent(99)).toBe(10);
  });
  it("유대 몫은 최종 능력치의 오각형 다섯에만 들고 공속·이속은 그대로다", () => {
    const base = { hp: 1000, def: 100, res: 100, atk: 200, ap: 200, attackSpeed: 1, moveSpeed: 100, critChance: 5, critDamage: 150, energyGain: 10, lifeSteal: 0, ferocityGain: 12 };
    const plain = calculateFinalStats(base, createInitialRelicProgress(), [], "R");
    const bonded = calculateFinalStats(base, { ...createInitialRelicProgress(), bondLevel: 10, bondXp: BOND_TOTAL_XP_BY_LEVEL[10] }, [], "R");
    expect(bonded.hp).toBe(Math.round(plain.hp * 1.1));
    expect(bonded.atk).toBe(Math.round(plain.atk * 1.1));
    expect(bonded.attackSpeed).toBe(plain.attackSpeed);
    expect(bonded.moveSpeed).toBe(plain.moveSpeed);
  });
});
