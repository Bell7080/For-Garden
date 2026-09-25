import { describe, expect, it } from "vitest";
import type { MailDto } from "../../src/api/contracts";
import { MAIL_DETAIL_LAYOUT, mailDetailRail, MAIL_POPUP_LAYOUT, mailListRows, mailRewardSlots, mailRewardX, mailTabOf, mailTabX, sortMails } from "../../src/ui/mailPopupLayout";

const mail = (overrides: Partial<MailDto>): MailDto => ({ id: "m", title: "t", sender: "s", body: "b", sentAt: "2026-08-01T00:00:00Z", expiresAt: null, read: false, claimed: false, rewards: [], ...overrides });
const gold = { kind: "currency", currency: "gold", amount: 1 } as const;

describe("우편함 배치", () => {
  it("첨부가 있으면 우편, 없으면 안내다", () => {
    expect(mailTabOf(mail({ rewards: [gold] }))).toBe("reward");
    expect(mailTabOf(mail({}))).toBe("notice");
  });

  it("우편은 받을 것 → 받은 것 → 만료, 같은 무리는 최근 것이 위다", () => {
    const now = Date.parse("2026-08-20T00:00:00Z");
    const list = [
      mail({ id: "expired", rewards: [gold], expiresAt: "2026-08-10T00:00:00Z", sentAt: "2026-08-09T00:00:00Z" }),
      mail({ id: "claimed", rewards: [gold], claimed: true, sentAt: "2026-08-19T00:00:00Z" }),
      mail({ id: "old", rewards: [gold], sentAt: "2026-08-01T00:00:00Z" }),
      mail({ id: "new", rewards: [gold], sentAt: "2026-08-18T00:00:00Z" }),
      mail({ id: "notice" }),
    ];
    expect(sortMails(list, "reward", now).map(({ id }) => id)).toEqual(["new", "old", "claimed", "expired"]);
    expect(sortMails(list, "notice", now).map(({ id }) => id)).toEqual(["notice"]);
  });

  it("첨부는 일곱 칸까지 서고, 넘치면 여섯 칸 뒤에 +N이 선다 — 적어도 다섯 칸은 보인다", () => {
    expect(mailRewardSlots([1, 2, 3, 4, 5, 6, 7])).toEqual({ shown: [1, 2, 3, 4, 5, 6, 7], overflow: 0 });
    expect(mailRewardSlots([1, 2, 3, 4, 5, 6, 7, 8, 9])).toEqual({ shown: [1, 2, 3, 4, 5, 6], overflow: 3 });
    expect(MAIL_POPUP_LAYOUT.rewards.maxVisible).toBeGreaterThanOrEqual(5);
  });

  it("첨부 줄은 카드 안에서 끝난다 — 줄에는 받기 버튼을 두지 않는다", () => {
    const { card, rewards } = MAIL_POPUP_LAYOUT;
    expect(mailRewardX(0) - rewards.size / 2).toBeGreaterThan(-card.width / 2);
    expect(mailRewardX(rewards.maxVisible - 1) + rewards.size / 2).toBeLessThan(card.width / 2 - 30);
  });

  it("목록 아래에 라벨이, 그 아래 가운데에 일괄 조작이 선다", () => {
    const rows = mailListRows("reward", 3);
    const { card, viewport, footer } = MAIL_POPUP_LAYOUT;
    expect(rows.centers).toEqual([card.rewardHeight / 2, card.rewardHeight * 1.5 + card.gap, card.rewardHeight * 2.5 + card.gap * 2]);
    expect(footer.tabY - footer.tab.height / 2).toBeGreaterThan(viewport.bottom);
    expect(footer.action.y - footer.action.height / 2).toBeGreaterThan(footer.tabY + footer.tab.height / 2);
    expect(footer.action.x).toBe(0);
    expect(mailTabX(0) + mailTabX(1)).toBe(0);
  });

  it("펼친 판은 글 → 첨부 → 받기 차례이고, 첨부가 적으면 가운데로 모이고 많으면 흐른다", () => {
    const L = MAIL_DETAIL_LAYOUT;
    expect(L.body.bottom).toBeLessThan(L.attachTitleY - 26);
    expect(L.rail.y - L.rail.size / 2).toBeGreaterThan(L.attachTitleY + 20);
    expect(L.claim.y - L.claim.height / 2).toBeGreaterThan(L.rail.y + L.rail.size / 2);
    expect(L.claim.y + L.claim.height / 2).toBeLessThan(L.height / 2);
    const few = mailDetailRail(2);
    expect(few.xs[0] + few.xs[1]).toBeCloseTo(0);
    const many = mailDetailRail(9);
    expect(many.contentWidth).toBeGreaterThan(many.viewWidth);
    expect(many.xs[0] - L.rail.size / 2).toBeCloseTo(-many.viewWidth / 2);
  });
});
