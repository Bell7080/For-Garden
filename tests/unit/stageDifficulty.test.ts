import { describe, expect, it } from "vitest";
import {
  CHAPTER_ONE_DIFFICULTY_GOALS, STAGE_DIFFICULTY_ADJUSTMENT_ORDER, inspectStageDifficulty,
  selectReferenceParties, selectableRPartyPairs, summarizeStageDifficulty,
} from "../../src/core/stageDifficulty";
import { CHAPTERS, getBattleStage, getStageEnemies } from "../../src/data/stages";
import { getRelic, PLAYABLE_RELICS } from "../../src/data/relics";
import { applyLevelGrowth } from "../../src/core/relicProgression";
import { RUNE_GENERATION_RULES } from "../../src/core/runes";
import { storyFloorGrowth, type InvestmentShape } from "../../src/core/stageBalance";
import type { RelicDef, Stats } from "../../src/core/types";

/** 단일 운 좋은 판 대신 치명타 순서를 달리하는 재현 가능한 표본 여덟 개를 공통으로 사용한다. */
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

/**
 * 난이도 검수의 기준 로스터.
 *
 * **SSR이 있다고 전제하지 않는다.** 스타트 이벤트로 한둘 쥐고 시작하는 사람이 많더라도 그것을
 * 바닥으로 삼으면 못 뽑은 사람이 그대로 막힌다. 초반에 확실히 손에 드는 셋으로 세우고, 몰아줄
 * 자리는 이 중 유일한 딜러인 파루아다 — 탱커에게 몰아주는 사람은 없다.
 */
const FLOOR_ROSTER = ["anky", "dodo", "parua"] as const;

/** 자원을 몰아줄 자리. 편성 순서는 진형이 정하므로 누구에게 몰아주는지는 따로 적는다. */
const FLOOR_CARRY_INDEX = 2;

/** 초록 룬 하나가 주 옵션 하나를 올리는 폭. 강화·각인은 세지 않는다("룬 작 대충"). */
const GREEN_RUNE = RUNE_GENERATION_RULES.uncommon.mainBase;

function grown(def: RelicDef, level: number, runes: number): RelicDef {
  const stats = { ...applyLevelGrowth(def.stats, level, def.rarity) };
  // 세 칸에 체력·공격력·방어력을 하나씩 끼운 상태로 본다.
  const keys: (keyof Stats)[] = ["hp", "atk", "def"];
  for (let index = 0; index < runes; index += 1) {
    const key = keys[index];
    if (key) stats[key] = Math.round(stats[key] * (1 + GREEN_RUNE / 100));
  }
  return { ...def, stats };
}

/** 그 관문을 **열기 전까지** 받은 첫 클리어 치즈케이크 누적. 데이터에서 직접 더한다. */
function cheesecakeBefore(globalOrder: number): number {
  const battles = CHAPTERS.flatMap(({ stages }) => stages).filter((stage) => stage.kind === "battle");
  return battles.slice(0, globalOrder).reduce((sum, stage) =>
    sum + (stage.kind === "battle" ? stage.rewards.firstClearCheesecake : 0), 0);
}

/** 스토리 보상만으로 자란 바닥 파티. 몰아주기와 균등 분배 두 갈래를 같은 예산에서 만든다. */
function floorParty(globalOrder: number, shape: InvestmentShape): RelicDef[] {
  const growth = storyFloorGrowth(cheesecakeBefore(globalOrder), globalOrder, shape, FLOOR_CARRY_INDEX);
  return FLOOR_ROSTER.map((id, index) => grown(getRelic(id), growth.levels[index] ?? 1, growth.runes[index] ?? 0));
}

const BATTLE_STAGES = CHAPTERS.flatMap(({ stages }) => stages)
  .filter((stage): stage is Extract<typeof stage, { kind: "battle" }> => stage.kind === "battle")
  .map((stage, index) => ({ stage, globalOrder: index }));

/** 폰토스는 원정 최종층 개체라 바닥 파티가 어떤 레벨에서도 이기지 못한다. 스토리에서는 추후 뺀다. */
const EXPEDITION_BOSS_STAGES = BATTLE_STAGES.filter(({ stage }) => stage.enemies.some(({ relicId }) => relicId === "pontos"));
const STORY_STAGES = BATTLE_STAGES.filter((entry) => !EXPEDITION_BOSS_STAGES.includes(entry));

/** 요구된 대표 관문은 수치 조정 PR에서 의도하지 않은 체감 변화를 즉시 보여 주도록 고정한다. */
const BASELINES = {
  /*
   * **v0.94.0에서 성장 곡선 기준으로 다시 잡았다.** 예전 띠는 1레벨 파티를 기준으로 삼고
   * 있었는데, 그 파티가 1장을 잔여 90%대로 통과하고 2-3까지 밀었다 — 관문이 요구하는 힘이
   * 관문을 밀어 얻는 힘보다 느리게 자랐다는 뜻이다. 지금 띠는 `stageBalance.ts`의 바닥 파티
   * (스토리 첫 클리어 보상만 받은 상태)를 **균등 분배**로 세워 잰 값이다.
   *
   * 3장에서 띠가 오히려 올라가는 것은 난이도가 내려가서가 아니라 **바닥 파티가 거기서 더
   * 자라지 못하기 때문**이다 — 돌파 없이는 레벨 상한이 20이고 스토리 보상은 파편을 주지
   * 않는다. 3장을 더 조이려면 적 레벨이 아니라 그 성장 축을 먼저 열어야 한다.
   */
  "1-1": { hp: [0.67, 0.79] },
  "1-5": { hp: [0.65, 0.77] },
  "1-10": { hp: [0.66, 0.78] },
  "2-5": { hp: [0.66, 0.78] },
  "2-10": { hp: [0.66, 0.78] },
  "3-5": { hp: [0.7, 0.82] },
  "3-9": { hp: [0.74, 0.86] },
} as const;

describe("Phaser 없는 챕터 난이도 검수", () => {
  /*
   * **스토리는 막히지 않는다.** 보상만 받아 온 사람이 자원을 어떻게 나눠 썼든 통과해야 하며,
   * 그 두 갈래가 이 검수의 바닥이다. 여기서 한 관문이라도 100%를 놓치면 그 관문은 바닥
   * 파티가 넘을 수 없는 벽이 된 것이다.
   */
  it("균등하게 키운 바닥 파티는 모든 스토리 관문을 안정적으로 넘는다", () => {
    for (const { stage, globalOrder } of STORY_STAGES) {
      const report = summarizeStageDifficulty(floorParty(globalOrder, "spread"), getStageEnemies(stage), SEEDS, "auto");
      expect(report.winRate, stage.id).toBe(1);
    }
  });

  /*
   * **몰아주기는 아슬아슬하다.** 캐리 하나에 전부 넣으면 나머지 둘이 1레벨 맨몸이라 난수열에
   * 따라 한 판씩 진다 — 그것이 몰아주기가 치르는 값이고, 다시 눌러 넘을 수 있는 선이면 된다.
   * 여기서 이 선이 무너지면 그 관문은 캐리 편성으로는 넘을 수 없는 벽이 된 것이다.
   */
  it("몰아 키운 바닥 파티도 모든 스토리 관문을 다시 눌러 넘을 수 있다", () => {
    for (const { stage, globalOrder } of STORY_STAGES) {
      const report = summarizeStageDifficulty(floorParty(globalOrder, "carry"), getStageEnemies(stage), SEEDS, "auto");
      expect(report.winRate, stage.id).toBeGreaterThanOrEqual(0.75);
    }
  });

  /*
   * **키우지 않으면 막힌다.** 같은 로스터를 1레벨·룬 없이 세운 파티다. 1장은 배우는 구간이라
   * 끝까지 따라오지만 마지막 관문에서 멈춰야 한다 — 예전에는 이 파티가 1장을 잔여 90%대로
   * 지나 2-3까지 밀었고, 그것이 이번 조정의 출발점이었다.
   */
  it("성장하지 않은 파티는 1장 마지막에서 막힌다", () => {
    const bare = FLOOR_ROSTER.map((id) => getRelic(id));
    const winRateAt = (stageId: string) =>
      summarizeStageDifficulty(bare, getStageEnemies(getBattleStage(stageId)), SEEDS, "auto").winRate;
    // 1장은 배우는 구간이라 끝까지 따라오지만, 마지막 관문에서 정확히 막힌다.
    expect(winRateAt("1-9")).toBe(1);
    expect(winRateAt("1-10")).toBe(0);
    expect(winRateAt("2-7")).toBe(0);
  });

  /*
   * **한 명을 키워 혼자 보내는 것으로는 2장을 넘지 못한다.** 편성 칸이 셋인 이유가 여기 있다 —
   * 11레벨 스피나 하나가 룬까지 끼고도 2장 전체를 뚫던 것이 이번 조정 전의 상태다.
   */
  it("하이퍼 캐리 혼자서는 2장을 끝내지 못한다", () => {
    const solo = [grown(getRelic("spino"), 11, 3)];
    const winRateAt = (stageId: string) =>
      summarizeStageDifficulty(solo, getStageEnemies(getBattleStage(stageId)), SEEDS, "auto").winRate;
    expect(winRateAt("1-5")).toBe(1);
    // 2장 후반에서 무너지고 3장에서는 한 판도 넘지 못한다.
    expect(winRateAt("2-10")).toBeLessThanOrEqual(0.25);
    expect(winRateAt("3-5")).toBe(0);
  });

  /** 적 레벨은 스토리 내내 뒤로 가지 않는다. 새 구역이 직전 구역보다 약해 보이면 곡선이 끊긴 것이다. */
  it("적 레벨은 관문 순서를 따라 단조 증가한다", () => {
    const levels = BATTLE_STAGES.map(({ stage }) => stage.enemies[0].level);
    for (let index = 1; index < levels.length; index += 1) {
      expect(levels[index], `${BATTLE_STAGES[index].stage.id}`).toBeGreaterThanOrEqual(levels[index - 1]);
    }
    // 곡선이 실제로 크게 그려지는지 — 처음과 끝이 네 배 넘게 벌어진다.
    expect(levels[levels.length - 1] / levels[0]).toBeGreaterThan(4);
  });

  /** 세 적은 모든 챕터에서 같은 자리에 선다. 회전시키면 탱커가 뒷줄로 밀려 난이도가 무너진다. */
  it("적 배치는 챕터가 바뀌어도 같은 순서를 지킨다", () => {
    for (const { stage } of STORY_STAGES) {
      expect(stage.enemies.map(({ relicId }) => relicId), stage.id).toEqual(["amo", "toby", "ripa"].map(
        (id, slot) => stage.id === "1-10" && slot === 1 ? "husk-koma" : id,
      ));
    }
  });

  it.each(Object.entries(BASELINES))("%s의 여러 고정 난수열 결과와 상세 지표를 기준 범위에 둔다", (stageId, baseline) => {
    const entry = STORY_STAGES.find(({ stage }) => stage.id === stageId)!;
    const report = inspectStageDifficulty(floorParty(entry.globalOrder, "spread"), getStageEnemies(entry.stage), SEEDS);

    expect(report.auto.winRate).toBe(1);
    expect(report.auto.playerHpRatio.mean).toBeGreaterThanOrEqual(baseline.hp[0]);
    expect(report.auto.playerHpRatio.mean).toBeLessThanOrEqual(baseline.hp[1]);
    expect(report.auto.runs).toHaveLength(SEEDS.length);
    // 승패 외 요구 지표가 판마다 실제로 채워지고 적 세 명의 기여가 별도로 남는지 검증한다.
    for (const run of report.auto.runs) {
      expect(run.enemyContributions).toHaveLength(3);
      expect(run.enemyContributions.every(({ damage, healing, damageAbsorbed }) => damage >= 0 && healing >= 0 && damageAbsorbed >= 0)).toBe(true);
      expect(run.ultimateUses).toBeGreaterThan(0);
      expect(run.firstDefeat).toEqual(expect.objectContaining({ at: expect.any(Number) }));
      expect(["player", "enemy"]).toContain(run.firstDefeat?.side);
    }
    expect(report.manualDelta).toEqual(expect.objectContaining({ winRate: expect.any(Number), durationSeconds: expect.any(Number), playerHpRatio: expect.any(Number) }));
  });

  it("토리카와 선택 가능한 R 두 명의 최선·최악 기준 파티를 실제 조합 탐색으로 만든다", () => {
    const enemies = getStageEnemies(getBattleStage("1-1"));
    const pairs = selectableRPartyPairs(PLAYABLE_RELICS);
    const parties = selectReferenceParties(getRelic("anky"), PLAYABLE_RELICS, enemies, SEEDS);
    // 새 R이 추가되면 조합 수와 최선/최악 선택이 자동으로 넓어진다 — 파루아가 들어와 셋이 됐다.
    // 1-1의 적이 Lv2에서 Lv7로 오르면서 최선 조합이 티아에서 파루아로 돌아왔다: 적이 단단해질수록
    // 사거리 밖에서 쏘는 쪽이 근접 티아보다 덜 맞는다.
    expect(pairs.map((pair) => pair.map(({ id }) => id))).toEqual([["dodo", "tia"], ["dodo", "parua"], ["tia", "parua"]]);
    expect(parties.favorable.map(({ id }) => id)).toEqual(["anky", "dodo", "parua"]);
    expect(parties.unfavorable.map(({ id }) => id)).toEqual(["anky", "tia", "parua"]);
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
