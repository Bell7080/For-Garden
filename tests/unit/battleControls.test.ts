import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BATTLE_OPENING_HOLD_MS, MEMBER_BATTLE_SPEED_GATE_ENABLED, availableBattleSpeeds, battleFightStartsAt, battleSpeedTier, nextBattleSpeed, usableBattleSpeed, ultimateCutInDurations, scaleUltimateDuration, shouldWaitForUltimatePresentation, ultimatePresentationTiming,
  ULTIMATE_CUT_IN_TIMING, ULTIMATE_MIN_DURATION_MS, ULTIMATE_RECOVERY_RATIO,
} from "../../src/core/battleControls";

/** 배속 버튼이 허용된 세 단계 밖으로 벗어나지 않는지 검증한다. */
describe("전투 배속", () => {
  it("잠금이 켜지면 누구나 1 → 1.5 → 2배속을 돌고 다시 1배속으로 온다", () => {
    expect(nextBattleSpeed(1, false, true)).toBe(1.5);
    expect(nextBattleSpeed(1.5, false, true)).toBe(2);
    expect(nextBattleSpeed(2, false, true)).toBe(1);
  });

  it("잠금이 켜지면 3배속은 멤버십이 있을 때만 줄에 든다", () => {
    expect(nextBattleSpeed(2, true, true)).toBe(3);
    expect(nextBattleSpeed(3, true, true)).toBe(1);
    // 멤버십이 끝난 뒤 저장에 남은 3은 열린 것 중 가장 빠른 2로 내린다.
    expect(usableBattleSpeed(3, false, true)).toBe(2);
    expect(usableBattleSpeed(3, true, true)).toBe(3);
    expect(nextBattleSpeed(3, false, true)).toBe(1);
  });

  it("시험 기간에는 잠금을 꺼 두어 멤버십 없이도 3배속까지 돈다", () => {
    expect(MEMBER_BATTLE_SPEED_GATE_ENABLED).toBe(false);
    expect(availableBattleSpeeds(false)).toEqual([1, 1.5, 2, 3]);
    expect(nextBattleSpeed(2, false)).toBe(3);
    expect(usableBattleSpeed(3, false)).toBe(3);
  });

  it("배속 칩의 켜짐 세기는 단계마다 오른다", () => {
    expect([1, 1.5, 2, 3].map((speed) => battleSpeedTier(speed as 1 | 1.5 | 2 | 3))).toEqual([0, 1, 2, 3]);
  });
});

/** Phaser 없이 궁극기 시간축의 배속·상한·스킵 계약을 고정한다. */
describe("궁극기 연출 시간축", () => {
  it("은 배속을 받지 않는다 — 스킵 여부만 인자다", () => {
    expect(ultimatePresentationTiming(false).rate).toBe(ultimatePresentationTiming(true).rate);
    expect(ultimatePresentationTiming.length).toBe(1);
  });

  it("프리셋 시간을 환산하고 너무 짧은 구간과 빠른 복귀에 최솟값을 적용한다", () => {
    const timing = ultimatePresentationTiming(false);
    expect(scaleUltimateDuration(160, timing)).toBe(100);
    expect(scaleUltimateDuration(100, timing, ULTIMATE_RECOVERY_RATIO)).toBe(34);
    expect(scaleUltimateDuration(1, timing)).toBe(ULTIMATE_MIN_DURATION_MS);
  });

  it("스킵은 컷인과 확대 대기만 0으로 만들고 공격 재생 배율은 유지한다", () => {
    const timing = ultimatePresentationTiming(true);
    expect(timing.skipLeadIn).toBe(true);
    expect(scaleUltimateDuration(160, timing)).toBe(0);
  });

  it("컷인은 배속과 무관한 실제 시간으로 돌고, 스킵만 세 구간을 모두 없앤다", () => {
    const durations = ultimateCutInDurations(150, false);
    // 배속을 인자로 받지 않는다 — 1배속이든 3배속이든 같은 시간이 읽힌다.
    expect(durations).toEqual([ULTIMATE_CUT_IN_TIMING.enterMs, ULTIMATE_CUT_IN_TIMING.holdBaseMs + 150 * ULTIMATE_CUT_IN_TIMING.holdScale, ULTIMATE_CUT_IN_TIMING.exitMs]);
    expect(durations.reduce((sum, duration) => sum + duration, 0)).toBeGreaterThanOrEqual(1000);
    expect(ultimateCutInDurations(150, true)).toEqual([0, 0, 0]);
  });

  it("결정타는 공격 모션과 확대 복귀를 종료 대기 조건으로 삼지 않는다", () => {
    // 공격 판정은 이미 끝났고 사망은 배경 시각 효과이므로 finish가 결과 진행을 즉시 소유한다.
    expect(shouldWaitForUltimatePresentation(true, true)).toBe(false);
    expect(shouldWaitForUltimatePresentation(true, false)).toBe(true);
    expect(shouldWaitForUltimatePresentation(false, true)).toBe(true);
  });
});

describe("전투 시작 전의 숨 고르기", () => {
  it("은 전원이 선 뒤 전장을 한 번 볼 만큼만 둔다", () => {
    expect(BATTLE_OPENING_HOLD_MS).toBeGreaterThanOrEqual(600);
    expect(BATTLE_OPENING_HOLD_MS).toBeLessThanOrEqual(1500);
    expect(battleFightStartsAt(1000)).toBe(1000 + BATTLE_OPENING_HOLD_MS);
  });

  it("은 모든 전투가 같은 한 곳을 지난다 — 모드로 가르지 않는다", () => {
    const scene = readFileSync("src/scenes/BattleScene.ts", "utf8");
    // 전원이 선 시각에서 시작 시각을 구하고, 그 전에는 코어 시간도 수동 궁극기도 흐르지 않는다.
    expect(scene).toMatch(/this\.fightStartsAt = battleFightStartsAt\(/);
    expect(scene).toMatch(/if \(now < this\.fightStartsAt\)/);
    expect(scene).toMatch(/performance\.now\(\) < this\.fightStartsAt/);
  });
});
