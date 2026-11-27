import { describe, expect, it } from "vitest";
import { achievementFacts, achievementRewardTotals } from "../../src/core/achievements";
import { ACHIEVEMENT_GEM_BUDGET, ACHIEVEMENT_SERIES, GIFT_ACHIEVEMENT_SERIES } from "../../src/data/achievements";
import { GIFT_GIVER_FRAME, isProfileFrameUnlocked } from "../../src/data/profileFrames";
import { createDefaultSession } from "../../src/state/session";
import { GIFT_RECIPIENT_PAGE_SIZE, giftRecipientPage, giftRecipientRows, type GiftRecipientSources } from "../../src/ui/giftRecipientModel";

/** 선물 탭의 받는 사람 고르기 · 선물 업적 · 나눔의 고리 테두리. */
const sources: GiftRecipientSources = {
  friends: [
    { id: "f2", displayName: "나비", level: 12, favoriteRelic: { relicId: "torika" } },
    { id: "f1", displayName: "가람", level: 30, favoriteRelic: { relicId: "dodi" } },
    { id: "f1", displayName: "가람", level: 30, favoriteRelic: { relicId: "dodi" } },
  ],
  guild: [
    { userId: "me", name: "나", level: 40, avatarRelicId: "paru", isMe: true },
    { userId: "g1", name: "다솜", level: 22, avatarRelicId: "torika", isMe: false },
  ],
};

describe("선물 받을 사람 고르기", () => {
  it("친구는 이름순으로 겹치지 않게, 길드는 나를 빼고 선다", () => {
    expect(giftRecipientRows(sources, "friends").map(row => row.id)).toEqual(["f1", "f2"]);
    expect(giftRecipientRows(sources, "guild").map(row => row.id)).toEqual(["g1"]);
  });

  it("쪽은 여섯 줄씩이고 범위를 벗어난 쪽 번호는 안으로 당긴다", () => {
    const rows = Array.from({ length: GIFT_RECIPIENT_PAGE_SIZE + 1 }, (_, i) => ({ id: `p${i}`, name: `p${i}`, level: 1, relicId: "torika" }));
    expect(giftRecipientPage(rows, 0)).toMatchObject({ page: 0, pages: 2 });
    expect(giftRecipientPage(rows, 9).rows.map(row => row.id)).toEqual([`p${GIFT_RECIPIENT_PAGE_SIZE}`]);
    expect(giftRecipientPage([], 3)).toMatchObject({ page: 0, pages: 1, rows: [] });
  });
});

describe("선물 업적과 테두리", () => {
  it("선물 업적을 켜도 업적 젬 예산 안이다", () => {
    const base = achievementRewardTotals().find(({ currency }) => currency === "gems")?.amount ?? 0;
    // 스위치가 켜져 있으므로 선물 업적 보상은 이미 전체 합계에 포함돼 있다.
    expect(ACHIEVEMENT_SERIES).toContain(GIFT_ACHIEVEMENT_SERIES);
    expect(base).toBeLessThanOrEqual(ACHIEVEMENT_GEM_BUDGET);
  });

  it("전달 횟수는 저장이 아니라 서버 맥락에서 읽는다", () => {
    const state = createDefaultSession();
    expect(achievementFacts(state).giftsDelivered).toBe(0);
    expect(achievementFacts(state, { giftsDelivered: 7.8 }).giftsDelivered).toBe(7);
  });

  it("나눔의 고리는 선물 업적 네 단계를 다 받아야 열린다", () => {
    expect(isProfileFrameUnlocked(GIFT_GIVER_FRAME, 60, { "gift-giver": 3 })).toBe(false);
    expect(isProfileFrameUnlocked(GIFT_GIVER_FRAME, 1, { "gift-giver": 4 })).toBe(true);
  });
});
