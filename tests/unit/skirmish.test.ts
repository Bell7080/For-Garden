import { describe, expect, it } from "vitest";
import {
  aliveFighters,
  applyStun,
  BLEED,
  EMERGENCY_RECOVERY,
  attackInterval,
  canFireUltimate,
  clearStun,
  createSkirmish,
  fireUltimate,
  findFighter,
  moveSpeed,
  renderPose,
  receivedDamage,
  SKIRMISH,
  stepSkirmish,
  teamHp,
  tickRegeneration,
  tryTriggerEmergencyRecovery,
  type Arena,
  type SkirmishEvent,
  type SkirmishState,
} from "../../src/core/skirmish";
import { applyExpeditionRest, type ExpeditionAugmentEffect } from "../../src/core/expeditionAugments";
import { getRelic } from "../../src/data/relics";
import { FEROCITY_RULES } from "../../src/core/ferocity";
import { ULTIMATE_ENERGY_MAX } from "../../src/core/ultimate";
import { computeDamage } from "../../src/core/damage";
import {
  beginNextUltimate, cancelUltimateSequence, createUltimateSequenceState, enqueueUltimate, releaseUltimate,
} from "../../src/core/ultimateSequence";

describe("궁극기 연출 직렬 상태", () => {
  it("는 중복 발동을 막고 올바른 토큰만 잠금을 해제한다", () => {
    const sequence = createUltimateSequenceState();
    expect(enqueueUltimate(sequence, "player-0")).toBe(true);
    expect(enqueueUltimate(sequence, "player-0")).toBe(false);
    const first = beginNextUltimate(sequence)!;
    expect(beginNextUltimate(sequence)).toBeNull();
    expect(releaseUltimate(sequence, first.token + 1)).toBe(false);
    expect(releaseUltimate(sequence, first.token)).toBe(true);
  });

  it("는 전투 종료 취소가 활성 연출과 남은 자동 큐를 모두 비운다", () => {
    const sequence = createUltimateSequenceState();
    enqueueUltimate(sequence, "player-0");
    enqueueUltimate(sequence, "player-1");
    const active = beginNextUltimate(sequence)!;
    cancelUltimateSequence(sequence);
    expect(sequence.activeToken).toBeNull();
    expect(sequence.queue).toEqual([]);
    // 취소 전에 잡은 비동기 완료는 새 상태의 잠금을 건드릴 수 없다.
    expect(releaseUltimate(sequence, active.token)).toBe(false);
  });

  it("는 동시에 준비된 자동 궁극기를 편성 순서대로 한 번씩 꺼낸다", () => {
    const sequence = createUltimateSequenceState();
    ["player-0", "player-1"].forEach((id) => {
      enqueueUltimate(sequence, id);
      enqueueUltimate(sequence, id);
    });
    const fired: string[] = [];
    for (let next = beginNextUltimate(sequence); next; next = beginNextUltimate(sequence)) {
      fired.push(next.fighterId);
      releaseUltimate(sequence, next.token);
    }
    expect(fired).toEqual(["player-0", "player-1"]);
  });
});

const ARENA: Arena = { left: 130, right: 950, top: 600, bottom: 1360 };

function newSkirmish(player = ["anky", "rex", "dodo"], enemy = ["husk-raptor", "husk-shell", "husk-wing"]): SkirmishState {
  return createSkirmish(player.map(getRelic), enemy.map(getRelic), ARENA);
}

/** 실제 프레임처럼 잘게 나눠 굴린다. */
function run(state: SkirmishState, seconds: number, rng?: () => number) {
  const events = [];
  for (let t = 0; t < seconds; t += 1 / 60) events.push(...stepSkirmish(state, 1 / 60, rng));
  return events;
}

describe("단일 난전의 원정 보스 옵션", () => {
  /** 보스 옵션도 별도 타이머가 아니라 createSkirmish 상태에 함께 주입한다. */
  function bossBattle(damagePerSecond: number) {
    const state = createSkirmish([getRelic("anky")], [getRelic("husk-shell")], ARENA, {}, {}, {
      boss: { phases: [{ startsAt: 0, damagePerSecond, label: "관측" }], limitSeconds: 1 },
    });
    const [ally, boss] = state.fighters;
    ally.x = boss.x = 400; ally.y = boss.y = 900; ally.attackCooldown = 0; boss.attackCooldown = 999;
    return state;
  }

  it("는 보스 HP가 소진되어도 승리하지 않고 실제 공격 피해를 점수로 누적한다", () => {
    const state = bossBattle(0); state.fighters[1].hp = 1;
    stepSkirmish(state, 1 / 60);
    expect(state.phase).toBe("fight"); expect(state.fighters[1].hp).toBe(state.fighters[1].maxHp); expect(state.boss?.score).toBeGreaterThan(0);
  });

  it("는 생존 시간·리미트를 갱신하고 아군 전멸 때만 패배로 끝낸다", () => {
    const state = bossBattle(stateHp(getRelic("anky")) * 2);
    const events = run(state, 2);
    expect(state.phase).toBe("defeat"); expect(state.boss?.survivedFor).toBeGreaterThan(0); expect(events).toContainEqual({ kind: "finish", phase: "defeat" });
  });
});

/** 테스트 정의의 HP를 읽는 짧은 헬퍼로 밸런스 숫자를 복제하지 않는다. */
function stateHp(def: ReturnType<typeof getRelic>): number { return def.stats.hp; }

/**
 * 토리카의 전투당 1회 회복을 독립 관찰한다. 발동권은 저장 데이터가 아니라 Fighter가 소유하며,
 * 테스트는 공격 행동을 늦춰 초 단위 지속 효과만 진행되게 한다.
 */
function emergencyRecoveryFighter() {
  const state = newSkirmish(["anky"], ["husk-shell"]);
  for (const fighter of state.fighters) fighter.attackCooldown = 999;
  return { state, fighter: state.fighters[0] };
}

describe("긴급 회복 패시브", () => {
  it("는 50% 초과 HP에서 발동하지 않고 정확히 50%인 최초 진입은 포함한다", () => {
    const { fighter } = emergencyRecoveryFighter();
    fighter.hp = fighter.maxHp * 0.5 + 0.001;
    expect(tryTriggerEmergencyRecovery(fighter)).toBe(false);
    fighter.hp = fighter.maxHp * 0.5;
    expect(tryTriggerEmergencyRecovery(fighter)).toBe(true);
    expect(fighter.regeneration).toMatchObject({
      remaining: fighter.def.passive.durationSeconds,
      tickIn: EMERGENCY_RECOVERY.tickSeconds,
      percentPerTick: 7,
    });
  });

  it("는 직접 피해와 출혈 피해가 처음 50% 이하로 내린 직후 공통 발동 경계를 지난다", () => {
    /** 피해 종류 하나만 발생시키고 Fighter가 소유한 전투당 발동권 변화를 반환한다. */
    const afterDamage = (kind: "direct" | "bleed") => {
      const { state, fighter } = emergencyRecoveryFighter();
      const enemy = state.fighters[1];
      fighter.hp = fighter.maxHp * 0.51;
      if (kind === "direct") {
        fighter.x = 460; fighter.y = 1000;
        enemy.x = 400; enemy.y = 1000; enemy.attackCooldown = 0;
      } else {
        // 다음 출혈 틱이 즉시 발생해 51%에서 50% 이하로 진입하도록 최대 HP의 2%를 적용한다.
        fighter.bleed = { remaining: 1, tickIn: 0, percent: 2 };
      }
      stepSkirmish(state, 1 / 60);
      return fighter;
    };
    expect(afterDamage("direct").passiveTriggered).toBe(true);
    expect(afterDamage("bleed").passiveTriggered).toBe(true);
  });

  it("는 5초 동안 1초마다 최대 HP의 7%만 실제 회복량으로 기록한다", () => {
    const { fighter } = emergencyRecoveryFighter();
    fighter.hp = fighter.maxHp * 0.5;
    tryTriggerEmergencyRecovery(fighter);
    const events = tickRegeneration(fighter, 5).filter((event) => event.kind === "heal");
    expect(events).toHaveLength(5);
    for (const event of events) expect(event.amount).toBeCloseTo(fighter.maxHp * 0.07);
    expect(fighter.hp).toBeCloseTo(fighter.maxHp * 0.85);
    expect(fighter.regeneration).toBeNull();
  });

  it("는 최대 HP를 넘기지 않고 UI 사건에는 실제 증가분만 담는다", () => {
    const { fighter } = emergencyRecoveryFighter();
    fighter.hp = fighter.maxHp * 0.5;
    tryTriggerEmergencyRecovery(fighter);
    fighter.hp = fighter.maxHp * 0.98;
    const [event] = tickRegeneration(fighter, 1);
    expect(fighter.hp).toBe(fighter.maxHp);
    expect(event).toMatchObject({ kind: "heal", fighterId: fighter.id, source: "passive" });
    if (event?.kind === "heal") expect(event.amount).toBeCloseTo(fighter.maxHp * 0.02);
  });

  it("는 회복이 끝난 뒤 다시 50% 이하가 되어도 같은 전투에서 재발동하지 않는다", () => {
    const { fighter } = emergencyRecoveryFighter();
    fighter.hp = fighter.maxHp * 0.5;
    expect(tryTriggerEmergencyRecovery(fighter)).toBe(true);
    tickRegeneration(fighter, 5);
    fighter.hp = fighter.maxHp * 0.4;
    expect(tryTriggerEmergencyRecovery(fighter)).toBe(false);
    expect(fighter.regeneration).toBeNull();
  });

  it("는 사망 상태에서 발동하거나 남은 회복 틱을 처리하지 않는다", () => {
    const { fighter } = emergencyRecoveryFighter();
    fighter.hp = fighter.maxHp * 0.5;
    tryTriggerEmergencyRecovery(fighter);
    fighter.hp = 0;
    expect(tickRegeneration(fighter, 1)).toEqual([]);
    expect(fighter.regeneration).toBeNull();
    expect(tryTriggerEmergencyRecovery(fighter)).toBe(false);
  });

  it("는 큰 프레임과 maxStep 분할 모두 5초 끝 경계에서 정확히 다섯 틱으로 결정된다", () => {
    /** 같은 시작 HP에서 지정한 프레임 조각을 적용해 분할 방식별 결과를 비교한다. */
    const simulate = (frames: readonly number[]) => {
      const { state, fighter } = emergencyRecoveryFighter();
      fighter.hp = fighter.maxHp * 0.5;
      tryTriggerEmergencyRecovery(fighter);
      const heals: SkirmishEvent[] = [];
      for (const dt of frames) heals.push(...stepSkirmish(state, dt).filter((event) => event.kind === "heal"));
      return { hp: fighter.hp, amounts: heals.map((event) => event.kind === "heal" ? event.amount : 0) };
    };
    // stepSkirmish의 catch-up 상한 안에서 0.25초 프레임과 1/60초 프레임이 모두 정확히 5초를 센다.
    const coarse = simulate(Array.from({ length: 20 }, () => 0.25));
    const fine = simulate(Array.from({ length: 300 }, () => 1 / 60));
    expect(coarse.amounts).toHaveLength(5);
    expect(fine.amounts).toHaveLength(5);
    expect(coarse).toEqual(fine);
  });
});

describe("난전 시작 진형", () => {
  it("은 아군을 아래쪽, 적을 위쪽에 세운다", () => {
    const state = newSkirmish();
    const players = aliveFighters(state, "player");
    const enemies = aliveFighters(state, "enemy");
    expect(Math.min(...players.map((f) => f.y))).toBeGreaterThan(Math.max(...enemies.map((f) => f.y)));
    // 아군은 맵을 넓게 쓰도록 아래 끝에서 출발한다.
    expect(Math.max(...players.map((f) => f.y))).toBe(ARENA.bottom);
  });

  it("은 여섯 명 전원을 세운다", () => {
    expect(newSkirmish().fighters).toHaveLength(6);
  });
});

describe("난전 상수", () => {
  it("는 밀어내는 간격보다 사거리를 넓게 잡는다", () => {
    // 반대가 되면 서로 밀려나기만 하고 영원히 때리지 못하는 교착이 생긴다.
    expect(SKIRMISH.reach).toBeGreaterThan(SKIRMISH.spacing);
  });
});

describe("실시간 진행", () => {
  it("은 입력 없이 서로에게 다가간다", () => {
    const state = newSkirmish();
    const ally = state.fighters[0];
    const foe = state.fighters[3];
    const before = Math.hypot(foe.x - ally.x, foe.y - ally.y);
    run(state, 0.5);
    const after = Math.hypot(
      findFighter(state, foe.id)!.x - findFighter(state, ally.id)!.x,
      findFighter(state, foe.id)!.y - findFighter(state, ally.id)!.y,
    );
    expect(after).toBeLessThan(before);
  });

  it("은 붙은 뒤부터 양쪽 체력을 함께 깎는다", () => {
    const state = newSkirmish();
    run(state, 12);
    expect(teamHp(state, "enemy")).toBeLessThan(state.fighters.filter((f) => f.side === "enemy").reduce((t, f) => t + f.maxHp, 0));
    expect(teamHp(state, "player")).toBeLessThan(state.fighters.filter((f) => f.side === "player").reduce((t, f) => t + f.maxHp, 0));
  });

  it("은 한쪽이 전멸하면 끝나고 그 뒤로는 시간이 흐르지 않는다", () => {
    const state = newSkirmish();
    run(state, 200);
    expect(["victory", "defeat"]).toContain(state.phase);
    const frozen = state.elapsed;
    expect(stepSkirmish(state, 1)).toHaveLength(0);
    expect(state.elapsed).toBe(frozen);
  });

  it("은 종료 이벤트를 한 번만 낸다", () => {
    const state = newSkirmish();
    const finishes = run(state, 200).filter((event) => event.kind === "finish");
    expect(finishes).toHaveLength(1);
  });
});

describe("기절 상태", () => {
  /** 두 전투원을 붙이고 다른 우연한 행동 없이 기절 정책만 관찰할 결투를 만든다. */
  function stunnedDuel(): SkirmishState {
    const state = newSkirmish(["rex"], ["husk-shell"]);
    const [ally, foe] = state.fighters;
    ally.x = 400; ally.y = 1000; ally.targetId = foe.id; ally.engaged = true;
    foe.x = 460; foe.y = 1000; foe.targetId = ally.id; foe.engaged = true;
    ally.attackCooldown = 0.4;
    foe.attackCooldown = 99;
    return state;
  }

  it("는 이동·평타와 공격 쿨다운을 멈추고 정확히 2초 뒤 기존 행동을 재개한다", () => {
    const state = stunnedDuel();
    const ally = state.fighters[0];
    // 추적 이동도 함께 검증하도록 잠시 교전 상태와 사거리 밖 위치로 바꾼다.
    ally.engaged = false;
    state.fighters[1].x = 900;
    const start = { x: ally.x, y: ally.y, cooldown: ally.attackCooldown };
    expect(applyStun(ally, 2)).toEqual([{ kind: "status", fighterId: ally.id, status: "stun", active: true }]);

    const beforeEnd = Array.from({ length: 7 }, () => stepSkirmish(state, 0.25)).flat();
    expect(beforeEnd.some((event) => event.kind === "attack" && event.attackerId === ally.id)).toBe(false);
    expect({ x: ally.x, y: ally.y, cooldown: ally.attackCooldown }).toEqual(start);
    const resumed = stepSkirmish(state, 0.25);
    expect(ally.stunnedFor).toBe(0);
    expect(ally.y).not.toBe(start.y); // 2초 경계가 된 스텝부터 대상 추적 이동을 다시 시작한다.
    expect(resumed.some((event) => event.kind === "attack" && event.attackerId === ally.id)).toBe(false);
    expect(ally.attackCooldown).toBeLessThan(start.cooldown); // 쿨다운도 2초 동안 멈춘 값에서 이어진다.
  });

  it("는 기절 중 적 자동 궁극기와 플레이어 수동 궁극기를 같은 규칙으로 차단한다", () => {
    const playerState = stunnedDuel();
    const player = playerState.fighters[0];
    player.energy = player.def.ultimate.cost;
    applyStun(player, 2);
    expect(canFireUltimate(playerState, player)).toBe(false);
    expect(fireUltimate(playerState, player.id)).toEqual([]);

    const enemyState = stunnedDuel();
    const enemy = enemyState.fighters[1];
    enemy.attackCooldown = 0;
    enemy.energy = enemy.def.ultimate.cost;
    applyStun(enemy, 2);
    const blocked = Array.from({ length: 7 }, () => stepSkirmish(enemyState, 0.25)).flat();
    expect(blocked.some((event) => event.kind === "attack" && event.attackerId === enemy.id)).toBe(false);
    const resumed = stepSkirmish(enemyState, 0.25);
    expect(resumed).toContainEqual(expect.objectContaining({ kind: "attack", attackerId: enemy.id, skill: "ultimate" }));
  });

  it("는 재적용 때 긴 잔여 시간을 보존하고 사망하면 즉시 정리한다", () => {
    const state = stunnedDuel();
    const [ally, foe] = state.fighters;
    applyStun(foe, 2);
    // 한 호출의 catch-up 상한은 0.25초이므로 실제 0.5초는 두 프레임으로 진행한다.
    stepSkirmish(state, 0.25);
    stepSkirmish(state, 0.25);
    expect(applyStun(foe, 1)).toEqual([]); // 이미 활성인 상태는 시작 사건을 프레임마다 반복하지 않는다.
    expect(foe.stunnedFor).toBeCloseTo(1.5);
    expect(applyStun(foe, 3)).toEqual([]);
    expect(foe.stunnedFor).toBe(3);

    foe.hp = 1;
    ally.attackCooldown = 0;
    const events = stepSkirmish(state, 1 / 60);
    expect(events).toContainEqual({ kind: "death", fighterId: foe.id });
    expect(foe.stunnedFor).toBe(0);
  });

  it("는 저항으로 지속 시간을 줄이고 100% 면역과 해제를 같은 Fighter 상태에 반영한다", () => {
    const state = stunnedDuel();
    const foe = state.fighters[1];
    // 정적 콘텐츠 계약만 복제해 실제 캐릭터 밸런스를 바꾸지 않고 50% 저항 경계를 검증한다.
    foe.def = { ...foe.def, stunResistancePercent: 50 };
    expect(applyStun(foe, 2)).toHaveLength(1);
    expect(foe.stunnedFor).toBe(1);
    clearStun(foe);
    expect(foe.stunnedFor).toBe(0);

    foe.def = { ...foe.def, stunResistancePercent: 100 };
    expect(applyStun(foe, 2)).toEqual([]);
    expect(foe.stunnedFor).toBe(0);
  });

  it("는 개별 스킬의 상태 효과도 공용 기절 규칙으로 적용한다", () => {
    const state = stunnedDuel();
    const [ally, foe] = state.fighters;
    // 테스트 전투원 한 명의 기본 공격에만 상태 정의를 붙여 운영 데이터에는 영향을 주지 않는다.
    ally.def = { ...ally.def, basic: { ...ally.def.basic, statusEffects: [{ kind: "stun", seconds: 1.25 }] } };
    ally.attackCooldown = 0;
    const events = stepSkirmish(state, 1 / 60);
    expect(events).toContainEqual({ kind: "status", fighterId: foe.id, status: "stun", active: true });
    expect(foe.stunnedFor).toBe(1.25);
  });
});

describe("능력치 반영", () => {
  it("은 공격 속도가 빠를수록 공격 간격이 짧다", () => {
    const base = newSkirmish().fighters[0];
    const withSpeed = (attackSpeed: number) => ({ ...base, def: { ...base.def, stats: { ...base.def.stats, attackSpeed } } });
    expect(attackInterval(withSpeed(200))).toBeLessThan(attackInterval(withSpeed(100)));
    // 공속 100이면 기준 간격 그대로다.
    expect(attackInterval(withSpeed(100))).toBeCloseTo(SKIRMISH.attackInterval);
  });

  it("은 이동 속도가 빠른 쪽이 같은 시간에 더 멀리 간다", () => {
    const quick = newSkirmish(["rex"], ["husk-raptor"]);
    const slow = newSkirmish(["rex"], ["husk-raptor"]);
    slow.fighters[0].def = { ...slow.fighters[0].def, stats: { ...slow.fighters[0].def.stats, moveSpeed: 40 } };
    const startY = quick.fighters[0].y;
    run(quick, 0.5);
    run(slow, 0.5);
    expect(startY - quick.fighters[0].y).toBeGreaterThan(startY - slow.fighters[0].y);
  });

  it("은 치명타 판정을 주입된 난수로만 정한다", () => {
    const always = newSkirmish();
    const never = newSkirmish();
    run(always, 12, () => 0);
    run(never, 12, () => 0.999999);
    expect(teamHp(always, "enemy")).toBeLessThan(teamHp(never, "enemy"));
  });

  it("은 실시간 타격에서 물리·마법 공격력과 대응 방어 능력치를 사용한다", () => {
    /** 한 번의 실시간 공격만 발생시켜 이벤트 피해량을 비교한다. */
    const hit = (player: string, enemy: string) => {
      const state = newSkirmish([player], [enemy]);
      const [attacker, target] = state.fighters;
      attacker.x = 400; attacker.y = 1000; attacker.attackCooldown = 0;
      target.x = 460; target.y = 1000; target.attackCooldown = 99;
      return stepSkirmish(state, 1 / 60).find((event) => event.kind === "attack")?.amount ?? 0;
    };
    // 렉시아의 물리 공격과 케찰의 마법 공격 모두 실제 난전 이벤트를 통해 피해를 만든다.
    expect(hit("rex", "husk-shell")).toBeGreaterThan(0);
    expect(hit("quetz", "husk-shell")).toBeGreaterThan(0);
  });

  it("은 최종 궁극기·야성 충전 보정과 실제 HP 피해 기준 흡혈을 적용한다", () => {
    const state = newSkirmish(["rex"], ["husk-shell"]);
    const [attacker, target] = state.fighters;
    attacker.def = { ...attacker.def, stats: { ...attacker.def.stats, energyGain: 40, ferocityGain: 50, lifeSteal: 25 } };
    attacker.hp = attacker.maxHp - 100;
    attacker.x = 400; attacker.y = 1000; attacker.attackCooldown = 0;
    target.x = 460; target.y = 1000; target.attackCooldown = 99;
    const hpBefore = attacker.hp;
    const targetBefore = target.hp;
    stepSkirmish(state, 1 / 60, () => 0.999999);
    const dealt = targetBefore - target.hp;
    expect(attacker.energy).toBe(40);
    expect(attacker.ferocity).toBeCloseTo(FEROCITY_RULES.basicGain * 1.5);
    expect(attacker.hp - hpBefore).toBeCloseTo(dealt * 0.25);
  });

  it("은 광역 실제 피해에는 흡혈하고 별도 고정 출혈 피해에는 흡혈하지 않는다", () => {
    const state = newSkirmish(["spino"], ["husk-shell", "husk-raptor"]);
    const [attacker, primary, secondary] = state.fighters;
    attacker.def = { ...attacker.def, stats: { ...attacker.def.stats, lifeSteal: 100 } };
    attacker.hp = 1; attacker.ferocity = 100; attacker.ferocityFever = true;
    attacker.x = 400; attacker.y = 1000; attacker.attackCooldown = 0;
    primary.x = 460; primary.y = 1000; primary.attackCooldown = 99;
    secondary.x = 500; secondary.y = 1000; secondary.attackCooldown = 99;
    const totalBefore = primary.hp + secondary.hp;
    stepSkirmish(state, 1 / 60, () => 0.999999);
    expect(attacker.hp).toBeCloseTo(Math.min(attacker.maxHp, 1 + totalBefore - primary.hp - secondary.hp));

    const healed = attacker.hp;
    primary.bleed = { remaining: 1, tickIn: 0, percent: BLEED.percentPerSecond };
    attacker.attackCooldown = 99;
    stepSkirmish(state, 1 / 60);
    expect(attacker.hp).toBe(healed);
  });
});

describe("실시간 야성 공용 규칙", () => {
  /** 공격자와 대상을 붙여 한 번의 실제 난전 타격만 관찰한다. */
  function oneHit(ferocity: number) {
    const state = newSkirmish(["rex"], ["husk-shell"]);
    const [attacker, target] = state.fighters;
    attacker.x = 400; attacker.y = 1000; attacker.attackCooldown = 0; attacker.ferocity = ferocity;
    target.x = 460; target.y = 1000; target.attackCooldown = 99;
    const event = stepSkirmish(state, 1 / 60).find((item) => item.kind === "attack");
    return { attacker, target, amount: event?.kind === "attack" ? event.amount : 0 };
  }

  it("은 50/80/100 경계에서 공격 피해를 올리고 타격 양쪽의 게이지를 채운다", () => {
    const calm = oneHit(49);
    const first = oneHit(50);
    const second = oneHit(80);
    const fever = oneHit(100);
    expect(first.amount).toBeGreaterThan(calm.amount);
    expect(second.amount).toBeGreaterThan(first.amount);
    expect(fever.amount).toBeGreaterThan(second.amount);
    expect(calm.attacker.ferocity).toBe(49 + FEROCITY_RULES.basicGain);
    expect(calm.target.ferocity).toBe(FEROCITY_RULES.hitGain);
  });
});

describe("효과 ID별 야성 특성", () => {
  /** 원하는 둘을 즉시 교전시키고 다른 전투원의 행동은 멈춰 한 번의 효과만 관찰한다. */
  function prepareHit(player: string, enemies = ["husk-shell"]): SkirmishState {
    const state = newSkirmish([player], enemies);
    const [attacker, target] = state.fighters;
    attacker.x = 400; attacker.y = 1000; attacker.attackCooldown = 0; attacker.targetId = target.id;
    target.x = 460; target.y = 1000;
    for (const enemy of state.fighters.slice(1)) enemy.attackCooldown = 99;
    return state;
  }

  it("렉시아 패시브는 공격 속도를 25%p 높이고 폭주 종료 뒤 간격을 그대로 유지한다", () => {
    const state = newSkirmish(["rex"], ["husk-shell"]);
    const rex = state.fighters[0];
    const before = attackInterval(rex);
    // 기본 112에 25%p를 더한 137로 나눠 곱연산(140)과 의미가 바뀌지 않게 고정한다.
    expect(before).toBeCloseTo(SKIRMISH.attackInterval * 100 / 137);
    rex.ferocity = 100; rex.ferocityFever = true;
    expect(attackInterval(rex)).toBe(before); // 렉시아 폭주는 공속이 아니라 치명타와 흡혈만 바꾼다.
    rex.ferocityFever = false;
    expect(attackInterval(rex)).toBe(before);
  });

  it("토리카의 폭주는 기본 공격을 주변 적에게 번지게 한다", () => {
    const state = prepareHit("anky", ["husk-shell", "husk-raptor"]);
    const [torika, primary, nearby] = state.fighters;
    nearby.x = primary.x + 100; nearby.y = primary.y;
    torika.ferocity = 100; torika.ferocityFever = true;
    // 폭주 설명과 실제 전투가 갈라지지 않도록 주 대상과 주변 대상 모두 공격 사건을 남긴다.
    const hits = stepSkirmish(state, 1 / 60).filter((event) => event.kind === "attack");
    expect(hits).toHaveLength(2);
    expect(hits.some((event) => event.kind === "attack" && event.targetId === nearby.id)).toBe(true);
    // 주 대상과 주변 대상은 모두 원래 타격에 방어력 15% 추가 피해를 각 대상의 방어력으로 계산한다.
    const attackEvents = hits.filter((event) => event.kind === "attack");
    const primaryHit = attackEvents.find((event) => event.targetId === primary.id)!;
    const nearbyHit = attackEvents.find((event) => event.targetId === nearby.id)!;
    // 계수의 단일 출처를 고정하고, 실제 타격이 기존 공격력 피해보다 커졌는지 각 대상에서 검증한다.
    expect(torika.def.ferocityTrait).toMatchObject({ damagePercent: 100, defenseDamagePercent: 15, attackSpeedBonusPercent: 20 });
    expect(primaryHit.amount).toBeGreaterThan(computeDamage(torika, primary, { ...torika.def.basic, isCritical: primaryHit.critical, kind: "basic" }, true));
    expect(nearbyHit.amount).toBeGreaterThan(computeDamage(torika, nearby, { ...torika.def.basic, isCritical: nearbyHit.critical, kind: "basic" }, true));
    // 경직은 기절 상태를 오용하지 않고 주·주변 대상의 행동만 0.1초 순간 차단한다.
    expect(primary.stunnedFor).toBe(0);
    expect(nearby.stunnedFor).toBe(0);
    expect(primary.staggeredFor).toBeCloseTo(0.1);
    expect(nearby.staggeredFor).toBeCloseTo(0.1);
    // 공격 속도 20% 증가는 기본 공격 간격을 1.2로 나눈 값이다.
    torika.ferocityFever = false;
    const calmInterval = attackInterval(torika);
    torika.ferocityFever = true;
    expect(attackInterval(torika)).toBeCloseTo(calmInterval / 1.2);
  });

  it("splashDamage는 스피나의 피버 타격을 220px 안의 주변 적에게 35%로 번지게 한다", () => {
    const state = prepareHit("spino", ["husk-shell", "husk-raptor"]);
    const [attacker, primary, nearby] = state.fighters;
    nearby.x = primary.x + 100; nearby.y = primary.y;
    attacker.ferocity = 99;
    expect(stepSkirmish(state, 1 / 60).filter((event) => event.kind === "attack")).toHaveLength(1);

    const fever = prepareHit("spino", ["husk-shell", "husk-raptor"]);
    fever.fighters[2].x = fever.fighters[1].x + 100; fever.fighters[2].y = fever.fighters[1].y;
    fever.fighters[0].ferocity = 100; fever.fighters[0].ferocityFever = true;
    const hits = stepSkirmish(fever, 1 / 60).filter((event) => event.kind === "attack");
    expect(hits).toHaveLength(2);
    expect(hits.some((event) => event.kind === "attack" && event.targetId === fever.fighters[2].id)).toBe(true);
  });

  it("allyEnergyGain은 도도의 피버 공격마다 다른 아군에게 에너지 6을 준다", () => {
    const state = newSkirmish(["dodo", "rex"], ["husk-shell"]);
    const [dodo, ally, target] = state.fighters;
    dodo.x = 400; dodo.y = 1000; target.x = 460; target.y = 1000;
    dodo.attackCooldown = 0; ally.attackCooldown = 99; target.attackCooldown = 99;
    dodo.ferocity = 99;
    stepSkirmish(state, 1 / 60);
    expect(ally.energy).toBe(0);

    dodo.attackCooldown = 0; dodo.ferocity = 100; dodo.ferocityFever = true;
    stepSkirmish(state, 1 / 60);
    expect(ally.energy).toBe(6);
  });

  it("criticalChanceBonus은 스밀라의 피버 중 치명타율을 25%p 올린다", () => {
    const normal = prepareHit("smilo");
    normal.fighters[0].ferocity = 99;
    const normalHit = stepSkirmish(normal, 1 / 60, () => 0.3).find((event) => event.kind === "attack");
    const fever = prepareHit("smilo");
    fever.fighters[0].ferocity = 100; fever.fighters[0].ferocityFever = true;
    const feverHit = stepSkirmish(fever, 1 / 60, () => 0.3).find((event) => event.kind === "attack");
    expect(normalHit).toMatchObject({ critical: false });
    expect(feverHit).toMatchObject({ critical: true });
  });

  it("teamMoveSpeedBonus은 케찰의 피버 중 생존 아군 이동 속도를 18% 올린다", () => {
    const state = newSkirmish(["quetz", "rex"], ["husk-shell"]);
    const [quetz, ally] = state.fighters;
    const before = moveSpeed(ally, state);
    quetz.ferocity = 99;
    expect(moveSpeed(ally, state)).toBe(before);
    quetz.ferocity = 100; quetz.ferocityFever = true;
    expect(moveSpeed(ally, state)).toBeCloseTo(before * 1.18);
  });
});

describe("자리 정리", () => {
  it("는 서로 겹쳐 서지 않게 밀어낸다", () => {
    const state = newSkirmish();
    run(state, 8);
    const alive = state.fighters.filter((f) => f.hp > 0);
    for (let i = 0; i < alive.length; i += 1) {
      for (let j = i + 1; j < alive.length; j += 1) {
        const gap = Math.hypot(alive[j].x - alive[i].x, alive[j].y - alive[i].y);
        expect(gap).toBeGreaterThan(SKIRMISH.spacing * 0.9);
      }
    }
  });

  it("는 아무도 전장 밖으로 나가지 않게 한다", () => {
    const state = newSkirmish();
    run(state, 10);
    for (const fighter of state.fighters) {
      expect(fighter.x).toBeGreaterThanOrEqual(ARENA.left);
      expect(fighter.x).toBeLessThanOrEqual(ARENA.right);
      expect(fighter.y).toBeGreaterThanOrEqual(ARENA.top);
      expect(fighter.y).toBeLessThanOrEqual(ARENA.bottom);
    }
  });
});

describe("타격 연출", () => {
  /**
   * 아군만 한 대 때린 직후의 상태.
   * 둘을 사거리 안에 직접 세우고 적의 공격만 늦춰, 누가 누구를 때렸는지가 분명하게 만든다.
   */
  function oneHit() {
    const state = newSkirmish(["rex"], ["husk-shell"]);
    const [ally, foe] = state.fighters;
    ally.x = 400;
    ally.y = 1000;
    // 붙었다고 판정되는 거리(reach * engageRatio) 안쪽에 세운다.
    foe.x = 400 + SKIRMISH.reach * 0.75;
    foe.y = 1000;
    ally.attackCooldown = 0;
    foe.attackCooldown = 99;
    stepSkirmish(state, 1 / 60);
    return state;
  }

  it("은 때린 쪽을 상대 방향으로 밀어 넣는다", () => {
    const [ally] = oneHit().fighters;
    // 상대가 오른쪽에 있으므로 오른쪽으로 튀어나간다.
    expect(ally.dashX).toBeGreaterThan(SKIRMISH.lunge * 0.8);
    expect(Math.abs(ally.dashY)).toBeLessThan(1);
  });

  it("은 맞은 쪽을 반대로 밀려나게 한다", () => {
    const [, foe] = oneHit().fighters;
    // 때린 쪽에서 멀어지는 방향, 즉 같은 오른쪽으로 밀려난다.
    expect(foe.dashX).toBeGreaterThan(SKIRMISH.knockback * 0.8);
  });

  it("은 밀린 만큼을 곧 제자리로 되돌린다", () => {
    const state = oneHit();
    const ally = state.fighters[0];
    state.fighters[1].attackCooldown = 99;
    const pushed = Math.hypot(ally.dashX, ally.dashY);
    // 다음 공격이 나기 전 짧은 시간 안에 거의 돌아온다.
    for (let t = 0; t < 0.4; t += 1 / 60) stepSkirmish(state, 1 / 60);
    expect(Math.hypot(ally.dashX, ally.dashY)).toBeLessThan(pushed * 0.2);
  });

  it("은 달리는 동안에만 통통 튀어 오른다", () => {
    const state = newSkirmish(["rex"], ["husk-shell"]);
    let peak = 0;
    for (let t = 0; t < 2; t += 1 / 60) {
      stepSkirmish(state, 1 / 60);
      peak = Math.max(peak, state.fighters[0].hop);
    }
    expect(peak).toBeGreaterThan(SKIRMISH.hopHeight * 0.5);
    expect(peak).toBeLessThanOrEqual(SKIRMISH.hopHeight);

    // 붙어서 주고받기 시작하면 다시 땅에 내려온다.
    for (let t = 0; t < 20; t += 1 / 60) stepSkirmish(state, 1 / 60);
    expect(state.fighters[0].hop).toBeLessThan(1);
  });

  it("은 그릴 위치에 변위와 높이를 함께 얹는다", () => {
    const state = oneHit();
    const ally = state.fighters[0];
    const pose = renderPose(ally);
    expect(pose.x).toBeCloseTo(ally.x + ally.dashX);
    expect(pose.y).toBeCloseTo(ally.y + ally.dashY - ally.hop);
    // 떠 있어도 그림자는 발밑을 크게 벗어나지 않는다.
    expect(Math.abs(pose.shadowX - ally.x)).toBeLessThanOrEqual(Math.abs(ally.dashX));
  });
});

describe("궁극기", () => {
  /** 게이지를 가득 채운 아군 하나와 적 하나를 붙여 세운다. */
  function charged() {
    const state = newSkirmish(["rex"], ["husk-shell"]);
    const [ally, foe] = state.fighters;
    ally.x = 400;
    ally.y = 1000;
    foe.x = 400 + SKIRMISH.reach * 0.75;
    foe.y = 1000;
    ally.energy = ally.def.ultimate.cost;
    ally.attackCooldown = 99;
    foe.attackCooldown = 99;
    return state;
  }

  it("는 아군 게이지가 차도 저절로 나가지 않는다", () => {
    const state = newSkirmish();
    const events = run(state, 20);
    const autoUltimates = events.filter(
      (event) => event.kind === "attack" && event.skill === "ultimate" && event.attackerId.startsWith("player"),
    );
    expect(autoUltimates).toHaveLength(0);
    // 대신 게이지는 그대로 차 있어 누를 수 있는 상태가 된다.
    const charged = state.fighters.filter((f) => f.side === "player" && f.energy >= f.def.ultimate.cost);
    expect(charged.length).toBeGreaterThan(0);
  });

  it("는 적은 게이지가 차면 알아서 쓴다", () => {
    const state = newSkirmish();
    const events = run(state, 30);
    const enemyUltimates = events.filter(
      (event) => event.kind === "attack" && event.skill === "ultimate" && event.attackerId.startsWith("enemy"),
    );
    expect(enemyUltimates.length).toBeGreaterThan(0);
  });

  it("는 눌렀을 때 게이지를 쓰고 평타보다 크게 때린다", () => {
    const ultimateState = charged();
    const ultimateHit = fireUltimate(ultimateState, "player-0").find((event) => event.kind === "attack");
    expect(ultimateHit).toMatchObject({ skill: "ultimate", targetId: "enemy-0" });

    const basicState = charged();
    basicState.fighters[0].attackCooldown = 0;
    const basicHit = run(basicState, 1 / 30).find((event) => event.kind === "attack");
    expect(basicHit).toMatchObject({ skill: "basic" });

    // 같은 상대를 같은 상태에서 때렸을 때 궁극기 쪽이 더 아프다.
    const damage = (event?: SkirmishEvent) => (event?.kind === "attack" ? event.amount : 0);
    expect(damage(ultimateHit)).toBeGreaterThan(damage(basicHit));
    expect(ultimateState.fighters[0].energy).toBe(0);
  });

  it("토리카는 시전자 주위의 세 적을 각자 방어·속성으로 계산하고 생존자만 기절시킨다", () => {
    const state = newSkirmish(["anky"], ["husk-raptor", "husk-shell", "husk-wing"]);
    const [torika, first, armored, disadvantaged] = state.fighters;
    torika.x = 500; torika.y = 900;
    // 셋 모두 시전자 중심 220px 계약 안에 두되 서로 다른 방어·속성 입력을 준다.
    [first, armored, disadvantaged].forEach((target, index) => {
      target.x = 560 + index * 45;
      target.y = 900;
      target.attackCooldown = 99;
    });
    first.def = { ...first.def, element: "fire", stats: { ...first.def.stats, def: 0 } };
    armored.def = { ...armored.def, element: "fire", stats: { ...armored.def.stats, def: 300 } };
    disadvantaged.def = { ...disadvantaged.def, element: "water", stats: { ...disadvantaged.def.stats, def: 0 } };
    first.hp = 1; // 첫 처리 대상이 죽어도 뒤의 두 대상을 계속 정산해야 한다.
    torika.energy = torika.def.ultimate.cost;

    const expected = [first, armored, disadvantaged].map((target) => computeDamage(
      torika,
      target,
      { ...torika.def.ultimate, isCritical: false, kind: "ultimate" },
      true,
    ));
    const events = fireUltimate(state, torika.id);
    const hits = events.filter((event) => event.kind === "attack");

    expect(hits.map((event) => event.amount)).toEqual(expected);
    // 같은 유리 속성에서도 대상 방어가 적용되고, 같은 무방어 대상도 속성 상성에 따라 달라진다.
    expect(expected[0]).toBeGreaterThan(expected[1]);
    expect(expected[0]).toBeGreaterThan(expected[2]);
    // 기대값 자체가 토리카의 atk가 아니라 상향된 def 300%를 원천으로 썼는지도 수치로 고정한다.
    expect(expected[0]).toBe(Math.round((torika.def.stats.def * 3) * 1.25));
    expect(first.stunnedFor).toBe(0);
    expect(armored.stunnedFor).toBe(2);
    expect(disadvantaged.stunnedFor).toBe(2);
    expect(events.filter((event) => event.kind === "status")).toHaveLength(2);
    expect(torika.energy).toBe(0);
    expect(hits.filter((event) => event.animate !== false)).toHaveLength(1);
  });

  it("토리카의 주위 궁극기는 전장 전체가 아니라 시전자 중심 반경만 맞힌다", () => {
    const state = newSkirmish(["anky"], ["husk-shell", "husk-wing"]);
    const [torika, nearby, outside] = state.fighters;
    if (torika.def.ultimate.targeting !== "nearbyEnemies") throw new Error("토리카 궁극기 반경 계약이 필요합니다.");
    torika.x = 400; torika.y = 900;
    nearby.x = 400 + torika.def.ultimate.radius; nearby.y = 900;
    outside.x = nearby.x + 1; outside.y = 900;
    torika.energy = torika.def.ultimate.cost;
    const outsideHp = outside.hp;

    const hits = fireUltimate(state, torika.id).filter((event) => event.kind === "attack");
    expect(hits.map((event) => event.targetId)).toEqual([nearby.id]);
    expect(outside.hp).toBe(outsideHp);
    expect(outside.stunnedFor).toBe(0);
  });

  it("는 상대를 쓰러뜨리면 같은 호출에서 공격 뒤에 사망까지 알린다", () => {
    // 씬은 이 배열을 한 번만 훑어 연출로 옮긴다. 공격 뒤의 사망이 같은 호출에 담기지 않으면
    // 궁극기로 잡은 적이 쓰러지지 않고 계속 서 있게 된다.
    const state = charged();
    const foe = state.fighters[1];
    foe.hp = 1;
    const events = fireUltimate(state, "player-0");
    const kinds = events.map((event) => event.kind);
    expect(kinds.indexOf("attack")).toBeGreaterThanOrEqual(0);
    expect(kinds.indexOf("death")).toBeGreaterThan(kinds.indexOf("attack"));
    expect(events.some((event) => event.kind === "death" && event.fighterId === foe.id)).toBe(true);
  });

  it("스킵 시 컷인을 기다리지 않아도 결정타의 공격·사망·종료 사건을 순서대로 전달한다", () => {
    const state = charged(); const foe = state.fighters[1]; foe.hp = 1;
    const played: string[] = []; let presentationCalls = 0;
    // BattleScene의 스킵 분기처럼 create/play 없이 즉시 코어를 재검증하고 반환 사건 전체를 넘긴다.
    const skipPresentation = true;
    if (!skipPresentation) presentationCalls += 1;
    if (canFireUltimate(state, state.fighters[0])) fireUltimate(state, "player-0").forEach((event) => played.push(event.kind));
    expect(presentationCalls).toBe(0);
    expect(played).toEqual(["attack", "death", "finish"]);
  });

  it("는 게이지가 모자라면 아무것도 하지 않는다", () => {
    const state = charged();
    state.fighters[0].energy = state.fighters[0].def.ultimate.cost - 1;
    expect(canFireUltimate(state, state.fighters[0])).toBe(false);
    expect(fireUltimate(state, "player-0")).toHaveLength(0);
    expect(state.fighters[1].hp).toBe(state.fighters[1].maxHp);
  });

  it("는 공용 저장 상한 안에서 스킬별 비용만 정확히 소비한다", () => {
    const state = charged();
    const fighter = state.fighters[0];
    // 운영 정의를 바꾸지 않고 이 전투원에게만 저비용 궁극기 계약을 복제한다.
    fighter.def = { ...fighter.def, ultimate: { ...fighter.def.ultimate, cost: 80 } };
    fighter.energy = ULTIMATE_ENERGY_MAX;
    expect(canFireUltimate(state, fighter)).toBe(true);
    fireUltimate(state, fighter.id);
    expect(fighter.energy).toBe(ULTIMATE_ENERGY_MAX - 80);
  });

  it("는 전투가 끝난 뒤에는 쓸 수 없다", () => {
    const state = charged();
    state.fighters[1].hp = 0;
    state.phase = "victory";
    expect(canFireUltimate(state, state.fighters[0])).toBe(false);
    expect(fireUltimate(state, "player-0")).toHaveLength(0);
  });

  it("는 최대 야성에서도 적에게 궁극기를 쓰며 피버 게이지가 자동으로 진정된다", () => {
    const state = charged();
    const [ally, foe] = state.fighters;
    ally.ferocity = 100;
    ally.ferocityFever = true;
    const foeHp = foe.hp;

    const events = fireUltimate(state, ally.id);
    expect(events).toContainEqual(expect.objectContaining({ kind: "attack", attackerId: ally.id, targetId: foe.id, skill: "ultimate" }));
    expect(foe.hp).toBeLessThan(foeHp);
    // 피버는 별도 진압 입력 없이 전투 시간에 맞춰 0까지 줄어든다.
    // 두 전투원의 공격을 늦춰 피버 카운트다운 자체만 정확히 8초 관찰한다.
    ally.attackCooldown = 99;
    foe.attackCooldown = 99;
    for (let tick = 0; tick < 32; tick += 1) stepSkirmish(state, 0.25);
    expect(ally.ferocity).toBe(0);
    expect(ally.ferocityFever).toBe(false);
    expect(events.some((event) => event.kind === "attack" && event.targetId.startsWith("player"))).toBe(false);
  });
});

describe("자리 잡기", () => {
  it("은 붙는 거리와 떨어지는 거리를 다르게 둬 경계에서 떨지 않는다", () => {
    const state = newSkirmish(["rex"], ["husk-shell"]);
    const [ally, foe] = state.fighters;
    ally.x = 400;
    ally.y = 1000;
    // 붙는 기준(reach * engageRatio) 밖, 떨어지는 기준(reach) 안에 세운다.
    foe.x = 400 + SKIRMISH.reach - 4;
    foe.y = 1000;

    stepSkirmish(state, 1 / 60);
    expect(ally.engaged).toBe(false); // 아직 붙지 않았으니 계속 다가간다

    ally.engaged = true;
    stepSkirmish(state, 1 / 60);
    expect(ally.engaged).toBe(true); // 이미 붙었다면 그 자리에서 계속 싸운다
  });

  it("은 세로로 겹쳐 있을 때 좌우가 깜빡이지 않는다", () => {
    const state = newSkirmish(["rex"], ["husk-shell"]);
    const [ally, foe] = state.fighters;
    ally.x = 400;
    ally.y = 1000;
    ally.facing = 1;
    // 상대가 왼쪽으로 아주 조금 치우친 정도로는 방향을 바꾸지 않는다.
    foe.x = 400 - SKIRMISH.facingDeadzone / 2;
    foe.y = 900;
    stepSkirmish(state, 1 / 60);
    expect(ally.facing).toBe(1);

    foe.x = 400 - SKIRMISH.facingDeadzone * 3;
    stepSkirmish(state, 1 / 60);
    expect(ally.facing).toBe(-1);
  });
});

describe("출혈", () => {
  /** 렉시아와 상대만 세워 연속 공격을 관찰한다. */
  function duel(): SkirmishState {
    const state = createSkirmish([getRelic("rex")], [getRelic("husk-shell")], ARENA);
    const [ally, foe] = state.fighters;
    ally.x = 500; ally.y = 1000; foe.x = 560; foe.y = 1000;
    return state;
  }

  it("은 렉시아 일반 공격이 적중할 때마다 즉시 걸린다", () => {
    const state = duel();
    const [ally, foe] = state.fighters;
    const events = run(state, 0.05);
    expect(ally.streakCount).toBe(0); // 5연타 패시브 경로와 일반 공격 출혈은 서로 섞이지 않는다.
    expect(foe.bleed).not.toBeNull();
    expect(events.some((event) => event.kind === "bleed" && event.started)).toBe(true);
  });

  it("은 3초 동안 매 초 최대 체력의 2%를 깎고 스스로 끝난다", () => {
    const state = duel();
    const foe = state.fighters[1];
    state.fighters[0].attackCooldown = foe.attackCooldown = 99;
    foe.bleed = { remaining: BLEED.seconds, tickIn: 1, percent: BLEED.percentPerSecond };
    const hpBefore = foe.hp;
    const ticks = run(state, 3.2).filter((event): event is Extract<SkirmishEvent, { kind: "bleed" }> => event.kind === "bleed");
    const bleedDamage = ticks.reduce((sum, event) => sum + event.amount, 0);
    expect(ticks).toHaveLength(BLEED.seconds);
    expect(bleedDamage).toBe(Math.round((foe.maxHp * BLEED.percentPerSecond) / 100) * BLEED.seconds);
    expect(hpBefore - foe.hp).toBeGreaterThanOrEqual(bleedDamage);
    expect(foe.bleed).toBeNull();
  });

  it("은 대상별 일반 공격 경로로 적용되어 연속 공격 카운트를 사용하지 않는다", () => {
    const state = createSkirmish([getRelic("rex")], [getRelic("husk-shell"), getRelic("husk-wing")], ARENA);
    const ally = state.fighters[0];
    ally.streakTargetId = "enemy-0"; ally.streakCount = 4;
    ally.x = state.fighters[2].x; ally.y = state.fighters[2].y - 60;
    ally.targetId = "enemy-1";
    run(state, 0.05);
    expect(ally.streakCount).toBe(4);
    expect(state.fighters[1].bleed).toBeNull();
    expect(state.fighters[2].bleed).toMatchObject({ remaining: expect.any(Number), percent: 2 });
  });
});

describe("렉시아 전투 계약", () => {
  /** 양쪽을 즉시 교전시키고 적 행동을 멈춰 렉시아의 한 타격만 관찰한다. */
  function readyRex() {
    const state = newSkirmish(["rex"], ["husk-shell"]);
    const [rex, foe] = state.fighters;
    rex.x = 500; rex.y = 1000; foe.x = 560; foe.y = 1000;
    rex.attackCooldown = 0; foe.attackCooldown = 99;
    return { state, rex, foe };
  }

  it("은 공격력 25%와 치명 확률·치명 피해 25%p를 정해진 순서로 적용한다", () => {
    const { state, rex, foe } = readyRex();
    const hit = stepSkirmish(state, 1 / 60, () => 0.44).find((event) => event.kind === "attack")!;
    const boosted = { ...rex, def: { ...rex.def, stats: { ...rex.def.stats, atk: rex.def.stats.atk * 1.25, critDamage: rex.def.stats.critDamage + 25 } } };
    expect(rex.def.basic.power).toBe(95);
    // 기본 20% + 패시브 25%p = 45%이며, 치명 피해도 160% + 25%p = 185%다.
    expect(hit).toMatchObject({ critical: true, amount: computeDamage(boosted, foe, { ...rex.def.basic, kind: "basic", isCritical: true }, true) });
  });

  it("은 폭주 중 치명타 25%p와 모든 피해 흡혈 25%p를 적용하고 종료 후 복구한다", () => {
    const { state, rex } = readyRex();
    rex.hp = rex.maxHp / 2; rex.ferocity = 100; rex.ferocityFever = true;
    const before = rex.hp;
    const hit = stepSkirmish(state, 1 / 60, () => 0.69).find((event) => event.kind === "attack")!;
    expect(hit).toMatchObject({ critical: true }); // 기본 20% + 패시브 25%p + 폭주 25%p = 70%
    expect(rex.hp - before).toBeCloseTo(hit.amount * 0.25);
    rex.ferocityFever = false; rex.attackCooldown = 0; const hp = rex.hp;
    stepSkirmish(state, 1 / 60, () => 0.49);
    expect(rex.hp).toBe(hp);
  });

  it("은 치명타 보너스를 모두 합산한 뒤 판정 직전에 100%로 제한한다", () => {
    const { state, rex } = readyRex();
    // 기본 90% + 패시브 25%p + 폭주 25%p = 140%를 마지막에 100%로 제한한다.
    rex.def = { ...rex.def, stats: { ...rex.def.stats, critChance: 90 } };
    rex.ferocity = 100; rex.ferocityFever = true;
    const hit = stepSkirmish(state, 1 / 60, () => 0.999).find((event) => event.kind === "attack")!;
    expect(hit).toMatchObject({ critical: true });
  });

  it("은 300% 단일 궁극기에 게이지 110을 쓰고 실제 피해의 50%만 상한까지 회복한다", () => {
    const { state, rex, foe } = readyRex();
    expect(rex.def.ultimate).toMatchObject({ power: 300, cost: 110, targeting: "single", damageHealingPercent: 50 });
    rex.energy = 110; rex.hp = rex.maxHp - 10; foe.hp = 5;
    const events = fireUltimate(state, rex.id, () => 0.99);
    const hit = events.find((event) => event.kind === "attack")!;
    expect(hit.amount).toBeGreaterThan(foe.hp); // 사건의 계산 피해는 남은 HP보다 커도 회복은 실제 5만 본다.
    expect(rex.hp).toBe(rex.maxHp - 7.5);
    expect(rex.energy).toBe(0);

    const capped = readyRex();
    capped.rex.def = { ...capped.rex.def, stats: { ...capped.rex.def.stats, lifeSteal: 10 } };
    capped.rex.ferocity = 100; capped.rex.ferocityFever = true; capped.rex.energy = 110;
    capped.rex.hp = capped.rex.maxHp - 1;
    fireUltimate(capped.state, capped.rex.id, () => 0.99);
    // 기본 10%p + 폭주 25%p + 궁극기 50%p를 합산해도 최대 체력을 넘지 않는다.
    expect(capped.rex.hp).toBe(capped.rex.maxHp);
  });

  it("은 궁극기 피해에 패시브 공격력과 세 흡혈 원천을 합산하고 피해 반올림 뒤 회복한다", () => {
    const { state, rex, foe } = readyRex();
    // 132 × 1.25 × 3 × 1.35 = 668.25를 피해 668로 반올림한 뒤 85%를 회복한다.
    rex.def = { ...rex.def, stats: { ...rex.def.stats, lifeSteal: 10 } };
    // 대상의 전방 경감 패시브도 제거해 문서의 방어력 0·동일 속성 산술만 분리한다.
    foe.def = { ...foe.def, element: "fire", passive: rex.def.passive, stats: { ...foe.def.stats, def: 0 } };
    foe.hp = foe.maxHp = 2_000;
    rex.hp = 100; rex.ferocity = 100; rex.ferocityFever = true; rex.energy = 110;
    const hit = fireUltimate(state, rex.id, () => 0.99).find((event) => event.kind === "attack")!;
    expect(hit).toMatchObject({ critical: false, amount: 668 });
    // 기본 10%p + 폭주 25%p + 궁극기 50%p = 85%이며 회복량 자체는 재반올림하지 않는다.
    expect(rex.hp).toBeCloseTo(100 + 668 * 0.85);
  });
});

describe("각성", () => {
  it("5단계는 전투를 궁극기 준비 상태로 연다", () => {
    const ready = createSkirmish([getRelic("rex")], [getRelic("husk-shell")], ARENA, {}, { rex: 5 });
    const plain = createSkirmish([getRelic("rex")], [getRelic("husk-shell")], ARENA);
    expect(ready.fighters[0].energy).toBe(getRelic("rex").ultimate.cost);
    expect(plain.fighters[0].energy).toBe(0);
  });
});

describe("원정 난전 확장", () => {
  it("은 3대1과 3대5를 전장 안에 서로 다른 시작점으로 배치한다", () => {
    for (const enemies of [["husk-shell"], ["husk-shell", "husk-wing", "husk-raptor", "husk-shell", "husk-wing"]]) {
      const state = newSkirmish(undefined, enemies);
      expect(state.fighters).toHaveLength(3 + enemies.length);
      expect(new Set(state.fighters.filter(({ side }) => side === "enemy").map(({ x, y }) => `${x}:${y}`)).size).toBe(enemies.length);
      expect(state.fighters.every(({ x, y }) => x >= ARENA.left && x <= ARENA.right && y >= ARENA.top && y <= ARENA.bottom)).toBe(true);
    }
  });

  it("은 저장 HP와 사망 상태를 시작값으로 주입하고 전멸을 즉시 판정한다", () => {
    const state = createSkirmish([getRelic("rex"), getRelic("anky"), getRelic("dodo")], [getRelic("husk-shell")], ARENA, {}, {}, {
      playerInitialStates: [{ relicId: "rex", currentHp: 17, alive: true }, { relicId: "anky", currentHp: 0, alive: false }, { relicId: "dodo", currentHp: 0, alive: false }],
    });
    expect(state.fighters.slice(0, 3).map(({ hp, maxHp }) => hp / maxHp)).toEqual([0.17, 0, 0]);
    state.fighters[0].hp = 0;
    stepSkirmish(state, 1 / 60);
    expect(state.phase).toBe("defeat");
  });

  it("은 전체/지정 공격 증강의 대상 범위를 구분한다", () => {
    const effects: ExpeditionAugmentEffect[] = [
      { kind: "attackPowerPercent", percent: 10, scope: { kind: "all" } },
      { kind: "attackPowerPercent", percent: 20, scope: { kind: "relic", relicId: "rex" } },
    ];
    const state = createSkirmish([getRelic("rex"), getRelic("anky")], [getRelic("husk-shell")], ARENA, {}, {}, { augmentEffects: effects });
    // 같은 정의로 한 번씩 때려 지정 대상에게만 추가 20%가 붙는지 공용 공격 이벤트에서 확인한다.
    const [rex, anky, foe] = state.fighters;
    rex.x = anky.x = 400; rex.y = anky.y = 1000; foe.x = 450; foe.y = 1000;
    rex.attackCooldown = 0; anky.attackCooldown = foe.attackCooldown = 99;
    const boosted = stepSkirmish(state, 1 / 60).find((event) => event.kind === "attack")?.amount ?? 0;
    rex.attackCooldown = 99; anky.attackCooldown = 0; anky.def = { ...rex.def, id: "anky" };
    const globalOnly = stepSkirmish(state, 1 / 60).find((event) => event.kind === "attack")?.amount ?? 0;
    expect(boosted).toBeGreaterThan(globalOnly);
  });

  it("은 공격 출혈을 단일 슬롯에 중첩하고 약한 재적용이 비율을 낮추지 않는다", () => {
    const effect: ExpeditionAugmentEffect = { kind: "bleedOnAttack", percent: 4, seconds: 4, scope: { kind: "all" } };
    const state = createSkirmish([getRelic("rex")], [getRelic("husk-shell")], ARENA, {}, {}, { augmentEffects: [effect] });
    const [ally, foe] = state.fighters;
    ally.x = 400; ally.y = 1000; foe.x = 450; foe.y = 1000; ally.attackCooldown = 0; foe.attackCooldown = 99;
    foe.bleed = { remaining: 5, tickIn: 0.5, percent: 6 };
    stepSkirmish(state, 1 / 60);
    expect(foe.bleed).toMatchObject({ percent: 6, tickIn: expect.any(Number) });
    expect(foe.bleed?.remaining).toBeGreaterThan(4.9);
  });

  it("은 휴식 시 생존자를 회복하고 한 기만 부활시키되 전멸 뒤에는 부활시키지 않는다", () => {
    const party = [{ relicId: "rex", currentHp: 40, alive: true }, { relicId: "anky", currentHp: 0, alive: false }, { relicId: "dodo", currentHp: 0, alive: false }];
    expect(applyExpeditionRest(party).map(({ currentHp }) => currentHp)).toEqual([70, 25, 0]);
    expect(applyExpeditionRest(party.map((relic) => ({ ...relic, currentHp: 0, alive: false }))).every(({ alive }) => !alive)).toBe(true);
  });
});

describe("폰투스 실전 스킬과 심해 압력", () => {
  /** 공격 행동만 관찰하도록 전투원을 같은 위치에 고정한 폰투스 보스전을 만든다. */
  function pontusBattle() {
    const state = newSkirmish(["anky", "rex", "dodo"], ["pontus"]);
    const pontus = state.fighters[3];
    for (const fighter of state.fighters) { fighter.x = 400; fighter.y = 900; fighter.attackCooldown = 999; }
    return { state, pontus, allies: state.fighters.slice(0, 3) };
  }

  it("는 넓은 원형 마법 기본 공격으로 반경 안의 모든 아군만 타격한다", () => {
    const { state, pontus, allies } = pontusBattle();
    allies[2].x = ARENA.right;
    pontus.attackCooldown = 0;
    const events = stepSkirmish(state, 1 / 60).filter((event) => event.kind === "attack" && event.attackerId === pontus.id);
    expect(events.map((event) => event.kind === "attack" ? event.targetId : "")).toEqual([allies[0].id, allies[1].id]);
    expect(pontus.def.basic).toMatchObject({ damageType: "magical", targeting: "nearbyEnemies", radius: 520 });
  });

  it("는 해일 궁극기로 거리에 관계없이 생존한 모든 아군을 타격한다", () => {
    const { state, pontus, allies } = pontusBattle();
    allies[0].x = ARENA.left; allies[1].x = ARENA.right; allies[2].hp = 0;
    pontus.energy = pontus.def.ultimate.cost;
    const events = fireUltimate(state, pontus.id).filter((event) => event.kind === "attack");
    expect(events.map((event) => event.kind === "attack" ? event.targetId : "").sort()).toEqual([allies[0].id, allies[1].id].sort());
    expect(pontus.def.ultimate.targeting).toBe("battlefieldEnemies");
  });

  it("는 경과한 매 1초마다 주문력을 올리고 프레임 분할과 배속 입력에 같은 값을 만든다", () => {
    const simulate = (frames: readonly number[]) => {
      const { state, pontus } = pontusBattle();
      frames.forEach((dt) => stepSkirmish(state, dt));
      return pontus.bonusAp;
    };
    expect(simulate(Array.from({ length: 20 }, () => 0.25))).toBe(60);
    expect(simulate(Array.from({ length: 300 }, () => 1 / 60))).toBe(60);
  });

  it("는 잃은 체력에 비례한 모든 피해 감소를 40% 상한에서 공용 경계로 적용한다", () => {
    const { pontus } = pontusBattle();
    pontus.hp = pontus.maxHp * 0.6;
    expect(receivedDamage(pontus, 100)).toBe(80); // 체력 40% 손실 × 0.5%p = 20% 감소.
    pontus.hp = pontus.maxHp * 0.1;
    expect(receivedDamage(pontus, 100)).toBe(60); // 45% 계산값은 명시된 40% 상한으로 제한한다.
  });

  it("는 시간이 흐를수록 리미트 안전 반경을 좁히고 폰투스를 전장 중앙으로 접근시킨다", () => {
    const state = createSkirmish([getRelic("anky")], [getRelic("pontus")], ARENA, {}, {}, {
      boss: { phases: [{ startsAt: 0, damagePerSecond: 0, label: "관측" }, { startsAt: 1, damagePerSecond: 0, label: "해일" }], limitSeconds: 10 },
    });
    const pontus = state.fighters[1]; pontus.x = ARENA.left; pontus.stunnedFor = 999; pontus.attackCooldown = 999; state.fighters[0].attackCooldown = 999;
    const startRadius = state.boss!.pressureRadius; const startX = pontus.x;
    stepSkirmish(state, 0.25);
    expect(state.boss!.pressureRadius).toBeLessThan(startRadius);
    expect(Math.abs(pontus.x - (ARENA.left + ARENA.right) / 2)).toBeLessThan(Math.abs(startX - (ARENA.left + ARENA.right) / 2));
  });
});
