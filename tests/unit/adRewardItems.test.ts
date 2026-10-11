import { describe, expect, it } from "vitest";
import { adRewardToRewardItems } from "../../src/ui/rewardPopupModel";

describe("광고 보상 영수증", () => {
  it("재화 광고는 서버 지갑 차이를 그대로 액자로 만든다", () => {
    const items = adRewardToRewardItems({ reward: { kind: "currency", currency: "gems", amount: 50 }, granted: { gems: 50 } });
    expect(items).toEqual([{ icon: "currency-gems", amount: 50 }]);
  });
  it("가방 아이템과 결투 도전권은 슬롯 정의에서 읽는다", () => {
    expect(adRewardToRewardItems({ reward: { kind: "item", itemId: "sweep-ticket", quantity: 5 }, granted: {} })).toHaveLength(1);
    expect(adRewardToRewardItems({ reward: { kind: "duel_attempt", quantity: 1 }, granted: {} })).toHaveLength(1);
  });
  it("일간 보급 추가는 재화와 아이템을 함께 보인다", () => {
    const items = adRewardToRewardItems({ reward: { kind: "currencies", grants: [{ currency: "gold", amount: 10_000 }], items: [{ itemId: "stamina-tonic", quantity: 1 }] }, granted: { gold: 10_000 } });
    expect(items).toHaveLength(2);
  });
});
