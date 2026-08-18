import type { RelicDef, Side } from "./types";

/**
 * 턴제 3인 파티 전투.
 *
 * 진형은 전방 1 · 후방 2다. 공격은 기본적으로 전방끼리 주고받지만, 후방을 노리는 특수 공격과
 * 후방에서 전방을 돕는 서포트 스킬이 있어 3명 모두가 쓰인다.
 *
 * 스왑도 한 턴을 소모한다. 게다가 스왑한 다음 턴에는 다시 스왑할 수 없어서(쿨다운),
 * "강한 공격은 탱커로 막고 때릴 때 스왑한다"는 판단에 대가가 붙는다.
 *
 * 난수를 쓰지 않는다. 같은 입력이면 언제나 같은 결과가 나와서 테스트로 규칙을 고정할 수 있다.
 */

export interface BattleUnit {
  def: RelicDef;
  hp: number;
  maxHp: number;
  /** 궁극기 게이지. 행동할 때마다 찬다. */
  energy: number;
  /** 이번 턴에 걸린 공격력 버프(%). 서포트 buff로 붙고 쓰면 사라진다. */
  atkBuff: number;
  /** 스왑으로 막 전방에 나왔는지. swapMomentum 패시브가 이걸 본다. */
  justSwapped: boolean;
}

export interface Team {
  /** 항상 3명. `order[0]`이 전방, 나머지가 후방이다. 쓰러진 유닛도 자리를 지킨다. */
  units: BattleUnit[];
  /** units 배열의 인덱스를 진형 순서로 담는다. */
  order: number[];
  /** 0이 아니면 이번 턴에는 스왑할 수 없다. */
  swapCooldown: number;
}

export type BattleAction =
  | { kind: "basic" }
  | { kind: "ultimate" }
  /** 후방 유닛의 서포트 스킬을 쓴다. `memberIndex`는 units 배열의 인덱스. */
  | { kind: "support"; memberIndex: number }
  /** 후방 유닛과 전방을 맞바꾼다. */
  | { kind: "swap"; memberIndex: number };

export type BattlePhase = "player" | "enemy" | "victory" | "defeat";

export interface BattleState {
  player: Team;
  enemy: Team;
  phase: BattlePhase;
  turn: number;
  log: string[];
}

export const ULTIMATE_MAX = 100;
/** 행동 한 번에 차는 궁극기 게이지. */
const ENERGY_PER_ACTION = 25;

function makeUnit(def: RelicDef): BattleUnit {
  return {
    def,
    hp: def.stats.hp,
    maxHp: def.stats.hp,
    energy: 0,
    atkBuff: 0,
    justSwapped: false,
  };
}

function makeTeam(defs: RelicDef[]): Team {
  return {
    units: defs.map(makeUnit),
    order: defs.map((_, i) => i),
    swapCooldown: 0,
  };
}

export function createBattle(playerDefs: RelicDef[], enemyDefs: RelicDef[]): BattleState {
  return {
    player: makeTeam(playerDefs),
    enemy: makeTeam(enemyDefs),
    phase: "player",
    turn: 1,
    log: [],
  };
}

export function frontUnit(team: Team): BattleUnit {
  return team.units[team.order[0]];
}

export function rearUnits(team: Team): BattleUnit[] {
  return team.order.slice(1).map((i) => team.units[i]);
}

export function isAlive(unit: BattleUnit): boolean {
  return unit.hp > 0;
}

export function teamDefeated(team: Team): boolean {
  return team.units.every((u) => !isAlive(u));
}

/**
 * 피해량. 방어력이 높을수록 감소폭이 커지지만 0으로 수렴하진 않는다.
 * 전방 탱커의 frontGuard 패시브는 여기서 한 번 더 깎아준다.
 */
export function computeDamage(
  attacker: BattleUnit,
  target: BattleUnit,
  power: number,
  targetIsFront: boolean,
): number {
  const atk = attacker.def.stats.atk * (1 + attacker.atkBuff / 100);
  const momentum =
    attacker.justSwapped && attacker.def.passive.kind === "swapMomentum"
      ? 1 + attacker.def.passive.value / 100
      : 1;
  const raw = ((atk * power) / 100) * momentum;
  const afterDef = (raw * 100) / (100 + target.def.stats.def);
  const guard =
    targetIsFront && target.def.passive.kind === "frontGuard"
      ? 1 - target.def.passive.value / 100
      : 1;
  return Math.max(1, Math.round(afterDef * guard));
}

function applyDamage(target: BattleUnit, amount: number): void {
  target.hp = Math.max(0, target.hp - amount);
}

function gainEnergy(unit: BattleUnit): void {
  unit.energy = Math.min(ULTIMATE_MAX, unit.energy + ENERGY_PER_ACTION);
}

/** 쓰러진 유닛이 전방에 있으면 살아있는 후방 유닛을 자동으로 앞에 세운다. */
function promoteIfFallen(team: Team): void {
  if (isAlive(frontUnit(team))) return;
  const nextIndex = team.order.findIndex((i, pos) => pos > 0 && isAlive(team.units[i]));
  if (nextIndex === -1) return;
  const [moved] = team.order.splice(nextIndex, 1);
  team.order.unshift(moved);
}

/** 후방에 있는 rearMend 패시브 유닛이 턴마다 전방을 조금 회복시킨다. */
function tickRearPassives(team: Team, state: BattleState): void {
  const front = frontUnit(team);
  if (!isAlive(front)) return;
  for (const unit of rearUnits(team)) {
    if (!isAlive(unit) || unit.def.passive.kind !== "rearMend") continue;
    const healed = Math.min(unit.def.passive.value, front.maxHp - front.hp);
    if (healed <= 0) continue;
    front.hp += healed;
    state.log.push(`${unit.def.name}의 ${unit.def.passive.name} — ${front.def.name} HP +${healed}`);
  }
}

export function canSwap(team: Team, memberIndex: number): boolean {
  if (team.swapCooldown > 0) return false;
  const pos = team.order.indexOf(memberIndex);
  if (pos <= 0) return false; // 이미 전방이거나 없는 유닛
  return isAlive(team.units[memberIndex]);
}

export function canUseUltimate(unit: BattleUnit): boolean {
  return isAlive(unit) && unit.energy >= unit.def.ultimate.cost;
}

export function canUseSupport(team: Team, memberIndex: number): boolean {
  const pos = team.order.indexOf(memberIndex);
  if (pos <= 0) return false; // 서포트는 후방에서만 쓴다
  return isAlive(team.units[memberIndex]);
}

/** 한쪽이 행동을 한 번 한다. 규칙 위반이면 아무것도 바꾸지 않고 false를 돌려준다. */
function performAction(state: BattleState, side: Side, action: BattleAction): boolean {
  const team = side === "player" ? state.player : state.enemy;
  const foes = side === "player" ? state.enemy : state.player;
  const front = frontUnit(team);
  const foeFront = frontUnit(foes);

  switch (action.kind) {
    case "swap": {
      if (!canSwap(team, action.memberIndex)) return false;
      const pos = team.order.indexOf(action.memberIndex);
      const outgoing = team.order[0];
      team.order[0] = action.memberIndex;
      team.order[pos] = outgoing;
      // 스왑한 턴 다음에도 한 턴은 스왑할 수 없다.
      team.swapCooldown = 2;
      team.units[outgoing].justSwapped = false;
      team.units[action.memberIndex].justSwapped = true;
      state.log.push(
        `${team.units[outgoing].def.name} ⇄ ${team.units[action.memberIndex].def.name} 스왑`,
      );
      return true;
    }

    case "basic": {
      if (!isAlive(front)) return false;
      const dmg = computeDamage(front, foeFront, front.def.basic.power, true);
      applyDamage(foeFront, dmg);
      gainEnergy(front);
      front.atkBuff = 0;
      front.justSwapped = false;
      state.log.push(`${front.def.name}의 ${front.def.basic.name} — ${foeFront.def.name}에게 ${dmg}`);
      return true;
    }

    case "ultimate": {
      if (!canUseUltimate(front)) return false;
      const ult = front.def.ultimate;
      const dmg = computeDamage(front, foeFront, ult.power, true);
      applyDamage(foeFront, dmg);
      front.energy -= ult.cost;
      front.atkBuff = 0;
      front.justSwapped = false;
      state.log.push(`${front.def.name}의 궁극기 ${ult.name} — ${foeFront.def.name}에게 ${dmg}`);
      return true;
    }

    case "support": {
      if (!canUseSupport(team, action.memberIndex)) return false;
      const helper = team.units[action.memberIndex];
      const skill = helper.def.support;
      switch (skill.kind) {
        case "heal": {
          const healed = Math.min(skill.power, front.maxHp - front.hp);
          front.hp += healed;
          state.log.push(`${helper.def.name}의 ${skill.name} — ${front.def.name} HP +${healed}`);
          break;
        }
        case "buff": {
          front.atkBuff += skill.power;
          state.log.push(`${helper.def.name}의 ${skill.name} — ${front.def.name} 공격력 +${skill.power}%`);
          break;
        }
      }
      gainEnergy(helper);
      return true;
    }
  }
}

/** 적 AI. 난수 없이 턴 수와 상태만 보고 정한다. */
export function decideEnemyAction(state: BattleState): BattleAction {
  const team = state.enemy;
  const front = frontUnit(team);

  if (canUseUltimate(front)) return { kind: "ultimate" };

  // 전방이 위태로우면 멀쩡한 후방과 교대한다.
  if (front.hp < front.maxHp * 0.3) {
    const relief = team.order.find(
      (i, pos) => pos > 0 && isAlive(team.units[i]) && canSwap(team, i),
    );
    if (relief !== undefined) return { kind: "swap", memberIndex: relief };
  }

  // 서포트는 플레이어 쪽 조작에서 잠시 빠져 있다. 양쪽 규칙을 맞추려고 적도 쓰지 않는다.
  return { kind: "basic" };
}

function settleAfterAction(state: BattleState): void {
  promoteIfFallen(state.player);
  promoteIfFallen(state.enemy);

  if (teamDefeated(state.enemy)) {
    state.phase = "victory";
    state.log.push("전투 종료 — 승리");
    return;
  }
  if (teamDefeated(state.player)) {
    state.phase = "defeat";
    state.log.push("전투 종료 — 패배");
  }
}

/**
 * 플레이어가 행동한다. 규칙에 어긋나면 false를 돌려주고 상태는 그대로 둔다.
 * 성공하면 적 차례로 넘어간다(`state.phase`).
 */
export function playerAct(state: BattleState, action: BattleAction): boolean {
  if (state.phase !== "player") return false;
  if (!performAction(state, "player", action)) return false;

  settleAfterAction(state);
  if (state.phase === "player") state.phase = "enemy";
  return true;
}

/** 적 차례를 진행한다. 끝나면 다음 턴 플레이어 차례가 된다. */
export function enemyTurn(state: BattleState): void {
  if (state.phase !== "enemy") return;

  const action = decideEnemyAction(state);
  // AI가 고른 행동이 규칙에 막히면 기본 공격으로 물러선다.
  if (!performAction(state, "enemy", action)) {
    performAction(state, "enemy", { kind: "basic" });
  }

  settleAfterAction(state);
  if (state.phase !== "enemy") return;

  state.turn += 1;
  state.player.swapCooldown = Math.max(0, state.player.swapCooldown - 1);
  state.enemy.swapCooldown = Math.max(0, state.enemy.swapCooldown - 1);
  tickRearPassives(state.player, state);
  tickRearPassives(state.enemy, state);
  state.phase = "player";
}
