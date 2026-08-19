/** 전투에 쓰이는 데이터 모델. 렌더러·Phaser를 전혀 모른다. */

export type Side = "player" | "enemy";

/** 역할. 전방에 세울지 후방에 둘지 판단하는 기준이 된다. */
export type Role = "attacker" | "tank" | "support";

/** 정적 렐릭 데이터에서 선택할 수 있는 전신 원화 키. 새 Puppet 등록 시 함께 확장한다. */
export type PortraitAssetId = "torika" | "lexia" | "torika-placeholder";

export interface Stats {
  /** 생존력과 물리·마법 공격의 기반이 되는 주 능력치다. */
  hp: number;
  /** 물리 피해를 줄이는 방어력이다. */
  def: number;
  /** 마법 피해를 줄이는 저항력이다. */
  res: number;
  /** 물리 스킬의 공격력이다. */
  atk: number;
  /** 마법 스킬의 주문력이다. */
  ap: number;
  /** 향후 턴 간격 계산에 사용할 공격속도다. */
  attackSpeed: number;
  /** 향후 진형·행동 순서 계산에 사용할 이동속도다. */
  moveSpeed: number;
  /** 치명타가 발생할 확률(%)이다. */
  critChance: number;
  /** 치명타가 가하는 최종 피해 배율(%)이다. */
  critDamage: number;
  /** 기본 공격 한 번으로 얻는 궁극기 게이지다. */
  ferocity: number;
}

/** 스킬이 어느 공격 능력치와 방어 능력치를 참조하는지 구분한다. */
export type DamageType = "physical" | "magical";

export interface Skill {
  id: string;
  name: string;
  /** 공격력 배율(%). 100이면 공격력 그대로. 회복·버프 스킬은 회복량/버프량으로 쓴다. */
  power: number;
  /** 물리는 atk/def, 마법은 ap/res를 참조한다. */
  damageType: DamageType;
  desc: string;
}

export interface Ultimate extends Skill {
  /** 필요한 궁극기 게이지. 행동할 때마다 게이지가 찬다. */
  cost: number;
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
  /** 상세·로비·배너에서 사용할 Puppet 전신 원화의 데이터 키. */
  portraitAssetId: PortraitAssetId;
  /** 어떤 유전자에서 되살아났는지. */
  origin: string;
  role: Role;
  stats: Stats;
  passive: Passive;
  basic: Skill;
  ultimate: Ultimate;
}

export interface StageDef {
  /** "1-1" 형식. */
  id: string;
  name: string;
  /** 이 스테이지에 나오는 적 3명의 렐릭 id. */
  enemies: [string, string, string];
}
