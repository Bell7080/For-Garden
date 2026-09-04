import { describe, expect, it } from "vitest";
import { SETTINGS_TOGGLE, settingsKnobOffsetX, settingsStateLabelOffsetX, settingsTrackCenterX } from "../../src/ui/settingsToggleLayout";

/**
 * 스위치는 **자리로** 상태를 말한다.
 *
 * 예전에는 같은 자리의 점 하나가 조금 커지고 노래질 뿐이라, 그 줄만 봐서는 지금 어느 쪽인지
 * 알 수 없고 눌러 봐야 알았다.
 */
describe("설정 스위치 배치", () => {
  it("는 꺼짐이 왼쪽, 켜짐이 오른쪽이다", () => {
    expect(settingsKnobOffsetX(false)).toBeLessThan(0);
    expect(settingsKnobOffsetX(true)).toBeGreaterThan(0);
    expect(settingsKnobOffsetX(false)).toBe(-settingsKnobOffsetX(true));
  });

  it("는 손잡이가 비운 쪽에 상태 글자를 세운다", () => {
    // 같은 쪽에 겹치면 글자가 손잡이에 가려 무엇이 켜졌는지 읽을 수 없다.
    expect(settingsStateLabelOffsetX(true)).toBe(-settingsKnobOffsetX(true));
    expect(settingsStateLabelOffsetX(false)).toBe(-settingsKnobOffsetX(false));
  });

  it("는 손잡이가 홈 밖으로 나가지 않는다", () => {
    const edge = Math.abs(settingsKnobOffsetX(true)) + SETTINGS_TOGGLE.knobWidth / 2;
    expect(edge).toBeLessThanOrEqual(SETTINGS_TOGGLE.trackWidth / 2);
  });

  it("는 줄 구분선 안쪽에 머문다", () => {
    // 줄의 왼쪽 기준은 화면 90이고 구분선은 화면 985에서 끝난다.
    const rightOnScreen = 90 + settingsTrackCenterX() + SETTINGS_TOGGLE.trackWidth / 2;
    expect(rightOnScreen).toBeLessThan(985);
  });
});
