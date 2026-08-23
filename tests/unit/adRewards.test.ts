import { describe, expect, it } from "vitest";
import { AD_REWARD_SLOTS, findAdRewardSlot } from "../../src/data/adRewards";

/** 광고 운영표가 희소 가챠 재화를 우회 지급하지 못하도록 허용 목록을 고정한다. */
describe("광고 보상 정적 정의", () => {
  it("스테미나와 치즈케이크만 양의 정수로 지급한다", () => {
    expect(new Set(AD_REWARD_SLOTS.map(({ reward }) => reward.currency))).toEqual(new Set(["stamina", "cheesecake"]));
    expect(AD_REWARD_SLOTS.every(({ reward, dailyLimitUtc }) => Number.isInteger(reward.amount) && reward.amount > 0 && Number.isInteger(dailyLimitUtc) && dailyLimitUtc > 0)).toBe(true);
    expect(findAdRewardSlot("daily-stamina")?.placement).toBe("shop_free_supplies");
  });
});
