import type { ExpeditionAugmentRarity, ExpeditionAugmentTarget } from "./expeditionAugments";

/**
 * 원정 증강을 같은 척도로 검수하기 위한 대표 전투 표다.
 * `equivalentPercent` 1점은 대표 전투에서 공격력 1%가 만드는 기대 피해 증가와 같다. 이 표는
 * 런타임 수식을 바꾸지 않고 운영 데이터의 초안을 비교하는 린트 기준이며, 실전 텔레메트리로
 * 가정을 바꿀 때에는 모든 증강을 한꺼번에 다시 검수한다.
 */
export const EXPEDITION_AUGMENT_REFERENCE = {
  battleSeconds: 20,
  partySize: 3,
  enemy: {
    maxHp: 10_000,
    defense: 300,
    resistance: 300,
    /** 방어와 저항의 대표 경감률. 고정 피해는 이 경감을 받지 않는 가치까지 환산한다. */
    mitigationPercent: 30,
  },
  ally: {
    maxHp: 2_000,
    attackPower: 200,
    spellPower: 200,
    attacksPerSecond: 1,
    /** 보호막·회복은 실제로 잃을 것으로 보는 체력까지만 가치로 센다. */
    expectedHpLostPercent: 60,
  },
} as const;

/** 전체 효과는 세 명에게 퍼지므로 개인 효과보다 낮은 허용 띠를 사용한다. */
export const EXPEDITION_AUGMENT_BUDGET_RANGES = {
  sr: { party: { min: 6, max: 10 }, relic: { min: 14, max: 24 } },
  ssr: { party: { min: 14, max: 18 }, relic: { min: 25, max: 38 } },
} as const satisfies Record<ExpeditionAugmentRarity, Record<ExpeditionAugmentTarget, { min: number; max: number }>>;

/**
 * 공통 기대 가치 환산 정책이다. 공격/주문 1%를 1점으로 두고, HP·보호막·회복은 대표 손실 체력,
 * 방어·저항은 대표 적의 30% 경감 구간, 고정 피해는 20초 동안의 총 피해로 환산한다.
 */
export const EXPEDITION_AUGMENT_VALUE_POLICY = {
  attackPowerPercent: 1,
  spellPowerPercent: 1,
  maxHpPercent: 0.9,
  defenseOrResistancePercent: 0.8,
  shieldPercent: 1,
  recoveryPercent: 1,
  trueDamagePercentOfEnemyMaxHp: 1.4,
} as const;

/**
 * 최대 체력 비례 고정 피해 정책. 일반 적은 한 발동 2%, 전투 전체 10%가 상한이다. 불사 보스는
 * 최대 체력 대신 현재 단계의 점수 기준 체력을 사용하고 25%만 인정해, 무한 체력/불사 판정이
 * 곧 무한 피해로 바뀌지 않게 한다. 새 효과는 반드시 공용 `ignoresDefense` 피해 경로를 쓴다.
 */
export const MAX_HP_TRUE_DAMAGE_POLICY = {
  normalEnemy: { maxPercentPerTrigger: 2, maxPercentPerBattle: 10 },
  immortalBoss: { maxPercentPerTrigger: 0.5, maxPercentPerBattle: 2.5, multiplier: 0.25, basis: "phaseScoreHp" },
} as const;

export type ExpeditionAugmentBalanceGlyph = "attack" | "spell" | "survival" | "shield" | "heal" | "status" | "conditional";

export interface ExpeditionAugmentBalanceAudit {
  equivalentPercent: number;
  glyph: ExpeditionAugmentBalanceGlyph;
  /** 수치 근거와 공용 메커니즘의 이름을 함께 남겨 자유 퍼센트/별도 콜백의 재도입을 막는다. */
  rationale: string;
  sharedMechanic: string;
}

/** 모든 카탈로그 ID의 수동 검수 장부다. 수치는 대표 전투 환산 뒤 해당 등급·범위 띠 안의 값이다. */
export const EXPEDITION_AUGMENT_BALANCE = {
  "reinforced-core": [8, "attack", "전체 공격력 기준점", "stat multiplier"],
  "predator-instinct": [18, "attack", "개인 집중은 전체안의 약 두 배", "stat multiplier"],
  "echo-circuit": [8, "spell", "공격력 전체안과 대칭", "stat multiplier"],
  "focused-spectrum": [18, "spell", "공격력 개인안과 대칭", "stat multiplier"],
  "vital-lattice": [7, "survival", "회복·보호막 시너지를 할인", "stat multiplier"],
  "layered-carapace": [8, "survival", "대표 물리 경감 30%로 환산", "defense mitigation"],
  "phase-membrane": [8, "survival", "대표 마법 경감 30%로 환산", "resistance mitigation"],
  "opening-aegis": [8, "shield", "대표 손실 체력 안의 선지급 보호막", "shared shield"],
  "field-repair": [8, "heal", "다음 전투에만 남는 회복", "after-battle heal cap"],
  "reactive-medium": [15, "status", "상태 보유자에게만 유효", "status duration"],
  "minor-blood-edge": [16, "status", "작은 출혈의 20초 기대 발동", "shared bleed slot"],
  "last-instinct": [24, "conditional", "체력 절반 이하 가동률 할인", "low-HP predicate"],
  "apex-signal": [16, "attack", "SR 전체안의 두 배", "stat multiplier"],
  "relentless-hunt": [28, "attack", "SSR 개인 집중 기준점", "stat multiplier"],
  "overclock-field": [14, "attack", "행동·에너지 동시 증가를 보수적으로 제한", "attack interval"],
  "astral-resonance": [16, "spell", "SSR 물리 전체안과 대칭", "stat multiplier"],
  "primeval-vigor": [14, "survival", "회복·보호막 시너지를 할인", "stat multiplier"],
  "adamant-shell": [30, "survival", "한 피해 계열만 막는 개인 방어", "defense mitigation"],
  "null-horizon": [30, "survival", "한 피해 계열만 막는 개인 저항", "resistance mitigation"],
  "guardian-cocoon": [25, "shield", "대표 손실 체력 안의 개인 보호막", "shared shield"],
  "regrowth-protocol": [16, "heal", "다음 전투용 전체 회복", "after-battle heal cap"],
  "blood-edge": [28, "status", "표준 출혈의 20초 기대 발동", "shared bleed slot"],
  "volatile-atmosphere": [18, "status", "상태 없는 파티원 가치 0을 반영", "status duration"],
  "extinction-drive": [38, "conditional", "체력 40% 이하 가동률 할인", "low-HP predicate"],
  "formation-barrier": [6, "shield", "전투 시작 1회 전체 보호막", "trigger dispatcher + shared shield"],
  "first-resonance": [18, "attack", "첫 궁극기 1회만 절감", "trigger dispatcher + ultimate cost"],
  "critical-incision": [16, "status", "치명 확률·쿨다운을 반영한 작은 출혈", "trigger dispatcher + shared bleed slot"],
  "hex-overload": [26, "spell", "저주 대상 가동률을 할인", "trigger dispatcher + damage"],
  "stun-breaker": [27, "attack", "기절 대상 가동률을 할인", "trigger dispatcher + damage"],
  "last-bastion": [30, "survival", "저체력 1회 발동과 두 방어축을 환산", "trigger dispatcher + mitigation"],
  "predation-repair": [25, "heal", "처치 횟수·내부 쿨다운을 할인", "trigger dispatcher + healing"],
} as const satisfies Record<string, readonly [number, ExpeditionAugmentBalanceGlyph, string, string]>;

/** 튜플 장부를 이름 있는 검수 값으로 바꿔 테스트와 향후 운영 도구가 같은 해석을 사용하게 한다. */
export function expeditionAugmentBalanceAudit(id: string): ExpeditionAugmentBalanceAudit | undefined {
  const row = EXPEDITION_AUGMENT_BALANCE[id as keyof typeof EXPEDITION_AUGMENT_BALANCE];
  return row && { equivalentPercent: row[0], glyph: row[1], rationale: row[2], sharedMechanic: row[3] };
}
