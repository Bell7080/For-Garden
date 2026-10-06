import { describe, expect, it } from "vitest";
import { MILEAGE_OVERFLOW_BY_RARITY, MILEAGE_PER_PULL, mileageForPull } from "../../src/core/mileage";
import { MILEAGE_CLERK_LINE_COUNT, mileageClerkPool, mileageRotatingFragmentId, mileageRotationPool, mileageWeekIndex, mileageWeeklyClerkId } from "../../src/data/mileageClerk";
import { MILEAGE_PRODUCTS } from "../../src/data/mileageShop";
import { SHOP_PRODUCTS } from "../../src/data/products";
import { STAMINA_GEM_PRICING } from "../../src/core/staminaGemPricing";
import { findItem } from "../../src/data/items";
import { TRADE_GEM_RATE, tradeGemValue } from "../../src/data/tradePackages";
import { BANNERS, LIMITED_RELIC_IDS } from "../../src/data/banners";
import { PLAYABLE_RELICS } from "../../src/data/relics";
import { TOP_BAR_SLOT_KEYS } from "../../src/ui/topBarSlots";
import KO from "../../src/i18n/ko";
import { SHOP_STAGE_PRESENTATION } from "../../src/data/shopPresentation";

describe("DNA 마일리지 적립", () => {
  it("뽑기 한 번마다 1을 쌓고 풀돌 중복은 등급이 정한 몫을 더한다", () => {
    expect(MILEAGE_PER_PULL).toBe(1);
    expect(mileageForPull(1, 0)).toBe(1);
    expect(mileageForPull(10, 0)).toBe(10);
    expect(mileageForPull(10, MILEAGE_OVERFLOW_BY_RARITY.SSR + MILEAGE_OVERFLOW_BY_RARITY.R)).toBe(10 + 30 + 2);
    expect(MILEAGE_OVERFLOW_BY_RARITY).toEqual({ SSR: 30, SR: 8, R: 2 });
  });
});

describe("마일리지 점원", () => {
  it("한정과 지금 픽업 중인 SSR은 후보에서 빠진다", () => {
    const pool = mileageClerkPool();
    expect(pool.length).toBeGreaterThan(0);
    const pickups = new Set(BANNERS.flatMap((banner) => banner.pickupRelicIds.SSR ?? []));
    for (const id of pool) {
      expect(LIMITED_RELIC_IDS.has(id), id).toBe(false);
      expect(pickups.has(id), id).toBe(false);
      expect(PLAYABLE_RELICS.find((relic) => relic.id === id)?.rarity).toBe("SSR");
    }
  });

  it("주는 월요일 00:00 UTC에 바뀌고 한 주 안에서는 같은 점원이다", () => {
    const sunday = new Date("2026-10-04T23:59:59Z");
    const monday = new Date("2026-10-05T00:00:00Z");
    expect(mileageWeekIndex(monday)).toBe(mileageWeekIndex(sunday) + 1);
    expect(mileageWeeklyClerkId(new Date("2026-10-05T00:00:00Z"))).toBe(mileageWeeklyClerkId(new Date("2026-10-11T23:59:59Z")));
    const pool = mileageClerkPool();
    // 후보 수만큼 주가 지나면 한 바퀴를 돈다.
    const start = new Date("2026-10-05T00:00:00Z");
    const later = new Date(start.getTime() + pool.length * 7 * 86_400_000);
    expect(mileageWeeklyClerkId(later)).toBe(mileageWeeklyClerkId(start));
    expect(new Set(Array.from({ length: pool.length }, (_, week) => mileageWeeklyClerkId(new Date(start.getTime() + week * 7 * 86_400_000)))).size).toBe(pool.length);
  });

  it("후보 모두가 상태 대사 네 줄을 갖는다", () => {
    for (const id of mileageClerkPool()) {
      for (let line = 1; line <= MILEAGE_CLERK_LINE_COUNT; line += 1) {
        expect((KO as Record<string, string>)[`mileage.clerk.${id}.${line}`], `${id}.${line}`).toBeTruthy();
      }
    }
  });
});

describe("마일리지 상점 상품", () => {
  it("모든 상품이 마일리지로 값을 받고 마일리지 상점에만 선다", () => {
    expect(MILEAGE_PRODUCTS.length).toBeGreaterThan(0);
    for (const product of MILEAGE_PRODUCTS) {
      expect(product.storefront, product.id).toBe("mileage");
      expect(product.acquisition, product.id).toMatchObject({ kind: "currency", currency: "dnaFragments" });
      expect(product.refresh, product.id).toBe(product.category);
      expect(SHOP_PRODUCTS).toContain(product);
    }
    expect(MILEAGE_PRODUCTS.some((p) => p.category === "weekly")).toBe(true);
    expect(MILEAGE_PRODUCTS.some((p) => p.category === "daily")).toBe(true);
  });

  it("값이 환산되는 상품은 낸 값의 1.0~1.25배 안이고 한 번에 마일리지 2 이상이 든다", () => {
    // 에너지 드링크는 젬 충전의 가장 싼 1단계(젬 50 → 스테미나 60)로 잰다.
    const perStamina = STAMINA_GEM_PRICING.baseCost / 60;
    for (const product of MILEAGE_PRODUCTS) {
      if (product.acquisition.kind !== "currency") continue;
      // 젬으로 환산할 수 없는 항목(주간 SSR 파편·발굴권·핵·토벌권)은 제외한다.
      const convertible = product.grants.every((grant) => grant.kind === "currency" || (grant.kind === "item" && findItem(grant.itemId)?.useEffect.kind === "restore_stamina"));
      if (!convertible) continue;
      const paid = product.acquisition.amount / TRADE_GEM_RATE.dnaFragments;
      const value = tradeGemValue(product.grants) + product.grants.reduce((sum, grant) => {
        if (grant.kind !== "item") return sum;
        const effect = findItem(grant.itemId)?.useEffect;
        return effect?.kind === "restore_stamina" ? sum + effect.amount * grant.amount * perStamina : sum;
      }, 0);
      expect(value, product.id).toBeGreaterThanOrEqual(paid - 1e-9);
      expect(value, product.id).toBeLessThanOrEqual(paid * 1.25 + 1e-9);
      if (product.grants.some((grant) => grant.kind === "item" || grant.kind === "currency") && !product.id.includes("fossil") && !product.id.includes("amber")) {
        expect(product.acquisition.amount, product.id).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("기한이 있는 에너지 드링크는 7일이다", () => {
    for (const product of MILEAGE_PRODUCTS) {
      for (const grant of product.grants) {
        if (grant.kind === "item" && findItem(grant.itemId)?.useEffect.kind === "restore_stamina") expect(grant.expiresInDays, product.id).toBe(7);
      }
    }
  });

  it("SSR 파편은 100~200, 화석·호박석은 5이고 주간 10개까지다", () => {
    const find = (id: string) => MILEAGE_PRODUCTS.find((product) => product.id === id)!;
    const price = (id: string) => (find(id).acquisition as { amount: number }).amount;
    expect(price("mileage-weekly-ssr")).toBeGreaterThanOrEqual(100);
    expect(price("mileage-weekly-ssr")).toBeLessThanOrEqual(200);
    for (const id of ["mileage-weekly-fossil", "mileage-weekly-amber"]) {
      expect(price(id), id).toBe(5);
      expect(find(id).purchaseLimit, id).toBe(10);
    }
  });

  it("SR·R 파편은 SSR 파편과 같은 5배 비율(중복 마일리지 × 5)이다", () => {
    const price = (id: string) => (MILEAGE_PRODUCTS.find((product) => product.id === id)!.acquisition as { amount: number }).amount;
    expect(price("mileage-weekly-sr")).toBe(MILEAGE_OVERFLOW_BY_RARITY.SR * 5);
    expect(price("mileage-daily-r")).toBe(MILEAGE_OVERFLOW_BY_RARITY.R * 5);
    expect(price("mileage-weekly-ssr")).toBe(MILEAGE_OVERFLOW_BY_RARITY.SSR * 5);
  });

  it("주간 SR·일간 R 파편은 기간 안에서 같은 개체이고 후보 안에서 돈다", () => {
    const day = new Date("2026-10-07T01:00:00Z");
    expect(mileageRotatingFragmentId("R", "daily", day)).toBe(mileageRotatingFragmentId("R", "daily", new Date("2026-10-07T23:59:59Z")));
    expect(mileageRotatingFragmentId("SR", "weekly", day)).toBe(mileageRotatingFragmentId("SR", "weekly", new Date("2026-10-11T23:59:59Z")));
    for (const [rarity, period] of [["SR", "weekly"], ["R", "daily"]] as const) {
      const seen = new Set(Array.from({ length: 60 }, (_, index) => mileageRotatingFragmentId(rarity, period, new Date(day.getTime() + index * (period === "weekly" ? 7 : 1) * 86_400_000))));
      expect(seen.size, rarity).toBeGreaterThan(1);
      for (const id of seen) expect(mileageRotationPool(rarity)).toContain(id);
    }
  });

  it("주간 SSR 파편이 주간 구역의 맨 앞에 선다", () => {
    const weekly = MILEAGE_PRODUCTS.filter((product) => product.category === "weekly");
    expect(weekly[0].grants).toEqual([{ kind: "weekly_ssr_fragment", amount: 1 }]);
  });

  it("DNA 마일리지는 프리미엄·무역·전리품 상점에서 팔지 않는다", () => {
    const others = SHOP_PRODUCTS.filter((product) => product.storefront !== "mileage");
    for (const product of others) {
      expect(product.grants.some((grant) => grant.kind === "currency" && grant.currency === "dnaFragments"), product.id).toBe(false);
    }
  });
});

describe("마일리지 상점 화면 구성", () => {
  it("상단 재화는 DNA 마일리지 한 칸뿐이다", () => {
    expect(TOP_BAR_SLOT_KEYS.mileage).toEqual(["dnaFragments"]);
  });

  it("무대 표는 주간·일간 두 탭과 홀로그램 점원을 가진다", () => {
    const stage = SHOP_STAGE_PRESENTATION.mileage;
    expect(stage.tabs.map((tab) => tab.id)).toEqual(["daily", "weekly"]);
    expect(stage.hologram).toBe(true);
    expect(stage.currencies).toBe("mileage");
  });
});
