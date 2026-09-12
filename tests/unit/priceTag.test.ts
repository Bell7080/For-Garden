import { describe, expect, it } from "vitest";
import { EXCHANGE, EXCHANGE_ROW, interactionExchangeLayout } from "../../src/ui/interactionExchangeLayout";

/**
 * **값과 재화가 서는 자리는 글자가 아니라 액자다.**
 *
 * 구매 확인·무역 카드·상점 카드·교환소는 저마다 `1,200 젬`처럼 수와 재화 이름을 글로 적어 두어,
 * 같은 젬이 위 줄에서는 액자 안에 아래 줄에서는 문장 속에 섰다. 그 되돌림을 막는 계약이라
 * 소스 문자열로 "그 자리가 공용 액자를 부르는가"만 확인한다 — 캔버스를 띄우지 않고도 양식이
 * 갈라지는 순간을 잡는다.
 */
const SOURCE = import.meta.glob("../../src/{ui,scenes}/{priceTag,PurchasePopup,TradePackageCard,InteractionExchangePopup,ShopScene,PremiumScene}.ts", { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const source = (name: string): string => Object.entries(SOURCE).find(([path]) => path.endsWith(`${name}.ts`))![1];

describe("값 액자", () => {
  it("는 공용 액자 한 장을 그대로 쓴다", () => {
    // 액자 색·그림 비율·수량 자리를 다시 정하지 않는다 — 그러면 같은 골드가 화면마다 달라진다.
    expect(source("priceTag")).toContain("addFramedIcon");
    expect(source("priceTag")).toContain("ITEM_FRAME.amountRatio");
  });

  it("는 모자란 값을 붉게 적는다", () => {
    // 왜 못 사는지는 상태 문구보다 값 자체가 먼저 말한다.
    expect(source("priceTag")).toContain("options.short ? COLOR.dangerText : COLOR.accentText");
  });

  // 값이 서는 자리는 둘 중 하나다 — 여럿이 나란히 서는 자리는 **액자**(`addPriceTag`),
  // 그 줄이 값 하나만 말하는 자리는 **가로로 긴 줄**(`addPriceBar`)이다. 맨 글자로 되돌아간
  // 화면이 없는지만 확인한다.
  for (const screen of ["PurchasePopup", "TradePackageCard", "InteractionExchangePopup", "ShopScene", "PremiumScene"]) {
    it(`는 ${screen}의 값 자리를 맡는다`, () => {
      expect(source(screen)).toMatch(/addPriceTag|addItemPriceTag|addPriceBar/);
    });
  }

  it("는 재화 이름을 값 옆에 다시 적지 않는다", () => {
    // 그림이 이미 어느 재화인지 말한다. 이름까지 적으면 액자와 글이 같은 것을 두 번 말한다.
    expect(source("PurchasePopup")).not.toContain("priceText");
  });
});

describe("교환소 줄 배치", () => {
  it("은 창 높이를 줄 수에서 거꾸로 구한다", () => {
    const one = interactionExchangeLayout(1);
    const two = interactionExchangeLayout(2);
    expect(two.height - one.height).toBe(EXCHANGE_ROW.height + EXCHANGE.gap);
    expect(one.centers).toHaveLength(1);
  });

  it("은 줄이 판 안에 온전히 든다", () => {
    for (const count of [1, 2, 3]) {
      const layout = interactionExchangeLayout(count);
      for (const center of layout.centers) {
        expect(center - EXCHANGE_ROW.height / 2).toBeGreaterThanOrEqual(-layout.height / 2);
        expect(center + EXCHANGE_ROW.height / 2).toBeLessThanOrEqual(layout.height / 2);
      }
    }
  });

  it("은 액자 셋이 서로 겹치지 않고 줄 왼쪽 변 안에 선다", () => {
    const xs = [EXCHANGE_ROW.ownedX, EXCHANGE_ROW.requiredX, EXCHANGE_ROW.resultX];
    expect(xs[0] - EXCHANGE_ROW.tag / 2).toBeGreaterThanOrEqual(EXCHANGE_ROW.left);
    for (let index = 1; index < xs.length; index += 1) {
      expect(xs[index] - xs[index - 1]).toBeGreaterThan(EXCHANGE_ROW.tag);
    }
    // 화살표는 요구량과 결과 사이에 선다.
    expect(EXCHANGE_ROW.arrowX).toBeGreaterThan(EXCHANGE_ROW.requiredX);
    expect(EXCHANGE_ROW.arrowX).toBeLessThan(EXCHANGE_ROW.resultX);
  });

  it("은 이름줄·액자·조작이 세로로 겹치지 않는다", () => {
    expect(EXCHANGE_ROW.labelY).toBeGreaterThan(EXCHANGE_ROW.nameY);
    expect(EXCHANGE_ROW.tagY - EXCHANGE_ROW.tag / 2).toBeGreaterThan(EXCHANGE_ROW.labelY);
    expect(EXCHANGE_ROW.controlsY - 29).toBeGreaterThan(EXCHANGE_ROW.tagY + EXCHANGE_ROW.tag / 2);
    expect(EXCHANGE_ROW.messageY).toBeGreaterThan(EXCHANGE_ROW.controlsY + 29);
    expect(EXCHANGE_ROW.messageY).toBeLessThan(EXCHANGE_ROW.height / 2);
  });
});
