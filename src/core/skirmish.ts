import { attenuateFerocityGain, canUseUltimate, computeDamage, FEROCITY_RULES, isCriticalHit, ULTIMATE_ENERGY_MAX, type BattleUnit } from "./battle";
import type { RelicDef, Side, Skill } from "./types";

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

/** 난전에 참가한 한 명. 턴제 유닛과 같은 체력·게이지 모양을 그대로 쓴다. */
export interface Fighter extends BattleUnit {
  id: string;
  side: Side;
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
}

export type SkirmishPhase = "fight" | "victory" | "defeat";

export interface SkirmishState {
  fighters: Fighter[];
  arena: Arena;
  phase: SkirmishPhase;
  /** 전투가 시작된 뒤 흐른 시간(초). */
  elapsed: number;
  log: string[];
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
  | { kind: "death"; fighterId: string }
  | { kind: "suppress"; fighterId: string }
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
  /** 붙어 있는 동안 상대 주위를 도는 속도 비율. 서서 때리기만 하지 않게 한다. */
  strafe: 0.4,
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

/** 항상 같은 결과를 원하는 호출부(테스트)를 위한 기본 판정값 — 치명타가 나지 않는다. */
const NO_CRIT = (): number => 0.999999;

function makeFighter(def: RelicDef, side: Side, index: number, x: number, y: number, bondLevel = 0): Fighter {
  return {
    def,
    hp: def.stats.hp,
    maxHp: def.stats.hp,
    energy: 0,
    ferocity: 0,
    bondLevel,
    stunTurns: 0,
    justSwapped: false,
    id: `${side}-${index}`,
    side,
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
  };
}

/**
 * 시작 진형.
 *
 * 아군은 아래쪽 끝에서 출발한다. 맵을 넓게 쓰면서 위쪽 적진까지 달려 올라가는 그림을 만들기
 * 위해서다. 같은 팀 셋도 한 줄로 세우지 않고 앞뒤로 어긋나게 둔다.
 */
function spawnSpots(arena: Arena, side: Side): { x: number; y: number }[] {
  const width = arena.right - arena.left;
  // 세 갈래로 넓게 벌려 세운다. 같은 열끼리 맞붙으면 세 싸움이 전장 곳곳에서 따로 벌어진다.
  const columns = [0.08, 0.5, 0.92].map((ratio) => arena.left + width * ratio);
  const stagger = [0, -70, 0];
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
): SkirmishState {
  const playerSpots = spawnSpots(arena, "player");
  const enemySpots = spawnSpots(arena, "enemy");
  return {
    fighters: [
      ...playerDefs.map((def, i) => makeFighter(def, "player", i, playerSpots[i].x, playerSpots[i].y, playerBondLevels[def.id] ?? 0)),
      ...enemyDefs.map((def, i) => makeFighter(def, "enemy", i, enemySpots[i].x, enemySpots[i].y)),
    ],
    arena,
    phase: "fight",
    elapsed: 0,
    log: [],
  };
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
  return (SKIRMISH.attackInterval * 100) / Math.max(1, fighter.def.stats.attackSpeed);
}

/** 이동 속도가 정하는 초당 이동 거리(px). */
export function moveSpeed(fighter: Fighter): number {
  return fighter.def.stats.moveSpeed * SKIRMISH.moveRate;
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

/** 실시간 전투도 턴제와 같은 사건별 증가 및 임계 로그 계약을 사용한다. */
function gainFerocity(fighter: Fighter, base: number, state: SkirmishState): void {
  const before = fighter.ferocity;
  fighter.ferocity = Math.min(FEROCITY_RULES.max, before + attenuateFerocityGain(base, fighter.bondLevel));
  for (const { value } of FEROCITY_RULES.thresholds) {
    if (before < value && fighter.ferocity >= value) state.log.push(`${fighter.def.name} 야성 ${value} 진입`);
  }
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
  const critical = isCriticalHit(attacker.def.stats.critChance, rng());
  const amount = computeDamage(attacker, target, { ...skill, isCritical: critical }, true);

  target.hp = Math.max(0, target.hp - amount);
  if (useUltimate) attacker.energy -= attacker.def.ultimate.cost;
  else gainEnergy(attacker);
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

  events.push({
    kind: "attack",
    attackerId: attacker.id,
    targetId: target.id,
    skill: useUltimate ? "ultimate" : "basic",
    amount,
    critical,
  });
  state.log.push(`${attacker.def.name} → ${target.def.name} ${amount}`);
  if (!isFighterAlive(target)) {
    target.targetId = null;
    events.push({ kind: "death", fighterId: target.id });
    state.log.push(`${target.def.name} 전투 불능`);
  }
}

/** 서로 겹쳐 서지 않도록 가까운 둘을 조금씩 밀어낸다. */
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
      const push = ((SKIRMISH.spacing - gap) / 2) * Math.min(1, SKIRMISH.separationRate * dt);
      a.x -= Math.cos(angle) * push;
      a.y -= Math.sin(angle) * push;
      b.x += Math.cos(angle) * push;
      b.y += Math.sin(angle) * push;
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
      const step = moveSpeed(fighter) * dt;
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

    // 붙은 뒤에도 상대 주위를 천천히 돌며 자리를 바꾼다. 멈춰 서서 주고받는 그림이 되지 않는다.
    const orbit = Math.sin(state.elapsed * 0.9 + fighter.wander) * moveSpeed(fighter) * SKIRMISH.strafe * dt;
    fighter.x += (-dy / gap) * orbit;
    fighter.y += (dx / gap) * orbit;

    if (fighter.attackCooldown <= 0) {
      // 진압 기절은 공격 주기 단위로 감소해 장시간 무방비라는 대가를 눈에 보이게 만든다.
      if (fighter.stunTurns > 0) {
        fighter.stunTurns -= 1;
        fighter.attackCooldown = attackInterval(fighter);
        continue;
      }
      // 야성 100에서는 후방의 살아 있는 아군을 우선 오인 공격한다.
      const confusedTarget = fighter.ferocity >= FEROCITY_RULES.max
        ? state.fighters.find((other) => other.side === fighter.side && other.id !== fighter.id && isFighterAlive(other))
        : undefined;
      // 아군 궁극기는 자동으로 나가지 않는다. 화면에서 누를 때만 fireUltimate로 들어온다.
      strike(fighter, confusedTarget ?? target, rng, state, events, !confusedTarget && fighter.side === "enemy" && canUseUltimate(fighter));
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

/** 통제 불능 프로필을 누르면 궁극기 대신 야성을 비우고 긴 기절을 부여한다. */
export function suppressFerocity(state: SkirmishState, fighterId: string): SkirmishEvent[] {
  const fighter = findFighter(state, fighterId);
  if (!fighter || state.phase !== "fight" || !isFighterAlive(fighter) || fighter.ferocity < FEROCITY_RULES.max) return [];
  fighter.ferocity = FEROCITY_RULES.min;
  fighter.stunTurns = FEROCITY_RULES.suppressionStunTurns;
  fighter.attackCooldown = attackInterval(fighter);
  state.log.push(`${fighter.def.name} 진압 — 야성 0, ${fighter.stunTurns}회 행동 기절 · 통제 회복`);
  return [{ kind: "suppress", fighterId }];
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
    remaining -= step;
  }
  return events;
}
