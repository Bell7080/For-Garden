import { getRelic } from "../data/relics";
import { getBattleStage, getStageEnemies } from "../data/stages";
import { ancientStageId, ANCIENT_DIFFICULTY_BANDS, ancientFirstClearReward, ANCIENT_PERCENT_HP_BASIS_CAP_FLOOR, ANCIENT_STRATA_ENEMY_LEVEL, ANCIENT_STRATA_MAX_FLOOR } from "../data/ancientStrataDifficulty";
import { ANCIENT_ENCOUNTERS, ANCIENT_TRIAL_IDS, ANCIENT_TRIALS, ancientEncounterRole } from "../data/ancientStrataEncounters";
import { applyEncounterScaling, ENCOUNTER_ROLE } from "./levelDesign";
import { battleArena } from "./battleArena";
import { canFireUltimate, fireUltimate, stepSkirmish, createSkirmish, type SkirmishState, type CreateSkirmishOptions } from "./skirmish";
import type { ExpeditionAugmentEffect } from "./expeditionAugments";
import type { RelicDef, Stats, StageBonusReward, BattleStageDef } from "./types";
import type { StageFirstClearReward } from "./stageRewards";

export function assertAncientFloor(floor: number): void {
  if (!Number.isInteger(floor) || floor < 1 || floor > ANCIENT_STRATA_MAX_FLOOR) throw new RangeError("고대 지층은 1~200층 정수만 허용합니다.");
}

/** 1-10 정예의 예산을 출발점으로 삼되, 층마다 조우와 시련을 바꾼다. */
export function ancientStrataMultipliers(floor: number): { hp: number; attack: number; defense: number } {
  assertAncientFloor(floor);
  const result = { hp: 1, attack: 1, defense: 1 };
  for (const band of ANCIENT_DIFFICULTY_BANDS) {
    const steps = Math.max(0, Math.min(floor, band.last) - Math.max(2, band.first) + 1);
    result.hp *= band.hpStep ** steps;
    result.attack *= band.attackStep ** steps;
    result.defense *= band.defenseStep ** steps;
  }
  return result;
}

/** 200층 전부의 편성·시련·능력치·보상 계약. 생성 시 원본 정의를 수정하지 않는다. */
export function getAncientStrataFloor(floor: number) {
  const multipliers = ancientStrataMultipliers(floor);
  const block = Math.floor((floor - 1) / 10), template = ANCIENT_ENCOUNTERS[(floor - 1) % 10];
  const roster = template.rosters[block % template.rosters.length];
  const trialId = ANCIENT_TRIAL_IDS[(floor - 1 + block) % ANCIENT_TRIAL_IDS.length], trial = ANCIENT_TRIALS[trialId];
  const reference = getStageEnemies(getBattleStage("1-10"))[0];
  const roles = roster.map((_, index) => ancientEncounterRole(template.kind, index));
  const raw = roster.map((id, index) => applyEncounterScaling(getRelic(id).stats, ANCIENT_STRATA_ENEMY_LEVEL, roles[index], roles.filter(role => role === roles[index]).length));
  const rawHp = raw.reduce((sum, stats) => sum + stats.hp, 0);
  const pressure = (stats: Stats) => Math.max(stats.atk, stats.ap) * stats.attackSpeed / 100;
  const rawPressure = raw.reduce((sum, stats) => sum + pressure(stats), 0);
  const hpFactor = reference.stats.hp / rawHp * multipliers.hp * template.hpBudget * trial.hp;
  const attackFactor = pressure(reference.stats) / rawPressure * multipliers.attack * template.attackBudget * trial.attack;
  const enemies: RelicDef[] = roster.map((id, index) => {
    const base = getRelic(id), stats = { ...raw[index] };
    stats.hp = Math.max(1, Math.round(stats.hp * hpFactor));
    stats.atk = Math.max(1, Math.round(stats.atk * attackFactor));
    stats.ap = Math.max(1, Math.round(stats.ap * attackFactor));
    stats.def = Math.max(1, Math.round(stats.def * multipliers.defense * template.defenseBudget * trial.defense));
    stats.res = Math.max(1, Math.round(stats.res * multipliers.defense * template.defenseBudget * trial.defense));
    return { ...base, encounterRole: roles[index], stats };
  });
  const enemyAugmentEffects: ExpeditionAugmentEffect[] = trialId === "shield" ? [{ kind: "initialShieldPercent", percent: 10, scope: { kind: "all" } }]
    : trialId === "charge" ? [{ kind: "openingEnergyPercent", percent: 20, scope: { kind: "all" } }] : [];
  const band = ANCIENT_DIFFICULTY_BANDS.find(band => floor <= band.last)!;
  return { floor, level: ANCIENT_STRATA_ENEMY_LEVEL, breakthrough: 0, focus: band.focus,
    encounterId: template.id, encounterKind: template.kind, rosterVariant: block % template.rosters.length,
    trialId, trial, timeLimitSeconds: trial.seconds, multipliers, budgetFactors: { hp: hpFactor, attack: attackFactor }, enemies,
    enemyPercentHpBases: enemies.map(enemy => Math.max(1, Math.round(enemy.stats.hp * ancientStrataMultipliers(Math.min(floor,ANCIENT_PERCENT_HP_BASIS_CAP_FLOOR)).hp / multipliers.hp))),
    firstClearRewards: [ancientFirstClearReward(floor)] satisfies StageFirstClearReward[],
    repeatClearRewards: [] as StageBonusReward[], enemyAugmentEffects,
    enemyBreakthroughs: enemies.map(() => 0), enemyBodyScales: enemies.map(enemy => ENCOUNTER_ROLE[enemy.encounterRole!].bodyScale) };
}

export function createAncientStrataSkirmish(floor: number, players: readonly RelicDef[], options: {
  bonds?: Record<string, number>; breakthroughs?: Record<string, number>; automaticUltimates?: boolean;
  augmentEffects?: CreateSkirmishOptions["augmentEffects"];
} = {}) {
  const definition = getAncientStrataFloor(floor);
  return createSkirmish([...players], definition.enemies, battleArena("ancient"), options.bonds ?? {}, options.breakthroughs ?? {}, {
    automaticUltimates: options.automaticUltimates ?? false, augmentEffects: options.augmentEffects,
    timeLimitSeconds: definition.timeLimitSeconds, enemyPercentHpBases: definition.enemyPercentHpBases, enemyAugmentEffects: definition.enemyAugmentEffects, enemyBreakthroughs: definition.enemyBreakthroughs, enemyBodyScales: definition.enemyBodyScales,
  });
}

/** 스토리 목록에는 섞지 않고 공용 입장·검증·초회 정산 계약만 재사용한다. */
export function getAncientStrataStage(floor: number): BattleStageDef {
  const d = getAncientStrataFloor(floor);
  return { kind: "battle", id: ancientStageId(floor), name: `B${floor}`, ancientFloor: floor, sub: true,
    prerequisiteStageIds: [floor === 1 ? "1-10" : ancientStageId(floor-1)],
    enemies: d.enemies.map((enemy,index)=>({ relicId:enemy.id,level:d.level,breakthrough:0,formationSlot:index as 0|1|2|3|4,
      ...(enemy.encounterRole === "elite" ? { elite:true as const } : {}) })),
    ...(d.encounterKind === "elite" || d.encounterKind === "eliteDuo" ? { elite:true as const } : {}),
    rewards: { firstClearCheesecake: d.firstClearRewards.reduce((sum, r) => sum + (r.kind === "currency" && r.currency === "cheesecake" ? r.amount : 0), 0),
      repeatClearCheesecake:0, firstClearBonus: d.firstClearRewards.flatMap((r): StageBonusReward[] => r.kind === "currency" && r.currency === "cheesecake" ? [] : [r as StageBonusReward]) } };
}

/** 실전 스토리/지층의 자동 조작: 적은 코어 AI, 아군 궁극기는 고정 틱 뒤 입력한다. */
export function stepAncientStrataBattle(state: SkirmishState, dt: number, rng: () => number, control: "auto" | "manualUltimate" = "auto") {
  const events = stepSkirmish(state,dt,rng);
  if(state.automaticUltimates || state.phase !== "fight")return events;
  const allies=state.fighters.filter(f=>f.side==="player" && f.summonOwnerId===null && f.hp>0);
  for(const fighter of allies) {
    const ult=fighter.def.ultimate;
    const supportive=ult.effectType==="healing" || ult.targeting==="battlefieldAllies" || "selfBulwark" in ult;
    if(canFireUltimate(state,fighter) && (control==="auto" || !supportive || allies.some(f=>f.hp/f.maxHp<=.7))) events.push(...fireUltimate(state,fighter.id,rng));
    if(state.phase!=="fight")break;
  }
  return events;
}
