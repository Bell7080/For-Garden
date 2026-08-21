import { describe, expect, it } from "vitest";
import { nextBattleSpeed } from "../../src/core/battleControls";

/** 배속 버튼이 허용된 세 단계 밖으로 벗어나지 않는지 검증한다. */
describe("전투 배속", () => {
  it("1배속에서 2·3배속을 거쳐 다시 1배속으로 순환한다", () => {
    expect(nextBattleSpeed(1)).toBe(2);
    expect(nextBattleSpeed(2)).toBe(3);
    expect(nextBattleSpeed(3)).toBe(1);
  });
});
