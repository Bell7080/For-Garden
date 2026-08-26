import type { ExpeditionNodeType } from "./expeditionMap";
import type { ExpeditionAugmentSelection } from "./expeditionRewards";
import { getExpeditionAugment } from "../data/expeditionAugments";
import type { ExpeditionAugmentEffect } from "./expeditionAugments";
import { EXPEDITION_COMBAT_BALANCE } from "../data/expedition";
import type { RelicDef } from "./types";
import type { FighterInitialState, SkirmishRelicResult } from "./skirmish";

/** 원정 씬이 전투 씬에 넘기는 직렬화 가능한 입력이다. 전투 씬은 Session 편성을 추측하지 않는다. */
export interface ExpeditionBattleInputDto {
  mode: "expedition";
  runId: string;
  nodeId: string;
  nodeType: Extract<ExpeditionNodeType, "normal" | "elite" | "horde" | "boss">;
  floor: number;
  relics: readonly FighterInitialState[];
  augments: readonly ExpeditionAugmentSelection[];
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
  // 보스 전용 진행기가 연결되기 전까지 기존 3대3을 보존하되, 요청된 세 노드만 밸런스 표를 읽는다.
  const balance = input.nodeType === "boss" ? { enemyCount: 3, statScale: 1, bodyScale: 1 } : EXPEDITION_COMBAT_BALANCE[input.nodeType];
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

/** 불참한 사망자까지 입력 순서로 복원해 매니저가 검증할 완전한 종료 DTO를 만든다. */
export function expeditionBattleResults(input: ExpeditionBattleInputDto, activeResults: readonly SkirmishRelicResult[]): SkirmishRelicResult[] {
  const byId = new Map(activeResults.map((result) => [result.relicId, result]));
  return input.relics.map((initial) => ({ ...(byId.get(initial.relicId) ?? initial) }));
}

/** 일반 스테이지 진입과 원정 진입을 명시적으로 구분하는 전투 씬 입력 계약이다. */
export type BattleSceneInputDto = ExpeditionBattleInputDto | { mode?: "stage" };

/** 저장 선택을 전투 코어가 소비하는 효과로 바꾸며 비전투 회복 효과는 이 목록에서 제외한다. */
export function expeditionBattleEffects(selections: readonly ExpeditionAugmentSelection[]): ExpeditionAugmentEffect[] {
  return selections.flatMap(({ augmentId, targetRelicId }) => {
    const effect = getExpeditionAugment(augmentId)?.effect;
    if (!effect || effect.kind === "healAfterBattlePercent") return [];
    const scope = targetRelicId ? { kind: "relic" as const, relicId: targetRelicId } : { kind: "all" as const };
    return [{ ...effect, scope }];
  });
}
