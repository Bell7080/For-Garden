import { describe, expect, it } from "vitest";
import { TitleEntryGesture } from "../../src/core/titleEntryGesture";
describe("인증 이후 별도 진입 탭", () => {
  it("인증 중 시작한 탭과 인증 직후 손 떼기는 진입하지 않는다", () => {
    const gesture = new TitleEntryGesture(false);
    gesture.down(1, false); gesture.arm();
    expect(gesture.up(1)).toBe(false);
    expect(gesture.up(1)).toBe(false);
    gesture.down(1, false); expect(gesture.up(1)).toBe(true);
    expect(gesture.up(1)).toBe(false);
  });
  it("팝업·다른 포인터·처리 중 입력은 다음 진입에 재사용하지 않는다", () => {
    const gesture = new TitleEntryGesture(true);
    gesture.down(1, true); expect(gesture.up(1)).toBe(false);
    gesture.down(1, false); expect(gesture.up(2)).toBe(false);
    expect(gesture.up(1)).toBe(false);
    gesture.down(2, false); expect(gesture.up(2)).toBe(true);
  });
});
