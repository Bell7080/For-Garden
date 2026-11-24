import { describe, expect, it } from "vitest";
import { passCardReward } from "../../src/ui/passPopupModel";
import { LOBBY_PASS_CARD } from "../../src/ui/passPopupLayout";
import type { ProgressPassMilestoneDto } from "../../src/api/contracts";

const gold = (amount: number) => ({ kind: "currency", currency: "gold", amount }) as const;
const gems = (amount: number) => ({ kind: "currency", currency: "gems", amount }) as const;
const step = (threshold: number, freeState: ProgressPassMilestoneDto["freeState"], state: ProgressPassMilestoneDto["state"]): ProgressPassMilestoneDto =>
  ({ threshold, free: [gold(threshold * 100)], freeState, rewards: [gems(threshold * 10)], state });

describe("로비 패스 카드의 보상 액자", () => {
  it("받을 칸이 있으면 그 첫 칸을 「ready」로 보인다 — 무료 칸이 먼저다", () => {
    const pick = passCardReward({ owned: true, milestones: [step(1, "claimed", "claimed"), step(2, "claimable", "claimable"), step(3, "locked", "locked")] });
    expect(pick).toEqual({ grants: [gold(200)], state: "ready" });
  });

  it("무료를 받고 유료만 남았으면 유료 칸이다", () => {
    const pick = passCardReward({ owned: true, milestones: [step(1, "claimed", "claimable"), step(2, "locked", "locked")] });
    expect(pick).toEqual({ grants: [gems(10)], state: "ready" });
  });

  it("받을 것이 없으면 다음 마디 — 연 패스는 유료, 아니면 무료 칸이다", () => {
    const milestones = [step(1, "claimed", "reached"), step(2, "locked", "locked")];
    expect(passCardReward({ owned: false, milestones })).toEqual({ grants: [gold(200)], state: "next" });
    expect(passCardReward({ owned: true, milestones: [step(1, "claimed", "claimed"), step(2, "locked", "locked")] })).toEqual({ grants: [gems(20)], state: "next" });
  });

  it("끝까지 받았으면 마지막 칸을 「done」으로 흐리게 세운다", () => {
    expect(passCardReward({ owned: false, milestones: [step(1, "claimed", "reached"), step(2, "claimed", "reached")] })).toEqual({ grants: [gold(200)], state: "done" });
    expect(passCardReward({ owned: false, milestones: [] })).toBeUndefined();
  });
});

describe("로비 패스 카드 배치", () => {
  const C = LOBBY_PASS_CARD;
  it("액자와 글·게이지가 판 안쪽 여백 안에 들고 서로 겹치지 않는다", () => {
    const frameRight = -C.width / 2 + C.frame.left + C.frame.size;
    expect(-C.width / 2 + C.frame.left).toBeGreaterThanOrEqual(-C.width / 2 + C.height * C.bevel);
    expect(Math.abs(C.frame.y) + C.frame.size / 2).toBeLessThanOrEqual(C.height / 2 - 8);
    expect(C.contentLeft).toBeGreaterThan(frameRight + 12);
    expect(C.contentRight).toBeLessThanOrEqual(C.width / 2 - 14);
    expect(C.nameY - C.nameSize / 2).toBeGreaterThanOrEqual(-C.height / 2 + 8);
    expect(C.noteY + C.noteSize / 2).toBeLessThanOrEqual(C.height / 2 - 8);
  });

  it("넘김 표식은 카드 밖에 떠 있지 않고 판 안 밑줄에 선다", () => {
    expect(C.pager.y + C.pager.height / 2).toBeLessThanOrEqual(C.height / 2 - 6);
    expect(C.pager.y).toBeGreaterThan(C.gauge.y);
  });
});
