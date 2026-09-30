import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { NAV_TABS, navTabDirection, navTabIndex } from "../../src/core/navTabs";

describe("핵심 화면 다섯", () => {
  it("은 로비를 한가운데 둔다", () => {
    // 하단 탭이 서는 차례와 화면이 들어오는 방향이 이 차례로 결정된다.
    expect(NAV_TABS).toHaveLength(5);
    expect(navTabIndex("lobby")).toBe(2);
    expect(NAV_TABS[0].key).toBe("archaeology");
    expect(NAV_TABS[4].key).toBe("premium");
  });

  it("은 어느 쪽 탭을 눌렀는지로 들어오는 방향을 정한다", () => {
    expect(navTabDirection("lobby", "premium")).toBe(1);
    expect(navTabDirection("premium", "lobby")).toBe(-1);
    expect(navTabDirection("lobby", "lobby")).toBe(0);
  });

  /**
   * 좌우로 밀어서 화면을 넘기는 손짓은 없다.
   *
   * 도감 그리드·연구소 배너·상점·고고학의 세부 탭이 좌우 밀기를 제 조작으로 쓰려는데, 화면 넘김이
   * 그 손을 먼저 가져가 탭이 통째로 넘어갔다. 화면은 하단 버튼으로만 옮긴다.
   */
  it("은 하단 막대에 화면을 넘기는 밀기 입력을 걸지 않는다", () => {
    const source = readFileSync("src/ui/BottomNav.ts", "utf8");
    expect(source).not.toMatch(/POINTER_UP|POINTER_DOWN|Swipe/);
  });
});
