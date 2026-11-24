import { describe, expect, it } from "vitest";
import { cosmeticRewardItems, isCosmeticRewardItem, productGrantsToRewardItems } from "../../src/ui/rewardPopupModel";
import { achievementFramesOpened } from "../../src/data/profileFrames";

describe("꾸미기 보상 칸", () => {
  it("수식어·테두리는 재화처럼 영수증 칸 하나씩으로 선다", () => {
    const items = cosmeticRewardItems({ modifierIds: ["rune-master", "없는-수식어"], frameIds: ["patron", "없는-테두리"] });
    expect(items.map((item) => [item.frameId ?? item.modifierId, item.amount])).toEqual([["patron", 1], ["rune-master", 1]]);
    expect(items.every(isCosmeticRewardItem)).toBe(true);
    expect(items.map(({ label }) => label)).toEqual(["첫 후원의 증표", "룬 세공 명장"]);
  });

  it("패스가 다시 준 이미 가진 테두리는 「보유 중」 칸으로 남긴다", () => {
    const [item] = productGrantsToRewardItems([{ kind: "profile_decoration", decorationId: "season", name: "시즌의 날개", alreadyOwned: true }]);
    expect(item).toMatchObject({ frameId: "season", owned: true });
    const [fresh] = productGrantsToRewardItems([{ kind: "profile_decoration", decorationId: "season", name: "시즌의 날개" }]);
    expect(fresh.owned).toBeUndefined();
  });

  it("업적 단계가 새로 연 테두리만 고른다", () => {
    expect(achievementFramesOpened({ "rune-refinement": 3 }, { "rune-refinement": 4 }, 30)).toEqual(["runic"]);
    expect(achievementFramesOpened({ "rune-refinement": 4 }, { "rune-refinement": 5 }, 30)).toEqual([]);
  });
});
