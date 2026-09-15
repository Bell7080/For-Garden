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

/**
 * **지금 관문이 전제하는 파티 — SSR 한 명이 낀 자리다.**
 *
 * 위 바닥 로스터는 "SSR이 하나도 없는 사람"을 그린 것인데, 그 파티를 통과선으로 삼는 동안
 * 관문은 **전원 1레벨로도 밀렸다.** 뽑기·룬·강화가 전부 선택지로만 남아 아무것도 요구하지
 * 않았기 때문이다. 야성 한 단계를 세 레벨(정예는 다섯)로 올리면서 기준을 여기로 옮겼다 —
 * 스타트 이벤트로 쥐는 SSR 하나에 초반 R·SR 둘이면 **잡졸 관문은 그대로 흐르고 정예 둘만
 * 막는다.** 바닥 로스터가 어디서 막히는지는 아래 "성장하지 않은 파티" 검수가 따로 지킨다.
 */
const REFERENCE_ROSTER = ["anky", "dodo", "rex"] as const;

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
function floorParty(globalOrder: number, shape: InvestmentShape, roster: readonly string[] = FLOOR_ROSTER): RelicDef[] {
  const growth = storyFloorGrowth(cheesecakeBefore(globalOrder), globalOrder, shape, FLOOR_CARRY_INDEX);
  return roster.map((id, index) => grown(getRelic(id), growth.levels[index] ?? 1, growth.runes[index] ?? 0));
}

const BATTLE_STAGES = CHAPTERS.flatMap(({ stages }) => stages)
  .filter((stage): stage is Extract<typeof stage, { kind: "battle" }> => stage.kind === "battle")
  .map((stage, index) => ({ stage, globalOrder: index }));

/** 폰토스는 원정 최종층 개체라 바닥 파티가 어떤 레벨에서도 이기지 못한다. 스토리에서는 추후 뺀다. */
const EXPEDITION_BOSS_STAGES = BATTLE_STAGES.filter(({ stage }) => stage.enemies.some(({ relicId }) => relicId === "pontos"));
const STORY_STAGES = BATTLE_STAGES.filter((entry) => !EXPEDITION_BOSS_STAGES.includes(entry));

/**
 * **스토리의 통과선은 기준 파티(SSR 하나 + R·SR 둘)다.**
 *
 * 예전에는 SSR이 하나도 없는 바닥 로스터가 이 자리에 있었고, 그 파티가 넘지 못하는 관문을
 * `FLOOR_GAP`이라는 표에 "알고 남겨 둔 구멍"으로 하나씩 적어 두었다. 그 표가 스토리 전체로
 * 번진 채 오래 남아 있었는데, 정작 실제로 플레이하면 **전원 1레벨로도 열 관문이 전부 밀렸다** —
 * 검수의 바닥이 실제 파티보다 훨씬 약해, 표가 기록한 "구멍"이 난이도와 아무 관계가 없었다.
 *
 * 그래서 기준을 옮겼다. 통과선은 `REFERENCE_ROSTER`이고, 요구는 둘뿐이다.
 *
 * - **잡졸 관문은 그대로 흐른다**(전승). 길을 막는 자리가 아니다.
 * - **정예 둘(1-5·1-10)만 막는다.** 관문의 무게는 야성 단계 하나로 내며(`ferocityBonusLevels`),
 *   정예는 그 몫이 다섯 배라 같은 파티가 여기서 처음으로 멈춘다.
 *
 * 값을 눈대중으로 고치지 말고 그 두 축(스테이지 야성 표 · 가중치)을 움직인 뒤 다시 잰다.
 */
const ELITE_STAGE_IDS = ["1-5", "1-10"] as const;

/**
 * 대표 관문의 기록. 수치 조정이 의도하지 않은 체감 변화를 냈는지 즉시 드러낸다.
 *
 * **기준 파티(`REFERENCE_ROSTER`)로 다시 쟀다.** 야성 가중치가 들어오면서 잡졸 관문은 거의
 * 무손실로 흐르고 정예 둘만 남는 모양이 되었다 — 이 표가 그 모양 자체를 기록한다. 띠는 좁게
 * 두어 다음 조정이 이 검수에 반드시 걸리게 한다.
 */
const BASELINES = {
  "1-1": { win: 1, hp: [0.94, 1] },
  // 정예 둘은 막는 자리라 기준 파티도 여기서 멈춘다. 1-5는 균등 분배가 겨우 세 판을 열고,
  // 1-10은 한 판도 열리지 않아 잔여 체력이 0이다 — 그것이 이 관문의 기록이다.
  "1-5": { win: 0.375, hp: [0.06, 0.18] },
  "1-10": { win: 0, hp: [0, 0.04] },
  // 정예를 넘고 나면 2·3장의 잡졸은 다시 흐른다. 길에 선 관문은 막는 자리가 아니다.
  "2-5": { win: 1, hp: [0.93, 1] },
  "2-10": { win: 1, hp: [0.93, 1] },
  "3-5": { win: 1, hp: [0.91, 1] },
  "3-9": { win: 1, hp: [0.91, 1] },
} as const;

describe("Phaser 없는 챕터 난이도 검수", () => {
  /*
   * **스토리는 막히지 않는다 — 지금은 그 계약에 구멍이 있다.**
   *
   * 보상만 받아 온 사람이 자원을 어떻게 나눠 썼든 통과해야 하고(균등 전승 · 몰아주기 0.75),
   * 그 두 갈래가 이 검수의 바닥이다. 토리카를 깎으면서 그 바닥이 내려앉은 자리는
   * `FLOOR_GAP`에 그대로 적어 두었다 — 여기서는 **적어 둔 값보다 나빠졌는지**만 본다.
   */
  /*
   * **잡졸 관문은 기준 파티를 막지 않는다.**
   *
   * 자원을 몰아줬든 고루 나눴든 같아야 한다 — 길에 선 관문이 투자 방식을 고르게 만들면,
   * 고르지 않은 쪽은 스토리를 볼 수 없다는 뜻이 된다.
   */
  it.each(["spread", "carry"] as const)("%s로 키운 기준 파티는 잡졸 관문을 전부 넘는다", (shape) => {
    for (const { stage, globalOrder } of STORY_STAGES) {
      if (ELITE_STAGE_IDS.some((id) => id === stage.id)) continue;
      const report = summarizeStageDifficulty(floorParty(globalOrder, shape, REFERENCE_ROSTER), getStageEnemies(stage), SEEDS, "auto");
      expect(report.winRate, `${shape} ${stage.id}`).toBe(1);
    }
  });

  /*
   * **막는 자리는 정예 둘뿐이고, 그 둘은 실제로 막는다.**
   *
   * 1-5는 자원을 한 명에게 몰아주면 넘어가는 자리라 "무엇을 키웠나"를 처음 묻고, 1-10은
   * 그 파티로는 어느 쪽으로 키워도 넘지 못한다 — 뽑기·룬·한계 돌파가 처음으로 선택지가
   * 아니라 요구가 되는 자리가 여기다.
   */
  it("정예 두 관문만 기준 파티를 멈춰 세운다", () => {
    const winRateAt = (stageId: string, shape: InvestmentShape) => {
      const entry = STORY_STAGES.find(({ stage }) => stage.id === stageId)!;
      return summarizeStageDifficulty(floorParty(entry.globalOrder, shape, REFERENCE_ROSTER), getStageEnemies(entry.stage), SEEDS, "auto").winRate;
    };
    // 1-5는 몰아준 쪽만 넘는다. 균등은 절반도 열리지 않는다.
    expect(winRateAt("1-5", "carry")).toBe(1);
    expect(winRateAt("1-5", "spread")).toBeLessThanOrEqual(0.5);
    // 1-10은 어느 쪽으로 키워도 열리지 않는다.
    expect(winRateAt("1-10", "carry")).toBe(0);
    expect(winRateAt("1-10", "spread")).toBe(0);
  });

  /*
   * **키우지 않으면 막힌다 — 그 벽은 1장 중반부터 조여 2장에서 완전히 닫힌다.**
   *
   * **바닥 로스터**(SSR 없음)를 1레벨·룬 없이 세운 파티다. 야성 한 단계를 세 레벨로 올린
   * 뒤 이 줄이 한 장 앞으로 당겨졌다 — 1-4에서 네 판 중 한 판이 되고, 1장 후반부터는 이미
   * 한 판도 열리지 않는다. 키우지 않으면 막힌다는 말이 1장 안에서 끝난다.
   *
   * **정예 관문(1-5·1-10)은 이 줄 밖이다.** 셋 대신 하나가 서는 자리라 무게를 내는 축이 다르다.
   */
  it("성장하지 않은 파티는 1장에서 조이고 2장에서 막힌다", () => {
    const bare = FLOOR_ROSTER.map((id) => getRelic(id));
    const winRateAt = (stageId: string) =>
      summarizeStageDifficulty(bare, getStageEnemies(getBattleStage(stageId)), SEEDS, "auto").winRate;
    // 첫 관문은 맨몸으로도 절반은 열린다 — 배우는 자리라 아주 닫아 두지는 않는다.
    expect(winRateAt("1-1")).toBeGreaterThanOrEqual(0.5);
    // 1장 중반부터 네 판 중 한 판으로 줄고,
    expect(winRateAt("1-4")).toBeLessThanOrEqual(0.25);
    // 1장 후반부터 이미 한 판도 열리지 않는다.
    expect(winRateAt("1-7")).toBe(0);
    expect(winRateAt("2-5")).toBe(0);
    expect(winRateAt("3-9")).toBe(0);
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
    // 2장 끝에서 흔들리고 3장에서는 대부분 진다. 편성 칸이 셋인 이유다 — 혼자 밀 수 있는
    // 구간은 있어도 그 구간이 끝나는 자리가 분명해야 한다.
    expect(winRateAt("2-10")).toBe(0);
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

  /**
   * 세 적은 모든 챕터에서 같은 자리에 선다. 회전시키면 탱커가 뒷줄로 밀려 난이도가 무너진다.
   *
   * **정예 관문만 이 줄 밖이다** — 거기에는 셋 대신 하나가 서고, 그 하나는 가운데 자리를 쓴다.
   */
  it("적 배치는 챕터가 바뀌어도 같은 순서를 지킨다", () => {
    for (const { stage } of STORY_STAGES) {
      if (stage.elite === true) {
        expect(stage.enemies, stage.id).toHaveLength(1);
        expect(stage.enemies[0].formationSlot, stage.id).toBe(1);
        continue;
      }
      expect(stage.enemies.map(({ relicId }) => relicId), stage.id).toEqual(["amo", "toby", "ripa"]);
    }
  });

  it.each(Object.entries(BASELINES))("%s의 여러 고정 난수열 결과와 상세 지표를 기준 범위에 둔다", (stageId, baseline) => {
    const entry = STORY_STAGES.find(({ stage }) => stage.id === stageId)!;
    const report = inspectStageDifficulty(floorParty(entry.globalOrder, "spread", REFERENCE_ROSTER), getStageEnemies(entry.stage), SEEDS);

    // 기준 파티의 기록이다 — 잡졸은 전승, 정예 둘만 여기서 멈춘다.
    expect(report.auto.winRate).toBe(baseline.win);
    expect(report.auto.playerHpRatio.mean).toBeGreaterThanOrEqual(baseline.hp[0]);
    expect(report.auto.playerHpRatio.mean).toBeLessThanOrEqual(baseline.hp[1]);
    expect(report.auto.runs).toHaveLength(SEEDS.length);
    // 승패 외 요구 지표가 판마다 실제로 채워지고 적 세 명의 기여가 별도로 남는지 검증한다.
    for (const run of report.auto.runs) {
      // 정예 관문은 하나, 나머지는 셋이다 — 서 있는 수만큼 장부가 따로 남는지 본다.
      expect(run.enemyContributions).toHaveLength(entry.stage.enemies.length);
      expect(run.enemyContributions.every(({ damage, healing, damageAbsorbed }) => damage >= 0 && healing >= 0 && damageAbsorbed >= 0)).toBe(true);
      // 이기는 관문은 판마다 궁극기가 실제로 돈다. **지는 관문은 한 판씩 예외가 생긴다** —
      // 1-10처럼 열두 초 만에 무너지는 판에서는 게이지가 차기 전에 끝나는 난수열이 섞인다.
      // 그래서 전패하는 관문은 "그 관문에서 한 번이라도 돌았는가"까지만 본다.
      if (baseline.win === 1) expect(run.ultimateUses).toBeGreaterThan(0);
      expect(run.firstDefeat).toEqual(expect.objectContaining({ at: expect.any(Number) }));
      expect(["player", "enemy"]).toContain(run.firstDefeat?.side);
    }
    expect(report.auto.runs.reduce((sum, run) => sum + run.ultimateUses, 0)).toBeGreaterThan(0);
    expect(report.manualDelta).toEqual(expect.objectContaining({ winRate: expect.any(Number), durationSeconds: expect.any(Number), playerHpRatio: expect.any(Number) }));
  });

  it("토리카와 선택 가능한 R 두 명의 최선·최악 기준 파티를 실제 조합 탐색으로 만든다", () => {
    const enemies = getStageEnemies(getBattleStage("1-1"));
    const pairs = selectableRPartyPairs(PLAYABLE_RELICS);
    const parties = selectReferenceParties(getRelic("anky"), PLAYABLE_RELICS, enemies, SEEDS);
    // 새 R이 추가되면 조합 수와 최선/최악 선택이 자동으로 넓어진다 — 파루아가 들어와 셋이 됐다.
    // 티아의 반짝이 표식을 옮겨 다니는 대신 그 자리에서 터뜨리는 쪽으로 바뀌면서 최악 조합이
    // 파루아 쪽으로 옮겨 갔다: 붙어서 같은 적을 계속 때리는 손이 이제 두 대마다 주위까지
    // 함께 적신다.
    expect(pairs.map((pair) => pair.map(({ id }) => id))).toEqual([["dodo", "tia"], ["dodo", "parua"], ["tia", "parua"]]);
    expect(parties.favorable.map(({ id }) => id)).toEqual(["anky", "dodo", "tia"]);
    expect(parties.unfavorable.map(({ id }) => id)).toEqual(["anky", "dodo", "parua"]);
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
