import { describe, expect, it } from "vitest";
import { GREAT_SUCCESS, greatSuccessBonus, greatSuccessPulses, rollGreatSuccess, rollGreatSuccessCount } from "../../src/core/greatSuccess";

describe("대성공 규칙", () => {
  it("확률 10% · 배율 1.5배 — 2배 승인선 아래에서 기대 공급량을 +5%만 올린다", () => {
    expect(GREAT_SUCCESS.chance).toBe(0.1);
    expect(GREAT_SUCCESS.multiplier).toBeLessThan(2);
    expect(GREAT_SUCCESS.chance * (GREAT_SUCCESS.multiplier - 1)).toBeCloseTo(0.05);
  });

  it("난수가 확률 아래면 대성공이다", () => {
    expect(rollGreatSuccess(() => 0.05)).toBe(true);
    expect(rollGreatSuccess(() => 0.1)).toBe(false);
  });

  it("판마다 한 번씩 굴린다", () => {
    const rolls = [0.01, 0.5, 0.09, 0.99];
    let index = 0;
    expect(rollGreatSuccessCount(4, () => rolls[index++]!)).toBe(2);
    expect(index).toBe(4);
  });

  it("얹히는 몫은 한 판 보상의 절반을 내림해 판 수만큼 — 0인 재화는 싣지 않는다", () => {
    expect(greatSuccessBonus({ gold: 1001, cheesecake: 1, gems: 0 }, 3)).toEqual({ gold: 1500 });
    expect(greatSuccessBonus({ gold: 1000 }, 0)).toEqual({});
  });

  it("맥동은 다섯 번에서 멈춘다", () => {
    expect(greatSuccessPulses(0)).toBe(0);
    expect(greatSuccessPulses(3)).toBe(3);
    expect(greatSuccessPulses(12)).toBe(5);
  });
});
