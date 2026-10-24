import { describe, expect, it } from "vitest";
import { levelUpAnnouncement } from "../../src/core/levelUpAnnouncement";

describe("로비 레벨업 알림", () => {
  it("튜토리얼 동안에는 띄우지 않고 기준을 1로 잡는다", () => {
    expect(levelUpAnnouncement(undefined, 3, true)).toEqual({ baseline: 1 });
    expect(levelUpAnnouncement(1, 4, true)).toEqual({ baseline: 1 });
  });

  it("튜토리얼이 끝나면 그 사이 오른 레벨을 한 번에 알린다", () => {
    const during = levelUpAnnouncement(undefined, 2, true);
    expect(levelUpAnnouncement(during.baseline, 4, false)).toEqual({ baseline: 4, announce: { from: 1, to: 4 } });
  });

  it("앱을 켠 뒤 처음 선 로비는 기준만 잡는다", () => {
    expect(levelUpAnnouncement(undefined, 12, false)).toEqual({ baseline: 12 });
    expect(levelUpAnnouncement(12, 12, false)).toEqual({ baseline: 12 });
  });
});
