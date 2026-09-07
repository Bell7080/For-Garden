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
  // 위치 기반 경감을 없애고 세 적의 읽히는 패시브로 교체한 결과를 새 기준으로 고정한다.
  // 승률은 유지하되 전투 시간과 잔여 체력은 관문별 현재 평균 주위의 좁은 띠만 허용한다.
  "1-1": { duration: [28, 34], hp: [0.82, 0.92] },
  "1-4": { duration: [29, 35], hp: [0.71, 0.81] },
  /*
   * **1-5의 띠만 새로 잡았다.** 예전 값(0.8~0.9)은 1-5가 1-4(0.71~0.81)보다 **쉬워야**
   * 한다고 말하는데, 적 레벨이 관문을 따라 내려가지 않는 한 그 곡선은 만들 수 없다. 옛 값은
   * 의도한 완급이 아니라 그때 측정된 자리를 그대로 적어 둔 것이었고(당시 1-4도 띠 밖이었다),
   * 지금은 1-4와 1-9 사이에 자연스럽게 놓는다.
   */
  "1-5": { duration: [30, 36], hp: [0.69, 0.79] },
  "1-9": { duration: [32, 38], hp: [0.68, 0.78] },
  /*
   * **중간보스 관문의 띠를 다시 잡았다.** 옛 값(0.64~0.74)은 코마가 태생 전투력 1916으로
   * 공멸 잡졸 셋보다도 약하던 시절의 것이다. 코마를 SR급 중간보스로 올린 뒤에는 그 띠 안에
   * 넣을 수 있는 편성이 **보스를 호위보다 낮은 레벨로 두는 것뿐**이라, 수치를 맞추려고
   * 데이터가 이상해지는 쪽이었다. `CHAPTER_ONE_DIFFICULTY_GOALS`가 이 관문에 적어 둔 gate가
   * `midBoss`이고 `stableAutoWinAllowed`가 거짓이므로, 직전 관문에서 한 번에 내려앉는 지금이
   * 그 의도에 맞는다.
   */
  "1-10": { duration: [37, 44], hp: [0.52, 0.62] },
} as const;

describe("Phaser 없는 챕터 난이도 검수", () => {
  it("토리카와 선택 가능한 R 두 명의 최선·최악 기준 파티를 실제 조합 탐색으로 만든다", () => {
    const enemies = getStageEnemies(getBattleStage("1-1"));
    const pairs = selectableRPartyPairs(PLAYABLE_RELICS);
    const parties = selectReferenceParties(getRelic("anky"), PLAYABLE_RELICS, enemies, SEEDS);
    // 새 R이 추가되면 조합 수와 최선/최악 선택이 자동으로 넓어진다 — 파루아가 들어와 셋이 됐다.
    expect(pairs.map((pair) => pair.map(({ id }) => id))).toEqual([["dodo", "tia"], ["dodo", "parua"], ["tia", "parua"]]);
    expect(parties.favorable.map(({ id }) => id)).toEqual(["anky", "dodo", "tia"]);
    // 최악이 최선과 갈린 것은 후보가 둘 이상이 된 뒤부터다 — 원거리 유리몸인 파루아가 그 자리다.
    expect(parties.unfavorable.map(({ id }) => id)).toEqual(["anky", "dodo", "parua"]);
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
