import { describe, expect, it } from "vitest";
import {
  CHAPTER_ONE_DIFFICULTY_GOALS, STAGE_DIFFICULTY_ADJUSTMENT_ORDER, inspectStageDifficulty,
  selectReferenceParties, selectableRPartyPairs,
} from "../../src/core/stageDifficulty";
import { getBattleStage, getStageEnemies } from "../../src/data/stages";
import { getRelic, PLAYABLE_RELICS } from "../../src/data/relics";
import type { RelicDef } from "../../src/core/types";

/** 단일 운 좋은 판 대신 치명타 순서를 달리하는 재현 가능한 표본 여덟 개를 공통으로 사용한다. */
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

/** 요구된 대표 관문은 수치 조정 PR에서 의도하지 않은 체감 변화를 즉시 보여 주도록 고정한다. */
const BASELINES = {
  /*
   * **v0.93.0에서 통째로 다시 쟀다.** 궁극기 게이지를 개체별 실측 성능에 맞춰 다시 매기면서
   * 중앙 비용이 200에서 110으로 내려갔고, 그만큼 아군 궁극기가 실제로 나가기 시작해 챕터 1이
   * 전반적으로 짧고 쉬워졌다(1-5는 40초·잔여 65%에서 22초·잔여 88%로). 적 정의의 비용은
   * 건드리지 않았으므로 이 변화는 순수한 아군 강화다.
   *
   * 예전 난이도를 그대로 되살리려면 비용표 전체에 약 1.8배를 곱하면 되지만(실측으로 1-5
   * 38.3초·1-9 41.1초로 옛 띠에 다시 들어온다) 그러면 강한 궁극기가 다시 사거리 밖으로
   * 나가므로, 난이도는 비용이 아니라 **적 쪽 수치**로 되잡는다.
   */
  "1-1": { duration: [17.5, 19.5], hp: [0.97, 1] },
  "1-4": { duration: [20.5, 22.5], hp: [0.84, 0.9] },
  "1-5": { duration: [21, 23], hp: [0.85, 0.91] },
  "1-9": { duration: [18.5, 20.5], hp: [0.7, 0.76] },
  "1-10": { duration: [18.5, 20.5], hp: [0.61, 0.67] },
} as const;

/** 교체 직전 네 기술을 데이터 복제본으로만 재현한다. 실제 인게임 정의에 종료 코드를 남기지 않는다. */
function legacyRipa(): RelicDef {
  const current = getRelic("ripa");
  return {
    ...current,
    ferocityTrait: { name: "역풍", effectId: "teamMoveSpeedBonus", bonusPercent: 12 },
    passive: { id: "ripa-passive", name: "퇴적 잠복", kind: "lowHpVanish", iconAssetId: "skill-icon-buff", effectType: "buff", value: 3, durationSeconds: 3, desc: "" },
    basic: { ...current.basic, name: "마디 파동", power: 100, reagentStacks: undefined },
    ultimate: {
      id: "ripa-ult", name: "퇴적류 확산", iconAssetId: "skill-icon-magical", effectType: "magical",
      damageType: "magical", power: 150, cost: 100, targeting: "single",
    },
  };
}

describe("Phaser 없는 챕터 난이도 검수", () => {
  it.each(["1-1", "1-5", "1-10"] as const)("%s의 교체 전후 생존 HP와 전투 결과를 같은 난수열로 기록한다", (stageId) => {
    const enemies = getStageEnemies(getBattleStage(stageId));
    const party = selectReferenceParties(getRelic("anky"), PLAYABLE_RELICS, enemies, SEEDS).favorable;
    // 성장된 스테이지 능력치는 그대로 두고 스킬 계약만 옛 정의로 바꿔 비교 축을 하나로 제한한다.
    const beforeEnemies = enemies.map((enemy) => enemy.id === "ripa" ? { ...legacyRipa(), stats: enemy.stats } : enemy);
    const before = inspectStageDifficulty(party, beforeEnemies, SEEDS).auto;
    const after = inspectStageDifficulty(party, enemies, SEEDS).auto;
    const comparison = {
      before: { won: before.winRate, survivingHp: Number(before.playerHpRatio.mean.toFixed(4)) },
      after: { won: after.winRate, survivingHp: Number(after.playerHpRatio.mean.toFixed(4)) },
    };
    // 세 관문은 방향이 서로 달라 단일 "상향/하향" 주장 대신 측정값 자체를 회귀 계약으로 남긴다.
    expect(comparison).toEqual({
      // v0.93.0의 궁극기 게이지 재조정 뒤 다시 잰 값이다. 세 관문 모두 아군 잔여 HP가 올랐다.
      "1-1": { before: { won: 1, survivingHp: 1 }, after: { won: 1, survivingHp: 0.9988 } },
      "1-5": { before: { won: 1, survivingHp: 0.9919 }, after: { won: 1, survivingHp: 0.8807 } },
      "1-10": { before: { won: 1, survivingHp: 0.6781 }, after: { won: 1, survivingHp: 0.6381 } },
    }[stageId]);
  });

  it("토리카와 선택 가능한 R 두 명의 최선·최악 기준 파티를 실제 조합 탐색으로 만든다", () => {
    const enemies = getStageEnemies(getBattleStage("1-1"));
    const pairs = selectableRPartyPairs(PLAYABLE_RELICS);
    const parties = selectReferenceParties(getRelic("anky"), PLAYABLE_RELICS, enemies, SEEDS);
    // 새 R이 추가되면 조합 수와 최선/최악 선택이 자동으로 넓어진다 — 파루아가 들어와 셋이 됐다.
    // 궁극기 게이지를 성능에 맞춰 다시 매긴 v0.93.0에서 최선 조합이 파루아에서 티아로 바뀌었다:
    // 티아의 궁극기가 240에서 90으로 내려와 1-1 안에서 실제로 나가게 됐기 때문이다.
    expect(pairs.map((pair) => pair.map(({ id }) => id))).toEqual([["dodo", "tia"], ["dodo", "parua"], ["tia", "parua"]]);
    expect(parties.favorable.map(({ id }) => id)).toEqual(["anky", "dodo", "tia"]);
    // 새 리파의 초반 광역 준비 시간이 원거리 조합의 실제 순위를 바꿨으므로 탐색 결과를 고정한다.
    expect(parties.unfavorable.map(({ id }) => id)).toEqual(["anky", "tia", "parua"]);
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
      // R 띠 적을 상대하면 아군 한 명이 먼저 쓰러지는 난수열도 생기지만 최종 자동 승리는 유지된다.
      // 첫 전투불능 기록 자체와 시각은 계속 요구하되, 어느 진영이 먼저인지는 결과 지표로 관찰한다.
      expect(run.firstDefeat).toEqual(expect.objectContaining({ at: expect.any(Number) }));
      expect(["player", "enemy"]).toContain(run.firstDefeat?.side);
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
