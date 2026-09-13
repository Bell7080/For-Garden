import { describe, expect, it } from "vitest";
import { BASE_HEIGHT, BASE_WIDTH } from "../../src/config/gameConfig";
import {
  SHOP_BOARD, SHOP_CARD, SHOP_SHELF, SHOP_STAGE, SHOP_TAB_ROW, SHOP_TOPBAR_GUARD,
  shopBoardSize, shopCardSpot, shopCardWidth, shopDialogueSpot, shopGridContentHeight, shopGridViewport,
  shopShelfWidth, shopShelfY, shopTabSpot, shopTitleHeight, shopTitleLeft, shopTitleY,
} from "../../src/ui/shopLayout";
import { DIALOGUE_BUBBLE } from "../../src/ui/dialogueBubbleLayout";

/** 우하단 뒤로가기가 지키는 자리. 씬이 그 좌표를 고정값으로 쓰므로 여기서도 같은 값을 본다. */
const BACK_BUTTON = { x: BASE_WIDTH - 106, y: BASE_HEIGHT - 120, radius: 70 };

describe("상점 자리표", () => {
  it("위는 무대, 아래는 전시대이고 전시대가 무대 바닥선에 물린다", () => {
    // 무대는 화면의 삼분의 일보다 조금 더 — 넷으로 나눈 한 칸만 주면 점원이 어깨에서 잘린다.
    expect(SHOP_STAGE.bottom).toBeGreaterThan(BASE_HEIGHT / 3);
    expect(SHOP_STAGE.bottom).toBeLessThan(BASE_HEIGHT / 2);
    // 전시대는 무대 바닥선보다 살짝 위에서 시작해 점원의 허리를 가린다 — 경계에서 딱 맞추면
    // 잘린 몸통이 윗변에 붙어 "덜 그려진 것"처럼 보인다.
    expect(SHOP_BOARD.top).toBeLessThan(SHOP_STAGE.bottom);
    expect(SHOP_STAGE.bottom - SHOP_BOARD.top).toBeLessThanOrEqual(24);
    expect(shopBoardSize().height).toBeGreaterThan(BASE_HEIGHT / 2);
  });

  it("전시대가 화면 좌우와 밑동을 남김없이 쓴다", () => {
    // 좌우 36px 띠와 아래 236px는 아무것도 서지 않으면서 칸 폭만 좁혔다.
    expect(SHOP_BOARD.left).toBe(0);
    expect(SHOP_BOARD.right).toBe(BASE_WIDTH);
    expect(SHOP_BOARD.bottom).toBe(BASE_HEIGHT);
  });

  it("점원은 상단 재화 줄을 침범하지 않고 허리까지 보인다", () => {
    const { headX, headY, height } = SHOP_STAGE.merchant;
    // 원화에서 머리 관절 위로 솟은 몫(모자·뿔)까지 재화 줄 아래에서 시작해야 한다.
    expect(headY - height * 0.16).toBeGreaterThan(SHOP_TOPBAR_GUARD);
    // 머리끝부터 잘리는 자리까지가 전신의 3할을 넘어야 상반신이 허리께까지 읽힌다.
    expect((SHOP_BOARD.top - headY) / height).toBeGreaterThan(0.25);
    expect(headX).toBeLessThan(BASE_WIDTH);
  });

  it("대사창이 제목표 바로 위에 서고 점원의 얼굴을 덮지 않는다", () => {
    const dialogue = shopDialogueSpot();
    // 제목표와 **같은 시작선**에서 시작한다 — 말과 목록이 한 기둥으로 읽힌다.
    expect(dialogue.centerX - dialogue.width / 2).toBe(shopTitleLeft());
    // 제목표 윗변보다 위에 서되 그 바로 위다.
    expect(dialogue.bottom).toBeLessThan(shopTitleY() - shopTitleHeight() / 2);
    expect(shopTitleY() - shopTitleHeight() / 2 - dialogue.bottom).toBeLessThanOrEqual(48);
    // 머리 관절이 띠의 오른쪽 변보다 더 오른쪽에 서서 얼굴이 가려지지 않는다.
    expect(dialogue.centerX + dialogue.width / 2).toBeLessThan(SHOP_STAGE.merchant.headX);
    // 가장 긴 대사(최소 높이의 두 배로 잡아도)가 얼굴 아래에서 시작한다.
    expect(dialogue.bottom - DIALOGUE_BUBBLE.minHeight * 2).toBeGreaterThan(SHOP_STAGE.merchant.headY);
    // 얼굴도 무대 안에 있어야 상품 판 마스크에 잘리지 않는다.
    expect(SHOP_STAGE.merchant.headY).toBeGreaterThan(SHOP_STAGE.top);
    expect(SHOP_STAGE.merchant.headY).toBeLessThan(SHOP_BOARD.top);
    expect(SHOP_STAGE.merchant.headX).toBeLessThan(BASE_WIDTH);
  });

  it("격자 창이 전시대 안에 들고 제목표 아래에서 시작한다", () => {
    const view = shopGridViewport();
    expect(view.left).toBeGreaterThanOrEqual(SHOP_BOARD.left);
    expect(view.right).toBeLessThanOrEqual(SHOP_BOARD.right);
    expect(view.top).toBeGreaterThan(SHOP_BOARD.top);
    expect(view.bottom).toBeLessThanOrEqual(SHOP_BOARD.bottom);
  });

  it("제목표가 전시대 윗변에 걸터앉아 안팎을 가른다", () => {
    const view = shopGridViewport();
    // 표의 가운데가 판의 윗변 그 자리다 — 절반은 밖, 절반은 안이라 그 한 장이 경계를 잡는다.
    expect(shopTitleY()).toBe(SHOP_BOARD.top);
    expect(shopTitleY() - shopTitleHeight() / 2).toBeLessThan(SHOP_BOARD.top);
    expect(shopTitleY() + shopTitleHeight() / 2).toBeGreaterThan(SHOP_BOARD.top);
    // 격자 첫 줄은 표의 아래 절반보다 더 아래에서 시작한다.
    expect(view.top).toBeGreaterThan(shopTitleY() + shopTitleHeight() / 2);
    expect(shopTitleLeft()).toBe(view.left);
  });

  it("두 칸과 그 사이 간격이 창을 정확히 나눠 갖는다", () => {
    const view = shopGridViewport();
    const width = shopCardWidth();
    expect(SHOP_CARD.columns).toBe(2);
    expect(width * SHOP_CARD.columns + SHOP_CARD.gapX * (SHOP_CARD.columns - 1)).toBeCloseTo(view.right - view.left, 6);
    // 두 줄이라 칸이 충분히 넓다 — 액자·이름·값 줄이 세로로 쌓일 자리가 있어야 한다.
    expect(width).toBeGreaterThan(400);
  });

  it("칸 안의 액자·이름·값 줄이 서로 겹치지 않고 칸 안에 든다", () => {
    const top = -SHOP_CARD.height / 2;
    const bottom = SHOP_CARD.height / 2;
    const frameTop = SHOP_CARD.frameY - SHOP_CARD.frame / 2;
    const frameBottom = SHOP_CARD.frameY + SHOP_CARD.frame / 2;
    expect(frameTop).toBeGreaterThan(top);
    expect(SHOP_CARD.nameY).toBeGreaterThan(frameBottom);
    expect(SHOP_CARD.remainingY).toBeGreaterThan(SHOP_CARD.nameY);
    const priceTop = SHOP_CARD.price.y - SHOP_CARD.price.height / 2;
    expect(priceTop).toBeGreaterThan(SHOP_CARD.remainingY);
    expect(SHOP_CARD.price.y + SHOP_CARD.price.height / 2).toBeLessThan(bottom);
    // 값 줄은 칸 좌우 변에서 물러나 칸 안의 줄로 읽힌다.
    expect(SHOP_CARD.price.inset).toBeGreaterThan(0);
  });

  it("칸은 왼쪽에서 오른쪽으로 채운 뒤 다음 줄로 내려간다", () => {
    const first = shopCardSpot(0);
    const second = shopCardSpot(1);
    const third = shopCardSpot(2);
    expect(second.y).toBe(first.y);
    expect(second.x - first.x).toBeCloseTo(shopCardWidth() + SHOP_CARD.gapX, 6);
    expect(third.x).toBeCloseTo(first.x, 6);
    expect(third.y - first.y).toBe(SHOP_CARD.height + SHOP_CARD.gapY);
    // 첫 줄은 창 윗변에 붙고 한 칸도 그 위로 새지 않는다.
    expect(first.y - SHOP_CARD.height / 2).toBe(shopGridViewport().top);
  });

  it("쌓인 높이는 줄 수에서 나오고 홀수 개도 한 줄을 더 쓴다", () => {
    expect(shopGridContentHeight(0)).toBe(0);
    expect(shopGridContentHeight(1)).toBe(SHOP_CARD.height);
    expect(shopGridContentHeight(2)).toBe(SHOP_CARD.height);
    expect(shopGridContentHeight(3)).toBe(SHOP_CARD.height * 2 + SHOP_CARD.gapY);
    expect(shopGridContentHeight(4)).toBe(SHOP_CARD.height * 2 + SHOP_CARD.gapY);
  });

  it("세 줄은 창보다 길어 어느 탭에서나 목록이 흐른다", () => {
    const view = shopGridViewport();
    const viewHeight = view.bottom - view.top;
    // 두 줄까지는 한 화면에 들지만 세 줄(다섯 상품)부터는 넘친다 — 딱 맞게 두면 그 탭만
    // 스크롤이 없는 화면이 되어 목록을 끝까지 봤는지 알 수 없다.
    expect(shopGridContentHeight(4)).toBeLessThanOrEqual(viewHeight);
    expect(shopGridContentHeight(5)).toBeGreaterThan(viewHeight);
  });

  it("선반이 줄마다 칸 밑으로 지나가고 좌우로 한 뼘 더 내민다", () => {
    for (const row of [0, 1, 2]) {
      const cardBottom = shopCardSpot(row * SHOP_CARD.columns).y + SHOP_CARD.height / 2;
      // 칸 밑변 바로 아래를 지나야 칸이 선반에 놓인 것으로 읽힌다.
      expect(shopShelfY(row)).toBeGreaterThan(cardBottom);
      expect(shopShelfY(row) - cardBottom).toBeLessThanOrEqual(SHOP_CARD.gapY);
      // 다음 줄의 칸을 침범하지 않는다.
      if (row > 0) expect(shopShelfY(row) - shopShelfY(row - 1)).toBe(SHOP_CARD.height + SHOP_CARD.gapY);
    }
    const view = shopGridViewport();
    expect(shopShelfWidth()).toBe(view.right - view.left + SHOP_SHELF.overhang * 2);
    expect(SHOP_SHELF.overhang).toBeGreaterThan(0);
  });

  it("하단 탭 줄이 전시대 안 밑동 왼쪽에 서고 뒤로가기를 침범하지 않는다", () => {
    const count = 3;
    const spots = Array.from({ length: count }, (_, index) => shopTabSpot(index));
    for (const spot of spots) {
      // 엄지가 닿는 밑동이되 화면 밖으로 나가지 않는다.
      expect(spot.y + SHOP_TAB_ROW.height / 2).toBeLessThanOrEqual(BASE_HEIGHT);
      expect(spot.y - SHOP_TAB_ROW.height / 2).toBeGreaterThan(SHOP_BOARD.top);
      // 격자 창과 겹치지 않는다 — 탭을 누르는 손이 스크롤로 오인되면 목록이 흔들린다.
      expect(spot.y - SHOP_TAB_ROW.height / 2).toBeGreaterThanOrEqual(shopGridViewport().bottom);
      // 우하단 뒤로가기와 떨어져 있다 — 가운데 정렬하면 마지막 라벨이 그 버튼 밑으로 들어간다.
      expect(spot.x + SHOP_TAB_ROW.width / 2).toBeLessThan(BACK_BUTTON.x - BACK_BUTTON.radius);
    }
    // 줄은 왼쪽 여백에서 시작해 오른쪽으로 이어진다.
    expect(spots[0].x - SHOP_TAB_ROW.width / 2).toBe(SHOP_TAB_ROW.left);
    expect(spots[1].x - spots[0].x).toBe(SHOP_TAB_ROW.width + SHOP_TAB_ROW.gap);
  });
});
