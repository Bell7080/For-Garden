import { describe, expect, it } from "vitest";
import {
  CHAPTER_ONE_DIFFICULTY_GOALS, STAGE_DIFFICULTY_ADJUSTMENT_ORDER, inspectStageDifficulty,
  selectReferenceParties, selectableRPartyPairs,
} from "../../src/core/stageDifficulty";
import { getBattleStage, getStageEnemies } from "../../src/data/stages";
import { getRelic, PLAYABLE_RELICS } from "../../src/data/relics";

/** 단일 운 좋은 판 대신 치명타 순서를 달리하는 재현 가능한 표본 여덟 개를 공통으로 사용한다. */
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

/** 요구된 대표 관문은 수치 조정 PR에서 의도하지 않은 체감 변화를 즉시 보여 주도록 고정한다. */
const BASELINES = {
  "1-1": { duration: [17, 22], hp: [0.76, 0.9] },
  "1-4": { duration: [18, 23], hp: [0.7, 0.86] },
  "1-5": { duration: [18, 24], hp: [0.68, 0.84] },
  "1-9": { duration: [19, 26], hp: [0.48, 0.72] },
  "1-10": { duration: [18, 24], hp: [0.45, 0.68] },
} as const;

describe("Phaser 없는 챕터 난이도 검수", () => {
  it("토리카와 선택 가능한 R 두 명의 최선·최악 기준 파티를 실제 조합 탐색으로 만든다", () => {
    const enemies = getStageEnemies(getBattleStage("1-1"));
    const pairs = selectableRPartyPairs(PLAYABLE_RELICS);
    const parties = selectReferenceParties(getRelic("anky"), PLAYABLE_RELICS, enemies, SEEDS);
    // 현재 R은 도디·티아 둘뿐이지만 새 R이 추가되면 조합 수와 최선/최악 선택이 자동으로 넓어진다.
    expect(pairs.map((pair) => pair.map(({ id }) => id))).toEqual([["dodo", "tia"]]);
    expect(parties.favorable.map(({ id }) => id)).toEqual(["anky", "dodo", "tia"]);
    expect(parties.unfavorable.map(({ id }) => id)).toEqual(["anky", "dodo", "tia"]);
  });

  it.each(Object.entries(BASELINES))("%s의 여러 고정 난수열 결과와 상세 지표를 기준 범위에 둔다", (stageId, baseline) => {
    const enemies = getStageEnemies(getBattleStage(stageId));
    const party = selectReferenceParties(getRelic("anky"), PLAYABLE_RELICS, enemies, SEEDS).favorable;
    const report = inspectStageDifficulty(party, enemies, SEEDS);

    // 현재 초반 초안의 승률도 명시해 이후 성장 관문 수치 조정이 조용히 섞이지 않게 한다.
    expect(report.auto.winRate).toBe(1);
    expect(report.auto.durationSeconds.mean).toBeGreaterThanOrEqual(baseline.duration[0]);
    expect(report.auto.durationSeconds.mean).toBeLessThanOrEqual(baseline.duration[1]);
    expect(report.auto.playerHpRatio.mean).toBeGreaterThanOrEqual(baseline.hp[0]);
    expect(report.auto.playerHpRatio.mean).toBeLessThanOrEqual(baseline.hp[1]);
    expect(report.auto.runs).toHaveLength(SEEDS.length);
    // 승패 외 요구 지표가 판마다 실제로 채워지고 적 세 명의 기여가 별도로 남는지 검증한다.
    for (const run of report.auto.runs) {
      expect(run.enemyContributions).toHaveLength(3);
      expect(run.enemyContributions.every(({ damage, healing, damageAbsorbed }) => damage >= 0 && healing >= 0 && damageAbsorbed >= 0)).toBe(true);
      expect(run.ultimateUses).toBeGreaterThan(0);
      expect(run.firstDefeat).toEqual(expect.objectContaining({ side: "enemy", at: expect.any(Number) }));
    }
    expect(report.manualDelta).toEqual(expect.objectContaining({ winRate: expect.any(Number), durationSeconds: expect.any(Number), playerHpRatio: expect.any(Number) }));
  });

  it("장 목표와 허용 조정 순서를 전용 배율 없이 공개한다", () => {
    expect(Object.keys(CHAPTER_ONE_DIFFICULTY_GOALS)).toEqual(Array.from({ length: 10 }, (_, index) => `1-${index + 1}`));
    expect(CHAPTER_ONE_DIFFICULTY_GOALS["1-5"].stableAutoWinAllowed).toBe(false);
    expect(CHAPTER_ONE_DIFFICULTY_GOALS["1-10"].gate).toBe("midBoss");
    expect(STAGE_DIFFICULTY_ADJUSTMENT_ORDER).toEqual([
      "enemyLevel", "enemyBreakthrough", "enemyFormation", "playerRewardTiming", "globalRelicDefinition",
    ]);
  });
});
