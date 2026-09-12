import { describe, expect, it } from "vitest";
import { PRODUCTS } from "../../src/data/shopCatalog";
import { isTradePackage, TRADE_GEM_RATE, TRADE_PACKAGES, tradeGemValue, tradePackageLimitLabel, tradePackageValuePercent } from "../../src/data/tradePackages";
import { tradePackageCardMetrics, tradePackageCenters, tradePackageLayout } from "../../src/ui/tradePackageLayout";
import { insidePopupBody } from "../../src/ui/staminaPopupLayout";
import { tradePackageViews } from "../../src/ui/tradePopupModel";

describe("무역 패키지 운영 데이터", () => {
  it("은 초기 3종을 젬으로만 받고 값보다 많이 준다", () => {
    expect(TRADE_PACKAGES).toHaveLength(3);
    for (const pack of TRADE_PACKAGES) {
      expect(pack.storefront).toBe("trade");
      // 무역은 프리미엄이 아니다 — 플랫폼 결제는 이 전시장에 오지 않는다.
      expect(pack.acquisition).toMatchObject({ kind: "currency", currency: "gems" });
      // 같은 젬으로 따로 사는 것보다 적게 주는 패키지는 전시할 이유가 없다.
      expect(tradePackageValuePercent(pack.acquisition, pack.grants)!).toBeGreaterThan(100);
      // 한 카드가 담는 액자는 셋까지다. 그보다 많으면 카드 안에서 액자가 겹친다.
      expect(pack.grants.length).toBeLessThanOrEqual(3);
      expect(pack.defaultQuantity).toBe(1);
    }
    // 검수 장부의 환산값이 시세표와 어긋나면 화면의 가치 %가 거짓이 된다.
    expect(TRADE_PACKAGES.map((pack) => tradePackageValuePercent(pack.acquisition, pack.grants))).toEqual([200, 175, 250]);
  });

  it("은 계정당 1~3회 제한과 갱신 주기로만 운영된다", () => {
    for (const pack of TRADE_PACKAGES) {
      expect(pack.purchaseLimit).toBeGreaterThanOrEqual(1);
      expect(pack.purchaseLimit).toBeLessThanOrEqual(3);
      expect(["once", "daily", "weekly"]).toContain(pack.refresh);
    }
    // 다시 오지 않는 계정당 1회가 가장 후해야 한 번뿐인 값이 선다.
    const once = TRADE_PACKAGES.find(({ refresh }) => refresh === "once")!;
    const repeatable = TRADE_PACKAGES.filter(({ refresh }) => refresh !== "once");
    for (const pack of repeatable) {
      expect(tradePackageValuePercent(once.acquisition, once.grants)!).toBeGreaterThan(tradePackageValuePercent(pack.acquisition, pack.grants)!);
    }
  });

  it("은 시세표로만 값어치를 재고 재화 아닌 지급품은 세지 않는다", () => {
    // 젬 1 = 치즈케이크 2이므로 치즈케이크 600은 젬 300이다.
    expect(tradeGemValue([{ kind: "currency", currency: "cheesecake", amount: 600 }])).toBe(300);
    // 화석 100과 호박석 2는 연구 1회 비용이 같으므로 젬 값도 같아야 한다.
    expect(100 / TRADE_GEM_RATE.fossil).toBe(2 / TRADE_GEM_RATE.amber);
    // 시세가 없는 지급품(장식)은 환산하지 않는다 — 세면 가치 %가 부풀려진다.
    expect(tradeGemValue([{ kind: "profile_decoration", decorationId: "patron-monthly", name: "명찰" }])).toBe(0);
    // 재화로 값을 받지 않는 상품은 견줄 기준이 없어 %를 만들지 않는다.
    expect(tradePackageValuePercent({ kind: "platform_payment", platformProductId: "x", displayPrice: "₩4,900" }, [])).toBeUndefined();
  });

  it("은 갱신 주기와 남은 횟수를 한 줄로 적는다", () => {
    expect(tradePackageLimitLabel("weekly", 3, 2)).toBe("주간 3회 · 2회 남음");
    expect(tradePackageLimitLabel("once", 1, 1)).toBe("계정당 1회 · 1회 남음");
    expect(tradePackageLimitLabel("once", 1, 0)).toBe("계정당 1회 · 소진");
  });

  it("은 무역에 재화 교환 줄을 남기지 않는다", () => {
    // 재화를 재화로 바꾸는 일은 교류의 교환소와 DNA 교환이 맡는다. 예전 교환 줄이 되살아나면
    // 같은 화면에 전시대와 교환소가 함께 서서 무엇을 보는 자리인지 흐려진다.
    expect(PRODUCTS.some(({ id }) => ["trade-weeds", "trade-dna", "trade-rune-kit"].includes(id))).toBe(false);
    expect(PRODUCTS.filter(isTradePackage).every(({ acquisition }) => acquisition.kind === "currency")).toBe(true);
    expect(isTradePackage({ storefront: "shop" })).toBe(false);
  });
});

describe("무역 전시장 표시 계약", () => {
  const dto = (overrides: Partial<ReturnType<typeof baseDto>> = {}) => ({ ...baseDto(), ...overrides });
  function baseDto() {
    return { ...TRADE_PACKAGES[0], remaining: 3, purchasable: true, disabledReason: undefined as string | undefined };
  }

  it("은 카드가 계산하지 않도록 가치·제한·액자를 만들어 넘긴다", () => {
    const [view] = tradePackageViews([dto()]);
    expect(view).toMatchObject({
      id: "trade-cheesecake-supply", name: "치즈케이크 보급", valueLabel: "가치 200%",
      cost: { currency: "gems", amount: 150 }, limitLabel: "주간 3회 · 3회 남음", soldOut: false,
    });
    expect(view.grants).toEqual([{ currency: "cheesecake", amount: 600 }]);
  });

  it("은 소진된 패키지를 지우지 않고 눌리지 않는 카드로 남긴다", () => {
    // 다음 갱신에 무엇이 돌아오는지 보이지 않으면 이 화면에 다시 올 이유가 사라진다.
    const [view] = tradePackageViews([dto({ remaining: 0, purchasable: false, disabledReason: "구매 제한에 도달했습니다." })]);
    expect(view.soldOut).toBe(true);
    expect(view.limitLabel).toBe("주간 3회 · 소진");
  });

  it("은 다른 화면의 상품을 전시장에 세우지 않는다", () => {
    const shop = PRODUCTS.find(({ storefront }) => storefront === "shop")!;
    expect(tradePackageViews([{ ...shop, remaining: 1, purchasable: true }])).toEqual([]);
  });
});

describe("무역 전시장 자리", () => {
  it("은 카드 수에서 창 높이를 구하고 모든 카드를 몸판 안에 세운다", () => {
    for (const cards of [1, 2, 3, 4]) {
      const layout = tradePackageLayout(cards);
      expect(layout.centers).toHaveLength(cards);
      for (const y of layout.centers) {
        // 예전 무역은 높이를 1420이라 적어 두고 줄을 내려놓아 마지막 줄이 판 밖으로 나갔다.
        expect(insidePopupBody(layout, { y, width: layout.card.width, height: layout.card.height }), `${cards}장 중 y=${y}`).toBe(true);
      }
    }
  });

  it("은 카드가 줄어들면 남은 자리에서 가운데로 모은다", () => {
    const shell = tradePackageLayout(3);
    const two = tradePackageCenters(2, shell.height);
    expect(two).toHaveLength(2);
    // 두 장만 전시하는 날에도 아래가 통째로 비지 않도록 덩어리가 가운데에 선다.
    expect((two[0] + two[1]) / 2).toBeCloseTo((shell.centers[0] + shell.centers[2]) / 2, 5);
    expect(tradePackageCenters(0, shell.height)).toEqual([]);
  });

  it("은 이름·액자·값줄을 카드 안쪽에 세운다", () => {
    const card = tradePackageCardMetrics();
    expect(card.left).toBeGreaterThan(-card.width / 2);
    expect(card.right).toBeLessThan(card.width / 2);
    // 값줄과 제한 줄은 카드 아래 변 안에 든다.
    expect(card.costY + 20).toBeLessThan(card.height / 2);
    expect(card.limitY + 12).toBeLessThan(card.height / 2);
    for (const count of [1, 2, 3]) {
      const centers = card.frameCenters(count);
      expect(centers).toHaveLength(count);
      // 액자는 가운데로 모이고 어느 개수에서도 카드 안쪽 선을 넘지 않는다.
      expect(centers.reduce((sum, x) => sum + x, 0) / count).toBeCloseTo(0, 5);
      for (const x of centers) expect(Math.abs(x) + card.frameSize / 2).toBeLessThanOrEqual(card.right);
      // 액자 줄은 이름 아래 구분선과 카드 아래 변 사이에 든다.
      expect(card.frameY - card.frameSize / 2).toBeGreaterThan(card.hairlineY);
      expect(card.frameY + card.frameSize / 2).toBeLessThan(card.costY - 10);
    }
  });
});
