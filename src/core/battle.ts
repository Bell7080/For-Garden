import type { DamageType, RelicDef, Side, Skill } from "./types";

/** 모든 유닛이 저장할 수 있는 궁극기 게이지의 공용 상한이다. 스킬 비용과는 별개다. */
export const ULTIMATE_ENERGY_MAX = 150;

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
  | { kind: "basic"; criticalRoll?: number }
  | { kind: "ultimate"; criticalRoll?: number }
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

/** 피해 계산에 필요한, 호출자가 명시적으로 확정하는 판정값이다. */
export interface DamageInput {
  power: number;
  damageType: DamageType;
  /** 확률 난수를 코어에 숨기지 않아 리플레이와 테스트를 결정적으로 유지한다. */
  isCritical: boolean;
}

/** 정보창이 확정 피해와 상태 없는 배율을 혼동하지 않도록 하는 순수 미리보기 결과다. */
export type DamagePreview =
  | { kind: "damage"; amount: number; label: "예상 피해" }
  | { kind: "scaling"; power: number; stat: "공격력" | "주문력"; label: "기준 배율" };

/**
 * 전투 상태를 변경하지 않고 비치명타 한 번의 피해를 미리 본다.
 * 대상이 없는 도감에서는 방어력을 임의로 가정하지 않고 능력치 배율만 돌려준다.
 */
export function previewSkillDamage(
  attacker: BattleUnit,
  skill: Skill,
  target?: BattleUnit,
  targetIsFront = false,
): DamagePreview {
  if (!target) {
    return {
      kind: "scaling",
      power: skill.power,
      stat: skill.damageType === "physical" ? "공격력" : "주문력",
      label: "기준 배율",
    };
  }
  return {
    kind: "damage",
    amount: computeDamage(attacker, target, { ...skill, isCritical: false }, targetIsFront),
    label: "예상 피해",
  };
}

/** 0 이상 1 미만의 주입된 판정값으로 치명타 여부를 결정한다. */
export function isCriticalHit(critChance: number, roll: number): boolean {
  // 범위를 벗어난 난수는 호출자 오류를 조용히 보정하지 않는다.
  if (roll < 0 || roll >= 1)
    throw new RangeError("critical roll은 0 이상 1 미만이어야 합니다.");
  return roll < critChance / 100;
}

function makeUnit(def: RelicDef): BattleUnit {
  return {
    def,
    hp: def.stats.hp,
    maxHp: def.stats.hp,
    energy: 0,
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

export function createBattle(
  playerDefs: RelicDef[],
  enemyDefs: RelicDef[],
): BattleState {
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
  input: DamageInput,
  targetIsFront: boolean,
): number {
  // 피해 유형에 맞는 공격·방어 능력치만 짝지어 사용한다.
  const offense =
    input.damageType === "physical"
      ? attacker.def.stats.atk
      : attacker.def.stats.ap;
  const defense =
    input.damageType === "physical"
      ? target.def.stats.def
      : target.def.stats.res;
  const momentum =
    attacker.justSwapped && attacker.def.passive.kind === "swapMomentum"
      ? 1 + attacker.def.passive.value / 100
      : 1;
  const critical = input.isCritical ? attacker.def.stats.critDamage / 100 : 1;
  const raw = ((offense * input.power) / 100) * momentum * critical;
  const afterDef = (raw * 100) / (100 + defense);
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
  // 저비용 궁극기를 준비한 뒤에도 남는 게이지를 더 저장할 수 있도록 공용 상한을 적용한다.
  unit.energy = Math.min(ULTIMATE_ENERGY_MAX, unit.energy + unit.def.stats.ferocity);
}

/** 쓰러진 유닛이 전방에 있으면 살아있는 후방 유닛을 자동으로 앞에 세운다. */
function promoteIfFallen(team: Team): void {
  if (isAlive(frontUnit(team))) return;
  const nextIndex = team.order.findIndex(
    (i, pos) => pos > 0 && isAlive(team.units[i]),
  );
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
    state.log.push(
      `${unit.def.name}의 ${unit.def.passive.name} — ${front.def.name} HP +${healed}`,
    );
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

/** 한쪽이 행동을 한 번 한다. 규칙 위반이면 아무것도 바꾸지 않고 false를 돌려준다. */
function performAction(
  state: BattleState,
  side: Side,
  action: BattleAction,
): boolean {
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
      // 생략 시 가장 높은 비치명타 판정값을 써서 자동전투도 항상 재현 가능하다.
      const isCritical = isCriticalHit(
        front.def.stats.critChance,
        action.criticalRoll ?? 0.999999,
      );
      const dmg = computeDamage(
        front,
        foeFront,
        { ...front.def.basic, isCritical },
        true,
      );
      applyDamage(foeFront, dmg);
      gainEnergy(front);
      front.justSwapped = false;
      state.log.push(
        `${front.def.name}의 ${front.def.basic.name} — ${foeFront.def.name}에게 ${dmg}`,
      );
      return true;
    }

    case "ultimate": {
      if (!canUseUltimate(front)) return false;
      const ult = front.def.ultimate;
      // 궁극기도 동일한 주입 판정 경로를 사용해 결과를 재현 가능하게 유지한다.
      const isCritical = isCriticalHit(
        front.def.stats.critChance,
        action.criticalRoll ?? 0.999999,
      );
      const dmg = computeDamage(front, foeFront, { ...ult, isCritical }, true);
      applyDamage(foeFront, dmg);
      front.energy -= ult.cost;
      front.justSwapped = false;
      state.log.push(
        `${front.def.name}의 궁극기 ${ult.name} — ${foeFront.def.name}에게 ${dmg}`,
      );
      return true;
    }
  }
}

/** 적 AI. 난수 없이 턴 수와 상태만 보고 정한다. */
export function decideEnemyAction(state: BattleState): BattleAction {
  const team = state.enemy;
  const front = frontUnit(team);

  if (canUseUltimate(front)) return { kind: "ultimate" };

  // 자동 전투에서는 생존 교대보다 공격을 우선해 흐름이 끊기지 않게 한다.
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
