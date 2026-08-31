/** 전투에 쓰이는 데이터 모델. 렌더러·Phaser를 전혀 모른다. */

export type Side = "player" | "enemy";

/** 속성. 다섯 속성은 서로 정확히 두 속성을 이기고 나머지 두 속성에 진다. */
export type Element = "fire" | "water" | "grass" | "earth" | "wind";

/** 전투 성능을 강제하지 않는 캐릭터 특화 태그다. 실제 행동은 능력치와 스킬이 결정한다. */
export type Role = "warrior" | "tank" | "assassin" | "support";

/** 프로토타입 렐릭 희귀도. 배열 순서에 기대지 말고 가챠 규칙의 명시적 우선순위를 사용한다. */
export type RelicRarity = "R" | "SR" | "SSR";

/** 전신 Puppet 레지스트리의 안정적인 데이터 키다. 파일 번호를 게임 데이터에 직접 노출하지 않는다. */
export type PortraitAssetId = "torika" | "lexia" | "seira" | "luka" | "dodi" | "mette" | "toby" | "amo" | "ripa" | "pontos" | "torika-placeholder";

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
  /** 실제로 입힌 흡혈 대상 피해에서 회복하는 비율(%). */
  lifeSteal: number;
  /** 사건별 야성 충전량에 곱하는 추가 비율(%). */
  ferocityGain: number;
}

/** 플레이어마다 달라지는 렐릭 성장/Heart Gem 장착 정보다. */
export interface RelicProgress {
  /** 1부터 시작하는 현재 성장 레벨이다. */
  level: number;
  /** 현재 레벨에서 다음 레벨까지 쌓은 경험치다. 레벨이 오르면 남은 만큼만 이월한다. */
  exp: number;
  /**
   * 한계 돌파 단계(0~4). 화면에 서는 **별**은 이 값 + 1이다(`relicStars`).
   *
   * 레벨이 "얼마나 먹였나"라면 별은 "같은 개체를 몇 번 더 만났나"다. 연구소 중복 획득으로 모은 그
   * 개체의 파편을 써서 올리며, 한 단계마다 레벨 상한과 해금 효과가 함께 열린다.
   */
  breakthrough: number;
  /** 플레이어별 유대 레벨. 야성 증가를 완화하며 정적 렐릭 정의에는 두지 않는다. */
  bondLevel: number;
  /** 유대 레벨을 산출하는 누적 경험치다. 애착(favorite) 선택과는 무관하다. */
  bondXp: number;
  /** 해당 렐릭이 로비 일일 유대 보상을 마지막으로 받은 UTC 날짜키다. */
  lastLobbyInteractionDate: string;
  /** 정확히 세 자리인 룬 장착 슬롯이다. 값은 정적 정의 ID가 아닌 RuneInstance.instanceId이며 null은 빈 슬롯이다. */
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

interface SkillBase {
  id: string;
  name: string;
  /** Phaser 텍스처 캐시에서 찾을 공용 아이콘 키다. */
  iconAssetId: SkillIconAssetId;
  /** UI가 피해·회복·강화 의미를 damageType 존재 여부와 무관하게 표현하는 분류다. */
  effectType: EffectType;
  /** 공격력 배율(%). 100이면 공격력 그대로. 회복·버프 스킬은 회복량/버프량으로 쓴다. */
  /** 명중 뒤 적용할 작은 공용 상태 효과 목록이다. 기절·경직이 없는 스킬은 생략한다. */
  statusEffects?: readonly CombatStatusEffect[];
  /** 실제 HP에서 감소한 피해의 이 비율(%)을 시전자가 회복한다. 과잉 피해는 계산하지 않으며 능력치·폭주 흡혈과 합산한다. */
  damageHealingPercent?: number;
  /** 기본 공격이 원형 광역일 때만 시전자 중심 대상 계약과 반경을 선언한다. */
  targeting?: "single" | "nearbyEnemies" | "battlefieldEnemies" | "battlefieldAllies" | "targetedCircle";
  radius?: number;
  desc: string;
}

/** 피해 스킬은 피해 종류와 계수를 함께 요구해 비공격 스킬과 안전하게 구별한다. */
export type AttackSkill = SkillBase & {
  damageType: DamageType;
  power: number;
  /** 마법 피해도 메테처럼 물리 공격력(atk)을 명시적으로 선택할 수 있다. */
  scalingStat?: "atk" | "ap" | "def";
};

/** 순수 회복 스킬은 damageType/power를 가질 수 없어 피해 계산에 잘못 전달되지 않는다. */
export type HealingSkill = SkillBase & {
  damageType?: never;
  power?: never;
  scalingStat?: never;
  healing: { kind: "teamMissingHpPercent"; percent: number };
};

/** 모든 스킬의 판별 유니온이며 `damageType in skill`로 공격 여부를 좁힌다. */
export type Skill = AttackSkill | HealingSkill;

/** 기본 공격만 가질 수 있는 추가 타격 계약이다. 일반 단타는 불필요한 확률 필드를 갖지 않는다. */
export type BasicAttack = AttackSkill & {
  /** 실제 감소시킨 적 HP의 이 비율만큼 최저 현재 HP 생존 아군을 회복한다. 자신도 후보이며 동률은 편성 순서다. */
  lowestHpAllyHealingFromDamagePercent?: number;
  /** 실제 기본 공격 행동 수를 세어 주기 끝 타격을 난수 소비 없이 확정 치명타로 만든다. */
  periodicCritical?: { every: number };
} & ({ combo?: undefined } | {
  combo: {
    /** 한 공격 행동에서 추가 적중이 발생할 확률(%)이다. */
    chancePercent: number;
    /** 성공했을 때 순서대로 적용할 총 적중 횟수다. */
    hitCount: number;
    /** 각 적중 직후 현재 잃은 체력을 기준으로 회복하는 비율(%)이다. */
    missingHpHealingPercentPerHit: number;
  };
});

/** 스킬과 야성 특성이 공유하는 최소 상태 효과 계약이다. 새 상태가 실제로 생길 때만 union을 늘린다. */
export type CombatStatusEffect =
  | { kind: "stun"; /** 저항 계산 전 기본 지속 시간(초). */ seconds: number }
  | { kind: "stagger"; /** 기절 저항을 무시하는 순간 행동 차단 시간(초). */ seconds: number }
  | {
      kind: "bleed";
      /** 출혈이 유지되는 시간(초). 매초 틱과 별개인 갱신 기준이다. */
      seconds: number;
      /** 매 틱 대상 최대 체력에서 차감하는 비율(%). 방어력을 무시하는 지속 피해다. */
      maxHpPercentPerSecond: number;
    };

/** 궁극기의 대상 선택은 ID나 설명문 대신 코어가 검증할 수 있는 정적 계약으로 선언한다. */
export type Ultimate = Skill & {
  /** 사용 시 소비하는 궁극기 게이지. 저장 상한과 독립된 스킬별 값이다. */
  cost: number;
  /** 정의한 경우 현재 HP가 이 비율 이하가 된 뒤에만 기본 공격으로 게이지를 얻는다. */
  chargeStartsAtHpPercent?: number;
  /** 공격력 피해와 더해지는 현재 공격 속도 배율(%). 없으면 공속 복합 계수를 사용하지 않는다. */
  attackSpeedPower?: number;
  /** 혼합 궁극기가 범위 안 생존 아군에게 적용할 주문력 회복 배율(%). */
  allyHealingPower?: number;
  /** 주 대상의 최종 HP 손실 일부를 주 대상에서 가장 가까운 다른 적에게 옮긴다. */
  damageTransfer?: {
    percent: number;
    /** 거리는 시전자가 아니라 주 대상의 전투 좌표에서 재며, 동률은 fighters 배열 순서다. */
    distanceOrigin: "primaryTarget";
  };
} & (
  | { /** 현재 선택한 한 적만 공격한다. */ targeting: "single" }
  | {
      /** 시전자 주위 반경 안의 모든 생존 적을 공격 시작 시점에 확정한다. */
      targeting: "nearbyEnemies";
      /** 거리 단위는 난전 좌표와 같은 px이며, 시전자 중심에서 잰다. */
      radius: number;
    }
  | { /** 거리에 상관없이 전장의 모든 생존 적을 공격한다. */ targeting: "battlefieldEnemies" }
  | { /** 거리에 상관없이 모든 생존 아군에게 비공격 효과를 적용한다. */ targeting: "battlefieldAllies" }
  | {
      /** 사용자가 전장 사각형의 경계를 포함해 지정한 위치를 중심으로 판정한다. 범위 밖 입력은 전장 경계로 보정한다. */
      targeting: "targetedCircle";
      /** 난전 좌표와 같은 px 단위의 원 반경이며 경계선 위 대상도 포함한다. */
      radius: number;
    }
);

/** 패시브는 종류별로 전투 엔진이 직접 해석한다. 새 패시브는 여기에 종류를 늘려 추가한다. */
export type PassiveKind =
  /** 전방에 있을 때 받는 피해 감소 */
  | "frontGuard"
  /** 스왑으로 막 전방에 나온 직후 첫 공격 강화 */
  | "swapMomentum"
  /** 후방에 있을 때 매 턴 전방 아군을 조금씩 회복 */
  | "rearMend"
  /** 체력이 절반 이하가 되면 전투당 한 번 지속 회복 */
  | "emergencyRecovery"
  /** 같은 상대를 연속으로 때리면 출혈을 남긴다 */
  | "bleedStreak"
  /** 렉시아 전용: 공격 속도·공격력·치명타 확률·치명타 피해를 함께 강화한다. */
  | "battleMaidMastery"
  /** 스피나 전용: 기본 공격의 실제 적중마다 공속을 전투 한정으로 영구 누적한다. */
  | "basicHitAttackSpeedStack"
  /** 폰토스의 시간 누적 주문력·잃은 체력 경감 규칙을 식별한다. */
  | "abyssalPressure"
  /** 도디 전용: 제공자 생존 여부로 팀 방어와 적 회복을 동시에 조절한다. */
  | "guardianNestAura"
  /** 메테 전용: 생존 중 팀 공속과 제어 정화·보호막을 제공한다. */
  | "adagioWeight"
  /** 루카 전용: 전투 시작/폭주 진입 때 최고 공격력 아군의 현재 표적을 복사한다. */
  | "followHighestAttackAllyTarget";

/** 전투 엔진이 판별하는 야성 특성 효과 ID다. 새 효과는 수치 계약과 함께 명시적으로 추가한다. */
export type FerocityEffectId =
  | "attackIntervalReduction"
  | "damageReduction"
  | "splashDamage"
  | "criticalChanceBonus"
  | "teamMoveSpeedBonus"
  /** 저장 호환용 이름은 도약이지만, 전투에서는 보간 이동 없이 같은 발동 프레임에 좌표를 즉시 변경한다. */
  | "stealthLeap"
  /** 폭주 중 자기 공격 속도를 곱하는 명시적 효과다. */
  | "selfAttackSpeedMultiplier"
  /** 폰토스 전용: 폭주 중 초당 최대 HP 고정 피해와 적 회복 취소를 함께 제공한다. */
  | "pontusRage"
  /** 메테 전용: 폭주 중 아군 일반 공격 적중마다 스타카토 추가타를 연주한다. */
  | "crescendoStaccato"
  /** 루카 전용: 은신과 무리 사냥 재지정, 동일 표적 팀 공속 오라를 함께 식별한다. */
  | "packHunt";

/**
 * 개체별 피버 발현 정적 데이터다.
 *
 * 효과별 파라미터를 판별 가능한 union으로 묶어 잘못된 수치 키를 콘텐츠 작성 시점에 막는다.
 */
export type FerocityTrait = {
  /** 뱃지에 찍히는 짧은 이름. 두세 글자를 넘기지 않는다. */
  name: string;
} & (
  | { effectId: "attackIntervalReduction"; reductionPercent: number }
  | { effectId: "damageReduction"; reductionPercent: number }
  | {
      effectId: "splashDamage";
      /** 기본 타격 피해 중 주변 대상에게 전달할 비율이다. */
      damagePercent: number;
      radius: number;
      /** 방어력 기반 물리 추가 피해 비율이며, 없으면 추가 피해를 계산하지 않는다. */
      defenseDamagePercent?: number;
      /** 폭주 중 기본 공격 속도 증가율이다. */
      attackSpeedBonusPercent?: number;
      /** 범위 명중에 함께 적용할 선택 상태 효과다. */
      statusEffect?: CombatStatusEffect;
    }
  | {
      effectId: "selfAttackSpeedMultiplier";
      /** 100은 속도 +100%, 즉 속도 x2이며 공격 간격을 결과적으로 50%로 만든다. */
      bonusPercent: number;
    }
  | {
      effectId: "criticalChanceBonus";
      /** 기존 치명타 확률에 곱하지 않고 그대로 더하는 퍼센트포인트 수치다. */
      chancePercent: number;
    }
  | {
      effectId: "rexBattleQueen";
      /** 기존 확률에 그대로 더하는 치명타 확률(퍼센트포인트)이다. 25는 20%를 45%로 만든다. */
      criticalChancePoints: number;
      /** 실제 HP 피해에 더해지는 모든 피해 흡혈(퍼센트포인트)이다. 기본 능력치·스킬 흡혈과 덧셈한다. */
      allDamageLifeStealPoints: number;
    }
  | { effectId: "teamMoveSpeedBonus"; bonusPercent: number }
  | {
      effectId: "stealthLeap";
      /** 단일 대상 선택에서 제외되는 시간이다. */
      durationSeconds: number;
      /** 순간이동 대상은 문구나 렐릭 ID 대신 결정 가능한 선택 규칙으로 고정한다(키 이름은 저장 호환용이다). */
      leapTarget: "lowestHpEnemy";
      /** 보간 이동 없이 같은 발동 프레임에 목표의 일반 공격 사거리 가장자리로 즉시 배치할 거리다. */
      landingDistance: number;
    }
  | {
      effectId: "crescendoStaccato";
      /** 아군의 실제 일반 공격 적중 뒤 메테 공격력으로 계산할 마법 추가타 계수다. */
      damagePercent: number;
      /** 스타카토가 적용하는 기존 경직 디버프의 지속 시간이다. */
      staggerSeconds: number;
    }
  | {
      effectId: "pontusRage";
      /** 매초 각 생존 적의 최대 체력에서 직접 차감할 비율이다. */
      maxHpDamagePercentPerSecond: number;
      /** true이면 폭주 중 반대편의 모든 회복 요청을 공용 회복 경계에서 취소한다. */
      cancelEnemyHealing: true;
    }
  | {
      effectId: "packHunt";
      /** 스피나와 동일하게 단일 대상 추적에서 제외되는 폭주 은신 시간이다. */
      stealthDurationSeconds: number;
      /** 폭주 진입 때 무리 사냥 표적 결정을 다시 수행한다. */
      retriggerPackHunt: true;
      /** 루카 자신을 포함해 같은 targetId를 가진 생존 아군에게 주는 공속 증가율이다. */
      sharedTargetAttackSpeedPercent: number;
    }
);

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
  /** 기본 공격 속도에 곱하는 증가율(%). 25% 증가는 공격 간격 25% 감소가 아니라 속도를 1.25배 한다. */
  attackSpeedPercent?: number;
  /** 피해 계산에 쓰는 공격력을 곱하는 증가율(%). 25% 증가는 현재 공격력의 1.25배다. */
  attackPowerPercent?: number;
  /** 기존 치명타 확률에 곱하는 증가율(%). 25퍼센트포인트 덧셈과 달리 20%에서 25% 증가하면 25%다. */
  criticalChancePercent?: number;
  /** 기존 치명타 피해 배율에 곱하는 증가율(%). 160%에서 25% 증가하면 200%다. */
  criticalDamagePercent?: number;
  /** 지속 효과인 패시브만 갖는 유지 시간(초). 전투와 표시가 함께 읽는 단일 계약이다. */
  durationSeconds?: number;
  /** 심해 압력 전용: 완전히 경과한 매초 기본 주문력에 복리로 누적하는 비율이다. */
  apPercentPerSecond?: number;
  /** 심해 압력 전용: 최대 체력일 때 적용하는 받는 피해 감소율이다. */
  baseDamageReductionPercent?: number;
  /** 심해 압력 전용: 저체력 구간에서 제한할 받는 피해 감소율 상한이다. */
  maxDamageReductionPercent?: number;
  /** 심해 압력 전용: 최대 피해 감소율에 도달하는 현재 체력 비율이다. */
  maxReductionAtHpPercent?: number;
  /** 심해 압력 전용: 모든 경감과 반올림을 마친 최종 HP 피해가 이 값 이하이면 피해를 무효화한다. */
  ignoreDamageAtOrBelow?: number;
  /** 제공자가 살아 있는 동안 같은 편의 방어력과 저항력에 곱하는 증가율(%). */
  teamDefenseResistancePercent?: number;
  /** 제공자가 살아 있는 동안 반대편이 받는 모든 체력 회복을 줄이는 비율(%). */
  enemyHealingReceivedReductionPercent?: number;
  /** 생존 제공자가 같은 편 전체에 곱해 주는 공격 속도 증가율이다. */
  teamAttackSpeedPercent?: number;
  /** 제어 정화 직후 제공자 atk에 곱해 부여하는 보호막 비율이다. */
  cleanseShieldAttackPercent?: number;
  /** 메테 개체가 독립적으로 소유하는 정화·보호막 재사용 대기시간이다. */
  cleanseCooldownSeconds?: number;
  desc: string;
}

/**
 * 방치 발굴 생산 재화의 실제 Wallet 저장 키다.
 * UI의 일반 화석은 `fossil`, UI의 다이아는 `gems`에 저장되며 표시 용어를 키로 쓰지 않는다.
 */
export type ExcavationProductionCurrency = "gold" | "cheesecake" | "fossil" | "gems";

/** 전투 능력치와 독립적으로 운영 밸런스를 조정하는 렐릭별 발굴 특화다. */
export interface ExcavationTrait {
  /** 이 렐릭이 생산하는 주력 재화다. 다이아(`gems`)는 별도의 낮은 생산/성장률을 적용한다. */
  primaryCurrency: ExcavationProductionCurrency;
  /** 성장 보정 전, 레벨 1·한계 돌파 0단계에서 한 시간 동안 생산하는 수량이다. */
  baseProductionPerHour: number;
  /** 같은 재화의 기본 생산량에 적용하는 렐릭 고유 효율 배율이다. */
  efficiencyMultiplier: number;
}

/** 렐릭 한 명의 불변 정의. 플레이어별 성장 값은 RelicProgress에만 둔다. */
export interface RelicDef {
  id: string;
  /** 기절 지속 시간을 줄이는 비율(%). 정의하지 않으면 저항이 없고 100 이상이면 면역이다. */
  stunResistancePercent?: number;
  name: string;
  /** 도감에서 쓰는 개체번호. 앞자리 0을 보존하기 위해 숫자가 아닌 문자열로 저장한다. */
  specimenNumber: string;
  /** 복원 프로젝트 내부에서 부르는 정적 코드네임이다. */
  projectName: string;
  /** 표본을 발견한 장소이며 생물학적 기원(origin)과 구분한다. */
  excavationSite: string;
  /** 저장 데이터가 아닌 정적 도감 정보로 쓰는 복원 표본의 생애·신체 기록이다. 없는 개체는 기존 항목만 표시한다. */
  observationProfile?: {
    originYear: string;
    /** 실제 복원 경과나 원종의 성장 단계가 아니라, 복원체의 인간형 신체 나잇대를 20년 미만으로 은유하는 E.C. 세계관 값이다. */
    restorationYear: string;
    /** 화석에 남은 공룡·고생물 원종의 생물학적 성장 단계다. 복원체의 인간 사회상 성인 여부와 무관하며 정신적 성숙 성향의 근거로만 쓴다. */
    lifeStage: string;
    height: string;
    weight: string;
  };
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
  /** 전투 수치나 장착 룬과 섞이지 않는 정적 방치 발굴 특화다. */
  excavationTrait: ExcavationTrait;
  stats: Stats;
  passive: Passive;
  /**
   * 이 개체만의 야성(피버) 발현 방식.
   *
   * 야성은 벌이 아니라 상이다 — 게이지가 차면 더 세게 몰아친다. 어떻게 몰아치는지가 개체마다
   * 다르므로 정적 정의로 두고, 정보창은 패시브 아이콘 위에 작은 뱃지로 이것만 알린다.
   */
  ferocityTrait: FerocityTrait;
  basic: BasicAttack;
  ultimate: Ultimate;
}

/** 지도 노드가 공유하는 식별자와 명시적 경로 조건이다. */
interface StageBase {
  /** "1-1" 형식. */
  id: string;
  name: string;
  /** 본편에서 이 스테이지가 속한 챕터 번호다. 이벤트 스테이지에는 없을 수 있다. */
  chapter?: number;
  /** 지도에 표시할 챕터 내부의 1부터 시작하는 진행 순서다. */
  chapterOrder?: number;
  /** 모두 완료해야 하는 선행 노드 ID다. 빈 배열이면 캠페인의 최초 진입점이다. */
  prerequisiteStageIds: readonly string[];
}

/** 전투 노드만 편성, 적 레벨, 전투 보상을 소유한다. */
export interface BattleStageDef extends StageBase {
  kind: "battle";
  enemies: [string, string, string];
  enemyLevel: number;
  rewards: { firstClearCheesecake: number; repeatClearCheesecake: number };
}

/** 스토리 노드는 DialogueStory를 가리키며 가짜 전투 데이터를 요구하지 않는다. */
export interface StoryStageDef extends StageBase {
  kind: "story";
  storyId: string;
}

/** kind로 안전하게 좁히는 지도 노드 판별 유니온이다. */
export type StageDef = BattleStageDef | StoryStageDef;

/** 지도 한 화면을 구성하고 챕터 선택 잠금을 판정하는 본편 챕터 메타데이터다. */
export interface ChapterDef {
  /** 저장과 UI 전환에서 사용하는 안정적인 챕터 번호다. */
  id: number;
  /** 지도 상단에 표시하는 세계관 내 구역명이다. */
  title: string;
  /** 구역의 위치를 짧게 설명하는 지도 부제다. */
  subtitle: string;
  /** 챕터 입장에 필요한 이전 챕터 마지막 스테이지다. 첫 챕터에는 없다. */
  prerequisiteStageId?: string;
  /** 이 챕터에 속한 스테이지를 진행 순서대로 보관한다. */
  stages: readonly StageDef[];
}
