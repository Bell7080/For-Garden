import { describe, expect, it } from "vitest";
import {
  ENCOUNTER_ROLE, ENEMY_LEVEL_GROWTH_PERCENT, applyEncounterScaling, encounterEnemyLevel,
  enemyLevelMultiplier, isEncounterOnTarget, requiredBreakthroughForLevel, type EncounterRole,
} from "../../src/core/levelDesign";
import { BREAKTHROUGH_STEPS, RELIC_LEVEL_CAP, applyLevelGrowth } from "../../src/core/relicProgression";
import { summarizeStageDifficulty } from "../../src/core/stageDifficulty";
import { CHAPTERS, getStageEnemies, stageEnemyRole } from "../../src/data/stages";
import { getRelic } from "../../src/data/relics";
import { BOUNTY_TIERS, bountyRoundEnemy } from "../../src/data/bounty";
import { CAKE_OPERATION_TIERS, cakeOperationEnemies, cakeOperationRole } from "../../src/data/cakeOperation";
import { getExpeditionEncounterEnemies } from "../../src/data/expeditionEnemies";
import type { BattleStageDef, RelicDef } from "../../src/core/types";

const ROLES = ["normal", "swarm", "elite", "boss", "endless"] as const satisfies readonly EncounterRole[];

describe("레벨 디자인 키트", () => {
  it("의 유형 차는 잡졸에서 보스로 갈수록 커지되 작게 남는다", () => {
    // 플레이어는 곱셈을 해독하지 않고 "내 레벨과 비슷하네 / 셋 위네"만 읽는다.
    const offsets = ROLES.map((role) => ENCOUNTER_ROLE[role].levelOffset);
    expect(offsets).toEqual([...offsets].sort((a, b) => a - b));
    expect(ENCOUNTER_ROLE.normal.levelOffset).toBe(0);
    expect(Math.max(...offsets)).toBeLessThanOrEqual(10);
    expect(encounterEnemyLevel(12, "elite")).toBe(12 + ENCOUNTER_ROLE.elite.levelOffset);
  });

  it("은 세기의 몫을 레벨이 아니라 유형 배수로 낸다", () => {
    /*
     * 혼자 선 정예가 셋 몫을 내려면 능력치가 세 배 필요한데, 그것을 레벨 차로만 표현하려 했기
     * 때문에 예전의 야성 ×5가 태어났다. 머릿수를 대신하는 몫은 이 배수가 갖는다.
     */
    expect(ENCOUNTER_ROLE.elite.count).toBe(1);
    expect(ENCOUNTER_ROLE.elite.hpMultiplier).toBeGreaterThanOrEqual(ENCOUNTER_ROLE.normal.count);
    // 때리는 몫은 훨씬 작다 — 혼자 서는 개체는 한 번에 하나만 때리므로 같은 배수면 즉사한다.
    expect(ENCOUNTER_ROLE.elite.attackMultiplier).toBeLessThan(ENCOUNTER_ROLE.elite.hpMultiplier / 2);
    // 무리는 반대다: 하나가 가볍고 수가 많다.
    expect(ENCOUNTER_ROLE.swarm.count).toBeGreaterThan(ENCOUNTER_ROLE.normal.count);
    expect(ENCOUNTER_ROLE.swarm.hpMultiplier).toBeLessThan(1);
  });

  it("의 배수는 체력과 공격에만 걸리고 나머지는 그 개체의 것이다", () => {
    // 공속·이속·치명타는 그 개체의 정체성이라 유형이 건드리지 않는다.
    const base = getRelic("toby").stats;
    const scaled = applyEncounterScaling(base, 1, "elite");
    expect(scaled.hp).toBe(Math.round(base.hp * ENCOUNTER_ROLE.elite.hpMultiplier));
    expect(scaled.atk).toBe(Math.round(base.atk * ENCOUNTER_ROLE.elite.attackMultiplier));
    for (const key of ["attackSpeed", "moveSpeed", "critChance", "critDamage", "lifeSteal"] as const) {
      expect(scaled[key], key).toBe(base[key]);
    }
  });

  it("의 적 곡선은 등급을 가르지 않고 플레이어와 나란히 읽힌다", () => {
    // 적에게 희귀도는 가챠 개념이라 성장률을 가를 이유가 없고, 플레이어 곡선과 같은 자리에
    // 두었으므로 "내가 18인데 저건 21이네"가 그대로 뜻이 된다.
    expect(enemyLevelMultiplier(1)).toBe(1);
    expect(enemyLevelMultiplier(21)).toBeCloseTo(1 + 20 * ENEMY_LEVEL_GROWTH_PERCENT / 100, 10);
    const player = applyLevelGrowth(getRelic("ella").stats, 21, "SSR").hp / getRelic("ella").stats.hp;
    expect(Math.abs(player - enemyLevelMultiplier(21))).toBeLessThan(0.1);
  });

  it("은 한계 돌파 사다리 위에 놓인다", () => {
    // 상한이 20인 사람에게 권장 28짜리 관문을 세우면 그 관문은 막힌 문이다.
    expect(requiredBreakthroughForLevel(RELIC_LEVEL_CAP)).toBe(0);
    expect(requiredBreakthroughForLevel(RELIC_LEVEL_CAP + 1)).toBe(1);
    expect(requiredBreakthroughForLevel(BREAKTHROUGH_STEPS.at(-1)!.levelCap)).toBe(BREAKTHROUGH_STEPS.length);
    expect(() => requiredBreakthroughForLevel(BREAKTHROUGH_STEPS.at(-1)!.levelCap + 1)).toThrow(RangeError);
  });

  it("의 목표 띠는 잡졸에서 보스로 갈수록 길고 아프다", () => {
    // 시간과 잔여 체력을 함께 두는 이유: 20초가 걸려도 체력이 그대로면 그냥 긴 잡졸이다.
    const ladder = ["normal", "elite", "boss"] as const;
    for (let i = 1; i < ladder.length; i += 1) {
      const previous = ENCOUNTER_ROLE[ladder[i - 1]];
      const current = ENCOUNTER_ROLE[ladder[i]];
      expect(current.ttkSeconds![0]).toBeGreaterThanOrEqual(previous.ttkSeconds![0]);
      expect(current.remainingHp[1]).toBeLessThan(previous.remainingHp[1]);
    }
    expect(isEncounterOnTarget("normal", { ttkSeconds: 13, remainingHp: 0.85 })).toBe(true);
    expect(isEncounterOnTarget("elite", { ttkSeconds: 13, remainingHp: 0.85 })).toBe(false);
  });

  it("을 관문과 대작전이 같은 규칙으로 고른다", () => {
    expect(stageEnemyRole(battleStage("1-5"))).toBe("elite");
    expect(stageEnemyRole(battleStage("1-1"))).toBe("normal");
    // 대작전은 떼로 몰려오는 콘텐츠라 어느 단계든 무리다.
    for (const tier of CAKE_OPERATION_TIERS) expect(cakeOperationRole(tier), tier.id).toBe("swarm");
  });
});

/*
 * **이행 기록이다.** `docs/level-design.md` §1의 표를 코드가 다시 잰다 — 목표 띠에 아직 들지
 * 않은 자리가 있고, 그것을 "알고 남겨 둔 구멍" 표로 적어 두지 않는 이유는 그런 표가 한 번
 * 번지면 아무도 지우지 않기 때문이다. 대신 **측정값 자체를 고정**해 두어, 레벨표나 유형 배수를
 * 손보면 이 검수에 반드시 걸리고 그때 띠에 들어왔는지 함께 읽게 한다.
 */
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
const REFERENCE_COMBO = ["ella", "maki", "stella"] as const;

function referenceParty(level: number): RelicDef[] {
  return REFERENCE_COMBO.map((id) => {
    const def = getRelic(id);
    return { ...def, stats: applyLevelGrowth(def.stats, level, def.rarity) };
  });
}

function measure(playerLevel: number, enemies: readonly RelicDef[]): { ttkSeconds: number; remainingHp: number } {
  const report = summarizeStageDifficulty(referenceParty(playerLevel), [...enemies], SEEDS, "auto");
  return { ttkSeconds: report.durationSeconds.mean, remainingHp: report.playerHpRatio.mean };
}

function battleStage(id: string): BattleStageDef {
  const stage = CHAPTERS.flatMap(({ stages }) => stages).find((entry) => entry.id === id);
  if (!stage || stage.kind !== "battle") throw new Error(`전투 관문이 아니다: ${id}`);
  return stage;
}

/** [이름, 권장 파티 레벨, 적, 그 조우의 역할, 실측 전투 시간(초), 실측 잔여 체력] */
const AUDIT: readonly [string, number, () => readonly RelicDef[], EncounterRole, number, number][] = [
  ["스토리 1-1", 5, () => getStageEnemies(battleStage("1-1")), "normal", 13.1, 0.84],
  ["스토리 1-9", 14, () => getStageEnemies(battleStage("1-9")), "normal", 14.0, 0.84],
  ["스토리 1-5 정예", 10, () => getStageEnemies(battleStage("1-5")), "elite", 15.4, 0.55],
  ["스토리 1-10 정예", 15, () => getStageEnemies(battleStage("1-10")), "elite", 31.1, 0.29],
  ["스토리 3-9", 44, () => getStageEnemies(battleStage("3-9")), "normal", 14.3, 0.93],
  ["현상수배 1단계", 5, () => [bountyRoundEnemy(BOUNTY_TIERS[0].rounds[0])], "normal", 5.4, 0.87],
  ["현상수배 5단계", 50, () => [bountyRoundEnemy(BOUNTY_TIERS[4].rounds[0])], "normal", 7.2, 0.89],
  ["대작전 1단계", 5, () => cakeOperationEnemies(CAKE_OPERATION_TIERS[0]), "swarm", 31.1, 0.85],
  ["대작전 8단계", 45, () => cakeOperationEnemies(CAKE_OPERATION_TIERS[7]), "swarm", 71.0, 0.65],
  ["원정 일반 5층", 10, () => getExpeditionEncounterEnemies("normal", 5), "normal", 13.9, 0.95],
  ["원정 정예 10층", 20, () => getExpeditionEncounterEnemies("elite", 10), "elite", 34.0, 0.14],
  ["원정 무리 15층", 30, () => getExpeditionEncounterEnemies("horde", 15), "swarm", 15.5, 0.77],
];

describe("콘텐츠별 전투 시간 실측", () => {
  it.each(AUDIT)("%s", (_label, playerLevel, enemies, _role, ttk, hp) => {
    const measured = measure(playerLevel, enemies());
    // 띠보다 좁게 고정한다 — 다음 조정이 반드시 여기 걸리게 하려는 기록이다.
    expect(measured.ttkSeconds).toBeGreaterThan(ttk - 2);
    expect(measured.ttkSeconds).toBeLessThan(ttk + 2);
    expect(measured.remainingHp).toBeGreaterThan(hp - 0.1);
    expect(measured.remainingHp).toBeLessThan(hp + 0.1);
  });

  it("은 아직 목표 띠에 다 들어오지 않았고, 어디가 남았는지 이 줄이 기록한다", () => {
    /*
     * 잡졸은 전 콘텐츠가 자리를 잡았고(13~14초에 한 뼘씩 깎이며 흐른다), 큰 무리도 들어왔다.
     * **장을 닫는 정예(SSR 코마)는 띠 안에 들어왔다** — 31초를 싸우고 파티가 3분의 1만 남는다.
     * 남은 자리는 셋이다: R 토비가 선 1-5는 같은 유형인데도 15초에 끝나 덜 아프고(개체의
     * 등급이 결과를 가른다), 현상수배는 1대1이라 한 몫짜리 조우이며, 대작전은 웨이브 없이
     * 열~열다섯이 한꺼번에 몰려와 한 판이 무리 띠(한 파 기준)보다 길다. 원정 정예는 아직
     * 재측정이 남았다.
     */
    const offTarget = AUDIT.filter(([, , , role, ttk, hp]) => !isEncounterOnTarget(role, { ttkSeconds: ttk, remainingHp: hp }));
    expect(offTarget.map(([label]) => label)).toEqual([
      "스토리 1-5 정예", "현상수배 1단계", "현상수배 5단계", "대작전 1단계", "대작전 8단계", "원정 정예 10층",
    ]);
  });
});
