import { amplifyFerocityGain } from "./bond";
import type { Combatant } from "./combatTypes";
import { computeDamage, computeDamageContribution, currentAbilityPower, isCriticalHit } from "./damage";
// 전투 HUD와 피해 공식이 동일한 현재 주문력 계산을 소비하도록 공용 헬퍼를 다시 노출한다.
export { currentAbilityPower } from "./damage";
import { drainFerocityFever, FEROCITY_RULES } from "./ferocity";
import { breakthroughBonus } from "./relicProgression";
import { augmentAppliesTo, bleedOnAttackEffect, conditionalAttackPowerMultiplier, expeditionAugmentStatMultipliers, type ExpeditionAugmentEffect, type ExpeditionAugmentTrigger, type ExpeditionTriggeredEffect } from "./expeditionAugments";
import type { BasicAttack, BasicAttackStep, CombatStatusEffect, FerocityTrait, ReachTier, RelicDef, Side, Skill, TeamBuff } from "./types";
import { ULTIMATE_ENERGY_MAX } from "./ultimate";
import { stealthTransition, type CombatEffectCue } from "./combatEffects";
import {
  accumulateDamageContribution, addContribution, contributionSnapshot, createBattleContributions, type BattleContributionRow, type BattleContributions,
  type ContributionCategory,
} from "./battleContribution";

/**
 * 실시간 난전(3 대 3).
 *
 * 턴을 주고받지 않는다. 여섯이 동시에 상대를 찾아 달려가 붙는 순간부터 각자의 공격 속도로
 * 계속 때린다. 이동은 이속, 공격 간격은 공속이 정하므로 두 능력치가 눈에 보이는 차이를 만든다.
 *
 * Phaser를 모른다. 좌표와 시간만 다루고 그림은 씬이 그린다. 난수는 인자로 주입받아서
 * 테스트가 같은 입력에 같은 결과를 고정할 수 있다.
 */

/** 캐릭터가 돌아다닐 수 있는 사각 영역. 화면 좌표 그대로다. */
export interface Arena {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** 난전에 참가한 한 명. 공용 전투 수치에 실시간 좌표와 행동 상태를 더한다. */
export interface Fighter extends Combatant {
  id: string;
  side: Side;
  /** 전투 입력이 정한 Puppet 표시 배율이다. 전투 수치에는 영향을 주지 않는다. */
  bodyScale: number;
  /** 발이 닿아 있는 바닥 좌표. 씬은 이 점을 기준으로 SD를 세운다. */
  x: number;
  y: number;
  /** 바라보는 방향. 1이면 오른쪽이다. */
  facing: 1 | -1;
  /** 다음 공격까지 남은 시간(초). */
  attackCooldown: number;
  targetId: string | null;
  /**
   * 지금 상대와 붙어 있는지.
   *
   * 사거리 하나로만 판단하면 밀려났다 다가서기를 프레임마다 반복해 제자리에서 떠는 것처럼
   * 보인다. 붙는 거리와 떨어지는 거리를 다르게 둬서 경계에서 상태가 튀지 않게 한다.
   */
  engaged: boolean;
  /** 붙는 각도를 사람마다 어긋나게 만드는 고유 위상. 여섯이 한 점에 겹치지 않게 한다. */
  wander: number;
  /**
   * 발 위치와 별개로 그림만 흔드는 순간 변위(px).
   *
   * 때릴 때는 상대 쪽으로 튀어나갔다가 돌아오고, 맞을 때는 반대로 밀려난다. 실제 좌표를
   * 건드리지 않으므로 맞고 밀려나도 진형이 무너지거나 사거리 밖으로 튕겨 나가지 않는다.
   */
  dashX: number;
  dashY: number;
  /** 달릴 때 떠오르는 높이(px). 0이면 땅에 붙어 있다. */
  hop: number;
  /** 통통 튀는 주기의 현재 위상. 이동을 멈춰도 이어서 센다. */
  hopPhase: number;
  /** 연속 공격을 세는 상대. 상대가 바뀌면 셈이 처음으로 돌아간다. */
  streakTargetId: string | null;
  /** 같은 상대를 몇 번 이어서 때렸는지. */
  streakCount: number;
  /**
   * 지금 반짝이는 표식을 달고 있는 상대(`shimmerMark` 패시브 전용).
   *
   * 표식은 공격자가 소유한다 — 대상에 붙여 두면 티아가 둘일 때 서로의 표식을 지운다.
   */
  shimmerMarkTargetId: string | null;
  /**
   * 지금 덧칠된 상태. 스스로는 피해를 주지 않고 **받는 모든 피해**를 중첩만큼 키운다.
   *
   * 출혈처럼 슬롯 하나만 두는 이유는 같다 — 여럿이 겹쳐 걸면 어느 쪽 수치가 도는지 화면과
   * 계산이 갈린다. 다시 칠하면 시간이 처음부터 다시 돌고 중첩만 하나 오른다.
   */
  overpaint: { remaining: number; total: number; stacks: number; percentPerStack: number; maxStacks: number } | null;
  /**
   * 지금 튕겨 날아가는 중인 상태. 없으면 null이다.
   *
   * 기절과 따로 두는 이유는 **좌표가 실제로 움직이기 때문**이다 — 기절은 제자리에서 멈추는
   * 것이고, 이쪽은 벽을 튕기며 전장을 가로지른다. 그동안 행동하지 못하는 것만 같다.
   */
  /**
   * 튕겨 날아가는 중인 몸. 끝은 시간이 아니라 **남은 튕김 횟수**가 정한다.
   *
   * 시간으로 끊으면 전장 크기와 속도에 따라 어떤 판에서는 두 번, 어떤 판에서는 다섯 번
   * 튕기다 멈춰 같은 기술이 화면마다 다른 무게로 읽힌다. `remaining`은 벽에 닿지 못하고
   * 맴도는 경우를 위한 안전장치일 뿐이다.
   */
  knockback: { remaining: number; vx: number; vy: number; bouncesLeft: number } | null;
  /** `statusEffectEvery`가 있는 기본 공격이 실제로 몇 번 나갔는지. 그 주기에만 상태를 건다. */
  statusHitCount: number;
  /** 원정 공격 출혈의 명시된 발동 주기만 세며 스킬 상태 주기와 섞지 않는다. */
  augmentBleedHitCount: number;
  /** 조건부 증강별 발동 횟수와 마지막 시각. 키는 전투 입력 배열 순번이라 저장 데이터와 분리된다. */
  augmentRuntime: Record<string, { triggers: number; lastAt: number }>;
  /** 낮은 체력 훅이 부여한 전투 한정 방어·저항 퍼센트다. */
  augmentDefensePercent: number;
  augmentResistancePercent: number;
  /**
   * 지금 쌓인 손질. 상한에 닿으면 그 자리에서 터지고 다시 0부터 센다.
   *
   * 덧칠과 달리 **지속 시간이 없다** — 세 번째 칼질이 곧 결과라 시간이 흘러 사라지지 않는다.
   */
  butcher: { stacks: number; maxStacks: number; burstPower: number } | null;
  /** 표적을 다시 고르기까지 남은 시간(초). 0이 되는 프레임에 주위를 다시 잰다. */
  retargetIn: number;
  /** 고품격 식재료가 다시 표적을 고르기까지 남은 시간(초). 0이 되는 프레임에 도약한다. */
  huntCooldown: number;
  /** 남은 순풍 시간(초). 공격 속도·이동 속도를 함께 올리는 아군 전체 강화다. */
  tailwindFor: number;
  /** 지금 걸린 순풍의 수치. 여러 제공자가 겹치면 남은 시간이 긴 쪽의 값을 그대로 쓴다. */
  tailwind: TeamBuff | null;
  /** 순풍이 데려온 지속 회복의 다음 틱까지 남은 시간(초). */
  tailwindTickIn: number;
  /** 남은 기절 시간(초). 별도 boolean 없이 `stunnedFor > 0`만 행동 차단 기준으로 삼는다. */
  stunnedFor: number;
  /** 지금 도는 기절 한 바퀴의 전체 시간(초). 화면의 시계가 읽는 분모다. */
  stunnedTotal: number;
  /** 남은 경직 시간(초). 기절과 달리 저항·유지 모션 없이 순간적으로만 행동을 끊는다. */
  staggeredFor: number;
  /** 모든 피해보다 먼저 소모되며 제공자의 안정적인 런타임 ID를 함께 보존하는 보호막이다. */
  shield: { amount: number; providerId: string | null };
  /** 아다지오 정화·보호막의 메테 개체별 남은 쿨타임(초)이다. JSON 직렬화 가능한 숫자다. */
  adagioCooldownRemaining: number;
  /**
   * 지금 걸린 저주. 스스로는 피해를 주지 않고 **저항을 중첩만큼 깎는다.**
   *
   * 덧칠과 같은 이유로 슬롯 하나만 둔다 — 여럿이 겹쳐 걸면 어느 쪽 수치가 도는지 화면과
   * 계산이 갈린다. 다시 걸면 시간이 처음부터 다시 돌고 중첩만 하나 오른다.
   */
  curse: { remaining: number; total: number; stacks: number; percentPerStack: number; maxStacks: number } | null;
  /**
   * 지금 걸린 광란. 표적이 자기 편으로 뒤집히고 공격 속도가 오른다.
   *
   * `sourceId`를 함께 드는 이유는 **기여도** 때문이다 — 적이 자기 편을 때린 몫은 그 적이 아니라
   * 광란을 건 쪽이 만든 피해다. 없으면 광란 전략을 쓴 판에서 시전자가 기여 0으로 찍힌다.
   */
  frenzy: { remaining: number; total: number; attackSpeedPercent: number; sourceId?: string } | null;
  /** 걸려 있는 출혈. 없으면 null이다. */
  bleed: { remaining: number; total: number; tickIn: number; percent: number; sourceId?: string } | null;
  /**
   * 걸려 있는 중독. 없으면 null이다.
   *
   * 출혈과 달리 **매 틱 피해가 굳어 있다**(`amountPerSecond`) — 바른 쪽의 공격력·주문력에서
   * 바르는 순간 계산한 값이다. 매 틱 시전자를 되짚으면 그 사이 버프까지 소급되어, 바를 때
   * 화면이 보여 준 수치와 갈린다.
   */
  poison: { remaining: number; total: number; tickIn: number; amountPerSecond: number; sourceId?: string } | null;
  /** 이 전투에서 긴급 회복 패시브를 이미 발동했는지. 저장하지 않는 "전투당 1회" 소유 상태다. */
  passiveTriggered: boolean;
  /** 진행 중인 지속 회복. remaining과 tickIn은 초, percentPerTick은 최대 HP 대비 %이며 저장하지 않는다. */
  regeneration: { remaining: number; tickIn: number; percentPerTick: number } | null;
  /** 시간 기반 패시브로 누적된 추가 주문력. 정적 정의를 변경하지 않는 전투 상태다. */
  bonusAp: number;
  /** SkirmishBossState.fighterId와 일치하는 점수전 보스에만 설정되는 불사 경계다. */
  immortal?: boolean;
  /** 기본 공격 실제 적중으로 쌓인 전투 한정 공격 속도다. 저장 모델에는 존재하지 않는다. */
  bonusAttackSpeed: number;
  /** 원정 상태 효과의 지속시간을 늘리는 전투 스냅샷 배율이다. */
  statusPotencyMultiplier: number;
  /** 현재 HP에 따라 켜지는 공격력 효과는 정적 능력치와 달리 매 공격 시점에 판정한다. */
  conditionalAttackPowerMultiplier: (hpPercent: number) => number;
  /** 루카의 실제 기본 공격 행동 주기만 세며 궁극기·전이·추가타는 포함하지 않는다. */
  basicAttackCount: number;
  /** 순환 기본 공격(엘라의 발경)이 다음에 낼 걸음이다. 순환이 없는 개체는 늘 0이다. */
  basicCycleStep: number;
  /**
   * 금강불괴가 아직 빠르게 내줄 수 있는 기본 공격 횟수다.
   *
   * 폭주에 **들어가는 순간** 채우고 한 방마다 하나씩 쓴다 — 시간이 아니라 횟수로 끊는 값이라
   * 폭주가 길어져도 손이 빨라지는 구간은 정확히 그만큼이다.
   */
  hastenedAttacksLeft: number;
  /** 0보다 크면 단일 대상 선택의 중심이 될 수 없는 은신 상태다. */
  stealthFor: number;
  /**
   * 지금 걸린 은신이 **기본 공격 한 번으로 풀리는가.**
   *
   * 은신 슬롯은 하나뿐이라 어느 스킬이 걸었는지 시간만으로는 알 수 없다. 궁극기가 건 은신은
   * 한 방을 꽂는 자리라 그 한 방이 곧 노출이고, 패시브의 전투 시작 은신은 시간이 다할 때까지
   * 유지된다 — 그 차이를 여기 한 값이 든다.
   */
  stealthBreaksOnBasic: boolean;
  /**
   * 불멸로 버티는 중. 이 동안은 **모든 피해를 받지 않고 아무것도 하지 못한다.**
   *
   * 기절 슬롯을 쓰지 않는 이유는 메테의 아다지오가 아군의 군중제어를 자동으로 정화하기
   * 때문이다 — 기절로 묶으면 메테가 있는 편성에서 즉시 풀려 **무적인 채로 싸우게 된다.**
   */
  undying: { remaining: number; total: number } | null;
  /**
  /**
   * 도발당해 특정 상대만 노리는 중. 없으면 평소의 거리·혼잡도 규칙으로 고른다.
   *
   * 기절과 달리 **행동을 막지 않고 방향만 돌린다.** 그래서 군중제어 정화의 대상이 아니다.
   */
  taunted: { remaining: number; total: number; sourceId: string } | null;
  /**
   * 지금 쌓인 희열. 맞을 때마다 한 겹씩 오르고 방어력·저항력을 함께 올린다.
   *
   * 손질과 같은 성질이라 **상한에 닿는 프레임에 스스로 터지고** 겹이 0으로 돌아간다. 다만
   * 손질과 달리 시간도 흐른다 — 맞지 않으면 식는 값이라, 앞에 서 있는 동안만 단단해진다.
   */
  elation: { stacks: number; remaining: number; total: number; regenPercentPerStack: number; maxStacks: number; tickIn: number } | null;
  /**
   * 아군이 받을 피해를 대신 받는 중. 희열이 터질 때와 「고통의 미학」이 켠다.
   *
   * **슬롯은 하나뿐이다** — 두 겹으로 쌓으면 같은 피해가 두 번 나뉘어 아군이 실제로 받는 몫이
   * 화면과 갈린다. 그래서 새로 켜질 때는 **대신 받는 비율이 큰 쪽**이 남고, 비율이 같으면 남은
   * 시간이 긴 쪽이 남는다.
   */
  bulwark: { remaining: number; total: number; percent: number; regenPercentPerSecond: number; tickIn: number; skillId: string; name: string } | null;
  /**
   * 이번 프레임에 쓰러질 피해를 가로챘다는 표시다.
   *
   * 가로채기는 `applyDamage` 안에서 일어나 어떤 피해 원천도 빠뜨리지 않지만(출혈·중독·뇌진탕
   * 포함), 주위를 밀어내려면 전장 전체가 필요하다. 그래서 HP만 그 자리에서 붙잡고 실제 발동은
   * 같은 프레임의 `advance`가 마무리한다.
   */
  undyingPending: boolean;
  /**
   * 궁극기가 걸어 둔 **다음 일반 공격 한 번**의 강화가 남아 있는가.
   *
   * 위력을 따로 들지 않는 이유는 그 값이 곧 이 개체의 일반 공격이기 때문이다 — 여기에 숫자를
   * 두면 평타 위력을 조정한 뒤 이 한 방만 옛 값으로 남는다.
   */
  empoweredBasic: boolean;
  /** 폰토스 폭주의 다음 1초 고정 피해까지 남은 시간이며 비활성 중에는 1초로 초기화한다. */
  pontusRageTickIn: number;
  /** 「절정」의 다음 1초 주위 피해까지 남은 시간이며 비활성 중에는 1초로 초기화한다. */
  climaxAuraTickIn: number;
}

export type SkirmishPhase = "fight" | "victory" | "defeat";

export interface SkirmishState {
  fighters: Fighter[];
  /** 중복 relicId와 무관하게 런타임 ID별로 누적하는 전투 결과의 단일 진실이다. */
  contributions: BattleContributions;
  arena: Arena;
  phase: SkirmishPhase;
  /** 전투가 시작된 뒤 흐른 시간(초). */
  elapsed: number;
  log: string[];
  /** 원정에서만 주입되는 순수 효과 목록이다. 일반 스토리 전투는 빈 배열이다. */
  augmentEffects: readonly ExpeditionAugmentEffect[];
  /** 생성 직후 UI가 첫 step에서 한 번만 받는 전투 시작 사건이다. */
  initialEvents: SkirmishEvent[];
  /** 보스전에서만 존재하는 누적 피해·생존 시간·단계 상태다. 같은 진행기가 함께 갱신한다. */
  boss?: SkirmishBossState;
}

/**
 * 전투 HUD가 표시할 활성 이로운 효과다. Phaser 객체를 넣지 않아 코어와 UI의 의존 방향을 지킨다.
 * `timing`은 실제 시계가 있는 효과와 조건이 유지되는 동안만 존재하는 효과를 구별한다.
 */
export interface ActiveCombatBuff {
  id: string;
  /**
   * 겹 수. 있으면 칩 우하단에 그 수가 선다.
   *
   * 겹치는 것을 칩 여러 장으로 늘어놓으면 한 줄이 금세 가득 차고, 어느 것이 같은 효과인지
   * 세어야 안다. 칩은 하나만 두고 수가 몇 겹인지 말한다.
   */
  stacks?: number;
  sourceFighterId: string;
  targetFighterId: string;
  skillId: string;
  name: string;
  description: string;
  timing:
    | { kind: "timed"; remainingSeconds: number; totalSeconds: number }
    | { kind: "ferocity"; remainingSeconds: number; totalSeconds: number }
    | { kind: "conditional" }
    | { kind: "permanent" };
}

/** 불사 원정 보스의 시간 단계다. 초당 피해는 아군 전체에 동일하게 적용된다. */
export interface SkirmishBossPhase { startsAt: number; damagePerSecond: number; label: string }
/** 화면과 정산이 읽는 보스 상태로, 점수는 경감·보호막 후 HP에 실제 적용된 피해다. */
export interface SkirmishBossState {
  /** 적 부속물을 불사화하지 않도록 유일하게 추적하는 보스 전투원 ID다. */
  fighterId: string;
  score: number;
  survivedFor: number;
  phaseIndex: number;
  limitReached: boolean;
  phases: readonly SkirmishBossPhase[];
  limitSeconds: number;
  damageRemainder: number;
  /** 리미트가 좁혀 오는 현재 안전 반경과 다음 해일 예고 여부다. 씬은 이 값만 그린다. */
  pressureRadius: number;
  tideWarning: boolean;
}

/** 원정 저장 상태를 전투 시작 값으로 옮길 때 쓰는 렐릭별 스냅샷이다. currentHp는 0~100 비율이다. */
export interface FighterInitialState { relicId: string; currentHp: number; alive: boolean }

/** 전투 종료 후 저장 경계가 소비하는 렐릭별 생존 결과다. */
export interface SkirmishRelicResult { relicId: string; currentHp: number; alive: boolean }

export interface CreateSkirmishOptions {
  playerInitialStates?: readonly FighterInitialState[];
  augmentEffects?: readonly ExpeditionAugmentEffect[];
  /** 적 종류별 크기 표현을 씬이 재해석하지 않도록 입력 모델에서 전달한다. */
  enemyBodyScale?: number;
  /** 지정한 적 한 명만 불사이며 아군 전멸만 패배 종료가 되는 보스 규칙을 켠다. */
  boss?: { phases: readonly SkirmishBossPhase[]; limitSeconds: number; fighterId?: string };
}

/** 씬이 모션·피격 숫자·사망 연출을 붙일 수 있도록 이번 프레임에 일어난 일만 모아 돌려준다. */
export type SkirmishEvent =
  | {
      kind: "attack";
      attackerId: string;
      targetId: string;
      skill: "basic" | "ultimate" | "staccato" | "transfer" | "shimmer";
      amount: number;
      /** 방어·저항·속성·대상 경감·무효화 전, 공격자가 실제로 만든 점수 기여값이다. */
      contributionAmount: number;
      critical: boolean;
      /**
       * 무엇이 막는 피해인가. 씬은 이 값으로 수치 색을 고른다.
       * `true`는 방어·저항을 거치지 않는 고정 피해(피해 전이처럼 이미 확정된 값의 복제)다.
       */
      damageType: "physical" | "magical" | "true";
      /** 대상의 경감이 실제로 값을 깎았는지. 표시 크기를 한 등급 낮추는 데만 쓴다. */
      mitigated?: boolean;
      /** 광역 한 번에서 첫 피해 사건만 공격 모션을 재생한다. 생략하면 기존처럼 재생한다. */
      animate?: boolean;
      /**
       * **한 번의 행동이 만든 뒤이은 타격인가.** 연격 둘째 타·광역의 나머지 대상·튀는 피해는
       * 모두 제 모션을 갖고 눈에도 보이지만, 플레이어가 고른 행동은 여전히 하나다. 보스
       * 제출처럼 행동을 세는 곳은 `animate`가 아니라 이 값을 읽는다 — `animate`는 모션을
       * 겹쳐 틀지 않기 위한 표시라 연격처럼 실제로 두 번 휘두르는 타격에는 켜져 있다.
       */
      followUp?: boolean;
      /**
       * **이 타격이 일어난 코어 시각(초).** 씬은 프레임이 끝난 뒤에야 사건을 읽으므로
       * `state.elapsed`를 그때 읽으면 실제 타격보다 한 프레임 늦은 시각을 적는다. 앞 타격이
       * 그만큼 늦게 적히면 두 행동의 간격이 실제보다 짧아 보여, 보스 제출의 공속 검증이
       * 정직한 판을 거절했다(v0.66.1까지 폰토스 정산 실패의 두 번째 원인). 조각 안에서
       * 못 박은 이 값이 곧 코어가 인정하는 시각이다.
       */
      at?: number;
    }
  /**
   * 광역 공격이 실제로 터진 자리와 범위다. 씬은 그 자리 **바닥**에 범위를 그려 어디까지
   * 맞았는지 보여 준다 — 숫자만 여럿 뜨면 왜 셋이 함께 맞았는지 읽히지 않는다.
   */
  | { kind: "areaImpact"; attackerId: string; x: number; y: number; radius: number; ultimate: boolean }
  | { kind: "damageIgnored"; attackerId: string; targetId: string }
  /**
   * 아군이 받을 피해를 앞에 선 개체가 대신 받은 순간이다.
   *
   * 두 사람을 함께 싣는 이유는 화면이 "누가 누구 대신 맞았는가"를 그려야 하기 때문이다 —
   * 대신 받은 쪽에만 숫자가 뜨면 정작 살아난 아군 쪽에서는 아무 일도 없어 보인다.
   */
  | { kind: "damageShared"; fighterId: string; fromFighterId: string; amount: number }
  /** 순풍처럼 시간이 정해진 아군 전체 강화가 걸린 순간이다. 씬은 대상 위에 표식만 띄운다. */
  | { kind: "teamBuff"; fighterId: string; sourceId: string; buff: TeamBuff }
  | { kind: "bleed"; fighterId: string; amount: number; started: boolean }
  /** 중독이 발린 순간(`started`)과 매초 깎인 순간. 출혈과 같은 축이라 같은 모양으로 싣는다. */
  | { kind: "poison"; fighterId: string; amount: number; started: boolean }
  /**
   * 중독이 **청산된** 순간. 남은 몫을 한꺼번에 받은 한 방이라 매초 틱과 다른 무게로 뜬다.
   * 몇 초치를 몰아 받았는지(`ticks`)를 함께 싣는다 — 씬이 상태를 되짚지 않고 그 수를 읽는다.
   */
  | { kind: "poisonLiquidated"; fighterId: string; amount: number; ticks: number }
  | { kind: "heal"; fighterId: string; amount: number; source: "passive" | "ultimate" | "ferocity"; effect: CombatEffectCue }
  | { kind: "status"; fighterId: string; status: "stun" | "stagger"; active: true }
  | { kind: "shieldGranted"; fighterId: string; providerId: string; amount: number; remaining: number; effect: CombatEffectCue }
  | { kind: "shieldAbsorbed"; fighterId: string; amount: number; remaining: number; effect: CombatEffectCue }
  | { kind: "shieldDepleted"; fighterId: string; effect: CombatEffectCue }
  | { kind: "combatEffect"; fighterId: string; effect: CombatEffectCue }
  /**
   * 쓰러진 순간. `sourceId`는 마지막 일격을 넣은 쪽이다.
   *
   * 씬이 날아가는 방향을 이 두 점(가한 쪽 → 맞은 쪽)에서 만든다 — 방향을 화면이 임의로
   * 고르면 때린 쪽과 반대로 날아가는 그림이 나온다. 지속 피해처럼 가한 쪽이 없는 죽음은
   * 비워 두고, 그때만 화면이 바라보던 방향으로 되돌아간다.
   */
  | { kind: "death"; fighterId: string; sourceId?: string }
  /** 뇌진탕이 울린 순간의 고정 피해. 방어력을 지나치므로 attack 사건과 따로 센다. */
  | { kind: "concussion"; fighterId: string; amount: number; critical: boolean }
  /** 폭주한 파치가 적을 튕겨 날린 순간. 씬은 이 사건으로만 튕기는 연출을 시작한다. */
  | { kind: "knockback"; fighterId: string; seconds: number; bounces: number }
  /** 손질 세 겹이 터진 순간. 방어를 지나치지 않는 물리 피해라 attack과 다른 색으로 뜬다. */
  | { kind: "butcherBurst"; attackerId: string; fighterId: string; amount: number }
  /** 돌진이 실제로 지나간 선분. 씬은 이 두 점 사이에 자국을 그린다. */
  | { kind: "charge"; fighterId: string; from: { x: number; y: number }; to: { x: number; y: number } }
  | { kind: "finish"; phase: "victory" | "defeat" };

/** 난전의 손맛을 정하는 값. 전부 여기서만 조정한다. */
export const SKIRMISH = {
  /** 공격 속도 100인 캐릭터의 공격 간격(초). */
  attackInterval: 1.5,
  /**
   * 돌진(`chargeLine`)이 밀고 들어가는 시간(초).
   *
   * 거리를 직접 적지 않고 시간으로 두는 이유는, 그 시간 × 이동 속도가 곧 거리라 **발이 빠른
   * 개체가 더 멀리 파고든다**는 규칙이 능력치 하나로 설명되기 때문이다.
   */
  chargeSeconds: 0.9,
  /** 이동 속도 100인 캐릭터가 1초에 가는 거리(px). */
  moveRate: 1.45,
  /**
   * 근거리 개체가 붙었다고 보고 때리기 시작하는 거리.
   * 반드시 `spacing`보다 커야 한다 — 밀어내는 간격이 사거리보다 넓으면 서로 영원히 닿지 못한다.
   * 중거리·원거리는 `REACH_TIER`가 이 값에서부터 벌린다.
   */
  reach: 172,
  /** 서로 밀어내 겹치지 않게 유지하는 간격. 여섯이 한 덩어리로 뭉쳐 보이지 않게 한다. */
  spacing: 132,
  /**
   * 겹친 만큼을 1초에 몇 배로 풀지. 한 프레임에 전부 밀어내면 걸어 들어가는 힘과 부딪쳐
   * 몸이 낀 것처럼 떤다. 천천히 풀면 서로 비집고 자리를 잡는 것처럼 보인다.
   */
  separationRate: 6,
  /** 이 비율만큼 다가가면 붙은 것으로 본다. 다시 떨어지는 기준은 `reach`다. */
  engageRatio: 0.82,
  /** 좌우를 뒤집기 전에 필요한 최소 가로 거리(px). 상대와 세로로 겹칠 때 깜빡이지 않게 한다. */
  facingDeadzone: 16,
  /** 이미 그 상대에게 붙은 아군 한 명당 더해지는 거리 가중치. 셋이 한 명에게 몰리지 않는다. */
  crowdPenalty: 240,
  /**
   * 표적을 다시 고르기까지의 간격(초).
   *
   * 예전에는 한 번 고른 표적을 **죽을 때까지** 바꾸지 않았다. 그래서 전투가 시작되는 순간
   * 저마다 상대를 정하고, 바로 옆으로 적이 걸어와도 처음 정한 상대를 향해 전장을 가로질렀다.
   * 주기적으로 다시 재면 "지금 눈앞에 있는 적"이 저절로 답이 된다.
   */
  retargetSeconds: 2,
  /**
   * 다시 고를 때 **지금 노리던 상대**에게 주는 점수 보너스(px 상당).
   *
   * 없으면 거리가 엎치락뒤치락하는 두 적 사이에서 매번 표적이 바뀌어, 다가가다 돌아서기를
   * 반복하며 아무도 때리지 못한다.
   */
  targetStickiness: 160,
  /**
   * 이미 **내 사거리 안에** 들어온 상대에게 주는 점수 보너스(px 상당).
   *
   * 멀리 있는 적을 아예 무시하지는 않는다 — 거리가 여전히 기본 항이라 주위에 아무도 없으면
   * 먼 적을 고른다. 다만 손이 닿는 상대가 있는데 그를 지나쳐 걸어가지는 않는다.
   */
  inReachBonus: 320,
  /** 상대에게 곧장 가지 않고 옆으로 흐르는 정도. 패싸움처럼 보이게 한다. */
  swirl: 0.32,
  /** 때리는 순간 상대 쪽으로 튀어나가는 거리(px). */
  lunge: 52,
  /**
   * 맞은 쪽이 반대로 밀려나는 거리(px).
   * 때리는 쪽 절반도 되지 않는다 — 맞을 때마다 크게 밀리면 주고받는 내내 화면이 튄다.
   */
  knockback: 20,
  /** 튀어나간 거리와 밀려난 거리가 제자리로 돌아오는 속도. 클수록 빨리 복귀한다. */
  recover: 9,
  /** 달릴 때 튀어 오르는 최대 높이(px). */
  hopHeight: 24,
  /** 이동 속도 100 기준 초당 튀는 횟수. 빠를수록 더 자주 통통거린다. */
  hopRate: 2.6,
  /** 한 번에 적분하는 최대 시간(초). 프레임이 길어도 서로를 통과하지 않는다. */
  maxStep: 0.05,
  /** 탭 전환 등으로 프레임이 통째로 밀렸을 때 한꺼번에 진행할 상한(초). */
  maxCatchUp: 0.25,
  /** 무한 공속 누적이 0초 간격과 한 프레임 무한 공격을 만들지 않게 하는 안전 하한이다. */
  minimumAttackInterval: 0.12,
} as const;

/**
 * 사거리 단계가 정하는 실제 거리(px).
 *
 * 개체 정의(`RelicDef.reachTier`)는 단계만 고르고 숫자는 여기 한 표에만 있다. 셋 다
 * `SKIRMISH.spacing`(밀어내는 간격)보다 커야 한다 — 간격이 사거리보다 넓으면 서로 영원히
 * 닿지 못한다.
 */
export const REACH_TIER = {
  melee: SKIRMISH.reach,
  /*
   * 값을 세 번 고쳤다(250/340 → 300/430 → 지금). 앞의 둘은 **먼저 때리는 횟수**가 아니라
   * 그림만 보고 고른 값이라, 아군이 한 대 치는 사이에 적이 이미 붙어 차이가 남지 않았다.
   * 기준을 바꿔 "먼저 몇 대 치는가"로 잡는다 — 중거리는 한두 대, 원거리는 두세 대.
   * 붙는 데 걸리는 시간은 (사거리 차 ÷ 이동 속도)이고, 이동 속도 100이 1초에 145px를 가므로
   * 중거리 360은 근거리보다 약 1.3초, 원거리 600은 약 3초를 먼저 얻는다.
   */
  mid: 360,
  ranged: 600,
} as const satisfies Readonly<Record<ReachTier, number>>;

/** 이 전투원이 멈춰 서서 때리기 시작하는 거리. 씬과 코어가 같은 값을 읽는다. */
export function fighterReach(fighter: Fighter): number {
  return REACH_TIER[fighter.def.reachTier];
}

/**
 * 출혈. `bleedStreak` 패시브가 남기는 상처다.
 *
 * 방어력을 거치지 않고 최대 체력 비율로 깎으므로, 단단한 상대일수록 상대적으로 아프다.
 * 수치는 데이터가 아니라 규칙이라 여기 한 곳에만 둔다.
 */
export const BLEED = {
  /** 지속 시간(초). */
  seconds: 3,
  /** 1초마다 깎는 최대 체력 비율(%). */
  percentPerSecond: 2,
  /** 작은 출혈은 이름뿐 아니라 실제 공용 수치도 표준과 분리한다. */
  minor: { seconds: 2, percentPerSecond: 1 },
} as const;

/**
 * 중독의 공용 계수. **유지 시간은 스킬이 소유한다** — 출혈과 같은 이유로, 시간이 다른 개체가
 * 생기는 순간 태그가 거짓말이 되기 때문이다.
 *
 * 반대로 매초 뽑는 비율은 여기 한 곳에만 둔다. 태그 문장과 실제 스킬 데이터가 같은 수를 읽어야
 * 밸런스를 조정한 뒤 옛 문장이 남지 않는다.
 */
export const POISON = {
  /** 매 틱 시전자 공격력에서 뽑는 비율(%). */
  attackPercentPerSecond: 15,
  /** 매 틱 시전자 주문력에서 함께 뽑는 비율(%). */
  abilityPercentPerSecond: 15,
} as const;

/** 긴급 회복의 공용 틱 규칙. 유지 시간과 회복량은 캐릭터 정의가 소유한다. */
export const EMERGENCY_RECOVERY = {
  /** 회복 틱 사이의 시간(초). */
  tickSeconds: 1,
  /** 초 단위 누적 오차가 5초 마지막 경계를 누락시키지 않게 하는 비교 여유다. */
  epsilon: 1e-9,
} as const;

/** 항상 같은 결과를 원하는 호출부(테스트)를 위한 기본 판정값 — 치명타가 나지 않는다. */
const NO_CRIT = (): number => 0.999999;

function makeFighter(def: RelicDef, side: Side, index: number, x: number, y: number, bondLevel = 0, breakthrough = 0, bodyScale = 1, augmentEffects: readonly ExpeditionAugmentEffect[] = []): Fighter {
  const opened = breakthroughBonus(breakthrough);
  // 정적 정의를 복제한 전투 스냅샷에만 단순 능력치 증강을 한 번 반영한다.
  const multipliers = side === "player" ? expeditionAugmentStatMultipliers(augmentEffects, def.id) : expeditionAugmentStatMultipliers([], def.id);
  const battleDef: RelicDef = { ...def, stats: { ...def.stats,
    hp: def.stats.hp * multipliers.maxHpPercent,
    def: def.stats.def * multipliers.defensePercent,
    res: def.stats.res * multipliers.resistancePercent,
    atk: def.stats.atk * multipliers.attackPowerPercent,
    ap: def.stats.ap * multipliers.spellPowerPercent,
    attackSpeed: def.stats.attackSpeed * multipliers.attackSpeedPercent,
  } };
  return {
    def: battleDef,
    hp: battleDef.stats.hp,
    maxHp: battleDef.stats.hp,
    // 각성 5단계는 전투를 궁극기 준비 상태로 연다.
    energy: opened.readyUltimate ? def.ultimate.cost : 0,
    ferocity: 0,
    bondLevel,
    breakthrough,
    ferocityFever: false,
    id: `${side}-${index}`,
    side,
    bodyScale,
    x,
    y,
    facing: side === "player" ? 1 : -1,
    // 시작하자마자 전원이 동시에 때리지 않도록 첫 공격만 조금씩 어긋나게 둔다.
    attackCooldown: index * 0.18,
    targetId: null,
    engaged: false,
    wander: index * 2.1 + (side === "player" ? 0 : 1.05),
    dashX: 0,
    dashY: 0,
    hop: 0,
    // 여섯이 같은 박자로 뛰지 않도록 시작 위상을 어긋나게 둔다.
    hopPhase: index * 1.3 + (side === "player" ? 0 : 0.65),
    streakTargetId: null,
    streakCount: 0,
    shimmerMarkTargetId: null,
    overpaint: null,
    knockback: null,
    statusHitCount: 0,
    augmentBleedHitCount: 0,
    augmentRuntime: {},
    augmentDefensePercent: 0,
    augmentResistancePercent: 0,
    butcher: null,
    // 첫 도약은 전투가 시작되고 조금 뒤다 — 첫 프레임에 뛰면 순간이동한 것으로만 보인다.
    huntCooldown: def.passive.kind === "gourmetHunt" ? def.passive.huntOpeningSeconds ?? 0 : 0,
    tailwindFor: 0,
    tailwind: null,
    tailwindTickIn: 0,
    // 전투 시작 시 모든 행동 가능 상태이며, 기절은 전투 한정 상태라 저장 스냅샷에서 복원하지 않는다.
    stunnedFor: 0,
    stunnedTotal: 0,
    staggeredFor: 0,
    // 시작 보호막은 보정된 최대 HP를 기준으로 계산해 최대 체력 증강과 자연스럽게 결합한다.
    shield: { amount: 0, providerId: null },
    adagioCooldownRemaining: 0,
    retargetIn: 0,
    curse: null,
    frenzy: null,
    bleed: null,
    poison: null,
    // 저장 스냅샷의 HP만 반영하고, 전투 한정 발동권과 지속 효과는 매 전투 새로 만든다.
    passiveTriggered: false,
    regeneration: null,
    bonusAp: 0,
    immortal: false,
    bonusAttackSpeed: 0,
    statusPotencyMultiplier: multipliers.statusPotencyPercent,
    conditionalAttackPowerMultiplier: (hpPercent) => side === "player" ? conditionalAttackPowerMultiplier(augmentEffects, def.id, hpPercent) : 1,
    basicAttackCount: 0,
    basicCycleStep: 0,
    hastenedAttacksLeft: 0,
    // 짜잔! 은 전투가 열리는 순간부터 은신한 채로 시작한다 — 첫 프레임에 이미 걸려 있어야
    // "숨어서 시작했다"가 되고, 한 박자 뒤에 걸면 이미 표적이 잡힌 뒤다.
    stealthFor: def.passive.kind === "openingVanish" ? def.passive.durationSeconds ?? 0 : 0,
    // 전투 시작 은신은 시간이 다할 때까지 유지된다. 궁극기가 걸 때만 이 값이 켜진다.
    stealthBreaksOnBasic: false,
    undying: null,
    undyingPending: false,
    taunted: null,
    elation: null,
    bulwark: null,
    empoweredBasic: false,
    // 폭주가 켜진 뒤 온전한 1초가 지나야 첫 파동이 발생한다.
    pontusRageTickIn: 1,
    climaxAuraTickIn: 1,
  };
}

/**
 * 시작 진형.
 *
 * 아군은 아래쪽 끝에서 출발한다. 맵을 넓게 쓰면서 위쪽 적진까지 달려 올라가는 그림을 만들기
 * 위해서다. 같은 팀 셋도 한 줄로 세우지 않고 앞뒤로 어긋나게 둔다.
 */
export function spawnSpots(arena: Arena, side: Side, count = 3): { x: number; y: number }[] {
  if (!Number.isInteger(count) || count < 1 || count > 5) throw new RangeError("팀 인원은 1~5기여야 합니다.");
  const width = arena.right - arena.left;
  // 3기는 기존 좌표를 정확히 보존하고, 나머지는 같은 안전 여백 안에 균등 배치한다.
  const ratios = count === 3 ? [0.08, 0.5, 0.92] : Array.from({ length: count }, (_, index) => count === 1 ? 0.5 : 0.08 + (0.84 * index) / (count - 1));
  const columns = ratios.map((ratio) => arena.left + width * ratio);
  const stagger = count === 3 ? [0, -70, 0] : columns.map((_, index) => index % 2 === 0 ? 0 : -70);
  return columns.map((x, index) => ({
    x,
    y: side === "player" ? arena.bottom + stagger[index] : arena.top - stagger[index],
  }));
}

export function createSkirmish(
  playerDefs: RelicDef[],
  enemyDefs: RelicDef[],
  arena: Arena,
  playerBondLevels: Readonly<Record<string, number>> = {},
  playerBreakthroughs: Readonly<Record<string, number>> = {},
  options: CreateSkirmishOptions = {},
): SkirmishState {
  if (playerDefs.length < 1 || playerDefs.length > 5 || enemyDefs.length < 1 || enemyDefs.length > 5) throw new RangeError("난전은 팀별 1~5기를 지원합니다.");
  if (options.boss && (!options.boss.phases.length || options.boss.limitSeconds <= 0)) throw new RangeError("보스 단계와 리미트는 유효해야 합니다.");
  const playerSpots = spawnSpots(arena, "player", playerDefs.length);
  const enemySpots = spawnSpots(arena, "enemy", enemyDefs.length);
  const initialById = new Map(options.playerInitialStates?.map((snapshot) => [snapshot.relicId, snapshot]));
  const players = playerDefs.map((def, i) => {
    const fighter = makeFighter(def, "player", i, playerSpots[i].x, playerSpots[i].y, playerBondLevels[def.id] ?? 0, playerBreakthroughs[def.id] ?? 0, 1, options.augmentEffects);
    const saved = initialById.get(def.id);
    if (saved) fighter.hp = saved.alive ? fighter.maxHp * Math.min(100, Math.max(0, saved.currentHp)) / 100 : 0;
    return fighter;
  });
  const bossFighterId = options.boss?.fighterId ?? "enemy-0";
  const enemies = enemyDefs.map((def, i) => {
    const fighter = makeFighter(def, "enemy", i, enemySpots[i].x, enemySpots[i].y, 0, 0, options.enemyBodyScale ?? 1);
    // 적 편 전체가 아니라 계약에 지정된 한 개체만 불사 경계를 가진다.
    fighter.immortal = options.boss !== undefined && fighter.id === bossFighterId;
    return fighter;
  });
  if (options.boss && !enemies.some(({ id }) => id === bossFighterId)) throw new RangeError("보스 전투원 ID는 적 편성에 존재해야 합니다.");
  const fighters = [...players, ...enemies];
  const state: SkirmishState = {
    fighters,
    contributions: createBattleContributions(fighters.map(({ id }) => id)),
    arena,
    phase: "fight",
    elapsed: 0,
    log: [],
    augmentEffects: options.augmentEffects ?? [],
    initialEvents: [],
    boss: options.boss ? { fighterId: bossFighterId, score: 0, survivedFor: 0, phaseIndex: 0, limitReached: false, phases: options.boss.phases, limitSeconds: options.boss.limitSeconds, damageRemainder: 0, pressureRadius: Math.max(arena.right - arena.left, arena.bottom - arena.top) / 2, tideWarning: false } : undefined,
  };
  // 시작 효과는 별도의 순수 단계에서 정확히 한 번 적용하고 사건은 첫 렌더 step까지 보존한다.
  state.initialEvents = initializeSkirmishAugments(state);
  // 무리 사냥이 있는 편만 기준 아군의 정상 최초 표적을 확정한 뒤 루카가 이를 복사한다.
  triggerPackHunt(state, "player");
  triggerPackHunt(state, "enemy");
  return state;
}

/** 현재 전투의 조건부 증강만 안전하게 좁혀 대상 렐릭에 적용되는 항목과 안정적인 키를 돌려준다. */
function triggeredAugments(state: SkirmishState, fighter: Fighter, trigger: ExpeditionAugmentTrigger): Array<{ effect: ExpeditionTriggeredEffect; key: string }> {
  return state.augmentEffects.flatMap((effect, index) => effect.kind === "triggered" && effect.trigger === trigger && augmentAppliesTo(effect, fighter.def.id)
    ? [{ effect, key: String(index) }] : []);
}

/** 횟수와 내부 쿨타임을 한 경계에서 소비해 다단 히트와 프레임 반복이 무제한 발동하지 않게 한다. */
function consumeAugmentTrigger(state: SkirmishState, fighter: Fighter, key: string, effect: ExpeditionTriggeredEffect): boolean {
  const runtime = fighter.augmentRuntime[key] ?? { triggers: 0, lastAt: Number.NEGATIVE_INFINITY };
  if (runtime.triggers >= effect.limits.maxTriggers || state.elapsed - runtime.lastAt < effect.limits.cooldownSeconds) return false;
  fighter.augmentRuntime[key] = { triggers: runtime.triggers + 1, lastAt: state.elapsed };
  return true;
}

/** 전투 시작 보호막을 기존 shield 슬롯과 shieldGranted 사건으로만 부여하는 일회성 초기화 단계다. */
export function initializeSkirmishAugments(state: SkirmishState): SkirmishEvent[] {
  const events: SkirmishEvent[] = [];
  for (const fighter of state.fighters.filter(({ side }) => side === "player")) {
    // 구형 시작 보호막도 동일 사건 경로로 이관해 기존 저장 선택과 UI가 조용히 깨지지 않게 한다.
    const legacyPercent = expeditionAugmentStatMultipliers(state.augmentEffects, fighter.def.id).initialShieldPercent - 1;
    if (legacyPercent > 0 && fighter.augmentRuntime.legacyShield === undefined) {
      fighter.augmentRuntime.legacyShield = { triggers: 1, lastAt: state.elapsed };
      const amount = fighter.maxHp * legacyPercent; fighter.shield.amount += amount; fighter.shield.providerId = fighter.id;
      events.push({ kind: "shieldGranted", fighterId: fighter.id, providerId: fighter.id, amount, remaining: fighter.shield.amount, effect: { tag: "shieldGain", intensity: 1 } });
    }
    for (const { effect, key } of triggeredAugments(state, fighter, "battleStart")) {
      if (effect.payload.kind !== "shield" || !consumeAugmentTrigger(state, fighter, key, effect)) continue;
      const targets = effect.limits.target === "allAllies" ? state.fighters.filter((ally) => ally.side === fighter.side && isFighterAlive(ally)) : [fighter];
      for (const target of targets) {
        const amount = target.maxHp * effect.payload.maxHpPercent / 100; target.shield.amount += amount; target.shield.providerId = fighter.id;
        events.push({ kind: "shieldGranted", fighterId: target.id, providerId: fighter.id, amount, remaining: target.shield.amount, effect: { tag: "shieldGain", intensity: 1 } });
      }
    }
  }
  return events;
}

/** 전투 상태의 변경 가능한 Fighter를 노출하지 않고 원정 저장용 결과만 복사한다. */
export function skirmishRelicResults(state: SkirmishState): SkirmishRelicResult[] {
  return state.fighters.filter(({ side }) => side === "player").map((fighter) => ({
    relicId: fighter.def.id,
    // 저장은 서로 다른 최대 HP를 같은 휴식 규칙으로 다룰 수 있도록 백분율을 유지한다.
    currentHp: Math.max(0, Math.min(100, (fighter.hp / fighter.maxHp) * 100)),
    alive: isFighterAlive(fighter),
  }));
}

/** 화면에는 전투원 자체나 누적 원본 대신 표시 메타데이터까지 복제한 읽기 전용 성격의 행만 준다. */
export function battleContributionSnapshot(state: SkirmishState, category: ContributionCategory): BattleContributionRow[] {
  // 전투 패널은 아군 성과표이므로 사망 여부와 무관하게 최초 편성의 모든 아군만 복사한다.
  return contributionSnapshot(state.contributions, state.fighters.filter((fighter) => fighter.side === "player").map((fighter, formationOrder) => ({
    id: fighter.id, formationOrder, name: fighter.def.name,
    // 현재 데이터 모델에서 초상 에셋의 안정 키는 렐릭 정의 ID이며 누적 키로는 사용하지 않는다.
    portraitId: fighter.def.id,
  })), category);
}

export function isFighterAlive(fighter: Fighter): boolean {
  return fighter.hp > 0 || fighter.immortal === true;
}

/**
 * 공용 기절 재적용 경계. 짧은 효과가 이미 남은 긴 효과를 덮지 않도록 둘 중 큰 시간을 보존한다.
 * UI는 시작 사건으로 연출을 열고, 종료 여부는 매 프레임 사건 대신 Fighter의 남은 시간을 읽는다.
 */
export function applyStun(fighter: Fighter, seconds: number, state?: SkirmishState): SkirmishEvent[] {
  if (!isFighterAlive(fighter) || !Number.isFinite(seconds) || seconds <= 0) return [];
  // 콘텐츠 정의의 저항은 지속 시간만 줄이며 100% 이상은 같은 경계에서 완전 면역으로 처리한다.
  const resistance = Math.min(100, Math.max(0, fighter.def.stunResistancePercent ?? 0));
  const resistedSeconds = seconds * (1 - resistance / 100);
  if (resistedSeconds <= 0) return [];
  const wasStunned = fighter.stunnedFor > 0;
  fighter.stunnedFor = Math.max(fighter.stunnedFor, resistedSeconds);
  fighter.stunnedTotal = Math.max(fighter.stunnedFor, fighter.stunnedTotal);
  const events: SkirmishEvent[] = wasStunned ? [] : [{ kind: "status", fighterId: fighter.id, status: "stun", active: true }];
  if (!wasStunned && state) cleanseControlWithAdagio(state, fighter, events);
  return events;
}

/** 해제 스킬이 사용할 공용 경계. 종료 사건은 만들지 않고 Fighter 상태를 즉시 단일 진실로 갱신한다. */
export function clearStun(fighter: Fighter): void {
  fighter.stunnedFor = 0;
}

/** 경직은 기절 저항을 쓰지 않고 짧은 행동 차단만 갱신한다. */
export function applyStagger(fighter: Fighter, seconds: number, state?: SkirmishState): SkirmishEvent[] {
  if (!isFighterAlive(fighter) || !Number.isFinite(seconds) || seconds <= 0) return [];
  const wasStaggered = fighter.staggeredFor > 0;
  fighter.staggeredFor = Math.max(fighter.staggeredFor, seconds);
  const events: SkirmishEvent[] = wasStaggered ? [] : [{ kind: "status", fighterId: fighter.id, status: "stagger", active: true }];
  if (!wasStaggered && state) cleanseControlWithAdagio(state, fighter, events);
  return events;
}

/**
 * 새 제어가 적용된 순간, 편성 순서상 첫 준비된 생존 메테가 즉시 정화하고 자기 atk 기반 보호막을 준다.
 * 쿨타임은 제공자 개체가 소유하며 기존 보호막에는 새 보호막을 합산한다. 같은 스텝의 여러 제어는
 * 전투원 처리 순서상 먼저 실제 적용된 대상이 먼저 정화되므로 동시 입력도 결정적으로 재현된다.
 */
function cleanseControlWithAdagio(state: SkirmishState, target: Fighter, events: SkirmishEvent[]): void {
  const provider = state.fighters.find((ally) => ally.side === target.side && isFighterAlive(ally)
    && ally.def.passive.kind === "adagioWeight" && ally.adagioCooldownRemaining <= 0);
  if (!provider) return;
  target.stunnedFor = 0;
  target.staggeredFor = 0;
  const amount = provider.def.stats.atk * (provider.def.passive.cleanseShieldAttackPercent ?? 0) / 100;
  target.shield.amount += amount;
  target.shield.providerId = provider.id;
  provider.adagioCooldownRemaining = provider.def.passive.cleanseCooldownSeconds ?? 0;
  events.push({ kind: "shieldGranted", fighterId: target.id, providerId: provider.id, amount, remaining: target.shield.amount, effect: { tag: "shieldGain", intensity: 1 } });
}

/** 개별 스킬과 야성 특성에서 같은 판별 가능한 상태 효과를 적용한다. */
function applyCombatStatusEffect(fighter: Fighter, effect: CombatStatusEffect, events: SkirmishEvent[], state: SkirmishState, sourceId?: string, critical = false): void {
  // 상태 위력은 기존 상태 슬롯과 저항 판정을 우회하지 않고 시전자의 지속시간 입력만 늘린다.
  const potency = sourceId ? findFighter(state, sourceId)?.statusPotencyMultiplier ?? 1 : 1;
  if (effect.kind === "stun") events.push(...applyStun(fighter, effect.seconds * potency, state));
  if (effect.kind === "stagger") events.push(...applyStagger(fighter, effect.seconds * potency, state));
  if (effect.kind === "bleed") refreshBleed(fighter, effect.seconds * potency, effect.maxHpPercentPerSecond, events, sourceId);
  if (effect.kind === "poison") {
    // 세기는 바른 쪽에서 나오므로 시전자를 찾지 못하면 바를 것도 없다.
    const attacker = sourceId ? findFighter(state, sourceId) : undefined;
    if (attacker) refreshPoison(fighter, effect.seconds * potency, poisonAmountPerSecond(attacker, fighter, effect, state), events, sourceId);
  }
  if (effect.kind === "overpaint") refreshOverpaint(fighter, { ...effect, seconds: effect.seconds * potency });
  if (effect.kind === "concussion") applyConcussion(fighter, effect, critical, events, state, sourceId);
  if (effect.kind === "butcher") applyButcher(fighter, effect, events, state, sourceId);
  if (effect.kind === "curse") refreshCurse(fighter, { ...effect, seconds: effect.seconds * potency });
  if (effect.kind === "frenzy") applyFrenzy(fighter, { ...effect, seconds: effect.seconds * potency }, sourceId);
}

/**
 * 뇌진탕. 방어력·속성·경감을 모두 지나치는 즉발 고정 피해 한 번이다.
 *
 * 최대 체력 비율로 재는 이유는 출혈과 같다 — 절대값으로 두면 레벨이 오를수록 "헬멧이 울린다"가
 * 아무것도 아닌 수가 된다. 치명타였다면 더 크게 울린다.
 *
 * **날려버림은 뇌진탕의 일부가 아니다.** 이 함수는 피해만 확정하고, 폭주한 파치가 얹는 확정
 * 치명타와 날려버림은 아래 `knockbackSlamOf`가 따로 소유한다 — 다른 개체가 뇌진탕을 갖게
 * 되어도 그 개체가 적을 날리지는 않는다.
 */
function applyConcussion(
  target: Fighter,
  effect: Extract<CombatStatusEffect, { kind: "concussion" }>,
  critical: boolean,
  events: SkirmishEvent[],
  state: SkirmishState,
  sourceId?: string,
): void {
  const attacker = sourceId ? findFighter(state, sourceId) : undefined;
  const slam = attacker ? knockbackSlamOf(attacker) : undefined;
  // 폭주가 확정 치명타를 얹는다. 판정을 다시 굴리지 않아 날아가는 그림과 수치가 갈리지 않는다.
  const struck = critical || slam !== undefined;
  const percent = struck ? effect.criticalMaxHpPercent : effect.maxHpPercent;
  const amount = Math.max(1, Math.round(target.maxHp * percent / 100));
  const dealt = applyDamage(target, amount, events, state);
  events.push({ kind: "concussion", fighterId: target.id, amount: dealt, critical: struck });
  if (!isFighterAlive(target)) {
    clearDefeatedStatuses(target);
    events.push({ kind: "death", fighterId: target.id, sourceId });
    return;
  }
  // 날려버림은 폭주가 얹는 몫이라 뇌진탕이 실제로 울린 뒤에 따로 붙는다.
  if (slam && attacker) launchKnockback(target, attacker, slam, state, events);
}

/** 지금 폭주 중이라 날려버림을 얹는 개체인가. 파치의 폭주만 이 특성을 갖는다. */
function knockbackSlamOf(attacker: Fighter): Extract<FerocityTrait, { effectId: "knockbackSlam" }> | undefined {
  const trait = attacker.def.ferocityTrait;
  return attacker.ferocityFever && trait.effectId === "knockbackSlam" ? trait : undefined;
}

/**
 * 폭주한 파치가 맞은 적을 전장 안에서 튕겨 다니게 만든다.
 *
 * 미리 궤적을 그려 두지 않고 속도만 주는 이유는, 벽에 부딪히는 자리가 그때의 전장 크기와
 * 위치에서 나와야 하기 때문이다 — 좌표를 미리 정해 두면 원정처럼 전장이 다른 화면에서
 * 캐릭터가 벽을 뚫고 나간다.
 */
function launchKnockback(
  target: Fighter,
  attacker: Fighter,
  trait: Extract<FerocityTrait, { effectId: "knockbackSlam" }>,
  state: SkirmishState,
  events: SkirmishEvent[],
): void {
  const dx = target.x - attacker.x;
  const dy = target.y - attacker.y;
  const gap = Math.hypot(dx, dy) || 1;
  target.knockback = {
    remaining: trait.seconds,
    vx: (dx / gap) * trait.speed,
    vy: (dy / gap) * trait.speed,
    bouncesLeft: trait.bounces,
  };
  // 붙어 있던 추적을 끊어야 날아가는 동안 제자리로 되돌아오지 않는다.
  target.engaged = false;
  events.push({ kind: "knockback", fighterId: target.id, seconds: trait.seconds, bounces: trait.bounces });
  // 날려 버린 상대는 이제 사거리 밖이므로 파치도 다음 상대를 찾는다.
  moveToNearestOtherEnemy(attacker, target, state);
}

/**
 * 덧칠을 한 겹 더 올린다.
 *
 * 다시 칠하면 **시간은 처음부터** 다시 돌고 중첩만 하나 오른다 — 오래 유지하려면 계속 칠해야
 * 하므로, 한 번 쌓아 두고 방치하는 것으로는 파티 배율이 유지되지 않는다.
 */
function refreshOverpaint(target: Fighter, effect: Extract<CombatStatusEffect, { kind: "overpaint" }>): void {
  const stacks = Math.min(effect.maxStacks, (target.overpaint?.stacks ?? 0) + 1);
  // `total`은 화면의 시계(남은 시간 고리)가 읽는 분모다. 화면이 스킬 정의를 다시 뒤지지 않는다.
  target.overpaint = { remaining: effect.seconds, total: effect.seconds, stacks, percentPerStack: effect.damageTakenPercent, maxStacks: effect.maxStacks };
}

/**
 * 손질을 한 겹 쌓고, 상한에 닿으면 **그 자리에서 터뜨린다.**
 *
 * 덧칠처럼 쌓아 두었다가 나중에 쓰는 값이 아니라 세 번째 칼질이 곧 결과라, 겹을 올린 프레임에
 * 스스로 터지고 0으로 돌아간다. 터지는 피해는 그 순간 칼을 댄 개체의 공격력에서 나오므로,
 * 겹을 쌓은 사람과 터뜨린 사람이 다르면 **터뜨린 쪽**의 수치를 쓴다.
 */
function applyButcher(
  target: Fighter,
  effect: Extract<CombatStatusEffect, { kind: "butcher" }>,
  events: SkirmishEvent[],
  state: SkirmishState,
  sourceId?: string,
): void {
  const stacks = (target.butcher?.stacks ?? 0) + 1;
  target.butcher = { stacks, maxStacks: effect.maxStacks, burstPower: effect.burstPower };
  if (stacks < effect.maxStacks) return;
  target.butcher = { stacks: 0, maxStacks: effect.maxStacks, burstPower: effect.burstPower };

  const attacker = sourceId ? findFighter(state, sourceId) : undefined;
  if (!attacker) return;
  const raw = Math.max(1, Math.round(computeDamage(
    { ...attacker, def: offensiveDefinition(attacker) },
    defensiveDefinition(target, state),
    { power: effect.burstPower, damageType: "physical", scalingStat: "atk", isCritical: false, kind: "basic" },
    true,
  )));
  const resolution = resolveReceivedDamage(target, raw);
  const hpBefore = target.hp;
  applyDamage(target, resolution.applied, events, state);
  const dealt = hpBefore - target.hp;
  events.push({ kind: "butcherBurst", attackerId: attacker.id, fighterId: target.id, amount: resolution.applied });
  // 폭주한 마키는 터진 몫의 일부를 아군 전체의 회복으로 돌린다.
  const feast = attacker.ferocityFever && attacker.def.ferocityTrait.effectId === "butcherFeast"
    ? attacker.def.ferocityTrait : undefined;
  if (feast && dealt > 0) {
    for (const ally of aliveFighters(state, attacker.side)) {
      const healed = applyHealing(state, ally, dealt * feast.healPercent / 100, attacker.id);
      if (healed > 0) events.push({ kind: "heal", fighterId: ally.id, amount: healed, source: "passive", effect: { tag: "heal", intensity: 1 } });
    }
  }
  if (!isFighterAlive(target)) {
    clearDefeatedStatuses(target);
    events.push({ kind: "death", fighterId: target.id, sourceId: attacker.id });
  }
}

/**
 * 고품격 식재료의 시계. 전투 첫 프레임과 그 뒤 정해진 간격마다 다시 고른다.
 *
 * 시계는 `huntOpeningSeconds`에서 시작해 첫 도약만 조금 늦춘다 — 0에서 시작하면 첫 프레임에
 * 사라져 플레이어가 전장을 보기도 전에 마키만 다른 자리에 서 있다. "전투 시작 시"를 따로
 * 분기하지 않아도 같은 코드 하나가 시작과 재발동을 모두 맡는다. 적을 처치하면 그 자리에서
 * 0으로 되돌려 다음 프레임에 바로 다음 식재료를 고르러 간다.
 */
function tickGourmetHunt(fighter: Fighter, dt: number, state: SkirmishState): void {
  const passive = fighter.def.passive;
  if (passive.kind !== "gourmetHunt" || fighter.stunnedFor > 0 || fighter.knockback) return;
  fighter.huntCooldown -= dt;
  if (fighter.huntCooldown > 0) return;
  fighter.huntCooldown = passive.huntCooldownSeconds ?? 10;
  // 자리를 옮기는 것 자체가 화면에서 보이는 신호라 따로 표시 사건을 만들지 않는다.
  leapToLowestHpEnemy(fighter, state, fighterReach(fighter) * 0.8);
}

/**
 * 고품격 식재료. 지금 가장 약해진 적으로 표적을 갈아타며 그 자리로 뛴다.
 *
 * 잠행(스피나)과 같은 자리 계산을 쓰되 은신은 걸지 않는다 — 마키는 숨는 것이 아니라 **가장 잘
 * 익은 것을 고르러 가는** 개체라, 표적 선택 그 자체가 이 패시브의 전부다.
 */
function leapToLowestHpEnemy(fighter: Fighter, state: SkirmishState, landingDistance: number): Fighter | undefined {
  // 현재 HP 비율, 절대 HP, 배열 순서로 최저 체력 적을 결정해 리플레이를 안정적으로 유지한다.
  const target = state.fighters.filter((other) => other.side !== fighter.side && isFighterAlive(other))
    .map((other, index) => ({ other, index }))
    .sort((a, b) => a.other.hp / a.other.maxHp - b.other.hp / b.other.maxHp || a.other.hp - b.other.hp || a.index - b.index)[0]?.other;
  if (!target) return undefined;
  const dx = fighter.x - target.x; const dy = fighter.y - target.y; const gap = Math.hypot(dx, dy) || 1;
  fighter.x = Math.min(state.arena.right, Math.max(state.arena.left, target.x + dx / gap * landingDistance));
  fighter.y = Math.min(state.arena.bottom, Math.max(state.arena.top, target.y + dy / gap * landingDistance));
  fighter.targetId = target.id;
  // `engaged`는 매 프레임 거리로 다시 정하므로 여기서 건드리지 않는다 — 손대면 착지한 프레임에
  // 다시 달려들어 착지 거리 자체가 어긋난다.
  return target;
}

/** 지금 이 대상이 받는 피해를 몇 배로 키우는지. 화면과 계산이 같은 한 곳에서 읽는다. */
export function overpaintMultiplier(target: Fighter): number {
  const overpaint = target.overpaint;
  if (!overpaint || overpaint.remaining <= 0) return 1;
  return 1 + overpaint.stacks * overpaint.percentPerStack / 100;
}

/** 한 스킬이 선언한 상태를 생존한 한 적중 대상에게 공용 저항·UI 사건 경로로 적용한다. */
function applySkillStatuses(target: Fighter, skill: Skill, events: SkirmishEvent[], state: SkirmishState, sourceId?: string, critical = false): void {
  // 피해로 쓰러진 대상에는 지속 상태나 UI 뱃지를 새로 만들지 않는다.
  if (!isFighterAlive(target)) return;
  // 뇌진탕처럼 그 타격의 치명타 여부가 수치를 바꾸는 효과가 있어 판정 결과를 함께 넘긴다.
  for (const effect of skill.statusEffects ?? []) applyCombatStatusEffect(target, effect, events, state, sourceId, critical);
}

/**
 * 이번 타격이 상태 효과를 거는 차례인가.
 *
 * `statusEffectEvery`가 없으면 늘 건다. 있으면 **실제로 나간 기본 공격만** 세어 그 주기에만
 * 건다 — 궁극기는 제 상태를 스스로 걸고 이 셈을 건드리지 않는다. 파치의 배트가 네 번째에만
 * 헬멧을 울리는 규칙이 이것 하나다.
 */
function statusEffectsLandThisHit(attacker: Fighter, skill: Skill, useUltimate: boolean): boolean {
  const every = useUltimate ? undefined : attacker.def.basic.statusEffectEvery;
  if (every === undefined || (skill.statusEffects?.length ?? 0) === 0) return true;
  attacker.statusHitCount += 1;
  if (attacker.statusHitCount < every) return false;
  attacker.statusHitCount = 0;
  return true;
}

/**
 * 이번 타격이 주기가 채워지는 그 한 방인가 — **세지 않고 보기만 한다.**
 *
 * 주기를 실제로 넘기는 것은 피해가 끝난 뒤의 `statusEffectsLandThisHit` 하나뿐이므로, 피해를
 * 짓는 자리에서는 다음 값을 내다보기만 한다. 여기서 함께 세면 한 행동이 두 걸음을 삼켜
 * 셋째 뿔이 영영 오지 않는다.
 */
function completesStatusCycle(attacker: Fighter, skill: Skill, useUltimate: boolean): boolean {
  const every = useUltimate ? undefined : attacker.def.basic.statusEffectEvery;
  if (every === undefined || (skill.statusEffects?.length ?? 0) === 0) return false;
  return attacker.statusHitCount + 1 >= every;
}

/**
 * 이번 공격 행동이 낼 기본 공격. 순환이 없으면 정의된 그대로다.
 *
 * **읽기만 하고 걸음을 넘기지 않는다** — 한 행동 안에서 `strike`와 `strikeAreaAttack`이 각각
 * 부르므로, 여기서 넘기면 같은 한 방이 두 걸음을 소비한다. 걸음은 행동이 끝난 자리에서
 * `advanceBasicCycle`이 한 번만 넘긴다.
 */
function currentBasic(attacker: Fighter): BasicAttack {
  const basic = attacker.def.basic;
  const cycle = basic.cycle;
  if (!cycle || cycle.length === 0) return basic;
  const step = cycle[attacker.basicCycleStep % cycle.length];
  // 선언하지 않은 필드는 비운다. 기본 공격 쪽 값이 새어 들어오면 어느 걸음이 무엇을 하는지
  // 데이터만 보고 알 수 없다.
  return {
    ...basic,
    name: step.name,
    power: step.power,
    targeting: step.targeting ?? "single",
    radius: step.radius,
    statusEffects: step.statusEffects,
    damageHealingPercent: step.damageHealingPercent,
  };
}

/**
 * 이번 걸음이 실제로 깎은 HP의 일부를 시전자의 보호막으로 돌린다.
 *
 * 흡혈과 같은 자리에서 같은 값(과잉 피해를 뺀 실제 HP 손실)을 읽는다 — 때린 만큼 단단해지는
 * 규칙이라 공격력이 곧 생존력이 되고, 그래서 탱커가 공격 능력치를 올릴 이유가 생긴다.
 */
function grantShieldFromDamage(attacker: Fighter, dealt: number, events: SkirmishEvent[]): void {
  const percent = currentBasicStep(attacker)?.shieldFromDamagePercent ?? 0;
  if (percent <= 0 || dealt <= 0 || !isFighterAlive(attacker)) return;
  const amount = Math.max(1, Math.round(dealt * percent / 100));
  attacker.shield.amount += amount;
  attacker.shield.providerId = attacker.id;
  events.push({ kind: "shieldGranted", fighterId: attacker.id, providerId: attacker.id, amount, remaining: attacker.shield.amount, effect: { tag: "shieldGain", intensity: 1 } });
}

/**
 * 「고통의 희열」 — 맞은 그 순간 겹이 하나 오른다.
 *
 * **공격에 맞았을 때만 오른다.** 출혈·중독처럼 시간이 깎는 피해까지 세면 겹이 저절로 차올라
 * "앞에 서서 맞고 있다"가 아니라 "가만히 있어도 단단해진다"가 된다.
 *
 * **터지지 않는다.** 상한에 닿으면 그 자리에 머물 뿐이고, 겹을 비우는 것은 시간뿐이다 —
 * 덧칠·저주와 같은 축이고 손질과는 다르다. 겹 하나하나가 곧 방어·저항이라 채워 두는 것이
 * 목적이지, 채워서 다른 일을 터뜨리는 것이 아니다.
 */
function gainElation(target: Fighter): void {
  const plan = target.def.passive.elation;
  if (target.def.passive.kind !== "painfulElation" || plan === undefined || !isFighterAlive(target)) return;
  target.elation = {
    stacks: Math.min(plan.maxStacks, (target.elation?.stacks ?? 0) + 1),
    remaining: plan.seconds,
    total: plan.seconds,
    regenPercentPerStack: plan.maxHpRegenPercentPerStack,
    maxStacks: plan.maxStacks,
    // 겹이 새로 쌓여도 남은 틱은 이어 간다 — 맞을 때마다 초기화하면 재생이 영영 돌지 않는다.
    tickIn: target.elation?.tickIn ?? 1,
  };
}

/** 희열이 도는 동안 매초 흐르는 재생. 겹이 많을수록 한 번에 더 많이 돌아온다. */
function tickElationRegen(fighter: Fighter, dt: number, state: SkirmishState, events: SkirmishEvent[]): void {
  const elation = fighter.elation;
  if (!elation || elation.regenPercentPerStack <= 0) return;
  const tickIn = elation.tickIn - dt;
  if (tickIn > 0) { fighter.elation = { ...elation, tickIn }; return; }
  fighter.elation = { ...elation, tickIn: tickIn + 1 };
  const amount = applyHealing(state, fighter, fighter.maxHp * elation.stacks * elation.regenPercentPerStack / 100, fighter.id);
  if (amount > 0) events.push({ kind: "heal", fighterId: fighter.id, amount, source: "passive", effect: { tag: "heal", intensity: 1 } });
}

/** 희열은 맞지 않으면 식는다. 다시 맞을 때마다 `gainElation`이 시간을 처음부터 되돌린다. */
function tickElation(fighter: Fighter, dt: number): void {
  const elation = fighter.elation;
  if (!elation) return;
  const remaining = elation.remaining - dt;
  fighter.elation = remaining <= EMERGENCY_RECOVERY.epsilon ? null : { ...elation, remaining };
}

/**
 * 앞에 서기를 켠다. **슬롯은 하나뿐이다.**
 *
 * 두 겹으로 쌓으면 같은 한 방이 두 번 나뉘어 아군이 실제로 받는 몫이 화면과 갈린다. 지금은
 * 켜는 곳이 「고통의 미학」 하나뿐이라 다시 켜면 그대로 덮어쓴다 — 둘째 원천이 생기면 여기서
 * 어느 쪽이 남는지부터 정한다.
 */
function raiseBulwark(
  fighter: Fighter,
  plan: { seconds: number; percent: number; regenPercentPerSecond: number; skillId: string; name: string },
): void {
  fighter.bulwark = {
    remaining: plan.seconds,
    total: plan.seconds,
    percent: plan.percent,
    regenPercentPerSecond: plan.regenPercentPerSecond,
    // 켜는 순간부터 한 박자 뒤에 첫 회복이 돈다 — 걸자마자 한 번 주면 시간이 짧을수록 이득이다.
    tickIn: 1,
    skillId: plan.skillId,
    name: plan.name,
  };
}

/**
 * 앞에 서 있는 **동안** 매초 회복이 돈다.
 *
 * 끝난 뒤에 몰아서 돌려주지 않는 이유는, 대신 받는 그 시간을 버텨 내는 것이 이 궁극기이기
 * 때문이다 — 끝나고 받으면 그 사이에 쓰러진다.
 */
function tickBulwark(fighter: Fighter, dt: number, state: SkirmishState, events: SkirmishEvent[]): void {
  const bulwark = fighter.bulwark;
  if (!bulwark) return;
  const remaining = bulwark.remaining - dt;
  if (remaining > EMERGENCY_RECOVERY.epsilon) {
    const tickIn = bulwark.tickIn - dt;
    if (tickIn > 0) { fighter.bulwark = { ...bulwark, remaining, tickIn }; return; }
    fighter.bulwark = { ...bulwark, remaining, tickIn: tickIn + 1 };
    const healed = applyHealing(state, fighter, fighter.maxHp * bulwark.regenPercentPerSecond / 100, fighter.id);
    if (healed > 0) events.push({ kind: "heal", fighterId: fighter.id, amount: healed, source: "ultimate", effect: { tag: "heal", intensity: 1.65 } });
    return;
  }
  fighter.bulwark = null;
}

/**
 * 「절정」의 자기 기본 공격 회복. 잃은 체력 비례라 아플수록 많이 돌아온다.
 *
 * 최대 체력 비례로 두면 멀쩡할 때 가장 많이 회복해 성질이 거꾸로 선다 — 앞에 서서 다 맞는
 * 개체라 아플 때 크게 돌아와야 한다.
 */
function healClimaxBasic(attacker: Fighter, state: SkirmishState, events: SkirmishEvent[]): void {
  const trait = attacker.def.ferocityTrait;
  if (!attacker.ferocityFever || trait.effectId !== "climax") return;
  const amount = applyHealing(state, attacker, (attacker.maxHp - attacker.hp) * trait.missingHpPercentPerBasic / 100, attacker.id);
  if (amount > 0) events.push({ kind: "heal", fighterId: attacker.id, amount, source: "ferocity", effect: { tag: "heal", intensity: 1.2 } });
}

/**
 * 「절정」의 주위 지속 피해. 폭주 중에는 서 있는 것만으로 주위가 지져진다.
 *
 * 최대 체력 비례 **고정 피해**라 방어를 지나간다 — 공격력을 아예 쓰지 않는 개체라 자기 몸이
 * 곧 화력이고, 그래서 체력을 올리는 것이 공격을 올리는 것이 된다. 폭주가 아닐 때 시계를 1로
 * 되돌리는 이유는, 그러지 않으면 폭주에 들어가는 첫 프레임에 한 번이 공짜로 터지기 때문이다.
 */
function tickClimaxAura(fighter: Fighter, dt: number, state: SkirmishState, events: SkirmishEvent[]): void {
  const trait = fighter.def.ferocityTrait;
  if (trait.effectId !== "climax") return;
  if (!fighter.ferocityFever) { fighter.climaxAuraTickIn = 1; return; }
  const tickIn = fighter.climaxAuraTickIn - dt;
  if (tickIn > 0) { fighter.climaxAuraTickIn = tickIn; return; }
  fighter.climaxAuraTickIn = tickIn + 1;
  const amount = Math.max(1, Math.round(fighter.maxHp * trait.auraDamageMaxHpPercent / 100));
  for (const other of state.fighters) {
    if (other.side === fighter.side || !isFighterAlive(other) || distance(fighter, other) > trait.radius) continue;
    const hpBefore = other.hp;
    applyDamage(other, amount, events, state);
    addContribution(state.contributions, fighter.id, "attack", hpBefore - other.hp, "attackPower");
    // 휘두르지 않고 서 있기만 하므로 시전 모션을 틀지 않는다(`animate: false`).
    events.push({ kind: "attack", attackerId: fighter.id, targetId: other.id, skill: "basic", amount,
      contributionAmount: amount, critical: false, animate: false, damageType: "true" });
    if (!isFighterAlive(other)) {
      clearDefeatedStatuses(other);
      events.push({ kind: "death", fighterId: other.id, sourceId: fighter.id });
    }
  }
}

/**
 * 궁극기가 건 은신을 기본 공격 한 번으로 푼다. 패시브의 전투 시작 은신은 건드리지 않는다.
 *
 * 시간만으로 끊으면 혼자 남은 판에서 아무도 자신을 고르지 못하는 채로 계속 때리게 되어
 * 짧은 무적과 다르지 않다 — 그래서 **행동 하나**를 노출의 값으로 쓴다.
 */
function breakStealthOnBasic(fighter: Fighter): void {
  if (!fighter.stealthBreaksOnBasic) return;
  fighter.stealthFor = 0;
  fighter.stealthBreaksOnBasic = false;
}

/** 도발은 시간이 지나면 저절로 풀린다. 방향만 바꾸는 상태라 정화의 대상이 아니다. */
function tickTaunt(fighter: Fighter, dt: number): void {
  const taunted = fighter.taunted;
  if (!taunted) return;
  const remaining = taunted.remaining - dt;
  fighter.taunted = remaining <= EMERGENCY_RECOVERY.epsilon ? null : { ...taunted, remaining };
}

/**
 * 이 걸음이 적을 날려버리는가. 파치의 폭주와 같은 궤적 규칙을 쓰되 **주체가 다르다** —
 * 파치는 폭주해야 날리고, 순환의 마지막 걸음은 세 번마다 반드시 날린다.
 */
function pullStruck(attacker: Fighter, target: Fighter, state: SkirmishState, events: SkirmishEvent[]): void {
  const plan = currentBasicStep(attacker)?.pull;
  if (!plan || !isFighterAlive(target)) return;
  // 끌어당김은 「인(引)」과 같은 규칙이다 — 보간 없이 같은 프레임에 자리를 옮기므로 이동
  // 속도의 영향을 받지 않고, 끌려온 자리는 시전자에게서 정해진 거리다.
  const dx = target.x - attacker.x; const dy = target.y - attacker.y; const gap = Math.hypot(dx, dy) || 1;
  target.x = Math.min(state.arena.right, Math.max(state.arena.left, attacker.x + dx / gap * plan.distance));
  target.y = Math.min(state.arena.bottom, Math.max(state.arena.top, attacker.y + dy / gap * plan.distance));
  target.engaged = false;
  events.push({ kind: "combatEffect", fighterId: target.id, effect: { tag: "shieldHit", intensity: 1 } });
}

/** 지금 걸음의 원본 계약. 걸음만 갖는 값(보호막 전환 등)을 읽을 때 쓴다. */
function currentBasicStep(attacker: Fighter): BasicAttackStep | undefined {
  const cycle = attacker.def.basic.cycle;
  if (!cycle || cycle.length === 0) return undefined;
  return cycle[attacker.basicCycleStep % cycle.length];
}

/** 한 공격 행동이 끝난 자리에서 다음 걸음으로 넘긴다. 연격의 개별 적중은 넘기지 않는다. */
function advanceBasicCycle(attacker: Fighter): void {
  const cycle = attacker.def.basic.cycle;
  if (cycle && cycle.length > 0) attacker.basicCycleStep = (attacker.basicCycleStep + 1) % cycle.length;
}

/** 청산하는 타격이 쓰는 사본. 같은 타격이 독을 바르면서 동시에 터뜨리지 않게 한다. */
function withoutPoison(skill: Skill): Skill {
  return { ...skill, statusEffects: (skill.statusEffects ?? []).filter((effect) => effect.kind !== "poison") };
}

/** 모든 출혈 진입점이 공유하는 단일 슬롯 갱신 규칙이다. 약한 재적용은 강도와 틱 시계를 덮지 않는다. */
export function refreshBleed(target: Fighter, seconds: number, percent: number, events: SkirmishEvent[], sourceId?: string): void {
  const remaining = Math.max(target.bleed?.remaining ?? 0, seconds);
  target.bleed = {
    remaining,
    // 시계의 분모. 더 긴 출혈로 덮이면 그 길이가 곧 새 한 바퀴다.
    total: Math.max(remaining, target.bleed?.total ?? 0, seconds),
    tickIn: target.bleed?.tickIn ?? 1,
    percent: Math.max(target.bleed?.percent ?? 0, percent),
    sourceId: percent >= (target.bleed?.percent ?? 0) ? sourceId : target.bleed?.sourceId,
  };
  events.push({ kind: "bleed", fighterId: target.id, amount: 0, started: true });
}

/**
 * 중독을 바른다. 매 틱 피해는 **바르는 순간의 시전자 능력치**로 굳힌다.
 *
 * 출혈과 달리 세기가 맞은 쪽이 아니라 바른 쪽에서 나오므로, 더 아픈 독으로 덮이면 그 값이
 * 이긴다 — 약한 독이 나중에 발렸다고 이미 발린 독이 묽어지지는 않는다.
 */
function refreshPoison(target: Fighter, seconds: number, amountPerSecond: number, events: SkirmishEvent[], sourceId?: string): void {
  const remaining = Math.max(target.poison?.remaining ?? 0, seconds);
  target.poison = {
    remaining,
    total: Math.max(remaining, target.poison?.total ?? 0, seconds),
    tickIn: target.poison?.tickIn ?? 1,
    amountPerSecond: Math.max(target.poison?.amountPerSecond ?? 0, amountPerSecond),
    sourceId: amountPerSecond >= (target.poison?.amountPerSecond ?? 0) ? sourceId : target.poison?.sourceId,
  };
  events.push({ kind: "poison", fighterId: target.id, amount: 0, started: true });
}

/**
 * 한 틱의 중독 피해. 바른 쪽의 공격력과 주문력에서 각각 뽑아 더한 **마법 피해**다.
 *
 * 출혈과 달리 대상의 저항력과 속성 상성을 그대로 거친다 — 이름이 마법 피해인데 저항이 듣지
 * 않으면 저항 능력치가 거짓말이 된다. 다만 그 계산을 **바르는 순간 한 번만** 하고 값을 굳힌다:
 * 매 틱 다시 계산하면 청산이 몰아 주는 값과 그냥 두었을 때의 총합이 반올림만큼 갈린다.
 */
function poisonAmountPerSecond(attacker: Fighter, target: Fighter, effect: Extract<CombatStatusEffect, { kind: "poison" }>, state: SkirmishState): number {
  return Math.max(1, Math.round(computeDamage(
    { ...attacker, def: offensiveDefinition(attacker) },
    defensiveDefinition(target, state),
    {
      power: effect.attackPercentPerSecond,
      scalingStat: "atk",
      secondaryScaling: { stat: "ap", power: effect.abilityPercentPerSecond },
      damageType: "magical",
      isCritical: false,
    },
    true,
  )));
}

/**
 * 걸린 중독을 1초 간격으로 깎는다. 출혈과 같은 고정 피해 경계다.
 *
 * 남은 시간과 다음 틱까지의 시계를 함께 보는 이유는 **청산**(`liquidatePoison`)이 같은 셈을
 * 거꾸로 쓰기 때문이다 — 두 곳이 "앞으로 몇 번 더 아픈가"를 다르게 세면 몰아서 받은 피해와
 * 그냥 두었을 때의 총합이 갈린다.
 */
function tickPoison(fighter: Fighter, dt: number, state: SkirmishState, events: SkirmishEvent[]): void {
  const poison = fighter.poison;
  if (!poison) return;
  poison.remaining -= dt;
  poison.tickIn -= dt;
  while (poison.tickIn <= 0 && isFighterAlive(fighter)) {
    const amount = receivedDamage(fighter, poison.amountPerSecond);
    const hpBefore = fighter.hp;
    applyDamage(fighter, amount, events, state);
    if (poison.sourceId) addContribution(state.contributions, poison.sourceId, "attack", hpBefore - fighter.hp, "abilityPower");
    events.push({ kind: "poison", fighterId: fighter.id, amount, started: false });
    tryTriggerEmergencyRecovery(fighter); tryTriggerLowHpVanish(fighter, state);
    state.log.push(`${fighter.def.name} 중독 ${amount}`);
    poison.tickIn += 1;
    if (!isFighterAlive(fighter)) {
      clearDefeatedStatuses(fighter);
      events.push({ kind: "death", fighterId: fighter.id, sourceId: poison.sourceId });
      state.log.push(`${fighter.def.name} 전투 불능`);
    }
  }
  if (poison.remaining <= 0 || !isFighterAlive(fighter)) fighter.poison = null;
}

/**
 * 남은 중독을 **한 번에 몰아서** 받게 하고 지운다.
 *
 * 앞으로 실제로 터졌을 틱 수를 그대로 센다 — 남은 시간을 올림하거나 처음 지속시간을 쓰면,
 * 이미 한 틱 아팠던 적이 청산으로 그 몫을 또 맞는다. 그냥 두었을 때의 총합과 같아야 청산이
 * "먼저 받는 것"이지 "더 받는 것"이 되지 않는다.
 */
function liquidatePoison(target: Fighter, state: SkirmishState, events: SkirmishEvent[]): void {
  const poison = target.poison;
  if (!poison) return;
  const pendingTicks = poison.remaining >= poison.tickIn ? Math.floor(poison.remaining - poison.tickIn) + 1 : 0;
  target.poison = null;
  if (pendingTicks <= 0) return;
  const amount = receivedDamage(target, poison.amountPerSecond * pendingTicks);
  const hpBefore = target.hp;
  applyDamage(target, amount, events, state);
  if (poison.sourceId) addContribution(state.contributions, poison.sourceId, "attack", hpBefore - target.hp, "abilityPower");
  events.push({ kind: "poisonLiquidated", fighterId: target.id, amount, ticks: pendingTicks });
  tryTriggerEmergencyRecovery(target); tryTriggerLowHpVanish(target, state);
  state.log.push(`${target.def.name} 중독 청산 ${amount}`);
  if (!isFighterAlive(target)) {
    clearDefeatedStatuses(target);
    events.push({ kind: "death", fighterId: target.id, sourceId: poison.sourceId });
    state.log.push(`${target.def.name} 전투 불능`);
  }
}

/**
 * 저주를 한 겹 더 씌우고 시간을 처음부터 다시 돌린다.
 *
 * 덧칠과 같은 갱신 규칙이다 — 중첩은 상한까지 오르고 시간은 매번 새로 센다.
 */
function refreshCurse(target: Fighter, effect: Extract<CombatStatusEffect, { kind: "curse" }>): void {
  const stacks = Math.min(effect.maxStacks, (target.curse?.stacks ?? 0) + 1);
  target.curse = { remaining: effect.seconds, total: effect.seconds, stacks, percentPerStack: effect.resistancePercent, maxStacks: effect.maxStacks };
}

/** 이 적의 저주가 이미 상한에 닿아 있는가. 전이는 **이번 타격이 얹기 전**의 겹으로 판정한다. */
function isCurseMaxed(target: Fighter): boolean {
  return target.curse !== null && target.curse.stacks >= target.curse.maxStacks;
}

/**
 * 광란을 건다. **이미 광란 중이면 연장하지 않고 갱신만** 한다.
 *
 * 폭주 중 기본 공격마다 다시 걸리므로, 연장하면 짧은 상태가 사실상 상시 광란이 된다.
 * 표적은 다음 판정에서 다시 고르도록 비운다 — 남겨 두면 뒤집히기 전의 상대를 계속 때린다.
 */
function applyFrenzy(target: Fighter, effect: Extract<CombatStatusEffect, { kind: "frenzy" }>, sourceId?: string): void {
  target.frenzy = {
    remaining: effect.seconds,
    total: Math.max(effect.seconds, target.frenzy?.total ?? 0),
    attackSpeedPercent: effect.attackSpeedPercent,
    sourceId: sourceId ?? target.frenzy?.sourceId,
  };
  target.targetId = null;
}

/**
 * 저주가 최대인 적을 때렸을 때 이어지는 전이 사슬.
 *
 * 사슬은 **같은 적을 두 번 고르지 않아** 살아 있는 적 수에서 저절로 끝난다. 비율이 곱해지며
 * 줄어들어 피해는 두세 번이면 미미해지므로, 이어지는 몫은 피해가 아니라 저주를 퍼뜨리는 것이다.
 * 전이된 타격은 흡혈·야성·패시브 누적·폭주 광란을 부르지 않는다 — 한 번의 공격이 사슬 길이만큼
 * 값을 벌면 사거리 하나로 전투가 갈린다.
 */
function spreadCurseTransfer(
  attacker: Fighter,
  primary: Fighter,
  primaryWasMaxed: boolean,
  dealt: number,
  state: SkirmishState,
  events: SkirmishEvent[],
): void {
  const transfer = attacker.def.basic.curseTransfer;
  if (!transfer || !primaryWasMaxed || dealt <= 0) return;
  const curse = attacker.def.basic.statusEffects?.find((effect) => effect.kind === "curse");
  const struck = new Set<string>([primary.id]);
  let origin = primary;
  let carried = dealt;
  for (;;) {
    const secondary = state.fighters
      .filter((other) => other.side !== attacker.side && !struck.has(other.id) && isFighterAlive(other) && other.stealthFor <= 0)
      .reduce<Fighter | undefined>((nearest, other) => !nearest || distance(origin, other) < distance(origin, nearest) ? other : nearest, undefined);
    if (!secondary) return;
    const requested = carried * transfer.percent / 100;
    // 1도 되지 않는 몫까지 이으면 사슬이 숫자만 남기고 화면을 채운다.
    if (requested < 1) return;
    const wasMaxed = isCurseMaxed(secondary);
    const resolution = resolveReceivedDamage(secondary, requested);
    const hpBefore = secondary.hp;
    const applied = applyDamage(secondary, resolution.applied, events, state);
    addContribution(state.contributions, attacker.id, "attack", hpBefore - secondary.hp, "attackPower");
    // 전이는 확정된 피해를 그대로 옮기므로 방어·저항·상성을 다시 거치지 않는 고정 피해다.
    events.push({ kind: "attack", attackerId: attacker.id, targetId: secondary.id, skill: "transfer", amount: applied,
      contributionAmount: hpBefore - secondary.hp, critical: false, animate: false,
      damageType: "true", mitigated: resolution.reduced < resolution.raw });
    if (resolution.ignored) events.push({ kind: "damageIgnored", attackerId: attacker.id, targetId: secondary.id });
    if (curse && isFighterAlive(secondary)) applyCombatStatusEffect(secondary, curse, events, state, attacker.id);
    if (!isFighterAlive(secondary)) {
      clearDefeatedStatuses(secondary);
      events.push({ kind: "death", fighterId: secondary.id, sourceId: attacker.id });
    }
    struck.add(secondary.id);
    // 이번에 맞은 적도 이미 최대였을 때만 사슬이 이어진다. 이번 타격으로 가득 찬 적에서는 끊긴다.
    if (!wasMaxed || !isFighterAlive(secondary)) return;
    origin = secondary;
    carried = hpBefore - secondary.hp;
  }
}

/** 저주가 깎아 주는 저항 비율(%). 없으면 0이다. */
export function curseResistanceShred(target: Fighter): number {
  const curse = target.curse;
  if (!curse || curse.remaining <= 0) return 0;
  return Math.min(100, curse.stacks * curse.percentPerStack);
}

/** 사망한 전투원에게서 이후 되살아날 수 있는 전투 한정 지속 상태를 한곳에서 정리한다. */
function clearDefeatedStatuses(fighter: Fighter): void {
  fighter.targetId = null;
  fighter.bleed = null;
  fighter.poison = null;
  fighter.undying = null;
  fighter.undyingPending = false;
  fighter.taunted = null;
  fighter.elation = null;
  fighter.bulwark = null;
  fighter.overpaint = null;
  fighter.curse = null;
  fighter.frenzy = null;
  fighter.knockback = null;
  fighter.butcher = null;
  fighter.regeneration = null;
  fighter.stunnedFor = 0;
  fighter.staggeredFor = 0;
}

/** 한쪽 편에서 살아 있는 캐릭터만 고른다. */
export function aliveFighters(state: SkirmishState, side: Side): Fighter[] {
  return state.fighters.filter((fighter) => fighter.side === side && isFighterAlive(fighter));
}

/** 편별 남은 체력 합계. 화면과 테스트가 전황을 한 숫자로 볼 때 쓴다. */
export function teamHp(state: SkirmishState, side: Side): number {
  return state.fighters
    .filter((fighter) => fighter.side === side)
    .reduce((total, fighter) => total + fighter.hp, 0);
}

export function findFighter(state: SkirmishState, id: string): Fighter | undefined {
  return state.fighters.find((fighter) => fighter.id === id);
}

/**
 * 같은 표적을 사냥하는 생존 아군에게 적용되는 루카 폭주 오라를 계산한다.
 * 조건부 오라는 종료 시각이 없으므로 UI를 위해 가짜 남은 시간을 만들지 않고 `conditional`로 반환한다.
 */
export function activePackHuntBuffs(state: SkirmishState, targetFighterId: string): ActiveCombatBuff[] {
  const target = findFighter(state, targetFighterId);
  if (!target || !isFighterAlive(target) || !target.targetId) return [];

  return state.fighters
    .filter((source) => source.side === target.side && isFighterAlive(source) && source.ferocityFever
      && source.targetId === target.targetId && source.def.ferocityTrait.effectId === "packHunt")
    .map((source) => ({
      // 런타임 제공자 ID를 포함해 같은 렐릭이 여럿이어도 UI 키가 충돌하지 않게 한다.
      id: `luka-passive:${source.id}:${target.id}`,
      sourceFighterId: source.id,
      targetFighterId: target.id,
      skillId: "luka-passive",
      name: "무리 사냥",
      description: `같은 표적을 공격하는 동안 공격 속도 ${source.def.ferocityTrait.effectId === "packHunt" ? source.def.ferocityTrait.sharedTargetAttackSpeedPercent : 0}% 증가`,
      timing: { kind: "conditional" as const },
    }));
}

/**
 * 한 전투원에게 현재 적용된 버프만 돌려주는 순수 셀렉터다.
 * 야성 폭주는 게이지가 초당 일정하게 소모되므로 남은/전체 시간을 게이지에서 직접 환산해 UI의 공식 복제를 막는다.
 */
export function activeCombatBuffs(state: SkirmishState, fighterId: string): ActiveCombatBuff[] {
  const fighter = findFighter(state, fighterId);
  if (!fighter || !isFighterAlive(fighter)) return [];

  const buffs = activePackHuntBuffs(state, fighterId);
  if (fighter.ferocityFever && fighter.def.ferocityTrait.effectId === "crescendoStaccato") {
    buffs.push({
      id: `crescendo-staccato:${fighter.id}`,
      sourceFighterId: fighter.id,
      targetFighterId: fighter.id,
      skillId: "crescendoStaccato",
      name: fighter.def.ferocityTrait.name,
      description: "폭주 중 아군의 기본 공격 적중에 스타카토 추가타를 연주",
      timing: {
        kind: "ferocity",
        remainingSeconds: fighter.ferocity / FEROCITY_RULES.feverDrainPerSecond,
        totalSeconds: FEROCITY_RULES.max / FEROCITY_RULES.feverDrainPerSecond,
      },
    });
  }
  if (fighter.bulwark) {
    buffs.push({
      id: `bulwark:${fighter.id}`,
      sourceFighterId: fighter.id,
      targetFighterId: fighter.id,
      skillId: fighter.bulwark.skillId,
      name: fighter.bulwark.name,
      description: `아군이 받는 피해의 ${fighter.bulwark.percent}%를 대신 받고 매초 최대 체력의 ${fighter.bulwark.regenPercentPerSecond}% 회복`,
      timing: { kind: "timed", remainingSeconds: fighter.bulwark.remaining, totalSeconds: fighter.bulwark.total },
    });
  }
  if (fighter.elation) {
    buffs.push({
      id: `elation:${fighter.id}`,
      sourceFighterId: fighter.id,
      targetFighterId: fighter.id,
      skillId: fighter.def.passive.id,
      name: fighter.def.passive.name,
      description: `한 겹마다 매초 최대 체력의 ${fighter.elation.regenPercentPerStack}% 회복 · 최대 ${fighter.elation.maxStacks}겹`,
      stacks: fighter.elation.stacks,
      timing: { kind: "timed", remainingSeconds: fighter.elation.remaining, totalSeconds: fighter.elation.total },
    });
  }
  if (fighter.undying) {
    buffs.push({
      id: `undying:${fighter.id}`,
      sourceFighterId: fighter.id,
      targetFighterId: fighter.id,
      skillId: fighter.def.passive.id,
      name: fighter.def.passive.name,
      description: "모든 피해를 받지 않고 아무 행동도 하지 못한다",
      timing: { kind: "timed", remainingSeconds: fighter.undying.remaining, totalSeconds: fighter.undying.total },
    });
  }
  // 주기 타격(파치의 4타)은 **본인에게 붙는 값**이다 — 적이 아니라 그 개체가 몇 대째 때렸는지가
  // 다음 한 방을 정하므로, 적 머리 위가 아니라 자기 프로필의 칩이 그 수를 들고 있다.
  const every = fighter.def.basic.statusEffectEvery ?? 0;
  if (every > 1 && fighter.statusHitCount % every > 0) {
    buffs.push({
      id: `hit-count:${fighter.id}`,
      sourceFighterId: fighter.id,
      targetFighterId: fighter.id,
      skillId: fighter.def.basic.id,
      name: fighter.def.basic.statusEffectStackName ?? fighter.def.basic.name,
      description: `${every}번째 공격마다 부가 효과가 함께 터진다`,
      stacks: fighter.statusHitCount % every,
      // 시간이 아니라 타격 수가 채우는 값이라 시계를 두지 않는다.
      timing: { kind: "conditional" },
    });
  }
  return buffs;
}

/** 공격 속도가 정하는 공격 간격(초). 100이 기준이다. */
export function currentAttackSpeed(fighter: Fighter, state?: SkirmishState): number {
  // 전투의 환희 누적과 영구 패시브만 포함한다. 폭주처럼 시간이 정해진 임시 배율은 궁극기 계수에서 제외한다.
  const passiveSpeedPoints = fighter.def.passive.kind === "battleMaidMastery"
    ? fighter.def.passive.attackSpeedPercent ?? 0 : 0;
  const teamPercent = state ? Math.max(0, ...state.fighters.filter((ally) => ally.side === fighter.side && isFighterAlive(ally)
    && ally.def.passive.kind === "adagioWeight").map((ally) => ally.def.passive.teamAttackSpeedPercent ?? 0)) : 0;
  // 적용 여부는 HUD와 공유하는 순수 셀렉터가 판정하고, 복수 제공자의 수치는 기존 오라 정책대로 최댓값만 쓴다.
  const packHuntPercent = state ? Math.max(0, ...activePackHuntBuffs(state, fighter.id).map((buff) => {
    const source = findFighter(state, buff.sourceFighterId);
    return source?.def.ferocityTrait.effectId === "packHunt" ? source.def.ferocityTrait.sharedTargetAttackSpeedPercent : 0;
  })) : 0;
  // 순풍은 시간이 정해진 팀 강화라 아다지오·무리 사냥과 같은 자리에서 곱한다.
  const tailwindPercent = fighter.tailwindFor > 0 ? fighter.tailwind?.attackSpeedPercent ?? 0 : 0;
  // 광란은 남의 손에 걸린 강화다. 시간이 정해진 배율이라 순풍과 같은 자리에서 곱한다.
  const frenzyPercent = fighter.frenzy?.attackSpeedPercent ?? 0;
  return (fighter.def.stats.attackSpeed + passiveSpeedPoints + fighter.bonusAttackSpeed)
    * (1 + teamPercent / 100) * (1 + packHuntPercent / 100) * (1 + tailwindPercent / 100) * (1 + frenzyPercent / 100);
}

export function attackInterval(fighter: Fighter, state?: SkirmishState): number {
  const trait = fighter.def.ferocityTrait;
  // 공격 속도는 이미 백분율 척도인 추가 능력치이므로 패시브 수치를 퍼센트포인트로 더한다.
  // 개별 공속은 공용 야성 피해 보너스를 다시 건드리지 않고 재사용 대기시간에만 곱한다.
  const feverMultiplier = fighter.ferocityFever && trait.effectId === "attackIntervalReduction"
    ? 1 - trait.reductionPercent / 100
    : fighter.ferocityFever && trait.effectId === "splashDamage" && trait.attackSpeedBonusPercent !== undefined
      // 공격 속도 +20%는 공격 간격 -20%와 다르므로 증가된 속도로 간격을 나눈다.
      ? 1 / (1 + trait.attackSpeedBonusPercent / 100)
      : fighter.ferocityFever && trait.effectId === "selfAttackSpeedMultiplier"
        // +100%는 공격 속도 x2이고, 속도의 역수인 공격 간격은 정확히 50%가 된다.
        ? 1 / (1 + trait.bonusPercent / 100)
      : fighter.ferocityFever && trait.effectId === "adamantBody" && fighter.hastenedAttacksLeft > 0
        // 남은 횟수가 있을 때만 빨라진다. 다 쓰면 방어 상승만 남는다.
        ? 1 / (1 + trait.attackSpeedPercent / 100)
      : fighter.ferocityFever && trait.effectId === "venomousEncore"
        // 바르고 터뜨리기를 번갈아 하는 손이라 속도가 곧 그 주기다. 같은 역수 규칙을 쓴다.
        ? 1 / (1 + trait.attackSpeedBonusPercent / 100)
      : 1;
  return Math.max(SKIRMISH.minimumAttackInterval, ((SKIRMISH.attackInterval * 100) / Math.max(1, currentAttackSpeed(fighter, state))) * feverMultiplier);
}

/** 같은 오라는 합산하지 않고 생존 제공자 중 최댓값 하나만 적용해 다중 도디 편성 폭증을 막는다. */
function strongestLivingAura(state: SkirmishState, receiverSide: Side, field: "teamDefenseResistancePercent" | "enemyHealingReceivedReductionPercent"): number {
  return Math.max(0, ...state.fighters
    .filter((provider) => isFighterAlive(provider) && provider.def.passive.kind === "guardianNestAura"
      && (field === "teamDefenseResistancePercent" ? provider.side === receiverSide : provider.side !== receiverSide))
    .map((provider) => provider.def.passive[field] ?? 0));
}

/** 피해 공식에만 생존 오라의 방어력·저항력 배율을 투영하고 원본 정적 정의는 변경하지 않는다. */
export function defensiveDefinition(target: Fighter, state: SkirmishState): Fighter {
  const bonus = strongestLivingAura(state, target.side, "teamDefenseResistancePercent");
  // 저주는 저항만 깎는다. 오라와 같은 자리에서 곱해야 "올려 주는 것"과 "깎는 것"이 한 번씩만 든다.
  const shred = 1 - curseResistanceShred(target) / 100;
  if (bonus <= 0 && shred === 1 && target.augmentDefensePercent === 0 && target.augmentResistancePercent === 0) return target;
  return { ...target, def: { ...target.def, stats: { ...target.def.stats,
    def: target.def.stats.def * (1 + bonus / 100) * (1 + target.augmentDefensePercent / 100),
    res: target.def.stats.res * (1 + bonus / 100) * (1 + target.augmentResistancePercent / 100) * shred,
  } } };
}

/** 적중·치명타·처치·저체력 훅의 구조화 payload를 기존 피해·회복·상태 경계에 연결한다. */
function triggerCombatAugments(state: SkirmishState, owner: Fighter, trigger: ExpeditionAugmentTrigger, events: SkirmishEvent[], hitTarget?: Fighter): void {
  for (const { effect, key } of triggeredAugments(state, owner, trigger)) {
    const payload = effect.payload;
    if (payload.kind === "ultimateCostReduction" || payload.kind === "shield") continue;
    if (payload.kind === "lowHpDefense") {
      const hpPercent = owner.maxHp > 0 ? owner.hp / owner.maxHp * 100 : 0;
      if (hpPercent > payload.belowHpPercent || !consumeAugmentTrigger(state, owner, key, effect)) continue;
      owner.augmentDefensePercent = Math.min(payload.defensePercent * effect.limits.maxStacks, owner.augmentDefensePercent + payload.defensePercent);
      owner.augmentResistancePercent = Math.min(payload.resistancePercent * effect.limits.maxStacks, owner.augmentResistancePercent + payload.resistancePercent);
      continue;
    }
    const target = effect.limits.target === "self" ? owner : hitTarget;
    // 죽은 적에게 상태나 추가 피해를 남기지 않는 것은 모든 적중형 payload의 공통 불변식이다.
    if (!target || !isFighterAlive(target)) continue;
    if (payload.kind === "conditionalBonusDamage") {
      const qualified = payload.requiresStatus === "curse" ? target.curse !== null : target.stunnedFor > 0;
      if (!qualified || !consumeAugmentTrigger(state, owner, key, effect)) continue;
      const skill: Skill = { ...owner.def.basic, damageType: payload.damageType, power: payload.percent };
      const raw = Math.max(1, Math.round(computeDamage({ ...owner, def: offensiveDefinition(owner) }, defensiveDefinition(target, state), { ...skill, kind: "basic", isCritical: false }, true)));
      const resolution = resolveReceivedDamage(target, raw); const hpBefore = target.hp; const applied = applyDamage(target, resolution.applied, events, state);
      addContribution(state.contributions, owner.id, "attack", hpBefore - target.hp, payload.damageType === "magical" ? "abilityPower" : "attackPower");
      events.push({ kind: "attack", attackerId: owner.id, targetId: target.id, skill: "transfer", amount: applied, contributionAmount: hpBefore - target.hp, critical: false, animate: false, damageType: payload.damageType, mitigated: resolution.reduced < resolution.raw });
      if (!isFighterAlive(target)) { clearDefeatedStatuses(target); events.push({ kind: "death", fighterId: target.id, sourceId: owner.id }); }
    } else if (payload.kind === "status" && consumeAugmentTrigger(state, owner, key, effect)) {
      applyCombatStatusEffect(target, payload.status, events, state, owner.id);
    } else if (payload.kind === "heal" && consumeAugmentTrigger(state, owner, key, effect)) {
      const amount = applyHealing(state, target, target.maxHp * payload.maxHpPercent / 100, owner.id);
      if (amount > 0) events.push({ kind: "heal", fighterId: target.id, amount, source: "passive", effect: { tag: "heal", intensity: 1 } });
    }
  }
}

/** 첫 궁극기 비용 감소를 조회만 하거나 실제 시전 시 한 번 소비한다. */
function ultimateCost(state: SkirmishState, fighter: Fighter, consume: boolean): number {
  const candidate = triggeredAugments(state, fighter, "onUltimate").find(({ effect, key }) => effect.payload.kind === "ultimateCostReduction" && (fighter.augmentRuntime[key]?.triggers ?? 0) < effect.limits.maxTriggers);
  if (!candidate || candidate.effect.payload.kind !== "ultimateCostReduction") return fighter.def.ultimate.cost;
  if (consume && !consumeAugmentTrigger(state, fighter, candidate.key, candidate.effect)) return fighter.def.ultimate.cost;
  return fighter.def.ultimate.cost * (1 - candidate.effect.payload.percent / 100);
}

/** 현재 살아서 폭주 중인 상대 폰토스를 매 요청마다 찾아 영구 디버프 없이 회복 차단 여부를 정한다. */
function isHealingCancelledByPontus(state: SkirmishState, target: Fighter): boolean {
  return state.fighters.some((enemy) => enemy.side !== target.side && isFighterAlive(enemy) && enemy.ferocityFever
    && enemy.def.ferocityTrait.effectId === "pontusRage" && enemy.def.ferocityTrait.cancelEnemyHealing);
}

/** 모든 체력 회복 경로가 폰토스 차단, 적 생존 오라 감소, 실제 최대 HP 상한을 공유한다. */
function applyHealing(state: SkirmishState, target: Fighter, requested: number, casterId = target.id): number {
  // 폭주 종료나 폰토스 사망은 별도 상태 정리 없이 이 현재 상태 판정만으로 즉시 차단을 해제한다.
  if (isHealingCancelledByPontus(state, target)) return 0;
  const reduction = strongestLivingAura(state, target.side, "enemyHealingReceivedReductionPercent");
  const before = target.hp;
  target.hp = Math.min(target.maxHp, target.hp + Math.max(0, requested) * (1 - reduction / 100));
  const actual = target.hp - before;
  // 취소·과잉 회복은 actual이 0이므로 누적되지 않으며, 흡혈·자가 재생은 기본 casterId가 자신이다.
  addContribution(state.contributions, casterId, "healing", actual);
  return actual;
}

/** 현재 HP 절대값이 가장 낮은 생존 아군을 고르며 동률은 fighters의 편성 순서로 확정한다. */
function lowestCurrentHpAlly(state: SkirmishState, side: Side): Fighter | undefined {
  return aliveFighters(state, side).reduce<Fighter | undefined>((chosen, fighter) =>
    chosen === undefined || fighter.hp < chosen.hp ? fighter : chosen, undefined);
}

/** 이동 속도와 현재 편의 피버 오라가 정하는 초당 이동 거리(px). */
export function moveSpeed(fighter: Fighter, state?: SkirmishState): number {
  // 같은 효과가 여러 개 있어도 가장 높은 하나만 적용해 지원가 중첩 폭주를 막는다.
  const teamBonus = state
    ? Math.max(0, ...state.fighters
      .filter((ally) => ally.side === fighter.side && isFighterAlive(ally) && ally.ferocityFever
        && ally.def.ferocityTrait.effectId === "teamMoveSpeedBonus")
      .map((ally) => ally.def.ferocityTrait.effectId === "teamMoveSpeedBonus" ? ally.def.ferocityTrait.bonusPercent : 0))
    : 0;
  // 팀 오라와 달리 이크티오 다이브는 폭주한 본인만 빨라진다.
  const selfBonus = fighter.ferocityFever && fighter.def.ferocityTrait.effectId === "ichthyoDive"
    ? fighter.def.ferocityTrait.moveSpeedPercent : 0;
  const tailwindPercent = fighter.tailwindFor > 0 ? fighter.tailwind?.moveSpeedPercent ?? 0 : 0;
  return fighter.def.stats.moveSpeed * SKIRMISH.moveRate
    * (1 + teamBonus / 100) * (1 + selfBonus / 100) * (1 + tailwindPercent / 100);
}

/** 화면에 그릴 위치. 발 좌표에 돌진·피격 변위와 뛰어오른 높이를 얹은 값이다. */
export interface RenderPose {
  /** SD를 세울 지점. */
  x: number;
  y: number;
  /** 그림자를 놓을 지점. 떠 있어도 그림자는 땅에 남는다. */
  shadowX: number;
  shadowY: number;
  /** 지금 떠 있는 높이(px). 그림자 크기를 줄이는 데 쓴다. */
  hop: number;
}

/** 씬이 좌표 보정을 다시 계산하지 않도록 그릴 위치를 여기서 한 번에 만든다. */
export function renderPose(fighter: Fighter): RenderPose {
  return {
    x: fighter.x + fighter.dashX,
    y: fighter.y + fighter.dashY - fighter.hop,
    shadowX: fighter.x + fighter.dashX * 0.6,
    shadowY: fighter.y + fighter.dashY * 0.6,
    hop: fighter.hop,
  };
}

function distance(a: Fighter, b: Fighter): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * 돌진이 지나가는 선분. 지금 보고 있는 방향으로 **이동 속도에 비례해** 밀고 들어간다.
 *
 * 거리를 스킬에 적지 않고 이동 속도에서 뽑는 이유는, 그래야 "발이 빠른 개체가 더 멀리
 * 파고든다"가 능력치 하나로 설명되기 때문이다. 전장 밖으로 나가지 않도록 끝점만 가둔다.
 */
function chargePath(attacker: Fighter, state: SkirmishState, aim: { x: number; y: number }): { from: { x: number; y: number }; to: { x: number; y: number } } {
  const dx = aim.x - attacker.x;
  const dy = aim.y - attacker.y;
  const gap = Math.hypot(dx, dy);
  // 대상이 겹쳐 서 있어 방향이 없으면 바라보는 쪽으로 그냥 달린다.
  const ux = gap < 1e-3 ? attacker.facing : dx / gap;
  const uy = gap < 1e-3 ? 0 : dy / gap;
  const reach = moveSpeed(attacker, state) * SKIRMISH.chargeSeconds;
  const arena = state.arena;
  return {
    from: { x: attacker.x, y: attacker.y },
    to: {
      x: Math.min(arena.right, Math.max(arena.left, attacker.x + ux * reach)),
      y: Math.min(arena.bottom, Math.max(arena.top, attacker.y + uy * reach)),
    },
  };
}

/** 점과 선분 사이의 최단 거리. 통로 안에 들어왔는지를 재는 데만 쓴다. */
function distanceToSegment(point: { x: number; y: number }, from: { x: number; y: number }, to: { x: number; y: number }): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared < 1e-6) return Math.hypot(point.x - from.x, point.y - from.y);
  const t = Math.min(1, Math.max(0, ((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (from.x + dx * t), point.y - (from.y + dy * t));
}

/** 지금 노릴 상대. 이미 잡은 상대가 살아 있으면 바꾸지 않고 계속 붙는다. */
function resolveTarget(state: SkirmishState, fighter: Fighter, reconsider = false): Fighter | undefined {
  // 광란은 표적의 편을 통째로 뒤집는다. 그래서 캐시된 표적도 지금 노려야 하는 편인지 다시 본다 —
  // 그대로 두면 뒤집히기 전의 상대를 계속 때리고, 풀린 뒤에는 아군을 계속 때린다.
  const frenzied = fighter.frenzy !== null;
  const wanted = frenzied ? fighter.side : (fighter.side === "player" ? "enemy" : "player");
  // 도발은 거리·혼잡도보다 먼저다 — 강제로 그쪽을 보게 만드는 것이 이 상태의 전부다.
  // 다만 광란으로 편이 뒤집힌 동안에는 듣지 않는다. 그때 노려야 하는 편이 아예 반대이므로,
  // 도발을 그대로 따르면 지금 때릴 수 없는 상대를 바라보며 멈춰 선다.
  if (fighter.taunted) {
    const tauntSource = findFighter(state, fighter.taunted.sourceId);
    if (tauntSource && tauntSource.side === wanted && isFighterAlive(tauntSource)) return tauntSource;
  }
  const current = fighter.targetId ? findFighter(state, fighter.targetId) : undefined;
  const keepable = current !== undefined && current.side === wanted && current.id !== fighter.id
    && isFighterAlive(current) && current.stealthFor <= 0;
  if (keepable && !reconsider) return current;

  // 가장 가깝더라도 이미 아군이 붙어 있는 상대는 뒤로 미룬다. 셋이 한 명을 둘러싸는 대신
  // 서로 다른 상대와 맞붙어 전장 곳곳에서 싸우는 그림이 된다.
  let chosen: Fighter | undefined;
  let bestScore = Infinity;
  for (const other of state.fighters) {
    // 은신자는 단일 대상 기술의 중심이 될 수 없다. 다른 중심의 범위 피해 판정에서는 별도로 포함한다.
    if (other.side !== wanted || other.id === fighter.id || !isFighterAlive(other) || other.stealthFor > 0) continue;
    const crowd = state.fighters.filter(
      (mate) => mate.side === fighter.side && mate.id !== fighter.id && isFighterAlive(mate) && mate.targetId === other.id,
    ).length;
    // 점수는 낮을수록 좋다. 거리가 기본이고, 몰림은 밀어내고, **지금 노리던 상대**와
    // **이미 손이 닿는 상대**는 그만큼 당긴다.
    const gap = distance(fighter, other);
    const score = gap + crowd * SKIRMISH.crowdPenalty
      - (other.id === fighter.targetId ? SKIRMISH.targetStickiness : 0)
      - (gap <= fighterReach(fighter) ? SKIRMISH.inReachBonus : 0);
    if (score < bestScore) {
      chosen = other;
      bestScore = score;
    }
  }
  // 광란한 개체가 때릴 자기 편을 다 잃으면 제자리에서 자신을 공격한다. 적이 혼자인 보스전에서
  // 광란이 통째로 무효가 되지 않게 하는 것이 이 폴백의 유일한 목적이다.
  if (!chosen && frenzied && isFighterAlive(fighter)) {
    fighter.targetId = fighter.id;
    return fighter;
  }
  fighter.targetId = chosen?.id ?? null;
  return chosen;
}

/** 실제 전투 시작 공격력이 가장 높은 아군의 표적을 무리 사냥 보유자들이 복사한다. 동률은 편성 순서다. */
export function triggerPackHunt(state: SkirmishState, side: Side): void {
  const allies = state.fighters.filter((fighter) => fighter.side === side && isFighterAlive(fighter));
  const hunters = allies.filter((ally) => ally.def.passive.kind === "followHighestAttackAllyTarget");
  if (hunters.length === 0) return;
  const leader = allies.reduce<Fighter | undefined>((best, fighter) => {
    // 전투 시작부터 적용되는 공격력 패시브까지 반영하고, 같은 값이면 앞선 fighters 순서를 보존한다.
    const attack = offensiveDefinition(fighter).stats.atk;
    return !best || attack > offensiveDefinition(best).stats.atk ? fighter : best;
  }, undefined);
  if (!leader) return;
  const leaderTarget = resolveTarget(state, leader);
  if (!leaderTarget) return;
  for (const ally of hunters) {
    ally.targetId = leaderTarget.id;
    ally.engaged = false;
  }
}

/**
 * 폭주 중인 아군의 `tailwindRally`가 같은 편 전체에 더해 주는 공격당 충전 보정이다.
 *
 * 여러 제공자가 겹쳐도 가장 높은 하나만 쓴다 — 지원가를 여럿 세워 충전을 곱으로 불리는 길을
 * 만들지 않기 위해, 다른 팀 오라(아다지오·무리 사냥)와 같은 정책을 그대로 따른다.
 */
function tailwindRally(state: SkirmishState | undefined, side: Side): { ferocity: number; energy: number } {
  if (!state) return { ferocity: 0, energy: 0 };
  let ferocity = 0; let energy = 0;
  for (const ally of state.fighters) {
    const trait = ally.def.ferocityTrait;
    if (ally.side !== side || !isFighterAlive(ally) || !ally.ferocityFever || trait.effectId !== "tailwindRally") continue;
    ferocity = Math.max(ferocity, trait.teamFerocityGain);
    energy = Math.max(energy, trait.teamEnergyGain);
  }
  return { ferocity, energy };
}

function gainEnergy(fighter: Fighter, state?: SkirmishState): void {
  const chargeThreshold = fighter.def.ultimate.chargeStartsAtHpPercent;
  // 보스의 체력 단계형 궁극기는 전투 시작부터 미리 충전되지 않도록 적중 순간의 현재 HP를 확인한다.
  if (chargeThreshold !== undefined && fighter.hp / fighter.maxHp * 100 > chargeThreshold) return;
  const rally = tailwindRally(state, fighter.side).energy;
  fighter.energy = Math.min(ULTIMATE_ENERGY_MAX, fighter.energy + fighter.def.stats.energyGain + rally);
}

/** 기본 공격 한 번이 생존 아군 전체에게 나눠 주는 궁극기 게이지다. 시전자 자신도 포함한다. */
function grantAllyEnergy(attacker: Fighter, skill: Skill, state: SkirmishState): void {
  const amount = skill.allyEnergyGain ?? 0;
  if (amount <= 0) return;
  for (const ally of aliveFighters(state, attacker.side)) {
    const threshold = ally.def.ultimate.chargeStartsAtHpPercent;
    if (threshold !== undefined && ally.hp / ally.maxHp * 100 > threshold) continue;
    ally.energy = Math.min(ULTIMATE_ENERGY_MAX, ally.energy + amount);
  }
}

/** 순풍처럼 시간이 정해진 아군 전체 강화를 건다. 겹쳐 걸면 남은 시간이 더 긴 쪽으로 갱신된다. */
function applyTeamBuff(target: Fighter, buff: TeamBuff): void {
  if (buff.seconds <= target.tailwindFor) return;
  target.tailwindFor = buff.seconds;
  target.tailwind = buff;
  // 회복 틱은 새로 걸린 순간부터 다시 센다 — 갱신할 때마다 즉시 한 번 터지면 겹쳐 걸어 회복을 뽑을 수 있다.
  target.tailwindTickIn = EMERGENCY_RECOVERY.tickSeconds;
}

/**
 * 순풍이 데려온 지속 회복.
 *
 * 회복은 순풍 태그의 효과가 아니라 **그 순풍을 건 스킬이 얹은 값**이라, 값이 없는 순풍은
 * 아무것도 회복시키지 않는다. 긴급 회복과 같은 1초 틱·같은 회복 경계를 쓴다.
 */
function tickTailwind(fighter: Fighter, dt: number, state: SkirmishState): SkirmishEvent[] {
  const percent = fighter.tailwindFor > 0 ? fighter.tailwind?.maxHpRegenPercentPerSecond : undefined;
  if (percent === undefined || dt <= 0 || !isFighterAlive(fighter)) return [];
  fighter.tailwindTickIn -= Math.min(dt, fighter.tailwindFor);
  const events: SkirmishEvent[] = [];
  while (fighter.tailwindTickIn <= EMERGENCY_RECOVERY.epsilon) {
    const amount = applyHealing(state, fighter, fighter.maxHp * percent / 100);
    // 최대 HP에서 발생한 0 회복은 UI에 숫자를 띄울 실제 사건이 아니므로 생략한다.
    if (amount > 0) events.push({ kind: "heal", fighterId: fighter.id, amount, source: "passive", effect: { tag: "heal", intensity: 1 } });
    fighter.tailwindTickIn += EMERGENCY_RECOVERY.tickSeconds;
  }
  return events;
}

/** 실시간 전투도 턴제와 같은 사건별 증가 및 임계 로그 계약을 사용한다. */
function gainFerocity(fighter: Fighter, base: number, state: SkirmishState): void {
  const before = fighter.ferocity;
  // 피버 중 추가 획득은 무시해 한 번 열린 보상 구간이 정해진 시간 안에 반드시 끝나게 한다.
  if (fighter.ferocityFever) return;
  // 폭주한 지원가의 팀 보정은 유대·룬 보정 앞에서 사건별 기본 충전량 자체를 키운다.
  const rallied = base + tailwindRally(state, fighter.side).ferocity;
  // 룬 야성 보정은 유대 보정 뒤의 사건별 충전량에 곱하며 단위는 percent다.
  const adjusted = amplifyFerocityGain(rallied, fighter.bondLevel) * (1 + fighter.def.stats.ferocityGain / 100);
  fighter.ferocity = Math.min(FEROCITY_RULES.max, before + adjusted);
  // 처음 최대치에 닿은 순간 피버 카운트다운을 켠다.
  if (before < FEROCITY_RULES.max && fighter.ferocity >= FEROCITY_RULES.max) {
    fighter.ferocityFever = true;
    const trait = fighter.def.ferocityTrait;
    if (trait.effectId === "stealthLeap") {
      fighter.stealthFor = trait.durationSeconds;
      leapToLowestHpEnemy(fighter, state, trait.landingDistance);
      // 이미 스피나를 추적하던 모든 상대도 즉시 대기/재탐색 상태로 돌린다.
      for (const other of state.fighters) if (other.targetId === fighter.id) { other.targetId = null; other.engaged = false; }
    }
    if (trait.effectId === "adamantBody") fighter.hastenedAttacksLeft = trait.hastenedAttacks;
    if (trait.effectId === "packHunt") {
      fighter.stealthFor = trait.stealthDurationSeconds;
      // 루카는 도약하지 않고 현재 좌표를 유지한 채 표적만 다시 정하며, 기존 단일 추적은 즉시 해제한다.
      for (const other of state.fighters) if (other.targetId === fighter.id) { other.targetId = null; other.engaged = false; }
      if (trait.retriggerPackHunt) triggerPackHunt(state, fighter.side);
    }
  }
  for (const { value } of FEROCITY_RULES.thresholds) {
    if (before < value && fighter.ferocity >= value) state.log.push(`${fighter.def.name} 야성 ${value} 진입`);
  }
}

/**
 * 같은 상대를 이어서 때린 횟수를 세고, 다 채우면 출혈을 남긴다.
 *
 * 상대를 바꾸면 셈은 처음으로 돌아간다 — 한 명에게 붙어 물고 늘어져야 터지는 보상이라야
 * "포식 본능"이라는 이름과 맞는다.
 */
function applyStreak(attacker: Fighter, target: Fighter, events: SkirmishEvent[]): void {
  if (attacker.def.passive.kind !== "bleedStreak") return;
  attacker.streakCount = attacker.streakTargetId === target.id ? attacker.streakCount + 1 : 1;
  attacker.streakTargetId = target.id;
  if (attacker.streakCount < attacker.def.passive.value) return;
  attacker.streakCount = 0;
  refreshBleed(target, BLEED.seconds, BLEED.percentPerSecond, events, attacker.id);
}

/**
 * 반짝이는 표식을 옮기고, 옮겨 간 순간에만 추가 마법 피해를 준다.
 *
 * 표식은 공격자가 소유한다 — 같은 상대를 계속 때리면 표식이 그대로라 아무 일도 없고,
 * 표식이 없는 새 상대를 때려야 표식이 옮겨가며 한 번 터진다. 그래서 이 패시브는
 * "여기저기 첨벙거리는" 이동형 전투와 짝을 이루고, 한 명에게 붙어 있으면 이득이 없다.
 *
 * 추가타는 치명타를 판정하지 않고 궁극기·야성 게이지도 충전하지 않는다.
 */
function applyShimmerMark(attacker: Fighter, target: Fighter, state: SkirmishState, events: SkirmishEvent[]): void {
  const passive = attacker.def.passive;
  if (passive.kind !== "shimmerMark" || !isFighterAlive(target)) return;
  // 이미 이 상대에게 표식이 있으면 옮길 것이 없다.
  if (attacker.shimmerMarkTargetId === target.id) return;
  attacker.shimmerMarkTargetId = target.id;

  const input = { power: passive.value, damageType: "magical" as const, scalingStat: "ap" as const, isCritical: false, kind: "basic" as const };
  const raw = computeDamage(attacker, defensiveDefinition(target, state), input, true);
  const contributionAmount = computeDamageContribution(attacker, input);
  const resolution = resolveReceivedDamage(target, raw);
  const amount = resolution.applied;
  const hpBefore = target.hp; const shieldBefore = target.shield.amount; const shieldProviderId = target.shield.providerId;
  applyDamage(target, amount, events, state);
  const credited = recordDamageContribution(state, attacker.id, target, "magical", "ap", contributionAmount, resolution, hpBefore, shieldBefore, shieldProviderId);
  events.push({ kind: "attack", attackerId: attacker.id, targetId: target.id, skill: "shimmer", amount, contributionAmount: credited, critical: false, animate: false,
    damageType: "magical", mitigated: resolution.reduced < resolution.raw });
  if (resolution.ignored) events.push({ kind: "damageIgnored", attackerId: attacker.id, targetId: target.id });
  if (!isFighterAlive(target)) {
    clearDefeatedStatuses(target);
    events.push({ kind: "death", fighterId: target.id, sourceId: attacker.id });
    state.log.push(`${target.def.name} 전투 불능`);
  }
}

/**
 * 날아가는 한 프레임. 벽에 닿으면 그 축의 방향만 뒤집는다.
 *
 * 궤적을 미리 그려 두지 않는 이유는 화면 쪽 `knockbackFlightPath`와 반대다 — 코어는 매 프레임
 * 진행하는 것이 이미 자기 일이고, 전장 크기가 화면마다 달라도 같은 코드가 그대로 맞는다.
 */
function advanceKnockback(fighter: Fighter, dt: number, arena: Arena): void {
  const flight = fighter.knockback;
  if (!flight) return;
  const remaining = flight.remaining - dt;
  let { vx, vy, bouncesLeft } = flight;
  fighter.x += vx * dt;
  fighter.y += vy * dt;
  // 한 프레임에 모서리로 들어가면 두 변을 함께 치므로, 튕김은 한 번으로 센다.
  let bounced = false;
  if (fighter.x <= arena.left || fighter.x >= arena.right) {
    fighter.x = Math.min(arena.right, Math.max(arena.left, fighter.x));
    vx = -vx * KNOCKBACK.restitution;
    bounced = true;
  }
  if (fighter.y <= arena.top || fighter.y >= arena.bottom) {
    fighter.y = Math.min(arena.bottom, Math.max(arena.top, fighter.y));
    vy = -vy * KNOCKBACK.restitution;
    bounced = true;
  }
  if (bounced) bouncesLeft -= 1;
  // 정해진 횟수를 다 튕기면 그 자리에 선다. 남은 시간은 벽에 닿지 못할 때를 위한 안전장치다.
  if (bouncesLeft < 0 || remaining <= 0) {
    fighter.knockback = null;
    return;
  }
  fighter.knockback = { remaining, vx, vy, bouncesLeft };
}

/** 튕겨 날아가는 값 중 스킬이 정하지 않는 부분. 화면의 `knockbackFlight`와 같은 감쇠를 쓴다. */
export const KNOCKBACK = { restitution: 0.86 } as const;

/**
 * 이크티오 다이브. 폭주 중 일반 공격을 마치면 표적을 **다른** 적으로 바꾼다.
 *
 * 새 표적을 여기서 고르지 않고 추적만 풀어 다음 프레임의 `resolveTarget`에 맡긴다 — 거리와
 * 아군 몰림까지 보는 규칙이 한 곳에만 있어야 한다. 다만 방금 때린 상대를 다시 고르면 바꾼
 * 것이 아니므로, 살아 있는 다른 적이 있을 때만 푼다.
 */
function retargetAfterBasic(attacker: Fighter, target: Fighter, state: SkirmishState): void {
  if (!attacker.ferocityFever || attacker.def.ferocityTrait.effectId !== "ichthyoDive") return;
  moveToNearestOtherEnemy(attacker, target, state);
}

/**
 * 다 칠한 그림에는 더 손대지 않는다. 표적의 덧칠이 상한에 닿으면 다른 적으로 옮겨 간다.
 *
 * 이 절이 없으면 메론은 처음 고른 적만 계속 때려 **나머지 적에게는 한 겹도 칠하지 못한다** —
 * 상한을 넘는 타격은 지속 시간만 갱신할 뿐 겹을 늘리지 않으므로, 그 시간은 통째로 버려진다.
 * 궁극기가 전장 전체를 터뜨리는 개체라 밑그림도 전장 전체에 퍼져야 뜻이 선다.
 */
function retargetOnFullOverpaint(attacker: Fighter, target: Fighter, state: SkirmishState): void {
  if (attacker.def.passive.kind !== "overpaintSiphon") return;
  const paint = target.overpaint;
  if (!paint || paint.stacks < paint.maxStacks) return;
  moveToNearestOtherEnemy(attacker, target, state);
}

/**
 * 방금 때린 상대를 빼고 가장 가까운 적으로 옮겨 붙는다.
 *
 * 새 표적을 여기서 고르지 않고 추적만 푸는 방법도 있지만, `null`로 두면 다음 프레임의
 * `resolveTarget`이 방금 때린 그 상대를 다시 뽑을 수 있어 "바꿨다"가 되지 않는다. 살아 있는
 * 다른 적이 없으면 그대로 둔다.
 */
function moveToNearestOtherEnemy(attacker: Fighter, target: Fighter, state: SkirmishState): void {
  const others = state.fighters.filter((other) => other.side !== attacker.side && other.id !== target.id
    && isFighterAlive(other) && other.stealthFor <= 0);
  if (others.length === 0) return;
  attacker.targetId = others.reduce((best, other) => distance(attacker, other) < distance(attacker, best) ? other : best).id;
  attacker.engaged = false;
}

/** 공격력은 배율로, 백분율 척도인 치명타 피해는 퍼센트포인트로 임시 정의에 반영한다. */
function offensiveDefinition(attacker: Fighter): RelicDef {
  const passive = attacker.def.passive;
  const conditional = attacker.conditionalAttackPowerMultiplier(attacker.maxHp > 0 ? attacker.hp / attacker.maxHp * 100 : 0);
  // 치명타 확률과 마찬가지로 개체 이름이 아니라 적힌 값으로 판별한다.
  if (passive.attackPowerPercent === undefined && passive.criticalDamagePercent === undefined && conditional === 1) return attacker.def;
  return { ...attacker.def, stats: {
    ...attacker.def.stats,
    atk: attacker.def.stats.atk * (1 + (passive.attackPowerPercent ?? 0) / 100) * conditional,
    critDamage: attacker.def.stats.critDamage + (passive.criticalDamagePercent ?? 0),
  } };
}

/** 직접 피해 회복률은 기본 능력치, 현재 폭주, 사용 스킬을 퍼센트포인트 덧셈으로 확정한다. */
function damageHealingRate(attacker: Fighter, skill: Skill, attackingInFever: boolean): number {
  const trait = attacker.def.ferocityTrait;
  const fever = attackingInFever && trait.effectId === "rexBattleQueen" ? trait.allDamageLifeStealPoints : 0;
  return attacker.def.stats.lifeSteal + fever + (skill.damageHealingPercent ?? 0);
}

/** 아군의 원본 일반 공격 적중 하나를 소비해 폭주 중인 메테들의 스타카토를 한 번씩 발생시킨다. */
function triggerCrescendoStaccato(state: SkirmishState, target: Fighter, events: SkirmishEvent[]): void {
  for (const mette of state.fighters) {
    const trait = mette.def.ferocityTrait;
    if (mette.side === target.side || !isFighterAlive(mette) || !mette.ferocityFever || trait.effectId !== "crescendoStaccato"
      || !isFighterAlive(target)) continue;
    // 추가타는 치명타를 판정하지 않고 궁극기·야성 게이지도 충전하지 않는다. 사건 skill이 staccato라서
    // 이 함수의 호출 조건인 실제 기본 공격과 구별되며, 추가 스타카토가 다시 재귀하지 않는다.
    const raw = computeDamage(mette, defensiveDefinition(target, state), {
      power: trait.damagePercent, damageType: "magical", scalingStat: "atk", isCritical: false, kind: "basic",
    }, true);
    const contributionAmount = computeDamageContribution(mette, {
      power: trait.damagePercent, damageType: "magical", scalingStat: "atk", isCritical: false, kind: "basic",
    });
    const resolution = resolveReceivedDamage(target, raw);
    const amount = resolution.applied;
    const hpBefore = target.hp; const shieldBefore = target.shield.amount; const shieldProviderId = target.shield.providerId;
    applyDamage(target, amount, events, state);
    // 스타카토 추가타도 공격자 귀속이 명확하므로 최종 HP 손실 정책에 포함한다.
    const credited = recordDamageContribution(state, mette.id, target, "magical", "atk", contributionAmount, resolution, hpBefore, shieldBefore, shieldProviderId);
    events.push({ kind: "attack", attackerId: mette.id, targetId: target.id, skill: "staccato", amount, contributionAmount: credited, critical: false, animate: false,
      damageType: "magical", mitigated: resolution.reduced < resolution.raw });
    if (resolution.ignored) events.push({ kind: "damageIgnored", attackerId: mette.id, targetId: target.id });
    if (isFighterAlive(target)) events.push(...applyStagger(target, trait.staggerSeconds, state));
  }
}

/**
 * 폭주 중인 메론이 **아군의 일반 공격 적중**에 덧칠을 대신 걸어 준다.
 *
 * 메테의 스타카토와 같은 자리·같은 방식이다 — 아군의 원본 적중 하나를 소비하고, 자신이 만든
 * 추가타에는 다시 반응하지 않는다. 소심해서 앞에 못 나서는 아이가 폭주하면 파티 전체의 손을
 * 빌려 그림을 칠하게 된다.
 */
function triggerSharedOverpaint(state: SkirmishState, target: Fighter): void {
  for (const meron of state.fighters) {
    const trait = meron.def.ferocityTrait;
    if (meron.side === target.side || !isFighterAlive(meron) || !meron.ferocityFever
      || trait.effectId !== "sharedOverpaint" || !isFighterAlive(target)) continue;
    refreshOverpaint(target, trait.overpaint);
  }
}

/**
 * 덧칠된 적이 맞을 때마다 그 피해의 일부만큼 **때린 본인**이 회복한다.
 *
 * 회복을 만드는 것은 메론이지만 받는 쪽은 그 그림을 부순 아군이다 — 앞에 나선 사람이 그만큼
 * 버티므로, 덧칠이 화력 증폭과 생존을 한 표식으로 묶는다. 겹 수와 무관하게 실제로 깎인 HP만
 * 세어 과잉 피해가 회복량이 되지 않게 한다.
 */
function siphonOverpaintHealing(attacker: Fighter, target: Fighter, hpLost: number, state: SkirmishState, events: SkirmishEvent[]): void {
  if (hpLost <= 0 || target.overpaint === null || !isFighterAlive(attacker)) return;
  // 편성에 메론이 살아 있는 동안만 도는 규칙이라, 패시브를 가진 아군을 먼저 찾는다.
  const painter = aliveFighters(state, attacker.side).find((ally) => ally.def.passive.kind === "overpaintSiphon");
  if (!painter) return;
  const amount = applyHealing(state, attacker, hpLost * painter.def.passive.value / 100, painter.id);
  if (amount > 0) events.push({ kind: "heal", fighterId: attacker.id, amount, source: "passive", effect: { tag: "heal", intensity: 1 } });
}

/**
 * HP 변경 직후 저체력 은신의 단일 발동 경계를 검사한다.
 *
 * 긴급 회복과 같은 자리에서 같은 방식으로 판정한다 — 외부 시계나 난수를 읽지 않고,
 * `passiveTriggered`가 전투당 한 번뿐인 발동권을 Fighter 안에서 소유한다. 은신에 들어가는
 * 순간 이미 이 개체를 노리던 상대의 추적도 함께 풀어야 실제로 표적에서 벗어난다.
 */
export function tryTriggerLowHpVanish(fighter: Fighter, state: SkirmishState): boolean {
  if (fighter.def.passive.kind !== "lowHpVanish" || !isFighterAlive(fighter)
    || fighter.hp > fighter.maxHp * 0.5 || fighter.passiveTriggered) return false;

  // 표시와 전투가 같은 값을 읽도록 지속 시간을 패시브 정의에서 가져온다.
  const duration = fighter.def.passive.durationSeconds;
  if (duration === undefined || duration <= 0) return false;
  fighter.passiveTriggered = true;
  fighter.stealthFor = Math.max(fighter.stealthFor, duration);
  for (const other of state.fighters) if (other.targetId === fighter.id) { other.targetId = null; other.engaged = false; }
  return true;
}

/**
 * HP 변경 직후 긴급 회복의 단일 발동 경계를 검사한다.
 *
 * 외부 시계나 난수를 읽지 않는 결정적 헬퍼이며, `passiveTriggered`가 전투당 한 번뿐인 발동권을
 * Fighter 안에서 소유한다. 정확히 최대 HP의 50%인 순간도 발동 경계에 포함한다.
 */
export function tryTriggerEmergencyRecovery(fighter: Fighter): boolean {
  if (fighter.def.passive.kind !== "emergencyRecovery" || !isFighterAlive(fighter)
    || fighter.hp > fighter.maxHp * 0.5 || fighter.passiveTriggered) return false;

  // 표시와 전투가 같은 값을 읽도록 지속 시간을 패시브 정의에서 가져온다.
  const duration = fighter.def.passive.durationSeconds;
  if (duration === undefined || duration <= 0) return false;
  fighter.passiveTriggered = true;
  fighter.regeneration = {
    remaining: duration,
    tickIn: EMERGENCY_RECOVERY.tickSeconds,
    // 패시브 value의 단위는 1초 틱마다 회복하는 최대 HP 비율(%)이다.
    percentPerTick: fighter.def.passive.value,
  };
  return true;
}

/**
 * 한 전투 스텝의 지속 회복 시계를 전진하고 실제 HP 증가분만 사건으로 반환한다.
 *
 * 먼저 이번 효과의 남은 시간까지만 소비한 뒤 틱 경계를 처리한다. 따라서 큰 dt가 들어오거나
 * maxStep으로 잘려도 1~5초 경계를 같은 순서로 지나며, epsilon은 5초 경계의 부동소수점 누락만
 * 보정한다. 사망자는 시계를 즉시 버려 이후 되살아나는 회복 사건을 만들지 않는다.
 */
export function tickRegeneration(fighter: Fighter, dt: number, state?: SkirmishState): SkirmishEvent[] {
  const regeneration = fighter.regeneration;
  if (!regeneration || dt <= 0) return [];
  if (!isFighterAlive(fighter)) {
    fighter.regeneration = null;
    return [];
  }

  const elapsed = Math.min(dt, Math.max(0, regeneration.remaining));
  regeneration.remaining = Math.max(0, regeneration.remaining - elapsed);
  regeneration.tickIn -= elapsed;
  const events: SkirmishEvent[] = [];
  while (regeneration.tickIn <= EMERGENCY_RECOVERY.epsilon) {
    const before = fighter.hp;
    const requested = fighter.maxHp * regeneration.percentPerTick / 100;
    const amount = state ? applyHealing(state, fighter, requested) : (fighter.hp = Math.min(fighter.maxHp, fighter.hp + requested)) - before;
    // 최대 HP에서 발생한 0 회복은 UI에 숫자를 띄울 실제 사건이 아니므로 생략한다.
    if (amount > 0) events.push({ kind: "heal", fighterId: fighter.id, amount, source: "passive", effect: { tag: "heal", intensity: 1 } });
    regeneration.tickIn += EMERGENCY_RECOVERY.tickSeconds;
  }
  if (regeneration.remaining <= EMERGENCY_RECOVERY.epsilon) fighter.regeneration = null;
  return events;
}

/** 경감 경계의 각 단계를 노출해 적용 피해와 폰토스 전용 무효화를 호출부가 혼동하지 않게 한다. */
export interface ReceivedDamageResult {
  raw: number;
  reduced: number;
  applied: number;
  ignored: boolean;
}

/** 폰토스의 잃은 체력 경감과 최종 피해 무효화를 판별하는 순수 피해 경계다. */
export function resolveReceivedDamage(target: Fighter, rawAmount: number): ReceivedDamageResult {
  // 불멸로 버티는 동안은 무엇을 맞아도 들어가지 않는다. 경감표 앞에 두는 이유는 이것이
  // 비율이 아니라 **아예 없던 일**이기 때문이다 — 무효 처리라 보호막도 깎이지 않는다.
  if (target.undying) return { raw: rawAmount, reduced: 0, applied: 0, ignored: true };
  const passive = target.def.passive;
  let reduction = 0;
  if (passive.kind === "abyssalPressure") {
    const hpPercent = target.maxHp <= 0 ? 100 : Math.min(100, Math.max(0, target.hp / target.maxHp * 100));
    const base = passive.baseDamageReductionPercent ?? 0;
    const maximum = passive.maxDamageReductionPercent ?? base;
    const maximumAt = passive.maxReductionAtHpPercent ?? 0;
    // 100%→지정 HP 경계를 선형 보간하고, 그 아래는 최대 경감으로 고정한다.
    const span = Math.max(Number.EPSILON, 100 - maximumAt);
    const progress = Math.min(1, Math.max(0, (100 - hpPercent) / span));
    reduction = base + (maximum - base) * progress;
  }
  // 기존 야성 경감도 같은 최종 경계에 합치되 중복 호출 없이 곱연산 한 번으로 확정한다.
  if (target.ferocityFever && target.def.ferocityTrait.effectId === "damageReduction") {
    reduction = 100 - (100 - reduction) * (1 - target.def.ferocityTrait.reductionPercent / 100);
  }
  // 덧칠은 경감과 같은 최종 경계에서 곱한다 — 여기 두지 않으면 피해 경로마다 따로 곱하게 되고
  // 어느 한 곳을 빠뜨리면 "덧칠했는데 그 스킬만 안 아픈" 상태가 된다.
  const amplified = rawAmount * overpaintMultiplier(target);
  // 「인」과 「고통의 미학」의 버티기는 **여기서 곱하지 않는다.** 그 둘은 최종 피해 감쇠가
  // 아니라 방어력·저항력 증가라 `defensiveDefinition`이 피해 공식 안에서 이미 반영한다 —
  // 그래야 방어 관통·고정 피해가 그대로 지나가고, 수치가 커질수록 수익이 줄어든다.
  const softened = Math.max(1, Math.round(amplified * (1 - Math.min(100, Math.max(0, reduction)) / 100)));
  const reduced = applyImpactCap(target, softened);
  // 일반 전투원의 최소 1 피해는 그대로 두고, 구조화 필드가 있는 심해 압력만 최종 반올림 뒤 무효화한다.
  const ignored = passive.kind === "abyssalPressure" && reduced <= (passive.ignoreDamageAtOrBelow ?? -1);
  return { raw: rawAmount, reduced, applied: ignored ? 0 : reduced, ignored };
}

/**
 * 무면허 안전제일. 한 방에 들어오는 피해에 **최대 체력 비율의 상한**을 둔다.
 *
 * 상한 이하의 평범한 타격은 그대로 다 맞는다 — 안전모가 늘 일하는 것이 아니라 **죽일 만한 한
 * 방만** 받아 낸다. 그래서 즉사급 일격을 맞아도 체력이 60% 남고, 두 번이면 20%, 세 번째에
 * 쓰러진다. 아무리 센 공격이든 세 대는 버틴다는 것이 이 패시브의 전부다.
 */
function applyImpactCap(target: Fighter, amount: number): number {
  const passive = target.def.passive;
  if (passive.kind !== "impactCap") return amount;
  const cap = target.maxHp * (passive.impactCapMaxHpPercent ?? 100) / 100;
  return amount <= cap ? amount : Math.max(1, Math.round(cap));
}

/** 기존 숫자 소비자를 위한 얇은 호환 경계이며 신규 공격 처리는 판별 가능한 결과를 직접 사용한다. */
export function receivedDamage(target: Fighter, rawAmount: number): number {
  return resolveReceivedDamage(target, rawAmount).applied;
}

/** 확정 피해를 보호막부터 흡수하고 남은 값만 HP에 적용하는 유일한 피해 적용 경계다. */
function applyDamage(target: Fighter, amount: number, events: SkirmishEvent[], state: SkirmishState): number {
  // 무효화된 0 피해는 보호막 사건조차 만들지 않아 보호막 잔량과 피격 파생 효과를 보존한다.
  if (amount <= 0) return 0;
  // 앞에 선 아군이 있으면 그 몫을 **HP에 닿기 전에** 떼어 낸다. 이 함수가 모든 피해 원천의
  // 마지막 관문이라, 출혈·중독·뇌진탕까지 한 규칙으로 나뉜다.
  amount -= shareWithBulwark(target, amount, events, state);
  if (amount <= 0) return 0;
  const hpBefore = target.hp;
  if (target.shield.amount > 0) {
    const absorbed = Math.min(target.shield.amount, amount);
    target.shield.amount -= absorbed;
    events.push({ kind: "shieldAbsorbed", fighterId: target.id, amount: absorbed, remaining: target.shield.amount, effect: { tag: "shieldHit", intensity: 1 } });
    if (target.shield.amount <= 0) {
      events.push({ kind: "shieldDepleted", fighterId: target.id, effect: { tag: "shieldBreak", intensity: 1 } });
      // 소진된 보호막의 제공자가 다음 보호막에 잘못 이어지지 않도록 함께 비운다.
      target.shield.providerId = null;
    }
    amount -= absorbed;
  }
  target.hp = Math.max(0, target.hp - amount);
  // 쓰러지는 순간을 여기서 가로챈다. 이 함수가 모든 피해 원천의 마지막 관문이라, 출혈·중독·
  // 뇌진탕처럼 공격이 아닌 경로로 죽는 경우까지 한 곳에서 붙잡을 수 있다.
  if (target.hp <= 0 && canStartUndying(target)) {
    target.hp = 1;
    target.undyingPending = true;
  }
  const dealt = hpBefore - target.hp;
  return dealt;
}

/**
 * 앞에 선 아군이 대신 받는 몫을 떼어 낸다. 실제로 넘어간 양(원래 피해 기준)을 돌려준다.
 *
 * **대신 받는 개체 자신의 피해는 다시 나누지 않는다** — 나누면 앞에 선 둘이 서로에게 몫을
 * 넘기며 같은 한 방이 몇 번이고 쪼개진다. 넘어간 몫도 그 개체의 경감을 그대로 지나므로,
 * 「고통의 미학」의 70% 감쇠가 대신 받은 피해에도 든다.
 */
function shareWithBulwark(target: Fighter, amount: number, events: SkirmishEvent[], state: SkirmishState): number {
  if (target.bulwark !== null) return 0;
  const guardian = state.fighters.find((fighter) => fighter.id !== target.id && fighter.side === target.side
    && fighter.bulwark !== null && isFighterAlive(fighter));
  if (!guardian?.bulwark) return 0;
  const share = Math.round(amount * Math.min(100, Math.max(0, guardian.bulwark.percent)) / 100);
  // 1도 되지 않는 몫까지 옮기면 화면에 숫자만 남고 실제로 바뀌는 것이 없다.
  if (share < 1) return 0;
  const resolution = resolveReceivedDamage(guardian, share);
  const dealt = applyDamage(guardian, resolution.applied, events, state);
  events.push({ kind: "damageShared", fighterId: guardian.id, fromFighterId: target.id, amount: dealt });
  return share;
}

/** 불멸을 지금 켤 수 있는가. 전투당 한 번뿐이고 이미 버티는 중에는 다시 켜지지 않는다. */
function canStartUndying(fighter: Fighter): boolean {
  return fighter.def.passive.kind === "undyingTalisman" && !fighter.passiveTriggered
    && fighter.undying === null && !fighter.undyingPending;
}

/**
 * 가로챈 죽음을 실제 불멸로 바꾼다.
 *
 * HP는 이미 `applyDamage`가 1로 붙잡아 두었으므로 여기서는 시계·회복·밀어내기만 세운다.
 * 전투당 한 번은 `passiveTriggered`가 지키며, 이 값은 긴급 회복과 같은 "전투 한정 발동권"이라
 * 개체마다 패시브가 하나뿐이므로 서로 부딪히지 않는다.
 */
function startUndying(fighter: Fighter, state: SkirmishState, events: SkirmishEvent[]): void {
  const passive = fighter.def.passive;
  fighter.undyingPending = false;
  if (passive.kind !== "undyingTalisman") return;
  fighter.passiveTriggered = true;
  const seconds = passive.durationSeconds ?? 0;
  fighter.undying = { remaining: seconds, total: seconds };
  // 회복은 긴급 회복과 같은 슬롯을 쓴다 — 매초 한 번씩, 정해진 시간 동안만 흐른다.
  if (seconds > 0 && (passive.value ?? 0) > 0) {
    fighter.regeneration = { remaining: seconds, tickIn: 1, percentPerTick: (passive.value ?? 0) / seconds };
  }
  // 버티는 동안 붙어 있던 상대를 떼어 놓는다. 파치의 날려버림과 같은 궤적 규칙을 쓴다.
  const blast = passive.undyingKnockback;
  if (blast) {
    for (const other of state.fighters) {
      if (other.side === fighter.side || !isFighterAlive(other) || distance(fighter, other) > blast.radius) continue;
      const dx = other.x - fighter.x; const dy = other.y - fighter.y; const gap = Math.hypot(dx, dy) || 1;
      other.knockback = { remaining: blast.seconds, vx: (dx / gap) * blast.speed, vy: (dy / gap) * blast.speed, bouncesLeft: blast.bounces };
      other.engaged = false;
      events.push({ kind: "knockback", fighterId: other.id, seconds: blast.seconds, bounces: blast.bounces });
    }
  }
  // 쫓던 쪽은 표적을 잃는다 — 어차피 때려도 들어가지 않는 동안 붙어 있을 이유가 없다.
  for (const other of state.fighters) if (other.targetId === fighter.id) { other.targetId = null; other.engaged = false; }
  events.push({ kind: "combatEffect", fighterId: fighter.id, effect: { tag: "shieldGain", intensity: 1.6 } });
  state.log.push(`${fighter.def.name} 불멸`);
}

/**
 * 공격 한 건의 최종 HP 손실과 방지량을 같은 시점에 기록한다.
 * 공격은 과잉 피해를 제외한 실제 HP 손실만, 방어는 공격 직전 HP·보호막 범위 안에서만 인정한다.
 * 속성·방어/저항·패시브·폰토스 체력 비례 경감은 피해 타입의 방어 세부값에, 보호막은 제공자에게 간다.
 */
function recordDamageContribution(
  state: SkirmishState,
  attackerId: string,
  target: Fighter,
  damageType: "physical" | "magical",
  scalingStat: "atk" | "ap" | "def" | "hp" | undefined,
  preMitigation: number,
  resolution: ReceivedDamageResult,
  hpBefore: number,
  shieldBefore: number,
  shieldProviderId: string | null,
): number {
  const hpDamage = Math.max(0, hpBefore - target.hp);
  const attackDetail = scalingStat === "ap" || (scalingStat === undefined && damageType === "magical") ? "abilityPower" : "attackPower";
  const shieldAbsorbed = Math.max(0, shieldBefore - target.shield.amount);
  accumulateDamageContribution(state.contributions, {
    attackerId, targetId: target.id, attackDetail,
    defenseDetail: damageType === "physical" ? "armor" : "resistance",
    preMitigation, postMitigation: resolution.applied, hpBefore, shieldBefore, hpDamage, shieldAbsorbed, shieldProviderId,
  });
  return hpDamage;
}

/** 걸린 출혈을 1초 간격으로 깎는다. 방어력을 거치지 않는 고정 피해다. */
function tickBleed(fighter: Fighter, dt: number, state: SkirmishState, events: SkirmishEvent[]): void {
  const bleed = fighter.bleed;
  if (!bleed) return;
  bleed.remaining -= dt;
  bleed.tickIn -= dt;
  while (bleed.tickIn <= 0 && isFighterAlive(fighter)) {
    const amount = receivedDamage(fighter, Math.max(1, Math.round((fighter.maxHp * bleed.percent) / 100)));
    const hpBefore = fighter.hp;
    applyDamage(fighter, amount, events, state);
    // 출혈은 건 공격자가 명확할 때만 고정 피해의 실제 HP 손실을 공격 기여도로 인정한다.
    if (bleed.sourceId) addContribution(state.contributions, bleed.sourceId, "attack", hpBefore - fighter.hp, "attackPower");
    events.push({ kind: "bleed", fighterId: fighter.id, amount, started: false });
    // 출혈도 직접 공격과 동일한 HP 변경 경계를 통과해야 패시브 발동 시점이 일관된다.
    tryTriggerEmergencyRecovery(fighter); tryTriggerLowHpVanish(fighter, state);
    state.log.push(`${fighter.def.name} 출혈 ${amount}`);
    bleed.tickIn += 1;
    if (!isFighterAlive(fighter)) {
      clearDefeatedStatuses(fighter);
      events.push({ kind: "death", fighterId: fighter.id, sourceId: bleed.sourceId });
      state.log.push(`${fighter.def.name} 전투 불능`);
    }
  }
  if (bleed.remaining <= 0 || !isFighterAlive(fighter)) fighter.bleed = null;
}

/** 한 번 때린다. 궁극기 여부는 호출하는 쪽이 정한다. */
function strike(
  attacker: Fighter,
  target: Fighter,
  rng: () => number,
  state: SkirmishState,
  events: SkirmishEvent[],
  useUltimate: boolean,
  /** 연격 내부 타격이면 행동 단위 자원은 첫 타에서만 처리한다. */
  comboHit?: { grantActionResources: boolean },
  /** 지정 원형 궁극기의 사용자 선택 중심점이다. */
  targetPoint?: { x: number; y: number },
): void {
  const skill: Skill = useUltimate ? attacker.def.ultimate : currentBasic(attacker);
  // 순수 회복 궁극기는 fireUltimate의 비공격 분기에서만 실행한다.
  if (!("damageType" in skill) || skill.damageType === undefined || skill.power === undefined) return;
  const combo = !useUltimate ? attacker.def.basic.combo : undefined;
  if (combo && comboHit === undefined) {
    // 난수 순서는 연격 판정 1회 뒤 실제로 발생한 각 타격의 치명타 순서로 고정한다.
    const hitCount = rng() < combo.chancePercent / 100 ? combo.hitCount : 1;
    for (let hit = 0; hit < hitCount && isFighterAlive(target); hit += 1) {
      strike(attacker, target, rng, state, events, false, { grantActionResources: hit === 0 });
    }
    return;
  }
  if ((useUltimate && attacker.def.ultimate.targeting !== "single") || (!useUltimate && currentBasic(attacker).targeting === "nearbyEnemies")) {
    strikeAreaAttack(attacker, rng, state, events, useUltimate, targetPoint, comboHit !== undefined && !comboHit.grantActionResources);
    return;
  }
  // 이번 타격 시작 시점의 피버만 본다. 이 공격으로 100에 도달했다면 다음 공격부터 발현한다.
  const attackingInFever = attacker.ferocityFever;
  // 저주 관련 판정은 **이번 타격이 저주를 얹기 전**의 상태로 한다. 뒤에서 보면 기본 공격이
  // 방금 건 저주를 자기가 다시 읽어 패시브와 전이가 늘 발동한다.
  const targetWasCursed = target.curse !== null;
  const targetCurseWasMaxed = isCurseMaxed(target);
  // 청산 여부도 **이번 타격이 독을 바르기 전**의 상태로 정한다. 뒤에서 보면 방금 자기가 바른
  // 독을 그 자리에서 도로 터뜨려, 바르는 차례가 영영 오지 않는다.
  const encoreLiquidation = !useUltimate && attackingInFever
    && attacker.def.ferocityTrait.effectId === "venomousEncore" && target.poison?.sourceId === attacker.id;
  const critTrait = attacker.def.ferocityTrait;
  // 패시브와 폭주의 퍼센트포인트를 모두 더한 뒤, 난수 판정 직전에만 유효 확률을 100%로 제한한다.
  // 치명타 가산은 개체 이름이 아니라 필드 하나로 읽는다 — 태생 치명타가 전 개체 공통이라
  // "이 개체는 왜 치명타형인가"의 답이 늘 패시브에 있어야 하고, 새 개체가 그 값을 적기만 하면
  // 전투가 그대로 읽어야 한다.
  const passiveCritPoints = attacker.def.passive.criticalChancePercent ?? 0;
  const criticalChance = attacker.def.stats.critChance + passiveCritPoints
    + (attackingInFever && critTrait.effectId === "rexBattleQueen" ? critTrait.criticalChancePoints : 0);
  const periodicCritical = !useUltimate ? attacker.def.basic.periodicCritical : undefined;
  if (periodicCritical) {
    // 행동마다 정확히 한 번 증가시키며 주기 끝은 0으로 되돌려 다음 네 공격을 독립적으로 센다.
    attacker.basicAttackCount += 1;
  }
  const forcedCritical = periodicCritical !== undefined && attacker.basicAttackCount >= periodicCritical.every;
  if (forcedCritical) attacker.basicAttackCount = 0;
  // 궁극기가 걸어 둔 강화는 실제로 나가는 일반 공격 한 번을 쓰고 사라진다. 이 타격이 곧 그
  // 한 번이므로 여기서 소비한다 — 궁극기 쪽에서 미리 지우면 강화가 붙을 타격이 없어진다.
  const empowered = !useUltimate && attacker.empoweredBasic;
  if (empowered) attacker.empoweredBasic = false;
  // 확정 치명타는 RNG를 호출조차 하지 않아 이후 리플레이 난수열이 밀리지 않는다.
  const critical = forcedCritical || empowered || isCriticalHit(Math.min(100, criticalChance), rng());
  // 공속 복합 계수는 현재 기본 공속과 전투의 환희 누적을 읽되 폭주 임시 배율은 포함하지 않는다.
  const attackSpeedPower = useUltimate ? attacker.def.ultimate.attackSpeedPower ?? 0 : 0;
  const compositePower = attackSpeedPower > 0
    ? skill.power + currentAttackSpeed(attacker) * attackSpeedPower / Math.max(1, attacker.def.stats.atk)
    : skill.power;
  const damageInput = {
    ...skill,
    power: compositePower,
    isCritical: critical,
    kind: useUltimate ? "ultimate" as const : "basic" as const,
    // 강화된 한 방만 방어·저항을 지나간다. 속성 상성과 대상 경감은 그대로 거친다.
    ignoresDefense: empowered,
  };
  const damageAttacker = { ...attacker, def: offensiveDefinition(attacker) };
  const damageTarget = defensiveDefinition(target, state);
  const splashTrait = attacker.def.ferocityTrait;
  // 토리카의 방어력 추가 피해도 일반 물리 피해 공식(속성·대상 방어력·치명타)을 거친다.
  const defenseBonus = attackingInFever && !useUltimate && splashTrait.effectId === "splashDamage"
    && splashTrait.defenseDamagePercent !== undefined
    ? computeDamage(attacker, damageTarget, {
        ...damageInput,
        power: splashTrait.defenseDamagePercent,
        scalingStat: "def",
        damageType: "physical",
      }, true)
    : 0;
  // 주기가 채워지는 한 방(토리카의 셋째 뿔)에만 얹히는 몫도 같은 물리 피해 공식을 거친다 —
  // 여기서만 따로 계산하면 속성 상성과 대상 방어력이 본 타격과 갈린다.
  const periodicScaling = !useUltimate ? attacker.def.basic.periodicBonusScaling : undefined;
  const periodicBonusInput = periodicScaling !== undefined && completesStatusCycle(attacker, skill, useUltimate)
    ? {
        ...damageInput,
        power: periodicScaling.power,
        scalingStat: periodicScaling.stat,
        secondaryScaling: undefined,
        damageType: "physical" as const,
      }
    : undefined;
  const periodicBonus = periodicBonusInput ? computeDamage(damageAttacker, damageTarget, periodicBonusInput, true) : 0;
  // 원정 공격력은 전투 스냅샷에 이미 반영됐으므로 공용 피해 공식에서 다시 곱하지 않는다.
  const rawAmount = Math.max(1, Math.round(computeDamage(damageAttacker, damageTarget, damageInput, true) + defenseBonus + periodicBonus));
  const contributionAmount = Math.max(0, computeDamageContribution(damageAttacker, damageInput)
    + (defenseBonus > 0 ? computeDamageContribution(attacker, { ...damageInput, power: splashTrait.effectId === "splashDamage" ? splashTrait.defenseDamagePercent ?? 0 : 0, scalingStat: "def", damageType: "physical" }) : 0)
    + (periodicBonusInput ? computeDamageContribution(damageAttacker, periodicBonusInput) : 0));
  // 방어·패시브·상성 뒤의 모든 개별 경감은 공용 HP 피해 경계에서 한 번만 적용한다.
  const resolution = resolveReceivedDamage(target, rawAmount);
  const amount = resolution.applied;

  const targetHpBefore = target.hp;
  const shieldBefore = target.shield.amount;
  const shieldProviderId = target.shield.providerId;
  const dealt = applyDamage(target, amount, events, state);
  // 광란한 개체가 제 편을 때린 몫은 그 개체가 아니라 **광란을 건 쪽**이 만든 피해다. 여기서
  // 넘기지 않으면 광란으로 판을 뒤집은 시전자가 기여도 그래프에 0으로 남는다.
  const creditedTo = attacker.frenzy?.sourceId ?? attacker.id;
  const credited = recordDamageContribution(state, creditedTo, target, damageInput.damageType, damageInput.scalingStat, contributionAmount, resolution, targetHpBefore, shieldBefore, shieldProviderId);
  tryTriggerEmergencyRecovery(target); tryTriggerLowHpVanish(target, state);
  triggerCombatAugments(state, target, "onLowHp", events);
  // 맞은 그 순간 희열이 오른다. 대신 받은 몫이 아니라 **실제로 날아온 공격**만 세는 자리다.
  gainElation(target);
  if (!useUltimate) pullStruck(attacker, target, state, events);

  const transfer = useUltimate ? attacker.def.ultimate.damageTransfer : undefined;
  if (transfer && dealt > 0) {
    // 계약상 거리는 주 대상 기준이며 filter/find 순서를 보존해 동률은 fighters 편성 순서로 결정한다.
    const secondary = state.fighters.filter((other) => other.side !== attacker.side && other.id !== target.id && isFighterAlive(other))
      .reduce<Fighter | undefined>((nearest, other) => !nearest || distance(target, other) < distance(target, nearest) ? other : nearest, undefined);
    if (secondary) {
      const requested = dealt * transfer.percent / 100;
      // 전이는 공격 공식을 재계산하지 않지만 공용 받는 피해 경감·무효화와 보호막 경계는 적용한다.
      const transferResolution = resolveReceivedDamage(secondary, requested);
      const secondaryHpBefore = secondary.hp;
      const transferApplied = applyDamage(secondary, transferResolution.applied, events, state);
      addContribution(state.contributions, attacker.id, "attack", secondaryHpBefore - secondary.hp, "attackPower");
      // 전이는 확정된 피해량을 그대로 옮기므로 방어·저항·상성을 다시 거치지 않는 고정 피해다.
      events.push({ kind: "attack", attackerId: attacker.id, targetId: secondary.id, skill: "transfer", amount: transferApplied,
        contributionAmount: secondaryHpBefore - secondary.hp, critical: false, animate: false,
        damageType: "true", mitigated: transferResolution.reduced < transferResolution.raw });
      if (transferResolution.ignored) events.push({ kind: "damageIgnored", attackerId: attacker.id, targetId: secondary.id });
      // 전용 사건은 흡혈·야성·기본 공격 적중·스타카토·재전이를 호출하지 않고 사망 정리만 수행한다.
      if (!isFighterAlive(secondary)) {
        clearDefeatedStatuses(secondary);
        events.push({ kind: "death", fighterId: secondary.id, sourceId: attacker.id });
      }
    }
  }
  /**
   * 흡혈 규칙: 보호막을 통과한 뒤 실제 HP에서 빠진 직접/광역 피해에만 적용한다.
   * 과잉 피해는 제외하고, 출혈 같은 별도 고정 피해에는 적용하지 않는다. 현재 보호막 모델이
   * 생기면 이 지점에 도달하는 HP 피해만 넘기면 규칙이 그대로 유지된다.
   */
  const healFromDamage = (dealt: number) => {
    applyHealing(state, attacker, dealt * damageHealingRate(attacker, skill, attackingInFever) / 100);
  };
  healFromDamage(dealt);
  if (!useUltimate) grantShieldFromDamage(attacker, dealt, events);
  if (!useUltimate && attacker.def.basic.lowestHpAllyHealingFromDamagePercent !== undefined) {
    const ally = lowestCurrentHpAlly(state, attacker.side);
    if (ally) {
      // 과잉 피해가 아닌 실제 감소 HP만 회복 원천으로 쓰며 공격자 자신도 정상 후보에 남긴다.
      const healed = applyHealing(state, ally, (targetHpBefore - target.hp) * attacker.def.basic.lowestHpAllyHealingFromDamagePercent / 100, attacker.id);
      if (healed > 0) events.push({ kind: "heal", fighterId: ally.id, amount: healed, source: "passive", effect: { tag: "heal", intensity: 1 } });
    }
  }
  if (comboHit?.grantActionResources !== false) {
    if (useUltimate) attacker.energy -= ultimateCost(state, attacker, true);
    else gainEnergy(attacker, state);
    // 아군 전체 충전은 시전자 자신의 충전과 같은 경계에서, 한 공격 행동에 한 번만 나눠 준다.
    grantAllyEnergy(attacker, skill, state);
    gainFerocity(attacker, useUltimate ? FEROCITY_RULES.ultimateGain : FEROCITY_RULES.basicGain, state);
  }
  // 무효 공격은 실제 피격이 아니므로 피격 야성과 그에 따른 폭주 전환을 만들지 않는다.
  if (!resolution.ignored) gainFerocity(target, FEROCITY_RULES.hitGain, state);
  if (!useUltimate && attacker.def.passive.kind === "basicHitAttackSpeedStack") {
    // 적중 사건마다 +3을 더하므로 연격 두 타는 각각 누적되며 전투 생성 시 0으로 초기화된다.
    attacker.bonusAttackSpeed += attacker.def.passive.value;
  }
  if (!useUltimate && combo) {
    const missing = attacker.maxHp - attacker.hp;
    const healed = missing * combo.missingHpHealingPercentPerHit / 100;
    const actualHealing = applyHealing(state, attacker, healed);
    if (actualHealing > 0) events.push({ kind: "heal", fighterId: attacker.id, amount: actualHealing, source: "passive", effect: { tag: "heal", intensity: 1 } });
  }

  // 때린 쪽은 상대 쪽으로 쿵 들어가고, 맞은 쪽은 같은 방향으로 밀려난다.
  const dx = target.x - attacker.x;
  const dy = target.y - attacker.y;
  const gap = Math.hypot(dx, dy) || 1;
  const power = useUltimate ? 1.4 : 1;
  attacker.dashX = (dx / gap) * SKIRMISH.lunge * power;
  attacker.dashY = (dy / gap) * SKIRMISH.lunge * power;
  target.dashX = (dx / gap) * SKIRMISH.knockback * power;
  target.dashY = (dy / gap) * SKIRMISH.knockback * power;

  applyStreak(attacker, target, events);
  const augmentBleed = bleedOnAttackEffect(state.augmentEffects, attacker.def.id);
  if (augmentBleed && isFighterAlive(target)) {
    // 증강 전용 카운터가 발동 빈도를 제한하고, 실제 적용은 모든 출혈이 쓰는 단일 슬롯을 지난다.
    attacker.augmentBleedHitCount = (attacker.augmentBleedHitCount + 1) % augmentBleed.everyNAttacks;
    if (attacker.augmentBleedHitCount === 0) {
      const strength = augmentBleed.strength === "standard" ? BLEED : BLEED.minor;
      refreshBleed(target, strength.seconds * attacker.statusPotencyMultiplier, strength.percentPerSecond, events, attacker.id);
    }
  }

  events.push({
    kind: "attack",
    attackerId: attacker.id,
    targetId: target.id,
    skill: useUltimate ? "ultimate" : "basic",
    amount,
    // 사건과 상태 모두 서버 검증기가 재계산하는 과잉 피해 제한 후 실제 HP 손실을 쓴다.
    contributionAmount: credited,
    critical,
    // 방어를 지나친 한 방은 종류가 아니라 "고정 피해"로 뜬다 — 전이와 같은 축이다.
    damageType: empowered ? "true" : damageInput.damageType,
    mitigated: resolution.reduced < resolution.raw,
    // 연격 둘째 타부터는 같은 행동의 뒤이은 타격이다(자원을 주지 않는 타격이 곧 그 표식이다).
    ...(comboHit && !comboHit.grantActionResources ? { followUp: true } : {}),
  });
  if (resolution.ignored) events.push({ kind: "damageIgnored", attackerId: attacker.id, targetId: target.id });

  // 덧칠된 적이 맞을 때마다 그 피해의 일부가 최저 체력 아군의 회복으로 돌아온다. 궁극기로
  // 덧칠이 지워지기 전에 정산해야 이번 타격의 몫이 빠지지 않는다.
  siphonOverpaintHealing(attacker, target, targetHpBefore - target.hp, state, events);

  // 궁극기·스타카토 사건은 제외하고, 실제 일반 공격의 각 적중(연격 포함)만 크레센도를 울린다.
  if (!useUltimate) { triggerCrescendoStaccato(state, target, events); triggerSharedOverpaint(state, target); }

  // 개별 기본 공격·궁극기가 선언한 상태도 피해 처리 뒤 공용 저항/재적용 규칙을 그대로 사용한다.
  // 청산하는 타격은 같은 손으로 덧바르지 않는다 — 바르거나 터뜨리거나 한 번에 하나뿐이다.
  if (isFighterAlive(target) && statusEffectsLandThisHit(attacker, skill, useUltimate)) {
    applySkillStatuses(target, encoreLiquidation ? withoutPoison(skill) : skill, events, state, attacker.id, critical);
  }
  if (encoreLiquidation && isFighterAlive(target)) liquidatePoison(target, state, events);
  // 연격도 실제 적중마다 이 경계를 지나지만 증강 자체의 횟수·쿨타임 계약이 폭주를 막는다.
  if (isFighterAlive(target)) {
    if (!useUltimate) triggerCombatAugments(state, attacker, "onBasicHit", events, target);
    if (critical) triggerCombatAugments(state, attacker, "onCritical", events, target);
  }

  if (!useUltimate) {
    // 저주에 걸린 적을 **직접** 때린 만큼만 글이 세진다. 전이된 타격은 이 경로를 지나지 않으므로
    // 한 번의 공격이 사슬 길이만큼 누적되지 않는다.
    if (attacker.def.passive.kind === "cursedInsight" && targetWasCursed) {
      const step = attacker.def.stats.ap * attacker.def.passive.value / 100;
      attacker.bonusAp = Math.min(step * (attacker.def.passive.maxStacks ?? 1), attacker.bonusAp + step);
    }
    // 폭주도 같은 이유로 **직접 적중**에만 걸린다.
    const gaze = attacker.def.ferocityTrait;
    if (attackingInFever && gaze.effectId === "frenzyGaze" && isFighterAlive(target)) {
      applyFrenzy(target, { kind: "frenzy", seconds: gaze.seconds, attackSpeedPercent: gaze.attackSpeedPercent }, attacker.id);
    }
    spreadCurseTransfer(attacker, target, targetCurseWasMaxed, targetHpBefore - target.hp, state, events);
  }

  // 처치는 두 개체의 규칙이 함께 걸리는 자리다 — 오마카세의 게이지 환급과 다음 식재료 선택.
  if (!isFighterAlive(target)) {
    if (useUltimate) attacker.energy = Math.min(ULTIMATE_ENERGY_MAX, attacker.energy + (attacker.def.ultimate.energyRefundOnKill ?? 0));
    // 처치한 순간 시계를 0으로 돌려 다음 프레임에 곧바로 다음 표적으로 뛴다.
    if (attacker.def.passive.kind === "gourmetHunt") attacker.huntCooldown = 0;
    triggerCombatAugments(state, attacker, "onKill", events, target);
  }

  // 표식은 궁극기가 아니라 실제 타격을 따라 옮겨 다닌다.
  if (!useUltimate) {
    applyShimmerMark(attacker, target, state, events);
    // 덧칠은 바로 위의 `applySkillStatuses`에서 쌓이므로, 상한 판정도 그 뒤에 와야 이번 타격으로
    // 가득 찬 경우를 놓치지 않는다.
    retargetOnFullOverpaint(attacker, target, state);
    retargetAfterBasic(attacker, target, state);
  }

  // 광역 피해는 주 대상 타격의 부가 결과이며 에너지·야성·연속 공격을 추가 획득하지 않는다.
  if (attackingInFever && splashTrait.effectId === "splashDamage") {
    // 폭주 광역도 같은 범위 표시를 쓴다 — 주 대상 자리에서 반경만큼 번진다.
    events.push({ kind: "areaImpact", attackerId: attacker.id, x: target.x, y: target.y, radius: splashTrait.radius, ultimate: useUltimate });
    // 토리카의 경직처럼 피해 특성이 기절 시간을 선언하면 주 대상도 같은 공용 상태 규칙을 지난다.
    if (splashTrait.statusEffect && isFighterAlive(target)) applyCombatStatusEffect(target, splashTrait.statusEffect, events, state);
    for (const secondary of state.fighters) {
      if (secondary.side === attacker.side || secondary.id === target.id || !isFighterAlive(secondary)
        || distance(target, secondary) > splashTrait.radius) continue;
      // 광역도 같은 공격의 일부이므로 주 대상과 동일한 원정 공격력 배율을 거친다.
      const defensiveSecondary = defensiveDefinition(secondary, state);
      const secondaryDefenseBonus = splashTrait.defenseDamagePercent === undefined ? 0 : computeDamage(attacker, defensiveSecondary, {
        ...damageInput,
        power: splashTrait.defenseDamagePercent,
        scalingStat: "def",
        damageType: "physical",
      }, true);
      const secondaryBase = computeDamage(attacker, defensiveSecondary, damageInput, true) * splashTrait.damagePercent / 100 + secondaryDefenseBonus;
      const splashContribution = Math.max(0, (computeDamageContribution(attacker, damageInput) * splashTrait.damagePercent / 100
        + (splashTrait.defenseDamagePercent === undefined ? 0 : computeDamageContribution(attacker, { ...damageInput, power: splashTrait.defenseDamagePercent, scalingStat: "def", damageType: "physical" }))));
      const splashResolution = resolveReceivedDamage(secondary, secondaryBase);
      const splashAmount = splashResolution.applied;
      const secondaryHpBefore = secondary.hp;
      const secondaryShieldBefore = secondary.shield.amount; const secondaryShieldProviderId = secondary.shield.providerId;
      applyDamage(secondary, splashAmount, events, state);
      const splashCredited = recordDamageContribution(state, attacker.id, secondary, damageInput.damageType, damageInput.scalingStat, splashContribution, splashResolution, secondaryHpBefore, secondaryShieldBefore, secondaryShieldProviderId);
      tryTriggerEmergencyRecovery(secondary); tryTriggerLowHpVanish(secondary, state);
      // 광역 피해도 공격자가 실제로 입힌 HP 피해이므로 같은 흡혈 규칙에 포함한다.
      healFromDamage(secondaryHpBefore - secondary.hp);
      events.push({ kind: "attack", attackerId: attacker.id, targetId: secondary.id, skill: useUltimate ? "ultimate" : "basic", amount: splashAmount, contributionAmount: splashCredited, critical,
        damageType: damageInput.damageType, mitigated: splashResolution.reduced < splashResolution.raw, followUp: true });
      if (splashResolution.ignored) events.push({ kind: "damageIgnored", attackerId: attacker.id, targetId: secondary.id });
      if (isFighterAlive(secondary) && splashTrait.statusEffect) applyCombatStatusEffect(secondary, splashTrait.statusEffect, events, state);
      if (!isFighterAlive(secondary)) {
        clearDefeatedStatuses(secondary);
        events.push({ kind: "death", fighterId: secondary.id, sourceId: attacker.id });
      }
    }
  }
  state.log.push(`${attacker.def.name} → ${target.def.name} ${amount}`);
  if (!isFighterAlive(target)) {
    clearDefeatedStatuses(target);
    events.push({ kind: "death", fighterId: target.id, sourceId: attacker.id });
    state.log.push(`${target.def.name} 전투 불능`);
  }
}

/**
 * 보스 행동 로그 검증 전용 진입점이다. 클라이언트와 서버가 같은 `strike` 피해·상태·증강 공식을
 * 호출하게 하며, 제출 DTO에는 피해 숫자를 절대 추가하지 않는다. 호출자는 행동 시각과 쿨다운을
 * 검증한 뒤 사용해야 한다. 이 계약 덕분에 렐릭 스킬 계수 변경은 양쪽 재생에 동시에 반영된다.
 */
export function replayLoggedBossAction(state: SkirmishState, relicId: string, kind: "basic" | "ultimate", rng: () => number = NO_CRIT): SkirmishEvent[] {
  const attacker = state.fighters.find((fighter) => fighter.side === "player" && fighter.def.id === relicId);
  const target = state.boss && state.fighters.find((fighter) => fighter.id === state.boss!.fighterId);
  if (!attacker || !target || !isFighterAlive(attacker) || !isFighterAlive(target)) return [];
  const events: SkirmishEvent[] = [];
  // 검증기는 로그에 기록된 행동 자체를 재생하므로 자동 게이지 소비 대신 정적 스킬을 직접 실행한다.
  if (kind === "ultimate") attacker.energy = Math.max(attacker.energy, attacker.def.ultimate.cost);
  strike(attacker, target, rng, state, events, kind === "ultimate");
  // 명시적 보스 ID만 대조해 향후 광역 부속물 피해가 폰토스 점수에 섞이지 않게 한다.
  if (state.boss) state.boss.score += events.reduce((sum, event) => sum + (event.kind === "attack" && event.attackerId === attacker.id && event.targetId === target.id ? event.contributionAmount : 0), 0);
  return events;
}

/**
 * 원형 광역 기본 공격 또는 궁극기를 한 번 실행한다.
 *
 * "주위"는 시전자 중심 px 반경이고, battlefieldEnemies만 좌표와 무관한 전장 전체다. 공격 시작 전에 대상을
 * 복사하므로 앞선 대상이 죽어도 뒤 대상의 피해·흡혈·상태·사망 처리는 빠지지 않는다.
 */
function strikeAreaAttack(attacker: Fighter, rng: () => number, state: SkirmishState, events: SkirmishEvent[], useUltimate: boolean, targetPoint?: { x: number; y: number }, followUp = false): void {
  const skill = useUltimate ? attacker.def.ultimate : currentBasic(attacker);
  // 비공격 궁극기는 적 대상 범위 처리기에 전달하지 않는다.
  if (!("damageType" in skill) || skill.damageType === undefined || skill.power === undefined) return;
  const ultimate = useUltimate ? attacker.def.ultimate : undefined;
  // 지정점이 생략된 기존 호출은 현재 추적 대상 위치를 사용해 자동 전투와 저장 리플레이를 호환한다.
  const requestedCenter = targetPoint ?? (() => {
    const tracked = attacker.targetId ? findFighter(state, attacker.targetId) : undefined;
    return tracked ? { x: tracked.x, y: tracked.y } : { x: attacker.x, y: attacker.y };
  })();
  // 지정 가능 범위는 경계를 포함한 전장 사각형이다. 포인터 오차나 외부 호출도 같은 경계점으로 보정한다.
  const center = skill.targeting === "targetedCircle" ? {
    x: Math.min(state.arena.right, Math.max(state.arena.left, requestedCenter.x)),
    y: Math.min(state.arena.bottom, Math.max(state.arena.top, requestedCenter.y)),
  } : { x: attacker.x, y: attacker.y };
  const inCircle = (fighter: Fighter): boolean => Math.hypot(fighter.x - center.x, fighter.y - center.y) <= (skill.radius ?? 0);
  // 돌진은 지금 보고 있는 방향으로 이동 속도만큼 밀고 들어가며, 그 통로 안의 적을 모두 뚫는다.
  const charge = skill.targeting === "chargeLine" ? chargePath(attacker, state, requestedCenter) : undefined;
  const inCharge = (fighter: Fighter): boolean => charge !== undefined
    && distanceToSegment(fighter, charge.from, charge.to) <= (skill.radius ?? 0);
  // 덧칠을 터뜨리는 궁극기는 그릴 것이 남은 적만 친다. 한 겹도 없는 적까지 대상에 넣으면
  // 위력 0의 최소 피해 1이 떠서 "터졌다"와 "터뜨릴 게 없었다"가 같은 숫자로 읽힌다.
  const detonation = ultimate?.overpaintDetonation === true;
  // 저주받은 적만 치는 궁극기는 걸린 적이 하나도 없으면 가장 가까운 적에게 먼저 씌운다.
  // 대상이 없다고 조용히 돌려보내면 게이지가 찬 채로 아무 일도 일어나지 않는다.
  const cursed = ultimate?.cursedTargetsOnly;
  if (cursed) {
    const enemies = state.fighters.filter((other) => other.side !== attacker.side && isFighterAlive(other) && other.stealthFor <= 0);
    if (enemies.length > 0 && !enemies.some((other) => other.curse !== null)) {
      const nearest = enemies.reduce((best, other) => distance(attacker, other) < distance(attacker, best) ? other : best);
      refreshCurse(nearest, cursed.seedCurse);
    }
  }
  const targets = state.fighters.filter((fighter) => fighter.side !== attacker.side && isFighterAlive(fighter) && fighter.stealthFor <= 0
    && (!detonation || (fighter.overpaint?.stacks ?? 0) > 0)
    && (!cursed || fighter.curse !== null)
    && (skill.targeting === "battlefieldEnemies" || (skill.targeting === "nearbyEnemies" && distance(attacker, fighter) <= (skill.radius ?? 0))
      || (skill.targeting === "targetedCircle" && inCircle(fighter)) || (skill.targeting === "chargeLine" && inCharge(fighter))));
  const healingTargets = ultimate?.targeting === "targetedCircle" && ultimate.allyHealingPower !== undefined
    ? aliveFighters(state, attacker.side).filter(inCircle) : [];
  if (targets.length === 0 && healingTargets.length === 0) return;

  // 전장 전체를 때리는 기술은 그릴 범위가 없다. 나머지는 실제로 터진 자리와 반경을 그대로
  // 넘겨 씬이 바닥에 범위를 그리게 한다.
  if (skill.targeting !== "battlefieldEnemies" && (skill.radius ?? 0) > 0) {
    events.push({ kind: "areaImpact", attackerId: attacker.id, x: center.x, y: center.y, radius: skill.radius ?? 0, ultimate: useUltimate });
  }

  // 돌진은 대상을 고른 뒤 실제로 자리를 옮긴다. 먼저 옮기면 판정 기준선이 이미 지나온 길이 된다.
  if (charge) {
    attacker.x = charge.to.x;
    attacker.y = charge.to.y;
    attacker.engaged = false;
    events.push({ kind: "charge", fighterId: attacker.id, from: charge.from, to: charge.to });
  }

  // 소비·팀 보조·야성 획득은 명중 수가 아니라 기술 사용 횟수에 묶는다.
  if (useUltimate) attacker.energy -= ultimateCost(state, attacker, true);
  else gainEnergy(attacker, state);
  grantAllyEnergy(attacker, skill, state);
  // 공격자 야성은 이번 공격의 모든 피해가 같은 시작 시점 배율을 쓰도록 대상 처리 뒤에 얻는다.
  const attackingInFever = attacker.ferocityFever;
  const critTrait = attacker.def.ferocityTrait;
  // 광역 궁극기도 단일 타격과 동일하게 패시브 치명타 확률을 퍼센트포인트로 취급한다.
  const passiveCritPoints = attacker.def.passive.criticalChancePercent ?? 0;
  const damageAttacker = { ...attacker, def: offensiveDefinition(attacker) };

  for (const [index, target] of targets.entries()) {
    // 각 대상은 자기 방어력·속성·피버 경감을 사용하며 치명타도 독립 판정한다.
    const criticalChance = Math.min(100, attacker.def.stats.critChance + passiveCritPoints
      + (attackingInFever && critTrait.effectId === "rexBattleQueen" ? critTrait.criticalChancePoints : 0));
    const critical = isCriticalHit(criticalChance, rng());
    // 덧칠 중첩은 **대상마다** 다르므로 위력도 대상마다 따로 더한다. 한 번 세어 모두에게
    // 같은 배율을 쓰면 가장 많이 칠한 적의 몫이 아무도 칠하지 않은 적에게까지 간다.
    // 폭발형 궁극기의 위력은 총량이 아니라 **겹당 값**이라 그 대상의 겹 수만큼 곱한다.
    const scaled = detonation ? { ...skill, power: (skill.power ?? 0) * (target.overpaint?.stacks ?? 0) } : skill;
    const damageInput = { ...scaled, isCritical: critical, kind: useUltimate ? "ultimate" as const : "basic" as const };
    const rawAmount = Math.max(1, Math.round(computeDamage(damageAttacker, defensiveDefinition(target, state), damageInput, true)));
    const contributionAmount = Math.max(0, computeDamageContribution(damageAttacker, damageInput));
    const resolution = resolveReceivedDamage(target, rawAmount);
    const amount = resolution.applied;
    const hpBefore = target.hp;
    const shieldBefore = target.shield.amount; const shieldProviderId = target.shield.providerId;
    applyDamage(target, amount, events, state);
    const credited = recordDamageContribution(state, attacker.id, target, damageInput.damageType, damageInput.scalingStat, contributionAmount, resolution, hpBefore, shieldBefore, shieldProviderId);
    tryTriggerEmergencyRecovery(target); tryTriggerLowHpVanish(target, state);
    triggerCombatAugments(state, target, "onLowHp", events);
    // 흡혈은 대상별 실제 HP 감소량만 더해 과잉 피해를 회복량으로 만들지 않는다.
    applyHealing(state, attacker, (hpBefore - target.hp) * damageHealingRate(attacker, skill, attackingInFever) / 100);
    // 보호막 전환도 같은 값을 읽는다 — 단일과 광역에서 규칙이 갈리면 같은 걸음이 대상 수에
    // 따라 다른 일을 한다.
    if (!useUltimate) grantShieldFromDamage(attacker, hpBefore - target.hp, events);
    siphonOverpaintHealing(attacker, target, hpBefore - target.hp, state, events);
    // 완성작을 공개하고 나면 그림은 지워진다 — 쌓아 두고 매번 터뜨릴 수 있으면 상시 배율이 된다.
    if (detonation) target.overpaint = null;
    if (!resolution.ignored) gainFerocity(target, FEROCITY_RULES.hitGain, state);
    // 광역으로 맞은 쪽도 희열이 오른다. 단일과 광역에서 규칙이 갈리면 같은 한 대가 어느
    // 스킬에 맞았느냐에 따라 겹을 주기도 하고 안 주기도 한다.
    gainElation(target);
    // 광역 걸음도 같은 규칙으로 끌어당긴다 — 단일과 광역에서 갈리면 같은 걸음이 대상 수에 따라 다른 일을 한다.
    if (!useUltimate) pullStruck(attacker, target, state, events);

    const dx = target.x - attacker.x;
    const dy = target.y - attacker.y;
    const gap = Math.hypot(dx, dy) || 1;
    if (index === 0) {
      attacker.dashX = (dx / gap) * SKIRMISH.lunge * 1.4;
      attacker.dashY = (dy / gap) * SKIRMISH.lunge * 1.4;
    }
    target.dashX = (dx / gap) * SKIRMISH.knockback * 1.4;
    target.dashY = (dy / gap) * SKIRMISH.knockback * 1.4;
    events.push({ kind: "attack", attackerId: attacker.id, targetId: target.id, skill: useUltimate ? "ultimate" : "basic", amount, contributionAmount: credited, critical, animate: index === 0,
      damageType: damageInput.damageType, mitigated: resolution.reduced < resolution.raw, ...(followUp || index > 0 ? { followUp: true } : {}) });
    if (resolution.ignored) events.push({ kind: "damageIgnored", attackerId: attacker.id, targetId: target.id });

    // 죽은 대상에는 지속 상태와 상태 UI 시작 사건을 절대 남기지 않는다.
    if (isFighterAlive(target)) {
      // 광역 공격도 적중 대상을 하나씩 넘겨 기절 저항·행동 중단·UI 사건을 단일 공격과 공유한다.
      applySkillStatuses(target, skill, events, state, attacker.id, critical);
      if (!useUltimate) triggerCombatAugments(state, attacker, "onBasicHit", events, target);
      if (critical) triggerCombatAugments(state, attacker, "onCritical", events, target);
    } else {
      clearDefeatedStatuses(target);
      events.push({ kind: "death", fighterId: target.id, sourceId: attacker.id });
      state.log.push(`${target.def.name} 전투 불능`);
      triggerCombatAugments(state, attacker, "onKill", events, target);
    }
    state.log.push(`${attacker.def.name} → ${target.def.name} ${amount}`);
  }
  // 혼합 궁극기의 회복은 같은 원 경계(거리 <= 반경)를 공유하며 주문력 200% 같은 정적 계수를 읽는다.
  for (const ally of healingTargets) {
    const healed = applyHealing(state, ally, currentAbilityPower(attacker) * (ultimate?.allyHealingPower ?? 0) / 100, attacker.id);
    if (healed > 0) events.push({ kind: "heal", fighterId: ally.id, amount: healed, source: "passive", effect: { tag: "heal", intensity: 1 } });
  }
  gainFerocity(attacker, useUltimate ? FEROCITY_RULES.ultimateGain : FEROCITY_RULES.basicGain, state);
}

/**
 * 서로 겹쳐 서지 않도록 **달려드는 쪽만** 비켜 세운다.
 *
 * 이미 붙어 싸우는 캐릭터까지 밀면 주고받는 내내 둘이 함께 미끄러진다. 겹침은 대부분 같은
 * 상대에게 몰려드는 도중에 생기므로, 아직 붙지 않은 쪽만 움직여도 충분히 풀린다.
 */
function separate(state: SkirmishState, dt: number): void {
  const alive = state.fighters.filter(isFighterAlive);
  for (let i = 0; i < alive.length; i += 1) {
    for (let j = i + 1; j < alive.length; j += 1) {
      const a = alive[i];
      const b = alive[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const gap = Math.hypot(dx, dy);
      if (gap >= SKIRMISH.spacing) continue;
      // 정확히 겹쳤을 때도 방향이 필요하므로 고유 위상으로 갈라 세운다.
      const angle = gap > 0.001 ? Math.atan2(dy, dx) : a.wander;
      // 겹친 양을 한 번에 없애지 않고 시간에 비례해 조금씩 푼다.
      // 한쪽만 움직일 수 있으면 그쪽이 겹친 양을 전부 감당한다.
      // 기절은 위치 행동도 멈추므로 충돌 해소가 기절한 전투원을 밀어내지 않는다.
      // 기절과 경직 모두 순간 이동을 막아 밀집 정리가 행동 차단을 우회하지 않게 한다.
      const movable = [!a.engaged && a.targetId !== null && a.stunnedFor <= 0 && a.staggeredFor <= 0, !b.engaged && b.targetId !== null && b.stunnedFor <= 0 && b.staggeredFor <= 0];
      if (!movable[0] && !movable[1]) continue;
      const share = movable[0] && movable[1] ? 0.5 : 1;
      const push = (SKIRMISH.spacing - gap) * share * Math.min(1, SKIRMISH.separationRate * dt);
      if (movable[0]) {
        a.x -= Math.cos(angle) * push;
        a.y -= Math.sin(angle) * push;
      }
      if (movable[1]) {
        b.x += Math.cos(angle) * push;
        b.y += Math.sin(angle) * push;
      }
    }
  }
}

function clampToArena(state: SkirmishState): void {
  for (const fighter of state.fighters) {
    fighter.x = Math.min(Math.max(fighter.x, state.arena.left), state.arena.right);
    fighter.y = Math.min(Math.max(fighter.y, state.arena.top), state.arena.bottom);
  }
}

function settle(state: SkirmishState, events: SkirmishEvent[]): void {
  if (state.phase !== "fight") return;
  const playersLeft = aliveFighters(state, "player").length;
  const enemiesLeft = aliveFighters(state, "enemy").length;
  // 불사 보스는 적 HP와 무관하게 아군 전멸만 정상 종료로 인정한다.
  if (state.boss && playersLeft === 0) state.phase = "defeat";
  else if (state.boss) return;
  else if (enemiesLeft === 0) state.phase = "victory";
  else if (playersLeft === 0) state.phase = "defeat";
  else return;
  events.push({ kind: "finish", phase: state.phase });
}

function advance(state: SkirmishState, dt: number, rng: () => number, events: SkirmishEvent[]): void {
  state.elapsed += dt;

  // 각 폰토스가 소유한 누적 시계로 완전히 경과한 1초만 처리해 프레임 분할과 무관하게 만든다.
  for (const pontus of state.fighters) {
    const trait = pontus.def.ferocityTrait;
    if (!isFighterAlive(pontus) || !pontus.ferocityFever || trait.effectId !== "pontusRage") {
      pontus.pontusRageTickIn = 1;
      continue;
    }
    pontus.pontusRageTickIn -= dt;
    while (pontus.pontusRageTickIn <= EMERGENCY_RECOVERY.epsilon) {
      // 고정 피해의 기존 정책대로 보호막은 applyDamage에서 먼저 흡수하지만, 방어·속성·receivedDamage는 건너뛴다.
      for (const target of aliveFighters(state, pontus.side === "player" ? "enemy" : "player")) {
        const amount = target.maxHp * trait.maxHpDamagePercentPerSecond / 100;
        const hpBefore = target.hp;
        const dealt = applyDamage(target, amount, events, state);
        // 폰토스 폭주는 시전자 귀속이 명확한 고정 피해이므로 실제 HP 손실만 공격 기여도에 포함한다.
        addContribution(state.contributions, pontus.id, "attack", hpBefore - target.hp, "abilityPower");
        state.log.push(`${pontus.def.name} 폭주 → ${target.def.name} ${dealt}`);
        if (!isFighterAlive(target)) {
          clearDefeatedStatuses(target);
          events.push({ kind: "death", fighterId: target.id, sourceId: pontus.id });
          state.log.push(`${target.def.name} 전투 불능`);
        }
      }
      pontus.pontusRageTickIn += 1;
    }
  }

  // 완전히 경과한 초마다 기본 주문력에 같은 비율을 복리 적용한다. bonusAp에는 증가분만 저장해
  // currentAbilityPower가 기본 AP를 정확히 한 번 더하도록 한다.
  for (const fighter of state.fighters) if (fighter.def.passive.kind === "abyssalPressure") {
    const seconds = Math.floor(state.elapsed + EMERGENCY_RECOVERY.epsilon);
    const rate = (fighter.def.passive.apPercentPerSecond ?? 0) / 100;
    fighter.bonusAp = fighter.def.stats.ap * (Math.pow(1 + rate, seconds) - 1);
  }

  if (state.boss) {
    const boss = state.boss;
    boss.survivedFor = state.elapsed;
    // ES2022 빌드에서도 동작하도록 뒤에서 직접 찾아 현재 단계를 고른다.
    for (let index = boss.phases.length - 1; index >= 0; index -= 1) if (state.elapsed >= boss.phases[index].startsAt) { boss.phaseIndex = index; break; }
    boss.limitReached = state.elapsed >= boss.limitSeconds;
    // 리미트는 순수 시간/좌표 규칙이다. 시간이 갈수록 안전 반경이 좁고 폰토스가 중앙으로 압박한다.
    const progress = Math.min(1, state.elapsed / boss.limitSeconds);
    boss.pressureRadius = Math.max(120, Math.max(state.arena.right - state.arena.left, state.arena.bottom - state.arena.top) * (1 - progress) / 2);
    boss.tideWarning = boss.phases[boss.phaseIndex + 1] !== undefined && boss.phases[boss.phaseIndex + 1].startsAt - state.elapsed <= 3;
    for (const pontos of aliveFighters(state, "enemy").filter(({ def }) => def.passive.kind === "abyssalPressure")) {
      const centerX = (state.arena.left + state.arena.right) / 2; const centerY = (state.arena.top + state.arena.bottom) / 2;
      pontos.x += (centerX - pontos.x) * Math.min(1, dt * (0.08 + progress * 0.22));
      pontos.y += (centerY - pontos.y) * Math.min(1, dt * (0.08 + progress * 0.22));
    }
    // 프레임 크기와 무관하게 같은 누적 광역 피해가 되도록 소수 나머지를 다음 스텝에 보존한다.
    boss.damageRemainder += boss.phases[boss.phaseIndex].damagePerSecond * dt;
    const pulse = Math.floor(boss.damageRemainder);
    if (pulse > 0) {
      boss.damageRemainder -= pulse;
      for (const fighter of aliveFighters(state, "player")) {
        // 원정 시간 제한 해일은 공격 전투원이 없는 environment 피해라 누구의 공격 기여도에도 넣지 않는다.
        applyDamage(fighter, receivedDamage(fighter, pulse), events, state);
        if (!isFighterAlive(fighter)) { clearDefeatedStatuses(fighter); events.push({ kind: "death", fighterId: fighter.id }); }
      }
    }
  }

  // 돌진·피격 변위는 시간이 지나면 제자리로 돌아온다. 죽은 캐릭터도 마지막 밀림은 마저 푼다.
  const recovery = Math.exp(-SKIRMISH.recover * dt);
  for (const fighter of state.fighters) {
    // 메테 개체별 쿨타임은 행동 불능과 무관하게 실제 전투 시간으로 흐른다.
    const adagioRemaining = fighter.adagioCooldownRemaining - dt;
    fighter.adagioCooldownRemaining = adagioRemaining <= EMERGENCY_RECOVERY.epsilon ? 0 : adagioRemaining;
    fighter.dashX *= recovery;
    fighter.dashY *= recovery;
  }

  // 지속 회복은 행동 순서와 분리해 모든 전투원이 같은 스텝의 시간 경계를 먼저 지나게 한다.
  for (const fighter of state.fighters) events.push(...tickRegeneration(fighter, dt, state));
  // 기절·경직 시계도 행동 전에 한 번만 전진한다. 이번 스텝의 공격으로 새로 걸린 상태까지 즉시
  // 깎으면 배열상 뒤에 선 대상만 지속 시간이 짧아지므로, 모든 기존 상태를 먼저 동기화한다.
  for (const fighter of state.fighters) {
    if (isFighterAlive(fighter) && fighter.stunnedFor > 0) fighter.stunnedFor = Math.max(0, fighter.stunnedFor - dt);
    if (isFighterAlive(fighter) && fighter.staggeredFor > 0) fighter.staggeredFor = Math.max(0, fighter.staggeredFor - dt);
    // 은신 시계도 행동 여부와 무관한 공용 전투 시계로 흐른다. 정확히 0이 된 스텝부터 재지정 가능하다.
    if (isFighterAlive(fighter) && fighter.stealthFor > 0) {
      const remaining = fighter.stealthFor - dt;
      fighter.stealthFor = remaining <= EMERGENCY_RECOVERY.epsilon ? 0 : remaining;
    }
    // 덧칠도 같은 공용 시계로 마른다. 다 마르면 슬롯을 비워 중첩이 다음 전투로 새지 않게 한다.
    if (isFighterAlive(fighter) && fighter.overpaint) {
      const remaining = fighter.overpaint.remaining - dt;
      if (remaining <= EMERGENCY_RECOVERY.epsilon) fighter.overpaint = null;
      else fighter.overpaint = { ...fighter.overpaint, remaining };
    }
    // 저주도 덧칠과 같은 공용 시계로 마른다. 중첩이 다음 전투로 새지 않게 슬롯째 비운다.
    if (isFighterAlive(fighter) && fighter.curse) {
      const remaining = fighter.curse.remaining - dt;
      if (remaining <= EMERGENCY_RECOVERY.epsilon) fighter.curse = null;
      else fighter.curse = { ...fighter.curse, remaining };
    }
    // 광란이 풀리는 순간 표적을 비운다. 남겨 두면 원래 편으로 돌아가고도 아군을 계속 때린다.
    if (isFighterAlive(fighter) && fighter.frenzy) {
      const remaining = fighter.frenzy.remaining - dt;
      if (remaining <= EMERGENCY_RECOVERY.epsilon) { fighter.frenzy = null; fighter.targetId = null; }
      else fighter.frenzy = { ...fighter.frenzy, remaining };
    }
    // 순풍도 같은 공용 시계를 쓴다. 다 흐르면 수치까지 비워 남은 값이 다음 전투로 새지 않게 한다.
    if (isFighterAlive(fighter) && fighter.tailwindFor > 0) {
      // 회복 틱을 먼저 돌려야 남은 시간이 0이 되는 프레임의 마지막 한 틱을 잃지 않는다.
      events.push(...tickTailwind(fighter, dt, state));
      const remaining = fighter.tailwindFor - dt;
      fighter.tailwindFor = remaining <= EMERGENCY_RECOVERY.epsilon ? 0 : remaining;
      if (fighter.tailwindFor === 0) { fighter.tailwind = null; fighter.tailwindTickIn = 0; }
    }
  }

  for (const fighter of state.fighters) {
    if (!isFighterAlive(fighter)) {
      fighter.hop *= recovery;
      clearDefeatedStatuses(fighter);
      continue;
    }
    // 가로챈 죽음은 다음 일이 일어나기 전에 마무리한다 — 밀어내기가 늦으면 그 사이 한 대 더 맞는다.
    if (fighter.undyingPending) startUndying(fighter, state, events);
    // 출혈은 붙어 있든 달려가든 흐르는 시간만큼 깎는다. 중독도 같은 축이라 나란히 흐른다.
    tickBleed(fighter, dt, state, events);
    if (!isFighterAlive(fighter)) continue;
    tickPoison(fighter, dt, state, events);
    if (!isFighterAlive(fighter)) continue;
    tickGourmetHunt(fighter, dt, state);
    tickBulwark(fighter, dt, state, events);
    tickElation(fighter, dt);
    tickElationRegen(fighter, dt, state, events);
    tickClimaxAura(fighter, dt, state, events);
    tickTaunt(fighter, dt);
    // 불멸은 기절과 같은 자리에서 행동을 멈추지만 슬롯이 달라 아다지오의 정화에 걸리지 않는다.
    if (fighter.undying) {
      const remaining = fighter.undying.remaining - dt;
      fighter.undying = remaining <= EMERGENCY_RECOVERY.epsilon ? null : { ...fighter.undying, remaining };
      fighter.hop *= recovery;
      continue;
    }
    // 기절 시간은 위에서 흐르지만 행동 시계인 공격 쿨다운은 멈춘다. 즉 이동·추적·평타·자동
    // 궁극기와 함께 행동 자체가 정지하며, 정확히 0이 된 스텝부터 기존 쿨다운을 이어서 처리한다.
    // 날아가는 중에는 벽을 튕기며 실제로 좌표가 움직인다. 기절과 달리 제자리에 서 있지 않다.
    if (fighter.knockback) {
      advanceKnockback(fighter, dt, state.arena);
      continue;
    }
    if (fighter.stunnedFor > 0 || fighter.staggeredFor > 0) {
      fighter.hop *= recovery;
      continue;
    }
    // 표적을 남이 정해 주는 개체는 주기 재평가에서 뺀다 — 무리 사냥은 대장의 표적을 따라야
    // 하고, 고품격 식재료는 제 시계로 가장 약한 적을 고른다. 둘을 여기서 다시 재면 그 규칙이
    // 2초마다 조용히 덮인다.
    const ownTarget = fighter.def.passive.kind !== "followHighestAttackAllyTarget"
      && fighter.def.passive.kind !== "gourmetHunt";
    fighter.retargetIn -= dt;
    const reconsider = ownTarget && fighter.retargetIn <= 0;
    if (reconsider) fighter.retargetIn = SKIRMISH.retargetSeconds;
    const target = resolveTarget(state, fighter, reconsider);
    if (!target) continue;

    const dx = target.x - fighter.x;
    const dy = target.y - fighter.y;
    const gap = Math.hypot(dx, dy) || 0.001;
    // 세로로 거의 겹쳐 있을 때 좌우가 깜빡이지 않도록 일정 거리부터만 방향을 바꾼다.
    if (Math.abs(dx) > SKIRMISH.facingDeadzone) fighter.facing = dx >= 0 ? 1 : -1;
    // 붙는 동안에도 시계가 흘러야 접촉하자마자 첫 타가 나간다.
    fighter.attackCooldown -= dt;

    // 붙을 때와 떨어질 때의 기준을 다르게 둬 경계에서 걷다 서다를 반복하지 않는다.
    // 사거리는 개체마다 다르다. 붙을 때와 떨어질 때의 기준만 같은 비율로 갈린다.
    const reach = fighterReach(fighter);
    fighter.engaged = fighter.engaged ? gap <= reach : gap <= reach * SKIRMISH.engageRatio;

    if (!fighter.engaged) {
      const step = moveSpeed(fighter, state) * dt;
      // 달리는 동안에는 통통 튀어 오른다. 발이 땅에 닿는 순간마다 hop이 0을 지난다.
      fighter.hopPhase += dt * SKIRMISH.hopRate * Math.PI * (fighter.def.stats.moveSpeed / 100);
      fighter.hop = Math.abs(Math.sin(fighter.hopPhase)) * SKIRMISH.hopHeight;
      // 곧장 달려들지 않고 조금씩 옆으로 흘러 여섯이 서로를 돌며 붙는다.
      const swirl = Math.sin(state.elapsed * 1.7 + fighter.wander) * SKIRMISH.swirl;
      fighter.x += ((dx / gap) + (-dy / gap) * swirl) * step;
      fighter.y += ((dy / gap) + (dx / gap) * swirl) * step;
      continue;
    }

    // 멈춰 서면 튀어 오르던 높이만 부드럽게 내려놓는다.
    fighter.hop *= recovery;

    // 붙은 뒤에는 발을 붙인다. 자리를 계속 바꾸면 서로 밀며 미끄러지는 것처럼 보이고,
    // 때리는 순간의 돌진·피격 반동(그림만 흔드는 변위)도 묻힌다.

    if (fighter.attackCooldown <= 0) {
      // 아군 궁극기는 자동으로 나가지 않는다. 화면에서 누를 때만 fireUltimate로 들어온다.
      // 적 자동 궁극기도 수동 입력과 같은 생존·기절·게이지 코어 규칙을 통과한다.
      const firedUltimate = fighter.side === "enemy" && canFireUltimate(state, fighter);
      strike(fighter, target, rng, state, events, firedUltimate);
      // 순환 걸음은 **행동 하나마다** 넘긴다. strike 안에서 넘기면 연격의 개별 적중과 광역
      // 처리기가 각자 한 걸음씩 삼켜, 한 번 휘두른 것이 두세 걸음을 지나간다.
      // 금강불괴의 남은 횟수도 같은 자리에서 하나 쓴다 — 세는 것이 적중이 아니라 행동이라
      // 빗나가거나 광역으로 여럿을 맞혀도 한 번은 한 번이다.
      if (!firedUltimate) {
        advanceBasicCycle(fighter);
        if (fighter.hastenedAttacksLeft > 0) fighter.hastenedAttacksLeft -= 1;
        // 「한 판 더」의 자기 회복도 행동 하나마다다 — 적중 수로 세면 광역 한 번이 셋을 맞힐 때
        // 세 배로 돌아 같은 폭주가 편성에 따라 다른 무게가 된다.
        healClimaxBasic(fighter, state, events);
        // 숨어 들어가 꽂는 한 방은 그 한 방이 곧 노출이다. 피해가 끝난 **뒤**에 푸는 이유는
        // 그 타격까지는 숨은 채로 들어가야 하기 때문이다.
        breakStealthOnBasic(fighter);
      }
      // 명시적 보스 ID에 맞은 경감 전 기여만 점수로 옮겨 실제 HP 피해·부속물 피해와 분리한다.
      if (state.boss && target.id === state.boss.fighterId) {
        const scored = [...events].reverse().find((event): event is Extract<SkirmishEvent, { kind: "attack" }> => event.kind === "attack" && event.attackerId === fighter.id && event.targetId === target.id);
        state.boss.score += scored?.contributionAmount ?? 0;
      }
      fighter.attackCooldown = attackInterval(fighter, state);
    }
  }

  separate(state, dt);
  clampToArena(state);
  settle(state, events);
}

/** 지금 궁극기를 쓸 수 있는지. 게이지가 찼고, 살아 있고, 때릴 상대가 남아 있어야 한다. */
export function canFireUltimate(state: SkirmishState, fighter: Fighter): boolean {
  // 수동 입력과 적 자동 시전이 모두 이 코어 경계를 공유해 기절 우회 경로를 만들지 않는다.
  // 불멸로 버티는 동안은 아무것도 하지 못한다 — 무적의 대가가 행동 정지다.
  if (state.phase !== "fight" || !isFighterAlive(fighter) || fighter.undying !== null || fighter.stunnedFor > 0 || fighter.staggeredFor > 0 || fighter.energy < ultimateCost(state, fighter, false)) return false;
  // 광란 중에는 기본 공격만 나간다. 궁극기까지 아군에게 꽂히면 한 판이 그 한 번으로 갈린다.
  if (fighter.frenzy) return false;
  if (fighter.def.ultimate.targeting === "battlefieldAllies") return aliveFighters(state, fighter.side).length > 0;
  return state.fighters.some((other) => other.side !== fighter.side && isFighterAlive(other) && other.stealthFor <= 0);
}

/**
 * 눌러서 궁극기를 쓴다.
 *
 * 붙어 있지 않아도 즉시 나간다 — 게이지를 채워 둔 플레이어가 누른 순간에 반응해야 하기 때문이다.
 * 조건을 채우지 못하면 아무것도 바꾸지 않고 빈 목록을 돌려준다.
 */
export function fireUltimate(
  state: SkirmishState,
  fighterId: string,
  rng: () => number = NO_CRIT,
  /** targetedCircle만 읽는 사용자 지정 전장 좌표다. */
  targetPoint?: { x: number; y: number },
): SkirmishEvent[] {
  const events: SkirmishEvent[] = [];
  const attacker = findFighter(state, fighterId);
  if (!attacker || !canFireUltimate(state, attacker)) return events;

  const teamUltimate = attacker.def.ultimate;
  if (teamUltimate.targeting === "battlefieldAllies" && teamUltimate.teamBuff !== undefined) {
    // 피해도 회복도 없는 지원 궁극기다. 게이지만 쓰고 생존 아군 전체에 지속 강화를 건다.
    attacker.energy -= ultimateCost(state, attacker, true);
    for (const ally of aliveFighters(state, attacker.side)) {
      applyTeamBuff(ally, teamUltimate.teamBuff);
      events.push({ kind: "teamBuff", fighterId: ally.id, buff: teamUltimate.teamBuff, sourceId: attacker.id });
    }
    attacker.attackCooldown = attackInterval(attacker, state);
    return events;
  }
  if (teamUltimate.targeting === "battlefieldAllies" && teamUltimate.healing !== undefined) {
    // 각 대상의 시전 순간 잃은 체력을 따로 계산해 20%씩 회복하고 정확히 50 게이지를 소비한다.
    attacker.energy -= ultimateCost(state, attacker, true);
    for (const ally of aliveFighters(state, attacker.side)) {
      const amount = applyHealing(state, ally, (ally.maxHp - ally.hp) * teamUltimate.healing.percent / 100, attacker.id);
      if (amount > 0) events.push({ kind: "heal", fighterId: ally.id, amount, source: "ultimate", effect: { tag: "heal", intensity: 1.65 } });
    }
    attacker.attackCooldown = attackInterval(attacker, state);
    return events;
  }

  if (teamUltimate.selfBulwark !== undefined) {
    // 아무도 때리지 않고 아무 데도 가지 않는다. 앞에 서서 아군의 몫을 대신 받는 것이 전부다.
    const plan = teamUltimate.selfBulwark;
    attacker.energy -= ultimateCost(state, attacker, true);
    raiseBulwark(attacker, {
      seconds: plan.seconds,
      percent: plan.redirectPercent,
      regenPercentPerSecond: plan.maxHpRegenPercentPerSecond,
      skillId: teamUltimate.id,
      name: teamUltimate.name,
    });
    events.push({ kind: "combatEffect", fighterId: attacker.id, effect: { tag: "shieldGain", intensity: 1.6 } });
    attacker.attackCooldown = attackInterval(attacker, state);
    return events;
  }

  if (teamUltimate.selfGuard !== undefined) {
    // 때리지 않는 궁극기다. 끌어당겨 붙잡아 두고, 버틴 값은 끝날 때 보호막으로 돌려받는다.
    const plan = teamUltimate.selfGuard;
    attacker.energy -= ultimateCost(state, attacker, true);
    // 불러 놓고 그 자리에서 덮는다 — 도발과 보호막이 한 조작에 든다.
    const shield = Math.max(1, Math.round(attacker.maxHp * plan.shieldMaxHpPercent / 100));
    attacker.shield.amount += shield;
    attacker.shield.providerId = attacker.id;
    events.push({ kind: "shieldGranted", fighterId: attacker.id, providerId: attacker.id, amount: shield, remaining: attacker.shield.amount, effect: { tag: "shieldGain", intensity: 1.5 } });
    for (const other of state.fighters) {
      if (other.side === attacker.side || !isFighterAlive(other) || distance(attacker, other) > plan.pull.radius) continue;
      // 끌어당김은 보간 없이 같은 프레임에 자리를 옮긴다 — 순간이동과 같은 규칙이라 이동 속도의
      // 영향을 받지 않고, 끌려온 자리는 시전자에게서 정해진 거리다.
      const dx = other.x - attacker.x; const dy = other.y - attacker.y; const gap = Math.hypot(dx, dy) || 1;
      other.x = Math.min(state.arena.right, Math.max(state.arena.left, attacker.x + dx / gap * plan.pull.distance));
      other.y = Math.min(state.arena.bottom, Math.max(state.arena.top, attacker.y + dy / gap * plan.pull.distance));
      other.taunted = { remaining: plan.tauntSeconds, total: plan.tauntSeconds, sourceId: attacker.id };
      // 끌려온 순간부터 엘라를 본다. 다음 재탐색까지 기다리면 끌어당긴 보람이 한 박자 늦는다.
      other.targetId = attacker.id;
      other.engaged = false;
      events.push({ kind: "combatEffect", fighterId: other.id, effect: { tag: "shieldHit", intensity: 1 } });
    }
    attacker.attackCooldown = attackInterval(attacker, state);
    settle(state, events);
    return events;
  }
  if (teamUltimate.selfSetup !== undefined) {
    // 때리지 않는 궁극기다. 게이지를 쓰고 자리만 잡은 뒤, 피해는 이어질 일반 공격이 낸다.
    const setup = teamUltimate.selfSetup;
    attacker.energy -= ultimateCost(state, attacker, true);
    attacker.stealthFor = Math.max(attacker.stealthFor, setup.stealthSeconds);
    attacker.stealthBreaksOnBasic = setup.stealthBreaksOnBasic;
    leapToLowestHpEnemy(attacker, state, setup.landingDistance);
    // 숨은 순간 그를 쫓던 상대는 표적을 잃는다. 스피나·루카의 은신과 같은 처리다.
    for (const other of state.fighters) if (other.targetId === attacker.id) { other.targetId = null; other.engaged = false; }
    attacker.empoweredBasic = true;
    attacker.attackCooldown = attackInterval(attacker, state);
    settle(state, events);
    return events;
  }

  const target = resolveTarget(state, attacker);
  if (!target) return events;

  strike(attacker, target, rng, state, events, true, undefined, targetPoint);
  // 수동 궁극기도 평타와 동일하게 명시적 보스 ID의 경감 전 기여만 점수화한다.
  if (state.boss && target.id === state.boss.fighterId) {
    state.boss.score += events.reduce((sum, event) => sum + (event.kind === "attack" && event.attackerId === attacker.id && event.targetId === state.boss!.fighterId ? event.contributionAmount : 0), 0);
  }
  // 방금 크게 휘둘렀으니 다음 평타까지의 간격도 새로 센다.
  attacker.attackCooldown = attackInterval(attacker, state);
  settle(state, events);
  return events;
}

/**
 * 시간을 dt초만큼 굴린다.
 *
 * 프레임이 길어져도 한 번에 통째로 적분하지 않고 잘게 나눈다. 그러지 않으면 서로를 지나쳐
 * 버리거나 한 프레임에 여러 대를 몰아 맞는다.
 */
export function stepSkirmish(state: SkirmishState, dt: number, rng: () => number = NO_CRIT): SkirmishEvent[] {
  // 시작 보호막 사건은 생성과 렌더 사이에서 유실되지 않도록 첫 step이 정확히 한 번 가져간다.
  const events: SkirmishEvent[] = state.initialEvents.splice(0);
  if (state.phase !== "fight" || dt <= 0) return events;
  // 한 호출 안의 여러 적분 조각에서 연장되어도 진입 사건은 한 번만 내보내도록 시작 상태를 보존한다.
  const stealthBefore = new Map(state.fighters.map((fighter) => [fighter.id, fighter.stealthFor]));

  let remaining = Math.min(dt, SKIRMISH.maxCatchUp);
  while (remaining > 0 && state.phase === "fight") {
    const step = Math.min(remaining, SKIRMISH.maxStep);
    const before = events.length;
    advance(state, step, rng, events);
    // 이 조각이 만든 타격에는 조각의 끝 시각을 못 박는다. 씬은 프레임이 끝난 뒤에 사건을 읽어
    // 자기 시계로는 언제 맞았는지 알 수 없다.
    for (let index = before; index < events.length; index += 1) {
      const event = events[index];
      if (event.kind === "attack") event.at = state.elapsed;
    }
    // 최대치에서 시작한 피버는 공격 여부와 무관하게 실제 전투 시간만큼 자연 감소한다.
    state.fighters.forEach((fighter) => drainFerocityFever(fighter, step));
    remaining -= step;
  }
  // 타이머 값 자체가 아니라 호출 전후 경계를 비교해 진입·연장·해제를 명확히 구분한다.
  for (const fighter of state.fighters) {
    const tag = stealthTransition(stealthBefore.get(fighter.id) ?? 0, fighter.stealthFor);
    if (tag) events.push({ kind: "combatEffect", fighterId: fighter.id, effect: { tag, intensity: 1 } });
  }
  return events;
}
