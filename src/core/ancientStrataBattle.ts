import { getRelic } from "../data/relics";
import { getBattleStage, getStageEnemies } from "../data/stages";
import { ANCIENT_DIFFICULTY_BANDS, ANCIENT_REINFORCEMENTS, ANCIENT_STRATA_ENEMY_LEVEL, ANCIENT_STRATA_MAX_FLOOR, ANCIENT_STRATA_TIME_LIMIT_SECONDS } from "../data/ancientStrataDifficulty";
import { applyEncounterScaling, ENCOUNTER_ROLE } from "./levelDesign";
import { battleArena } from "./battleArena";
import { createSkirmish, type CreateSkirmishOptions } from "./skirmish";
import type { RelicDef, Stats } from "./types";

export function assertAncientFloor(floor: number): void {
  if (!Number.isInteger(floor) || floor < 1 || floor > ANCIENT_STRATA_MAX_FLOOR) throw new RangeError("고대 지층은 1~200층 정수만 허용합니다.");
}

/** 1층은 쉬움 1-10의 실제 적과 동일. 이후 전용 배율만 복리로 곱한다. */
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

function scale(stats: Stats, multipliers: ReturnType<typeof ancientStrataMultipliers>, share = 1): Stats {
  const scaled = { ...stats };
  for (const key of ["hp", "atk", "ap", "def", "res"] as const) {
    const factor = key === "hp" ? multipliers.hp : key === "atk" || key === "ap" ? multipliers.attack : multipliers.defense;
    scaled[key] = Math.max(1, Math.round(stats[key] * factor * share));
  }
  return scaled;
}

/** UI·전투·검수가 함께 소비할 전용 층 정의. 원정 증강/불사/레이드 공유 HP를 사용하지 않는다. */
export function getAncientStrataFloor(floor: number) {
  const multipliers = ancientStrataMultipliers(floor);
  const reference = getStageEnemies(getBattleStage("1-10"))[0];
  const enemies: RelicDef[] = [{ ...reference, stats: scale(reference.stats, multipliers) }];
  const shares: number[] = [1];
  for (const reinforcement of ANCIENT_REINFORCEMENTS) {
    if (floor < reinforcement.startsAt) continue;
    const progress = (Math.min(floor, reinforcement.fullAt) - reinforcement.startsAt) / (reinforcement.fullAt - reinforcement.startsAt);
    const share = reinforcement.maximumShare * (reinforcement.initialShare + (1 - reinforcement.initialShare) * progress);
    const base = getRelic(reinforcement.relicId);
    enemies.push({ ...base, encounterRole: "normal", stats: scale(applyEncounterScaling(base.stats, ANCIENT_STRATA_ENEMY_LEVEL, "normal", 3), multipliers, share) });
    shares.push(share);
  }
  const band = ANCIENT_DIFFICULTY_BANDS.find(band => floor <= band.last)!;
  return { floor, level: ANCIENT_STRATA_ENEMY_LEVEL, breakthrough: 0, focus: band.focus,
    timeLimitSeconds: ANCIENT_STRATA_TIME_LIMIT_SECONDS, multipliers, reinforcementShares: shares, enemies,
    enemyBreakthroughs: enemies.map(() => 0), enemyBodyScales: enemies.map(enemy => ENCOUNTER_ROLE[enemy.encounterRole!].bodyScale) };
}

export function createAncientStrataSkirmish(floor: number, players: readonly RelicDef[], options: {
  bonds?: Record<string, number>; breakthroughs?: Record<string, number>; automaticUltimates?: boolean;
  augmentEffects?: CreateSkirmishOptions["augmentEffects"];
} = {}) {
  const definition = getAncientStrataFloor(floor);
  return createSkirmish([...players], definition.enemies, battleArena("ancient"), options.bonds ?? {}, options.breakthroughs ?? {}, {
    automaticUltimates: options.automaticUltimates ?? true, augmentEffects: options.augmentEffects,
    enemyBreakthroughs: definition.enemyBreakthroughs, enemyBodyScales: definition.enemyBodyScales,
  });
}
