/** 전투에 쓰이는 데이터 모델. 렌더러·Phaser를 전혀 모른다. */

export type Side = "player" | "enemy";

/** 속성. 다섯 속성은 서로 정확히 두 속성을 이기고 나머지 두 속성에 진다. */
export type Element = "fire" | "water" | "grass" | "earth" | "wind";

/** 전투 성능을 강제하지 않는 캐릭터 특화 태그다. 실제 행동은 능력치와 스킬이 결정한다. */
export type Role = "warrior" | "tank" | "assassin" | "support";

/** 프로토타입 렐릭 희귀도. 배열 순서에 기대지 말고 가챠 규칙의 명시적 우선순위를 사용한다. */
export type RelicRarity = "R" | "SR" | "SSR";

/** 정적 렐릭 데이터에서 선택할 수 있는 전신 원화 키. 새 Puppet 등록 시 함께 확장한다. */
export type PortraitAssetId = "torika" | "lexia" | "seira" | "torika-placeholder";

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
  /** 기본 공격 한 번으로 얻는 궁극기 충전량이다. 런타임 야성과는 별개다. */
  energyGain: number;
}

/** 플레이어마다 달라지는 렐릭 성장/Heart Gem 장착 정보다. */
export interface RelicProgress {
  /** 1부터 시작하는 현재 성장 레벨이다. */
  level: number;
  /** 저장 시점의 레벨 구간을 사람이 읽을 수 있게 표현한 칭호다. */
  levelTitle: string;
  /** DNA 복원 숙련도이며 코어 규칙상 0~5만 허용한다. */
  dnaMastery: number;
  /** 플레이어별 유대 레벨. 야성 증가를 완화하며 정적 렐릭 정의에는 두지 않는다. */
  bondLevel: number;
  /** 유대 레벨을 산출하는 누적 경험치다. 애착(favorite) 선택과는 무관하다. */
  bondXp: number;
  /** 해당 렐릭이 로비 일일 유대 보상을 마지막으로 받은 UTC 날짜키다. */
  lastLobbyInteractionDate: string;
  /** 정확히 세 자리인 Heart Gem 장착 슬롯이다. null은 빈 슬롯을 뜻한다. */
  heartGemSlots: [string | null, string | null, string | null];
}

/** 공격과 비공격 효과를 UI와 전투 규칙이 같은 어휘로 구분하는 분류다. */
export type EffectType =
  | "physical"
  | "magical"
  | "fixed"
  | "healing"
  | "buff";

/** 방어 능력치의 영향을 받는 두 공격 계열이다. */
export type DamageType = Extract<EffectType, "physical" | "magical">;

/** 현재 제공하는 공용 스킬 아이콘 키다. 미완성 아트는 캐릭터 복사본 대신 fallback을 쓴다. */
export type SkillIconAssetId =
  | "skill-icon-physical"
  | "skill-icon-magical"
  | "skill-icon-fixed"
  | "skill-icon-healing"
  | "skill-icon-buff"
  | "skill-icon-fallback";

export interface Skill {
  id: string;
  name: string;
  /** Phaser 텍스처 캐시에서 찾을 공용 아이콘 키다. */
  iconAssetId: SkillIconAssetId;
  /** UI가 피해·회복·강화 의미를 damageType 존재 여부와 무관하게 표현하는 분류다. */
  effectType: EffectType;
  /** 공격력 배율(%). 100이면 공격력 그대로. 회복·버프 스킬은 회복량/버프량으로 쓴다. */
  power: number;
  /** 물리는 atk/def, 마법은 ap/res를 참조한다. */
  damageType: DamageType;
  desc: string;
}

export interface Ultimate extends Skill {
  /** 사용 시 소비하는 궁극기 게이지. 저장 상한과 독립된 스킬별 값이다. */
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
  /** 패시브도 일반 스킬과 같은 정보창 표현 계약을 따른다. */
  iconAssetId: SkillIconAssetId;
  /** 회복과 능력 강화처럼 피해 타입이 없는 효과를 명시한다. */
  effectType: EffectType;
  kind: PassiveKind;
  /** 종류에 따른 수치(피해 감소 %, 공격 증가 %, 회복량 등). */
  value: number;
  desc: string;
}

/** 렐릭 한 명의 불변 정의. 플레이어별 성장 값은 RelicProgress에만 둔다. */
export interface RelicDef {
  id: string;
  name: string;
  /** 도감에서 쓰는 개체번호. 앞자리 0을 보존하기 위해 숫자가 아닌 문자열로 저장한다. */
  specimenNumber: string;
  /** 복원 프로젝트 내부에서 부르는 정적 코드네임이다. */
  projectName: string;
  /** 표본을 발견한 장소이며 생물학적 기원(origin)과 구분한다. */
  excavationSite: string;
  /** 미보유 상태에서도 공개할 수 있는 외형 중심의 짧은 도감 요약이다. */
  catalogSummary: string;
  /** 설정 확정 여부를 문자열 임시 문구가 아니라 판별 가능한 데이터로 표현한다. */
  unlockRecord:
    | { status: "recorded"; text: string }
    | { status: "sealed"; reason: "pending-lore" | "restricted" };
  /** 정적 희귀도는 배너 확률/풀 검증과 결과 UI가 공유하는 단일 기준이다. */
  rarity: RelicRarity;
  /** 상세·로비·배너에서 사용할 Puppet 전신 원화의 데이터 키. */
  portraitAssetId: PortraitAssetId;
  /** 어떤 유전자에서 되살아났는지. */
  origin: string;
  /** 공격자와 방어자의 상성 배율을 결정하는 고유 속성이다. */
  element: Element;
  /** 편성 이해를 돕는 특화 태그이며 별도의 고정 보정치는 주지 않는다. */
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
  /** 임시 밸런스용 적 레벨. 스테이지가 오를 때마다 정확히 1씩 증가한다. */
  enemyLevel: number;
  /** 최초/반복 클리어마다 지급할 잡초 수량이며 씬은 이 값을 재정의하지 않는다. */
  rewards: { firstClearWeeds: number; repeatClearWeeds: number };
}
