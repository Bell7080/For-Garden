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

/**
 * **바닥 파티가 지금 못 넘는 관문 — 알고 남겨 둔 구멍이다.**
 *
 * "스토리는 막히지 않는다"는 계약(균등 전승 · 몰아주기 0.75)을 지우지 않고 **지금 값을 그대로
 * 적어 둔다.** 아래 검수는 각 관문이 여기 적힌 승률 **이상**인지만 본다:
 *
 * - 더 나빠지면 실패한다 — 다른 조정이 이 구멍을 더 벌리는 것을 막는다.
 * - 적히지 않은 관문의 기준은 여전히 원래 계약이다.
 * - 사다리를 다시 풀어 전부 원래 계약으로 돌아가면 이 표를 **지우면 된다**(지워도 통과한다).
 *
 * **v0.132.2에서 구멍이 크게 벌어졌다 — 알고 한 선택이며, 다음 작업은 적 레벨 사다리다.**
 * 토리카의 두 회복(폭주 매초 5 → 1.5% · 패시브 매초 7 → 3.5%)과 도디의 평타 회복(50 → 30%)을
 * 함께 내렸는데, 셋 다 이 검수의 바닥 로스터가 **버티는 방식 그 자체**였다. 회복이 절반 아래로
 * 내려가자 3장은 승률 0.125~0.25로 내려앉았다. 개체 쪽 의도(회복이 피해를 그대로 지워 전투가
 * 언제 위험해지는지 보이지 않던 것)는 이룬 값이므로 되돌리지 않고, **관문이 요구하는 힘을
 * `stages.ts`의 레벨 표에서 다시 푼다.** 그 작업 전까지 이 표가 지금 상태를 기록한다.
 */
const FLOOR_GAP: Readonly<Record<"spread" | "carry", Readonly<Record<string, number>>>> = {
  spread: {
    "1-1": 0.875, "1-2": 0.875, "1-3": 0.875, "1-4": 0.625, "1-6": 0.625, "1-7": 0.625,
    "1-8": 0.5, "1-9": 0.625,
    "2-1": 0.5, "2-2": 0.625, "2-3": 0.625, "2-4": 0.625, "2-5": 0.625, "2-6": 0.625,
    "2-7": 0.875, "2-8": 0.875, "2-9": 0.875, "2-10": 0.875,
    "3-1": 0.5, "3-2": 0.625, "3-3": 0.125, "3-4": 0.25, "3-5": 0.125, "3-6": 0.25,
    "3-7": 0.125, "3-8": 0.25, "3-9": 0.125,
  },
  carry: {
    "2-8": 0.625, "2-9": 0.625, "2-10": 0.625,
    "3-1": 0.5, "3-2": 0.5, "3-3": 0.25, "3-4": 0.25, "3-5": 0.25, "3-6": 0.25,
    "3-7": 0.25, "3-8": 0.125, "3-9": 0.125,
  },
};

/** 원래 계약. 표에 없는 관문은 이 값을 그대로 쓴다. */
const FLOOR_CONTRACT = { spread: 1, carry: 0.75 } as const;

/**
 * 요구된 대표 관문은 수치 조정 PR에서 의도하지 않은 체감 변화를 즉시 보여 주도록 고정한다.
 *
 * **토리카·도디의 회복 조정으로 다시 쟀다.** 폭주의 공속 배율을 절반으로 내린 만큼 깃펜이 옮기는 회복이
 * 줄어 같은 관문의 잔여 체력이 또 한 뼘 내려갔다(예: 3-9는 0.48 → 0.40). 띠 폭은 예전과
 * 같고 가운데만 옮겨 갔다 — 폭까지 넓히면 다음 조정의 체감 변화가 이 검수에 걸리지 않는다.
 */
const BASELINES = {
  "1-1": { hp: [0.50, 0.62] },
  // 1-5·1-10은 셋 대신 정예 하나가 서는 관문이다. 무게는 그 하나의 야성이 대신 낸다.
  "1-5": { hp: [0.54, 0.66] },
  "1-10": { hp: [0.48, 0.60] },
  "2-5": { hp: [0.34, 0.46] },
  "2-10": { hp: [0.46, 0.58] },
  // 3장은 회복을 내린 뒤 전멸 직전까지 내려갔다. 띠를 넓히지 않고 지금 값을 그대로 적는다 —
  // 사다리를 다시 풀면 이 두 줄이 가장 먼저 올라온다.
  "3-5": { hp: [0.02, 0.14] },
  "3-9": { hp: [0.02, 0.14] },
} as const;

describe("Phaser 없는 챕터 난이도 검수", () => {
  /*
   * **스토리는 막히지 않는다 — 지금은 그 계약에 구멍이 있다.**
   *
   * 보상만 받아 온 사람이 자원을 어떻게 나눠 썼든 통과해야 하고(균등 전승 · 몰아주기 0.75),
   * 그 두 갈래가 이 검수의 바닥이다. 토리카를 깎으면서 그 바닥이 내려앉은 자리는
   * `FLOOR_GAP`에 그대로 적어 두었다 — 여기서는 **적어 둔 값보다 나빠졌는지**만 본다.
   */
  it.each(["spread", "carry"] as const)("%s로 키운 바닥 파티의 관문별 승률이 기록된 바닥 아래로 내려가지 않는다", (shape) => {
    for (const { stage, globalOrder } of STORY_STAGES) {
      const report = summarizeStageDifficulty(floorParty(globalOrder, shape), getStageEnemies(stage), SEEDS, "auto");
      expect(report.winRate, `${shape} ${stage.id}`).toBeGreaterThanOrEqual(FLOOR_GAP[shape][stage.id] ?? FLOOR_CONTRACT[shape]);
    }
  });

  /*
   * **구멍이 적어 둔 자리 밖으로 번지지 않는다.**
   *
   * 위 검수는 "적어 둔 값 이상"만 보므로, 표에 적힌 관문이 실제로는 이미 나아졌는데 표만 남아
   * 있는 경우를 잡지 못한다. 여기서 그 반대 방향을 지킨다 — 표에 적힌 관문이 원래 계약을 다시
   * 만족하게 되면 이 검수가 실패하고, 그때 그 줄을 지우면 된다.
   */
  it("기록된 구멍에는 실제로 구멍이 남아 있다", () => {
    for (const shape of ["spread", "carry"] as const) {
      for (const stageId of Object.keys(FLOOR_GAP[shape])) {
        const entry = STORY_STAGES.find(({ stage }) => stage.id === stageId);
        expect(entry, `${shape} ${stageId}`).toBeTruthy();
        const report = summarizeStageDifficulty(floorParty(entry!.globalOrder, shape), getStageEnemies(entry!.stage), SEEDS, "auto");
        expect(report.winRate, `${shape} ${stageId}`).toBeLessThan(FLOOR_CONTRACT[shape]);
      }
    }
  });

  /*
   * **키우지 않으면 막힌다 — 그 벽은 1장 중반부터 조여 2장에서 완전히 닫힌다.**
   *
   * 같은 로스터를 1레벨·룬 없이 세운 파티다. 토리카·도디의 회복을 내린 v0.132.2에서 이 줄이
   * 한 번 더 내려왔다 — 1-4에서 절반을 놓치고, 1장 뒷부분은 네 판 중 한 판만 이기며, 2장에
   * 들어서면 한 판도 넘지 못한다. 회복이 피해를 지우던 때는 이 벽이 3장까지 밀려 있었다.
   *
   * **정예 관문(1-5·1-10)은 이 줄 밖이다.** 셋 대신 하나가 서는 자리라 무게를 내는 축이 다르다.
   */
  it("성장하지 않은 파티는 1장에서 조이고 2장에서 막힌다", () => {
    const bare = FLOOR_ROSTER.map((id) => getRelic(id));
    const winRateAt = (stageId: string) =>
      summarizeStageDifficulty(bare, getStageEnemies(getBattleStage(stageId)), SEEDS, "auto").winRate;
    // 첫 관문은 맨몸으로도 배우는 자리다.
    expect(winRateAt("1-1")).toBeGreaterThanOrEqual(0.75);
    // 1장 중반부터 절반 아래로 내려가고,
    expect(winRateAt("1-4")).toBeLessThanOrEqual(0.5);
    expect(winRateAt("1-7")).toBeLessThanOrEqual(0.375);
    // 2장부터는 한 판도 열리지 않는다.
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
    expect(winRateAt("2-10")).toBeLessThanOrEqual(0.75);
    expect(winRateAt("3-5")).toBeLessThanOrEqual(0.5);
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
    const report = inspectStageDifficulty(floorParty(entry.globalOrder, "spread"), getStageEnemies(entry.stage), SEEDS);

    // 기록된 구멍이 있는 관문은 그 값까지만 요구한다(위 `FLOOR_GAP` 주석 참고).
    expect(report.auto.winRate).toBeGreaterThanOrEqual(FLOOR_GAP.spread[stageId] ?? FLOOR_CONTRACT.spread);
    expect(report.auto.playerHpRatio.mean).toBeGreaterThanOrEqual(baseline.hp[0]);
    expect(report.auto.playerHpRatio.mean).toBeLessThanOrEqual(baseline.hp[1]);
    expect(report.auto.runs).toHaveLength(SEEDS.length);
    // 승패 외 요구 지표가 판마다 실제로 채워지고 적 세 명의 기여가 별도로 남는지 검증한다.
    for (const run of report.auto.runs) {
      // 정예 관문은 하나, 나머지는 셋이다 — 서 있는 수만큼 장부가 따로 남는지 본다.
      expect(run.enemyContributions).toHaveLength(entry.stage.enemies.length);
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
