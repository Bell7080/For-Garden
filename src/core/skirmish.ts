import { amplifyFerocityGain } from "./bond";
import type { Combatant } from "./combatTypes";
import { computeDamage, currentAbilityPower, isCriticalHit } from "./damage";
// 전투 HUD와 피해 공식이 동일한 현재 주문력 계산을 소비하도록 공용 헬퍼를 다시 노출한다.
export { currentAbilityPower } from "./damage";
import { drainFerocityFever, FEROCITY_RULES } from "./ferocity";
import { breakthroughBonus } from "./relicProgression";
import { attackPowerMultiplier, bleedOnAttackEffect, type ExpeditionAugmentEffect } from "./expeditionAugments";
import type { CombatStatusEffect, RelicDef, Side, Skill } from "./types";
import { canUseUltimate, ULTIMATE_ENERGY_MAX } from "./ultimate";

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
  /** 남은 기절 시간(초). 별도 boolean 없이 `stunnedFor > 0`만 행동 차단 기준으로 삼는다. */
  stunnedFor: number;
  /** 남은 경직 시간(초). 기절과 달리 저항·유지 모션 없이 순간적으로만 행동을 끊는다. */
  staggeredFor: number;
  /** 모든 피해보다 먼저 소모되는 현재 보호막 잔량이다. */
  shield: number;
  /** 아다지오 정화·보호막의 메테 개체별 남은 쿨타임(초)이다. JSON 직렬화 가능한 숫자다. */
  adagioCooldownRemaining: number;
  /** 걸려 있는 출혈. 없으면 null이다. */
  bleed: { remaining: number; tickIn: number; percent: number } | null;
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
  /** 0보다 크면 단일 대상 선택의 중심이 될 수 없는 은신 상태다. */
  stealthFor: number;
  /** 폰토스 폭주의 다음 1초 고정 피해까지 남은 시간이며 비활성 중에는 1초로 초기화한다. */
  pontusRageTickIn: number;
}

export type SkirmishPhase = "fight" | "victory" | "defeat";

export interface SkirmishState {
  fighters: Fighter[];
  arena: Arena;
  phase: SkirmishPhase;
  /** 전투가 시작된 뒤 흐른 시간(초). */
  elapsed: number;
  log: string[];
  /** 원정에서만 주입되는 순수 효과 목록이다. 일반 스토리 전투는 빈 배열이다. */
  augmentEffects: readonly ExpeditionAugmentEffect[];
  /** 보스전에서만 존재하는 누적 피해·생존 시간·단계 상태다. 같은 진행기가 함께 갱신한다. */
  boss?: SkirmishBossState;
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
      skill: "basic" | "ultimate" | "staccato";
      amount: number;
      /** 경감·보호막·과잉 피해 제한 후 HP에 실제 적용된 점수 피해다. */
      scoreAmount?: number;
      critical: boolean;
      /** 광역 한 번에서 첫 피해 사건만 공격 모션을 재생한다. 생략하면 기존처럼 재생한다. */
      animate?: boolean;
    }
  | { kind: "bleed"; fighterId: string; amount: number; started: boolean }
  | { kind: "heal"; fighterId: string; amount: number; source: "passive" | "ultimate" }
  | { kind: "status"; fighterId: string; status: "stun" | "stagger"; active: true }
  | { kind: "shieldGranted"; fighterId: string; providerId: string; amount: number; remaining: number }
  | { kind: "shieldAbsorbed"; fighterId: string; amount: number; remaining: number }
  | { kind: "shieldDepleted"; fighterId: string }
  | { kind: "death"; fighterId: string }
  | { kind: "finish"; phase: "victory" | "defeat" };

/** 난전의 손맛을 정하는 값. 전부 여기서만 조정한다. */
export const SKIRMISH = {
  /** 공격 속도 100인 캐릭터의 공격 간격(초). */
  attackInterval: 1.5,
  /** 이동 속도 100인 캐릭터가 1초에 가는 거리(px). */
  moveRate: 1.45,
  /**
   * 이 거리 안이면 붙었다고 보고 때리기 시작한다.
   * 반드시 `spacing`보다 커야 한다 — 밀어내는 간격이 사거리보다 넓으면 서로 영원히 닿지 못한다.
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

function makeFighter(def: RelicDef, side: Side, index: number, x: number, y: number, bondLevel = 0, breakthrough = 0, bodyScale = 1): Fighter {
  const opened = breakthroughBonus(breakthrough);
  return {
    def,
    hp: def.stats.hp,
    maxHp: def.stats.hp,
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
    // 전투 시작 시 모든 행동 가능 상태이며, 기절은 전투 한정 상태라 저장 스냅샷에서 복원하지 않는다.
    stunnedFor: 0,
    staggeredFor: 0,
    shield: 0,
    adagioCooldownRemaining: 0,
    bleed: null,
    // 저장 스냅샷의 HP만 반영하고, 전투 한정 발동권과 지속 효과는 매 전투 새로 만든다.
    passiveTriggered: false,
    regeneration: null,
    bonusAp: 0,
    immortal: false,
    bonusAttackSpeed: 0,
    stealthFor: 0,
    // 폭주가 켜진 뒤 온전한 1초가 지나야 첫 파동이 발생한다.
    pontusRageTickIn: 1,
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
    const fighter = makeFighter(def, "player", i, playerSpots[i].x, playerSpots[i].y, playerBondLevels[def.id] ?? 0, playerBreakthroughs[def.id] ?? 0);
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
  return {
    fighters: [...players, ...enemies],
    arena,
    phase: "fight",
    elapsed: 0,
    log: [],
    augmentEffects: options.augmentEffects ?? [],
    boss: options.boss ? { fighterId: bossFighterId, score: 0, survivedFor: 0, phaseIndex: 0, limitReached: false, phases: options.boss.phases, limitSeconds: options.boss.limitSeconds, damageRemainder: 0, pressureRadius: Math.max(arena.right - arena.left, arena.bottom - arena.top) / 2, tideWarning: false } : undefined,
  };
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
  target.shield += amount;
  provider.adagioCooldownRemaining = provider.def.passive.cleanseCooldownSeconds ?? 0;
  events.push({ kind: "shieldGranted", fighterId: target.id, providerId: provider.id, amount, remaining: target.shield });
}

/** 개별 스킬과 야성 특성에서 같은 판별 가능한 상태 효과를 적용한다. */
function applyCombatStatusEffect(fighter: Fighter, effect: CombatStatusEffect, events: SkirmishEvent[], state: SkirmishState): void {
  if (effect.kind === "stun") events.push(...applyStun(fighter, effect.seconds, state));
  if (effect.kind === "stagger") events.push(...applyStagger(fighter, effect.seconds, state));
  if (effect.kind === "bleed") refreshBleed(fighter, effect.seconds, effect.maxHpPercentPerSecond, events);
}

/** 한 스킬이 선언한 상태를 생존한 한 적중 대상에게 공용 저항·UI 사건 경로로 적용한다. */
function applySkillStatuses(target: Fighter, skill: Skill, events: SkirmishEvent[], state: SkirmishState): void {
  // 피해로 쓰러진 대상에는 지속 상태나 UI 뱃지를 새로 만들지 않는다.
  if (!isFighterAlive(target)) return;
  for (const effect of skill.statusEffects ?? []) applyCombatStatusEffect(target, effect, events, state);
}

/** 모든 출혈 진입점이 공유하는 단일 슬롯 갱신 규칙이다. 약한 재적용은 강도와 틱 시계를 덮지 않는다. */
function refreshBleed(target: Fighter, seconds: number, percent: number, events: SkirmishEvent[]): void {
  target.bleed = {
    remaining: Math.max(target.bleed?.remaining ?? 0, seconds),
    tickIn: target.bleed?.tickIn ?? 1,
    percent: Math.max(target.bleed?.percent ?? 0, percent),
  };
  events.push({ kind: "bleed", fighterId: target.id, amount: 0, started: true });
}

/** 사망한 전투원에게서 이후 되살아날 수 있는 전투 한정 지속 상태를 한곳에서 정리한다. */
function clearDefeatedStatuses(fighter: Fighter): void {
  fighter.targetId = null;
  fighter.bleed = null;
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

/** 공격 속도가 정하는 공격 간격(초). 100이 기준이다. */
export function currentAttackSpeed(fighter: Fighter, state?: SkirmishState): number {
  // 전투의 환희 누적과 영구 패시브만 포함한다. 폭주처럼 시간이 정해진 임시 배율은 궁극기 계수에서 제외한다.
  const passiveSpeedPoints = fighter.def.passive.kind === "battleMaidMastery"
    ? fighter.def.passive.attackSpeedPercent ?? 0 : 0;
  const teamPercent = state ? Math.max(0, ...state.fighters.filter((ally) => ally.side === fighter.side && isFighterAlive(ally)
    && ally.def.passive.kind === "adagioWeight").map((ally) => ally.def.passive.teamAttackSpeedPercent ?? 0)) : 0;
  return (fighter.def.stats.attackSpeed + passiveSpeedPoints + fighter.bonusAttackSpeed) * (1 + teamPercent / 100);
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
function defensiveDefinition(target: Fighter, state: SkirmishState): Fighter {
  const bonus = strongestLivingAura(state, target.side, "teamDefenseResistancePercent");
  if (bonus <= 0) return target;
  return { ...target, def: { ...target.def, stats: { ...target.def.stats,
    def: target.def.stats.def * (1 + bonus / 100), res: target.def.stats.res * (1 + bonus / 100),
  } } };
}

/** 현재 살아서 폭주 중인 상대 폰토스를 매 요청마다 찾아 영구 디버프 없이 회복 차단 여부를 정한다. */
function isHealingCancelledByPontus(state: SkirmishState, target: Fighter): boolean {
  return state.fighters.some((enemy) => enemy.side !== target.side && isFighterAlive(enemy) && enemy.ferocityFever
    && enemy.def.ferocityTrait.effectId === "pontusRage" && enemy.def.ferocityTrait.cancelEnemyHealing);
}

/** 모든 체력 회복 경로가 폰토스 차단, 적 생존 오라 감소, 실제 최대 HP 상한을 공유한다. */
function applyHealing(state: SkirmishState, target: Fighter, requested: number): number {
  // 폭주 종료나 폰토스 사망은 별도 상태 정리 없이 이 현재 상태 판정만으로 즉시 차단을 해제한다.
  if (isHealingCancelledByPontus(state, target)) return 0;
  const reduction = strongestLivingAura(state, target.side, "enemyHealingReceivedReductionPercent");
  const before = target.hp;
  target.hp = Math.min(target.maxHp, target.hp + Math.max(0, requested) * (1 - reduction / 100));
  return target.hp - before;
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
  return fighter.def.stats.moveSpeed * SKIRMISH.moveRate * (1 + teamBonus / 100);
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

/** 지금 노릴 상대. 이미 잡은 상대가 살아 있으면 바꾸지 않고 계속 붙는다. */
function resolveTarget(state: SkirmishState, fighter: Fighter): Fighter | undefined {
  const current = fighter.targetId ? findFighter(state, fighter.targetId) : undefined;
  if (current && isFighterAlive(current) && current.stealthFor <= 0) return current;

  // 가장 가깝더라도 이미 아군이 붙어 있는 상대는 뒤로 미룬다. 셋이 한 명을 둘러싸는 대신
  // 서로 다른 상대와 맞붙어 전장 곳곳에서 싸우는 그림이 된다.
  let chosen: Fighter | undefined;
  let bestScore = Infinity;
  for (const other of state.fighters) {
    // 은신자는 단일 대상 기술의 중심이 될 수 없다. 다른 중심의 범위 피해 판정에서는 별도로 포함한다.
    if (other.side === fighter.side || !isFighterAlive(other) || other.stealthFor > 0) continue;
    const crowd = state.fighters.filter(
      (mate) => mate.side === fighter.side && mate.id !== fighter.id && isFighterAlive(mate) && mate.targetId === other.id,
    ).length;
    const score = distance(fighter, other) + crowd * SKIRMISH.crowdPenalty;
    if (score < bestScore) {
      chosen = other;
      bestScore = score;
    }
  }
  fighter.targetId = chosen?.id ?? null;
  return chosen;
}

function gainEnergy(fighter: Fighter): void {
  const chargeThreshold = fighter.def.ultimate.chargeStartsAtHpPercent;
  // 보스의 체력 단계형 궁극기는 전투 시작부터 미리 충전되지 않도록 적중 순간의 현재 HP를 확인한다.
  if (chargeThreshold !== undefined && fighter.hp / fighter.maxHp * 100 > chargeThreshold) return;
  fighter.energy = Math.min(ULTIMATE_ENERGY_MAX, fighter.energy + fighter.def.stats.energyGain);
}

/** 실시간 전투도 턴제와 같은 사건별 증가 및 임계 로그 계약을 사용한다. */
function gainFerocity(fighter: Fighter, base: number, state: SkirmishState): void {
  const before = fighter.ferocity;
  // 피버 중 추가 획득은 무시해 한 번 열린 보상 구간이 정해진 시간 안에 반드시 끝나게 한다.
  if (fighter.ferocityFever) return;
  // 룬 야성 보정은 유대 보정 뒤의 사건별 충전량에 곱하며 단위는 percent다.
  const adjusted = amplifyFerocityGain(base, fighter.bondLevel) * (1 + fighter.def.stats.ferocityGain / 100);
  fighter.ferocity = Math.min(FEROCITY_RULES.max, before + adjusted);
  // 처음 최대치에 닿은 순간 피버 카운트다운을 켠다.
  if (before < FEROCITY_RULES.max && fighter.ferocity >= FEROCITY_RULES.max) {
    fighter.ferocityFever = true;
    const trait = fighter.def.ferocityTrait;
    if (trait.effectId === "stealthLeap") {
      fighter.stealthFor = trait.durationSeconds;
      // 현재 HP 비율, 절대 HP, 배열 순서로 최저 체력 적을 결정해 리플레이를 안정적으로 유지한다.
      const target = state.fighters.filter((other) => other.side !== fighter.side && isFighterAlive(other))
        .map((other, index) => ({ other, index }))
        .sort((a, b) => a.other.hp / a.other.maxHp - b.other.hp / b.other.maxHp || a.other.hp - b.other.hp || a.index - b.index)[0]?.other;
      if (target) {
        const dx = fighter.x - target.x; const dy = fighter.y - target.y; const gap = Math.hypot(dx, dy) || 1;
        fighter.x = Math.min(state.arena.right, Math.max(state.arena.left, target.x + dx / gap * trait.landingDistance));
        fighter.y = Math.min(state.arena.bottom, Math.max(state.arena.top, target.y + dy / gap * trait.landingDistance));
        fighter.targetId = target.id;
      }
      // 이미 스피나를 추적하던 모든 상대도 즉시 대기/재탐색 상태로 돌린다.
      for (const other of state.fighters) if (other.targetId === fighter.id) { other.targetId = null; other.engaged = false; }
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
  refreshBleed(target, BLEED.seconds, BLEED.percentPerSecond, events);
}

/** 공격력은 배율로, 백분율 척도인 치명타 피해는 퍼센트포인트로 임시 정의에 반영한다. */
function offensiveDefinition(attacker: Fighter): RelicDef {
  const passive = attacker.def.passive;
  if (passive.kind !== "battleMaidMastery") return attacker.def;
  return { ...attacker.def, stats: {
    ...attacker.def.stats,
    atk: attacker.def.stats.atk * (1 + (passive.attackPowerPercent ?? 0) / 100),
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
    const amount = receivedDamage(target, raw);
    const dealt = applyDamage(target, amount, events);
    events.push({ kind: "attack", attackerId: mette.id, targetId: target.id, skill: "staccato", amount, scoreAmount: dealt, critical: false, animate: false });
    if (isFighterAlive(target)) events.push(...applyStagger(target, trait.staggerSeconds, state));
  }
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
    if (amount > 0) events.push({ kind: "heal", fighterId: fighter.id, amount, source: "passive" });
    regeneration.tickIn += EMERGENCY_RECOVERY.tickSeconds;
  }
  if (regeneration.remaining <= EMERGENCY_RECOVERY.epsilon) fighter.regeneration = null;
  return events;
}

/** 폰토스의 잃은 체력 경감을 포함해 모든 HP 피해가 마지막으로 통과하는 공용 경계다. */
export function receivedDamage(target: Fighter, rawAmount: number): number {
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
  return Math.max(1, Math.round(rawAmount * (1 - Math.min(100, Math.max(0, reduction)) / 100)));
}

/** 확정 피해를 보호막부터 흡수하고 남은 값만 HP에 적용하는 유일한 피해 적용 경계다. */
function applyDamage(target: Fighter, amount: number, events: SkirmishEvent[]): number {
  const hpBefore = target.hp;
  if (target.shield > 0) {
    const absorbed = Math.min(target.shield, amount);
    target.shield -= absorbed;
    events.push({ kind: "shieldAbsorbed", fighterId: target.id, amount: absorbed, remaining: target.shield });
    if (target.shield <= 0) events.push({ kind: "shieldDepleted", fighterId: target.id });
    amount -= absorbed;
  }
  target.hp = Math.max(0, target.hp - amount);
  return hpBefore - target.hp;
}

/** 걸린 출혈을 1초 간격으로 깎는다. 방어력을 거치지 않는 고정 피해다. */
function tickBleed(fighter: Fighter, dt: number, state: SkirmishState, events: SkirmishEvent[]): void {
  const bleed = fighter.bleed;
  if (!bleed) return;
  bleed.remaining -= dt;
  bleed.tickIn -= dt;
  while (bleed.tickIn <= 0 && isFighterAlive(fighter)) {
    const amount = receivedDamage(fighter, Math.max(1, Math.round((fighter.maxHp * bleed.percent) / 100)));
    applyDamage(fighter, amount, events);
    events.push({ kind: "bleed", fighterId: fighter.id, amount, started: false });
    // 출혈도 직접 공격과 동일한 HP 변경 경계를 통과해야 패시브 발동 시점이 일관된다.
    tryTriggerEmergencyRecovery(fighter);
    state.log.push(`${fighter.def.name} 출혈 ${amount}`);
    bleed.tickIn += 1;
    if (!isFighterAlive(fighter)) {
      clearDefeatedStatuses(fighter);
      events.push({ kind: "death", fighterId: fighter.id });
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
  const skill: Skill = useUltimate ? attacker.def.ultimate : attacker.def.basic;
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
  if ((useUltimate && attacker.def.ultimate.targeting !== "single") || (!useUltimate && attacker.def.basic.targeting === "nearbyEnemies")) {
    strikeAreaAttack(attacker, rng, state, events, useUltimate, targetPoint);
    return;
  }
  // 이번 타격 시작 시점의 피버만 본다. 이 공격으로 100에 도달했다면 다음 공격부터 발현한다.
  const attackingInFever = attacker.ferocityFever;
  const critTrait = attacker.def.ferocityTrait;
  // 패시브와 폭주의 퍼센트포인트를 모두 더한 뒤, 난수 판정 직전에만 유효 확률을 100%로 제한한다.
  const passiveCritPoints = attacker.def.passive.kind === "battleMaidMastery"
    ? attacker.def.passive.criticalChancePercent ?? 0 : 0;
  const criticalChance = attacker.def.stats.critChance + passiveCritPoints
    + (attackingInFever && critTrait.effectId === "criticalChanceBonus" ? critTrait.chancePercent : 0)
    + (attackingInFever && critTrait.effectId === "rexBattleQueen" ? critTrait.criticalChancePoints : 0);
  const critical = isCriticalHit(Math.min(100, criticalChance), rng());
  // 공속 복합 계수는 현재 기본 공속과 전투의 환희 누적을 읽되 폭주 임시 배율은 포함하지 않는다.
  const attackSpeedPower = useUltimate ? attacker.def.ultimate.attackSpeedPower ?? 0 : 0;
  const compositePower = attackSpeedPower > 0
    ? skill.power + currentAttackSpeed(attacker) * attackSpeedPower / Math.max(1, attacker.def.stats.atk)
    : skill.power;
  const damageInput = { ...skill, power: compositePower, isCritical: critical, kind: useUltimate ? "ultimate" as const : "basic" as const };
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
  // 공용 피해 공식을 그대로 통과한 뒤 원정 공격력 증강만 최종 배율로 한 번 적용한다.
  const rawAmount = Math.max(1, Math.round((computeDamage(damageAttacker, damageTarget, damageInput, true) + defenseBonus) * attackPowerMultiplier(state.augmentEffects, attacker.def.id)));
  // 방어·패시브·상성 뒤의 모든 개별 경감은 공용 HP 피해 경계에서 한 번만 적용한다.
  const amount = receivedDamage(target, rawAmount);

  const targetHpBefore = target.hp;
  const dealt = applyDamage(target, amount, events);
  tryTriggerEmergencyRecovery(target);
  /**
   * 흡혈 규칙: 보호막을 통과한 뒤 실제 HP에서 빠진 직접/광역 피해에만 적용한다.
   * 과잉 피해는 제외하고, 출혈 같은 별도 고정 피해에는 적용하지 않는다. 현재 보호막 모델이
   * 생기면 이 지점에 도달하는 HP 피해만 넘기면 규칙이 그대로 유지된다.
   */
  const healFromDamage = (dealt: number) => {
    applyHealing(state, attacker, dealt * damageHealingRate(attacker, skill, attackingInFever) / 100);
  };
  healFromDamage(dealt);
  if (!useUltimate && attacker.def.basic.lowestHpAllyHealingFromDamagePercent !== undefined) {
    const ally = lowestCurrentHpAlly(state, attacker.side);
    if (ally) {
      // 과잉 피해가 아닌 실제 감소 HP만 회복 원천으로 쓰며 공격자 자신도 정상 후보에 남긴다.
      const healed = applyHealing(state, ally, (targetHpBefore - target.hp) * attacker.def.basic.lowestHpAllyHealingFromDamagePercent / 100);
      if (healed > 0) events.push({ kind: "heal", fighterId: ally.id, amount: healed, source: "passive" });
    }
  }
  if (comboHit?.grantActionResources !== false) {
    if (useUltimate) attacker.energy -= attacker.def.ultimate.cost;
    else gainEnergy(attacker);
    gainFerocity(attacker, useUltimate ? FEROCITY_RULES.ultimateGain : FEROCITY_RULES.basicGain, state);
  }
  gainFerocity(target, FEROCITY_RULES.hitGain, state);
  if (!useUltimate && attacker.def.passive.kind === "basicHitAttackSpeedStack") {
    // 적중 사건마다 +3을 더하므로 연격 두 타는 각각 누적되며 전투 생성 시 0으로 초기화된다.
    attacker.bonusAttackSpeed += attacker.def.passive.value;
  }
  if (!useUltimate && combo) {
    const missing = attacker.maxHp - attacker.hp;
    const healed = missing * combo.missingHpHealingPercentPerHit / 100;
    const actualHealing = applyHealing(state, attacker, healed);
    if (actualHealing > 0) events.push({ kind: "heal", fighterId: attacker.id, amount: actualHealing, source: "passive" });
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
    // 원정 증강도 스킬·연속 공격과 동일한 출혈 갱신 규칙을 공유한다.
    refreshBleed(target, augmentBleed.seconds, augmentBleed.percent, events);
  }

  events.push({
    kind: "attack",
    attackerId: attacker.id,
    targetId: target.id,
    skill: useUltimate ? "ultimate" : "basic",
    amount,
    scoreAmount: dealt,
    critical,
  });

  // 궁극기·스타카토 사건은 제외하고, 실제 일반 공격의 각 적중(연격 포함)만 크레센도를 울린다.
  if (!useUltimate) triggerCrescendoStaccato(state, target, events);

  // 개별 기본 공격·궁극기가 선언한 상태도 피해 처리 뒤 공용 저항/재적용 규칙을 그대로 사용한다.
  applySkillStatuses(target, skill, events, state);

  // 광역 피해는 주 대상 타격의 부가 결과이며 에너지·야성·연속 공격을 추가 획득하지 않는다.
  if (attackingInFever && splashTrait.effectId === "splashDamage") {
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
      const secondaryBase = (computeDamage(attacker, defensiveSecondary, damageInput, true) * splashTrait.damagePercent / 100 + secondaryDefenseBonus)
        * attackPowerMultiplier(state.augmentEffects, attacker.def.id);
      const splashAmount = receivedDamage(secondary, secondaryBase);
      const secondaryHpBefore = secondary.hp;
      const splashDealt = applyDamage(secondary, splashAmount, events);
      tryTriggerEmergencyRecovery(secondary);
      // 광역 피해도 공격자가 실제로 입힌 HP 피해이므로 같은 흡혈 규칙에 포함한다.
      healFromDamage(secondaryHpBefore - secondary.hp);
      events.push({ kind: "attack", attackerId: attacker.id, targetId: secondary.id, skill: useUltimate ? "ultimate" : "basic", amount: splashAmount, scoreAmount: splashDealt, critical });
      if (isFighterAlive(secondary) && splashTrait.statusEffect) applyCombatStatusEffect(secondary, splashTrait.statusEffect, events, state);
      if (!isFighterAlive(secondary)) {
        clearDefeatedStatuses(secondary);
        events.push({ kind: "death", fighterId: secondary.id });
      }
    }
  }
  state.log.push(`${attacker.def.name} → ${target.def.name} ${amount}`);
  if (!isFighterAlive(target)) {
    clearDefeatedStatuses(target);
    events.push({ kind: "death", fighterId: target.id });
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
  if (state.boss) state.boss.score += events.reduce((sum, event) => sum + (event.kind === "attack" && event.attackerId === attacker.id && event.targetId === target.id ? (event.scoreAmount ?? event.amount) : 0), 0);
  return events;
}

/**
 * 원형 광역 기본 공격 또는 궁극기를 한 번 실행한다.
 *
 * "주위"는 시전자 중심 px 반경이고, battlefieldEnemies만 좌표와 무관한 전장 전체다. 공격 시작 전에 대상을
 * 복사하므로 앞선 대상이 죽어도 뒤 대상의 피해·흡혈·상태·사망 처리는 빠지지 않는다.
 */
function strikeAreaAttack(attacker: Fighter, rng: () => number, state: SkirmishState, events: SkirmishEvent[], useUltimate: boolean, targetPoint?: { x: number; y: number }): void {
  const skill = useUltimate ? attacker.def.ultimate : attacker.def.basic;
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
  const targets = state.fighters.filter((fighter) => fighter.side !== attacker.side && isFighterAlive(fighter) && fighter.stealthFor <= 0
    && (skill.targeting === "battlefieldEnemies" || (skill.targeting === "nearbyEnemies" && distance(attacker, fighter) <= (skill.radius ?? 0))
      || (skill.targeting === "targetedCircle" && inCircle(fighter))));
  const healingTargets = ultimate?.targeting === "targetedCircle" && ultimate.allyHealingPower !== undefined
    ? aliveFighters(state, attacker.side).filter(inCircle) : [];
  if (targets.length === 0 && healingTargets.length === 0) return;

  // 소비·팀 보조·야성 획득은 명중 수가 아니라 기술 사용 횟수에 묶는다.
  if (useUltimate) attacker.energy -= attacker.def.ultimate.cost;
  else gainEnergy(attacker);
  // 공격자 야성은 이번 공격의 모든 피해가 같은 시작 시점 배율을 쓰도록 대상 처리 뒤에 얻는다.
  const attackingInFever = attacker.ferocityFever;
  const critTrait = attacker.def.ferocityTrait;
  // 광역 궁극기도 단일 타격과 동일하게 패시브 치명타 확률을 퍼센트포인트로 취급한다.
  const passiveCritPoints = attacker.def.passive.kind === "battleMaidMastery"
    ? attacker.def.passive.criticalChancePercent ?? 0 : 0;
  const damageAttacker = { ...attacker, def: offensiveDefinition(attacker) };

  for (const [index, target] of targets.entries()) {
    // 각 대상은 자기 방어력·속성·피버 경감을 사용하며 치명타도 독립 판정한다.
    const criticalChance = Math.min(100, attacker.def.stats.critChance + passiveCritPoints
      + (attackingInFever && critTrait.effectId === "criticalChanceBonus" ? critTrait.chancePercent : 0)
      + (attackingInFever && critTrait.effectId === "rexBattleQueen" ? critTrait.criticalChancePoints : 0));
    const critical = isCriticalHit(criticalChance, rng());
    const damageInput = { ...skill, isCritical: critical, kind: useUltimate ? "ultimate" as const : "basic" as const };
    const rawAmount = Math.max(1, Math.round(computeDamage(damageAttacker, defensiveDefinition(target, state), damageInput, true)
      * attackPowerMultiplier(state.augmentEffects, attacker.def.id)));
    const amount = receivedDamage(target, rawAmount);
    const hpBefore = target.hp;
    const dealt = applyDamage(target, amount, events);
    tryTriggerEmergencyRecovery(target);
    // 흡혈은 대상별 실제 HP 감소량만 더해 과잉 피해를 회복량으로 만들지 않는다.
    applyHealing(state, attacker, (hpBefore - target.hp) * damageHealingRate(attacker, skill, attackingInFever) / 100);
    gainFerocity(target, FEROCITY_RULES.hitGain, state);

    const dx = target.x - attacker.x;
    const dy = target.y - attacker.y;
    const gap = Math.hypot(dx, dy) || 1;
    if (index === 0) {
      attacker.dashX = (dx / gap) * SKIRMISH.lunge * 1.4;
      attacker.dashY = (dy / gap) * SKIRMISH.lunge * 1.4;
    }
    target.dashX = (dx / gap) * SKIRMISH.knockback * 1.4;
    target.dashY = (dy / gap) * SKIRMISH.knockback * 1.4;
    events.push({ kind: "attack", attackerId: attacker.id, targetId: target.id, skill: useUltimate ? "ultimate" : "basic", amount, scoreAmount: dealt, critical, animate: index === 0 });

    // 죽은 대상에는 지속 상태와 상태 UI 시작 사건을 절대 남기지 않는다.
    if (isFighterAlive(target)) {
      // 광역 공격도 적중 대상을 하나씩 넘겨 기절 저항·행동 중단·UI 사건을 단일 공격과 공유한다.
      applySkillStatuses(target, skill, events, state);
    } else {
      clearDefeatedStatuses(target);
      events.push({ kind: "death", fighterId: target.id });
      state.log.push(`${target.def.name} 전투 불능`);
    }
    state.log.push(`${attacker.def.name} → ${target.def.name} ${amount}`);
  }
  // 혼합 궁극기의 회복은 같은 원 경계(거리 <= 반경)를 공유하며 주문력 200% 같은 정적 계수를 읽는다.
  for (const ally of healingTargets) {
    const healed = applyHealing(state, ally, currentAbilityPower(attacker) * (ultimate?.allyHealingPower ?? 0) / 100);
    if (healed > 0) events.push({ kind: "heal", fighterId: ally.id, amount: healed, source: "passive" });
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
        const dealt = applyDamage(target, amount, events);
        state.log.push(`${pontus.def.name} 폭주 → ${target.def.name} ${dealt}`);
        if (!isFighterAlive(target)) {
          clearDefeatedStatuses(target);
          events.push({ kind: "death", fighterId: target.id });
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
        applyDamage(fighter, receivedDamage(fighter, pulse), events);
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
  }

  for (const fighter of state.fighters) {
    if (!isFighterAlive(fighter)) {
      fighter.hop *= recovery;
      clearDefeatedStatuses(fighter);
      continue;
    }
    // 출혈은 붙어 있든 달려가든 흐르는 시간만큼 깎는다.
    tickBleed(fighter, dt, state, events);
    if (!isFighterAlive(fighter)) continue;
    // 기절 시간은 위에서 흐르지만 행동 시계인 공격 쿨다운은 멈춘다. 즉 이동·추적·평타·자동
    // 궁극기와 함께 행동 자체가 정지하며, 정확히 0이 된 스텝부터 기존 쿨다운을 이어서 처리한다.
    if (fighter.stunnedFor > 0 || fighter.staggeredFor > 0) {
      fighter.hop *= recovery;
      continue;
    }
    const target = resolveTarget(state, fighter);
    if (!target) continue;

    const dx = target.x - fighter.x;
    const dy = target.y - fighter.y;
    const gap = Math.hypot(dx, dy) || 0.001;
    // 세로로 거의 겹쳐 있을 때 좌우가 깜빡이지 않도록 일정 거리부터만 방향을 바꾼다.
    if (Math.abs(dx) > SKIRMISH.facingDeadzone) fighter.facing = dx >= 0 ? 1 : -1;
    // 붙는 동안에도 시계가 흘러야 접촉하자마자 첫 타가 나간다.
    fighter.attackCooldown -= dt;

    // 붙을 때와 떨어질 때의 기준을 다르게 둬 경계에서 걷다 서다를 반복하지 않는다.
    fighter.engaged = fighter.engaged ? gap <= SKIRMISH.reach : gap <= SKIRMISH.reach * SKIRMISH.engageRatio;

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
      strike(fighter, target, rng, state, events, fighter.side === "enemy" && canFireUltimate(state, fighter));
      // 보스에게 경감·보호막 후 실제 적용된 피해만 점수로 옮기며 불사 경계는 HP 0의 사망 경로를 차단한다.
      if (state.boss && target.id === state.boss.fighterId) {
        const scored = [...events].reverse().find((event): event is Extract<SkirmishEvent, { kind: "attack" }> => event.kind === "attack" && event.attackerId === fighter.id && event.targetId === target.id);
        state.boss.score += scored?.scoreAmount ?? scored?.amount ?? 0;
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
  if (state.phase !== "fight" || !isFighterAlive(fighter) || fighter.stunnedFor > 0 || fighter.staggeredFor > 0 || !canUseUltimate(fighter)) return false;
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

  if (attacker.def.ultimate.targeting === "battlefieldAllies" && "healing" in attacker.def.ultimate) {
    // 각 대상의 시전 순간 잃은 체력을 따로 계산해 20%씩 회복하고 정확히 50 게이지를 소비한다.
    attacker.energy -= attacker.def.ultimate.cost;
    for (const ally of aliveFighters(state, attacker.side)) {
      const amount = applyHealing(state, ally, (ally.maxHp - ally.hp) * attacker.def.ultimate.healing.percent / 100);
      if (amount > 0) events.push({ kind: "heal", fighterId: ally.id, amount, source: "ultimate" });
    }
    attacker.attackCooldown = attackInterval(attacker, state);
    return events;
  }

  const target = resolveTarget(state, attacker);
  if (!target) return events;

  strike(attacker, target, rng, state, events, true, undefined, targetPoint);
  // 수동 궁극기도 평타와 동일하게 보스에게 실제 적용된 피해만 점수화한다.
  if (state.boss && target.id === state.boss.fighterId) {
    state.boss.score += events.reduce((sum, event) => sum + (event.kind === "attack" && event.attackerId === attacker.id && event.targetId === state.boss!.fighterId ? (event.scoreAmount ?? event.amount) : 0), 0);
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
  const events: SkirmishEvent[] = [];
  if (state.phase !== "fight" || dt <= 0) return events;

  let remaining = Math.min(dt, SKIRMISH.maxCatchUp);
  while (remaining > 0 && state.phase === "fight") {
    const step = Math.min(remaining, SKIRMISH.maxStep);
    advance(state, step, rng, events);
    // 최대치에서 시작한 피버는 공격 여부와 무관하게 실제 전투 시간만큼 자연 감소한다.
    state.fighters.forEach((fighter) => drainFerocityFever(fighter, step));
    remaining -= step;
  }
  return events;
}
