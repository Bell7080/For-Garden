import { describe, expect, it } from "vitest";
import { PREMIUM_GEM_PER_KRW, PREMIUM_PRODUCTS } from "../../src/data/premiumProducts";
import { premiumDiscountPercent, premiumValueMultiple } from "../../src/core/premiumValue";
import { tradePackageValuePercent } from "../../src/data/tradePackages";
import type { ProductDto } from "../../src/api/contracts";

const dto = (id: string): ProductDto => PREMIUM_PRODUCTS.find((product) => product.id === id) as unknown as ProductDto;

describe("프리미엄 가치 배수·할인", () => {
  it("기준은 중형 다이아 팩의 효율이다", () => {
    const medium = PREMIUM_PRODUCTS.find((product) => product.id === "premium-gems-medium")!;
    expect(PREMIUM_GEM_PER_KRW).toBeCloseTo(1_500 / (medium.acquisition as { basePriceKrw: number }).basePriceKrw, 6);
  });

  it("월간 정기권은 출석을 다 채우면 같은 값 젬 팩의 3배 이상이고 광고제거보다 후하다", () => {
    const monthly = premiumValueMultiple(dto("premium-monthly"), PREMIUM_GEM_PER_KRW)!;
    const adFree = premiumValueMultiple(dto("premium-adfree"), PREMIUM_GEM_PER_KRW)!;
    expect(monthly).toBeGreaterThanOrEqual(3);
    expect(monthly).toBeGreaterThan(adFree);
  });

  it("다이아 팩은 배지를 달지 않는다(기준 자신)", () => {
    for (const product of PREMIUM_PRODUCTS.filter((p) => p.premiumCategory === "gem")) {
      expect(premiumValueMultiple(product as unknown as ProductDto, PREMIUM_GEM_PER_KRW)).toBeUndefined();
    }
  });

  it("정가가 있는 상품만 할인율이 나온다", () => {
    expect(premiumDiscountPercent(dto("premium-starter"))).toBe(50);
    expect(premiumDiscountPercent(dto("premium-monthly"))).toBeUndefined();
  });

  it("증표로 값을 치르는 상품은 가치 %가 없다(터무니없는 배수 방지)", () => {
    expect(tradePackageValuePercent({ kind: "currency", currency: "raidSigil", amount: 20 }, [{ kind: "currency", currency: "cheesecake", amount: 400 }])).toBeUndefined();
    expect(tradePackageValuePercent({ kind: "currency", currency: "salvageRecord", amount: 30 }, [{ kind: "currency", currency: "rawStone", amount: 800 }])).toBeUndefined();
  });
});

describe("프리미엄 가치 띠", () => {
  it("재구매가 안 되는 한정 줄은 2.5배 이상, 다이아 팩보다 늘 후하다", () => {
    for (const p of PREMIUM_PRODUCTS.filter((q) => q.premiumCategory === "limited" || q.id === "premium-starter" || q.id === "premium-growth" || q.id === "premium-research-start" || q.id === "premium-research-light")) {
      expect(premiumValueMultiple(p as unknown as ProductDto, PREMIUM_GEM_PER_KRW) ?? 0, p.id).toBeGreaterThanOrEqual(2.5);
    }
  });

  it("연구권은 10개 단위로만 묶는다", () => {
    for (const p of PREMIUM_PRODUCTS) for (const g of p.grants) if (g.kind === "currency" && (g.currency === "fossil" || g.currency === "amber") && /research|monthly-|hundred/.test(p.id)) expect(g.amount % 10, p.id).toBe(0);
  });
});
