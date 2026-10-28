import { describe, expect, it } from "vitest";
import { battleBuffVisual, battleBuffProgress, battleBuffRemainingRatio, battleBuffTimingLabel } from "../../src/core/battleBuffPresentation";

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

  /** 계열·그림은 설명 문구가 아니라 코어 ID 머리로 고른다. */
  it("버프 계열과 그림을 코어 ID에서 고른다", () => {
    expect(battleBuffVisual({ id: "trait-haste:player-0" })).toMatchObject({ category: "speed", glyph: "haste" });
    expect(battleBuffVisual({ id: "trait-regen:player-0" })).toMatchObject({ category: "heal", glyph: "regen" });
    expect(battleBuffVisual({ id: "augment-guard:player-0" })).toMatchObject({ category: "defense", glyph: "guard" });
    expect(battleBuffVisual({ id: "augment-nth-basic:player-0" })).toMatchObject({ category: "attack", glyph: "counter" });
    expect(battleBuffVisual({ id: "augment-every-3:player-0" })).toMatchObject({ category: "attack", glyph: "counter" });
    // 렐릭 스킬이 건 버프는 그 스킬의 그림을 쓰고, 그림이 없을 때 설 문양을 함께 든다.
    expect(battleBuffVisual({ id: "hit-count:player-1" })).toEqual({ category: "attack", glyph: "skill", fallback: "counter" });
    expect(battleBuffVisual({ id: "luka-passive:player-0:player-2" })).toMatchObject({ category: "speed", glyph: "skill" });
    // 모르는 버프도 칩은 빠지지 않는다.
    expect(battleBuffVisual({ id: "something-new:player-0" })).toEqual({ category: "special", glyph: "skill", fallback: "special" });
  });
});
