/** 전투에 쓰이는 데이터 모델. 렌더러·Phaser를 전혀 모른다. */

export type Side = "player" | "enemy";

/**
 * 소속 자치 스쿼드의 id.
 *
 * 이름·호칭·엠블럼 같은 내용은 `src/data/factions.ts`가 소유한다. 코어는 데이터 표를 알 필요가
 * 없으므로 판별 가능한 id만 둔다. 엠블럼 파일 이름도 이 id와 같다.
 */
/** 아군 자치 스쿼드와 적대 세력을 함께 식별하는 영구 소속 ID다. */
export type SquadId = "fang" | "gear" | "eye" | "rune" | "rogue" | "annihilation" | "abyssal-crown";

/** 속성. 다섯 속성은 서로 정확히 두 속성을 이기고 나머지 두 속성에 진다. */
export type Element = "fire" | "water" | "grass" | "earth" | "wind";

/** 전투 성능을 강제하지 않는 캐릭터 특화 태그다. 실제 행동은 능력치와 스킬이 결정한다. */
export type Role = "warrior" | "tank" | "assassin" | "support";

/**
 * 근접·중거리·원거리.
 *
 * 지금까지는 전원이 같은 거리에서 붙어 바이올린도 깃펜도 적 코앞까지 걸어갔다. 단계를 나누면
 * 원거리 개체가 저절로 뒷줄에 남아 편성이 말하는 앞뒤가 화면에서도 보인다. 다만 원거리는
 * **도망치지 않는다** — 카이팅을 넣는 순간 난전이 술래잡기가 된다.
 */
export type ReachTier = "melee" | "mid" | "ranged";

/** 프로토타입 렐릭 희귀도. 배열 순서에 기대지 말고 가챠 규칙의 명시적 우선순위를 사용한다. */
export type RelicRarity = "R" | "SR" | "SSR";

/** 전신 Puppet 레지스트리의 안정적인 데이터 키다. 파일 번호를 게임 데이터에 직접 노출하지 않는다. */
export type PortraitAssetId = "torika" | "lexia" | "seira" | "luka" | "dodi" | "mette" | "tia" | "stella" | "meron" | "pachi" | "maki" | "keris" | "delopi" | "ella" | "nodonia" | "deina" | "maddy" | "toby" | "amo" | "ripa" | "koma" | "pontos" | "parua";

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
  /** 매디 전용: 대상이 [[frozen|빙결]] 상태일 때만, 실제 HP에서 감소한 피해의 이 비율(%)을 시전자가 회복한다. */
  damageHealingPercentIfFrozen?: number;
  /** 이 스킬을 쓸 때마다 생존 아군 전체가 함께 얻는 궁극기 게이지다. 시전자 자신도 포함한다. */
  allyEnergyGain?: number;
  /**
   * 선언한 상태 효과를 **매 N번째 타격에만** 건다. 없으면 적중할 때마다 건다.
   *
   * 확정 치명타(`periodicCritical`)와 다른 축이다 — 그쪽은 피해를 키우고, 이쪽은 부가 효과의
   * 주기를 정한다. 파치의 배트가 네 번째에만 헬멧을 울리는 것이 이 값이다.
   */
  statusEffectEvery?: number;
  /** 기본 공격이 원형 광역일 때만 시전자 중심 대상 계약과 반경을 선언한다. */
  /**
   * `chargeLine`은 지금 보고 있는 방향으로 **뚫고 지나가며** 통로 안의 적을 모두 친다.
   * 나아가는 거리는 이동 속도에 비례하므로, 발이 빠른 개체일수록 더 멀리 밀고 들어간다.
   */
  targeting?: "single" | "nearbyEnemies" | "splitShot" | "battlefieldEnemies" | "battlefieldAllies" | "self" | "targetedCircle" | "chargeLine";
  /** 원형 범위의 반경이자, `chargeLine`에서는 지나간 통로의 **반폭**이다. */
  radius?: number;
  /** `splitShot`이 표적을 포함해 한 번에 맞히는 최대 인원이다. */
  maxTargets?: number;
  /**
   * 때린 적의 **저주가 이미 최대 중첩이면** 그 피해의 일부를 가장 가까운 다른 적에게 옮긴다.
   *
   * 옮겨 간 타격도 저주를 남기고, 그 적 역시 이미 최대였다면 다시 이어진다 — 전이 비율이
   * 곱해지며 줄어들어 피해는 금세 미미해지므로, 이어지는 몫은 피해가 아니라 **저주를 퍼뜨리는
   * 것**이다. 같은 적을 두 번 고르지 않아 사슬은 살아 있는 적 수에서 저절로 끝난다.
   */
  curseTransfer?: { percent: number };
  /**
   * 문장을 만들 수 없는 스킬만 쓰는 설명 원문이다.
   *
   * 공격 스킬과 정형 회복 스킬의 설명문은 `skillPresentation.ts`의 `skillDescription()`이
   * **구조화 필드에서 직접 짓는다** — 캐릭터마다 문장을 새로 적으면 같은 뜻이 화면마다 다른
   * 무게로 읽히고, 수치를 조정한 뒤 옛 문장이 그대로 남는다. 그래서 그런 스킬에는 적지 않는다.
   */
  desc?: string;
}

/** 피해 스킬은 피해 종류와 계수를 함께 요구해 비공격 스킬과 안전하게 구별한다. */
export type AttackSkill = SkillBase & {
  damageType: DamageType;
  power: number;
  /**
   * 위력을 어느 능력치에서 뽑을지. 생략하면 피해 종류가 정한다(물리=공격력, 마법=주문력).
   *
   * 마법 피해도 메테처럼 공격력을 명시적으로 고를 수 있고, 방어·체력에서 뽑는 개체도 있다 —
   * 노도니아처럼 **공격력을 아예 쓰지 않는** 개체는 자기 몸에서 피해를 낸다.
   */
  scalingStat?: "atk" | "ap" | "def" | "hp";
  /**
   * 한 타격의 위력을 **두 능력치가 나눠 갖는다.** 없으면 `scalingStat` 하나만 쓴다.
   *
   * 스피나 궁극기의 공속 복합 계수와 다른 축이다 — 그쪽은 공격 속도를 공격력 배율로 환산해
   * 더하지만, 이쪽은 서로 다른 두 능력치에서 각각 뽑아 더한다. 델로피의 카드가 손끝 힘(공격력)과
   * 발라 둔 독(주문력)을 함께 쓰는 것이 그 예다.
   */
  secondaryScaling?: { stat: "atk" | "ap" | "def" | "hp"; power: number };
  healing?: never;
  teamBuff?: never;
  selfSetup?: never;
  selfGuard?: never;
  selfBulwark?: never;
  selfVolley?: never;
};

/** 순수 회복 스킬은 damageType/power를 가질 수 없어 피해 계산에 잘못 전달되지 않는다. */
export type HealingSkill = SkillBase & {
  damageType?: never;
  power?: never;
  scalingStat?: never;
  teamBuff?: never;
  selfSetup?: never;
  selfGuard?: never;
  selfBulwark?: never;
  selfVolley?: never;
  healing: { kind: "teamMissingHpPercent"; percent: number };
};

/**
 * 때리지도 회복시키지도 않고 **다음 한 방의 자리를 만드는** 스킬이다.
 *
 * 피해를 스스로 갖지 않는 이유는 그 피해가 곧 이어질 일반 공격의 몫이기 때문이다 — 여기에
 * 따로 위력을 적으면 평타 위력을 조정한 뒤 이 숫자만 옛 값으로 남아 같은 한 방이 두 수로 갈린다.
 */
export type SetupSkill = SkillBase & {
  damageType?: never;
  power?: never;
  scalingStat?: never;
  healing?: never;
  teamBuff?: never;
} & (
  | { selfSetup: SelfSetup; selfGuard?: never; selfBulwark?: never; selfVolley?: never }
  | { selfSetup?: never; selfGuard: SelfGuard; selfBulwark?: never; selfVolley?: never }
  | { selfSetup?: never; selfGuard?: never; selfBulwark: SelfBulwark; selfVolley?: never }
  | { selfSetup?: never; selfGuard?: never; selfBulwark?: never; selfVolley: SelfVolley }
);

/**
 * 쏟아붓는 계약. 정해진 시간 동안 **일반 공격 자체를 바꾼다.**
 *
 * `SelfSetup`(다음 한 방의 자리)과 다른 축이다 — 그쪽은 한 방을 강화하고 이쪽은 그 시간의
 * 모든 손을 강화한다. 피해를 스스로 갖지 않는 이유는 같다: 그 피해가 곧 이어질 일반 공격의
 * 몫이라, 여기 위력을 적으면 평타를 조정한 뒤 이 숫자만 옛 값으로 남는다.
 *
 * **순환은 건드리지 않는다.** 연격의 두 타격은 같은 걸음을 쓰므로(`cycle`은 공격 **행동**마다
 * 한 걸음 나아간다) 갈래화살 차례가 오면 두 발이 함께 갈라진다 — 그것이 이 궁극기의 절정이고,
 * 갈래화살을 상시로 켜는 것은 폭주의 몫이라 여기서 다시 켜지 않는다.
 */
export type SelfVolley = {
  /** 쏟아붓는 시간(초). */
  seconds: number;
  /** 이 동안 한 번의 공격 행동이 내는 적중 횟수. 확률이 아니라 확정이다. */
  hitCount: number;
  /** 이 동안 더해지는 공격 속도 비율(%). 폭주가 사거리를 갖는 대신 속도는 이쪽이 갖는다. */
  attackSpeedPercent: number;
};

/**
 * 앞에 서는 계약. 아군이 받을 피해를 **대신 받고**, 그 아픈 시간을 회복으로 바꾼다.
 *
 * `SelfGuard`(엘라의 「인」)와 다른 축이다 — 그쪽은 적을 끌어당겨 **자신에게 오게** 만들고
 * 자기가 덜 맞은 몫을 보호막으로 돌려받는다. 이쪽은 적을 건드리지 않고 **아군에게 갈 피해를
 * 가로채** 대신 맞는다. 무적을 쓰지 않는 이유는 그래야 회복의 분모가 실재하고, 아군의 피해가
 * 그냥 사라지는 일도 생기지 않기 때문이다.
 */
export type SelfBulwark = {
  /** 앞에 서 있는 시간(초). */
  seconds: number;
  /** 이 동안 아군이 받는 피해 중 대신 받는 비율(%). */
  redirectPercent: number;
  /**
   * 앞에 서 있는 **동안** 매초 회복하는 최대 체력 비율(%).
   *
   * 끝난 뒤에 몰아서 돌려주지 않는 이유는, 대신 받는 그 시간을 버텨 내는 것이 이 궁극기이기
   * 때문이다 — 끝나고 받으면 그 사이에 쓰러진다. 방어·저항을 올리지도 않는다: 종이 방어로
   * 다 맞으면서 그보다 빨리 차오르는 것이 이 개체의 값이다.
   */
  maxHpRegenPercentPerSecond: number;
};

/**
 * 버티는 계약. 끌어당겨 붙잡아 두고, 그동안 덜 맞은 만큼을 나중에 보호막으로 돌려받는다.
 *
 * `SelfSetup`(숨었다가 한 방)과 반대 축이다 — 그쪽은 다음 한 방의 자리를 만들고, 이쪽은
 * **맞는 시간 자체를 자산으로 바꾼다.** 그래서 보상이 시전 순간이 아니라 버티기가 끝난 뒤에 온다.
 */
export type SelfGuard = {
  /** 끌어당긴 적이 자신만 표적으로 삼는 시간(초). */
  tauntSeconds: number;
  /** 시전 순간 주위 적을 끌어당긴다. `distance`는 끌어당긴 뒤 시전자와의 거리다. */
  pull: { radius: number; distance: number };
  /**
   * 시전 **순간** 얻는 보호막(최대 체력 비율 %).
   *
   * 끝난 뒤에 돌려받지 않는다 — 끌어당겨 도발해 놓고 막을 5초 뒤에 받으면 순서가 거꾸로다.
   * 불러 놓고 그 자리에서 덮는 것이 이 궁극기이고, 그래서 도발과 보호막이 한 조작에 든다.
   */
  shieldMaxHpPercent: number;
  /** 시전 순간, 보호막·끌어당김·도발 처리가 끝난 뒤 시전자 조가비의 내부 쿨다운만 0으로 되돌린다. */
  resetShellGuardCooldown?: true;
};

/** 자리를 잡는 계약. 은신·순간이동·다음 타격 강화를 코어가 판별할 수 있는 값으로만 적는다. */
export type SelfSetup = {
  /** 단일 대상 선택에서 제외되는 시간(초). */
  stealthSeconds: number;
  /**
   * 기본 공격을 한 번 내는 순간 은신이 풀리는가.
   *
   * **패시브의 은신과 다른 축이다** — 전투 시작 은신은 시간이 다할 때까지 유지되지만, 이쪽은
   * 숨어 들어가 한 방을 꽂는 자리라 그 한 방이 곧 노출이다. 시간만으로 끊으면 혼자 남은 판에서
   * 아무도 자신을 고르지 못하는 채로 계속 때리게 되어, 짧은 무적과 다르지 않게 된다.
   */
  stealthBreaksOnBasic: true;
  /** 순간이동 대상은 문구가 아니라 결정 가능한 선택 규칙으로 고정한다. */
  leapTarget: "lowestHpEnemy";
  /** 보간 이동 없이 같은 프레임에 목표의 사거리 가장자리로 배치할 거리다. */
  landingDistance: number;
  /**
   * 이후 **첫 일반 공격 한 번**을 강화한다. 위력은 그 일반 공격의 값을 그대로 쓴다.
   *
   * 은신 중에 걸어 두고 나와서 터뜨리는 구조라, 강화가 남아 있는 동안은 은신이 풀려도 유지된다 —
   * 은신이 끝나는 순간 사라지면 손이 닿기 전에 강화가 먼저 꺼진다.
   */
  empowerNextBasic: {
    /** 판정을 굴리지 않고 확정 치명타로 만든다. */
    guaranteedCritical: true;
    /** 방어력·저항을 지나치는 고정 피해가 된다. */
    ignoresDefense: true;
  };
};

/**
 * 피해도 회복도 없이 아군 전체에 지속 강화만 거는 스킬이다.
 *
 * 회복 스킬과 갈라 두는 이유는 두 효과가 같은 슬롯에 들어가면 "회복량"이라는 이름의 값이
 * 공격 속도 비율을 뜻하게 되어 화면과 전투가 서로 다른 단위를 읽기 때문이다.
 */
export type SupportSkill = SkillBase & {
  damageType?: never;
  power?: never;
  scalingStat?: never;
  healing?: never;
  selfSetup?: never;
  selfGuard?: never;
  selfBulwark?: never;
  selfVolley?: never;
  teamBuff: TeamBuff;
};

/** 지속 시간을 가진 아군 전체 강화 계약이다. 새 강화가 생기면 `kind`를 늘린다. */
export type TeamBuff = {
  kind: "tailwind";
  /** 공격 속도에 곱하는 비율(%)이다. */
  attackSpeedPercent: number;
  /** 이동 속도에 곱하는 비율(%)이다. */
  moveSpeedPercent: number;
  /** 유지 시간(초). 겹쳐 걸면 남은 시간이 더 긴 쪽으로 갱신된다. */
  seconds: number;
  /**
   * 순풍이 도는 동안 매초 회복시킬 최대 체력 비율(%)이다.
   *
   * **순풍 자체의 효과가 아니라 이 순풍을 건 스킬이 얹는 값이다.** 키워드에 넣으면 누가 걸어
   * 준 순풍이든 회복이 따라와 지원가 한 명이 팀 회복까지 겸하게 된다. 여기 두면 스테라가
   * 건 순풍만 회복을 데려온다.
   */
  maxHpRegenPercentPerSecond?: number;
};

/** 모든 스킬의 판별 유니온이며 `damageType in skill`로 공격 여부를 좁힌다. */
export type Skill = AttackSkill | HealingSkill | SupportSkill | SetupSkill;

/**
 * 순환 기본 공격의 한 걸음.
 *
 * 엘라의 발경처럼 **타마다 다른 권을 내는** 개체가 쓴다. 걸음마다 위력·대상·부가 효과가 통째로
 * 달라지므로 `statusEffectEvery`(같은 공격에 주기로 효과만 얹는 것)와는 다른 축이다.
 * 선언하지 않은 필드는 **비어 있는 것으로 본다** — 기본 공격 쪽 값이 새어 들어오면 어느 걸음이
 * 무엇을 하는지 데이터만 보고 알 수 없다.
 */
export type BasicAttackStep = {
  /** 이 걸음의 이름. 설명문이 걸음을 차례로 늘어놓을 때 쓴다. */
  name: string;
  power: number;
  /**
   * 걸음마다 혼자만 광역일 수 있다. 생략하면 단일 대상이다.
   *
   * `splitShot`은 **표적을 중심으로** 가까운 순서대로 `maxTargets`명까지 함께 맞힌다.
   * `nearbyEnemies`(시전자 중심 반경)와 다른 축인 이유는 원거리 개체 때문이다 — 600 뒤에
   * 선 개체가 자기 중심 반경을 쓰면 발밑의 빈 땅을 때린다.
   */
  targeting?: "single" | "nearbyEnemies" | "splitShot";
  radius?: number;
  /** `splitShot`이 한 번에 맞히는 최대 인원(표적 포함)이다. */
  maxTargets?: number;
  statusEffects?: readonly CombatStatusEffect[];
  /** 실제 HP 손실의 이 비율(%)만큼 시전자가 회복한다. */
  damageHealingPercent?: number;
  /** 실제 HP 손실의 이 비율(%)만큼 시전자가 보호막을 얻는다. */
  shieldFromDamagePercent?: number;
  /**
   * 이 걸음에 맞은 적을 날려버린다. 파치의 폭주와 같은 궤적 규칙(`KNOCKBACK`)을 쓴다.
   *
   * 기절과 다른 축이다 — 기절은 제자리에서 멈추는 것이고 이쪽은 **실제로 좌표가 움직인다.**
   * 3연 순환의 마지막 걸음처럼 "여기서 끊는다"를 화면에 보여 줘야 하는 자리에 쓴다.
   */
  /** 맞은 적을 시전자에게서 이 거리까지 끌어당긴다. 날려버림과 달리 붙잡아 두는 쪽이다. */
  pull?: { distance: number };
};

/** 기본 공격만 가질 수 있는 추가 타격 계약이다. 일반 단타는 불필요한 확률 필드를 갖지 않는다. */
export type BasicAttack = AttackSkill & {
  /**
   * 타마다 다른 걸음을 순서대로 반복한다. 없으면 늘 같은 한 방이다.
   *
   * 한 **공격 행동**마다 한 걸음씩 나아가며, 연격의 개별 적중으로는 나아가지 않는다 — 그러면
   * 한 번 휘두른 것이 두 걸음을 삼킨다.
   */
  cycle?: readonly BasicAttackStep[];
  /** 실제 감소시킨 적 HP의 이 비율만큼 최저 현재 HP 생존 아군을 회복한다. 자신도 후보이며 동률은 편성 순서다. */
  lowestHpAllyHealingFromDamagePercent?: number;
  /** 실제 기본 공격 행동 수를 세어 주기 끝 타격을 난수 소비 없이 확정 치명타로 만든다. */
  periodicCritical?: { every: number };
  /**
   * `statusEffectEvery`가 터지는 **그 한 방에만** 더해지는 추가 계수다.
   *
   * `secondaryScaling`과 다른 축이다 — 그쪽은 매 타격의 위력을 두 능력치가 나눠 갖지만,
   * 이쪽은 주기가 채워진 타격 하나에만 얹힌다. 토리카의 「세 개의 뿔」이 셋째 뿔에서
   * 기절과 함께 방어력을 실어 보내는 것이 이 값이다 — 쌓는 값이 제어 하나로만 끝나면
   * 방어력을 키운 몫이 기본 공격에는 전혀 돌아오지 않는다.
   */
  periodicBonusScaling?: { stat: "atk" | "ap" | "def" | "hp"; power: number };
  /**
   * 주기 타수 칩에 세울 이름. 없으면 스킬 이름을 그대로 쓴다.
   *
   * 쌓이는 것이 이야기 안에서 제 이름을 가진 경우에만 적는다 — 토리카의 「세 개의 뿔」이
   * 그렇다. 파치처럼 그냥 몇 대째인지만 세는 개체는 스킬 이름이 곧 그 값이라 비워 둔다.
   */
  statusEffectStackName?: string;
  /**
   * 「여울」. 기본 공격을 낼 때마다 **자기 발밑에** 얕은 물이 고인다.
   *
   * 물가의 포식자는 사냥터를 고르는 것이 아니라 **만든다** — 붙어서 물어뜯기 시작한 자리가
   * 곧 물가가 되고, 거기 잠긴 사냥감은 느려져 빠져나가지 못한다.
   *
   * 판은 **한 곳만** 유지한다. 걸음마다 새 판을 남기면 전장이 곧 물바다가 되어 어디가 지금
   * 위험한 자리인지 읽히지 않고, 그리는 값도 그만큼 늘어난다. 새로 낼 때마다 자리와 시간이
   * 갱신되므로 붙어 싸우는 동안은 발밑에 머물고, 표적을 갈아타 달려가면 **뒤에 남는다** —
   * 그 자리에 선 적은 계속 잠겨 있고 스피나만 빠져나온다.
   */
  shallows?: {
    /** 판의 반경(px). 판정과 화면이 같은 값을 쓴다. */
    radius: number;
    /** 마지막으로 낸 뒤 물이 마르기까지의 시간(초). */
    seconds: number;
    /**
     * 판에 잠긴 적의 **이동 속도**만 깎는 비율(%). 공격 속도는 건드리지 않는다.
     *
     * 상태(`chill`)를 쓰지 않는 이유는 둔화가 시간이 흘러도 사라지지 않기 때문이다 — 판을
     * 한 번 밟고 지나간 적이 전투가 끝날 때까지 느려지면, 이 판은 "여기 서 있으면 굼뜨다"가
     * 아니라 스쳐 지나가기만 해도 걸리는 영구 디버프가 된다. **잠긴 동안에만** 걸리고 물
     * 밖으로 나오면 그 프레임에 풀린다.
     *
     * 공격 속도를 함께 깎지 않는 이유도 같다 — 그러면 근접 개체가 붙어 싸우는 내내 적 전체의
     * 화력이 줄어, 암살자 한 명이 조용히 팀 방어를 겸하게 된다. 이 판이 말하는 것은
     * **"빠져나가지 못한다"**이지 "덜 아프다"가 아니다.
     */
    moveSlowPercent: number;
    /**
     * 판에 잠긴 적을 때리면 연격 확률 판정을 건너뛰고 **확정으로** 발동한다.
     *
     * 주기 확정 치명타와 같은 규칙이라 난수를 소비하지 않는다 — 굴리고 버리면 같은 판의
     * 다른 판정까지 자리가 밀린다.
     */
    guaranteesCombo: true;
  };
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
  | {
      /**
       * 손질. 겹이 상한에 닿는 순간 **그 자리에서 터지고 겹이 비워진다.**
       *
       * 덧칠처럼 쌓아 두고 나중에 쓰는 값이 아니라, 세 번째 칼질이 곧 결과다 — 그래서 상한에
       * 닿은 프레임에 스스로 터진다. 터지는 피해는 그 순간 칼을 댄 개체의 공격력에서 나온다.
       */
      kind: "butcher";
      /** 이 겹에 닿으면 터진다. 터진 뒤 겹은 0으로 돌아간다. */
      maxStacks: number;
      /** 터질 때 시전자 공격력에서 뽑는 물리 피해 비율(%). */
      burstPower: number;
    }
  | {
      /**
       * 뇌진탕. 방어력을 무시하는 **즉발 고정 피해** 한 번이며 지속 상태를 남기지 않는다.
       *
       * 출혈처럼 시간을 두고 깎지 않는 이유는, 파치의 뇌진탕이 "네 번째 배트가 헬멧을 울린
       * 순간"이기 때문이다 — 그 순간에 다 들어가야 4타 주기가 손에 잡힌다.
       */
      kind: "concussion";
      /** 대상 최대 체력에서 깎는 비율(%). */
      maxHpPercent: number;
      /** 그 타격이 치명타였을 때 대신 쓰는 비율(%). */
      criticalMaxHpPercent: number;
    }
  | { kind: "stagger"; /** 기절 저항을 무시하는 순간 행동 차단 시간(초). */ seconds: number }
  | {
      kind: "bleed";
      /** 출혈이 유지되는 시간(초). 매초 틱과 별개인 갱신 기준이다. */
      seconds: number;
      /** 매 틱 대상 최대 체력에서 차감하는 비율(%). 방어력을 무시하는 지속 피해다. */
      maxHpPercentPerSecond: number;
    }
  | {
      /**
       * 중독. 출혈과 같은 지속 피해 축이지만 **재는 자가 다르다.**
       *
       * 출혈은 맞은 쪽의 최대 체력에서 깎고, 중독은 **건 쪽의 공격력·주문력**에서 뽑는다.
       * 그래서 같은 독이라도 누가 발랐는지에 따라 세기가 갈리고, 독을 바른 개체가 성장하면
       * 그만큼 더 아프다. 매초 다시 재지 않고 **바르는 순간의 능력치로 굳힌다** — 매 틱
       * 시전자를 되짚으면 그 사이에 걸린 버프까지 소급되어, 화면이 보여 준 수치와 갈린다.
       */
      kind: "poison";
      /** 중독이 유지되는 시간(초). 다시 바르면 남은 시간이 더 긴 쪽으로 갱신된다. */
      seconds: number;
      /** 매 틱 시전자 공격력에서 뽑는 비율(%). */
      attackPercentPerSecond: number;
      /** 매 틱 시전자 주문력에서 함께 뽑는 비율(%). 둘을 더한 값이 한 틱의 마법 피해다. */
      abilityPercentPerSecond: number;
    }
  | {
      /**
       * 덧칠. 스스로는 피해를 주지 않고 **그 적이 받는 모든 피해**를 중첩만큼 키운다.
       *
       * 출혈·중독 같은 지속 피해와 다른 축이라 같은 자리에 두지 않는다 — 지속 피해는 건 사람의
       * 피해지만 덧칠은 **파티 전체의 피해**를 키운다.
       */
      kind: "overpaint";
      /** 마지막으로 덧칠한 뒤 유지되는 시간(초). 다시 칠하면 처음부터 다시 센다. */
      seconds: number;
      /** 중첩 하나가 올리는 받는 피해 비율(%). */
      damageTakenPercent: number;
      /** 쌓을 수 있는 최대 중첩. */
      maxStacks: number;
    }
  | {
      /**
       * 저주. 스스로는 피해를 주지 않고 그 적의 **저항을 깎는다.**
       *
       * 덧칠과 다른 축이다 — 덧칠은 받는 피해에 곱하는 배수라 물리·마법을 가리지 않지만,
       * 저주는 저항 수치 자체를 깎아 **마법 피해에만** 듣는다. 그래서 마법 편성에서만 값이
       * 서고, 물리 편성에서는 아무 일도 하지 않는다.
       */
      kind: "curse";
      /** 마지막으로 건 뒤 유지되는 시간(초). 다시 걸면 처음부터 다시 센다. */
      seconds: number;
      /** 중첩 하나가 깎는 저항 비율(%). 고정값이 아니라 비율인 이유는 레벨이 올라도 같은 몫이 들게 하기 위해서다. */
      resistancePercent: number;
      /** 쌓을 수 있는 최대 중첩. */
      maxStacks: number;
    }
  | {
      /**
       * 둔화. 중첩마다 공격 속도·이동 속도를 같은 비율만큼 깎는다.
       *
       * 광란처럼 곱해서 적용하지만 방향이 반대다. 최대 중첩에 닿아도 스스로 터지지 않는다 —
       * 그다음은 손질·밴덜리즘처럼 "쌓이면 자동으로" 터지는 게 아니라, **빙결시키는 패시브를
       * 가진 개체가 직접 때렸을 때만** 소모되어 빙결로 바뀐다(매디 「설원의 지배자」). 빙결
       * 중에는 새로 걸리지 않는다.
       */
      kind: "chill";
      /** 중첩 하나가 깎는 공격 속도·이동 속도 비율(%). */
      speedPercentPerStack: number;
      /** 쌓을 수 있는 최대 중첩. */
      maxStacks: number;
    }
  | {
      /**
       * 도발. 맞은 쪽이 **때린 쪽만** 표적으로 삼는다.
       *
       * 기절과 다른 축이다 — 행동을 막지 않고 방향만 돌린다. 그래서 정화의 대상이 아니고,
       * 짧게 걸면 "잠깐 이쪽을 보게 만들고 빠진다"가 된다. 엘라의 「인」은 궁극기 계약
       * (`SelfGuard.tauntSeconds`)으로 끌어당겨 걸지만, 이쪽은 **기본 공격 하나가** 건다.
       */
      kind: "taunt";
      /** 그 상대가 시전자만 노리는 시간(초). */
      seconds: number;
    }
  | {
      /**
       * 밴덜리즘. 묻은 겹만큼 그 적의 **공격력과 주문력이 함께 깎이고**, 겹이 상한에 닿는
       * 순간 낙서가 통째로 터지며 겹이 0으로 돌아간다.
       *
       * **시간이 흘러 사라지지 않는다 — 손질과 같은 축이고 저주·덧칠과는 다르다.** 지우는
       * 것은 시간이 아니라 터지는 것뿐이다. 시간을 두면 이 개체에서만 규칙이 성립하지
       * 않는다: 표적을 매 타격마다 갈아타므로 한 바퀴를 돌고 돌아왔을 때 이미 말라, 몇 겹을
       * 칠하든 영영 1~2겹에 머문다(실제로 유지 시간 8초로 두고 재현했을 때 표준 전투에서
       * 최대 4겹이었고 평타만으로는 한 번도 터지지 않았다). 칠하는 것이 이 개체의 값이므로
       * 칠한 것은 남는다.
       *
       * 깎는 값이 비율인 것은 저주와 같다(레벨이 올라도 같은 몫이 든다). 깎는 대상이 방어가
       * 아니라 **공격**이라 물리·마법 편성을 가리지 않고 파티 전체의 맞는 몫을 함께 줄인다.
       *
       * 터지는 피해는 깎인 쪽이 아니라 **칠한 쪽의 주문력**에서 뽑는다(마키의 손질과 같은
       * 축이다). 대상의 깎인 수치로 재면 공격력이 낮은 보스에게 20~30밖에 들어가지 않아
       * 사실상 표시용 숫자가 된다.
       */
      kind: "vandalism";
      /** 중첩 하나가 깎는 공격력·주문력 비율(%). */
      offenseShredPercent: number;
      /** 쌓을 수 있는 최대 중첩. 이 겹에 닿으면 터지고 0으로 돌아간다. */
      maxStacks: number;
      /** 터질 때 시전자 주문력에서 뽑는 마법 피해 비율(%). */
      burstPower: number;
    }
  | {
      /**
       * 광란. 표적을 **자기 편으로 뒤집는다.**
       *
       * 군중제어와 다른 축이다 — 행동을 막는 것이 아니라 방향을 돌린다. 때릴 자기 편이 남지
       * 않으면 제자리에서 자신을 공격하므로, 적이 혼자인 보스전에서도 무효가 되지 않는다.
       * 광란 중에는 기본 공격만 나간다 — 궁극기까지 아군에게 꽂히면 한 판이 그 한 번으로 갈린다.
       */
      kind: "frenzy";
      /** 유지 시간(초). 이미 광란 중이면 연장하지 않고 갱신만 한다. */
      seconds: number;
      /** 광란 중 오르는 공격 속도 비율(%). */
      attackSpeedPercent: number;
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
  /** 이 궁극기로 대상을 처치하면 되돌려받는 궁극기 게이지다. 빗나가거나 살아남으면 없다. */
  energyRefundOnKill?: number;
  /**
   * 대상에 쌓인 덧칠을 터뜨리는 궁극기인가.
   *
   * 이 값이 켜지면 `power`는 총 위력이 아니라 **덧칠 한 겹당 위력**이고, 실제 피해는
   * `power × 그 대상의 겹 수`다. 대상마다 겹이 다르므로 각 대상의 겹으로 따로 계산하며,
   * 한 겹도 없는 적은 터뜨릴 그림이 없어 아예 대상에서 빠진다. 터뜨린 뒤 덧칠은 지워진다 —
   * 쌓아 두고 매번 터뜨릴 수 있으면 "완성작"이 아니라 상시 배율이 된다.
   */
  overpaintDetonation?: true;
  /**
   * 저주에 걸린 적만 친다.
   *
   * 걸린 적이 하나도 없으면 가장 가까운 적에게 `seedCurse`를 먼저 씌우고 발동한다 — 그렇지
   * 않으면 게이지가 가득 찬 자동 궁극기가 대상 없이 헛돌고, 플레이어는 왜 안 나가는지 알 수 없다.
   */
  cursedTargetsOnly?: { seedCurse: Extract<CombatStatusEffect, { kind: "curse" }> };
  /**
   * 한 번에 다 터뜨리지 않고 **정해진 시간 동안 매초 되풀이하는** 궁극기인가.
   *
   * 이 값이 있으면 `power`는 총 위력이 아니라 **한 틱의 위력**이고, 시전 순간이 곧 첫 틱이다
   * (5초짜리는 0·1·2·3·4초에 다섯 번 터진다). 총 위력을 적지 않는 이유는 도중에 적이 쓰러지면
   * 남은 틱이 사라지기 때문이다 — 한 숫자로 적으면 화면이 약속한 피해와 실제가 갈린다.
   *
   * 시전자가 쓰러지거나 전투가 끝나면 남은 틱은 사라진다. 폭주와 달리 **시전 중에도 평소처럼
   * 움직이고 때린다** — 채널링은 자리를 묶는 것이 아니라 전장에 낙서가 계속 떨어지는 시간이다.
   */
  channel?: {
    /** 첫 틱을 포함한 전체 시간(초). */
    seconds: number;
    /**
     * 이 동안 시전자의 **일반 공격**이 추가로 거는 상태다.
     *
     * 틱이 거는 상태(`statusEffects`)와 다른 축이다 — 그쪽은 전장 전체가 한꺼번에 받고,
     * 이쪽은 그 시간 안에 실제로 손이 닿은 적만 받는다. 궁극기가 도는 동안 평타가 달라지는
     * 것을 데이터로 두어, 씬이 개체 이름으로 분기하지 않는다.
     */
    basicStatusEffects?: readonly CombatStatusEffect[];
  };
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
  | {
      /**
       * 화살이 갈라져 **표적과 그 주위**를 함께 맞힌다.
       *
       * `nearbyEnemies`가 시전자 중심인 것과 달리 **표적 중심**이다 — 원거리 개체가 시전자
       * 중심 반경을 쓰면 자기 발밑의 빈 땅을 때린다. 반경이 아니라 **인원**으로 끊는 이유는
       * 갈라지는 화살 수가 곧 이 기술이라, 적이 몰려 있느냐에 따라 달라지면 안 되기 때문이다.
       */
      targeting: "splitShot";
      /** 표적을 포함해 한 번에 맞히는 최대 인원이다. 표적에서 가까운 순으로 채운다. */
      maxTargets: number;
      radius?: never;
    }
  | { /** 거리에 상관없이 전장의 모든 생존 적을 공격한다. */ targeting: "battlefieldEnemies" }
  | { /** 거리에 상관없이 모든 생존 아군에게 비공격 효과를 적용한다. */ targeting: "battlefieldAllies" }
  | { /** 아무도 때리지 않고 시전자 자신에게만 적용한다. 피해는 이어질 일반 공격의 몫이다. */ targeting: "self" }
  | {
      /** 사용자가 전장 사각형의 경계를 포함해 지정한 위치를 중심으로 판정한다. 범위 밖 입력은 전장 경계로 보정한다. */
      targeting: "targetedCircle";
      /** 난전 좌표와 같은 px 단위의 원 반경이며 경계선 위 대상도 포함한다. */
      radius: number;
    }
  | {
      /**
       * 지금 보고 있는 방향으로 **뚫고 지나가며** 통로 안의 적을 모두 친다.
       *
       * 나아가는 거리는 스킬이 아니라 **이동 속도**가 정한다(`SKIRMISH.chargeSeconds` × 이동 속도).
       * 그래야 "발이 빠른 개체가 더 멀리 파고든다"가 능력치 하나로 설명된다.
       */
      targeting: "chargeLine";
      /** 지나간 통로의 반폭(px)이다. 이 안에 든 적만 맞는다. */
      radius: number;
    }
);

/** 패시브는 종류별로 전투 엔진이 직접 해석한다. 새 패시브는 여기에 종류를 늘려 추가한다. */
export type PassiveKind =
  /** 체력이 절반 이하가 되면 전투당 한 번 지속 회복 */
  | "emergencyRecovery"
  /** 같은 상대를 연속으로 때리면 출혈을 남긴다 */
  | "bleedStreak"
  /** 메론 전용: 아군이 덧칠된 적을 때리면 그 피해의 일부만큼 **때린 본인**이 회복한다 */
  | "overpaintSiphon"
  /** 파치 전용: 한 방에 들어오는 피해에 상한을 둔다 */
  | "impactCap"
  /** 마키 전용: 체력이 가장 낮은 적으로 주기적으로 도약해 표적을 갈아탄다 */
  | "gourmetHunt"
  /** 티아 전용: 타격한 적에게 표식을 남기고, 표식이 없는 적을 때리면 표식을 옮기며 추가 마법 피해를 준다. */
  | "shimmerMark"
  /** 체력이 절반 이하가 되면 전투당 한 번 은신해 표적에서 벗어난다 */
  | "lowHpVanish"
  /** 델로피 전용: 전투가 시작되는 순간부터 정해진 시간 동안 은신한 채로 연다. */
  | "openingVanish"
  /** 엘라 전용: 쓰러질 피해를 가로채 전투당 한 번, 무적·행동불가로 버티며 되살아난다. */
  | "undyingTalisman"
  /** 노도니아 전용: 맞을수록 회복 중첩을 쌓는 패시브다. */
  | "painfulElation"
  /** 아모 전용: 실제 HP 피해를 받고 살아남을 때 조가비를 쌓아 자신과 최저 HP 비율 아군을 보호한다. */
  | "shellGuard"
  /** 렉시아 전용: 공격 속도·공격력·치명타 확률·치명타 피해를 함께 강화한다. */
  | "battleMaidMastery"
  /** 스피나 전용: 기본 공격의 실제 적중마다 공속을 전투 한정으로 영구 누적한다. */
  | "basicHitAttackSpeedStack"
  /** 폰토스의 시간 누적 주문력·잃은 체력 경감 규칙을 식별한다. */
  | "abyssalPressure"
  /** 도디 전용: 제공자 생존 여부로 팀 방어와 적 회복을 동시에 조절한다. */
  | "guardianNestAura"
  /** 케리스 전용: 저주에 걸린 적을 직접 때릴 때마다 주문력을 전투 한정으로 누적한다. */
  | "cursedInsight"
  /** 메테 전용: 생존 중 팀 공속과 제어 정화·보호막을 제공한다. */
  | "adagioWeight"
  /** 루카 전용: 전투 시작/폭주 진입 때 최고 공격력 아군의 현재 표적을 복사한다. */
  | "followHighestAttackAllyTarget"
  /** 데이 전용: 때린 적을 건너뛰며 표적을 돌리고, 때리는 순간까지 멈추지 않고 움직인다. */
  | "tagAndRun"
  /** 매디 전용: 상성 계산에서 물을 얼음으로 가로채고, 이미 둔화가 최대인 적을 때리면 빙결시킨다. */
  | "frostboundDominion"
  /**
   * 파루아 전용: **사거리 안에서 가장 먼 적**을 노리고, 적중할 때마다 집중을 쌓는다.
   *
   * 집중은 공격력과 **사거리**를 함께 올린다 — 쏠수록 더 멀리 닿아 노릴 수 있는 적이 넓어지고,
   * 그래서 표적을 고르는 규칙과 성장이 서로를 설명한다. 겹당 수치와 상한은 `FOCUS` 한 표가
   * 갖고, 겹당 공격력만 `value`로 적어 스피나의 누적 패시브와 같은 자리에 둔다.
   *
   * "사거리 안에서"라고 좁히는 이유는 이 개체가 로스터 최하 이동 속도이기 때문이다 — 사거리
   * 밖의 먼 적을 노리면 전투가 끝날 때까지 걸어가기만 한다. 사거리 안에 아무도 없으면
   * 평소처럼 가장 가까운 적으로 되돌린다.
   */
  | "farthestFocus";

/** 전투 엔진이 판별하는 야성 특성 효과 ID다. 새 효과는 수치 계약과 함께 명시적으로 추가한다. */
export type FerocityEffectId =
  /** 파루아 전용: 폭주 중 모든 일반 공격이 갈래화살이 되고 사거리가 늘어난다. */
  | "splitVolley"
  | "attackIntervalReduction"
  | "damageReduction"
  | "splashDamage"
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
  | "packHunt"
  /** 티아 전용: 자기 이동 속도를 올리고 일반 공격마다 표적을 다른 적으로 바꾼다. */
  | "ichthyoDive"
  /** 메론 전용: 폭주 중 아군 전체의 일반 공격이 덧칠을 함께 쌓는다. */
  | "sharedOverpaint"
  /** 스테라 전용: 폭주 중 아군 전체의 공격당 야성·궁극기 충전량을 함께 올린다. */
  | "tailwindRally"
  /** 파치 전용: 폭주 중 뇌진탕이 확정 치명타가 되고 그 적을 전장 밖으로 튕겨 날린다. */
  | "knockbackSlam"
  /** 마키 전용: 폭주 중 손질이 터진 피해의 일부를 아군 전체의 회복으로 돌린다. */
  | "butcherFeast"
  /** 델로피 전용: 폭주 중 일반 공격이 중독을 걸거나, 이미 걸린 중독을 그 자리에서 청산한다. */
  | "venomousEncore"
  /** 엘라 「금강불괴」: 폭주 진입 시 보호막 획득 + 정해진 횟수의 가속 공격. */
  | "adamantBody"
  /** 노도니아 전용: 폭주 중 주위를 매초 지지고, 기본 공격마다 잃은 체력을 되찾는다. */
  | "climax"
  /** 데이 전용: 폭주 중 때리기를 멈추고 훨씬 빠르게 달리며 주위에 매초 낙서를 흩뿌린다. */
  | "graffitiRun"
  /** 매디 전용: 폭주 진입 시 모든 상태이상·디버프를 지우고 보호막을 얻으며, 폭주 중 방어력·저항력이 함께 오른다. */
  | "furCoat"
  /** 아모 전용: 폭주 진입 정화·즉시 조가비·단축 내부 쿨다운을 한 계약으로 식별한다. */
  | "shellResolve";

/**
 * 개체별 피버 발현 정적 데이터다.
 *
 * 효과별 파라미터를 판별 가능한 union으로 묶어 잘못된 수치 키를 콘텐츠 작성 시점에 막는다.
 */
export type FerocityTrait = {
  /** 뱃지에 찍히는 짧은 이름. 두세 글자를 넘기지 않는다. */
  name: string;
} & (
  | {
      /**
       * 폭주 중 **순환을 기다리지 않고** 매 공격을 갈래화살로 낸다.
       *
       * 공격 속도가 아니라 **사거리**를 함께 올리는 이유는 궁극기가 속도 축을 갖기 때문이다 —
       * 둘 다 공속을 올리면 폭주와 궁극기가 화면에서 같은 말을 한다.
       */
      effectId: "splitVolley";
      /** 폭주 동안 더해지는 사거리(px). `fighterReach`가 집중 겹 위에 얹는다. */
      reachBonus: number;
    }
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
      effectId: "tailwindRally";
      /** 아군 한 명이 한 번 공격할 때마다 더해지는 야성 충전량이다. */
      teamFerocityGain: number;
      /** 같은 시점에 더해지는 궁극기 게이지다. */
      teamEnergyGain: number;
    }
  | {
      effectId: "sharedOverpaint";
      /** 아군의 적중이 대신 걸어 주는 덧칠. 메론의 기본 공격과 같은 계약을 그대로 쓴다. */
      overpaint: Extract<CombatStatusEffect, { kind: "overpaint" }>;
    }
  | {
      effectId: "butcherFeast";
      /** 터진 손질 피해 중 아군 전체의 회복으로 돌리는 비율(%)이다. */
      healPercent: number;
      /** 폭주에 들어간 뒤 손질 중첩을 건너뛰고 즉시 터뜨릴 기본 공격 횟수다. */
      instantButcherAttacks: number;
    }
  | {
      /**
       * 엘라 「금강불괴」: 폭주 진입 시 보호막 획득 + 정해진 횟수의 가속 공격.
       *
       * 공속을 시간이 아니라 **횟수로** 끊는 이유는 발경이 3연 순환이기 때문이다 — 세 번이면
       * 한 바퀴라, 폭주가 "권을 한 바퀴 몰아친다"는 뜻이 된다. 시간으로 두면 공속이 오른 만큼
       * 바퀴 수가 달라져 그 그림이 흐려진다.
       */
      effectId: "adamantBody";
      /** 폭주에 들어가는 순간 얻는 보호막(최대 체력 비율 %)이다. */
      shieldMaxHpPercent: number;
      /** 보호막과 별개로 훨씬 빨라지는 기본 공격 횟수다. */
      hastenedAttacks: number;
      /** 그 횟수 동안 공격 속도에 더하는 비율(%)이다. */
      attackSpeedPercent: number;
    }
  | {
      /**
       * 절정. 폭주 중에는 서 있는 것만으로 주위가 지져진다.
       *
       * 회복만 있던 자리에 **적에게 남기는 값**을 하나 둔다 — 탱커가 자기 숫자만 바꾸면 화면에
       * 아무 일도 일어나지 않아 그대로 "없는 것"으로 읽힌다. 피해가 최대 체력 비례인 이유는
       * 이 개체가 공격력을 아예 쓰지 않기 때문이다.
       */
      effectId: "climax";
      /** 매초 주위 모든 적에게 주는 최대 체력 비율(%) 고정 피해. */
      auraDamageMaxHpPercent: number;
      /** 그 지속 피해가 닿는 반경이다. */
      radius: number;
      /** 자기 기본 공격 한 번마다 되찾는 잃은 체력 비율(%). */
      missingHpPercentPerBasic: number;
    }
  | {
      /**
       * 폭주 중 일반 공격이 **바르거나 터뜨리거나** 둘 중 하나만 한다.
       *
       * 그 적에게 자기 중독이 없으면 평소대로 바르고, 이미 있으면 남은 시간의 피해를 한꺼번에
       * 몰아 주며 지운다. 번갈아 하는 것이 아니라 **매 타격마다 지금 상태를 보고** 고르므로,
       * 공속이 빨라지거나 중독이 먼저 꺼져도 스스로 맞는 동작으로 돌아온다.
       */
      effectId: "venomousEncore";
      /** 폭주 중 자기 공격 속도에 더하는 비율(%)이다. */
      attackSpeedBonusPercent: number;
    }
  | {
      effectId: "knockbackSlam";
      /** 튕겨 날아다니는 시간(초). 이 동안 그 적은 행동하지 못한다. */
      seconds: number;
      /** 처음 튕겨 나가는 속도(px/s). 때린 방향 그대로 팡 튀어 나간다. */
      speed: number;
      /**
       * 전장 벽에 부딪히는 횟수. 이 수를 다 채우면 그 자리에 선다.
       *
       * 끝을 시간이 아니라 횟수로 정하는 이유는, 시간으로 끊으면 전장 크기와 속도에 따라
       * 어떤 판에서는 두 번, 어떤 판에서는 다섯 번 튕겨 같은 기술이 다른 무게로 읽히기
       * 때문이다. 위의 `seconds`는 벽에 닿지 못할 때를 위한 안전장치로 남는다.
       */
      bounces: number;
    }
  | {
      effectId: "ichthyoDive";
      /** 폭주 중 자기 이동 속도에 더하는 퍼센트다. 100이면 두 배로 달린다. */
      moveSpeedPercent: number;
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
      /** 케리스 전용: 폭주 중 직접 적중한 적을 짧게 광란시킨다. 전이된 타격에는 걸리지 않는다. */
      effectId: "frenzyGaze";
      seconds: number;
      attackSpeedPercent: number;
    }
  | {
      /**
       * 「네가 예술을 알아?」 폭주 중에는 **때리지 않고 달리기만 한다.**
       *
       * 「절정」(노도니아)과 같은 주위 지속 피해 축이지만 성질이 반대다 — 그쪽은 앞에 서서
       * 버티는 동안 주위가 지져지고, 이쪽은 **한 자리에 서지 않는 것 자체**가 피해가 된다.
       * 기본 공격을 멈추는 것이 손해가 아닌 이유는, 달리는 동안 지나간 자리마다 낙서가 남아
       * 여럿에게 동시에 들어가기 때문이다.
       *
       * **도발은 멈추지 않는다.** 이 개체의 도발은 "때린다"가 아니라 **"피해가 들어간다"**에
       * 붙어 있어, 손을 놓아도 지나가는 자리마다 그대로 걸린다 — 달리는 것 자체가 어그로인
       * 개체라 평타를 놓는 순간 탱킹이 꺼지면 폭주가 벌이 된다.
       */
      effectId: "graffitiRun";
      /** 폭주 중 자기 이동 속도에 더하는 비율(%). 100이면 두 배로 달린다. */
      moveSpeedPercent: number;
      /** 매초 주위 모든 적에게 주는 주문력 비율(%) 마법 피해. */
      auraDamagePercent: number;
      /** 그 지속 피해와 낙서가 닿는 반경이다. */
      radius: number;
      /** 매초 함께 칠하는 낙서. 기본 공격과 같은 계약을 그대로 쓴다. */
      vandalism: Extract<CombatStatusEffect, { kind: "vandalism" }>;
      /** 매초 함께 거는 짧은 도발. 기본 공격과 같은 계약을 그대로 쓴다. */
      taunt: Extract<CombatStatusEffect, { kind: "taunt" }>;
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
  | {
      /**
       * 「모피 코트는 장식이 아니랍니다」: 폭주 진입 시 한 번 정화하고 보호막을 얻으며, 폭주 중
       * 내내 방어력·저항력이 함께 오른다.
       *
       * 금강불괴(엘라)와 진입 순간 보호막을 주는 자리는 같지만, 저쪽은 그 자리에 공속을 얹어
       * 계속 때리게 하고 이쪽은 정화 + 방어·저항으로 **버티는 시간 자체**를 늘린다.
       */
      effectId: "furCoat";
      /** 폭주에 들어가는 순간 모든 상태이상·디버프를 지운다. */
      cleanseAllOnEntry: true;
      /** 폭주에 들어가는 순간 얻는 보호막(최대 체력 비율 %)이다. */
      shieldMaxHpPercent: number;
      /** 폭주 중 내내 곱해지는 방어력·저항력 증가율(%)이다. */
      defenseResistancePercent: number;
    }
  | {
      effectId: "shellResolve";
      /** 폭주 진입 판정 직후, 조가비를 지급하기 전에 자기 상태이상·디버프를 모두 지운다. */
      cleanseAllOnEntry: true;
      /** 정화가 끝난 같은 진입 시점에 더하며, 상한 판정 뒤 즉시 소비 판정까지 이어지는 조가비 수다. */
      shellStacksOnEntry: number;
      /** 폭주가 유지되는 동안 새 조가비 발동 뒤 적용할 내부 재사용 대기시간(초)이다. */
      shellCooldownSecondsDuringFever: number;
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
  /**
   * 불멸이 버티는 동안 주위 적을 밀어내는 값이다. 없으면 밀어내지 않는다.
   *
   * 파치의 날려버림과 같은 궤적 규칙(`KNOCKBACK`)을 쓰지만 **주체가 다르다** — 파치는 때려서
   * 날리고 엘라는 쓰러지려는 순간 제 주위를 비운다. 그래서 폭주 특성이 아니라 패시브가 든다.
   */
  undyingKnockback?: { seconds: number; speed: number; bounces: number; radius: number };
  /**
   * 「고통의 희열」 계약. 맞을 때마다 겹이 쌓여 **재생이 빨라진다.**
   *
   * **덧칠·저주와 같은 축이고 손질과는 다르다** — 상한에 닿아도 터지지 않고 그 자리에 머물며,
   * 겹을 비우는 것은 시간뿐이다. 방어를 올리지 않고 회복을 올리는 이유는 이 개체가 종이 방어로
   * 다 맞으면서 그보다 빨리 차오르는 쪽이기 때문이다 — 맞을수록 빨리 찬다.
   */
  elation?: {
    /** 겹 상한. 더 맞아도 이 위로는 오르지 않는다. */
    maxStacks: number;
    /** 겹 하나가 매초 회복시키는 최대 체력 비율(%). */
    maxHpRegenPercentPerStack: number;
    /** 겹이 남아 있는 시간(초). 다시 맞으면 처음부터 다시 흐른다. */
    seconds: number;
  };
  /**
   * 「조가비」 계약. 실제 HP 피해 처리가 끝나고 아모가 살아 있을 때만 한 겹을 얻으며,
   * 유지 시간은 매 획득마다 갱신된다. 상한에 닿으면 같은 피해 처리의 마지막 단계에서 전부
   * 소비해 자신과 자신을 제외한 생존 아군 중 현재 HP 비율 최저(동률은 편성 순서)를 보호한다.
   */
  shellGuard?: {
    /** 소비 전 쌓을 수 있는 최대 겹 수다. */
    maxStacks: number;
    /** 마지막 획득부터 모든 겹이 함께 남는 시간(초)이다. */
    durationSeconds: number;
    /** 평상시 발동 직후 다시 소비할 수 없도록 막는 내부 재사용 대기시간(초)이다. */
    cooldownSeconds: number;
    /** 소비 시 아모 자신에게 주는 자기 최대 체력 비례 보호막(%)이다. */
    selfShieldMaxHpPercent: number;
    /** 소비 시 선정된 아군에게 주는 그 아군 최대 체력 비례 보호막(%)이다. */
    lowestHpAllyShieldMaxHpPercent: number;
  };
  /** 전투 한정 누적 패시브가 쌓을 수 있는 최대 횟수. 상한이 없으면 한 판이 길수록 끝없이 자란다. */
  maxStacks?: number;
  /** 심해 압력 전용: 완전히 경과한 매초 기본 주문력에 복리로 누적하는 비율이다. */
  apPercentPerSecond?: number;
  /** 심해 압력 전용: 최대 체력일 때 적용하는 받는 피해 감소율이다. */
  baseDamageReductionPercent?: number;
  /** 심해 압력 전용: 저체력 구간에서 제한할 받는 피해 감소율 상한이다. */
  maxDamageReductionPercent?: number;
  /** 심해 압력 전용: 최대 피해 감소율에 도달하는 현재 체력 비율이다. */
  maxReductionAtHpPercent?: number;
  /** 고품격 식재료 전용: 다시 표적을 고르고 도약하기까지의 간격(초). 적을 처치하면 즉시 앞당긴다. */
  huntCooldownSeconds?: number;
  /**
   * 고품격 식재료 전용: 전투가 시작되고 첫 도약까지 두는 틈(초).
   *
   * 0이면 첫 프레임에 사라져, 플레이어가 전장을 눈에 담기도 전에 마키만 다른 자리에 서 있다.
   * 짧은 틈을 두면 어디에서 어디로 갔는지가 보인다.
   */
  huntOpeningSeconds?: number;
  /** 고품격 식재료 전용: 실제 HP 피해를 받은 직후 표적에서 벗어나는 은신 시간(초)이다. */
  damageStealthSeconds?: number;
  /** 고품격 식재료 전용: 피격 은신이 한 전투에서 발동할 수 있는 최대 횟수다. */
  damageStealthMaxTriggers?: number;
  /**
   * 무면허 안전제일 전용: 한 방에 들어올 수 있는 피해의 상한(대상 최대 체력 %)이다.
   *
   * 이 비율 **이하의 평범한 타격은 그대로 다 맞고**, 넘는 한 방만 이 선까지 눌린다. 즉사급
   * 일격을 맞아도 체력이 60% 남고, 두 번이면 20%, 세 번째에 쓰러진다.
   */
  impactCapMaxHpPercent?: number;
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
  /**
   * 「태그 앤 런」 전용: **달리고 있는 동안** 매초 더 차는 궁극기 게이지다.
   *
   * 이 개체는 때리는 순간을 빼면 늘 달리고 있으므로 사실상 상시 충전이다. 그래서 값이 작다 —
   * 평타 한 번이 주는 26과 나란히 두면 게이지가 두 배 속도로 차 궁극기가 상시기가 된다.
   */
  moveEnergyPerSecond?: number;
  /** 「태그 앤 런」 전용: 달리는 동안 매초 더 차는 야성이다. 피버 중에는 공용 규칙대로 오르지 않는다. */
  moveFerocityPerSecond?: number;
  /**
   * 유체화. 다른 전투원과 **서로 밀어내지 않고 그대로 지나간다.**
   *
   * 겹침을 푸는 힘(`separate`)에서 통째로 빠지므로 밀리지도, 밀지도 않는다 — 한쪽만 빼면
   * 뚫고 지나가는 대신 남을 밀어내며 다녀 지나간 자리마다 대형이 흐트러진다.
   *
   * 늘 달리는 개체에만 준다. 멈춰 서서 때리는 개체가 이걸 가지면 표적 위에 그대로 겹쳐 서서
   * 두 몸이 한 자리에 남는다 — 이 값은 "지나간다"이지 "겹쳐 선다"가 아니다.
   */
  phasesThroughFighters?: true;
  /**
   * 설원의 지배자 전용: 상성 계산에서만 이 개체를 `Element` 대신 이 값으로 취급한다.
   *
   * `RelicDef.element`는 그대로 두므로 아이콘·색·도감 표시는 바뀌지 않고, `effectiveElement()`를
   * 거치는 실제 피해 계산과 자동편성 점수만 이 값을 읽는다.
   */
  elementOverride?: "ice";
  /** 설원의 지배자 전용: 때린 적의 둔화가 이미 최대 중첩이면 그 스택을 모두 소모해 빙결시킨다. */
  freezeAtMaxChill?: true;
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
  /**
   * 같은 인물의 다른 상태를 도감과 서사에서 연결하는 원본 캐릭터 ID다.
   *
   * 관계 메타데이터일 뿐이며 전투 정의를 상속하거나 합성하는 키로 사용하지 않는다. 이 필드를
   * 가진 강화형도 stats와 모든 스킬을 자기 정의에 완전하게 소유해야 한다.
   */
  baseIdentityId?: string;
  /** 여러 상태를 하나의 도감 계보로 묶는 선택적 식별자이며 전투 계산에는 사용하지 않는다. */
  identityFamilyId?: string;
  /** 가챠·보유 목록에는 들어가지 않고 적 편성에서만 사용하는 완전한 RelicDef임을 표시한다. */
  enemyOnly?: true;
  /** 기절 지속 시간을 줄이는 비율(%). 정의하지 않으면 저항이 없고 100 이상이면 면역이다. */
  stunResistancePercent?: number;
  name: string;
  /** 도감에서 쓰는 개체번호. 앞자리 0을 보존하기 위해 숫자가 아닌 문자열로 저장한다. */
  specimenNumber: string;
  /** 복원 프로젝트 내부에서 부르는 정적 코드네임이다. */
  projectName: string;
  /** 표본을 발견한 장소이며 생물학적 기원(origin)과 구분한다. */
  excavationSite: string;
  /** 발굴 장소의 특이점, 화석·난각·골격의 보존 상태와 복원 연구에서 확인한 특징만 짧게 적는 발굴 기록이다. 복원 이후의 생활 관찰은 넣지 않는다. */
  fossilRecord: string;
  /** 저장 데이터가 아닌 정적 도감 정보로 쓰는 복원 표본의 생애·신체 측정 원본이다. 관찰 일지 본문에 이 수치를 반복하지 않는다. */
  observationProfile?: {
    /** 원종 표본이 살았던 지질학적 시기이며 복원 이후 나이와 구분한다. */
    originYear: string;
    /** `docs/lore.md` 규칙에 따른 0~20의 고정 E.C. 분류다. 실제 나이가 아닌 복원체의 외형·정서적 성장 단계이며 서사 시간이 흘러도 증가하지 않는다. */
    restorationYear: string;
    /** 화석에 남은 공룡·고생물 원종의 생물학적 성장 단계다. 복원체의 인간 사회상 성인 여부와 무관하며 정신적 성숙 성향의 근거로만 쓴다. */
    lifeStage: string;
    /** 복원된 인간형 신체의 단일 신장 측정값이며 서술형 관찰 기록에 복제하지 않는다. */
    height: string;
    /** 복원된 인간형 신체의 단일 체중 측정값이며 서술형 관찰 기록에 복제하지 않는다. */
    weight: string;
  };
  /**
   * 소속 자치 스쿼드 또는 적대 세력.
   *
   * 전투 role·속성처럼 코드가 강제하는 값이 아니라 **서사 값**이다. `docs/factions.md`의
   * 배정표가 원문이고, 여기 없는 렐릭이 생기면 그 문서에 근거 한 줄과 함께 추가한다.
   */
  squad: SquadId;
  /**
   * 그 스쿼드 안에서의 이야기 한 줄.
   *
   * 소속을 이름표로만 두면 배정표의 칸 하나로 끝난다. 그 무리에서 실제로 무엇을 하고 어떻게
   * 불리는지가 있어야 소속이 성격이 된다.
   */
  squadNote?: string;
  /** 그 개체가 주인공을 부르는 말. 봉인된 적은 관계가 공개되지 않았으므로 의도적으로 비운다. */
  researcherTitle?: string;
  /** 미보유 상태에서도 공개할 수 있는 외형 중심의 짧은 도감 요약이다. 발굴 경위나 복원 후 생활 관찰은 넣지 않는다. */
  catalogSummary: string;
  /** 설정 확정 여부를 판별 가능한 데이터로 표현한다. `text`에는 복원 이후 직접 본 성격·말투·습관·관계만 쓰며 신체 수치나 화석 상태를 넣지 않는다. */
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
  /**
   * 난전에서 이 개체가 멈춰 서서 때리기 시작하는 거리.
   *
   * 실제 픽셀 값은 `REACH_TIER` 한 표가 정하고 개체는 **단계만** 고른다 — 개체마다 숫자를
   * 적으면 새 개체가 들어올 때마다 사거리가 조금씩 늘어나 앞뒤 줄이 흐려진다. 생략할 수
   * 없게 필수로 두는 이유는 기본값이 있으면 아무도 고르지 않기 때문이다.
   */
  reachTier: ReachTier;
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
  /** 의도적으로 성장을 되돌리는 회상·분기만 회귀 사유를 명시해 정적 검사를 통과한다. */
  growthRegression?: { kind: "flashback" | "branch"; reason: string };
}

/** 스테이지에 출전하는 영구 캐릭터 정의를 플레이어에게도 공개된 성장 상태와 연결한다. */
export interface StageEnemyDef {
  /** `src/data/relics.ts`에 정의된, 스테이지가 덮어쓸 수 없는 캐릭터 ID다. */
  relicId: string;
  /** 플레이어 렐릭과 같은 레벨 성장 공식을 적용할 정수 레벨이다. */
  level: number;
  /** 플레이어 렐릭과 같은 한계 돌파 공식을 적용할 정수 단계다. */
  breakthrough: number;
  /** 배열 순서와 무관하게 전열(0)에서 후열(2)까지의 전투 배치를 고정한다. */
  formationSlot: 0 | 1 | 2;
}

/** 전투 노드만 적별 성장 스냅샷과 전투 보상을 소유한다. */
export interface BattleStageDef extends StageBase {
  kind: "battle";
  enemies: [StageEnemyDef, StageEnemyDef, StageEnemyDef];
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
