import { describe, expect, it } from "vitest";
import { rosterPickIntent, type RosterPickInput } from "../../src/core/rosterPick";

const base: RosterPickInput = { dx: 0, dy: 0, pointerY: 1200, viewportTop: 900, scrollable: true, scrolling: false, slop: 24 };

describe("목록 카드 집기 판정", () => {
  it("조금 움직인 손은 아직 정하지 않는다", () => {
    expect(rosterPickIntent({ ...base, dx: 10, dy: 5 })).toBe("pending");
  });
  it("세로로 끈 손은 목록을 굴린다", () => {
    expect(rosterPickIntent({ ...base, dy: -60, dx: 10 })).toBe("scroll");
  });
  it("가로로 끈 손은 카드를 집는다", () => {
    expect(rosterPickIntent({ ...base, dx: 60, dy: -20 })).toBe("pick");
  });
  it("굴릴 것이 없는 목록은 어느 쪽으로 끌어도 집는다", () => {
    expect(rosterPickIntent({ ...base, dy: -60, scrollable: false })).toBe("pick");
  });
  it("스크롤하던 손도 목록 창 위로 빠져나가면 집는다", () => {
    expect(rosterPickIntent({ ...base, scrolling: true, dy: -400, pointerY: 880 })).toBe("pick");
    expect(rosterPickIntent({ ...base, scrolling: true, dx: 80, pointerY: 1000 })).toBe("scroll");
  });
});
