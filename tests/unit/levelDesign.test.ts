import { describe, expect, it } from "vitest";
import {
  ENCOUNTER_ROLE, ENEMY_LEVEL_GROWTH_PERCENT, applyEncounterScaling,
  enemyLevelMultiplier, isEncounterOnTarget, requiredBreakthroughForLevel, type EncounterRole,
} from "../../src/core/levelDesign";
import { BREAKTHROUGH_STEPS, RELIC_LEVEL_CAP, applyLevelGrowth } from "../../src/core/relicProgression";
import { summarizeStageDifficulty } from "../../src/core/stageDifficulty";
import { battleArena, type BattleArenaMode } from "../../src/core/battleArena";
import { CHAPTERS, getStageEnemies, stageEnemyRole } from "../../src/data/stages";
import { getRelic } from "../../src/data/relics";
import { BOUNTY_TIERS, bountyRoundEnemy } from "../../src/data/bounty";
import { CAKE_OPERATION_TIERS, cakeOperationEnemies, cakeOperationRole } from "../../src/data/cakeOperation";
import { getExpeditionEncounterEnemies } from "../../src/data/expeditionEnemies";
import type { BattleStageDef, RelicDef } from "../../src/core/types";

const ROLES = ["normal", "swarm", "elite", "boss", "endless"] as const satisfies readonly EncounterRole[];

describe("레벨 디자인 키트", () => {
  it("의 유형은 레벨을 건드리지 않는다", () => {
    /*
     * 유형마다 레벨을 얹던 때(잡졸 +0 · 무리 +1 · 정예 +3)는 같은 사다리 위에서 정예 자리만
     * 솟았다가 다음 관문에서 도로 내려앉았다 — 1-5가 LV.19인데 1-6이 LV.15였다. 사다리를
     * 오르는 사람에게 그 내리막은 "여기부터 약해진다"로 읽힌다. 레벨은 콘텐츠 사다리 하나가
     * 정하고, 유형은 체력·공격 배수로만 말한다.
     */
    for (const role of ROLES) {
      expect(Object.keys(ENCOUNTER_ROLE[role]), role).not.toContain("levelOffset");
      const base = getRelic("toby").stats;
      expect(applyEncounterScaling(base, 12, role).def).toBe(applyEncounterScaling(base, 12, "normal").def);
    }
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
      // 판 안에서 눕지 않는 자리(보스·불사)는 제한 시간이 곧 길이라 목표 시간이 없다.
      if (current.ttkSeconds !== null) expect(current.ttkSeconds[0]).toBeGreaterThanOrEqual(previous.ttkSeconds![0]);
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

/** 콘텐츠마다 실제로 서는 전장에서 잰다 — 전장이 넓으면 붙기까지 걷는 시간만큼 결과가 갈린다. */
function measure(playerLevel: number, enemies: readonly RelicDef[], mode: BattleArenaMode): { ttkSeconds: number; remainingHp: number } {
  const report = summarizeStageDifficulty(referenceParty(playerLevel), [...enemies], SEEDS, "auto", battleArena(mode));
  return { ttkSeconds: report.durationSeconds.mean, remainingHp: report.playerHpRatio.mean };
}

function battleStage(id: string): BattleStageDef {
  const stage = CHAPTERS.flatMap(({ stages }) => stages).find((entry) => entry.id === id);
  if (!stage || stage.kind !== "battle") throw new Error(`전투 관문이 아니다: ${id}`);
  return stage;
}

/** [이름, 권장 파티 레벨, 적, 그 조우의 역할, 전장, 실측 전투 시간(초), 실측 잔여 체력] */
const AUDIT: readonly [string, number, () => readonly RelicDef[], EncounterRole, BattleArenaMode, number, number][] = [
  ["스토리 1-1", 5, () => getStageEnemies(battleStage("1-1")), "normal", "stage", 13.3, 0.88],
  ["스토리 1-9", 14, () => getStageEnemies(battleStage("1-9")), "normal", "stage", 16.9, 0.87],
  ["스토리 1-5 정예", 10, () => getStageEnemies(battleStage("1-5")), "elite", "stage", 12.2, 0.88],
  ["스토리 1-10 정예", 15, () => getStageEnemies(battleStage("1-10")), "elite", "stage", 61.2, 0.08],
  ["스토리 3-9", 44, () => getStageEnemies(battleStage("3-9")), "normal", "stage", 20.1, 0.85],
  ["현상수배 1단계", 5, () => [bountyRoundEnemy(BOUNTY_TIERS[0].rounds[0])], "normal", "bounty", 5.6, 0.83],
  ["현상수배 5단계", 50, () => [bountyRoundEnemy(BOUNTY_TIERS[4].rounds[0])], "normal", "bounty", 8.2, 0.74],
  ["대작전 1단계", 5, () => cakeOperationEnemies(CAKE_OPERATION_TIERS[0]), "swarm", "cake", 27.2, 0.82],
  ["대작전 8단계", 45, () => cakeOperationEnemies(CAKE_OPERATION_TIERS[7]), "swarm", "cake", 59.6, 0.65],
  ["원정 일반 5층", 10, () => getExpeditionEncounterEnemies("normal", 5), "normal", "expedition", 14.3, 0.96],
  ["원정 정예 10층", 20, () => getExpeditionEncounterEnemies("elite", 10), "elite", "expedition", 39.7, 0.45],
  ["원정 무리 15층", 30, () => getExpeditionEncounterEnemies("horde", 15), "swarm", "expedition", 14.1, 0.76],
];

describe("콘텐츠별 전투 시간 실측", () => {
  it.each(AUDIT)("%s", (_label, playerLevel, enemies, _role, mode, ttk, hp) => {
    const measured = measure(playerLevel, enemies(), mode);
    // 띠보다 좁게 고정한다 — 다음 조정이 반드시 여기 걸리게 하려는 기록이다.
    expect(measured.ttkSeconds).toBeGreaterThan(ttk - 2);
    expect(measured.ttkSeconds).toBeLessThan(ttk + 2);
    expect(measured.remainingHp).toBeGreaterThan(hp - 0.1);
    expect(measured.remainingHp).toBeLessThan(hp + 0.1);
  });

  it("은 아직 목표 띠에 다 들어오지 않았고, 어디가 남았는지 이 줄이 기록한다", () => {
    /*
     * **v0.172.6에서 검수를 실제 전장 크기로 옮겨 다시 쟀다.** 넓은 틀에서 재던 때와 방향이
     * 엇갈렸다 — 잡졸은 더 가볍고 길어졌고(붙기까지 걷는 거리가 짧아 후열이 덜 맞는다), 혼자
     * 서는 정예는 훨씬 무거워졌다(후열까지 금방 닿는다). 정예 공격 몫을 ×1.1로 낮춰 1-10과
     * 원정 10층을 띠에 들였다.
     * 남은 자리: 잡졸 셋(1-9·3-9는 목표보다 몇 초 길고, 원정 5층은 거의 다치지 않는다),
     * R 토비가 선 1-5(12초에 끝나 덜 아프다 — 누가 서는가의 문제다), 코마가 선 1-10(v0.174.2에서 공격
     * 몫을 ×1.2로 올려 **일부러 벽으로 세웠다** — 권장 레벨 파티가 여기서 한 번 막힌다), 원정 10층 정예
     * (35초로 목표보다 조금 길다), 현상수배 둘(1대1이라 한 몫짜리 조우), 대작전 8단계(열다섯이 한꺼번에
     * 몰려와 한 판이 무리 띠보다 길다).
     * **v0.174.3에서 아군 보호막을 키우자 정예 둘이 길어졌다**(1-10 49.4 → 61.2초, 원정 10층
     * 35.2 → 39.7초). 막이 피해를 먼저 받아 맞으며 차는 충전이 줄고 버티는 시간이 늘었다. 1-10의
     * 승률·잔여 체력은 그대로라 벽은 그대로 벽이다. 원정은 레벨 디자인을 다시 할 때 함께 본다.
     */
    const offTarget = AUDIT.filter(([, , , role, , ttk, hp]) => !isEncounterOnTarget(role, { ttkSeconds: ttk, remainingHp: hp }));
    expect(offTarget.map(([label]) => label)).toEqual([
      "스토리 1-9", "스토리 1-5 정예", "스토리 1-10 정예", "스토리 3-9",
      "현상수배 1단계", "현상수배 5단계", "대작전 8단계", "원정 일반 5층", "원정 정예 10층",
    ]);
  });
});
