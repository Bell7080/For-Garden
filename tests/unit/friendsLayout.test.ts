import { describe, expect, it } from "vitest";
import { BASE_HEIGHT } from "../../src/config/gameConfig";
import { BACK_BUTTON_SIZE, BACK_SLOT } from "../../src/ui/popupGeometry";
import { FRIEND_ROW, FRIENDS_CONTROLS, FRIENDS_SCREEN, friendRowButtonX, friendRowStarX, friendRowTextRight, friendsChipX, friendsMinScroll, friendsSearchRow, friendsSortX, friendsTabX } from "../../src/ui/friendsLayout";
import { PLAYER_PROFILE_LAYOUT } from "../../src/ui/playerProfileLayout";

const HALF = FRIENDS_SCREEN.width / 2;

describe("친구 화면 배치", () => {
  it("탭 셋이 화면 안에서 겹치지 않고 오른쪽 아래 뒤로가기 자리를 비운다", () => {
    const xs = [0, 1, 2].map(friendsTabX);
    const { width, y, height } = FRIENDS_SCREEN.tabs;
    for (let i = 1; i < xs.length; i += 1) expect(xs[i] - xs[i - 1]).toBeGreaterThanOrEqual(width);
    expect(xs[2] + width / 2).toBeLessThan(BACK_SLOT.x - BACK_BUTTON_SIZE / 2);
    expect(y + height / 2).toBeLessThanOrEqual(BASE_HEIGHT);
    expect(FRIENDS_SCREEN.list.bottom).toBeLessThan(y - height / 2);
  });

  it("조작 줄은 요약 줄 아래, 목록 위에 선다", () => {
    const { controls, summary, list } = FRIENDS_SCREEN;
    expect(controls.y - controls.height / 2).toBeGreaterThan(summary.y);
    expect(controls.y + controls.height / 2).toBeLessThan(list.top);
  });

  it("줄 안의 버튼과 글이 줄 폭 안에서 겹치지 않는다", () => {
    for (const count of [1, 2]) {
      const left = friendRowButtonX(0, count) - FRIEND_ROW.button.width / 2;
      expect(friendRowTextRight(count)).toBeLessThan(left);
      expect(friendRowButtonX(count - 1, count) + FRIEND_ROW.button.width / 2).toBeLessThanOrEqual(HALF - FRIEND_ROW.padRight);
    }
    expect(friendRowTextRight(2)).toBeGreaterThan(FRIEND_ROW.textX + 200);
    expect(friendRowTextRight(0)).toBeLessThan(friendRowStarX() - FRIEND_ROW.star.size / 2 + 1);
    expect(-HALF).toBeLessThan(FRIEND_ROW.avatar.x - FRIEND_ROW.avatar.size / 2);
  });

  it("칩 줄이 화면 폭을 넘지 않는다", () => {
    const { filter, subTab, bulk } = FRIENDS_CONTROLS;
    expect(friendsChipX(2, filter) + filter.width / 2).toBeLessThanOrEqual(FRIENDS_SCREEN.side + FRIENDS_SCREEN.width);
    const bulkLeft = FRIENDS_SCREEN.side + FRIENDS_SCREEN.width - 2 * bulk.width - bulk.gap;
    expect(friendsChipX(1, subTab) + subTab.width / 2).toBeLessThan(bulkLeft);
    expect(friendsSortX() - FRIENDS_CONTROLS.sort.width / 2).toBeGreaterThan(friendsChipX(2, filter) + filter.width / 2);
  });

  it("찾기 줄의 입력 칸은 왼쪽 여백부터 검색 버튼 앞까지 선다", () => {
    const row = friendsSearchRow();
    const inputLeft = row.input.x - row.input.width / 2;
    const inputRight = row.input.x + row.input.width / 2;
    expect(inputLeft).toBe(FRIENDS_SCREEN.side);
    expect(inputRight).toBeLessThan(row.button.x - FRIENDS_CONTROLS.search.width / 2);
    expect(row.input.width).toBeGreaterThan(500);
  });

  it("스크롤 한계는 줄이 적으면 0이다", () => {
    expect(friendsMinScroll(0)).toBe(0);
    expect(friendsMinScroll(3)).toBe(0);
    expect(friendsMinScroll(50)).toBeLessThan(0);
  });

  it("프로필 카드 하단 조작이 기록 아래, 판 안에 든다", () => {
    const a = PLAYER_PROFILE_LAYOUT.actions;
    expect(a.y - a.height / 2).toBeGreaterThan(529);
    expect(a.y + a.height / 2).toBeLessThan(740 - 20);
  });
});
