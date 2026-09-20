import { describe, expect, it } from "vitest";
import { simulateDuel } from "../../src/core/duelBalance";
import { applyLevelGrowth } from "../../src/core/relicProgression";
import { BOUNTY_TIERS, bountyRoundEnemy } from "../../src/data/bounty";
import { PLAYABLE_RELICS } from "../../src/data/relics";
import type { RelicDef } from "../../src/core/types";

/**
 * 현상수배 등급 사다리 검수.
 *
 * 현상수배는 **1대1 세 판**이라 관문 난이도(`stageDifficulty`)가 묻는 "편성 셋이 관문 하나를
 * 넘는가"와 질문이 다르다. 여기서 재는 것은 **그 등급에 상정한 성장 수준에서, 라운드마다
 * 내보낼 개체가 남아 있는가**다 — 편성 칸이 셋이므로 한 라운드를 한 명이 맡고, 세 라운드가
 * 모두 같은 소수의 개체만 이길 수 있으면 그 등급은 길이 아니라 벽이 된다.
 *
 * 값을 눈대중으로 고치지 말고 이 검수를 다시 돌려 표를 갈아 끼운다.
 */

/** 치명타 순서를 달리하는 재현 가능한 표본 셋. 단일 운 좋은 판을 세기로 오인하지 않는다. */
const SEEDS = [1, 2, 3] as const;

/** 등급마다 상정한 플레이어 레벨. 1·2급은 돌파 없는 상한(20) 안이고 그 위는 돌파가 연 자리다. */
const ASSUMED_LEVEL: Readonly<Record<string, number>> = {
  "bounty-1": 15, "bounty-2": 20, "bounty-3": 30, "bounty-4": 40, "bounty-5": 50,
};

const grow = (def: RelicDef, level: number): RelicDef => ({ ...def, stats: applyLevelGrowth(def.stats, level, def.rarity) });

/** 세 seed를 모두 이기는 개체 수. 한 판만 이기는 조합은 "낼 수 있는 개체"로 세지 않는다. */
function reliableWinners(enemy: RelicDef, playerLevel: number): string[] {
  return PLAYABLE_RELICS
    .filter((relic) => SEEDS.every((seed) => simulateDuel(grow(relic, playerLevel), enemy, seed).winner === "left"))
    .map(({ id }) => id);
}

describe("현상수배 등급 검수", () => {
  it("은 등급마다 세 라운드 모두 내보낼 개체가 남는다", () => {
    for (const tier of BOUNTY_TIERS) {
      const level = ASSUMED_LEVEL[tier.id];
      const winners = tier.rounds.map((round) => reliableWinners(bountyRoundEnemy(round), level));
      // 검수 결과를 눈으로 보려고 남긴다. 라운드별로 확실히 이기는 개체 수다.
      console.log(`${tier.id} (플레이어 LV.${level})\t${winners.map((ids, index) => `R${index + 1} ${ids.length}종`).join("\t")}`);
      // 라운드마다 다른 개체가 나가므로 셋이 겹치지 않게 뽑을 수 있어야 한다.
      winners.forEach((ids, index) => expect(ids.length, `${tier.id} R${index + 1}`).toBeGreaterThanOrEqual(3));
      const distinct = new Set(winners.flat());
      expect(distinct.size, `${tier.id} 서로 다른 셋`).toBeGreaterThanOrEqual(3);
    }
  });

  it("은 마지막 라운드가 그 등급의 벽이다", () => {
    // 세 라운드가 같은 무게면 "한 번이라도 지면 패배"가 뜻을 잃는다 — 마지막에 누구를 남길지가
    // 이 던전의 유일한 판단이므로 3라운드가 앞의 둘보다 좁아야 한다.
    for (const tier of BOUNTY_TIERS) {
      const level = ASSUMED_LEVEL[tier.id];
      const counts = tier.rounds.map((round) => reliableWinners(bountyRoundEnemy(round), level).length);
      expect(counts[2], `${tier.id} 마지막 라운드`).toBeLessThan(Math.max(counts[0], counts[1]));
    }
  });

  it("은 같은 성장 수준에서 등급이 오를수록 내보낼 수 있는 개체가 줄어든다", () => {
    /*
     * 사다리가 실제로 **오르막인가**를 묻는다. 같은 파티를 세워 두고 등급만 올렸을 때 라운드마다
     * 낼 수 있는 개체가 줄지 않으면, 등급은 보상만 다른 같은 관문이 된다.
     *
     * 재는 자리는 레벨 20 — 돌파 없이 닿는 상한이라 "스토리를 끝까지 민 사람"의 자리다.
     */
    const counts = BOUNTY_TIERS.map((tier) => tier.rounds.map((round) => reliableWinners(bountyRoundEnemy(round), 20).length));
    counts.forEach((row, index) => console.log(`${BOUNTY_TIERS[index].id} (플레이어 LV.20)\t${row.map((n, r) => `R${r + 1} ${n}종`).join("\t")}`));
    for (let index = 1; index < counts.length; index += 1) {
      const total = counts[index].reduce((sum, value) => sum + value, 0);
      const previous = counts[index - 1].reduce((sum, value) => sum + value, 0);
      expect(total, `${BOUNTY_TIERS[index].id}`).toBeLessThan(previous);
    }
  });

  it("은 가장 높은 등급이 1레벨 맨몸을 막는다", () => {
    /*
     * **한 라운드라도 막히면 그 판은 끝난다.** 5급의 마지막 라운드(코마)가 그 자리다.
     *
     * 낮은 등급은 1레벨로도 넘어갈 수 있다 — 이 게임의 1대1에서는 레벨보다 **어느 개체를
     * 내보냈는가**가 훨씬 크게 작용하기 때문이다. 등급을 차례로 깨야 다음이 열리고 하루 입장이
     * 세 번뿐이라 그 몫은 막혀 있지만, 지금 세 정예는 1장의 적을 임시로 세운 것이므로 전용
     * 정예가 들어오면 이 자리부터 다시 잰다.
     */
    const last = BOUNTY_TIERS[BOUNTY_TIERS.length - 1];
    expect(reliableWinners(bountyRoundEnemy(last.rounds[2]), 1)).toHaveLength(0);
  });
});
