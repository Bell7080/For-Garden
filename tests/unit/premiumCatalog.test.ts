import { describe, expect, it } from "vitest";
import { PREMIUM_PRODUCTS } from "../../src/data/premiumProducts";
import { UnsupportedPlatformPaymentAdapter } from "../../src/api/PlatformPayment";
import { runPlatformPurchase } from "../../src/api/platformPurchase";
import type { GameApi } from "../../src/api/contracts";

describe("프리미엄 상품 카탈로그", () => {
  it("모든 상품이 스토어 상품 ID를 갖고 ID가 겹치지 않는다", () => {
    const ids = PREMIUM_PRODUCTS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    const stores = PREMIUM_PRODUCTS.map((p) => (p.acquisition.kind === "platform_payment" ? p.acquisition.platformProductId : ""));
    expect(stores.every(Boolean)).toBe(true);
    expect(new Set(stores).size).toBe(stores.length);
  });

  it("첫 구매 보너스는 다시 살 수 없는 상품에만 붙는다", () => {
    for (const p of PREMIUM_PRODUCTS) if (p.firstPurchaseBonus) expect(["none", "once"]).toContain(p.refresh);
  });

  it("모든 묶음은 네 칸 이하이고 세 구분이 모두 비어 있지 않다", () => {
    for (const p of PREMIUM_PRODUCTS) expect((p.grants ?? []).length).toBeLessThanOrEqual(4);
    for (const c of ["package", "deal", "limited", "gem"]) expect(PREMIUM_PRODUCTS.some((p) => p.premiumCategory === c)).toBe(true);
  });

  it("는 쓸 곳이 없는 재료(룬 가루)와 화면에 서지 않는 장식을 팔지 않는다", () => {
    for (const p of PREMIUM_PRODUCTS) {
      for (const grant of p.grants ?? []) {
        expect(grant.kind, p.id).not.toBe("profile_decoration");
        if (grant.kind === "item") expect(grant.itemId, p.id).not.toBe("rune-dust");
      }
    }
  });

  it("는 계정당 한 번뿐인 파격가 둘이 맨 위, 정기권 둘이 그다음이고 하루 보상이 넉넉하다", () => {
    const packages = PREMIUM_PRODUCTS.filter((p) => p.premiumCategory === "package");
    expect(packages.slice(0, 4).map((p) => p.id)).toEqual(["premium-starter", "premium-research-start", "premium-monthly", "premium-adfree"]);
    for (const p of packages.slice(2, 4)) expect(p.passBenefit?.dailyBonus?.amount ?? 0).toBeGreaterThanOrEqual(60);
  });
});

describe("플랫폼 결제 흐름", () => {
  it("SDK가 없는 빌드는 성공을 흉내 내지 않고 서버를 부르지 않는다", async () => {
    const calls: string[] = [];
    const api = new Proxy({}, { get: (_t, name) => () => { calls.push(String(name)); throw new Error("must not call"); } }) as unknown as GameApi;
    const product = PREMIUM_PRODUCTS.find((p) => p.id === "premium-gems-small")!;
    const outcome = await runPlatformPurchase(api, new UnsupportedPlatformPaymentAdapter(), { id: product.id, acquisition: product.acquisition } as never);
    expect(outcome.status).toBe("unsupported");
    expect(calls).toEqual([]);
  });
});
