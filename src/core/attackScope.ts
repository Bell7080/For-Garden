import type { RelicDef } from "./types";

/** 여럿을 치는 대상 계약 — 정보창 태그(`characterTags`)와 자동 배치(`partyAffinity`)가 같은 판정을 읽는다. */
const AREA_TARGETING = new Set(["nearbyEnemies", "splitShot", "battlefieldEnemies", "targetedCircle", "chargeLine"]);

/**
 * 피해를 주는 기술이 여럿을 치는가. 아군·자신에게만 거는 궁극기는 공격 범위로 세지 않는다.
 *
 * 맨 위 `targeting`만 보면 순환 걸음의 갈래화살·휘두르기(파루아·엘라), 여울로 뛰어드는 도약(스피나),
 * 가까운 적부터 나눠 꽂는 연발(테쿠)이 모두 「단일」로 섰다 — 전투가 실제로 여럿을 치는 계약을 함께 읽는다.
 */
export function hitsArea(def: Pick<RelicDef, "basic" | "ultimate">): boolean {
  const basic = def.basic as { targeting?: string; cycle?: readonly { targeting?: string }[]; shallows?: unknown };
  if (basic.targeting !== undefined && AREA_TARGETING.has(basic.targeting)) return true;
  if ((basic.cycle ?? []).some((step) => step.targeting !== undefined && AREA_TARGETING.has(step.targeting))) return true;
  if (basic.shallows !== undefined) return true;
  const ultimate = def.ultimate as { targeting?: string; effectType: string; barrage?: unknown };
  if (ultimate.effectType === "healing" || ultimate.effectType === "buff") return false;
  return ultimate.barrage !== undefined || (ultimate.targeting !== undefined && AREA_TARGETING.has(ultimate.targeting));
}
