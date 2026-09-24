import { describe, expect, it } from "vitest";
import {
  CHAPTER_ONE_DIFFICULTY_GOALS, STAGE_DIFFICULTY_ADJUSTMENT_ORDER, inspectStageDifficulty,
  selectReferenceParties, selectableRPartyPairs, summarizeStageDifficulty,
} from "../../src/core/stageDifficulty";
import { CHAPTERS, getBattleStage, getStageEnemies } from "../../src/data/stages";
import { getRelic, PLAYABLE_RELICS } from "../../src/data/relics";
import { applyLevelGrowth } from "../../src/core/relicProgression";
import { RUNE_GENERATION_RULES } from "../../src/core/runes";
import { levelFromCheesecake, storyFloorGrowth, type InvestmentShape } from "../../src/core/stageBalance";
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
 * **두 번째 축 — 실제로 밀 만한 파티.**
 *
 * 위 바닥 로스터는 "SSR이 하나도 없고 스토리 보상만 받은 사람"이라 **가장 아래**를 그린다.
 * 그 하나만으로는 관문이 실제로 어떤지 알 수 없다 — 바닥이 막히는 자리와 사람이 막히는
 * 자리는 다르고, 바닥만 보고 조이면 실제로는 아무 저항이 없는 관문이 "어렵다"고 기록된다
 * (야성 가중치를 넣기 전까지 그랬다. 검수는 구멍투성이인데 실제로는 전원 1레벨로 밀렸다).
 *
 * 그래서 축을 둘로 둔다. 이쪽은 **자리마다 SSR 하나씩을 골라 세운 편성**이고, 셋을 고정하지
 * 않고 자리별 후보에서 조합을 만든다 — 한 조합만 박아 두면 그 조합에만 맞는 관문이 된다.
 */
const BLENDED_DPS = ["rex", "spino", "maki"] as const;
const BLENDED_TANK = ["anky", "nodonia", "ella"] as const;
const BLENDED_SUPPORT = ["stella", "luka", "mette"] as const;

/**
 * **27개 조합의 양 끝과 가운데.** 전부 돌리면 검수 한 번에 수천 판이라 대표만 남긴다.
 *
 * **실측에서 갈리는 축은 딜러의 속성이었다.** 탱커·지원가는 잔여 체력만 움직이고 통과 여부를
 * 한 번도 바꾸지 않았다. 그래서 셋은 딜러가 불(렉시아)·땅(마키)·물(스피나)로 갈리도록 골랐다 —
 * 정예 둘이 불(토비)과 풀(코마)이라 그 셋이 두 관문에서 서로 다른 답을 낸다. 새 개체가
 * 들어오거나 정예의 속성이 바뀌면 이 셋을 다시 고른다.
 */
const BLENDED_COMBOS = [
  ["anky", "rex", "luka"],
  ["ella", "maki", "stella"],
  ["nodonia", "spino", "mette"],
] as const;

/**
 * **스토리 밖에서 들어오는 케이크를 몇 배로 볼 것인가.**
 *
 * 발굴·의뢰·우편 보상·스테미나 환전·이벤트가 전부 이 위에 얹히므로, 스토리 첫 클리어 보상만
 * 세면 실제 플레이어보다 한참 아래가 된다. 정확한 수가 아니라 **어림값**이며, 각 콘텐츠의
 * 지급량이 정해지면 그 표에서 거꾸로 푼다.
 */
const OUTSIDE_CHEESECAKE_MULTIPLIER = 3;

/** 레어 룬 주 옵션 기본값 + 세공 세 번 성공. "희귀~레어를 대충 강화해서 풀세팅"의 몫이다. */
const BLENDED_RUNE_MAIN = RUNE_GENERATION_RULES.rare.mainBase + 3 * RUNE_GENERATION_RULES.rare.mainEnhancement;

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

/** 세 칸에 룬을 다 끼운 블렌딩 파티. 레벨은 셋이 고르게 나눠 먹는다. */
function blendedParty(globalOrder: number, roster: readonly string[]): RelicDef[] {
  const budget = Math.floor(cheesecakeBefore(globalOrder) * OUTSIDE_CHEESECAKE_MULTIPLIER / FLOOR_ROSTER.length);
  const level = levelFromCheesecake(budget);
  return roster.map((id) => {
    const def = getRelic(id);
    const stats = { ...applyLevelGrowth(def.stats, level, def.rarity) };
    for (const key of ["hp", "atk", "def"] as (keyof Stats)[]) {
      stats[key] = Math.round(stats[key] * (1 + BLENDED_RUNE_MAIN / 100));
    }
    return { ...def, stats };
  });
}

const BATTLE_STAGES = CHAPTERS.flatMap(({ stages }) => stages)
  .filter((stage): stage is Extract<typeof stage, { kind: "battle" }> => stage.kind === "battle")
  .map((stage, index) => ({ stage, globalOrder: index }));

/** 폰토스는 원정 최종층 개체라 바닥 파티가 어떤 레벨에서도 이기지 못한다. 스토리에서는 추후 뺀다. */
const EXPEDITION_BOSS_STAGES = BATTLE_STAGES.filter(({ stage }) => stage.enemies.some(({ relicId }) => relicId === "pontos"));
const STORY_STAGES = BATTLE_STAGES.filter((entry) => !EXPEDITION_BOSS_STAGES.includes(entry));

/**
 * **길을 막는 자리는 이 둘뿐이다.**
 *
 * 예전에는 SSR이 하나도 없는 바닥 로스터가 통과선이었고, 그 파티가 넘지 못하는 관문을
 * `FLOOR_GAP`이라는 표에 "알고 남겨 둔 구멍"으로 하나씩 적어 두었다. 그 표가 스토리 전체로
 * 번진 채 오래 남아 있었는데, 정작 실제로 플레이하면 **전원 1레벨로도 열 관문이 전부 밀렸다** —
 * 검수의 바닥이 실제 파티보다 훨씬 약해, 표가 기록한 "구멍"이 난이도와 아무 관계가 없었다.
 *
 * 그래서 통과선을 `BLENDED_COMBOS`로 옮기고 요구를 둘로 줄였다.
 *
 * - **잡졸 관문은 그대로 흐른다**(전승). 길을 막는 자리가 아니다.
 * - **정예 둘만 막는다.** 관문의 레벨은 잡졸과 같은 사다리를 쓰고, 혼자 서는 몫만
 *   `ENCOUNTER_ROLE.elite`의 체력·공격 배수가 낸다 — 같은 파티가 여기서 처음으로 멈춘다.
 *
 * 값을 눈대중으로 고치지 말고 그 두 축(권장 레벨 사다리 · 유형 배수)을 움직인 뒤 다시 잰다.
 */
const ELITE_STAGE_IDS = ["1-5", "1-10"] as const;

/**
 * 대표 관문의 기록. 수치 조정이 의도하지 않은 체감 변화를 냈는지 즉시 드러낸다.
 *
 * **블렌딩 파티의 가운데 조합**(`BLENDED_COMBOS[1]` — 엘라·마키·스테라)으로 쟀다. 양 끝은
 * 통과 여부가 갈려 잔여 체력을 기록해도 같은 뜻이 되지 않지만, 가운데 조합은 정예 둘을
 * 아슬아슬하게 지나 관문의 모양을 그대로 보여 준다. 띠는 좁게 두어 다음 조정이 이 검수에
 * 반드시 걸리게 한다.
 */
const BASELINES = {
  "1-1": { win: 1, hp: [0.83, 0.95] },
  /*
   * **정예 둘은 서로 다른 무게다.** 1-5의 토비는 R이라 같은 유형 배수를 받아도 길을 막지
   * 않고 체력을 한 뼘 깎을 뿐이고, 1-10의 코마는 SSR이라 여덟 판 중 한 판만 연다 — 같은 "정예"
   * 인데 세우는 개체의 등급이 결과를 크게 가른다(`docs/level-design.md`).
   *
   * v0.164.0에서 야성 단계를 걷어 내고 레벨 하나 + 유형 배수로 옮기며 전부 다시 녹화했고,
   * v0.165.0에서 유형 차(+3)까지 걷어 내 정예가 잡졸과 같은 사다리 위에 서면서 다시 녹화했다.
   * v0.172.6에서 검수를 실제 전장 크기로 옮기고(정예 공격 몫 ×1.1, 1장 사다리 한 뼘) 다시 녹화했다 —
   * 잡졸 관문의 잔여 체력이 한꺼번에 오른 것은 전장이 좁아 후열이 덜 맞기 때문이다.
   */
  "1-5": { win: 1, hp: [0.83, 0.95] },
  // 1-10은 장을 닫는 벽이다(v0.174.2, 정예 공격 몫 ×1.2) — 땅 딜러 조합은 여기서 한 번 막혀
  // 뽑기나 강화를 거쳐 다시 온다.
  "1-10": { win: 0.125, hp: [0.02, 0.14] },
  "2-5": { win: 1, hp: [0.88, 1] },
  "2-10": { win: 1, hp: [0.89, 1] },
  "3-5": { win: 1, hp: [0.81, 0.93] },
  "3-9": { win: 1, hp: [0.80, 0.92] },
} as const;

describe("Phaser 없는 챕터 난이도 검수", () => {
  /*
   * **두 번째 축 — 실제로 밀 만한 파티는 3장 끝까지 민다.**
   *
   * 스토리는 길이지 관문이 아니다. 자리마다 SSR 하나씩을 세우고 스토리 밖 재화까지 센 파티가
   * 어느 관문에서든 멈춘다면, 그 자리는 조인 것이 아니라 잘못 잡힌 것이다.
   *
   * **그렇다고 무손실로 흐르지도 않는다** — 아래 대표 관문 기록이 잔여 체력을 함께 지킨다.
   * 3장으로 갈수록 레벨 상한(돌파 0 = 20)에 묶여 같은 파티가 더 깎이며 지나간다.
   */
  it.each(BLENDED_COMBOS.map((combo) => [combo.join("+"), combo] as const))(
    "%s 조합은 잡졸 관문을 끝까지 민다", (_name, combo) => {
      for (const stageId of ["1-1", "1-9", "2-5", "2-10", "3-5", "3-9"]) {
        const entry = STORY_STAGES.find(({ stage }) => stage.id === stageId)!;
        const report = summarizeStageDifficulty(blendedParty(entry.globalOrder, combo), getStageEnemies(entry.stage), SEEDS, "auto");
        expect(report.winRate, stageId).toBe(1);
      }
    },
  );

  /*
   * **대표 셋은 후보 표에서 골라야 한다.** 개체가 늘거나 역할이 바뀌어 후보에서 빠진 조합이
   * 대표로 남아 있으면, 검수가 지키는 것이 "지금 사람들이 짜는 편성"이 아니게 된다.
   */
  it("대표 조합은 자리별 후보에서 하나씩 고른 것이다", () => {
    for (const [tank, dps, support] of BLENDED_COMBOS) {
      expect(BLENDED_TANK, tank).toContain(tank);
      expect(BLENDED_DPS, dps).toContain(dps);
      expect(BLENDED_SUPPORT, support).toContain(support);
    }
  });

  /*
   * **첫 번째 축 — 바닥 로스터는 1장 안에서 멈춘다.**
   *
   * SSR이 하나도 없고 스토리 첫 클리어 보상만 받은 파티다. 1장은 절반의 확률로 더듬으며
   * 나아가지만 정예 둘은 한 번도 열리지 않고, 2장부터는 사실상 닫힌다 — 위 블렌딩 축이
   * 3-9까지 미는 것과 나란히 두면 관문이 무엇을 요구하는지가 두 수로 읽힌다.
   */
  it.each(["spread", "carry"] as const)("%s로 키운 바닥 로스터는 1장 안에서 멈춘다", (shape) => {
    const winRateAt = (stageId: string) => {
      const entry = STORY_STAGES.find(({ stage }) => stage.id === stageId)!;
      return summarizeStageDifficulty(floorParty(entry.globalOrder, shape), getStageEnemies(entry.stage), SEEDS, "auto").winRate;
    };
    /*
     * **잡졸은 길이고 정예가 관문이다.** 바닥 파티도 1장의 잡졸 줄은 대체로 흐르고, 장을
     * 닫는 정예에서 멈춘다 — 길에서 막으면 "더 키우면 된다"가 아니라 "여기서 끝"이 된다.
     */
    for (const stageId of ["1-1", "1-7", "1-9"]) expect(winRateAt(stageId), stageId).toBeGreaterThan(0);
    // 장을 닫는 정예는 한 판도 열리지 않는다 — 셋 몫을 하나가 내는 자리라 바닥 파티가 닿지 못한다.
    expect(winRateAt("1-10")).toBe(0);
    // 2장은 한 판이 열릴까 말까 하고, 3장은 완전히 닫힌다.
    for (const { stage } of STORY_STAGES) {
      if (stage.id.startsWith("2-")) expect(winRateAt(stage.id), stage.id).toBeLessThanOrEqual(0.125);
      if (stage.id.startsWith("3-")) expect(winRateAt(stage.id), stage.id).toBe(0);
    }
  });

  /*
   * **막는 자리는 정예 둘뿐이고, 그 둘은 서로 다른 답을 요구한다.**
   *
   * 1-5의 토비는 불, 1-10의 코마는 풀이다. 그래서 물·땅 딜러는 1-5를 그냥 넘고 1-10에서
   * 흔들리며, 불 딜러는 정확히 반대다 — 같은 재화·같은 룬으로 자란 세 조합이 이 두 관문에서만
   * 갈리고, 어느 하나가 두 관문을 모두 가져가지 않는다.
   *
   * **둘을 같은 속성으로 두면 그 축이 통째로 사라진다.** 코마가 불이던 때는 불 딜러만 두
   * 관문에서 상성 없이(1.00배 주고 1.00배 맞고) 싸워, 렉시아를 낀 아홉 조합이 탱커·지원가를
   * 무엇으로 바꾸든 전부 막혔다. 잡졸 관문이 조합을 가리지 않는 것과 짝을 이루는 값이라,
   * 한쪽이 무너지면 다른 쪽도 함께 본다.
   */
  it("장을 닫는 정예 관문이 조합을 가린다", () => {
    const winRateAt = (stageId: string, combo: readonly string[]) => {
      const entry = STORY_STAGES.find(({ stage }) => stage.id === stageId)!;
      return summarizeStageDifficulty(blendedParty(entry.globalOrder, combo), getStageEnemies(entry.stage), SEEDS, "auto").winRate;
    };
    const [fireDps, earthDps, waterDps] = BLENDED_COMBOS;
    expect(ELITE_STAGE_IDS).toEqual(["1-5", "1-10"]);
    // **1장의 중간 정예는 길을 막지 않는다.** 토비는 R이라 같은 유형 배수를 받아도 세 조합이
    // 모두 넘는다(대표 관문 기록의 `1-5`).
    for (const combo of [fireDps, earthDps, waterDps]) expect(winRateAt("1-5", combo)).toBe(1);
    // **장을 닫는 자리만 조합을 가린다.** 풀 코마에게 땅 딜러는 이점이 없어 여덟 판 중 한 판만 연다 —
    // 한 번 막혀 뽑기·강화로 돌아가는 자리다.
    expect(winRateAt("1-10", fireDps)).toBe(1);
    expect(winRateAt("1-10", earthDps)).toBe(0.125);
    expect(winRateAt("1-10", waterDps)).toBe(1);
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
    expect(winRateAt("1-4")).toBeLessThanOrEqual(0.75);
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
    /*
     * **혼자 보내면 장을 닫는 정예에서 멈춘다.** 1장 중간 정예(R 토비)는 혼자서도 깎아 낼 수
     * 있지만, 셋 몫을 내는 SSR 코마 앞에서는 한 판도 열리지 않는다 — 편성 칸이 셋인 이유를
     * 이 줄이 말한다.
     */
    expect(winRateAt("1-10")).toBe(0);
    // 2장 끝에서 흔들리고 3장에서는 대부분 진다. 편성 칸이 셋인 이유다 — 혼자 밀 수 있는
    // 구간은 있어도 그 구간이 끝나는 자리가 분명해야 한다.
    expect(winRateAt("2-10")).toBe(0);
    expect(winRateAt("3-5")).toBe(0);
  });

  /** 적 레벨은 스토리 내내 뒤로 가지 않는다. 새 구역이 직전 구역보다 약해 보이면 곡선이 끊긴 것이다. */
  it("적 레벨은 관문 순서를 따라 단조 증가한다", () => {
    // **정예 관문은 이 줄 밖이다.** 혼자 서는 몫을 유형 배수가 내므로 레벨이 잡졸 줄과
    // 나란히 오르지 않는다(`docs/level-design.md`).
    const levels = BATTLE_STAGES.filter(({ stage }) => stage.elite !== true).map(({ stage }) => stage.enemies[0].level);
    for (let index = 1; index < levels.length; index += 1) {
      expect(levels[index], `${index}번째 잡졸 관문`).toBeGreaterThanOrEqual(levels[index - 1]);
    }
    // 곡선이 실제로 크게 그려지는지 — 처음과 끝이 여섯 배 넘게 벌어진다.
    expect(levels[levels.length - 1] / levels[0]).toBeGreaterThan(6);
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
    const report = inspectStageDifficulty(blendedParty(entry.globalOrder, BLENDED_COMBOS[1]), getStageEnemies(entry.stage), SEEDS);

    // 블렌딩 파티 가운데 조합의 기록이다 — 잡졸은 깎이며 흐르고, 정예 둘만 여기서 멈춘다.
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
    // 실제 전장 크기로 옮기자(v0.172.6) 붙어서 싸우는 거리가 짧아져 도디·티아가 최악으로 내려앉았다.
    expect(parties.favorable.map(({ id }) => id)).toEqual(["anky", "tia", "parua"]);
    expect(parties.unfavorable.map(({ id }) => id)).toEqual(["anky", "dodo", "tia"]);
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
