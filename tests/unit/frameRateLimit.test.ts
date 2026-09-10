import { describe, expect, it } from "vitest";
import { FRAME_LIMIT_MARGIN, frameLimitRate } from "../../src/config/gameConfig";

/**
 * Phaser `TimeStep.stepLimitFPS`가 하는 일만 그대로 세운 대역이다.
 *
 * 매 rAF마다 평탄화된 delta를 누적하고, 누적값이 경계 **이상**일 때만 콜백을 부른 뒤 0으로
 * 되돌린다. 평탄화는 최근 열 프레임의 평균이라 이상적인 주사율에서는 그 주사율의 간격이 그대로
 * 나오지만, `1000/60`을 열 번 더해 나눈 값은 `1000/60`보다 아주 조금 **작다**.
 */
function drawnFramesPerSecond(refreshHz: number, limitRate: number, frames = 600): number {
  const history = new Array<number>(10).fill(1000 / refreshHz);
  let index = 0;
  let accumulated = 0;
  let drawn = 0;
  for (let frame = 0; frame < frames; frame += 1) {
    history[index] = 1000 / refreshHz;
    index = (index + 1) % history.length;
    accumulated += history.reduce((sum, value) => sum + value, 0) / history.length;
    if (accumulated >= limitRate) {
      drawn += 1;
      accumulated = 0;
    }
  }
  return (drawn / frames) * refreshHz;
}

describe("프레임 제한 경계", () => {
  it("1000/limit를 그대로 쓰면 60Hz에서 프레임이 절반으로 깎인다", () => {
    // 이 테스트는 고친 값이 아니라 **고치기 전 값**을 세워 둔다. 누가 다시 1000/limit로 되돌리면
    // 어떤 일이 벌어지는지가 여기 남아 있어야 한다(v0.83.0의 실제 증상이다).
    expect(drawnFramesPerSecond(60, 1000 / 60)).toBeCloseTo(30, 0);
    expect(drawnFramesPerSecond(60, 1000 / 30)).toBeCloseTo(20, 0);
  });

  it("60 제한은 60Hz에서 매 프레임을 그리고 120Hz에서만 절반을 거른다", () => {
    expect(drawnFramesPerSecond(60, frameLimitRate(60))).toBeCloseTo(60, 0);
    expect(drawnFramesPerSecond(120, frameLimitRate(60))).toBeCloseTo(60, 0);
  });

  it("30 제한은 두 주사율 모두에서 30fps로 내려간다", () => {
    expect(drawnFramesPerSecond(60, frameLimitRate(30))).toBeCloseTo(30, 0);
    expect(drawnFramesPerSecond(120, frameLimitRate(30))).toBeCloseTo(30, 0);
  });

  it("여유는 0.5보다 커야 제한이 제 구실을 한다", () => {
    // 0.5 이하로 내리면 주사율이 제한의 두 배인 기기에서 매 프레임이 통과해 제한이 사라진다.
    expect(FRAME_LIMIT_MARGIN).toBeGreaterThan(0.5);
    expect(FRAME_LIMIT_MARGIN).toBeLessThan(1);
  });
});
