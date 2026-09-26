import { describe, expect, it } from "vitest";
import { bountyTierProgress, isBountyTierUnlocked, markBountyTierCleared, nextBountyStep } from "../../src/core/bountyRun";
import { BOUNTY, BOUNTY_ROLE, BOUNTY_TIERS, bountyRoundEnemy, bountyRoundLevel, getBountyTier } from "../../src/data/bounty";
import { applyEncounterScaling } from "../../src/core/levelDesign";
import { getRelic } from "../../src/data/relics";

describe("현상수배 진행 규칙", () => {
  it("은 이긴 라운드만 다음 라운드를 열고 마지막을 이기면 판이 끝난다", () => {
    expect(nextBountyStep(0, true)).toEqual({ kind: "next", round: 1 });
    expect(nextBountyStep(1, true)).toEqual({ kind: "next", round: 2 });
    expect(nextBountyStep(2, true)).toEqual({ kind: "clear" });
  });

  it("은 한 번이라도 지면 남은 라운드를 열지 않는다", () => {
    // 시간을 다 써 무승부로 끝난 라운드도 `won: false`로 들어온다 — 죽이지 못한 것은 이긴 것이 아니다.
    expect(nextBountyStep(0, false)).toEqual({ kind: "defeat", round: 0 });
    expect(nextBountyStep(1, false)).toEqual({ kind: "defeat", round: 1 });
  });

  it("은 바로 앞 등급을 깬 사람에게만 다음 등급을 연다", () => {
    expect(isBountyTierUnlocked(BOUNTY_TIERS[0], [])).toBe(true);
    expect(isBountyTierUnlocked(BOUNTY_TIERS[1], [])).toBe(false);
    expect(isBountyTierUnlocked(BOUNTY_TIERS[1], ["bounty-1"])).toBe(true);
    // 건너뛴 해금은 만들지 않는다 — 3급은 2급을 깨야 열린다.
    expect(isBountyTierUnlocked(BOUNTY_TIERS[2], ["bounty-1"])).toBe(false);
  });

  it("은 잠긴 등급도 목록에서 빼지 않는다", () => {
    const rows = bountyTierProgress(["bounty-1"]);
    expect(rows).toHaveLength(BOUNTY_TIERS.length);
    expect(rows[0]).toMatchObject({ unlocked: true, cleared: true });
    expect(rows[1]).toMatchObject({ unlocked: true, cleared: false });
    expect(rows[2]).toMatchObject({ unlocked: false, cleared: false });
  });

  it("은 같은 등급을 두 번 깨도 목록을 늘리지 않는다", () => {
    const once = markBountyTierCleared({ clearedTierIds: [] }, "bounty-1");
    expect(markBountyTierCleared(once, "bounty-1").clearedTierIds).toEqual(["bounty-1"]);
  });

  it("은 없는 등급을 저장에 남기지 않는다", () => {
    expect(() => markBountyTierCleared({ clearedTierIds: [] }, "bounty-99")).toThrow();
  });
});

describe("현상수배 등급 표", () => {
  it("은 라운드마다 정예 하나만 세운다", () => {
    for (const tier of BOUNTY_TIERS) expect(tier.rounds).toHaveLength(BOUNTY.roundCount);
  });

  it("은 등급이 오를 때 어느 라운드도 가벼워지지 않는다", () => {
    // 레벨이 한 번이라도 내려가면 더 높은 등급이 더 쉬운 자리가 생긴다.
    for (let round = 0; round < BOUNTY.roundCount; round += 1) {
      const levels = BOUNTY_TIERS.map((tier) => bountyRoundLevel(tier.rounds[round]));
      for (let index = 1; index < levels.length; index += 1) expect(levels[index]).toBeGreaterThan(levels[index - 1]);
    }
  });

  it("은 등급이 오를수록 더 많은 골드를 준다", () => {
    const rewards = BOUNTY_TIERS.map(({ rewardGold }) => rewardGold);
    for (let index = 1; index < rewards.length; index += 1) expect(rewards[index]).toBeGreaterThan(rewards[index - 1]);
  });

  it("은 정예를 스테이지와 같은 성장 경로로 세우고 정적 정의를 바꾸지 않는다", () => {
    const round = getBountyTier("bounty-3").rounds[0];
    const base = getRelic(round.relicId);
    const grown = bountyRoundEnemy(round);
    expect(grown.stats).toEqual(applyEncounterScaling(base.stats, bountyRoundLevel(round), BOUNTY_ROLE));
    // 사본만 자란다 — 정적 정의가 함께 오르면 스토리의 같은 개체까지 세진다.
    expect(base.stats).toEqual(getRelic(round.relicId).stats);
  });

  it("은 등급 표가 적는 수를 그대로 싸운다", () => {
    // 표의 수에 무엇도 얹지 않는다 — 곱하거나 더하면 화면에 선 수와 실제로 싸우는 수가 갈린다.
    for (const tier of BOUNTY_TIERS) {
      for (const round of tier.rounds) expect(bountyRoundLevel(round)).toBe(round.level);
    }
  });
});
