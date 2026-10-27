import { getRelic } from "../data/relics";
import { getBattleStage, getStageEnemies } from "../data/stages";
import { ancientStageId, ANCIENT_DIFFICULTY_BANDS, ancientFirstClearReward, ANCIENT_PERCENT_HP_BASIS_CAP_FLOOR, ANCIENT_STRATA_ENEMY_LEVEL, ANCIENT_STRATA_MAX_FLOOR } from "../data/ancientStrataDifficulty";
import { ANCIENT_ENCOUNTERS, ANCIENT_TRIAL_IDS, ANCIENT_TRIALS, ancientEncounterRole, type AncientTrial } from "../data/ancientStrataEncounters";
import { ancientSeasonIndex } from "./ancientStrata";
import { applyEncounterScaling, ENCOUNTER_ROLE } from "./levelDesign";
import { battleArena } from "./battleArena";
import { canFireUltimate, fireUltimate, stepSkirmish, createSkirmish, type SkirmishState, type CreateSkirmishOptions } from "./skirmish";
import type { ExpeditionAugmentEffect } from "./expeditionAugments";
import type { RelicDef, Stats, StageBonusReward, BattleStageDef } from "./types";
import type { StageFirstClearReward } from "./stageRewards";

export function assertAncientFloor(floor: number): void {
  if (!Number.isInteger(floor) || floor < 1 || floor > ANCIENT_STRATA_MAX_FLOOR) throw new RangeError("고대 지층은 1~200층 정수만 허용합니다.");
}

/**
 * 지금 도는 달(`ancientSeasonKey`). 달마다 같은 층의 명단과 시련이 바뀌므로, 정의를 짓는 쪽이 모두 같은 달을 읽어야
 * 미리 본 적과 서버가 재현하는 적이 갈리지 않는다. 서버 역할(`FakeServer`)이 진행을 넘길 때, 클라이언트가 서버 상태를
 * 받을 때 이 값을 맞춘다.
 */
let activeSeason = "";
export function setActiveAncientSeason(season: string): void { activeSeason = season; }
export function activeAncientSeason(): string { return activeSeason; }

/** 1층의 출발점 — 보통 1-5 전체의 체력·압박·방어 예산(2026-10-27, 응태 요청으로 보통 2-10에서 낮췄다). */
const ANCIENT_REFERENCE_STAGE = "normal:1-5";

/** 보통 1-5의 예산을 출발점으로 삼되, 층마다 조우와 시련을 바꾼다. */
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

let referenceCache: { hp: number; pressure: number; defense: number } | undefined;
/** 출발 관문 적 전체의 합 — 체력·압박(공격 × 공속)은 합, 방어·저항은 한 명 평균이다. */
function ancientReferenceBudget(): { hp: number; pressure: number; defense: number } {
  if (referenceCache) return referenceCache;
  const enemies = getStageEnemies(getBattleStage(ANCIENT_REFERENCE_STAGE));
  referenceCache = {
    hp: enemies.reduce((sum, enemy) => sum + enemy.stats.hp, 0),
    pressure: enemies.reduce((sum, enemy) => sum + Math.max(enemy.stats.atk, enemy.stats.ap) * enemy.stats.attackSpeed / 100, 0),
    defense: enemies.reduce((sum, enemy) => sum + enemy.stats.def + enemy.stats.res, 0) / enemies.length,
  };
  return referenceCache;
}

/** 200층 전부의 편성·시련·능력치·보상 계약. 생성 시 원본 정의를 수정하지 않는다. */
export function getAncientStrataFloor(floor: number, season: string = activeSeason) {
  const multipliers = ancientStrataMultipliers(floor);
  // 달 번호가 명단과 시련의 출발점을 민다 — 같은 층이라도 달마다 다른 적이 다른 시련으로 선다. 조우의 종류(10층 관문 등)는 그대로다.
  const month = ancientSeasonIndex(season);
  const block = Math.floor((floor - 1) / 10), template = ANCIENT_ENCOUNTERS[(floor - 1) % 10];
  const rosterVariant = (block + month) % template.rosters.length, roster = template.rosters[rosterVariant];
  const trialId = ANCIENT_TRIAL_IDS[(floor - 1 + block + month) % ANCIENT_TRIAL_IDS.length], trial: AncientTrial = ANCIENT_TRIALS[trialId];
  const reference = ancientReferenceBudget();
  const roles = roster.map((_, index) => ancientEncounterRole(template.kind, index));
  const raw = roster.map((id, index) => applyEncounterScaling(getRelic(id).stats, ANCIENT_STRATA_ENEMY_LEVEL, roles[index], roles.filter(role => role === roles[index]).length));
  const rawHp = raw.reduce((sum, stats) => sum + stats.hp, 0);
  const pressure = (stats: Stats) => Math.max(stats.atk, stats.ap) * stats.attackSpeed / 100;
  const rawPressure = raw.reduce((sum, stats) => sum + pressure(stats), 0);
  const rawDefense = raw.reduce((sum, stats) => sum + stats.def + stats.res, 0) / raw.length;
  const hpFactor = reference.hp / rawHp * multipliers.hp * template.hpBudget * trial.hp;
  const attackFactor = reference.pressure / rawPressure * multipliers.attack * template.attackBudget * trial.attack;
  const defenseFactor = reference.defense / rawDefense * multipliers.defense * template.defenseBudget * trial.defense;
  const enemies: RelicDef[] = roster.map((id, index) => {
    const base = getRelic(id), stats = { ...raw[index] };
    stats.hp = Math.max(1, Math.round(stats.hp * hpFactor));
    stats.atk = Math.max(1, Math.round(stats.atk * attackFactor));
    stats.ap = Math.max(1, Math.round(stats.ap * attackFactor));
    stats.def = Math.max(1, Math.round(stats.def * defenseFactor));
    stats.res = Math.max(1, Math.round(stats.res * defenseFactor));
    return { ...base, encounterRole: roles[index], stats };
  });
  const enemyAugmentEffects: ExpeditionAugmentEffect[] = [
    ...(trial.initialShieldPercent ? [{ kind: "initialShieldPercent" as const, percent: trial.initialShieldPercent, scope: { kind: "all" as const } }] : []),
    ...(trial.openingEnergyPercent ? [{ kind: "openingEnergyPercent" as const, percent: trial.openingEnergyPercent, scope: { kind: "all" as const } }] : []),
  ];
  const band = ANCIENT_DIFFICULTY_BANDS.find(band => floor <= band.last)!;
  return { floor, level: ANCIENT_STRATA_ENEMY_LEVEL, breakthrough: 0, focus: band.focus,
    season, encounterId: template.id, encounterKind: template.kind, rosterVariant,
    trialId, trial, timeLimitSeconds: trial.seconds, multipliers, budgetFactors: { hp: hpFactor, attack: attackFactor, defense: defenseFactor }, enemies,
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
    prerequisiteStageIds: [floor === 1 ? "4-10" : ancientStageId(floor-1)],
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
