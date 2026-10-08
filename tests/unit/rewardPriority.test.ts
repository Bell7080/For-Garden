import { describe, expect, it } from "vitest";
import { ITEMS } from "../../src/data/items";
import { REWARD_PRIORITY, rewardRank, sortByRewardPriority } from "../../src/data/rewardPriority";
import { currencyRecordToRewardItems, productGrantsToRewardItems } from "../../src/ui/rewardPopupModel";
import { sortMailRewards } from "../../src/ui/mailPopupLayout";
import { CURRENCY_ICON_BY_WALLET } from "../../src/ui/currencyIcons";
import { progressPassPaidTiles } from "../../src/ui/premiumModel";

describe("보상 중요도 표", () => {
  it("젬 → 화석 → 호박석 → 골드 → 치즈케이크 순이다", () => {
    const order = ["gems", "fossil", "amber", "gold", "cheesecake"];
    expect(order.map(rewardRank)).toEqual([0, 1, 2, 3, 4]);
  });

  it("지갑 재화와 가방 아이템이 모두 표에 있다(룬 정의 제외)", () => {
    for (const wallet of Object.keys(CURRENCY_ICON_BY_WALLET)) expect(REWARD_PRIORITY).toContain(wallet);
    for (const item of ITEMS.filter((entry) => entry.id !== "rune" && entry.icon.kind !== "currency")) expect(REWARD_PRIORITY, item.id).toContain(item.id);
  });

  it("토벌 증표·인양 기록은 치즈케이크보다 뒤이고 파편·룬·장식이 맨 끝이다", () => {
    expect(rewardRank("raidSigil")).toBeGreaterThan(rewardRank("cheesecake"));
    expect(rewardRank("salvageRecord")).toBeGreaterThan(rewardRank("raidSigil") - 1);
    for (const single of ["relicFragment", "rune", "profileDecoration"]) expect(rewardRank(single)).toBeGreaterThan(rewardRank("salvageRecord"));
  });

  it("같은 순위는 원래 순서를 지키고 모르는 키는 맨 뒤다", () => {
    expect(sortByRewardPriority(["x", "gold", "y", "gems"], (k) => k)).toEqual(["gems", "gold", "x", "y"]);
  });

  it("재화 영수증은 객체 키 순서와 무관하게 중요도 순이다", () => {
    const items = currencyRecordToRewardItems({ raidSigil: 5, cheesecake: 100, salvageRecord: 2, gold: 9, gems: 1, fossil: 3 });
    expect(items.map((item) => item.icon)).toEqual(["currency-gems", "currency-fossil", "currency-gold", "currency-cheesecake", "currency-raid-sigil", "currency-salvage-record"]);
  });

  it("상품 지급은 재화·아이템·룬·파편을 한 표로 섞어 정렬한다", () => {
    const items = productGrantsToRewardItems([
      { kind: "relic_fragment", relicId: "torika", amount: 5 },
      { kind: "currency", currency: "raidSigil", amount: 10 },
      { kind: "item", itemId: "strata-ticket", name: "발굴권", amount: 5 },
      { kind: "currency", currency: "cheesecake", amount: 100 },
      { kind: "currency", currency: "gems", amount: 50 },
    ]);
    expect(items.map((item) => item.icon)).toEqual(["currency-gems", "currency-cheesecake", "item-strata-ticket", "currency-raid-sigil", ""]);
  });

  it("우편 첨부와 패스 합계도 같은 표를 읽는다", () => {
    const mail = sortMailRewards([
      { kind: "currency" as const, currency: "raidSigil" as const, amount: 1 },
      { kind: "item" as const, itemId: "sweep-ticket", amount: 1 },
      { kind: "currency" as const, currency: "gold" as const, amount: 1 },
    ]);
    expect(mail.map((reward) => (reward.kind === "currency" ? reward.currency : reward.itemId))).toEqual(["gold", "sweep-ticket", "raidSigil"]);
    const tiles = progressPassPaidTiles([
      { kind: "currency", currency: "cheesecake", amount: 9999 },
      { kind: "currency", currency: "gems", amount: 1 },
    ]);
    expect(tiles.map((tile) => tile.icon)).toEqual(["currency-gems", "currency-cheesecake"]);
  });
});
