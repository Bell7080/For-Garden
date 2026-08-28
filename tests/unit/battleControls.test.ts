import { describe, expect, it } from "vitest";
import {
  nextBattleSpeed, scaleUltimateDuration, shouldWaitForUltimatePresentation, ultimatePresentationTiming,
  ULTIMATE_MIN_DURATION_MS, ULTIMATE_RECOVERY_RATIO,
} from "../../src/core/battleControls";

/** 배속 버튼이 허용된 세 단계 밖으로 벗어나지 않는지 검증한다. */
describe("전투 배속", () => {
  it("1배속에서 2·3배속을 거쳐 다시 1배속으로 순환한다", () => {
    expect(nextBattleSpeed(1)).toBe(2);
    expect(nextBattleSpeed(2)).toBe(3);
    expect(nextBattleSpeed(3)).toBe(1);
  });
});

/** Phaser 없이 궁극기 시간축의 배속·상한·스킵 계약을 고정한다. */
describe("궁극기 연출 시간축", () => {
  it("1배속도 기존 2보다 빠르고 2·3배속은 순간이동 방지 상한을 공유한다", () => {
    expect([1, 2, 3].map((speed) => ultimatePresentationTiming(speed as 1 | 2 | 3, false).rate)).toEqual([2.25, 3.25, 3.25]);
  });

  it("프리셋 시간을 환산하고 너무 짧은 구간과 빠른 복귀에 최솟값을 적용한다", () => {
    const timing = ultimatePresentationTiming(1, false);
    expect(scaleUltimateDuration(150, timing)).toBe(67);
    expect(scaleUltimateDuration(100, timing)).toBe(44);
    expect(scaleUltimateDuration(100, timing, ULTIMATE_RECOVERY_RATIO)).toBe(24);
    expect(scaleUltimateDuration(1, timing)).toBe(ULTIMATE_MIN_DURATION_MS);
  });

  it("스킵은 컷인과 확대 대기만 0으로 만들고 공격 재생 배율은 유지한다", () => {
    const timing = ultimatePresentationTiming(3, true);
    expect(timing).toEqual({ rate: 3.25, skipLeadIn: true });
    expect(scaleUltimateDuration(160, timing)).toBe(0);
  });

  it("결정타는 공격 모션과 확대 복귀를 종료 대기 조건으로 삼지 않는다", () => {
    // 공격 판정은 이미 끝났고 사망은 배경 시각 효과이므로 finish가 결과 진행을 즉시 소유한다.
    expect(shouldWaitForUltimatePresentation(true, true)).toBe(false);
    expect(shouldWaitForUltimatePresentation(true, false)).toBe(true);
    expect(shouldWaitForUltimatePresentation(false, true)).toBe(true);
  });
});
