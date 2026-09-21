import { describe, expect, it } from "vitest";
import {
  NAV_SWIPE_DISTANCE, NAV_TABS, navSwipeStep, navTabDirection, navTabIndex, neighborNavTab,
} from "../../src/core/navTabs";

describe("핵심 화면 다섯", () => {
  it("은 로비를 한가운데 둔다", () => {
    // 좌우로 미는 손이 어디까지 갈 수 있는지가 이 차례로 결정된다.
    expect(NAV_TABS).toHaveLength(5);
    expect(navTabIndex("lobby")).toBe(2);
    expect(NAV_TABS[0].key).toBe("archaeology");
    expect(NAV_TABS[4].key).toBe("premium");
  });

  it("의 양 끝에서는 넘어가지 않는다", () => {
    /*
     * 끝에서 반대쪽 끝으로 돌리면 그 한 번이 다섯 칸을 건너뛰는 이동이라 어디로 간 것인지
     * 읽히지 않는다. 줄의 끝은 끝으로 둔다.
     */
    expect(neighborNavTab("archaeology", -1)).toBeUndefined();
    expect(neighborNavTab("premium", 1)).toBeUndefined();
    expect(neighborNavTab("lobby", 1)?.key).toBe("lab");
    expect(neighborNavTab("lobby", -1)?.key).toBe("relics");
  });

  it("은 왼쪽으로 민 손을 오른쪽 화면으로 보낸다", () => {
    // 손가락이 종이를 왼쪽으로 밀어내는 것과 같다.
    expect(navSwipeStep(-NAV_SWIPE_DISTANCE - 1, 0)).toBe(1);
    expect(navSwipeStep(NAV_SWIPE_DISTANCE + 1, 0)).toBe(-1);
  });

  it("은 짧게 스친 손과 세로로 훑는 손을 넘김으로 보지 않는다", () => {
    // 도감은 세로로 훑는 목록이라 손이 비스듬히 지나가기 쉽다 — 그때마다 화면이 갈리면 못 본다.
    expect(navSwipeStep(-(NAV_SWIPE_DISTANCE - 1), 0)).toBe(0);
    expect(navSwipeStep(-200, 400)).toBe(0);
    expect(navSwipeStep(0, 0)).toBe(0);
  });

  it("은 어느 쪽 탭을 눌렀는지로 들어오는 방향을 정한다", () => {
    // 누른 손과 민 손이 같은 방향 규칙을 써야 새 화면이 늘 같은 쪽에서 들어온다.
    expect(navTabDirection("lobby", "premium")).toBe(1);
    expect(navTabDirection("premium", "lobby")).toBe(-1);
    expect(navTabDirection("lobby", "lobby")).toBe(0);
  });
});
