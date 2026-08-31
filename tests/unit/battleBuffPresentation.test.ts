import { describe, expect, it } from "vitest";
import { battleBuffEffectShape, battleBuffProgress, battleBuffRemainingRatio, battleBuffTimingLabel } from "../../src/core/battleBuffPresentation";

/** Phaser 없이 경계값과 조건부 오라의 의미를 고정해 렌더러가 가짜 시간을 만들지 못하게 한다. */
describe("전투 버프 진행 표시 모델", () => {
  it.each([
    [0, 10, 0],
    [5, 10, 0.5],
    [10, 10, 1],
  ])("남은 시간 %s / %s를 진행률 %s로 계산한다", (remaining, total, expected) => {
    expect(battleBuffRemainingRatio(remaining, total)).toBe(expected);
    expect(battleBuffProgress({ kind: "timed", remainingSeconds: remaining, totalSeconds: total })).toMatchObject({
      kind: "countdown", remainingRatio: expected, elapsedTurns: 1 - expected,
    });
  });

  it("야성 시간도 동일한 남은/전체 시간 공식과 팝업의 한 자리 초 표기를 쓴다", () => {
    const timing = { kind: "ferocity" as const, remainingSeconds: 5.04, totalSeconds: 10 };
    expect(battleBuffProgress(timing).remainingRatio).toBeCloseTo(0.504);
    expect(battleBuffTimingLabel(timing)).toBe("5.0초");
  });

  it("조건부 오라는 완전한 링과 실제 유지 조건을 사용한다", () => {
    expect(battleBuffProgress({ kind: "conditional" })).toEqual({
      kind: "conditional", remainingRatio: 1, elapsedTurns: 0, conditionLabel: "동일 표적 유지 중",
    });
    expect(battleBuffTimingLabel({ kind: "conditional" })).toBe("동일 표적 유지 중");
  });

  /** 색상과 독립적인 효과 실루엣이 안정적인 코어 ID로 선택되는지 고정한다. */
  it("효과 유형별 실루엣을 설명 문구와 무관하게 구분한다", () => {
    expect(battleBuffEffectShape({ id: "pack-hunt:a", skillId: "packHunt", timing: { kind: "conditional" } })).toBe("speed");
    expect(battleBuffEffectShape({ id: "crescendo-staccato:a", skillId: "crescendoStaccato", timing: { kind: "ferocity", remainingSeconds: 2, totalSeconds: 10 } })).toBe("attack");
    expect(battleBuffEffectShape({ id: "aura:a", skillId: "aura", timing: { kind: "permanent" } })).toBe("support");
  });
});
