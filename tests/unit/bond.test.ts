import { describe, expect, it } from "vitest";
import { BOND_LEVEL_CAP, BOND_TOTAL_XP_BY_LEVEL, bondStatPercent, bondLevelForXp, grantBondXp, grantDailyLobbyBondXp } from "../../src/core/bond";
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
  it("큰 보상도 유대 10레벨과 최대 누적 경험치를 넘지 않는다", () => {
    const result = grantBondXp(createInitialRelicProgress(), 99_999);
    expect(result.progress).toMatchObject({ bondLevel: BOND_LEVEL_CAP, bondXp: BOND_TOTAL_XP_BY_LEVEL[10] });
    expect(bondLevelForXp(BOND_TOTAL_XP_BY_LEVEL[10])).toBe(10);
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
