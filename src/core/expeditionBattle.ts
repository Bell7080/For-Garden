import type { ExpeditionNodeType } from "./expeditionMap";
import type { ExpeditionAugmentSelection } from "./expeditionRewards";
import { getExpeditionAugment } from "../data/expeditionAugments";
import type { ExpeditionAugmentEffect } from "./expeditionAugments";
import { EXPEDITION_COMBAT_BALANCE } from "../data/expedition";
import { EXPEDITION_BOSS_BALANCE } from "../data/expedition";
import type { RelicDef } from "./types";
import type { FighterInitialState, SkirmishBossPhase, SkirmishRelicResult } from "./skirmish";

/** 원정 씬이 전투 씬에 넘기는 직렬화 가능한 입력이다. 전투 씬은 Session 편성을 추측하지 않는다. */
export interface ExpeditionBattleInputDto {
  mode: "expedition";
  runId: string;
  nodeId: string;
  nodeType: Extract<ExpeditionNodeType, "normal" | "elite" | "horde">;
  floor: number;
  relics: readonly FighterInitialState[];
  augments: readonly ExpeditionAugmentSelection[];
}

/** 20층 불사 보스는 일반 난전과 종료 조건이 달라 입력부터 명시적으로 분리한다. */
export interface ExpeditionBossBattleInputDto {
  mode: "expeditionBoss";
  runId: string;
  nodeId: string;
  floor: 20;
  relics: readonly FighterInitialState[];
  augments: readonly ExpeditionAugmentSelection[];
  requestId: string;
  settlementId: string;
}

/** 원정 노드가 기존 난전 표현에 주입하는 순수 전투 스냅샷이다. */
export interface ExpeditionSkirmishConfig {
  playerDefs: RelicDef[];
  enemyDefs: RelicDef[];
  playerInitialStates: FighterInitialState[];
  augmentEffects: ExpeditionAugmentEffect[];
  enemyBodyScale: number;
}

/** 정적 밸런스를 적 스냅샷과 Puppet 배율로 한 번만 해석한다. */
export function createExpeditionSkirmishConfig(input: ExpeditionBattleInputDto, playerDefs: readonly RelicDef[], enemyPool: readonly RelicDef[]): ExpeditionSkirmishConfig {
  if (enemyPool.length === 0) throw new RangeError("원정 적 원본이 비어 있습니다.");
  // 전용 보스 입력은 이 경계에 도달하지 않으므로 세 일반 전투의 표만 읽는다.
  const balance = EXPEDITION_COMBAT_BALANCE[input.nodeType];
  const activeIds = new Set(input.relics.filter(({ alive, currentHp }) => alive && currentHp > 0).map(({ relicId }) => relicId));
  const scaleStats = (def: RelicDef): RelicDef => ({ ...def, stats: Object.fromEntries(Object.entries(def.stats).map(([key, value]) => [key, value * balance.statScale])) as unknown as RelicDef["stats"] });
  return {
    playerDefs: playerDefs.filter(({ id }) => activeIds.has(id)),
    enemyDefs: Array.from({ length: balance.enemyCount }, (_, index) => scaleStats(enemyPool[index % enemyPool.length])),
    playerInitialStates: input.relics.filter(({ relicId }) => activeIds.has(relicId)).map((state) => ({ ...state })),
    augmentEffects: expeditionBattleEffects(input.augments),
    enemyBodyScale: balance.bodyScale,
  };
}

/** 20층도 공용 난전에 넣되 보스 HP만 표시상 충분히 크게 만들어 사망 연출이 끼어들지 않게 한다. */
export function createExpeditionBossSkirmishConfig(input: ExpeditionBossBattleInputDto, playerDefs: readonly RelicDef[], enemyPool: readonly RelicDef[]): ExpeditionSkirmishConfig & { boss: { phases: SkirmishBossPhase[]; limitSeconds: number } } {
  if (!enemyPool[0]) throw new RangeError("원정 보스 원본이 비어 있습니다.");
  const activeIds = new Set(input.relics.filter(({ alive, currentHp }) => alive && currentHp > 0).map(({ relicId }) => relicId));
  const boss = enemyPool[0];
  return {
    playerDefs: playerDefs.filter(({ id }) => activeIds.has(id)),
    enemyDefs: [{ ...boss, stats: { ...boss.stats, hp: Number.MAX_SAFE_INTEGER } }],
    playerInitialStates: input.relics.filter(({ relicId }) => activeIds.has(relicId)),
    augmentEffects: expeditionBattleEffects(input.augments),
    enemyBodyScale: 1.25,
    boss: {
      phases: EXPEDITION_BOSS_BALANCE.phases.map((phase) => ({ startsAt: phase.startsAtMs / 1_000, damagePerSecond: phase.attackPerSecond, label: phase.label })),
      limitSeconds: EXPEDITION_BOSS_BALANCE.maximumDurationMs / 1_000,
    },
  };
}

/** 불참한 사망자까지 입력 순서로 복원해 매니저가 검증할 완전한 종료 DTO를 만든다. */
export function expeditionBattleResults(input: ExpeditionBattleInputDto, activeResults: readonly SkirmishRelicResult[]): SkirmishRelicResult[] {
  const byId = new Map(activeResults.map((result) => [result.relicId, result]));
  return input.relics.map((initial) => ({ ...(byId.get(initial.relicId) ?? initial) }));
}

/** 일반 스테이지 진입과 원정 진입을 명시적으로 구분하는 전투 씬 입력 계약이다. */
export type BattleSceneInputDto = ExpeditionBattleInputDto | ExpeditionBossBattleInputDto | { mode?: "stage" };

/** 저장 선택을 전투 코어가 소비하는 효과로 바꾸며 비전투 회복 효과는 이 목록에서 제외한다. */
export function expeditionBattleEffects(selections: readonly ExpeditionAugmentSelection[]): ExpeditionAugmentEffect[] {
  return selections.flatMap(({ augmentId, targetRelicId }) => {
    const effect = getExpeditionAugment(augmentId)?.effect;
    if (!effect || effect.kind === "healAfterBattlePercent") return [];
    const scope = targetRelicId ? { kind: "relic" as const, relicId: targetRelicId } : { kind: "all" as const };
    return [{ ...effect, scope }];
  });
}
