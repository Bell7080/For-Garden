import { applyEncounterScaling, encounterEnemyLevel, encounterRoleFor, type EncounterRole } from "../core/levelDesign";
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
export const EXPEDITION_ENEMY_FORMATIONS: Record<ExpeditionNodeType, readonly [string, string, string]> = {
  normal: ["toby", "amo", "ripa"],
  /*
   * **정예 조우에는 때릴 줄 아는 개체가 첫 자리에 선다.** 혼자 서는 자리인데 아모(탱커)가
   * 앞에 있던 때는 실측에서 스물일곱 초를 싸우고도 파티 체력이 **한 점도 깎이지 않았다** —
   * 정예가 묻는 것은 단일 딜과 유지력인데 그 조우가 아무것도 묻지 않았다.
   */
  elite: ["koma", "amo", "ripa"],
  horde: ["ripa", "toby", "amo"],
  boss: ["amo", "ripa", "toby"],
  // 비전투 노드는 표시/전투 함수에서 호출하지 않지만 완전한 타입 표를 유지한다.
  rest: ["toby", "amo", "ripa"],
  treasure: ["toby", "amo", "ripa"],
};

/** 최종층 보스는 일반 boss fallback 표와 섞지 않아 다른 층의 임시 보스 편성을 바꾸지 않는다. */
export const FINAL_FLOOR_BOSS_ID = "pontos";

/**
 * 그 노드가 서는 **유형**. 층 번호가 아니라 노드 종류가 정한다.
 *
 * 예전에는 원정만 `층 + 난도 보정(0·2·3·5)`이라는 제 방언을 썼다 — 다른 콘텐츠가 야성 단계를
 * 쓰는 동안 여기만 다른 자로 쟀고, 그래서 일반·정예·무리가 실측에서 전부 9초짜리 같은 싸움이
 * 되었다. 지금은 유형 표 하나를 함께 읽는다.
 */
export function expeditionNodeRole(type: ExpeditionNodeType, floor: number): EncounterRole {
  if (type === "boss") return floor >= 20 ? "endless" : "boss";
  return encounterRoleFor(type === "horde" ? ENCOUNTER_HORDE_COUNT : 3, { elite: type === "elite" });
}

/** 원정의 권장 레벨 사다리 — 층이 곧 그 자리다. 유형 차는 위 표가 얹는다. */
export function expeditionRecommendedLevel(floor: number): number {
  return Math.max(1, Math.round(floor * EXPEDITION_LEVEL_PER_FLOOR));
}

/** 한 층을 오를 때마다 권장 레벨이 얼마나 오르는가. 스무 층이 곧 한 판이라 두 배로 잡는다. */
const EXPEDITION_LEVEL_PER_FLOOR = 2;

/** 무리 노드에 서는 수. 유형을 고르는 자리와 실제로 세우는 자리가 같은 값을 읽는다. */
const ENCOUNTER_HORDE_COUNT = 5;

/** 층과 조우 난도를 함께 반영한 표시/전투 공용 적 레벨이다. */
export function expeditionEnemyLevel(type: ExpeditionNodeType, floor: number): number {
  return encounterEnemyLevel(expeditionRecommendedLevel(floor), expeditionNodeRole(type, floor));
}

/** 정보창과 실제 난전이 같은 ID·레벨·속성 정의를 소비하도록 성장 적용 사본을 만든다. */
export function getExpeditionNodeEnemies(type: ExpeditionNodeType, floor: number): RelicDef[] {
  const level = expeditionEnemyLevel(type, floor);
  // 20층 boss 노드만 폰토스 단독 편성이고, 그 밖의 boss 호출은 기존 3인 fallback을 유지한다.
  const ids: readonly string[] = type === "boss" && floor === 20
    ? [FINAL_FLOOR_BOSS_ID]
    : EXPEDITION_ENEMY_FORMATIONS[type];
  const role = expeditionNodeRole(type, floor);
  return ids.map((id) => {
    const enemy = getRelic(id);
    return { ...enemy, stats: applyEncounterScaling(enemy.stats, level, role) };
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
