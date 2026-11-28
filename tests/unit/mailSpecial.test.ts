import { describe, expect, it } from "vitest";
import { arenaTierOfScore, legacyMailSpecial, mailContentOf, mailSpecialFromKind } from "../../src/core/mailCategory";
import { arenaSeasonResetScore } from "../../src/core/arenaStanding";
import { mailSpecialBadge, mailSpecialTone } from "../../src/ui/mailSpecialStyle";
import { sortMails } from "../../src/ui/mailPopupLayout";
import type { MailDto } from "../../src/api/contracts";

describe("특수 우편 갈래", () => {
  it("서버가 실은 kind·meta를 검증해 옮기고 모르는 값은 버린다", () => {
    expect(mailSpecialFromKind("duelTier", { tier: "gold", period: "2026-11-16", score: 900 })).toEqual({ kind: "duelTier", tier: "gold", period: "2026-11-16" });
    expect(mailSpecialFromKind("duelRank", { rank: 3, period: "2026-11" })).toEqual({ kind: "duelRank", rank: 3, period: "2026-11" });
    expect(mailSpecialFromKind("arenaRank", { rank: -1, tier: "<script>", period: "nope" })).toEqual({ kind: "arenaRank" });
    expect(mailSpecialFromKind("notice", {})).toBeUndefined();
    expect(mailSpecialFromKind(undefined, undefined)).toBeUndefined();
  });

  it("kind 열이 없던 예전 우편은 정해진 문구로 되짚는다", () => {
    expect(legacyMailSpecial({ id: "x", title: "결투장 주간 순위 보상", body: "2026-11-09 주간 · 12위" })).toEqual({ kind: "duelRank", rank: 12, period: "2026-11-09" });
    expect(legacyMailSpecial({ id: "expedition-rank:2026-11-09", title: "아무 제목", body: "" })).toEqual({ kind: "expeditionRank", period: "2026-11-09" });
    expect(legacyMailSpecial({ id: "y", title: "아레나 주간 보상", body: "2026-11-09 주간 · 1500 RP · 4위" })?.tier).toBe(arenaTierOfScore(1500));
    expect(legacyMailSpecial({ id: "z", title: "운영자가 쓴 안내", body: "3위" })).toBeUndefined();
  });

  it("콘텐츠마다 색과 원화가 다르고 티어 우편은 휘장, 순위 우편은 메달이다", () => {
    expect(mailContentOf("arenaTier")).toBe("arena");
    expect(mailSpecialTone({ kind: "duelRank" }).color).not.toBe(mailSpecialTone({ kind: "arenaRank" }).color);
    expect(mailSpecialBadge({ kind: "duelTier", tier: "gold" })).toEqual({ kind: "tier", tier: "gold" });
    expect(mailSpecialBadge({ kind: "duelRank", rank: 2 })).toEqual({ kind: "rank", rank: 2 });
    expect(mailSpecialBadge({ kind: "guildRank" })).toEqual({ kind: "content" });
  });
});

describe("아레나 월간 소프트 초기화", () => {
  it("1000 위 몫의 절반만 남기고 50점 단위로 끊는다", () => {
    expect(arenaSeasonResetScore(2400)).toBe(1700);
    expect(arenaSeasonResetScore(1290)).toBe(1100);
    expect(arenaSeasonResetScore(900)).toBe(1000);
  });
});

describe("우편 정렬", () => {
  const now = Date.parse("2026-11-28T00:00:00Z");
  const mail = (id: string, sentAt: string, expiresAt: string | null, claimed = false): MailDto => ({
    id, title: id, sender: "", body: "", sentAt, expiresAt, read: false, claimed,
    rewards: [{ kind: "currency", currency: "gems", amount: 10 } as never],
  });
  it("곧 사라질 받을 우편이 먼저, 그다음 최근 순, 받은 것은 아래다", () => {
    const rows = sortMails([
      mail("new", "2026-11-27T00:00:00Z", "2026-12-20T00:00:00Z"),
      mail("soon", "2026-11-01T00:00:00Z", "2026-11-29T00:00:00Z"),
      mail("done", "2026-11-27T12:00:00Z", null, true),
      mail("old", "2026-11-10T00:00:00Z", null),
    ], "reward", now);
    expect(rows.map((m) => m.id)).toEqual(["soon", "new", "old", "done"]);
  });
});
