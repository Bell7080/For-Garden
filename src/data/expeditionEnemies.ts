import { applyLevelGrowth } from "../core/relicProgression";
import type { ExpeditionNodeType } from "../core/expeditionMap";
import type { RelicDef } from "../core/types";
import { getRelic } from "./relics";
import { EXPEDITION_COMBAT_BALANCE } from "./expedition";

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

/** 최종층 보스는 일반 boss fallback 표와 섞지 않아 다른 층의 임시 보스 편성을 바꾸지 않는다. */
const FINAL_FLOOR_BOSS_ID = "pontos";

/** 층과 조우 난도를 함께 반영한 표시/전투 공용 적 레벨이다. */
export function expeditionEnemyLevel(type: ExpeditionNodeType, floor: number): number {
  const difficulty = type === "boss" ? 5 : type === "elite" ? 3 : type === "horde" ? 2 : 0;
  return Math.max(1, floor + difficulty);
}

/** 정보창과 실제 난전이 같은 ID·레벨·속성 정의를 소비하도록 성장 적용 사본을 만든다. */
export function getExpeditionNodeEnemies(type: ExpeditionNodeType, floor: number): RelicDef[] {
  const level = expeditionEnemyLevel(type, floor);
  // 20층 boss 노드만 폰토스 단독 편성이고, 그 밖의 boss 호출은 기존 3인 fallback을 유지한다.
  const ids: readonly string[] = type === "boss" && floor === 20
    ? [FINAL_FLOOR_BOSS_ID]
    : EXPEDITION_ENEMY_FORMATIONS[type];
  return ids.map((id) => {
    const enemy = getRelic(id);
    return { ...enemy, stats: applyLevelGrowth(enemy.stats, level, enemy.rarity) };
  });
}

/** 정보판에는 실제 전투 수(일반 3·정예 1·무리 5)를 그대로 펼쳐 미리보기와 출격 결과를 일치시킨다. */
export function getExpeditionEncounterEnemies(type: ExpeditionNodeType, floor: number): RelicDef[] {
  const pool = getExpeditionNodeEnemies(type, floor);
  // 최종층 boss는 단독 조우이며, 일반 boss fallback만 기존 세 자리를 유지한다.
  const count = type === "boss" && floor === 20
    ? 1
    : type === "normal" || type === "elite" || type === "horde" ? EXPEDITION_COMBAT_BALANCE[type].enemyCount : 3;
  return Array.from({ length: count }, (_, index) => pool[index % pool.length]);
}
