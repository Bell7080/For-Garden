/** 원정 증강의 제안 등급이다. 일반(SR)과 정예(SSR) 전투의 후보 풀을 분리한다. */
export type ExpeditionAugmentRarity = "sr" | "ssr";
/** 개인 효과는 한 렐릭을 고르고, 전체 효과는 선택 즉시 파티 전체에 적용된다. */
export type ExpeditionAugmentTarget = "relic" | "party";
/** 후보 카드가 같은 문양·색 어휘를 공유하도록 효과의 전술 카테고리를 명시한다. */
export type ExpeditionAugmentCategory = "attack" | "spell" | "survival" | "shield" | "recovery" | "status" | "conditional";

/** 같은 효과를 여러 번 얻었을 때 전투 코어가 적용할 수치 결합 방식이다. */
export type ExpeditionAugmentStacking =
  | { mode: "additive" }
  | { mode: "additiveCapped"; capPercent: number }
  | { mode: "strongest" };

/** 전투 코어 또는 전투 후 정산이 소비할 수 있는 정적 파라미터다. */
export type ExpeditionAugmentParams =
  | { kind: "maxHpPercent" | "defensePercent" | "resistancePercent" | "attackPowerPercent" | "spellPowerPercent" | "attackSpeedPercent" | "statusPotencyPercent"; percent: number }
  | { kind: "initialShieldPercent"; percent: number; trigger: "battleStart"; limits: { maxTriggers: 1; cooldownSeconds: 0; maxStacks: 1; target: "self" | "allAllies" } }
  | { kind: "bleedOnAttack"; strength: "standard" | "minor"; everyNAttacks: number; reapplication: "refresh"; trigger: "onBasicHit"; limits: { maxTriggers: number; cooldownSeconds: number; maxStacks: 1; target: "hitTarget" } }
  | { kind: "healAfterBattlePercent"; percent: number; trigger: "afterBattle"; limits: { maxTriggers: 1; cooldownSeconds: 0; maxStacks: 1; target: "allAllies" } }
  | { kind: "lowHpAttackPowerPercent"; percent: number; belowHpPercent: number; trigger: "onLowHp"; limits: { maxTriggers: 1; cooldownSeconds: 0; maxStacks: 1; target: "self" } }
  | Omit<import("../core/expeditionAugments").ExpeditionTriggeredEffect, "scope">;

/** 제안 필터와 전투 수치 결합이 같은 운영 표를 읽도록 한 증강 정의다. */
export interface ExpeditionAugmentDef {
  id: string;
  name: string;
  rarity: ExpeditionAugmentRarity;
  target: ExpeditionAugmentTarget;
  category: ExpeditionAugmentCategory;
  /** 한 런에서 이 ID를 선택할 수 있는 최대 횟수다. */
  maxStacks: number;
  /** 가산형·합산 상한형·최강 단일 적용을 효과마다 명시한다. */
  stacking: ExpeditionAugmentStacking;
  /** 값이 같은 증강 중 하나를 얻으면 나머지는 해당 런 후보에서 제거된다. */
  exclusiveGroup?: string;
  /** 운영 검색·이벤트 풀 구성을 위한 비실행 메타데이터다. */
  tags: readonly string[];
  effect: ExpeditionAugmentParams;
}

/** SR은 전체 6~10%/개인 14~18%, SSR은 전체 14~18%/개인 25~30%를 기본 예산으로 삼는다. */
export const EXPEDITION_AUGMENTS = [
  // 공격/SR: 범용 전체 공격력은 다른 전체 능력치와 같은 8% 기준이다.
  { id: "reinforced-core", name: "강화 코어", rarity: "sr", target: "party", category: "attack", maxStacks: 3, stacking: { mode: "additive" }, exclusiveGroup: "sr-party-offense", tags: ["attack", "party", "attackPowerPercent"], effect: { kind: "attackPowerPercent", percent: 8 } },
  // 공격/SR: 한 기에 집중하는 대신 전체 효과의 약 두 배인 18%를 준다.
  { id: "predator-instinct", name: "포식 본능", rarity: "sr", target: "relic", category: "attack", maxStacks: 3, stacking: { mode: "additive" }, tags: ["attack", "relic", "attackPowerPercent"], effect: { kind: "attackPowerPercent", percent: 18 } },
  // 주문/SR: 마법 조합의 전체 주문력을 공격력 전체안과 같은 8%로 맞춘다.
  { id: "echo-circuit", name: "공명 회로", rarity: "sr", target: "party", category: "spell", maxStacks: 3, stacking: { mode: "additive" }, exclusiveGroup: "sr-party-offense", tags: ["spell", "party", "spellPowerPercent"], effect: { kind: "spellPowerPercent", percent: 8 } },
  // 주문/SR: 개인 주문력 18%는 물리 개인안과 같은 단일 대상 예산이다.
  { id: "focused-spectrum", name: "집속 스펙트럼", rarity: "sr", target: "relic", category: "spell", maxStacks: 3, stacking: { mode: "additive" }, tags: ["spell", "relic", "spellPowerPercent"], effect: { kind: "spellPowerPercent", percent: 18 } },
  // 생존/SR: HP는 회복·보호막과 시너지가 있어 전체 예산을 7%로 한 단계 낮춘다.
  { id: "vital-lattice", name: "생체 격자", rarity: "sr", target: "party", category: "survival", maxStacks: 3, stacking: { mode: "additive" }, tags: ["survival", "party", "maxHpPercent"], effect: { kind: "maxHpPercent", percent: 7 } },
  // 생존/SR: 물리 방어만 올리므로 전체 10%까지 허용한다.
  { id: "layered-carapace", name: "적층 갑각", rarity: "sr", target: "party", category: "survival", maxStacks: 3, stacking: { mode: "additive" }, tags: ["survival", "party", "defensePercent"], effect: { kind: "defensePercent", percent: 10 } },
  // 생존/SR: 마법 방어 전용이며 갑각과 같은 10% 축이다.
  { id: "phase-membrane", name: "위상 피막", rarity: "sr", target: "party", category: "survival", maxStacks: 3, stacking: { mode: "additive" }, tags: ["survival", "party", "resistancePercent"], effect: { kind: "resistancePercent", percent: 10 } },
  // 보호막/SR: 전투마다 최대 HP 8%를 선지급해 장기전보다 초반 안정성을 산다.
  { id: "opening-aegis", name: "개막 방벽", rarity: "sr", target: "party", category: "shield", maxStacks: 2, stacking: { mode: "additiveCapped", capPercent: 30 }, tags: ["shield", "party", "initialShieldPercent"], effect: { kind: "initialShieldPercent", percent: 8, trigger: "battleStart", limits: { maxTriggers: 1, cooldownSeconds: 0, maxStacks: 1, target: "allAllies" } } },
  // 회복/SR: 전투 중 전력을 올리지 않는 대신 런 유지력 8%를 제공한다.
  { id: "field-repair", name: "현장 수복", rarity: "sr", target: "party", category: "recovery", maxStacks: 3, stacking: { mode: "additiveCapped", capPercent: 50 }, tags: ["recovery", "party", "healAfterBattlePercent"], effect: { kind: "healAfterBattlePercent", percent: 8, trigger: "afterBattle", limits: { maxTriggers: 1, cooldownSeconds: 0, maxStacks: 1, target: "allAllies" } } },
  // 상태/SR: 상태 지속시간을 개인 15% 늘려 상태 특화 개체에만 효율이 모이게 한다.
  { id: "reactive-medium", name: "반응 매질", rarity: "sr", target: "relic", category: "status", maxStacks: 3, stacking: { mode: "additive" }, tags: ["status", "relic", "statusPotencyPercent"], effect: { kind: "statusPotencyPercent", percent: 15 } },
  // 상태/SR: 작은 출혈은 표준 출혈과 이름·강도를 분리하고 두 번째 공격마다 단일 슬롯을 갱신한다.
  { id: "minor-blood-edge", name: "작은 출혈날", rarity: "sr", target: "relic", category: "status", maxStacks: 1, stacking: { mode: "strongest" }, tags: ["status", "relic", "bleedOnAttack"], effect: { kind: "bleedOnAttack", strength: "minor", everyNAttacks: 2, reapplication: "refresh", trigger: "onBasicHit", limits: { maxTriggers: 20, cooldownSeconds: 0, maxStacks: 1, target: "hitTarget" } } },
  // 조건/SR: 절반 이하에서만 켜지는 개인 공격력이라 상시 18%보다 높은 24%를 쓴다.
  { id: "last-instinct", name: "최후 본능", rarity: "sr", target: "relic", category: "conditional", maxStacks: 3, stacking: { mode: "additive" }, tags: ["conditional", "relic", "lowHpAttackPowerPercent"], effect: { kind: "lowHpAttackPowerPercent", percent: 24, belowHpPercent: 50, trigger: "onLowHp", limits: { maxTriggers: 1, cooldownSeconds: 0, maxStacks: 1, target: "self" } } },
  // 공격/SSR: 정예 전체 공격력은 SR 전체의 두 배인 16%다.
  { id: "apex-signal", name: "정점 신호", rarity: "ssr", target: "party", category: "attack", maxStacks: 3, stacking: { mode: "additive" }, exclusiveGroup: "ssr-party-offense", tags: ["attack", "party", "attackPowerPercent"], effect: { kind: "attackPowerPercent", percent: 16 } },
  // 공격/SSR: 개인 집중안은 전체안보다 강한 28%지만 한 기만 강화한다.
  { id: "relentless-hunt", name: "불굴의 추적", rarity: "ssr", target: "relic", category: "attack", maxStacks: 3, stacking: { mode: "additive" }, tags: ["attack", "relic", "attackPowerPercent"], effect: { kind: "attackPowerPercent", percent: 28 } },
  // 공격/SSR: 행동 횟수는 에너지·상태 발동도 늘리므로 전체 공속을 보수적인 14%로 둔다.
  { id: "overclock-field", name: "과회전 역장", rarity: "ssr", target: "party", category: "attack", maxStacks: 3, stacking: { mode: "additive" }, tags: ["attack", "party", "attackSpeedPercent"], effect: { kind: "attackSpeedPercent", percent: 14 } },
  // 주문/SSR: 전체 주문력 16%는 물리 정점 신호와 대칭이다.
  { id: "astral-resonance", name: "성운 공명", rarity: "ssr", target: "party", category: "spell", maxStacks: 3, stacking: { mode: "additive" }, exclusiveGroup: "ssr-party-offense", tags: ["spell", "party", "spellPowerPercent"], effect: { kind: "spellPowerPercent", percent: 16 } },
  // 생존/SSR: 최대 HP 전체 14%는 보호막·회복 시너지 때문에 공격 예산보다 낮다.
  { id: "primeval-vigor", name: "태고의 활력", rarity: "ssr", target: "party", category: "survival", maxStacks: 3, stacking: { mode: "additive" }, tags: ["survival", "party", "maxHpPercent"], effect: { kind: "maxHpPercent", percent: 14 } },
  // 생존/SSR: 두 피해 경로를 동시에 올리지 않고 개인 방어에 30%를 집중한다.
  { id: "adamant-shell", name: "불괴의 외피", rarity: "ssr", target: "relic", category: "survival", maxStacks: 3, stacking: { mode: "additive" }, tags: ["survival", "relic", "defensePercent"], effect: { kind: "defensePercent", percent: 30 } },
  // 생존/SSR: 개인 저항 30%는 불괴의 외피와 피해 계열만 다르다.
  { id: "null-horizon", name: "무효 지평", rarity: "ssr", target: "relic", category: "survival", maxStacks: 3, stacking: { mode: "additive" }, tags: ["survival", "relic", "resistancePercent"], effect: { kind: "resistancePercent", percent: 30 } },
  // 보호막/SSR: 한 기 최대 HP 25% 선지급은 집중 포화를 버티는 탱커 선택지다.
  { id: "guardian-cocoon", name: "수호 고치", rarity: "ssr", target: "relic", category: "shield", maxStacks: 2, stacking: { mode: "additiveCapped", capPercent: 30 }, tags: ["shield", "relic", "initialShieldPercent"], effect: { kind: "initialShieldPercent", percent: 25, trigger: "battleStart", limits: { maxTriggers: 1, cooldownSeconds: 0, maxStacks: 1, target: "self" } } },
  // 회복/SSR: 전투 후 전체 16%는 즉시 전투력 대신 다음 노드 생존을 산다.
  { id: "regrowth-protocol", name: "재생 프로토콜", rarity: "ssr", target: "party", category: "recovery", maxStacks: 3, stacking: { mode: "additiveCapped", capPercent: 50 }, tags: ["recovery", "party", "healAfterBattlePercent"], effect: { kind: "healAfterBattlePercent", percent: 16, trigger: "afterBattle", limits: { maxTriggers: 1, cooldownSeconds: 0, maxStacks: 1, target: "allAllies" } } },
  // 상태/SSR: 공용 표준 출혈을 세 번째 공격마다 갱신해 빠른 공격자의 기대 피해가 무한히 커지지 않는다.
  { id: "blood-edge", name: "선혈의 날", rarity: "ssr", target: "relic", category: "status", maxStacks: 1, stacking: { mode: "strongest" }, tags: ["status", "relic", "bleedOnAttack"], effect: { kind: "bleedOnAttack", strength: "standard", everyNAttacks: 3, reapplication: "refresh", trigger: "onBasicHit", limits: { maxTriggers: 20, cooldownSeconds: 0, maxStacks: 1, target: "hitTarget" } } },
  // 상태/SSR: 전체 상태 지속 18%는 상태 없는 파티원에게 가치가 없다는 위험을 반영한다.
  { id: "volatile-atmosphere", name: "불안정 대기", rarity: "ssr", target: "party", category: "status", maxStacks: 3, stacking: { mode: "additive" }, tags: ["status", "party", "statusPotencyPercent"], effect: { kind: "statusPotencyPercent", percent: 18 } },
  // 조건/SSR: 체력 40% 이하에서만 개인 공격력 38%가 켜지는 역전용 고위험 선택지다.
  { id: "extinction-drive", name: "절멸 구동", rarity: "ssr", target: "relic", category: "conditional", maxStacks: 3, stacking: { mode: "additive" }, tags: ["conditional", "relic", "lowHpAttackPowerPercent"], effect: { kind: "lowHpAttackPowerPercent", percent: 38, belowHpPercent: 40, trigger: "onLowHp", limits: { maxTriggers: 1, cooldownSeconds: 0, maxStacks: 1, target: "self" } } },
  // 조건/SR: 전투 시작 한 번만 전체 생존 아군에게 최대 체력 6% 보호막을 준다.
  { id: "formation-barrier", name: "진형 방벽", rarity: "sr", target: "party", category: "shield", maxStacks: 2, stacking: { mode: "additiveCapped", capPercent: 30 }, tags: ["shield", "party", "triggered"], effect: { kind: "triggered", trigger: "battleStart", payload: { kind: "shield", maxHpPercent: 6 }, limits: { maxTriggers: 1, cooldownSeconds: 0, maxStacks: 1, target: "allAllies" } } },
  // 공격/SR: 첫 궁극기 한 번의 비용만 20% 줄여 이후 궁극기에는 영향을 남기지 않는다.
  { id: "first-resonance", name: "첫 공명", rarity: "sr", target: "relic", category: "attack", maxStacks: 1, stacking: { mode: "strongest" }, tags: ["attack", "relic", "triggered"], effect: { kind: "triggered", trigger: "onUltimate", payload: { kind: "ultimateCostReduction", percent: 20 }, limits: { maxTriggers: 1, cooldownSeconds: 0, maxStacks: 1, target: "self" } } },
  // 상태/SR: 치명타 사건 하나당 한 번만 작은 출혈을 공용 상태 슬롯에 갱신한다.
  { id: "critical-incision", name: "치명 절개", rarity: "sr", target: "relic", category: "status", maxStacks: 1, stacking: { mode: "strongest" }, tags: ["status", "relic", "triggered"], effect: { kind: "triggered", trigger: "onCritical", payload: { kind: "status", status: { kind: "bleed", seconds: 2, maxHpPercentPerSecond: 1 } }, limits: { maxTriggers: 8, cooldownSeconds: 0.5, maxStacks: 1, target: "hitTarget" } } },
  // 주문/SSR: 저주가 이미 걸린 직접 적중 대상에게만 제한된 추가 마법 피해를 준다.
  { id: "hex-overload", name: "주박 과부하", rarity: "ssr", target: "relic", category: "spell", maxStacks: 1, stacking: { mode: "strongest" }, tags: ["spell", "relic", "triggered"], effect: { kind: "triggered", trigger: "onBasicHit", payload: { kind: "conditionalBonusDamage", percent: 18, damageType: "magical", requiresStatus: "curse" }, limits: { maxTriggers: 12, cooldownSeconds: 0.2, maxStacks: 1, target: "hitTarget" } } },
  // 공격/SSR: 기절한 직접 적중 대상에게만 제한된 추가 물리 피해를 준다.
  { id: "stun-breaker", name: "기절 파쇄", rarity: "ssr", target: "relic", category: "attack", maxStacks: 1, stacking: { mode: "strongest" }, tags: ["attack", "relic", "triggered"], effect: { kind: "triggered", trigger: "onBasicHit", payload: { kind: "conditionalBonusDamage", percent: 22, damageType: "physical", requiresStatus: "stun" }, limits: { maxTriggers: 10, cooldownSeconds: 0.25, maxStacks: 1, target: "hitTarget" } } },
  // 생존/SSR: 낮은 체력 구간 진입을 전투당 한 번만 기록해 방어·저항을 함께 강화한다.
  { id: "last-bastion", name: "최후 보루", rarity: "ssr", target: "relic", category: "survival", maxStacks: 1, stacking: { mode: "strongest" }, tags: ["survival", "relic", "triggered"], effect: { kind: "triggered", trigger: "onLowHp", payload: { kind: "lowHpDefense", belowHpPercent: 35, defensePercent: 30, resistancePercent: 30 }, limits: { maxTriggers: 1, cooldownSeconds: 0, maxStacks: 1, target: "self" } } },
  // 회복/SSR: 처치한 당사자만 최대 체력 12%를 회복하며 연속 처치는 내부 쿨타임으로 제한한다.
  { id: "predation-repair", name: "포식 수복", rarity: "ssr", target: "relic", category: "recovery", maxStacks: 1, stacking: { mode: "strongest" }, tags: ["recovery", "relic", "triggered"], effect: { kind: "triggered", trigger: "onKill", payload: { kind: "heal", maxHpPercent: 12 }, limits: { maxTriggers: 5, cooldownSeconds: 1, maxStacks: 1, target: "self" } } },
] as const satisfies readonly ExpeditionAugmentDef[];

/** 저장 검증과 UI 조회가 같은 표를 사용하도록 ID 조회를 공개한다. */
export function getExpeditionAugment(id: string): ExpeditionAugmentDef | undefined { return EXPEDITION_AUGMENTS.find((augment) => augment.id === id); }
