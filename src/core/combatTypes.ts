import type { DamageType, RelicDef } from "./types";

/** 실시간 전투 규칙이 피해와 게이지 계산에 요구하는 최소 공용 상태다. */
export interface Combatant {
  def: RelicDef;
  hp: number;
  maxHp: number;
  energy: number;
  ferocity: number;
  bondLevel: number;
  ferocityFever: boolean;
  breakthrough: number;
  /** 전투 중 시간 기반 효과로 누적된 추가 주문력이다. */
  bonusAp?: number;
}

/** 피해 계산기가 난수나 스킬 데이터 저장소에 직접 의존하지 않도록 확정한 입력이다. */
export interface DamageInput {
  power: number;
  damageType: DamageType;
  /** 생략하면 피해 종류에 따라 공격력 또는 주문력을 사용한다. */
  scalingStat?: "atk" | "def";
  isCritical: boolean;
  kind?: "basic" | "ultimate";
}
