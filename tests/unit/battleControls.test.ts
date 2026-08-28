import { describe, expect, it } from "vitest";
import { BATTLE_SPEEDS, nextBattleSpeed, ultimatePresentationSpeed } from "../../src/core/battleControls";

/** 배속 버튼이 허용된 세 단계 밖으로 벗어나지 않는지 검증한다. */
describe("전투 배속", () => {
  it("1배속에서 2·3배속을 거쳐 다시 1배속으로 순환한다", () => {
    expect(nextBattleSpeed(1)).toBe(2);
    expect(nextBattleSpeed(2)).toBe(3);
    expect(nextBattleSpeed(3)).toBe(1);
  });
});

describe("궁극기 연출 배속 몫", () => {
  it("1배속에서는 그대로이고 배속의 20%만 받아 빨라진다", () => {
    expect(ultimatePresentationSpeed(1)).toBe(1);
    expect(ultimatePresentationSpeed(2)).toBeCloseTo(1.2);
    expect(ultimatePresentationSpeed(3)).toBeCloseTo(1.4);
  });

  it("어떤 배속에서도 전투 진행보다 느리게 재생된다", () => {
    for (const speed of BATTLE_SPEEDS) expect(ultimatePresentationSpeed(speed)).toBeLessThanOrEqual(speed);
  });
});
