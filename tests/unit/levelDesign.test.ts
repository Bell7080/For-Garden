import { describe, expect, it } from "vitest";
import {
  ENCOUNTER_COMPOSITION, ENCOUNTER_LEVEL_OFFSET, ENCOUNTER_TARGET, ENEMY_LEVEL_GROWTH_PERCENT,
  encounterEnemyLevel, enemyLevelMultiplier, isEncounterOnTarget, type EncounterRole,
} from "../../src/core/levelDesign";
import { RARITY_LEVEL_GROWTH } from "../../src/core/rarityScaling";
import { summarizeStageDifficulty } from "../../src/core/stageDifficulty";
import { CHAPTERS, getStageEnemies } from "../../src/data/stages";
import { getRelic } from "../../src/data/relics";
import { applyLevelGrowth } from "../../src/core/relicProgression";
import { BOUNTY_TIERS, bountyRoundEnemy } from "../../src/data/bounty";
import { CAKE_OPERATION_TIERS, cakeOperationWaves } from "../../src/data/cakeOperation";
import { getExpeditionEncounterEnemies } from "../../src/data/expeditionEnemies";
import type { BattleStageDef, RelicDef } from "../../src/core/types";

const ROLES = ["normal", "swarm", "elite", "boss", "endless"] as const satisfies readonly EncounterRole[];

describe("레벨 디자인 키트", () => {
  it("의 유형 차는 잡졸에서 보스로 갈수록 커진다", () => {
    // 플레이어는 곱셈을 해독하지 않고 "내 레벨과 비슷하네 / 여덟 위네"만 읽는다.
    const offsets = ROLES.map((role) => ENCOUNTER_LEVEL_OFFSET[role]);
    expect(offsets).toEqual([...offsets].sort((a, b) => a - b));
    expect(ENCOUNTER_LEVEL_OFFSET.normal).toBe(0);
    expect(encounterEnemyLevel(12, "elite")).toBe(12 + ENCOUNTER_LEVEL_OFFSET.elite);
  });

  it("의 적 곡선은 플레이어보다 가파르다", () => {
    /*
     * 플레이어 곡선을 그대로 쓰면 의미 있는 세기 차에 수십 레벨이 들어 1장 정예가 107레벨이
     * 된다. 적에게 희귀도는 가챠 개념이라 성장률을 가를 이유도 없다.
     */
    for (const rate of Object.values(RARITY_LEVEL_GROWTH)) expect(ENEMY_LEVEL_GROWTH_PERCENT).toBeGreaterThan(rate);
    expect(enemyLevelMultiplier(1)).toBe(1);
    expect(enemyLevelMultiplier(21)).toBeCloseTo(2, 10);
  });

  it("은 정예를 혼자 세우지 않는다", () => {
    /*
     * 혼자 세우면 셋 몫을 하나가 내야 해서 능력치가 3배 필요하고, 3배는 레벨 차로 적을 수
     * 있는 크기가 아니다 — 야성 ×5가 태어난 자리가 정확히 여기다.
     */
    const { lead, escort } = ENCOUNTER_COMPOSITION.elite;
    expect(lead + escort).toBe(ENCOUNTER_COMPOSITION.normal.escort);
    expect(escort).toBeGreaterThan(0);
    // 무리는 파티보다 많아야 무리다.
    expect(ENCOUNTER_COMPOSITION.swarm.escort).toBeGreaterThan(ENCOUNTER_COMPOSITION.normal.escort);
  });

  it("의 목표 띠는 잡졸에서 보스로 갈수록 길고 아프다", () => {
    // 시간과 잔여 체력을 함께 두는 이유: 20초가 걸려도 체력이 그대로면 그냥 긴 잡졸이다.
    const ladder = ["normal", "swarm", "elite", "boss"] as const;
    for (let i = 1; i < ladder.length; i += 1) {
      const previous = ENCOUNTER_TARGET[ladder[i - 1]];
      const current = ENCOUNTER_TARGET[ladder[i]];
      expect(current.ttkSeconds![0]).toBeGreaterThanOrEqual(previous.ttkSeconds![0]);
      expect(current.remainingHp[1]).toBeLessThan(previous.remainingHp[1]);
    }
    expect(isEncounterOnTarget("normal", { ttkSeconds: 13, remainingHp: 0.85 })).toBe(true);
    expect(isEncounterOnTarget("elite", { ttkSeconds: 13, remainingHp: 0.85 })).toBe(false);
  });
});

/*
 * **이행 전 기록이다.** `docs/level-design.md` §1의 표를 코드가 다시 잰다 — 목표 띠에 아직
 * 들지 않은 자리가 있고(§7의 이행 순서), 그것을 "알고 남겨 둔 구멍" 표로 적어 두지 않는
 * 이유는 그런 표가 한 번 번지면 아무도 지우지 않기 때문이다. 대신 **측정값 자체를 고정**해
 * 두어, 레벨표를 손보면 이 검수에 반드시 걸리고 그때 띠에 들어왔는지 함께 읽게 한다.
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
  const report = summarizeStageDifficulty(referenceParty(playerLevel), enemies, SEEDS, "auto");
  return { ttkSeconds: report.durationSeconds.mean, remainingHp: report.playerHpRatio.mean };
}

function battleStage(id: string): BattleStageDef {
  const stage = CHAPTERS.flatMap(({ stages }) => stages).find((entry) => entry.id === id);
  if (!stage || stage.kind !== "battle") throw new Error(`전투 관문이 아니다: ${id}`);
  return stage;
}

/** [이름, 파티 레벨, 적, 이 조우가 맡은 역할, 실측 전투 시간(초), 실측 잔여 체력] */
const AUDIT: readonly [string, number, () => readonly RelicDef[], EncounterRole, number, number][] = [
  ["스토리 1-1", 8, () => getStageEnemies(battleStage("1-1")), "normal", 13.1, 0.85],
  ["스토리 1-9", 18, () => getStageEnemies(battleStage("1-9")), "normal", 13.4, 0.87],
  ["스토리 1-5 정예", 14, () => getStageEnemies(battleStage("1-5")), "elite", 14.6, 0.32],
  ["스토리 1-10 정예", 20, () => getStageEnemies(battleStage("1-10")), "elite", 16.2, 0.23],
  ["현상수배 1단계", 12, () => [bountyRoundEnemy(BOUNTY_TIERS[0].rounds[0])], "elite", 5.4, 0.93],
  ["현상수배 5단계", 45, () => [bountyRoundEnemy(BOUNTY_TIERS[4].rounds[0])], "elite", 8.4, 0.78],
  ["대작전 1단계 1파", 10, () => cakeOperationWaves(CAKE_OPERATION_TIERS[0])[0], "swarm", 18.6, 0.94],
  ["대작전 8단계 1파", 50, () => cakeOperationWaves(CAKE_OPERATION_TIERS[7])[0], "swarm", 41.0, 0.99],
  ["원정 일반 3층", 20, () => getExpeditionEncounterEnemies("normal", 3), "normal", 8.6, 0.95],
  ["원정 정예 10층", 35, () => getExpeditionEncounterEnemies("elite", 10), "elite", 8.8, 0.97],
  ["원정 무리 15층", 45, () => getExpeditionEncounterEnemies("horde", 15), "swarm", 9.2, 0.94],
];

describe("콘텐츠별 전투 시간 실측", () => {
  it.each(AUDIT)("%s", (_label, playerLevel, enemies, _role, ttk, hp) => {
    const measured = measure(playerLevel, enemies());
    // 띠보다 좁게 고정한다 — 다음 조정이 반드시 여기 걸리게 하려는 기록이다.
    expect(measured.ttkSeconds).toBeGreaterThan(ttk - 1.5);
    expect(measured.ttkSeconds).toBeLessThan(ttk + 1.5);
    expect(measured.remainingHp).toBeGreaterThan(hp - 0.08);
    expect(measured.remainingHp).toBeLessThan(hp + 0.08);
  });

  it("스토리만 지금 목표 띠 안에 서 있다", () => {
    /*
     * 이행 전 상태를 **이 한 줄이 기록한다.** 스토리는 잡졸이 흐르고 정예에서 확 깎이는 모양이
     * 이미 잡혀 있고(다만 정예의 전투 시간은 아직 짧다), 나머지 셋은 유형이 시간으로 구별되지
     * 않는다 — 원정은 일반·정예·무리가 전부 9초이고, 현상수배는 정예 하나가 5초에 죽으며,
     * 대작전은 한 파에 41초가 걸리는데 체력이 0.99 남는다.
     */
    const onTarget = AUDIT.filter(([, , , role, ttk, hp]) => isEncounterOnTarget(role, { ttkSeconds: ttk, remainingHp: hp }));
    expect(onTarget.map(([label]) => label)).toEqual(["스토리 1-1", "스토리 1-9"]);
  });
});
