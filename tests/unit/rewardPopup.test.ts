import { describe, expect, it } from "vitest";
import { currencyRecordToRewardItems, productGrantsToRewardItems } from "../../src/ui/rewardPopupModel";

describe("공용 보상 팝업 표시 모델", () => {
  it("공용 DNA 조각을 전용 DNA 재화 아이콘으로 보존한다", () => {
    // 과거 누락된 지갑 키가 양수인 경우 정확히 한 칸으로 변환되는지 고정한다.
    expect(currencyRecordToRewardItems({ dnaFragments: 5 })).toEqual([{ icon: "currency-dna", amount: 5 }]);
  });

  it("서버 상품 영수증의 재화·아이템·룬·프로필 장식을 정의 재계산 없이 변환한다", () => {
    // amount는 구매 수량을 다시 곱하지 않고 서버가 준 확정 총량 그대로여야 한다.
    expect(productGrantsToRewardItems([
      { kind: "currency", currency: "cheesecake", amount: 200 },
      { kind: "item", itemId: "rune-dust", name: "룬 가루", amount: 3 },
      { kind: "rune", name: "희귀 룬", amount: 1, rarity: "rare", part: 1 },
      { kind: "profile_decoration", decorationId: "badge", name: "연구원 명찰" },
    ])).toEqual([
      { icon: "currency-cheesecake", amount: 200 },
      { icon: "item-rune-dust", amount: 3, label: "룬 가루" },
      { icon: "rune-rare-1", amount: 1, label: "희귀 룬" },
      { icon: { kind: "glyph", key: "costume" }, amount: 1, label: "연구원 명찰" },
    ]);
  });
});
