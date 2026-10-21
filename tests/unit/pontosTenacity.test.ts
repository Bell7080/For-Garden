import { describe, expect, it } from "vitest";
import {
  applyCombatStatusEffect,
  controlDuration,
  controlMagnitude,
  currentAttackSpeed,
  applyFrenzy,
  applyStagger,
  applyStun,
  controlResistPercent,
  createSkirmish,
  receivedDamage,
  stepSkirmish,
  type Fighter,
} from "../../src/core/skirmish";
import type { CombatStatusEffect } from "../../src/core/types";
import { getRelic } from "../../src/data/relics";
import { ENCOUNTER_ROLE } from "../../src/core/levelDesign";
import { getExpeditionNodeEnemies } from "../../src/data/expeditionEnemies";
import { raidBossDef } from "../../src/core/raid";

const ARENA = { left: 0, right: 600, top: 0, bottom: 1_000 };

/**
 * 원정 20층에 선 폰토스. 강인함·경감은 개체가 아니라 **불사 자리**가 갖으므로, 실전과 같이
 * 자리를 새긴 정의로 세운다.
 */
function pontos(): Fighter {
  const state = createSkirmish([getRelic("torika")], [{ ...getRelic("pontos"), encounterRole: "endless" }], ARENA);
  return state.fighters[1];
}

describe("자리가 갖는 강인함·경감", () => {
  it("은 개체가 아니라 그 적이 선 자리에서 온다", () => {
    // 같은 폰토스라도 자리를 새기지 않으면(도감 정의) 아무것도 갖지 않는다.
    const bare = createSkirmish([getRelic("torika")], [getRelic("pontos")], ARENA).fighters[1];
    applyStun(bare, 1);
    expect(controlResistPercent(bare)).toBe(0);
    expect(receivedDamage(bare, 1_000)).toBeGreaterThan(300);
  });

  it("은 원정 20층과 레이드가 실제로 서는 정의에 새겨진다", () => {
    // 콘텐츠가 레벨·유형 몫을 얹는 그 자리에서 함께 새긴다 — 화면과 전투가 같은 값을 읽는다.
    expect(getExpeditionNodeEnemies("boss", 20)[0].encounterRole).toBe("endless");
    expect(raidBossDef(getRelic("sukusuino")).encounterRole).toBe("boss");
    expect(getExpeditionNodeEnemies("normal", 3)[0].encounterRole).toBe("normal");
  });

  it("에서 보스는 강인함만, 불사는 강인함과 경감을 함께 갖는다", () => {
    // 보스(레이드)는 시즌 체력 한 줄이 끝내 깎여 죽는다 — 경감을 두면 준 피해가 곧 점수인 판이 무너진다.
    expect(ENCOUNTER_ROLE.boss.tenacity).toBeDefined();
    expect(ENCOUNTER_ROLE.boss.damageReduction).toBeUndefined();
    expect(ENCOUNTER_ROLE.endless.tenacity).toBeDefined();
    expect(ENCOUNTER_ROLE.endless.damageReduction).toBeDefined();
    for (const role of ["normal", "swarm", "elite"] as const) {
      expect(ENCOUNTER_ROLE[role].damageReduction, role).toBeUndefined();
    }
    // 혼자 서는 정예만 보스보다 얕은 강인함과 치유 감소를 갖는다.
    for (const role of ["normal", "swarm"] as const) {
      expect(ENCOUNTER_ROLE[role].tenacity, role).toBeUndefined();
      expect(ENCOUNTER_ROLE[role].healingReduction, role).toBeUndefined();
    }
    expect(ENCOUNTER_ROLE.elite.tenacity!.maxPercent).toBeLessThan(ENCOUNTER_ROLE.boss.tenacity!.maxPercent);
    expect(ENCOUNTER_ROLE.elite.healingReduction).toBeDefined();
  });

  it("은 레이드 보스에게 경감 없이 강인함만 준다", () => {
    const state = createSkirmish([getRelic("torika")], [raidBossDef(getRelic("sukusuino"))], ARENA);
    const boss = state.fighters[1];
    expect(controlResistPercent(boss)).toBe(ENCOUNTER_ROLE.boss.tenacity!.basePercent);
    applyStun(boss, 1);
    expect(controlResistPercent(boss)).toBe(ENCOUNTER_ROLE.boss.tenacity!.basePercent + ENCOUNTER_ROLE.boss.tenacity!.perControlPercent);
    // 받는 피해는 줄지 않는다.
    boss.hp = boss.maxHp * 0.25;
    expect(receivedDamage(boss, 1_000)).toBe(1_000);
  });
});

describe("불사 자리의 강인함", () => {
  it("은 태생 몫에서 시작해 제어를 받아 낼 때마다 오른다", () => {
    const boss = pontos();
    // 자리가 정한 태생 몫이 출발선이다. 쌓인 몫은 그 위에 얹힌다.
    expect(controlResistPercent(boss)).toBe(ENCOUNTER_ROLE.endless.tenacity!.basePercent);
    applyStun(boss, 1);
    expect(controlResistPercent(boss)).toBe(58);
    applyStun(boss, 1);
    expect(controlResistPercent(boss)).toBe(66);
  });

  it("은 기절·경직·광란을 **한 규칙**으로 센다", () => {
    /*
     * 예전에는 기절만 저항을 지나고 경직은 그대로 다 들어갔다. 행동을 막는 같은 일을 하는
     * 둘이 다른 규칙을 따르면, 제어형 편성이 기절 대신 경직으로 같은 잠금을 다시 만든다.
     */
    const byStun = pontos();
    const byStagger = pontos();
    const byFrenzy = pontos();
    applyStun(byStun, 1);
    applyStagger(byStagger, 1);
    applyFrenzy(byFrenzy, { kind: "frenzy", seconds: 1, attackSpeedPercent: 0 });
    const grown = controlResistPercent(byStun);
    expect(controlResistPercent(byStagger)).toBe(grown);
    expect(controlResistPercent(byFrenzy)).toBe(grown);
  });

  it("은 지속 시간을 그 비율만큼 줄인다", () => {
    const boss = pontos();
    // 태생 50%라 1초짜리 기절은 0.5초만 남는다.
    applyStun(boss, 1);
    expect(boss.stunnedFor).toBeCloseTo(0.5, 6);
  });

  it("은 100%에 닿으면 걸리자마자 풀린다", () => {
    const boss = pontos();
    // 태생 50 + 8씩 일곱 번이면 상한이다.
    for (let count = 0; count < 7; count += 1) applyStun(boss, 1);
    expect(controlResistPercent(boss)).toBe(100);
    boss.stunnedFor = 0;
    applyStun(boss, 5);
    expect(boss.stunnedFor).toBe(0);
    applyStagger(boss, 5);
    expect(boss.staggeredFor).toBe(0);
  });

  it("은 상한을 넘겨 자라지 않는다", () => {
    const boss = pontos();
    for (let count = 0; count < 40; count += 1) applyStun(boss, 1);
    expect(controlResistPercent(boss)).toBe(100);
  });

  it("은 값을 적지 않은 개체에게는 아무 일도 하지 않는다", () => {
    const state = createSkirmish([getRelic("torika")], [getRelic("toby")], ARENA);
    const [ally, foe] = state.fighters;
    applyStun(foe, 1);
    applyStun(foe, 1);
    expect(controlResistPercent(foe)).toBe(0);
    expect(controlResistPercent(ally)).toBe(0);
    // 저항이 없으므로 걸린 시간이 그대로 남는다.
    expect(foe.stunnedFor).toBeCloseTo(1, 6);
  });
});

describe("불사 자리의 경감", () => {
  it("는 온전한 몸에서도 이미 단단하다", () => {
    // 바닥이 50이던 때는 죽지 않는 벽이 받는 피해의 절반을 그대로 맞았다.
    const boss = pontos();
    expect(receivedDamage(boss, 1_000)).toBe(300);
  });

  it("는 조금만 깎여도 곧바로 붙고 뒤에서 완만해진다", () => {
    const boss = pontos();
    boss.hp = boss.maxHp * 0.75;
    expect(receivedDamage(boss, 1_000)).toBe(197); // 경감 80.3%
  });

  it("는 체력 절반에서 턱 막히지 않고 끝까지 자란다", () => {
    const boss = pontos();
    const at = (ratio: number): number => { boss.hp = boss.maxHp * ratio; return receivedDamage(boss, 1_000); };
    const half = at(0.5);
    const quarter = at(0.25);
    const tenth = at(0.1);
    // 절반 아래에서도 계속 줄어든다 — 상한에 붙어 멈추지 않는다.
    expect(half).toBeGreaterThan(quarter);
    expect(quarter).toBeGreaterThan(tenth);
    expect(tenth).toBeGreaterThan(0);
  });
});

describe("폰토스전의 원정 점수", () => {
  /** 불사 보스를 세우고 아군이 한 번 때리게 한 뒤, 점수와 실제로 깎인 체력을 함께 돌려준다. */
  function oneHit(bossHpRatio: number) {
    const state = createSkirmish([getRelic("torika")], [{ ...getRelic("pontos"), encounterRole: "endless" }], ARENA, {}, {}, {
      boss: { phases: [{ startsAt: 0, damagePerSecond: 0, label: "관측" }], limitSeconds: 1_000 },
    });
    const [ally, boss] = state.fighters;
    ally.x = boss.x = 400; ally.y = boss.y = 900;
    ally.attackCooldown = 0; boss.attackCooldown = 999;
    boss.hp = boss.maxHp * bossHpRatio;
    const before = boss.hp;
    // 한 프레임으로는 평타 한 번이 들어가지 않는 편성이 있다. 맞을 때까지만 돌린다.
    for (let frame = 0; frame < 240 && (state.boss?.score ?? 0) === 0; frame += 1) {
      stepSkirmish(state, 1 / 60, () => 0.99);
      boss.attackCooldown = 999;
    }
    return { score: state.boss?.score ?? 0, hpLost: before - boss.hp };
  }

  it("는 경감에 막히지 않는다", () => {
    /*
     * 점수가 **실제로 깎인 체력**을 세던 때는, 잃은 체력에 따라 받는 피해가 50~99% 줄어드는
     * 폰토스 앞에서 1,000점 언저리에 멈춰 아무리 때려도 오르지 않았다. 경감은 그를 죽지 않는
     * 보스로 만들기 위한 값이지 점수를 막으라고 있는 값이 아니다.
     *
     * 사건의 계약(`contributionAmount`)은 처음부터 "경감 전 기여값"이라고 적혀 있었는데
     * 구현만 그 반대였다 — 고친 것은 구현이지 계약이 아니다.
     */
    const { score, hpLost } = oneHit(1);
    expect(score).toBeGreaterThan(hpLost);
  });

  it("는 체력이 낮아 경감이 커져도 같은 값을 센다", () => {
    /*
     * 경감이 커지면 깎이는 체력만 줄고 **만들어 낸 기여는 그대로**여야 한다. 그것이 이
     * 고침의 전부다.
     *
     * 최종 피해가 무효화 문턱(10) 아래로 내려가는 구간까지 내려도 **점수는 같아야 한다** —
     * 경감이든 무효화든 죽지 않게 만드는 장치이지 점수를 막는 장치가 아니기 때문이다.
     */
    const healthy = oneHit(1);
    const wounded = oneHit(0.25);
    expect(wounded.score).toBeCloseTo(healthy.score, 6);
    /*
     * 깎인 체력으로 견주지 않는다 — 그 구간은 최종 피해가 무효화 문턱 아래라 양쪽 다 0이고,
     * 0과 0을 견주는 검사는 아무것도 지키지 못한다(실제로 그렇게 적었다가 잡았다).
     * 경감이 정말 커졌는지는 같은 원 피해를 순수 경계에 직접 물어본다.
     */
    const boss = pontos();
    const atFullHp = receivedDamage(boss, 1_000);
    boss.hp = boss.maxHp * 0.25;
    expect(receivedDamage(boss, 1_000)).toBeLessThan(atFullHp);
  });
});


describe("행동 제약의 공통 강인함", () => {
  function battle(role: "elite" | "boss" | "endless" | "normal" = "boss") {
    return createSkirmish([getRelic("maddy")], [{ ...getRelic("amo"), encounterRole: role }], ARENA);
  }

  const controls: CombatStatusEffect[] = [
    { kind: "stun", seconds: 0.1 },
    { kind: "stagger", seconds: 0.1 },
    { kind: "fear", seconds: 0.1, immunitySeconds: 1 },
    { kind: "taunt", seconds: 0.1 },
    { kind: "frenzy", seconds: 0.1, attackSpeedPercent: 0 },
    { kind: "knockback", seconds: 0.1, speed: 100, bounces: 1 },
  ];
  it.each(controls)("는 $kind의 미세 제약을 막고 별도 상태나 사건을 만들지 않는다", (effect) => {
    const state = battle(); const [source, target] = state.fighters;
    const events: Parameters<typeof applyCombatStatusEffect>[2] = [];
    applyCombatStatusEffect(target, effect, events, state, source.id);
    expect(target.stunnedFor).toBe(0); expect(target.staggeredFor).toBe(0);
    expect(target.fear).toBeNull(); expect(target.taunted).toBeNull();
    expect(target.frenzy).toBeNull(); expect(target.knockback).toBeNull();
    expect(events).toEqual([]);
    expect(controlResistPercent(target)).toBe(56);
  });

  it.each(["elite", "boss", "endless"] as const)("는 %s에서도 저항 후 시간으로 경계를 판단하고 일반 적은 미세 제약도 받는다", (role) => {
    const target = battle(role).fighters[1];
    expect(controlDuration(target, 0.05 / (1 - controlResistPercent(target) / 100), false)).toBe(0);
    expect(controlDuration(target, 0.051 / (1 - controlResistPercent(target) / 100), false)).toBeCloseTo(0.051);
    expect(controlDuration(battle("normal").fighters[1], 0.01)).toBeCloseTo(0.01);
  });

  it("는 긴 도발의 시간을 줄이고 면역 시 기존 표적과 상태를 보존한다", () => {
    const state = battle(); const [source, target] = state.fighters;
    applyCombatStatusEffect(target, { kind: "taunt", seconds: 2 }, [], state, source.id);
    expect(target.taunted?.remaining).toBe(1);
    target.tenacity = 50;
    const previous = target.taunted;
    target.targetId = "previous";
    applyCombatStatusEffect(target, { kind: "taunt", seconds: 10 }, [], state, source.id);
    expect(target.taunted).toBe(previous); expect(target.targetId).toBe("previous");
  });

  it("는 시간 없는 둔화의 강도를 줄이고 100%에서 속도를 원상복구한다", () => {
    const state = battle(); const [source, target] = state.fighters;
    const before = currentAttackSpeed(target, state);
    applyCombatStatusEffect(target, { kind: "chill", speedPercentPerStack: 20, maxStacks: 3 }, [], state, source.id);
    expect(currentAttackSpeed(target, state)).toBeCloseTo(before * (1 - 0.2 * 0.44));
    target.tenacity = 50;
    expect(currentAttackSpeed(target, state)).toBe(before);
    expect(controlMagnitude(target, 100)).toBe(0);
    expect(controlResistPercent(target)).toBe(100);
  });

  it("는 매디의 빙결에도 저항하며 완전 면역에서는 빙결 사건을 만들지 않는다", () => {
    for (const immune of [false, true]) {
      const state = battle(); const [source, target] = state.fighters;
      source.x = target.x = 300; source.y = target.y = 500;
      source.attackCooldown = 0; target.attackCooldown = 999;
      target.hp = target.maxHp = 100000;
      target.chill = { stacks: 3, maxStacks: 3, speedPercentPerStack: 10 };
      if (immune) target.tenacity = 50;
      const events = stepSkirmish(state, 1 / 60, () => 0.99);
      if (immune) {
        expect(target.frozen).toBeNull();
        expect(events.some((e) => e.kind === "status" && e.status === "frozen")).toBe(false);
      } else {
        // 적중이 둔화 한 겹을 갱신한 뒤 빙결을 시도하므로 50 + 6% 저항이다.
        expect(target.frozen?.total).toBeCloseTo(3 * 0.44);
      }
    }
  });

  it("는 날려버림의 시간과 속도를 함께 줄이고 실제 이동 거리도 강인함에 따라 줄인다", () => {
    const distances: number[] = [];
    for (const resistance of [0, 50, 90, 100]) {
      const state = battle(resistance === 0 ? "normal" : "boss");
      const [source, target] = state.fighters;
      source.x = 200; source.y = 500; target.x = 300; target.y = 500;
      source.attackCooldown = target.attackCooldown = 999;
      target.tenacity = resistance === 0 ? 0 : resistance - 50;
      applyCombatStatusEffect(target, { kind: "knockback", seconds: 1, speed: 100, bounces: 2 }, [], state, source.id);
      if (resistance < 100) {
        expect(target.knockback?.remaining).toBeCloseTo(1 - resistance / 100);
        expect(target.knockback?.vx).toBeCloseTo(100 * (1 - resistance / 100));
      } else expect(target.knockback).toBeNull();
      const before = target.x;
      // 마지막 비행 프레임도 남은 시간만큼만 진행한다.
      for (let tick = 0; tick < 21 && target.knockback !== null; tick++) stepSkirmish(state, 0.05, () => 0.99);
      distances.push(target.x - before);
    }
    expect(distances[0]).toBeCloseTo(100);
    expect(distances[1]).toBeCloseTo(25);
    expect(distances[2]).toBeCloseTo(1);
    expect(distances[3]).toBe(0);
  });

  it("는 경직 중 공격 대기 시간을 초기화하지 않고 남은 시간부터 이어간다", () => {
    const state = battle("normal"); const [source, target] = state.fighters;
    source.x = target.x = 300; source.y = target.y = 500;
    source.attackCooldown = 999; target.attackCooldown = 0.3;
    applyStagger(target, 0.2);
    stepSkirmish(state, 0.05, () => 0.99);
    expect(target.attackCooldown).toBeCloseTo(0.3);
    for (let n = 0; n < 6; n++) stepSkirmish(state, 0.05, () => 0.99);
    expect(target.attackCooldown).toBeLessThan(0.3);
    expect(target.attackCooldown).toBeGreaterThan(0);
  });
});
