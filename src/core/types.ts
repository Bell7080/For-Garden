/** 전투에 쓰이는 데이터 모델. 렌더러·Phaser를 전혀 모른다. */

export type Side = "player" | "enemy";

/** 역할. 전방에 세울지 후방에 둘지 판단하는 기준이 된다. */
export type Role = "attacker" | "tank" | "support";

export interface Stats {
  hp: number;
  atk: number;
  /** 받는 피해를 줄인다. 탱커가 높다. */
  def: number;
}

export interface Skill {
  id: string;
  name: string;
  /** 공격력 배율(%). 100이면 공격력 그대로. 회복·버프 스킬은 회복량/버프량으로 쓴다. */
  power: number;
  desc: string;
}

export interface Ultimate extends Skill {
  /** 필요한 궁극기 게이지. 행동할 때마다 게이지가 찬다. */
  cost: number;
}

/** 후방에서 전방을 돕는 스킬. 어떤 방식으로 돕는지에 따라 처리가 갈린다. */
export type SupportKind = "heal" | "buff" | "strike";

export interface SupportSkill extends Skill {
  kind: SupportKind;
}

/** 패시브는 종류별로 전투 엔진이 직접 해석한다. 새 패시브는 여기에 종류를 늘려 추가한다. */
export type PassiveKind =
  /** 전방에 있을 때 받는 피해 감소 */
  | "frontGuard"
  /** 스왑으로 막 전방에 나온 직후 첫 공격 강화 */
  | "swapMomentum"
  /** 후방에 있을 때 매 턴 전방 아군을 조금씩 회복 */
  | "rearMend";

export interface Passive {
  id: string;
  name: string;
  kind: PassiveKind;
  /** 종류에 따른 수치(피해 감소 %, 공격 증가 %, 회복량 등). */
  value: number;
  desc: string;
}

/** 렐릭 한 명의 정의. 멸종한 DNA에서 되살아난 호문쿨루스. */
export interface RelicDef {
  id: string;
  name: string;
  /** 어떤 유전자에서 되살아났는지. */
  origin: string;
  role: Role;
  stats: Stats;
  passive: Passive;
  basic: Skill;
  support: SupportSkill;
  ultimate: Ultimate;
}

export interface StageDef {
  /** "1-1" 형식. */
  id: string;
  name: string;
  /** 이 스테이지에 나오는 적 3명의 렐릭 id. */
  enemies: [string, string, string];
}
