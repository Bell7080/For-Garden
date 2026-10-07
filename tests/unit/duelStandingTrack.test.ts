import { describe, expect, it } from "vitest";
import { duelGaugeRange, duelGaugeSteps } from "../../src/core/duelStandingTrack";

describe("결투 결과판의 점수 게이지 길", () => {
  it("같은 단계 안에서는 한 줄만 차오른다", () => {
    const steps = duelGaugeSteps(110, 130);
    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({ tierId: "bronze", division: 3, from: 0.1, to: 0.3 });
  });

  it("단계를 올라 넘으면 끝까지 찼다가 다음 줄이 0에서 시작한다", () => {
    const steps = duelGaugeSteps(390, 410);
    expect(steps.map((step) => [step.tierId, step.division, step.from, step.to])).toEqual([
      ["bronze", 1, 0.9, 1],
      ["silver", 4, 0, 0.1],
    ]);
  });

  it("내려 넘으면 비워졌다가 이전 줄이 끝에서 시작한다", () => {
    const steps = duelGaugeSteps(405, 385);
    expect(steps.map((step) => [step.tierId, step.division, step.from, step.to])).toEqual([
      ["silver", 4, 0.05, 0],
      ["bronze", 1, 1, 0.85],
    ]);
  });

  it("점수가 같으면 서 있는 줄 하나이고, 맨 위 티어는 가득 찬 채로 선다", () => {
    expect(duelGaugeSteps(50, 50)).toHaveLength(1);
    const top = duelGaugeSteps(2_900, 2_950);
    expect(top).toHaveLength(1);
    expect(top[0]).toMatchObject({ tierId: "challenger", top: true, from: 1, to: 1 });
    expect(duelGaugeRange(2_000)).toMatchObject({ tierId: "master", floor: 2_000, ceil: 2_400, top: false });
  });
});
