import { describe, expect, it } from "vitest";
import type { MailDto } from "../../src/api/contracts";
import { MAIL_POPUP_LAYOUT, mailListRows, mailRewardSlots, mailRewardX, mailTabOf, mailTabX, sortMails } from "../../src/ui/mailPopupLayout";

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

  it("첨부 줄은 카드 안에서 받기 버튼 앞에서 끝난다", () => {
    const { card, rewards } = MAIL_POPUP_LAYOUT;
    const lastRight = mailRewardX(rewards.maxVisible - 1) + rewards.size / 2;
    const buttonLeft = card.width / 2 - 96 - 70;
    expect(mailRewardX(0) - rewards.size / 2).toBeGreaterThan(-card.width / 2);
    expect(lastRight).toBeLessThan(buttonLeft);
  });

  it("목록 줄은 카드 높이와 간격으로 흐르고, 하단 줄은 목록 창 아래에 선다", () => {
    const rows = mailListRows("reward", 3);
    const { card, viewport, footer } = MAIL_POPUP_LAYOUT;
    expect(rows.centers).toEqual([card.rewardHeight / 2, card.rewardHeight * 1.5 + card.gap, card.rewardHeight * 2.5 + card.gap * 2]);
    expect(footer.y - footer.tab.height / 2).toBeGreaterThan(viewport.bottom);
    expect(mailTabX(1) + footer.tab.width / 2).toBeLessThan(footer.action.x - footer.action.width / 2);
  });
});
