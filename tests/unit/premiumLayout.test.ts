import { describe, expect, it } from "vitest";
import { BASE_WIDTH } from "../../src/config/gameConfig";
import { LOBBY_NAV_TOP } from "../../src/ui/lobbyLayout";
import {
  PREMIUM_BOARD, PREMIUM_CARD, PREMIUM_TAB_ROW,
  premiumCardSpot, premiumCardWidth, premiumGridContentHeight, premiumGridViewport,
  premiumTabSpot, premiumTitleHeight, premiumTitleLeft, premiumTitleY,
} from "../../src/ui/premiumLayout";
import { PREMIUM_TABS, PRODUCTS } from "../../src/data/shopCatalog";
import { premiumCategoryOf } from "../../src/ui/premiumModel";
import type { ProductDto } from "../../src/api/contracts";

describe("프리미엄 자리표", () => {
  it("의 격자 창은 제목표 아래에서 시작해 라벨 줄 위에서 끝난다", () => {
    const view = premiumGridViewport();
    expect(view.top).toBeGreaterThan(premiumTitleY() + premiumTitleHeight() / 2);
    expect(view.bottom).toBeLessThanOrEqual(PREMIUM_TAB_ROW.bottom - PREMIUM_TAB_ROW.height);
    expect(view.left).toBeGreaterThanOrEqual(PREMIUM_BOARD.left);
    expect(view.right).toBeLessThanOrEqual(PREMIUM_BOARD.right);
  });

  it("의 라벨 줄은 하단 탭을 침범하지 않는다", () => {
    // 화면 밑동은 고고학·렐릭·로비·연구소·프리미엄이 이미 차지하고 있다.
    expect(PREMIUM_TAB_ROW.bottom).toBeLessThanOrEqual(LOBBY_NAV_TOP);
  });

  it("의 제목표가 판 윗변에 걸터앉고 칸 줄과 같은 시작선을 쓴다", () => {
    expect(premiumTitleY()).toBe(PREMIUM_BOARD.top);
    expect(premiumTitleLeft()).toBe(premiumGridViewport().left);
  });

  it("의 두 칸과 그 사이 간격이 창을 정확히 나눠 갖는다", () => {
    const view = premiumGridViewport();
    const width = premiumCardWidth();
    expect(width * PREMIUM_CARD.columns + PREMIUM_CARD.gapX * (PREMIUM_CARD.columns - 1)).toBeCloseTo(view.right - view.left, 6);
    expect(width).toBeGreaterThan(400);
  });

  it("의 라벨 넷이 화면 폭 안에서 서로 겹치지 않는다", () => {
    const spots = PREMIUM_TABS.map((_, index) => premiumTabSpot(index, PREMIUM_TABS.length));
    expect(spots[0].x - PREMIUM_TAB_ROW.width / 2).toBeGreaterThanOrEqual(0);
    expect(spots[spots.length - 1].x + PREMIUM_TAB_ROW.width / 2).toBeLessThanOrEqual(BASE_WIDTH);
    for (let i = 1; i < spots.length; i += 1) {
      expect(spots[i].x - spots[i - 1].x).toBeGreaterThanOrEqual(PREMIUM_TAB_ROW.width);
    }
  });

  it("의 칸 두 줄이 창보다 길어 목록이 흐른다", () => {
    const view = premiumGridViewport();
    // 딱 맞게 두면 상품이 적은 갈래만 스크롤이 없어 목록을 끝까지 봤는지 알 수 없다.
    expect(premiumGridContentHeight(6)).toBeGreaterThan(view.bottom - view.top);
    expect(premiumCardSpot(0).y - PREMIUM_CARD.height / 2).toBeCloseTo(view.top, 6);
  });
});

describe("프리미엄 목록 갈래", () => {
  it("는 네 라벨이 모두 설 상품을 갖는다", () => {
    // 눌러도 빈 목록만 나오는 라벨은 준비 상태를 과장한다.
    for (const tab of PREMIUM_TABS) {
      const count = PRODUCTS.filter((product) => product.storefront === "premium" && premiumCategoryOf(product as unknown as ProductDto) === tab.id).length;
      expect(count, tab.id).toBeGreaterThan(0);
    }
  });

  it("는 갈래를 적지 않은 상품도 목록에서 사라지지 않게 패키지로 본다", () => {
    // 사라진 상품은 화면 어디에도 없어 빠뜨린 것을 알아챌 방법이 없다.
    expect(premiumCategoryOf({ } as ProductDto)).toBe("package");
  });
});
