import { describe, expect, it } from "vitest";
import { BOND_LEVEL_CAP, BOND_TOTAL_XP_BY_LEVEL, attenuateFerocityGain, bondLevelForXp, grantBondXp, grantDailyLobbyBondXp } from "../../src/core/bond";
import { createInitialRelicProgress } from "../../src/state/session";

/** Phaser나 저장소 없이 유대의 날짜·상한·감쇠 경계를 검증한다. */
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
  it("정적 레벨 효과표에 따라 야성 증가를 감쇠한다", () => {
    expect(attenuateFerocityGain(20, 0)).toBe(20);
    expect(attenuateFerocityGain(20, 10)).toBe(10);
  });
});
