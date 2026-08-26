import { applyLevelGrowth } from "../core/relicProgression";
import type { ExpeditionNodeType } from "../core/expeditionMap";
import type { RelicDef } from "../core/types";
import { getRelic } from "./relics";

/**
 * 원정 노드별 적 편성의 단일 정적 경계다.
 *
 * 현재 보유한 적 원화 세 종을 조우 성격별 순서로 배치한다. 새 적 데이터가 들어오면 이 표의 ID만
 * 교체하면 정보창과 실제 전투가 함께 바뀌며, 씬에 별도의 임시 공용 편성이 남지 않는다.
 */
const EXPEDITION_ENEMY_FORMATIONS: Record<ExpeditionNodeType, readonly [string, string, string]> = {
  normal: ["husk-raptor", "husk-shell", "husk-wing"],
  elite: ["husk-shell", "husk-raptor", "husk-wing"],
  horde: ["husk-wing", "husk-raptor", "husk-shell"],
  boss: ["husk-shell", "husk-wing", "husk-raptor"],
  // 비전투 노드는 표시/전투 함수에서 호출하지 않지만 완전한 타입 표를 유지한다.
  rest: ["husk-raptor", "husk-shell", "husk-wing"],
  treasure: ["husk-raptor", "husk-shell", "husk-wing"],
};

/** 층과 조우 난도를 함께 반영한 표시/전투 공용 적 레벨이다. */
export function expeditionEnemyLevel(type: ExpeditionNodeType, floor: number): number {
  const difficulty = type === "boss" ? 5 : type === "elite" ? 3 : type === "horde" ? 2 : 0;
  return Math.max(1, floor + difficulty);
}

/** 정보창과 실제 난전이 같은 ID·레벨·속성 정의를 소비하도록 성장 적용 사본을 만든다. */
export function getExpeditionNodeEnemies(type: ExpeditionNodeType, floor: number): [RelicDef, RelicDef, RelicDef] {
  const level = expeditionEnemyLevel(type, floor);
  return EXPEDITION_ENEMY_FORMATIONS[type].map((id) => {
    const enemy = getRelic(id);
    return { ...enemy, stats: applyLevelGrowth(enemy.stats, level) };
  }) as [RelicDef, RelicDef, RelicDef];
}
