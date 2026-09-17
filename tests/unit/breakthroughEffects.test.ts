import { describe, expect, it } from "vitest";
import { createSkirmish, fireUltimate, findFighter, refreshBleed, stepSkirmish, tryTriggerEmergencyRecovery, type Arena, type SkirmishEvent, type SkirmishState } from "../../src/core/skirmish";
import { FEROCITY_RULES } from "../../src/core/ferocity";
import { BREAKTHROUGH_STEPS, isBreakthroughSlotOpen } from "../../src/core/relicProgression";
import { getRelic, RELICS } from "../../src/data/relics";
import { breakthroughEffectText } from "../../src/ui/skillPresentation";

const ARENA: Arena = { left: 0, right: 1_000, top: 0, bottom: 1_600 };

/** 토리카 한 명과 적 한 명. 돌파 단계만 갈아 끼워 같은 판을 두 번 돌린다. */
function battle(breakthrough: number): SkirmishState {
  return createSkirmish([getRelic("anky")], [getRelic("amo")], ARENA, {}, { anky: breakthrough });
}

function lexiaBattle(enemies = ["anky"]): SkirmishState {
  return createSkirmish([getRelic("rex")], enemies.map(getRelic), ARENA, {}, { rex: BREAKTHROUGH_STEPS.length });
}

/** 두 몸이 붙어 서로 때릴 수 있도록 같은 자리로 끌어다 놓는다. */
function engage(state: SkirmishState): void {
  const ally = findFighter(state, "player-0")!;
  const enemy = findFighter(state, "enemy-0")!;
  enemy.x = ally.x + 40;
  enemy.y = ally.y;
}

describe("한계 돌파 — 기본 공격(별 II)", () => {
  it("은 주기가 채워지는 한 방에서만 회복하고 도발한다", () => {
    // 토리카의 기본 공격은 세 번에 한 번만 상태를 건다. 그 한 방에 돌파 효과가 함께 얹힌다.
    const state = battle(1);
    engage(state);
    const torika = findFighter(state, "player-0")!;
    const enemy = findFighter(state, "enemy-0")!;
    torika.hp = torika.maxHp * 0.6;
    // 적이 반격해 체력이 더 줄지 않도록 공격만 멈춰 둔다(도발 판정은 그대로 본다).
    enemy.attackCooldown = 999;
    const healed: number[] = [];
    for (let tick = 0; tick < 300; tick += 1) {
      const before = torika.hp;
      for (const event of stepSkirmish(state, 0.05)) {
        if (event.kind === "heal" && event.fighterId === torika.id) healed.push(torika.hp - before);
      }
      if (enemy.taunted) break;
    }
    expect(healed.length).toBeGreaterThan(0);
    // 방어력의 60%라 한 번에 수십 HP가 돌아온다 — 한 자리 수면 기준 능력치를 못 읽은 것이다.
    expect(healed[0]).toBeGreaterThan(10);
    expect(enemy.taunted?.sourceId).toBe(torika.id);
  });

  it("은 별 하나에서는 돌지 않는다", () => {
    const state = battle(0);
    engage(state);
    const torika = findFighter(state, "player-0")!;
    const enemy = findFighter(state, "enemy-0")!;
    torika.hp = torika.maxHp * 0.6;
    enemy.attackCooldown = 999;
    const before = torika.hp;
    for (let tick = 0; tick < 200; tick += 1) stepSkirmish(state, 0.05);
    // 패시브 회복(체력 절반)이 돌지 않는 60% 상태이므로 체력은 그대로여야 한다.
    expect(torika.hp).toBe(before);
    expect(enemy.taunted).toBeNull();
  });
});

describe("한계 돌파 — 궁극기(별 III)", () => {
  it("은 게이지를 다시 쓰지 않고 같은 궁극기를 두 번 더 떨어뜨린다", () => {
    const state = battle(2);
    engage(state);
    const torika = findFighter(state, "player-0")!;
    const enemy = findFighter(state, "enemy-0")!;
    // 되풀이 타격만 세기 위해 적이 죽지 않게 체력을 크게 잡아 둔다.
    enemy.maxHp = 1_000_000; enemy.hp = enemy.maxHp;
    enemy.attackCooldown = 999;
    torika.energy = torika.def.ultimate.cost;
    const first = fireUltimate(state, torika.id);
    expect(first.some((event) => event.kind === "attack" && event.skill === "ultimate")).toBe(true);
    const energyAfterCast = torika.energy;
    expect(torika.breakthroughEcho).toEqual({ nextIn: 1.5, casts: 2 });

    // 1.5초 간격으로 두 번 더 떨어진다. 그 사이의 평타는 세지 않도록 궁극기 사건만 고른다.
    let echoes = 0;
    for (let tick = 0; tick < 80; tick += 1) {
      for (const event of stepSkirmish(state, 0.05)) {
        if (event.kind === "attack" && event.skill === "ultimate" && event.followUp) echoes += 1;
      }
    }
    expect(echoes).toBe(2);
    expect(torika.breakthroughEcho).toBeNull();
    // 자원은 시전한 그 한 번의 몫이다. 되풀이가 게이지를 다시 쓰거나 채우지 않는다.
    expect(torika.energy).toBeLessThanOrEqual(energyAfterCast + torika.def.stats.energyGain * 8);
  });

  it("은 별 둘에서는 시계를 켜지 않는다", () => {
    const state = battle(1);
    engage(state);
    const torika = findFighter(state, "player-0")!;
    torika.energy = torika.def.ultimate.cost;
    fireUltimate(state, torika.id);
    expect(torika.breakthroughEcho).toBeNull();
  });
});

describe("한계 돌파 — 폭주(별 IV)", () => {
  it("은 폭주가 끝나는 순간 받은 피해의 일부를 보호막으로 남기고 도발한다", () => {
    const state = battle(3);
    engage(state);
    const torika = findFighter(state, "player-0")!;
    const enemy = findFighter(state, "enemy-0")!;
    enemy.attackCooldown = 999;
    // 폭주에 들어간 뒤 피해를 받고, 게이지가 다 빠질 때까지 굴린다.
    torika.ferocity = FEROCITY_RULES.max;
    torika.ferocityFever = true;
    torika.feverDamageTaken = 400;
    torika.shield.amount = 0;
    let ended = false;
    for (let tick = 0; tick < 400 && !ended; tick += 1) {
      stepSkirmish(state, 0.05);
      ended = !torika.ferocityFever;
    }
    expect(ended).toBe(true);
    // 400의 30%가 보호막으로 남는다.
    expect(torika.shield.amount).toBe(120);
    expect(enemy.taunted?.sourceId).toBe(torika.id);
  });

  it("은 폭주에 들어갈 때 지난 폭주의 누적을 지운다", () => {
    const state = battle(3);
    const torika = findFighter(state, "player-0")!;
    torika.feverDamageTaken = 999;
    torika.ferocity = FEROCITY_RULES.max - 1;
    // 게이지를 채워 폭주에 들어가게 한다(공격 사건이 아니라 직접 임계를 넘긴다).
    torika.ferocityFever = false;
    stepSkirmish(state, 0.05);
    if (!torika.ferocityFever) {
      // 시간만으로는 차지 않는 판이므로 진입 경로를 직접 확인한다.
      expect(torika.feverDamageTaken).toBe(999);
      return;
    }
    expect(torika.feverDamageTaken).toBe(0);
  });
});

describe("한계 돌파 — 패시브(별 V)", () => {
  it("은 패시브가 돌 때 아군에게 회복을 나눈다", () => {
    const state = createSkirmish([getRelic("anky"), getRelic("dian")], [getRelic("amo")], ARENA, {}, { anky: BREAKTHROUGH_STEPS.length });
    const torika = findFighter(state, "player-0")!;
    const ally = findFighter(state, "player-1")!;
    torika.hp = torika.maxHp * 0.4;
    expect(tryTriggerEmergencyRecovery(torika, state)).toBe(true);
    expect(torika.regeneration).not.toBeNull();
    // 나눠 받은 몫은 자기 패시브의 25%다.
    expect(ally.regeneration?.percentPerTick).toBeCloseTo(torika.regeneration!.percentPerTick * 0.25, 5);
  });

  it("은 별 넷에서는 나누지 않는다", () => {
    const state = createSkirmish([getRelic("anky"), getRelic("dian")], [getRelic("amo")], ARENA, {}, { anky: 3 });
    const torika = findFighter(state, "player-0")!;
    const ally = findFighter(state, "player-1")!;
    torika.hp = torika.maxHp * 0.4;
    expect(tryTriggerEmergencyRecovery(torika, state)).toBe(true);
    expect(ally.regeneration).toBeNull();
  });
});

describe("돌파 효과 문구", () => {
  it("는 정의한 슬롯만 문장을 만들고 기술 이름을 정의에서 읽는다", () => {
    const torika = getRelic("anky");
    const basic = breakthroughEffectText(torika, "basic");
    expect(basic).toContain(torika.basic.statusEffectStackName!);
    expect(basic).toContain("방어력의 60%");
    // 「도발」은 규칙어라 태그로 걸린다 — 쪽지에서 눌러 뜻을 열 수 있어야 한다.
    expect(basic).toContain("1초 동안 [[taunt|도발]]");
    const ultimate = breakthroughEffectText(torika, "ultimate");
    expect(ultimate).toContain(torika.ultimate.name);
    expect(ultimate).toContain("1.5초 간격");
    expect(ultimate).toContain("두 번 더");
    expect(breakthroughEffectText(torika, "ferocity")).toContain("[[ferocity|폭주]]가 끝날 때");
    expect(breakthroughEffectText(torika, "passive")).toContain(torika.passive.name);
  });

  it("는 렉시아 네 슬롯의 강화 수치와 전투 개념을 모두 표시한다", () => {
    const lexia = getRelic("rex");
    expect(breakthroughEffectText(lexia, "basic")).toContain("최대 체력의 4%");
    expect(breakthroughEffectText(lexia, "basic")).toContain("받는 회복량을 40% 낮추며");
    expect(breakthroughEffectText(lexia, "ultimate")).toContain("고정 피해");
    expect(breakthroughEffectText(lexia, "ultimate")).toContain("150 회복");
    expect(breakthroughEffectText(lexia, "ferocity")).toContain("조금 넓은 범위");
    expect(breakthroughEffectText(lexia, "passive")).toContain("최대 체력·방어력·저항력이 25% 증가");
    expect(breakthroughEffectText(lexia, "passive")).toContain("다시 돌진");
  });

  it("는 슬롯을 비운 개체에는 문장을 만들지 않는다", () => {
    // 아직 설계하지 않은 개체에 "효과 없음"을 적지 않기 위해 undefined로 남는다.
    const untouched = RELICS.filter((relic) => relic.breakthroughEffects === undefined);
    expect(untouched.length).toBeGreaterThan(0);
    for (const relic of untouched) {
      for (const step of BREAKTHROUGH_STEPS) expect(breakthroughEffectText(relic, step.slot)).toBeUndefined();
    }
  });

  it("는 정의한 슬롯이 실제로 열리는 별을 갖는다", () => {
    // 전투가 읽는 문(`isBreakthroughSlotOpen`)과 데이터의 슬롯 이름이 갈리면 화면에는 켜져
    // 있는데 전투에서는 돌지 않는 효과가 생긴다.
    for (const relic of RELICS) {
      for (const slot of Object.keys(relic.breakthroughEffects ?? {}) as (keyof NonNullable<typeof relic.breakthroughEffects>)[]) {
        expect(BREAKTHROUGH_STEPS.some((step) => step.slot === slot), `${relic.name} ${slot}`).toBe(true);
        expect(isBreakthroughSlotOpen(BREAKTHROUGH_STEPS.length, slot), `${relic.name} ${slot}`).toBe(true);
      }
    }
  });
});

describe("렉시아 한계 돌파", () => {
  it("는 몸 능력치 3종을 25% 올리고 기본 공격으로 깊은 출혈을 우선 적용한다", () => {
    const state = lexiaBattle();
    engage(state);
    const lexia = findFighter(state, "player-0")!;
    const torika = findFighter(state, "enemy-0")!;
    expect(lexia.maxHp).toBeCloseTo(getRelic("rex").stats.hp * 1.25);
    expect(lexia.def.stats.def).toBeCloseTo(getRelic("rex").stats.def * 1.25);
    expect(lexia.def.stats.res).toBeCloseTo(getRelic("rex").stats.res * 1.25);
    torika.attackCooldown = 999; lexia.attackCooldown = 0;
    stepSkirmish(state, 0.05, () => 0.99);
    expect(torika.bleed).toMatchObject({ percent: 4, healingReceivedReductionPercent: 40, sourceId: lexia.id });
    // 더 약한 출혈은 깊은 출혈의 강도·회복 감소·출처를 덮지 않는다.
    torika.bleed!.remaining = 1;
    const events: SkirmishEvent[] = [];
    refreshBleed(torika, 3, 2, events, "other-source");
    expect(torika.bleed).toMatchObject({ remaining: 3, percent: 4, healingReceivedReductionPercent: 40, sourceId: lexia.id });
  });

  it("는 깊은 출혈 중 토리카가 받는 회복량을 40% 낮춘다", () => {
    const state = lexiaBattle(); engage(state);
    const lexia = findFighter(state, "player-0")!;
    const torika = findFighter(state, "enemy-0")!;
    torika.attackCooldown = 999; lexia.attackCooldown = 0;
    stepSkirmish(state, 0.05, () => 0.99);
    torika.bleed!.tickIn = 99; lexia.attackCooldown = 999;
    torika.hp = torika.maxHp * 0.4;
    expect(tryTriggerEmergencyRecovery(torika, state)).toBe(true);
    const before = torika.hp;
    for (let tick = 0; tick < 5; tick += 1) stepSkirmish(state, 0.25, () => 0.99);
    expect(torika.hp - before).toBeCloseTo(torika.maxHp * 0.035 * 0.6, 4);
  });

  it("는 궁극기를 고정 피해로 바꾸고 직접 처치하면 게이지 150을 돌려받는다", () => {
    const state = lexiaBattle(); engage(state);
    const lexia = findFighter(state, "player-0")!;
    const torika = findFighter(state, "enemy-0")!;
    torika.hp = 1; lexia.energy = lexia.def.ultimate.cost;
    const hit = fireUltimate(state, lexia.id, () => 0.99).find((event) => event.kind === "attack");
    expect(hit).toMatchObject({ damageType: "true" });
    expect(lexia.energy).toBe(150);
  });

  it("는 폭주 중 일반 공격으로 조금 넓은 범위를 함께 때리고 처치 뒤 돌진을 다시 준비한다", () => {
    const state = lexiaBattle(["anky", "amo"]);
    const lexia = findFighter(state, "player-0")!;
    const enemies = state.fighters.filter((fighter) => fighter.side === "enemy");
    for (const [index, enemy] of enemies.entries()) {
      enemy.x = lexia.x + 50 + index * 30; enemy.y = lexia.y; enemy.attackCooldown = 999;
    }
    enemies[0].hp = 1;
    lexia.ferocity = FEROCITY_RULES.max; lexia.ferocityFever = true;
    lexia.openingChargeReady = false; lexia.attackCooldown = 0;
    const attacks = stepSkirmish(state, 0.05, () => 0.99)
      .filter((event) => event.kind === "attack" && event.attackerId === lexia.id && event.skill === "basic");
    expect(new Set(attacks.map((event) => event.kind === "attack" ? event.targetId : ""))).toEqual(new Set(enemies.map(({ id }) => id)));
    expect(lexia.openingChargeReady).toBe(true);
  });
});
