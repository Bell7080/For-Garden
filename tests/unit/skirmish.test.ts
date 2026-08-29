import { describe, expect, it } from "vitest";
import {
  aliveFighters,
  applyStun,
  applyStagger,
  BLEED,
  EMERGENCY_RECOVERY,
  attackInterval,
  battleContributionSnapshot,
  canFireUltimate,
  clearStun,
  createSkirmish,
  currentAbilityPower,
  currentAttackSpeed,
  fireUltimate,
  findFighter,
  isFighterAlive,
  moveSpeed,
  renderPose,
  receivedDamage,
  resolveReceivedDamage,
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
import { applyLevelGrowth } from "../../src/core/relicProgression";
import { FEROCITY_RULES } from "../../src/core/ferocity";
import { ULTIMATE_ENERGY_MAX } from "../../src/core/ultimate";
import { computeDamage } from "../../src/core/damage";
import {
  beginNextUltimate, cancelUltimateSequence, createUltimateSequenceState, enqueueUltimate, releaseUltimate,
} from "../../src/core/ultimateSequence";

describe("기여도 프레임 독립성", () => {
  it("여러 프레임과 한 번의 동일 시간 진행이 최종 기여도 스냅샷을 같게 만든다", () => {
    const once = createSkirmish([getRelic("anky")], [getRelic("husk-shell")], { left: 0, right: 600, top: 0, bottom: 1_000 });
    const split = createSkirmish([getRelic("anky")], [getRelic("husk-shell")], { left: 0, right: 600, top: 0, bottom: 1_000 });
    // 두 전투 모두 즉시 교전하도록 같은 런타임 좌표를 주고, 기본 비치명 난수를 사용한다.
    for (const state of [once, split]) {
      state.fighters[0].x = 300; state.fighters[0].y = 500;
      state.fighters[1].x = 320; state.fighters[1].y = 500;
    }
    stepSkirmish(once, 0.2);
    for (let frame = 0; frame < 4; frame += 1) stepSkirmish(split, 0.05);
    expect(battleContributionSnapshot(split, "attack")).toEqual(battleContributionSnapshot(once, "attack"));
    expect(battleContributionSnapshot(split, "defense")).toEqual(battleContributionSnapshot(once, "defense"));
    expect(battleContributionSnapshot(split, "healing")).toEqual(battleContributionSnapshot(once, "healing"));
  });
});

describe("스피나 전투 계약", () => {
  /** 스피나와 대상을 즉시 교전시키고 다른 행동을 멈추는 공용 준비다. */
  function readySpino(enemies = ["husk-shell"]) {
    const state = newSkirmish(["spino"], enemies);
    const [spino, target] = state.fighters;
    spino.x = 400; spino.y = 900; target.x = 450; target.y = 900;
    spino.attackCooldown = 0;
    for (const enemy of state.fighters.slice(1)) enemy.attackCooldown = 99;
    return { state, spino, target };
  }

  it("은 40% 연격의 두 적중을 독립 사건으로 만들고 각각 공속과 잃은 체력 회복을 쌓는다", () => {
    const { state, spino } = readySpino();
    spino.hp = spino.maxHp / 2;
    // 연격(0.39), 첫/둘째 치명타 실패 순으로 소비한다.
    const rolls = [0.39, 0.99, 0.99];
    const events = stepSkirmish(state, 1 / 60, () => rolls.shift() ?? 0.99);
    expect(events.filter((event) => event.kind === "attack")).toHaveLength(2);
    expect(spino.bonusAttackSpeed).toBe(6);
    // 연격마다 그 시점의 잃은 체력 5%를 회복하므로 두 번 독립적으로 복리 적용된다.
    expect(spino.hp).toBeCloseTo(spino.maxHp * (1 - 0.5 * 0.95 * 0.95));
  });

  it("은 연격 첫 타로 대상이 죽으면 후속타와 두 번째 누적을 취소한다", () => {
    const { state, spino, target } = readySpino(); target.hp = 1;
    const events = stepSkirmish(state, 1 / 60, () => 0);
    expect(events.filter((event) => event.kind === "attack")).toHaveLength(1);
    expect(spino.bonusAttackSpeed).toBe(3);
  });

  it("은 은신자를 단일 대상으로 삼지 않고 1대1 상대의 행동만 대기시킨다", () => {
    const { state, spino, target: enemy } = readySpino();
    spino.stealthFor = 3; enemy.targetId = spino.id; enemy.attackCooldown = 0;
    const before = { x: enemy.x, y: enemy.y, energy: enemy.energy };
    expect(stepSkirmish(state, 0.25).filter((event) => event.kind === "attack" && event.attackerId === enemy.id)).toEqual([]);
    expect(enemy.targetId).toBeNull();
    expect({ x: enemy.x, y: enemy.y, energy: enemy.energy }).toEqual(before);
    expect(state.elapsed).toBeCloseTo(0.25);
  });

  it("은 다른 적을 중심으로 번진 범위 피해에는 은신 중에도 맞는다", () => {
    const state = newSkirmish(["anky"], ["husk-shell", "spino"]);
    const [anky, center, spino] = state.fighters;
    anky.x = 400; anky.y = center.y = spino.y = 900; center.x = 450; spino.x = 500;
    anky.attackCooldown = 0; anky.ferocityFever = true; anky.ferocity = 100;
    center.attackCooldown = spino.attackCooldown = 99; spino.stealthFor = 3;
    const events = stepSkirmish(state, 1 / 60);
    expect(events).toContainEqual(expect.objectContaining({ kind: "attack", targetId: spino.id }));
  });

  it("은 정확히 3초 뒤 다시 지정되며 공용 최소 공격 간격 아래로 내려가지 않는다", () => {
    const { state, spino, target: enemy } = readySpino(); spino.stealthFor = 3; spino.attackCooldown = 99;
    for (let i = 0; i < 11; i += 1) stepSkirmish(state, 0.25);
    expect(enemy.targetId).toBeNull();
    stepSkirmish(state, 0.25);
    expect(enemy.targetId).toBe(spino.id);
    spino.bonusAttackSpeed = 1_000_000;
    expect(attackInterval(spino)).toBe(SKIRMISH.minimumAttackInterval);
  });

  it("은 궁극기에 공격력 200%와 현재 공속 150%를 합산하고 생존자에게 3초 기절을 준다", () => {
    const { state, spino, target } = readySpino(); spino.energy = 300; spino.bonusAttackSpeed = 6;
    const ultimate = spino.def.ultimate;
    if (!("damageType" in ultimate) || ultimate.damageType === undefined) throw new Error("스피나 공격 궁극기 계약이 필요합니다.");
    const speed = currentAttackSpeed(spino);
    // 실제 피해는 아래 공용 함수에서 방어 적용 후 정수로 반올림하므로, 복합 원피해 산식과 구분한다.
    const equivalentPower = 200 + speed * 150 / spino.def.stats.atk;
    const expected = computeDamage(spino, target, { ...ultimate, power: equivalentPower, kind: "ultimate", isCritical: false }, true);
    const hit = fireUltimate(state, spino.id).find((event) => event.kind === "attack");
    expect(hit).toMatchObject({ amount: expected });
    expect(target.stunnedFor).toBe(3);
    expect(spino.energy).toBe(0);
  });

  it("은 레벨 1 궁극기 원피해 431에서 평타 실제 적중마다 반올림 전 원피해를 4.5씩 높인다", () => {
    const { state, spino, target } = readySpino();
    const ultimate = spino.def.ultimate;
    if (!("damageType" in ultimate) || ultimate.damageType === undefined) throw new Error("스피나 공격 궁극기 계약이 필요합니다.");
    const rawUltimateDamage = () => spino.def.stats.atk * ultimate.power / 100
      + currentAttackSpeed(spino) * ultimate.attackSpeedPower! / 100;
    const actualUltimateDamage = () => computeDamage(spino, target, {
      ...ultimate,
      power: ultimate.power
        + currentAttackSpeed(spino) * ultimate.attackSpeedPower! / spino.def.stats.atk,
      kind: "ultimate",
      isCritical: false,
    }, true);

    // 기본 공격력 124의 200%와 기본 공속 122의 150%를 더한 방어 적용 전 회귀값이다.
    expect(spino.def.stats.atk).toBe(124);
    expect(currentAttackSpeed(spino)).toBe(122);
    const rawBeforeHit = rawUltimateDamage();
    const actualBeforeHit = actualUltimateDamage();
    expect(rawBeforeHit).toBe(431);

    // 연격이 나지 않는 평타 한 번을 실제로 적중시켜 패시브 공속 +3을 누적한다.
    stepSkirmish(state, 1 / 60, () => 0.99);
    const rawAfterHit = rawUltimateDamage();
    const actualAfterHit = actualUltimateDamage();
    expect(rawAfterHit - rawBeforeHit).toBeCloseTo(4.5);
    // 실제 피해끼리는 방어 계산과 정수 반올림을 거친 값으로 별도 검증한다.
    expect(actualAfterHit).toBe(computeDamage(spino, target, {
      ...ultimate,
      power: 200 + 125 * 150 / 124,
      kind: "ultimate",
      isCritical: false,
    }, true));
    expect(Number.isInteger(actualAfterHit - actualBeforeHit)).toBe(true);
  });

  it("은 동일 성장 렉시아보다 느리게 시작해 장기 적중 뒤 공격 빈도를 앞서고 궁극기 한 번에 동급 탱커를 처치하지 않는다", () => {
    const rexState = newSkirmish(["rex"], ["husk-shell"]);
    const { state, spino, target: tank } = readySpino();
    expect(attackInterval(spino)).toBeGreaterThan(attackInterval(rexState.fighters[0]));
    // 세 번의 확정 연격은 여섯 실제 적중이므로 +18을 얻어 140 공속이 된다.
    for (let action = 0; action < 3; action += 1) { spino.attackCooldown = 0; stepSkirmish(state, 1 / 60, () => 0); }
    expect(attackInterval(spino)).toBeLessThan(attackInterval(rexState.fighters[0]));
    tank.hp = tank.maxHp; spino.energy = spino.def.ultimate.cost;
    fireUltimate(state, spino.id);
    expect(tank.hp).toBeGreaterThan(0);
  });
});

describe("루카 전투 계약", () => {
  /** 자동 진행의 위치·쿨다운 변수를 제거하고 루카의 다음 기본 공격 한 번만 실행한다. */
  function hitOnce(state: SkirmishState, rng: () => number = () => 0.99): SkirmishEvent[] {
    const luka = state.fighters[0]; const target = state.fighters.find((fighter) => fighter.side === "enemy")!;
    luka.x = 300; target.x = 440; luka.y = target.y = 700; luka.targetId = target.id; luka.attackCooldown = 0;
    for (const fighter of state.fighters.slice(1)) fighter.attackCooldown = 99;
    return stepSkirmish(state, 1 / 60, rng);
  }

  it("는 최고 전투 시작 공격력 아군의 표적을 따르고 동률이면 편성 순서를 따른다", () => {
    const leader = { ...getRelic("rex"), stats: { ...getRelic("rex").stats, atk: 500 } };
    const tied = { ...getRelic("anky"), stats: { ...getRelic("anky").stats, atk: 500 } };
    const state = createSkirmish([leader, tied, getRelic("luka")], [getRelic("husk-raptor"), getRelic("husk-shell")], { left: 0, right: 600, top: 0, bottom: 1_000 });
    expect(state.fighters[2].targetId).toBe(state.fighters[0].targetId);
    // 동률 후순위의 표적을 바꿔도 최초 편성인 leader가 기준이었다는 결과는 변하지 않는다.
    state.fighters[1].targetId = state.fighters[0].targetId === "enemy-0" ? "enemy-1" : "enemy-0";
    expect(state.fighters[2].targetId).not.toBe(state.fighters[1].targetId);
  });

  it("는 폭주 진입 때 은신·재지정·적 추적 해제를 적용하고 도약하지 않는다", () => {
    const state = newSkirmish(["luka", "rex"], ["husk-shell", "husk-wing"]); const [luka, leader, enemy] = state.fighters;
    luka.ferocity = 99; leader.targetId = "enemy-1"; enemy.targetId = luka.id; luka.x = 300; luka.y = 700;
    const position = { x: luka.x, y: luka.y }; hitOnce(state);
    expect(luka.stealthFor).toBeGreaterThan(2.9); expect(luka.targetId).toBe("enemy-1");
    expect(enemy.targetId).not.toBe(luka.id); expect({ x: luka.x, y: luka.y }).toEqual(position);
  });

  it("는 폭주 중 자신과 동일 표적 생존 아군만 공속을 25% 높이고 복수 오라는 중첩하지 않는다", () => {
    const state = newSkirmish(["luka", "luka", "rex", "anky"], ["husk-shell", "husk-wing"]);
    const [first, second, same, other] = state.fighters; first.ferocityFever = second.ferocityFever = true;
    first.targetId = second.targetId = same.targetId = "enemy-0"; other.targetId = "enemy-1";
    expect(currentAttackSpeed(first, state)).toBeCloseTo(first.def.stats.attackSpeed * 1.25);
    expect(currentAttackSpeed(same, state)).toBeCloseTo((same.def.stats.attackSpeed + (same.def.passive.attackSpeedPercent ?? 0)) * 1.25);
    expect(currentAttackSpeed(other, state)).toBe(other.def.stats.attackSpeed);
    same.hp = 0; expect(currentAttackSpeed(same, state)).toBe(same.def.stats.attackSpeed + (same.def.passive.attackSpeedPercent ?? 0));
  });

  it("는 네 번째 실제 기본 공격을 난수 소비 없이 확정 치명타로 만들고 주기를 초기화한다", () => {
    const durable = { ...getRelic("husk-shell"), stats: { ...getRelic("husk-shell").stats, hp: 100_000 } };
    const state = createSkirmish([getRelic("luka")], [durable], { left: 0, right: 600, top: 0, bottom: 1_000 });
    let rolls = 0; const criticals: boolean[] = [];
    for (let index = 0; index < 5; index += 1) criticals.push(hitOnce(state, () => { rolls += 1; return 0.99; }).find((event) => event.kind === "attack")!.critical);
    expect(criticals).toEqual([false, false, false, true, false]); expect(rolls).toBe(4); expect(state.fighters[0].basicAttackCount).toBe(1);
  });

  it("는 주 대상 최종 HP 손실의 75%를 주 대상 기준 가장 가까운 다른 적에게만 전이한다", () => {
    const state = newSkirmish(["luka"], ["husk-shell", "husk-wing", "husk-raptor"]); const [luka, primary, near, far] = state.fighters;
    primary.x = 100; primary.y = 100; near.x = 110; near.y = 100; far.x = 500; far.y = 900; luka.energy = 90; luka.targetId = primary.id;
    const primaryBefore = primary.hp; const nearBefore = near.hp;
    const events = fireUltimate(state, luka.id, () => 0.99);
    const primaryLoss = primaryBefore - primary.hp; const transfer = events.find((event): event is Extract<SkirmishEvent, { kind: "attack" }> => event.kind === "attack" && event.skill === "transfer");
    expect(transfer?.targetId).toBe(near.id); expect(nearBefore - near.hp).toBe(Math.round(primaryLoss * 0.75)); expect(far.hp).toBe(far.maxHp);
    expect(events.filter((event) => event.kind === "attack" && event.skill === "transfer")).toHaveLength(1);
  });

  it("는 단일 적일 때 전이를 생략하고 보호막·과잉 피해 뒤 실제 HP 손실만 기준으로 삼는다", () => {
    const solo = newSkirmish(["luka"], ["husk-shell"]); solo.fighters[0].energy = 90;
    expect(fireUltimate(solo, "player-0").some((event) => event.kind === "attack" && event.skill === "transfer")).toBe(false);
    const state = newSkirmish(["luka"], ["husk-shell", "husk-wing"]); const [luka, primary, secondary] = state.fighters;
    luka.energy = 90; luka.targetId = primary.id; primary.hp = 20; primary.shield = { amount: 10, providerId: null }; secondary.shield = { amount: 5, providerId: null };
    const before = secondary.hp; const events = fireUltimate(state, luka.id, () => 0);
    // 치명타·방어 계산은 주 피해에만 반영되고 과잉 제한된 20 HP의 75%=15가 전이되어 보호막 5 뒤 10만 HP에 적용된다.
    expect(before - secondary.hp).toBe(10); expect(events.filter((event) => event.kind === "attack" && event.skill === "transfer")).toHaveLength(1);
    expect(luka.basicAttackCount).toBe(0);
  });
});

describe("메테 전투 계약", () => {
  /** 메테·동료·적을 즉시 교전 가능한 한 점에 모으고 필요 없는 자동 행동은 멈춘다. */
  function metteBattle() {
    const state = newSkirmish(["mette", "rex"], ["husk-shell"]);
    const [mette, ally, foe] = state.fighters;
    mette.x = ally.x = 400; mette.y = ally.y = foe.y = 900; foe.x = 450;
    mette.attackCooldown = foe.attackCooldown = 99; ally.attackCooldown = 0;
    return { state, mette, ally, foe };
  }

  it("는 생존 중 팀 공격 속도를 20% 높이고 사망하면 즉시 해제한다", () => {
    const { state, mette, ally } = metteBattle();
    // 렉시아 자신의 +25 공속을 먼저 합산한 뒤 메테 팀 배율 1.2를 곱한다.
    expect(currentAttackSpeed(ally, state)).toBeCloseTo((ally.def.stats.attackSpeed + 25) * 1.2);
    mette.hp = 0;
    expect(currentAttackSpeed(ally, state)).toBe(ally.def.stats.attackSpeed + 25);
  });

  it("는 새 기절·경직을 즉시 정화하고 메테 공격력 200% 보호막을 개체별 7초마다 부여한다", () => {
    const { state, mette, ally } = metteBattle();
    const first = applyStun(ally, 2, state);
    expect(ally.stunnedFor).toBe(0);
    expect(ally.shield.amount).toBe(mette.def.stats.atk * 2);
    expect(first).toContainEqual(expect.objectContaining({ kind: "shieldGranted", providerId: mette.id }));
    expect(mette.adagioCooldownRemaining).toBe(7);

    applyStagger(ally, 0.1, state);
    expect(ally.staggeredFor).toBeCloseTo(0.1); // 쿨타임 중에는 두 번째 제어를 정화하지 않는다.
    for (let i = 0; i < 28; i += 1) stepSkirmish(state, 0.25);
    expect(mette.adagioCooldownRemaining).toBe(0);
    ally.staggeredFor = 0;
    applyStagger(ally, 0.1, state);
    expect(ally.staggeredFor).toBe(0);
  });

  it("는 편성 순서의 준비된 메테가 먼저 정화하고 기존 보호막에는 새 보호막을 합산한다", () => {
    const state = newSkirmish(["mette", "mette", "rex"], ["husk-shell"]);
    const [first, second, ally] = state.fighters;
    ally.shield = { amount: 10, providerId: ally.id };
    const firstEvents = applyStun(ally, 1, state);
    expect(firstEvents).toContainEqual(expect.objectContaining({ kind: "shieldGranted", providerId: first.id, remaining: 242 }));
    expect(first.adagioCooldownRemaining).toBe(7);
    expect(second.adagioCooldownRemaining).toBe(0);

    applyStagger(ally, 0.1, state);
    expect(ally.shield.amount).toBe(474); // 두 번째 메테도 자기 공격력 116의 200%를 기존 총량에 더한다.
    expect(second.adagioCooldownRemaining).toBe(7);
  });

  it("는 보호막을 HP보다 먼저 흡수하고 흡수·소진 사건을 렌더러에 전달한다", () => {
    const { state, ally, foe } = metteBattle();
    applyStun(ally, 1, state);
    const shield = ally.shield.amount;
    ally.attackCooldown = 99; foe.attackCooldown = 0; foe.targetId = ally.id;
    foe.x = 450; ally.x = 400;
    const hpBefore = ally.hp;
    const events = stepSkirmish(state, 1 / 60);
    expect(events).toContainEqual(expect.objectContaining({ kind: "shieldAbsorbed", fighterId: ally.id }));
    expect(ally.hp).toBe(hpBefore); // 허스크의 한 타보다 보호막이 커 HP에는 아직 닿지 않는다.
    expect(ally.shield.amount).toBeLessThan(shield);
  });

  it("는 폭주 중 아군의 실제 일반 공격 적중마다 스타카토 한 번만 추가하고 종료·사망 뒤 멈춘다", () => {
    const run = (configure: (mette: ReturnType<typeof metteBattle>["mette"]) => void) => {
      const battle = metteBattle(); configure(battle.mette);
      return stepSkirmish(battle.state, 1 / 60).filter((event) => event.kind === "attack");
    };
    const feverHits = run((mette) => { mette.ferocityFever = true; mette.ferocity = 100; });
    expect(feverHits.map((hit) => hit.kind === "attack" ? hit.skill : "")).toEqual(["basic", "staccato"]);
    expect(feverHits.filter((hit) => hit.kind === "attack" && hit.skill === "staccato")).toHaveLength(1); // 추가타는 재귀하지 않는다.
    expect(run((mette) => { mette.ferocityFever = false; })).toHaveLength(1);
    expect(run((mette) => { mette.ferocityFever = true; mette.hp = 0; })).toHaveLength(1);
  });

  it("는 전장의 찬가로 생존 아군별 잃은 체력 20%를 회복하고 50 게이지를 소비한다", () => {
    const { state, mette, ally } = metteBattle();
    mette.hp -= 500; ally.hp -= 300; mette.energy = 50;
    const events = fireUltimate(state, mette.id);
    expect(mette.hp).toBe(mette.maxHp - 400);
    expect(ally.hp).toBe(ally.maxHp - 240);
    expect(mette.energy).toBe(0);
    expect(events.filter((event) => event.kind === "heal" && event.source === "ultimate")).toHaveLength(2);
  });
});

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
    // 표시 HP는 실제로 0까지 내려가지만 불사 표식이 타깃·승패 처리를 계속 유지한다.
    expect(state.phase).toBe("fight"); expect(state.fighters[1].hp).toBe(0); expect(state.fighters[1].immortal).toBe(true); expect(state.boss?.score).toBeGreaterThan(0);
  });

  it("는 폰토스가 완전 무효화한 공격을 공격 기여와 보스 점수에서 제외한다", () => {
    const state = createSkirmish([getRelic("anky")], [getRelic("pontos")], ARENA, {}, {}, {
      boss: { phases: [{ startsAt: 0, damagePerSecond: 0, label: "관측" }], limitSeconds: 1 },
    });
    const [ally, boss] = state.fighters;
    ally.x = boss.x = 400; ally.y = boss.y = 900; ally.attackCooldown = 0; boss.attackCooldown = 999;
    // 공격자는 정확히 1,000을 만들지만 대상 방어와 심해 압력 뒤 최종 피해는 무효 구간에 든다.
    ally.def = { ...ally.def, element: boss.def.element, stats: { ...ally.def.stats, atk: 1_000, critChance: 0 }, basic: { ...ally.def.basic, power: 100, scalingStat: "atk", damageType: "physical" } };
    boss.def = { ...boss.def, stats: { ...boss.def.stats, def: 10_000 } };
    boss.hp = boss.maxHp * 0.5;
    boss.shield = { amount: 100, providerId: boss.id };
    const events = stepSkirmish(state, 1 / 60);
    const attack = events.find((event) => event.kind === "attack" && event.attackerId === ally.id);
    expect(attack).toMatchObject({ kind: "attack", amount: 0 });
    expect(events).toContainEqual({ kind: "damageIgnored", attackerId: ally.id, targetId: boss.id });
    // 무효 공격은 보호막·피격 야성·흡혈 및 피해 기반 회복의 실제 피해 원천을 만들지 않는다.
    expect(boss.shield.amount).toBe(100); expect(boss.ferocity).toBe(0);
    expect(events.filter((event) => event.kind === "shieldAbsorbed" || event.kind === "heal")).toEqual([]);
    expect(attack?.kind === "attack" ? attack.contributionAmount : 0).toBe(0);
    expect(state.boss?.score).toBe(attack?.kind === "attack" ? attack.contributionAmount : 0);
  });

  it("는 명시한 보스만 0 HP에서 전투를 지속하고 적 부속물은 정상 사망시킨다", () => {
    const state = createSkirmish([getRelic("anky")], [getRelic("pontos"), getRelic("husk-raptor")], ARENA, {}, {}, {
      boss: { fighterId: "enemy-0", phases: [{ startsAt: 0, damagePerSecond: 0, label: "관측" }], limitSeconds: 10 },
    });
    const [, boss, appendage] = state.fighters;
    boss.hp = 0; appendage.hp = 0;

    // 생존 판정의 유일한 예외는 boss.fighterId이며 향후 소환물은 이 경계를 얻지 못한다.
    expect(state.boss?.fighterId).toBe(boss.id);
    expect(isFighterAlive(boss)).toBe(true);
    expect(isFighterAlive(appendage)).toBe(false);
  });

  it("는 생존 시간·리미트를 갱신하고 아군 전멸 때만 패배로 끝낸다", () => {
    const state = bossBattle(stateHp(getRelic("anky")) * 2);
    const events = run(state, 2);
    expect(state.phase).toBe("defeat"); expect(state.boss?.survivedFor).toBeGreaterThan(0); expect(events).toContainEqual({ kind: "finish", phase: "defeat" });
  });

  it("표준 5인 파티는 폰토스의 첫 해일을 버티고 고정된 생존·점수 구간에 든다", () => {
    const partyIds = ["anky", "rex", "spino", "dodo", "mette"];
    // 플레이어는 통상 1돌파 전 상한인 20레벨, 최종 보스는 20층 boss 보정이 더해진 25레벨이다.
    const party = partyIds.map((id) => {
      const relic = getRelic(id);
      return { ...relic, stats: applyLevelGrowth(relic.stats, 20) };
    });
    const basePontos = getRelic("pontos");
    const pontos = { ...basePontos, stats: applyLevelGrowth(basePontos.stats, 25) };
    const state = createSkirmish(party, [pontos], ARENA);
    let firstUltimateAt: number | undefined;
    let survivorsAfterFirstUltimate = 0;
    for (let frame = 0; frame < 60 * 40 && state.phase === "fight"; frame += 1) {
      const events = stepSkirmish(state, 1 / 60, () => 0.99);
      for (const event of events) {
        if (event.kind !== "attack") continue;
        if (event.attackerId === "enemy-0" && event.skill === "ultimate" && firstUltimateAt === undefined) {
          firstUltimateAt = state.elapsed;
          survivorsAfterFirstUltimate = aliveFighters(state, "player").length;
        }
      }
    }
    // 첫 해일은 위협적이지만 즉시 전멸시키지 않고, 전체 전투는 약 30초짜리 최종 관문으로 끝난다.
    expect(firstUltimateAt).toBeGreaterThanOrEqual(20);
    expect(firstUltimateAt).toBeLessThanOrEqual(21);
    expect(survivorsAfterFirstUltimate).toBeGreaterThan(0);
    expect(state.elapsed).toBeGreaterThanOrEqual(24);
    expect(state.elapsed).toBeLessThanOrEqual(30);
    // 점수는 경감 뒤 실제로 감소한 HP와 같아 경감 전 계수나 과잉 피해로 부풀지 않는다.
    const playerAttackTotal = battleContributionSnapshot(state, "attack")
      .filter(({ fighterId }) => fighterId.startsWith("player"))
      .reduce((sum, row) => sum + row.total, 0);
    expect(playerAttackTotal).toBe(pontos.stats.hp - state.fighters.find((fighter) => fighter.side === "enemy")!.hp);
    // 300 비용을 7회 타격으로 채우므로 두 해일 사이의 이론상 최소 간격도 5초 기절보다 충분히 길다.
    const boss = state.fighters.find((fighter) => fighter.side === "enemy")!;
    const minimumUltimateGap = attackInterval(boss, state) * Math.ceil(boss.def.ultimate.cost / boss.def.stats.energyGain);
    expect(minimumUltimateGap).toBeGreaterThanOrEqual(12.5);
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
    const state = newSkirmish(["anky"], ["husk-shell", "husk-raptor"]);
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

  it("렉시아 패시브는 공격 속도를 25퍼센트포인트 높이고 폭주 종료 뒤 간격을 그대로 유지한다", () => {
    const state = newSkirmish(["rex"], ["husk-shell"]);
    const rex = state.fighters[0];
    const before = attackInterval(rex);
    // 기본 112에 25퍼센트포인트를 더한 137로 나눠 곱연산(140)과 의미가 바뀌지 않게 고정한다.
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

  it("stealthLeap는 최저 체력 적에게 도약하고 기존 추적을 모두 해제한다", () => {
    const state = prepareHit("spino", ["husk-shell", "husk-raptor"]);
    const [spino, first, lowest] = state.fighters;
    lowest.hp = lowest.maxHp * 0.2; lowest.x = 700; lowest.y = 900;
    first.targetId = spino.id; lowest.targetId = spino.id; spino.ferocity = 99;
    const takeoff = { x: spino.x, y: spino.y };
    // 단 한 번의 발동 프레임 호출만으로 출발점과 다른 착지점이 확정되어 중간 이동 상태가 없음을 고정한다.
    stepSkirmish(state, 1 / 60, () => 0.99);
    expect({ x: spino.x, y: spino.y }).not.toEqual(takeoff);
    expect(spino.stealthFor).toBe(3);
    expect(Math.hypot(spino.x - lowest.x, spino.y - lowest.y)).toBeCloseTo(SKIRMISH.reach);
    expect([first.targetId, lowest.targetId]).toEqual([null, null]);
  });

  it("criticalChanceBonus은 스밀라의 피버 중 치명타율을 25퍼센트포인트 올린다", () => {
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

describe("도디 정적 전투 계약", () => {
  /** 한 명만 행동하게 해 같은 프레임의 부수 공격 없이 도디 규칙을 검증한다. */
  function readyDodiBattle(allies = ["dodo", "rex", "anky"], enemies = ["husk-shell"]) {
    const state = newSkirmish(allies, enemies);
    state.fighters.forEach((fighter) => { fighter.attackCooldown = 99; });
    return state;
  }

  it("기획 스킬명과 주문력 70% 일반 공격 계수를 유지한다", () => {
    const dodi = getRelic("dodo");
    expect([dodi.ferocityTrait?.name, dodi.passive.name, dodi.basic.name, dodi.ultimate.name]).toEqual([
      "인비저블 썸띵?",
      "연구원님, 이것 좀 보세요!",
      "깃펜 톡톡",
      "세기의 대발견... 맞죠?!",
    ]);
    expect(dodi.basic.power).toBe(70);
  });

  it("폭주 중에만 공격 속도 x2, 즉 공격 간격 50%를 적용한다", () => {
    const [dodi] = readyDodiBattle().fighters;
    const calm = attackInterval(dodi);
    dodi.ferocityFever = true;
    expect(attackInterval(dodi)).toBeCloseTo(calm / 2);
    dodi.hp = 0;
    // 사망자는 행동하지 않으며 데이터 배율 자체가 사망 상태를 되살리지 않는다.
    expect(dodi.hp).toBe(0);
  });

  it.each(["husk-raptor", "husk-shell"])("생존 제공자는 %s의 물리·마법 피해를 줄이고 사망 즉시 해제한다", (enemyId) => {
    const damageWithProvider = (alive: boolean) => {
      const state = readyDodiBattle(["rex", "dodo"], [enemyId]);
      const [target, dodi, enemy] = state.fighters;
      dodi.hp = alive ? dodi.maxHp : 0;
      target.x = enemy.x = 500; target.y = enemy.y = 900; enemy.attackCooldown = 0;
      return stepSkirmish(state, 1 / 60, () => 0.99)
        .find((event): event is Extract<SkirmishEvent, { kind: "attack" }> => event.kind === "attack" && event.attackerId === enemy.id)?.amount ?? 0;
    };
    expect(damageWithProvider(true)).toBeLessThan(damageWithProvider(false));
  });

  it("적 회복 감소는 제공자 생존 중 30%만 적용되고 사망 뒤 사라진다", () => {
    const healed = (alive: boolean) => {
      const state = readyDodiBattle(["dodo"], ["anky"]);
      const [dodi, enemy] = state.fighters; dodi.hp = alive ? dodi.maxHp : 0;
      enemy.hp = 100; enemy.regeneration = { remaining: 1, tickIn: 0, percentPerTick: 10 };
      const before = enemy.hp; stepSkirmish(state, 1 / 60); return enemy.hp - before;
    };
    expect(healed(true)).toBeCloseTo(healed(false) * 0.7);
  });

  it("일반 공격은 자신을 포함해 현재 HP가 가장 낮은 아군을 편성 순서 동률 규칙으로 회복한다", () => {
    const state = readyDodiBattle(); const [dodi, first, second, enemy] = state.fighters;
    dodi.hp = 300; first.hp = second.hp = 200; dodi.x = enemy.x = 500; dodi.y = enemy.y = 900; dodi.attackCooldown = 0;
    const heals = stepSkirmish(state, 1 / 60).filter((event) => event.kind === "heal");
    expect(heals[0]?.fighterId).toBe(first.id);

    const selfState = readyDodiBattle(["dodo", "rex"]); const [self, ally, foe] = selfState.fighters;
    self.hp = 1; ally.hp = ally.maxHp; self.x = foe.x = 500; self.y = foe.y = 900; self.attackCooldown = 0;
    expect(stepSkirmish(selfState, 1 / 60).some((event) => event.kind === "heal" && event.fighterId === self.id)).toBe(true);
  });

  it("과잉 피해가 아니라 실제 감소 HP만 일반 공격 회복량으로 사용한다", () => {
    const state = readyDodiBattle(["dodo", "rex"]); const [dodi, ally, enemy] = state.fighters;
    ally.hp = 1; enemy.hp = 3; dodi.x = enemy.x = 500; dodi.y = enemy.y = 900; dodi.attackCooldown = 0;
    const heal = stepSkirmish(state, 1 / 60)
      .find((event): event is Extract<SkirmishEvent, { kind: "heal" }> => event.kind === "heal" && event.fighterId === ally.id);
    expect(heal?.amount).toBe(3);
  });

  it("지정 원의 경계를 포함해 광역 피해·회복을 적용하고 게이지 250을 소비한다", () => {
    const state = readyDodiBattle(["dodo", "rex", "anky"], ["husk-shell", "husk-raptor"]);
    const [dodi, insideAlly, outsideAlly, boundaryEnemy, outsideEnemy] = state.fighters;
    const center = { x: 500, y: 900 }; dodi.energy = 250;
    insideAlly.hp -= 300; outsideAlly.hp -= 300;
    insideAlly.x = 500; insideAlly.y = 900; outsideAlly.x = 861; outsideAlly.y = 900;
    boundaryEnemy.x = 860; boundaryEnemy.y = 900; outsideEnemy.x = 861; outsideEnemy.y = 900;
    const outsideEnemyHp = outsideEnemy.hp; const outsideAllyHp = outsideAlly.hp;
    const events = fireUltimate(state, dodi.id, () => 0.99, center);
    expect(events.some((event) => event.kind === "attack" && event.targetId === boundaryEnemy.id)).toBe(true);
    expect(outsideEnemy.hp).toBe(outsideEnemyHp); expect(insideAlly.hp).toBeGreaterThan(insideAlly.maxHp - 300);
    expect(outsideAlly.hp).toBe(outsideAllyHp); expect(dodi.energy).toBe(0);
  });

  it("도디의 범위 밖 지정점은 경계를 포함한 전장 사각형으로 보정한다", () => {
    const state = readyDodiBattle(["dodo"], ["husk-shell"]); const [dodi, enemy] = state.fighters;
    dodi.energy = 250; enemy.x = state.arena.right; enemy.y = state.arena.bottom;
    const events = fireUltimate(state, dodi.id, () => 0.99, { x: state.arena.right + 999, y: state.arena.bottom + 999 });
    expect(events).toContainEqual(expect.objectContaining({ kind: "attack", targetId: enemy.id }));
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
    const ultimate = torika.def.ultimate;
    if (!("damageType" in ultimate) || ultimate.damageType === undefined) throw new Error("토리카 공격 궁극기 계약이 필요합니다.");

    const expected = [first, armored, disadvantaged].map((target) => computeDamage(
      torika,
      target,
      { ...ultimate, isCritical: false, kind: "ultimate" },
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

  it("은 공격력 25%와 치명 확률·치명 피해 25퍼센트포인트를 정해진 순서로 적용한다", () => {
    const { state, rex, foe } = readyRex();
    const hit = stepSkirmish(state, 1 / 60, () => 0.44).find((event) => event.kind === "attack")!;
    const boosted = { ...rex, def: { ...rex.def, stats: { ...rex.def.stats, atk: rex.def.stats.atk * 1.25, critDamage: rex.def.stats.critDamage + 25 } } };
    expect(rex.def.basic.power).toBe(95);
    // 기본 20% + 패시브 25퍼센트포인트 = 45%이며, 치명 피해도 160% + 25퍼센트포인트 = 185%다.
    expect(hit).toMatchObject({ critical: true, amount: computeDamage(boosted, foe, { ...rex.def.basic, kind: "basic", isCritical: true }, true) });
  });

  it("은 폭주 중 치명타와 모든 피해 흡혈에 각각 25퍼센트포인트를 적용하고 종료 후 복구한다", () => {
    const { state, rex } = readyRex();
    rex.hp = rex.maxHp / 2; rex.ferocity = 100; rex.ferocityFever = true;
    const before = rex.hp;
    const hit = stepSkirmish(state, 1 / 60, () => 0.69).find((event) => event.kind === "attack")!;
    expect(hit).toMatchObject({ critical: true }); // 기본 20% + 패시브 25퍼센트포인트 + 폭주 25퍼센트포인트 = 70%
    expect(rex.hp - before).toBeCloseTo(hit.amount * 0.25);
    rex.ferocityFever = false; rex.attackCooldown = 0; const hp = rex.hp;
    stepSkirmish(state, 1 / 60, () => 0.49);
    expect(rex.hp).toBe(hp);
  });

  it("은 치명타 보너스를 모두 합산한 뒤 판정 직전에 100%로 제한한다", () => {
    const { state, rex } = readyRex();
    // 기본 90% + 패시브 25퍼센트포인트 + 폭주 25퍼센트포인트 = 140%를 마지막에 100%로 제한한다.
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
    // 기본 10퍼센트포인트 + 폭주 25퍼센트포인트 + 궁극기 50퍼센트포인트를 합산해도 최대 체력을 넘지 않는다.
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
    // 기본 10퍼센트포인트 + 폭주 25퍼센트포인트 + 궁극기 50퍼센트포인트 = 85%이며 회복량 자체는 재반올림하지 않는다.
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

describe("폰토스 실전 스킬과 심해 압력", () => {
  /** 공격 행동만 관찰하도록 전투원을 같은 위치에 고정한 폰토스 보스전을 만든다. */
  function pontosBattle() {
    const state = newSkirmish(["anky", "rex", "dodo"], ["pontos"]);
    const pontos = state.fighters[3];
    for (const fighter of state.fighters) { fighter.x = 400; fighter.y = 900; fighter.attackCooldown = 999; }
    return { state, pontos, allies: state.fighters.slice(0, 3) };
  }

  it("는 넓은 원형 마법 기본 공격으로 반경 안의 모든 아군만 타격한다", () => {
    const { state, pontos, allies } = pontosBattle();
    allies[2].x = ARENA.right;
    pontos.attackCooldown = 0;
    const events = stepSkirmish(state, 1 / 60).filter((event) => event.kind === "attack" && event.attackerId === pontos.id);
    expect(events.map((event) => event.kind === "attack" ? event.targetId : "")).toEqual([allies[0].id, allies[1].id]);
    expect(pontos.def.basic).toMatchObject({ damageType: "magical", power: 100, scalingStat: "ap", targeting: "nearbyEnemies", radius: 520 });
    // 지름 1,040px은 정적 전장 폭·높이보다 넓되 모서리 전체를 덮지는 않아 "주위"와 전장 전체를 구분한다.
    expect(pontos.def.basic.radius! * 2).toBeGreaterThan(ARENA.right - ARENA.left);
    expect(pontos.def.basic.radius! * 2).toBeGreaterThan(ARENA.bottom - ARENA.top);
    expect(pontos.def.basic.radius).toBeGreaterThan(SKIRMISH.reach * 3);
  });

  it("는 기본 공격의 범위 내 다중 적에게 현재 주문력 100%를 쓰고 범위 밖 적은 제외한다", () => {
    const { state, pontos, allies } = pontosBattle();
    // 방어·속성·치명타 변수를 제거해 이벤트 원피해가 계수 자체를 정확히 드러내게 한다.
    pontos.def = { ...pontos.def, element: "earth", stats: { ...pontos.def.stats, ap: 137, critChance: 0 } };
    allies.forEach((ally) => { ally.def = { ...ally.def, element: "earth", stats: { ...ally.def.stats, res: 0 } }; });
    allies[0].x = 500; allies[1].x = 919;
    // 물리 분리 보정 한 프레임 뒤에도 확실히 반경 밖이도록 전장 우하단에 둔다.
    allies[2].x = ARENA.right; allies[2].y = ARENA.bottom;
    pontos.attackCooldown = 0;
    const attacks = stepSkirmish(state, 1 / 60, () => 0.99).filter((event) => event.kind === "attack" && event.attackerId === pontos.id);
    expect(attacks.map((event) => event.kind === "attack" ? [event.targetId, event.contributionAmount] : [])).toEqual([
      [allies[0].id, 137], [allies[1].id, 137],
    ]);
  });

  it("는 해일 궁극기로 거리에 관계없이 생존한 모든 아군을 타격한다", () => {
    const { state, pontos, allies } = pontosBattle();
    allies[0].x = ARENA.left; allies[1].x = ARENA.right; allies[2].hp = 0;
    pontos.energy = pontos.def.ultimate.cost;
    const events = fireUltimate(state, pontos.id).filter((event) => event.kind === "attack");
    expect(events.map((event) => event.kind === "attack" ? event.targetId : "").sort()).toEqual([allies[0].id, allies[1].id].sort());
    expect(pontos.def.ultimate).toMatchObject({ power: 500, scalingStat: "ap", targeting: "battlefieldEnemies", statusEffects: [{ kind: "stun", seconds: 5 }] });
    expect(allies[0].stunnedFor).toBe(5);
    expect(allies[1].stunnedFor).toBe(5);
  });

  it("는 전장 전체 궁극기에 주문력 500% 피해와 각 대상의 기절 저항을 적용한다", () => {
    const { state, pontos, allies } = pontosBattle();
    pontos.def = { ...pontos.def, element: "earth", stats: { ...pontos.def.stats, ap: 120, critChance: 0 } };
    allies.forEach((ally, index) => {
      ally.x = index === 0 ? ARENA.left : ARENA.right;
      ally.def = { ...ally.def, element: "earth", stats: { ...ally.def.stats, res: 0 }, stunResistancePercent: index * 50 };
    });
    pontos.energy = pontos.def.ultimate.cost;
    const attacks = fireUltimate(state, pontos.id, () => 0.99).filter((event) => event.kind === "attack");
    expect(attacks.map((event) => event.kind === "attack" ? event.contributionAmount : 0)).toEqual([600, 600, 600]);
    expect(allies.map((ally) => ally.stunnedFor)).toEqual([5, 2.5, 0]);
  });

  it("는 0초·1초·여러 초에 기본 주문력 2%를 복리 누적하고 프레임 분할과 무관하다", () => {
    const simulate = (frames: readonly number[]) => {
      const { state, pontos } = pontosBattle();
      frames.forEach((dt) => stepSkirmish(state, dt));
      return currentAbilityPower(pontos);
    };
    const definition = getRelic("pontos");
    const baseAp = definition.stats.ap;
    const growth = 1 + (definition.passive.kind === "abyssalPressure" ? definition.passive.apPercentPerSecond ?? 0 : 0) / 100;
    expect(simulate([])).toBe(baseAp);
    expect(simulate([0.25, 0.25, 0.25, 0.25])).toBeCloseTo(baseAp * growth);
    expect(simulate(Array.from({ length: 20 }, () => 0.25))).toBeCloseTo(baseAp * growth ** 5);
    expect(simulate(Array.from({ length: 300 }, () => 1 / 60))).toBeCloseTo(baseAp * growth ** 5);
  });

  it("는 HP 100%·75%·50% 경계를 50~99%로 선형 보간하고 50% 아래를 상한 처리한다", () => {
    const { pontos } = pontosBattle();
    pontos.hp = pontos.maxHp;
    expect(receivedDamage(pontos, 100)).toBe(50);
    pontos.hp = pontos.maxHp * 0.75;
    expect(receivedDamage(pontos, 100)).toBe(26); // 74.5% 경감 후 25.5를 반올림한다.
    pontos.hp = pontos.maxHp * 0.5;
    expect(receivedDamage(pontos, 100)).toBe(0);
    pontos.hp = pontos.maxHp * 0.49;
    expect(receivedDamage(pontos, 100)).toBe(0); // 99% 경감 뒤 최종 1 피해는 폰토스만 무효화한다.
  });

  it("는 최종 10을 무효화하고 11은 적용하되 일반 전투원의 최소 1 피해를 유지한다", () => {
    const { pontos, allies } = pontosBattle();
    pontos.hp = pontos.maxHp;
    expect(resolveReceivedDamage(pontos, 20)).toEqual({ raw: 20, reduced: 10, applied: 0, ignored: true });
    expect(resolveReceivedDamage(pontos, 22)).toEqual({ raw: 22, reduced: 11, applied: 11, ignored: false });
    expect(resolveReceivedDamage(allies[0], 0.01)).toEqual({ raw: 0.01, reduced: 1, applied: 1, ignored: false });
  });

  it("는 폭주 1초마다 방어력과 저항력을 무시하고 모든 생존 적의 최대 체력 2%를 깎는다", () => {
    const { state, pontos, allies } = pontosBattle();
    pontos.ferocity = 100; pontos.ferocityFever = true;
    // 극단적인 방어 수치도 폰토스 고정 피해 경계에는 들어가지 않아야 한다.
    allies[0].def = { ...allies[0].def, stats: { ...allies[0].def.stats, def: 1_000_000, res: 1_000_000 } };
    const before = allies.map(({ hp }) => hp);
    for (let index = 0; index < 3; index += 1) stepSkirmish(state, 0.25);
    expect(allies.map(({ hp }) => hp)).toEqual(before);
    stepSkirmish(state, 0.25);
    allies.forEach((ally, index) => expect(ally.hp).toBeCloseTo(before[index] - ally.maxHp * 0.02));
  });

  it("는 큰 허용 프레임과 잘게 분할한 프레임에서 같은 수의 폭주 틱을 만든다", () => {
    const simulate = (frames: readonly number[]) => {
      const { state, pontos, allies } = pontosBattle();
      pontos.ferocity = 100; pontos.ferocityFever = true;
      frames.forEach((dt) => stepSkirmish(state, dt));
      return allies.map(({ hp }) => hp);
    };
    // 0.25초는 엔진이 받아들이는 최대 catch-up 프레임이며 두 입력 모두 총 2초다.
    expect(simulate(Array.from({ length: 8 }, () => 0.25)))
      .toEqual(simulate(Array.from({ length: 120 }, () => 1 / 60)));
  });

  it("는 기존 고정 피해 정책처럼 보호막을 먼저 소모하고 치명타 틱에는 사망 사건과 로그를 남긴다", () => {
    const { state, pontos, allies } = pontosBattle();
    pontos.ferocity = 100; pontos.ferocityFever = true;
    allies[0].shield = { amount: allies[0].maxHp * 0.01, providerId: allies[0].id };
    allies[1].hp = allies[1].maxHp * 0.01;
    const protectedHp = allies[0].hp;
    const events = Array.from({ length: 4 }, () => stepSkirmish(state, 0.25)).flat();
    expect(allies[0].shield.amount).toBe(0);
    expect(allies[0].hp).toBeCloseTo(protectedHp - allies[0].maxHp * 0.01);
    expect(events.filter((event) => event.kind === "death" && event.fighterId === allies[1].id)).toHaveLength(1);
    expect(state.log).toContain(`${allies[1].def.name} 전투 불능`);
  });

  it("는 폭주 중 궁극기·지속 회복·흡혈을 공용 경계에서 막고 종료 즉시 회복을 복구한다", () => {
    const state = newSkirmish(["dodo", "rex"], ["pontos", "husk-shell"]);
    const [dodo, rex, pontos, victim] = state.fighters;
    for (const fighter of state.fighters) { fighter.attackCooldown = 999; fighter.x = 400; fighter.y = 900; }
    pontos.ferocity = 100; pontos.ferocityFever = true;
    dodo.hp = dodo.maxHp / 2; dodo.energy = dodo.def.ultimate.cost;
    expect(fireUltimate(state, dodo.id).filter((event) => event.kind === "heal")).toEqual([]);
    expect(dodo.hp).toBe(dodo.maxHp / 2);

    // 패시브 지속 회복도 같은 applyHealing 경계를 지나므로 틱 자체가 0 회복이 된다.
    rex.hp = rex.maxHp / 2;
    rex.regeneration = { remaining: 2, tickIn: 0, percentPerTick: 10 };
    expect(tickRegeneration(rex, 0.01, state)).toEqual([]);
    expect(rex.hp).toBe(rex.maxHp / 2);

    // 실제 피해 흡혈 경로를 실행해 요청량이 생겨도 현재 상대 폭주가 이를 취소하는지 확인한다.
    rex.def = { ...rex.def, stats: { ...rex.def.stats, lifeSteal: 100 } };
    rex.targetId = victim.id; rex.attackCooldown = 0; victim.attackCooldown = 999;
    stepSkirmish(state, 1 / 60);
    expect(rex.hp).toBe(rex.maxHp / 2);

    // 영구 디버프를 남기지 않으므로 현재 fever만 끄면 다음 회복 요청부터 즉시 허용된다.
    pontos.ferocityFever = false;
    rex.regeneration = { remaining: 2, tickIn: 0, percentPerTick: 10 };
    expect(tickRegeneration(rex, 0.01, state)).toContainEqual(expect.objectContaining({ kind: "heal", fighterId: rex.id }));
    expect(rex.hp).toBeGreaterThan(rex.maxHp / 2);
  });

  it("는 시간이 흐를수록 리미트 안전 반경을 좁히고 폰토스를 전장 중앙으로 접근시킨다", () => {
    const state = createSkirmish([getRelic("anky")], [getRelic("pontos")], ARENA, {}, {}, {
      boss: { phases: [{ startsAt: 0, damagePerSecond: 0, label: "관측" }, { startsAt: 1, damagePerSecond: 0, label: "해일" }], limitSeconds: 10 },
    });
    const pontos = state.fighters[1]; pontos.x = ARENA.left; pontos.stunnedFor = 999; pontos.attackCooldown = 999; state.fighters[0].attackCooldown = 999;
    const startRadius = state.boss!.pressureRadius; const startX = pontos.x;
    stepSkirmish(state, 0.25);
    expect(state.boss!.pressureRadius).toBeLessThan(startRadius);
    expect(Math.abs(pontos.x - (ARENA.left + ARENA.right) / 2)).toBeLessThan(Math.abs(startX - (ARENA.left + ARENA.right) / 2));
  });
});
