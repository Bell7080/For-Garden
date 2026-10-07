import { describe, expect, it } from "vitest";
import { AD_REWARD_SLOTS } from "../../src/data/adRewards";
import { PREMIUM_PRODUCTS } from "../../src/data/premiumProducts";
import { PROGRESS_PASSES } from "../../src/data/progressPasses";
import { isCleanPaidAmount, paidAmountUnit } from "../../src/core/paidAmountUnit";

describe("유료 상품 수량 단위", () => {
  it("단위 표", () => {
    expect([5, 50, 600, 3_500, 30_000, 150_000].map(paidAmountUnit)).toEqual([1, 5, 50, 500, 5_000, 50_000]);
    expect(isCleanPaidAmount(31_000)).toBe(false);
    expect(isCleanPaidAmount(2_400)).toBe(false);
    expect(isCleanPaidAmount(30_000)).toBe(true);
  });

  it("모든 프리미엄 상품의 지급·첫 구매 보너스·매일 몫이 단위에 맞는다", () => {
    const bad: string[] = [];
    for (const product of PREMIUM_PRODUCTS) {
      const rows = [...product.grants, ...(product.firstPurchaseBonus ?? [])];
      for (const grant of rows) if ((grant.kind === "currency" || grant.kind === "item") && !isCleanPaidAmount(grant.amount)) bad.push(`${product.id}:${grant.amount}`);
      const daily = product.passBenefit?.dailyBonus;
      if (daily && !isCleanPaidAmount(daily.amount)) bad.push(`${product.id}:daily:${daily.amount}`);
    }
    expect(bad).toEqual([]);
  });

  it("패스 유료 칸과 광고 슬롯의 재화도 단위에 맞는다", () => {
    const bad: string[] = [];
    for (const pass of PROGRESS_PASSES) for (const m of pass.milestones) for (const grant of m.rewards) {
      if ((grant.kind === "currency" || grant.kind === "item") && !isCleanPaidAmount(grant.amount)) bad.push(`${pass.id}:${m.threshold}:${grant.amount}`);
    }
    for (const slot of AD_REWARD_SLOTS) if (slot.reward.kind === "currency" && (slot.reward.currency === "gems" || slot.reward.currency === "gold") && !isCleanPaidAmount(slot.reward.amount)) bad.push(slot.id);
    expect(bad).toEqual([]);
  });

  it("원석은 고고학 지원 패키지에만 든다", () => {
    for (const product of PREMIUM_PRODUCTS) {
      if (product.id === "premium-archaeology-support") continue;
      for (const grant of product.grants) expect(grant.kind === "currency" ? grant.currency : "", product.id).not.toBe("rawStone");
    }
  });
});
