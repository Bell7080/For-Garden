import { describe, expect, it } from "vitest";
import { stepBattleScoreMotion } from "../../src/ui/battleScoreMotion";

describe("전투 중앙 점수 롤링", () => {
  it("는 목표를 넘지 않고 매 프레임 정수로 따라간다", () => {
    const first = stepBattleScoreMotion(0, 1_000, 16);
    expect(first.shown).toBeGreaterThan(0);
    expect(first.shown).toBeLessThanOrEqual(1_000);
    expect(Number.isInteger(first.shown)).toBe(true);
    expect(stepBattleScoreMotion(999, 1_000, 1_000).shown).toBe(1_000);
  });

  it("는 강한 공격일수록 더 크게 부풀되 HUD 안전 상한을 지킨다", () => {
    const weak = stepBattleScoreMotion(0, 10, 16);
    const strong = stepBattleScoreMotion(0, 100_000, 16);
    expect(strong.punch).toBeGreaterThan(weak.punch);
    expect(strong.punch).toBeLessThanOrEqual(0.28);
  });
});
