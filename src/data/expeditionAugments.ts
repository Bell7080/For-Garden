/** 원정 증강의 제안 등급이다. 일반 전투와 정예 전투의 풀을 분리하는 데이터 키이기도 하다. */
export type ExpeditionAugmentRarity = "common" | "advanced";

/** 개인 효과는 한 렐릭을 고르고, 전체 효과는 선택 즉시 파티 전체에 적용된다. */
export type ExpeditionAugmentTarget = "relic" | "party";

/** 전투 코어가 해석할 수 있는 효과와 수치 파라미터의 정적 모양이다. */
export type ExpeditionAugmentParams =
  | { kind: "attackPowerPercent"; percent: number }
  | { kind: "bleedOnAttack"; percent: number; seconds: number }
  | { kind: "healAfterBattlePercent"; percent: number };

/** 운영 데이터 한 행이다. 모든 증강은 횟수 제한 없이 중복 획득할 수 있다. */
export interface ExpeditionAugmentDef {
  id: string;
  name: string;
  rarity: ExpeditionAugmentRarity;
  target: ExpeditionAugmentTarget;
  effect: ExpeditionAugmentParams;
}

/** 증강 ID·표시명·등급·범위·효과 수치의 단일 정적 출처다. */
export const EXPEDITION_AUGMENTS = [
  { id: "reinforced-core", name: "강화 코어", rarity: "common", target: "party", effect: { kind: "attackPowerPercent", percent: 8 } },
  { id: "predator-instinct", name: "포식 본능", rarity: "common", target: "relic", effect: { kind: "attackPowerPercent", percent: 18 } },
  { id: "field-repair", name: "현장 수복", rarity: "common", target: "party", effect: { kind: "healAfterBattlePercent", percent: 8 } },
  { id: "blood-edge", name: "선혈의 날", rarity: "advanced", target: "relic", effect: { kind: "bleedOnAttack", percent: 12, seconds: 4 } },
  { id: "apex-signal", name: "정점 신호", rarity: "advanced", target: "party", effect: { kind: "attackPowerPercent", percent: 16 } },
  { id: "relentless-hunt", name: "불굴의 추적", rarity: "advanced", target: "relic", effect: { kind: "attackPowerPercent", percent: 28 } },
] as const satisfies readonly ExpeditionAugmentDef[];

/** 저장 검증과 UI 조회가 같은 표를 사용하도록 ID 조회를 공개한다. */
export function getExpeditionAugment(id: string): ExpeditionAugmentDef | undefined {
  return EXPEDITION_AUGMENTS.find((augment) => augment.id === id);
}
