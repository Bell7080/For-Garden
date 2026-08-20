import { canUseUltimate, computeDamage, isCriticalHit, ULTIMATE_ENERGY_MAX, type BattleUnit } from "./battle";
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
  /** 붙는 각도를 사람마다 어긋나게 만드는 고유 위상. 여섯이 한 점에 겹치지 않게 한다. */
  wander: number;
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
  /** 이미 그 상대에게 붙은 아군 한 명당 더해지는 거리 가중치. 셋이 한 명에게 몰리지 않는다. */
  crowdPenalty: 240,
  /** 상대에게 곧장 가지 않고 옆으로 흐르는 정도. 패싸움처럼 보이게 한다. */
  swirl: 0.32,
  /** 붙어 있는 동안 상대 주위를 도는 속도 비율. 서서 때리기만 하지 않게 한다. */
  strafe: 0.4,
  /** 한 번에 적분하는 최대 시간(초). 프레임이 길어도 서로를 통과하지 않는다. */
  maxStep: 0.05,
  /** 탭 전환 등으로 프레임이 통째로 밀렸을 때 한꺼번에 진행할 상한(초). */
  maxCatchUp: 0.25,
} as const;

/** 항상 같은 결과를 원하는 호출부(테스트)를 위한 기본 판정값 — 치명타가 나지 않는다. */
const NO_CRIT = (): number => 0.999999;

function makeFighter(def: RelicDef, side: Side, index: number, x: number, y: number): Fighter {
  return {
    def,
    hp: def.stats.hp,
    maxHp: def.stats.hp,
    energy: 0,
    justSwapped: false,
    id: `${side}-${index}`,
    side,
    x,
    y,
    facing: side === "player" ? 1 : -1,
    // 시작하자마자 전원이 동시에 때리지 않도록 첫 공격만 조금씩 어긋나게 둔다.
    attackCooldown: index * 0.18,
    targetId: null,
    wander: index * 2.1 + (side === "player" ? 0 : 1.05),
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
): SkirmishState {
  const playerSpots = spawnSpots(arena, "player");
  const enemySpots = spawnSpots(arena, "enemy");
  return {
    fighters: [
      ...playerDefs.map((def, i) => makeFighter(def, "player", i, playerSpots[i].x, playerSpots[i].y)),
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
  fighter.energy = Math.min(ULTIMATE_ENERGY_MAX, fighter.energy + fighter.def.stats.ferocity);
}

/** 한 번 때린다. 게이지가 찼으면 궁극기를 먼저 쓴다. */
function strike(
  attacker: Fighter,
  target: Fighter,
  rng: () => number,
  state: SkirmishState,
  events: SkirmishEvent[],
): void {
  const useUltimate = canUseUltimate(attacker);
  const skill: Skill = useUltimate ? attacker.def.ultimate : attacker.def.basic;
  const critical = isCriticalHit(attacker.def.stats.critChance, rng());
  const amount = computeDamage(attacker, target, { ...skill, isCritical: critical }, true);

  target.hp = Math.max(0, target.hp - amount);
  if (useUltimate) attacker.energy -= attacker.def.ultimate.cost;
  else gainEnergy(attacker);

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

/** 서로 겹쳐 서지 않도록 가까운 둘을 반씩 밀어낸다. */
function separate(state: SkirmishState): void {
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
      const push = (SKIRMISH.spacing - gap) / 2;
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

  for (const fighter of state.fighters) {
    if (!isFighterAlive(fighter)) continue;
    const target = resolveTarget(state, fighter);
    if (!target) continue;

    const dx = target.x - fighter.x;
    const dy = target.y - fighter.y;
    const gap = Math.hypot(dx, dy) || 0.001;
    fighter.facing = dx >= 0 ? 1 : -1;
    // 붙는 동안에도 시계가 흘러야 접촉하자마자 첫 타가 나간다.
    fighter.attackCooldown -= dt;

    if (gap > SKIRMISH.reach) {
      const step = moveSpeed(fighter) * dt;
      // 곧장 달려들지 않고 조금씩 옆으로 흘러 여섯이 서로를 돌며 붙는다.
      const swirl = Math.sin(state.elapsed * 1.7 + fighter.wander) * SKIRMISH.swirl;
      fighter.x += ((dx / gap) + (-dy / gap) * swirl) * step;
      fighter.y += ((dy / gap) + (dx / gap) * swirl) * step;
      continue;
    }

    // 붙은 뒤에도 상대 주위를 천천히 돌며 자리를 바꾼다. 멈춰 서서 주고받는 그림이 되지 않는다.
    const orbit = Math.sin(state.elapsed * 0.9 + fighter.wander) * moveSpeed(fighter) * SKIRMISH.strafe * dt;
    fighter.x += (-dy / gap) * orbit;
    fighter.y += (dx / gap) * orbit;

    if (fighter.attackCooldown <= 0) {
      strike(fighter, target, rng, state, events);
      fighter.attackCooldown = attackInterval(fighter);
    }
  }

  separate(state);
  clampToArena(state);
  settle(state, events);
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
