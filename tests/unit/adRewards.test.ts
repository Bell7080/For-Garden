import { describe, expect, it } from "vitest";
import { AD_REWARD_SLOTS, completedAdToken, findAdRewardSlot } from "../../src/data/adRewards";
import { excavationAdOfferDisplayModel } from "../../src/ui/excavationAdOfferModel";
import { createIdleExcavationState, STORAGE_EXTENSION_MULTIPLIER } from "../../src/core/idleExcavation";

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
      { kind: "storage_extension", maxStorageSeconds: 57_600, appliesTo: "next_settlement_window" },
      { kind: "production_speed", multiplier: 1.5, durationSeconds: 3_600, refresh: "replace_expiry" },
    ]);
  });

  /**
   * **확장이 약속하는 시간이 두 곳에 적혀 있다.** 광고 표의 `maxStorageSeconds`와, 실제로 한도를
   * 계산하는 `기본 보관 시간 × STORAGE_EXTENSION_MULTIPLIER`다. 둘이 갈리면 버튼이 약속한
   * 시간과 정산이 담는 시간이 어긋난다 — 기본 보관 시간을 손보는 사람이 광고 문구를
   * 함께 고치도록 여기서 붙잡는다.
   */
  it("보관 확장 광고가 약속한 시간과 정산이 실제로 늘리는 한도가 같다", () => {
    const slot = findAdRewardSlot("excavation-storage");
    const promised = slot?.reward.kind === "excavation_effect" && slot.reward.effect.kind === "storage_extension" ? slot.reward.effect.maxStorageSeconds : 0;
    expect(promised).toBe(createIdleExcavationState().baseStorageSeconds * STORAGE_EXTENSION_MULTIPLIER);
  });

  it("발굴 버튼은 서버 문구 대신 슬롯별 라벨과 사용/한도 상태를 표시한다", () => {
    // 남은 횟수 2는 사용량 0으로, 남은 횟수 0은 사용량 2와 비활성 상태로 바뀌어야 한다.
    expect(excavationAdOfferDisplayModel("excavation-harvest", 2, 2)).toEqual({ label: "생산량 ×1.5", usage: "0/2", used: 0, limit: 2, enabled: true });
    expect(excavationAdOfferDisplayModel("excavation-storage", 2, 0)).toEqual({ label: "보관량 ×2", usage: "2/2", used: 2, limit: 2, enabled: false });
  });

  it("광고 취소·SDK 실패·재고 없음은 검증 토큰 없이 기본 흐름으로 돌아간다", () => {
    expect(completedAdToken({ status: "dismissed" })).toBeUndefined();
    expect(completedAdToken({ status: "failed" })).toBeUndefined();
    expect(completedAdToken({ status: "unavailable" })).toBeUndefined();
    expect(completedAdToken({ status: "completed", verificationToken: "verified" })).toBe("verified");
  });
});

/** 빠른 원정 슬롯은 동적 지급량 대신 서버 계산 비율과 두 기간 한도만 공개한다. */
describe("빠른 원정 광고 정책", () => {
  it("기준 점수나 지급량 필드 없이 고정 비율과 일일·주간 한도를 정의한다", () => {
    const slot = findAdRewardSlot("quick-expedition");
    expect(slot).toMatchObject({ placement: "quick_expedition", dailyLimitUtc: 2, weeklyLimitUtc: 5, reward: { kind: "quick_expedition", scoreRatio: 0.25 } });
    expect(slot?.reward).not.toHaveProperty("score"); expect(slot?.reward).not.toHaveProperty("amount");
  });
});
