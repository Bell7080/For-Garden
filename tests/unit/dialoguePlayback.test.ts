import { describe, expect, it } from "vitest";
import { DialoguePlaybackClock, dialoguePlaybackTiming } from "../../src/core/dialoguePlayback";
import type { GameSettings } from "../../src/state/session";

/** 대사 타이핑 배율과 노드별 설정 재조회 계약을 Phaser 없이 고정한다. */
describe("dialogue playback timing", () => {
  it.each([
    // 10글자는 기본 30ms 간격에서 0.5배 600ms, 1배 300ms, 2배 150ms가 걸린다.
    [0.5, 60, 600],
    [1, 30, 300],
    [2, 15, 150],
  ] as const)("%s배에서 글자 간격과 전체 진행 시간을 계산한다", (speed, characterMs, typingDurationMs) => {
    expect(dialoguePlaybackTiming("1234567890", speed)).toEqual({ characterMs, typingDurationMs });
  });

  it("설정 변경을 현재 타이핑에 소급하지 않고 다음 대사부터 즉시 반영한다", () => {
    let speed: GameSettings["game"]["textSpeed"] = 1;
    const clock = new DialoguePlaybackClock(() => speed);
    const currentLine = clock.timingFor("1234567890");
    speed = 2;
    // 이미 확정된 현재 노드와 달리 다음 timingFor 호출은 SettingsManager의 최신 스냅샷을 읽는다.
    expect(currentLine.typingDurationMs).toBe(300);
    expect(clock.timingFor("1234567890").typingDurationMs).toBe(150);
  });
});
