import { describe, expect, it } from "vitest";
import { RAID_SETTLEMENT_POPUP, raidSettlementHeight, raidSettlementSummary } from "../../src/ui/raidSettlementLayout";

describe("레이드 정산 창", () => {
  it("기여도 → 정산 보상 → 내 점수가 위에서부터 겹치지 않고 쌓인다", () => {
    const { head, contribution: c, reward, score } = RAID_SETTLEMENT_POPUP;
    expect(head.y + head.nameSize / 2).toBeLessThan(c.titleY - 20);
    expect(c.participantsY + c.participantsSize / 2).toBeLessThan(reward.titleY - 20);
    expect(c.barY + c.barHeight / 2).toBeLessThan(reward.titleY - 20);
    expect(reward.frameY + reward.frame / 2).toBeLessThan(score.hairlineY);
    expect(score.labelY + score.labelSize / 2).toBeLessThan(score.valueY - score.valueSize / 2);
    expect(raidSettlementHeight()).toBe(score.valueY + score.valueSize / 2 + RAID_SETTLEMENT_POPUP.bottomPad);
    // 두 묶음이 창 안에서 서로 겹치지 않는다.
    expect(c.rightX - c.barWidth / 2).toBeGreaterThan(c.leftX + 80);
    expect(c.rightX + c.barWidth / 2).toBeLessThan(RAID_SETTLEMENT_POPUP.width / 2 - 20);
  });

  it("순위·인원·몫은 서버가 준 판에서 읽기만 한다", () => {
    const entries = [
      { rank: 1, playerId: "a", displayName: "A", damage: 600, isMe: false },
      { rank: 2, playerId: "me", displayName: "나", damage: 300, isMe: true },
      { rank: 3, playerId: "b", displayName: "B", damage: 100, isMe: false },
    ];
    expect(raidSettlementSummary({ entries, myDamage: 300, dealtDamage: 1000 })).toEqual({ rank: 2, participants: 3, sharePercent: 30, score: 300 });
    // 깎인 것이 없으면 몫은 0이고, 목록에 없으면 순위를 비운다.
    expect(raidSettlementSummary({ entries: [], myDamage: 0, dealtDamage: 0 })).toEqual({ rank: undefined, participants: 0, sharePercent: 0, score: 0 });
    // 몫은 100%를 넘지 않는다.
    expect(raidSettlementSummary({ entries, myDamage: 2000, dealtDamage: 1000 }).sharePercent).toBe(100);
  });
});
