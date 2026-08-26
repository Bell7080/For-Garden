import { amplifyFerocityGain } from "./bond";
import type { Combatant } from "./combatTypes";
import { computeDamage, isCriticalHit } from "./damage";
import { drainFerocityFever, FEROCITY_RULES } from "./ferocity";
import { breakthroughBonus } from "./relicProgression";
import { attackPowerMultiplier, bleedOnAttackEffect, type ExpeditionAugmentEffect } from "./expeditionAugments";
import type { RelicDef, Side, Skill } from "./types";
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
  /** 걸려 있는 출혈. 없으면 null이다. */
  bleed: { remaining: number; tickIn: number; percent: number } | null;
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
}

/** 씬이 모션·피격 숫자·사망 연출을 붙일 수 있도록 이번 프레임에 일어난 일만 모아 돌려준다. */
export type SkirmishEvent =
  | {
      kind: "attack";
      attackerId: string;
      targetId: string;
      skill: "basic" | "ultimate";
      amount: number;
      critical: boolean;
    }
  | { kind: "bleed"; fighterId: string; amount: number; started: boolean }
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
    bleed: null,
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
  const playerSpots = spawnSpots(arena, "player", playerDefs.length);
  const enemySpots = spawnSpots(arena, "enemy", enemyDefs.length);
  const initialById = new Map(options.playerInitialStates?.map((snapshot) => [snapshot.relicId, snapshot]));
  const players = playerDefs.map((def, i) => {
    const fighter = makeFighter(def, "player", i, playerSpots[i].x, playerSpots[i].y, playerBondLevels[def.id] ?? 0, playerBreakthroughs[def.id] ?? 0);
    const saved = initialById.get(def.id);
    if (saved) fighter.hp = saved.alive ? fighter.maxHp * Math.min(100, Math.max(0, saved.currentHp)) / 100 : 0;
    return fighter;
  });
  return {
    fighters: [
      ...players,
      ...enemyDefs.map((def, i) => makeFighter(def, "enemy", i, enemySpots[i].x, enemySpots[i].y, 0, 0, options.enemyBodyScale ?? 1)),
    ],
    arena,
    phase: "fight",
    elapsed: 0,
    log: [],
    augmentEffects: options.augmentEffects ?? [],
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
  return fighter.hp > 0;
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
export function attackInterval(fighter: Fighter): number {
  const trait = fighter.def.ferocityTrait;
  // 개별 공속은 공용 야성 피해 보너스를 다시 건드리지 않고 재사용 대기시간에만 곱한다.
  const feverMultiplier = fighter.ferocityFever && trait.effectId === "attackIntervalReduction"
    ? 1 - trait.reductionPercent / 100
    : 1;
  return ((SKIRMISH.attackInterval * 100) / Math.max(1, fighter.def.stats.attackSpeed)) * feverMultiplier;
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
  if (current && isFighterAlive(current)) return current;

  // 가장 가깝더라도 이미 아군이 붙어 있는 상대는 뒤로 미룬다. 셋이 한 명을 둘러싸는 대신
  // 서로 다른 상대와 맞붙어 전장 곳곳에서 싸우는 그림이 된다.
  let chosen: Fighter | undefined;
  let bestScore = Infinity;
  for (const other of state.fighters) {
    if (other.side === fighter.side || !isFighterAlive(other)) continue;
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
  fighter.energy = Math.min(ULTIMATE_ENERGY_MAX, fighter.energy + fighter.def.stats.energyGain);
}

/** 피버 공격이 아군 에너지를 보조한다. 공격자 자신의 기본 획득과는 분리한다. */
function grantFerocityTeamEnergy(attacker: Fighter, state: SkirmishState): void {
  const trait = attacker.def.ferocityTrait;
  if (!attacker.ferocityFever || trait.effectId !== "allyEnergyGain") return;
  for (const ally of state.fighters) {
    if (ally.side === attacker.side && ally.id !== attacker.id && isFighterAlive(ally)) {
      ally.energy = Math.min(ULTIMATE_ENERGY_MAX, ally.energy + trait.energy);
    }
  }
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
  if (before < FEROCITY_RULES.max && fighter.ferocity >= FEROCITY_RULES.max) fighter.ferocityFever = true;
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
  target.bleed = { remaining: BLEED.seconds, tickIn: 1, percent: BLEED.percentPerSecond };
  events.push({ kind: "bleed", fighterId: target.id, amount: 0, started: true });
}

/** 걸린 출혈을 1초 간격으로 깎는다. 방어력을 거치지 않는 고정 피해다. */
function tickBleed(fighter: Fighter, dt: number, state: SkirmishState, events: SkirmishEvent[]): void {
  const bleed = fighter.bleed;
  if (!bleed) return;
  bleed.remaining -= dt;
  bleed.tickIn -= dt;
  while (bleed.tickIn <= 0 && isFighterAlive(fighter)) {
    const amount = Math.max(1, Math.round((fighter.maxHp * bleed.percent) / 100));
    fighter.hp = Math.max(0, fighter.hp - amount);
    events.push({ kind: "bleed", fighterId: fighter.id, amount, started: false });
    state.log.push(`${fighter.def.name} 출혈 ${amount}`);
    bleed.tickIn += 1;
    if (!isFighterAlive(fighter)) {
      fighter.targetId = null;
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
): void {
  const skill: Skill = useUltimate ? attacker.def.ultimate : attacker.def.basic;
  // 이번 타격 시작 시점의 피버만 본다. 이 공격으로 100에 도달했다면 다음 공격부터 발현한다.
  const attackingInFever = attacker.ferocityFever;
  const critTrait = attacker.def.ferocityTrait;
  // 수치가 100%를 넘더라도 판정 함수에는 유효한 확률만 전달한다.
  const criticalChance = attacker.def.stats.critChance
    + (attackingInFever && critTrait.effectId === "criticalChanceBonus" ? critTrait.chancePercent : 0);
  const critical = isCriticalHit(Math.min(100, criticalChance), rng());
  const damageInput = { ...skill, isCritical: critical, kind: useUltimate ? "ultimate" as const : "basic" as const };
  // 공용 피해 공식을 그대로 통과한 뒤 원정 공격력 증강만 최종 배율로 한 번 적용한다.
  const rawAmount = Math.max(1, Math.round(computeDamage(attacker, target, damageInput, true) * attackPowerMultiplier(state.augmentEffects, attacker.def.id)));
  const guardTrait = target.def.ferocityTrait;
  // 개별 경감은 방어·패시브·상성까지 끝난 공용 피해의 마지막에 한 번만 적용한다.
  const amount = target.ferocityFever && guardTrait.effectId === "damageReduction"
    ? Math.max(1, Math.round(rawAmount * (1 - guardTrait.reductionPercent / 100)))
    : rawAmount;

  const targetHpBefore = target.hp;
  target.hp = Math.max(0, target.hp - amount);
  /**
   * 흡혈 규칙: 보호막을 통과한 뒤 실제 HP에서 빠진 직접/광역 피해에만 적용한다.
   * 과잉 피해는 제외하고, 출혈 같은 별도 고정 피해에는 적용하지 않는다. 현재 보호막 모델이
   * 생기면 이 지점에 도달하는 HP 피해만 넘기면 규칙이 그대로 유지된다.
   */
  const healFromDamage = (dealt: number) => {
    attacker.hp = Math.min(attacker.maxHp, attacker.hp + dealt * attacker.def.stats.lifeSteal / 100);
  };
  healFromDamage(targetHpBefore - target.hp);
  if (useUltimate) attacker.energy -= attacker.def.ultimate.cost;
  else gainEnergy(attacker);
  grantFerocityTeamEnergy(attacker, state);
  gainFerocity(attacker, useUltimate ? FEROCITY_RULES.ultimateGain : FEROCITY_RULES.basicGain, state);
  gainFerocity(target, FEROCITY_RULES.hitGain, state);

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
    // 출혈은 단일 슬롯 정책이다. 재적용 시 더 센 비율과 더 긴 남은 시간을 보존해 약한 효과가 덮지 않는다.
    target.bleed = { remaining: Math.max(target.bleed?.remaining ?? 0, augmentBleed.seconds), tickIn: target.bleed?.tickIn ?? 1, percent: Math.max(target.bleed?.percent ?? 0, augmentBleed.percent) };
    events.push({ kind: "bleed", fighterId: target.id, amount: 0, started: true });
  }

  events.push({
    kind: "attack",
    attackerId: attacker.id,
    targetId: target.id,
    skill: useUltimate ? "ultimate" : "basic",
    amount,
    critical,
  });

  // 광역 피해는 주 대상 타격의 부가 결과이며 에너지·야성·연속 공격을 추가 획득하지 않는다.
  const splashTrait = attacker.def.ferocityTrait;
  if (attackingInFever && splashTrait.effectId === "splashDamage") {
    for (const secondary of state.fighters) {
      if (secondary.side === attacker.side || secondary.id === target.id || !isFighterAlive(secondary)
        || distance(target, secondary) > splashTrait.radius) continue;
      // 광역도 같은 공격의 일부이므로 주 대상과 동일한 원정 공격력 배율을 거친다.
      const secondaryBase = computeDamage(attacker, secondary, damageInput, true) * attackPowerMultiplier(state.augmentEffects, attacker.def.id);
      const secondaryGuard = secondary.def.ferocityTrait;
      const reduced = secondary.ferocityFever && secondaryGuard.effectId === "damageReduction"
        ? secondaryBase * (1 - secondaryGuard.reductionPercent / 100)
        : secondaryBase;
      const splashAmount = Math.max(1, Math.round(reduced * splashTrait.damagePercent / 100));
      const secondaryHpBefore = secondary.hp;
      secondary.hp = Math.max(0, secondary.hp - splashAmount);
      // 광역 피해도 공격자가 실제로 입힌 HP 피해이므로 같은 흡혈 규칙에 포함한다.
      healFromDamage(secondaryHpBefore - secondary.hp);
      events.push({ kind: "attack", attackerId: attacker.id, targetId: secondary.id, skill: useUltimate ? "ultimate" : "basic", amount: splashAmount, critical });
      if (!isFighterAlive(secondary)) events.push({ kind: "death", fighterId: secondary.id });
    }
  }
  state.log.push(`${attacker.def.name} → ${target.def.name} ${amount}`);
  if (!isFighterAlive(target)) {
    target.targetId = null;
    events.push({ kind: "death", fighterId: target.id });
    state.log.push(`${target.def.name} 전투 불능`);
  }
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
      const movable = [!a.engaged, !b.engaged];
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
  if (enemiesLeft === 0) state.phase = "victory";
  else if (playersLeft === 0) state.phase = "defeat";
  else return;
  events.push({ kind: "finish", phase: state.phase });
}

function advance(state: SkirmishState, dt: number, rng: () => number, events: SkirmishEvent[]): void {
  state.elapsed += dt;

  // 돌진·피격 변위는 시간이 지나면 제자리로 돌아온다. 죽은 캐릭터도 마지막 밀림은 마저 푼다.
  const recovery = Math.exp(-SKIRMISH.recover * dt);
  for (const fighter of state.fighters) {
    fighter.dashX *= recovery;
    fighter.dashY *= recovery;
  }

  for (const fighter of state.fighters) {
    if (!isFighterAlive(fighter)) {
      fighter.hop *= recovery;
      fighter.bleed = null;
      continue;
    }
    // 출혈은 붙어 있든 달려가든 흐르는 시간만큼 깎는다.
    tickBleed(fighter, dt, state, events);
    if (!isFighterAlive(fighter)) continue;
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
      strike(fighter, target, rng, state, events, fighter.side === "enemy" && canUseUltimate(fighter));
      fighter.attackCooldown = attackInterval(fighter);
    }
  }

  separate(state, dt);
  clampToArena(state);
  settle(state, events);
}

/** 지금 궁극기를 쓸 수 있는지. 게이지가 찼고, 살아 있고, 때릴 상대가 남아 있어야 한다. */
export function canFireUltimate(state: SkirmishState, fighter: Fighter): boolean {
  if (state.phase !== "fight" || !isFighterAlive(fighter) || !canUseUltimate(fighter)) return false;
  return state.fighters.some((other) => other.side !== fighter.side && isFighterAlive(other));
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
): SkirmishEvent[] {
  const events: SkirmishEvent[] = [];
  const attacker = findFighter(state, fighterId);
  if (!attacker || !canFireUltimate(state, attacker)) return events;

  const target = resolveTarget(state, attacker);
  if (!target) return events;

  strike(attacker, target, rng, state, events, true);
  // 방금 크게 휘둘렀으니 다음 평타까지의 간격도 새로 센다.
  attacker.attackCooldown = attackInterval(attacker);
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
