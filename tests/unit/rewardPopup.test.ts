import { describe, expect, it } from "vitest";
import { currencyRecordToRewardItems, productGrantsToRewardItems, rewardItemExpiry } from "../../src/ui/rewardPopupModel";

describe("공용 보상 팝업 표시 모델", () => {
  it("음료 두 종류는 기본 7일 기한을 표시하고 기한 없는 보상은 표시하지 않는다", () => {
    for (const icon of ["item-stamina-tonic", "item-stamina-tonic-large"]) expect(rewardItemExpiry({ icon, amount: 1 })).toEqual({ days: 7 });
    expect(rewardItemExpiry({ icon: "currency-gems", amount: 100 })).toBeUndefined();
    expect(rewardItemExpiry({ icon: "item-ancient-core", amount: 1 })).toBeUndefined();
  });

  it("지급처별 기한과 정확한 만료 시각을 기본 7일보다 우선한다", () => {
    const [item] = productGrantsToRewardItems([{ kind: "item", itemId: "stamina-tonic", name: "음료", amount: 2, expiresInDays: 3 }]);
    expect(rewardItemExpiry(item)).toEqual({ days: 3 });
    const expiresAt = "2026-10-20T12:00:00Z";
    expect(rewardItemExpiry({ ...item, expiresAt })).toEqual({ expiresAt });
    expect(rewardItemExpiry({ ...item, expiresAt: "invalid" })).toBeUndefined();
  });
  it("공용 DNA 조각을 전용 DNA 재화 아이콘으로 보존한다", () => {
    // 과거 누락된 지갑 키가 양수인 경우 정확히 한 칸으로 변환되는지 고정한다.
    expect(currencyRecordToRewardItems({ dnaFragments: 5 })).toEqual([{ icon: "currency-dna", amount: 5 }]);
  });

  it("원정 종료 전에 서로 다른 재화의 수량을 개별 액자로 유지한다", () => {
    const items = currencyRecordToRewardItems({ gold: 120, cheesecake: 4, gems: 2, fossil: 0, salvageRecord: 5 });
    expect(items).toHaveLength(4);
    expect(items).toEqual(expect.arrayContaining([
      { icon: "currency-gold", amount: 120 },
      { icon: "currency-cheesecake", amount: 4 },
      { icon: "currency-gems", amount: 2 },
      { icon: "currency-salvage-record", amount: 5 },
    ]));
  });

  it("서버 상품 영수증의 재화·아이템·룬·프로필 장식을 정의 재계산 없이 변환한다", () => {
    // amount는 구매 수량을 다시 곱하지 않고 서버가 준 확정 총량 그대로여야 한다.
    expect(productGrantsToRewardItems([
      { kind: "currency", currency: "cheesecake", amount: 200 },
      { kind: "item", itemId: "ancient-core", name: "미지의 고대 핵", amount: 3 },
      { kind: "rune", name: "희귀 룬", amount: 1, rarity: "rare", part: 1 },
      { kind: "profile_decoration", decorationId: "badge", name: "연구원 명찰" },
    ])).toEqual([
      { icon: "currency-cheesecake", amount: 200 },
      { icon: "item-ancient-core", amount: 3 },
      { icon: "rune-rare-1", amount: 1, label: "희귀 룬" },
      { icon: { kind: "glyph", key: "costume" }, amount: 1, label: "연구원 명찰" },
    ]);
  });
});
