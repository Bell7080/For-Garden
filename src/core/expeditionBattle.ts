import type { ExpeditionNodeType } from "./expeditionMap";
import type { ExpeditionAugmentSelection } from "./expeditionRewards";
import { getExpeditionAugment } from "../data/expeditionAugments";
import type { ExpeditionAugmentEffect } from "./expeditionAugments";

/** 원정 씬이 전투 씬에 넘기는 직렬화 가능한 입력이다. 전투 씬은 Session 편성을 추측하지 않는다. */
export interface ExpeditionBattleInputDto {
  mode: "expedition";
  runId: string;
  nodeId: string;
  nodeType: Extract<ExpeditionNodeType, "normal" | "elite" | "horde" | "boss">;
  floor: number;
  relics: readonly { relicId: string; currentHp: number }[];
  augments: readonly ExpeditionAugmentSelection[];
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
