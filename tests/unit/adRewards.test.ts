import { describe, expect, it } from "vitest";
import { AD_REWARD_SLOTS, completedAdToken, findAdRewardSlot } from "../../src/data/adRewards";

/** 광고 운영표가 희소 가챠 재화를 우회 지급하지 못하도록 허용 목록을 고정한다. */
describe("광고 보상 정적 정의", () => {
  it("스테미나와 치즈케이크만 양의 정수로 지급한다", () => {
    const currencies = AD_REWARD_SLOTS.flatMap(({ reward }) => reward.kind === "currency" ? [reward.currency] : []);
    expect(new Set(currencies)).toEqual(new Set(["stamina", "cheesecake"]));
    expect(AD_REWARD_SLOTS.every(({ reward, dailyLimitUtc }) => (reward.kind !== "currency" || Number.isInteger(reward.amount) && reward.amount > 0) && Number.isInteger(dailyLimitUtc) && dailyLimitUtc > 0)).toBe(true);
    expect(findAdRewardSlot("daily-stamina")?.placement).toBe("shop_free_supplies");
  });

  it("발굴 슬롯의 일회·갱신·만료 정책을 판별 가능한 효과로 고정한다", () => {
    const effects = AD_REWARD_SLOTS.filter((slot) => slot.placement === "idle_excavation").map((slot) => slot.reward.kind === "excavation_effect" ? slot.reward.effect : undefined);
    expect(effects).toEqual([
      { kind: "harvest_multiplier", multiplier: 1.5, appliesTo: "current_confirmed_harvest_once" },
      { kind: "storage_extension", maxStorageSeconds: 28_800, appliesTo: "next_settlement_window" },
      { kind: "production_speed", multiplier: 2, durationSeconds: 3_600, refresh: "replace_expiry" },
    ]);
  });

  it("광고 취소·SDK 실패·재고 없음은 검증 토큰 없이 기본 흐름으로 돌아간다", () => {
    expect(completedAdToken({ status: "dismissed" })).toBeUndefined();
    expect(completedAdToken({ status: "failed" })).toBeUndefined();
    expect(completedAdToken({ status: "unavailable" })).toBeUndefined();
    expect(completedAdToken({ status: "completed", verificationToken: "verified" })).toBe("verified");
  });
});
