import { describe, expect, it } from "vitest";
import { BASE_HEIGHT, BASE_WIDTH } from "../../src/config/gameConfig";
import { ACHIEVEMENT_CATEGORIES, ACHIEVEMENT_SERIES } from "../../src/data/achievements";
import { ACHIEVEMENTS_POPUP_LAYOUT, achievementListContentHeight, achievementsTabStrip, orderAchievements } from "../../src/ui/achievementsPopupLayout";

describe("업적 창", () => {
  const { popup, summary, list, footer } = ACHIEVEMENTS_POPUP_LAYOUT;
  const height = BASE_HEIGHT - popup.heightInset;
  const width = BASE_WIDTH - popup.widthInset;

  it("의 요약·목록·탭·버튼은 몸판 안에서 서로 겹치지 않는다", () => {
    expect(summary.panelY - summary.panelHeight / 2).toBeGreaterThan(-height / 2);
    expect(summary.panelY + summary.panelHeight / 2).toBeLessThan(list.top);
    expect(list.bottom).toBeLessThan(footer.tabY - footer.tab.height / 2);
    expect(footer.tabY + footer.tab.height / 2).toBeLessThan(footer.claim.y - footer.claim.height / 2);
    expect(footer.claim.y + footer.claim.height / 2).toBeLessThan(height / 2);
  });

  it("의 탭 줄 창은 판 안에 들고 오른쪽 아래 뒤로가기 자리를 비운다", () => {
    const spec = achievementsTabStrip();
    expect(spec.count).toBe(ACHIEVEMENT_CATEGORIES.length + 1);
    expect(spec.left).toBeGreaterThan(-width / 2);
    expect(spec.right).toBeLessThan(width / 2 - 60);
  });

  it("의 탭은 촘촘히 박지 않고 넓게 세워 옆으로 흐른다", () => {
    const spec = achievementsTabStrip();
    expect(spec.width).toBeGreaterThanOrEqual(180);
    expect(spec.count * spec.width + (spec.count - 1) * spec.gap).toBeGreaterThan(spec.right - spec.left);
  });

  it("의 목록은 모든 업적을 창 안에서 흘린다", () => {
    expect(achievementListContentHeight(ACHIEVEMENT_SERIES.length)).toBeGreaterThan(list.bottom - list.top);
  });

  it("은 받을 것 → 진행 중 → 끝난 것 순이고 같은 무리는 표 순서를 지킨다", () => {
    const rows = [
      { id: "a", claimedTiers: 3, claimableTiers: 0, tierCount: 3 },
      { id: "b", claimedTiers: 0, claimableTiers: 0, tierCount: 3 },
      { id: "c", claimedTiers: 1, claimableTiers: 1, tierCount: 3 },
      { id: "d", claimedTiers: 1, claimableTiers: 0, tierCount: 3 },
    ];
    expect(orderAchievements(rows).map(({ id }) => id)).toEqual(["c", "b", "d", "a"]);
  });
});
