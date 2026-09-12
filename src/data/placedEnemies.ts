import type { BattleSceneInputDto } from "../core/expeditionBattle";
import type { BattleStageDef, RelicDef } from "../core/types";
import { expeditionEnemyLevel } from "./expeditionEnemies";

/**
 * 전장에 **실제로 선** 적 하나. 정의와 함께 그 자리에서 자란 값을 들고 다닌다.
 *
 * 정보 팝업이 정적 정의만 받으면 레벨·돌파를 스스로 되짚어야 하고, 되짚는 순간 스테이지가
 * 적어 둔 값과 갈린다 — 2돌파 25레벨로 세워 둔 적을 눌러도 1돌파 상한 20으로 읽혔다.
 */
export interface PlacedEnemy {
  def: RelicDef;
  level: number;
  breakthrough: number;
  /** 야성으로 얹힌 추가 레벨. 레벨 옆에 작고 붉게 선다. */
  ferocityLevel?: number;
}

/**
 * 난전이 매기는 `enemy-<index>` 키로 성장 스냅샷을 찾는 표.
 *
 * `enemyDefs`는 이미 성장까지 끝난 복사본이고 순서는 난전에 넘긴 그대로다 — 여기서 다시
 * 정렬하거나 성장시키지 않고 그 순서에 레벨·돌파만 짝지어 준다.
 */
export function placedEnemyIndex(
  input: BattleSceneInputDto,
  stage: BattleStageDef,
  enemyDefs: readonly RelicDef[],
): Map<string, PlacedEnemy> {
  // 원정은 노드 하나가 한 레벨을 쓰고 돌파는 아직 두지 않는다.
  const expeditionLevel = input.mode === "expedition" ? expeditionEnemyLevel(input.nodeType, input.floor)
    : input.mode === "expeditionBoss" ? expeditionEnemyLevel("boss", 20) : undefined;
  // 스토리만 적별 성장 정의를 갖는다. 성장 사본과 같은 formationSlot 순서로 짝을 맞춘다.
  const placed = expeditionLevel === undefined
    ? [...stage.enemies].sort((a, b) => a.formationSlot - b.formationSlot)
    : undefined;
  return new Map(enemyDefs.map((def, index) => {
    const growth = placed?.[index];
    return [`enemy-${index}`, {
      def,
      level: growth?.level ?? expeditionLevel ?? 1,
      breakthrough: growth?.breakthrough ?? 0,
      ...(growth?.ferocityLevel ? { ferocityLevel: growth.ferocityLevel } : {}),
    }];
  }));
}
