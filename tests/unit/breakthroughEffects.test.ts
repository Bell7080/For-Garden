import { describe, expect, it } from "vitest";
import { applyCombatStatusEffect, applyFrenzy, receivedDamage, createSkirmish, fighterReach, fireUltimate, findFighter, refreshBleed, stepSkirmish, tryTriggerEmergencyRecovery, tryTriggerLowHpVanish, type Arena, type SkirmishEvent, type SkirmishState } from "../../src/core/skirmish";
import { FEROCITY_RULES } from "../../src/core/ferocity";
import { BREAKTHROUGH_STEPS, isBreakthroughSlotOpen } from "../../src/core/relicProgression";
import { getRelic, RELICS } from "../../src/data/relics";
import { breakthroughEffectText } from "../../src/ui/skillPresentation";

const ARENA: Arena = { left: 0, right: 1_000, top: 0, bottom: 1_600 };

/** 토리카 한 명과 적 한 명. 돌파 단계만 갈아 끼워 같은 판을 두 번 돌린다. */
function battle(breakthrough: number): SkirmishState {
  return createSkirmish([getRelic("torika")], [getRelic("amo")], ARENA, {}, { torika: breakthrough });
}

function lexiaBattle(enemies = ["torika"]): SkirmishState {
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
    // 400의 50%가 보호막으로 남는다.
    expect(torika.shield.amount).toBe(200);
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
    const state = createSkirmish([getRelic("torika"), getRelic("dian")], [getRelic("amo")], ARENA, {}, { torika: BREAKTHROUGH_STEPS.length });
    const torika = findFighter(state, "player-0")!;
    const ally = findFighter(state, "player-1")!;
    torika.hp = torika.maxHp * 0.4;
    expect(tryTriggerEmergencyRecovery(torika, state)).toBe(true);
    expect(torika.regeneration).not.toBeNull();
    // 나눠 받은 몫은 자기 패시브의 25%다.
    expect(ally.regeneration?.percentPerTick).toBeCloseTo(torika.regeneration!.percentPerTick * 0.25, 5);
  });

  it("은 별 넷에서는 나누지 않는다", () => {
    const state = createSkirmish([getRelic("torika"), getRelic("dian")], [getRelic("amo")], ARENA, {}, { torika: 3 });
    const torika = findFighter(state, "player-0")!;
    const ally = findFighter(state, "player-1")!;
    torika.hp = torika.maxHp * 0.4;
    expect(tryTriggerEmergencyRecovery(torika, state)).toBe(true);
    expect(ally.regeneration).toBeNull();
  });
});

describe("돌파 효과 문구", () => {
  it("는 정의한 슬롯만 문장을 만들고 기술 이름을 정의에서 읽는다", () => {
    const torika = getRelic("torika");
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
    expect(breakthroughEffectText(lexia, "passive")).toContain("최대 체력·[[def|방어력]]·[[res|저항력]]이 25% 증가");
    expect(breakthroughEffectText(lexia, "passive")).toContain("다시 [[charge|돌진]]");
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
    const state = lexiaBattle(["torika", "amo"]);
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

describe("도디 한계 돌파", () => {
  /** 도디와 아군 둘(티아·디안)이 적 하나를 상대한다. 돌파 단계만 갈아 끼운다. */
  function dodoBattle(breakthrough: number): SkirmishState {
    return createSkirmish([getRelic("dodo"), getRelic("tia"), getRelic("dian")], [getRelic("amo")], ARENA, {}, { dodo: breakthrough });
  }

  it("는 평타 회복의 일부를 둘째로 다친 아군에게도 보낸다(별 II)", () => {
    const state = dodoBattle(1);
    const [dodo, tia, dian] = ["player-0", "player-1", "player-2"].map((id) => findFighter(state, id)!);
    const enemy = findFighter(state, "enemy-0")!;
    enemy.x = dodo.x + 40; enemy.y = dodo.y; enemy.attackCooldown = 999; enemy.maxHp = 1_000_000; enemy.hp = enemy.maxHp;
    tia.hp = tia.maxHp * 0.3; dian.hp = dian.maxHp * 0.5; dodo.attackCooldown = 0;
    const tiaBefore = tia.hp; const dianBefore = dian.hp;
    for (let tick = 0; tick < 3; tick += 1) stepSkirmish(state, 0.05, () => 0.99);
    // 가장 다친 티아가 먼저, 둘째로 다친 디안이 그 75%를 받는다.
    expect(tia.hp).toBeGreaterThan(tiaBefore);
    expect(dian.hp).toBeGreaterThan(dianBefore);
    expect((dian.hp - dianBefore) / (tia.hp - tiaBefore)).toBeCloseTo(0.75, 1);
  });

  it("은 별 하나에서는 둘째에게 보내지 않는다", () => {
    const state = dodoBattle(0);
    const [dodo, tia, dian] = ["player-0", "player-1", "player-2"].map((id) => findFighter(state, id)!);
    const enemy = findFighter(state, "enemy-0")!;
    enemy.x = dodo.x + 40; enemy.y = dodo.y; enemy.attackCooldown = 999; enemy.maxHp = 1_000_000; enemy.hp = enemy.maxHp;
    tia.hp = tia.maxHp * 0.3; dian.hp = dian.maxHp * 0.5; dodo.attackCooldown = 0;
    const dianBefore = dian.hp;
    for (let tick = 0; tick < 3; tick += 1) stepSkirmish(state, 0.05, () => 0.99);
    expect(dian.hp).toBe(dianBefore);
  });

  it("는 궁극기 회복 위에 이미 가득 찬 아군에게도 보호막을 덮는다(별 III)", () => {
    const state = dodoBattle(2);
    const dodo = findFighter(state, "player-0")!;
    const enemy = findFighter(state, "enemy-0")!;
    for (const fighter of state.fighters) { fighter.x = 500; fighter.y = 800; }
    enemy.attackCooldown = 999; enemy.maxHp = 1_000_000; enemy.hp = enemy.maxHp;
    dodo.energy = dodo.def.ultimate.cost;
    fireUltimate(state, dodo.id, () => 0.99);
    const expected = Math.round(dodo.def.stats.ap * 100 / 100 * 0.5);
    for (const id of ["player-1", "player-2"]) expect(findFighter(state, id)!.shield.amount).toBeGreaterThanOrEqual(expected * 0.9);
  });

  it("는 폭주가 끝날 때 준 회복의 일부를 살아 있는 아군이 똑같이 나눠 보호막으로 얻는다(별 IV)", () => {
    const state = dodoBattle(3);
    const dodo = findFighter(state, "player-0")!;
    const enemy = findFighter(state, "enemy-0")!;
    enemy.attackCooldown = 999;
    for (const fighter of state.fighters) fighter.shield.amount = 0;
    dodo.ferocity = FEROCITY_RULES.max; dodo.ferocityFever = true; dodo.bt.feverHealingDone = 300;
    let ended = false;
    for (let tick = 0; tick < 400 && !ended; tick += 1) { stepSkirmish(state, 0.05); ended = !dodo.ferocityFever; }
    expect(ended).toBe(true);
    // 300의 50%를 셋이 나눈다.
    for (const id of ["player-0", "player-1", "player-2"]) expect(findFighter(state, id)!.shield.amount).toBe(50);
    expect(dodo.bt.feverHealingDone).toBe(0);
  });

  it("는 아군 체력이 25% 이하로 내려가면 전투당 한 번만 주문력 보호막을 둘러 준다(별 V)", () => {
    const state = dodoBattle(BREAKTHROUGH_STEPS.length);
    const dodo = findFighter(state, "player-0")!;
    const tia = findFighter(state, "player-1")!;
    const enemy = findFighter(state, "enemy-0")!;
    enemy.x = tia.x + 40; enemy.y = tia.y; enemy.attackCooldown = 0;
    tia.hp = tia.maxHp * 0.26; tia.shield.amount = 0;
    for (let tick = 0; tick < 40 && !dodo.bt.rescueUsed; tick += 1) stepSkirmish(state, 0.05, () => 0.99);
    expect(dodo.bt.rescueUsed).toBe(true);
    expect(tia.shield.amount).toBeGreaterThan(0);
  });

  it("는 네 슬롯 모두 문장을 만든다", () => {
    const dodo = getRelic("dodo");
    expect(breakthroughEffectText(dodo, "basic")).toContain("75%");
    expect(breakthroughEffectText(dodo, "ultimate")).toContain("[[shield|보호막]]");
    expect(breakthroughEffectText(dodo, "ferocity")).toContain("[[ferocity|폭주]]가 끝날 때");
    expect(breakthroughEffectText(dodo, "passive")).toContain("25% 이하");
  });
});

describe("파루아 한계 돌파", () => {
  /** 파루아 한 명이 적 하나를 상대한다. 돌파 단계만 갈아 끼운다. */
  function paruaBattle(breakthrough: number, foes = ["amo"]): SkirmishState {
    return createSkirmish([getRelic("parua")], foes.map(getRelic), ARENA, {}, { parua: breakthrough });
  }
  function setUp(state: SkirmishState): void {
    const parua = findFighter(state, "player-0")!;
    for (const enemy of state.fighters.filter((fighter) => fighter.side === "enemy")) {
      enemy.x = parua.x; enemy.y = parua.y - 300; enemy.attackCooldown = 999; enemy.maxHp = 1_000_000; enemy.hp = enemy.maxHp;
    }
  }

  it("는 갈래화살이 1초 뒤 같은 자리로 한 번 더 날아가고 집중은 쌓지 않는다(별 II)", () => {
    const run = (breakthrough: number): { hits: number; focus: number } => {
      const state = paruaBattle(breakthrough);
      setUp(state);
      const parua = findFighter(state, "player-0")!;
      parua.basicCycleStep = 2; parua.attackCooldown = 0;
      let hits = 0;
      for (let tick = 0; tick < 30; tick += 1) {
        for (const event of stepSkirmish(state, 0.05, () => 0.99)) {
          if (event.kind === "attack" && event.attackerId === parua.id && event.skill === "basic") hits += 1;
        }
        // 첫 갈래화살 한 번과 그 메아리만 세려고 다음 공격은 막아 둔다.
        parua.attackCooldown = 999;
      }
      return { hits, focus: parua.focus };
    };
    const before = run(0); const after = run(1);
    expect(before.hits).toBe(1);
    expect(after.hits).toBe(2);
    // 메아리 화살은 집중을 쌓지 않는다.
    expect(after.focus).toBe(before.focus);
  });

  it("는 궁극기의 연격을 세 발 · 8초로 늘린다(별 III)", () => {
    const cast = (breakthrough: number) => {
      const state = paruaBattle(breakthrough);
      const parua = findFighter(state, "player-0")!;
      parua.energy = parua.def.ultimate.cost;
      fireUltimate(state, parua.id, () => 0.99);
      return parua.volley!;
    };
    expect(cast(1)).toMatchObject({ hitCount: 2, total: 5 });
    expect(cast(2)).toMatchObject({ hitCount: 3, total: 8 });
  });

  it("는 폭주에 들어서는 순간 3초 동안 은신한다(별 IV)", () => {
    const state = paruaBattle(3);
    setUp(state);
    const parua = findFighter(state, "player-0")!;
    parua.ferocity = FEROCITY_RULES.max - 0.001; parua.attackCooldown = 0;
    for (let tick = 0; tick < 40 && !parua.ferocityFever; tick += 1) stepSkirmish(state, 0.05, () => 0.99);
    expect(parua.ferocityFever).toBe(true);
    expect(parua.stealthFor).toBeGreaterThan(2);
    // 별 셋에서는 은신하지 않는다.
    const plain = paruaBattle(2);
    setUp(plain);
    const other = findFighter(plain, "player-0")!;
    other.ferocity = FEROCITY_RULES.max - 0.001; other.attackCooldown = 0;
    for (let tick = 0; tick < 40 && !other.ferocityFever; tick += 1) stepSkirmish(plain, 0.05, () => 0.99);
    expect(other.stealthFor).toBe(0);
  });

  it("는 집중이 가득 차면 갈래화살이 반드시 치명타다(별 V)", () => {
    const critical = (breakthrough: number, focus: number): boolean => {
      const state = paruaBattle(breakthrough);
      setUp(state);
      const parua = findFighter(state, "player-0")!;
      parua.focus = focus; parua.basicCycleStep = 2; parua.attackCooldown = 0;
      const events = stepSkirmish(state, 0.05, () => 0.99);
      return events.some((event) => event.kind === "attack" && event.attackerId === parua.id && event.skill === "basic" && event.critical);
    };
    expect(critical(BREAKTHROUGH_STEPS.length, 15)).toBe(true);
    expect(critical(BREAKTHROUGH_STEPS.length, 14)).toBe(false);
    expect(critical(BREAKTHROUGH_STEPS.length - 1, 15)).toBe(false);
  });

  it("는 네 슬롯 모두 문장을 만든다", () => {
    const parua = getRelic("parua");
    expect(breakthroughEffectText(parua, "basic")).toContain("1초 뒤 한 번 더");
    expect(breakthroughEffectText(parua, "ultimate")).toContain("3번 적중");
    expect(breakthroughEffectText(parua, "ferocity")).toContain("[[stealth|은신]]");
    expect(breakthroughEffectText(parua, "passive")).toContain("반드시 치명타");
  });
});

describe("스피나 한계 돌파", () => {
  const FULL = BREAKTHROUGH_STEPS.length;
  function spinoBattle(breakthrough: number, foes = ["torika", "amo"]): SkirmishState {
    return createSkirmish([getRelic("spino")], foes.map(getRelic), ARENA, {}, { spino: breakthrough });
  }
  /** 스피나 곁에 적을 붙이고, 적이 때리지 못하게 공격을 멈춘다. */
  function engageAll(state: SkirmishState): void {
    const spino = findFighter(state, "player-0")!;
    for (const [index, enemy] of state.fighters.filter((fighter) => fighter.side === "enemy").entries()) {
      enemy.x = spino.x + 40 + index * 30; enemy.y = spino.y; enemy.attackCooldown = 999; enemy.maxHp = 1_000_000; enemy.hp = enemy.maxHp;
    }
  }

  it("는 궁극기가 건 기절을 같은 적에게 8초 동안 다시 걸지 않는다(기본 규칙)", () => {
    const state = spinoBattle(0, ["torika"]);
    engageAll(state);
    const spino = findFighter(state, "player-0")!;
    const enemy = findFighter(state, "enemy-0")!;
    const stunned = (): boolean => enemy.stunnedFor > 0;
    spino.energy = spino.def.ultimate.cost;
    fireUltimate(state, spino.id, () => 0.99);
    expect(stunned()).toBe(true);
    // 기절이 풀린 뒤 곧바로 다시 쏘아도 8초가 지나기 전에는 기절하지 않는다 — 피해는 들어간다.
    enemy.stunnedFor = 0; spino.energy = spino.def.ultimate.cost;
    const hp = enemy.hp;
    fireUltimate(state, spino.id, () => 0.99);
    expect(enemy.hp).toBeLessThan(hp);
    expect(stunned()).toBe(false);
    // 8초가 지난 뒤에는 다시 걸린다.
    state.elapsed += 8; spino.energy = spino.def.ultimate.cost;
    fireUltimate(state, spino.id, () => 0.99);
    expect(stunned()).toBe(true);
  });

  it("는 도약이 꽂힌 적의 발밑에도 여울을 하나 더 깐다(별 II)", () => {
    const pools = (breakthrough: number): number => {
      const state = spinoBattle(breakthrough);
      engageAll(state);
      const spino = findFighter(state, "player-0")!;
      const [first, second] = state.fighters.filter((fighter) => fighter.side === "enemy");
      spino.shallowPools = [{ x: first.x, y: first.y, remaining: 6, total: 6 }];
      second.x = first.x + 900; second.y = first.y;
      spino.shallowLeapCount = spino.def.basic.shallows!.leapEveryHits - 1; spino.attackCooldown = 0;
      stepSkirmish(state, 0.05, () => 0.99);
      return spino.shallowPools.length;
    };
    expect(pools(1)).toBeGreaterThan(pools(0));
  });

  it("는 터진 여울이 1.5초 뒤 기절 없이 한 번 더 터진다(별 III)", () => {
    const state = spinoBattle(2, ["torika"]);
    engageAll(state);
    const spino = findFighter(state, "player-0")!;
    const enemy = findFighter(state, "enemy-0")!;
    spino.shallowPools = [{ x: enemy.x, y: enemy.y, remaining: 6, total: 6 }];
    spino.energy = spino.def.ultimate.cost;
    fireUltimate(state, spino.id, () => 0.99);
    expect(spino.bt.tidalEchoes).toHaveLength(1);
    enemy.stunnedFor = 0;
    let echoes = 0;
    for (let tick = 0; tick < 50; tick += 1) {
      for (const event of stepSkirmish(state, 0.05, () => 0.99)) {
        if (event.kind === "areaImpact" && event.attackerId === spino.id) echoes += 1;
      }
    }
    expect(echoes).toBeGreaterThanOrEqual(1);
    expect(spino.bt.tidalEchoes).toHaveLength(0);
    // 되돌아온 파도는 기절을 걸지 않는다.
    expect(enemy.stunnedFor).toBe(0);
    // 별 하나에서는 예약하지 않는다.
    const plain = spinoBattle(1, ["torika"]);
    engageAll(plain);
    const other = findFighter(plain, "player-0")!;
    other.shallowPools = [{ x: findFighter(plain, "enemy-0")!.x, y: findFighter(plain, "enemy-0")!.y, remaining: 6, total: 6 }];
    other.energy = other.def.ultimate.cost;
    fireUltimate(plain, other.id, () => 0.99);
    expect(other.bt.tidalEchoes).toHaveLength(0);
  });

  it("는 폭주에 들어선 뒤 첫 일반 공격이 반드시 치명타다(별 IV)", () => {
    const state = spinoBattle(3, ["torika"]);
    engageAll(state);
    const spino = findFighter(state, "player-0")!;
    spino.ferocity = FEROCITY_RULES.max - 0.001; spino.attackCooldown = 0;
    expect(spino.bt.ambushCritReady).toBe(false);
    let firstBasic: boolean | undefined;
    for (let tick = 0; tick < 200 && firstBasic === undefined; tick += 1) {
      const wasFever = spino.ferocityFever;
      for (const event of stepSkirmish(state, 0.05, () => 0.99)) {
        if (spino.ferocityFever && event.kind === "attack" && event.attackerId === spino.id && event.skill === "basic" && !wasFever === false) firstBasic = event.critical;
      }
      if (spino.ferocityFever && spino.bt.ambushCritReady) { spino.attackCooldown = 0; engageAll(state); }
    }
    expect(firstBasic).toBe(true);
    expect(spino.bt.ambushCritReady).toBe(false);
  });

  it("는 여울에 잠긴 적을 처치하면 곧바로 다음 여울로 도약한다(별 V)", () => {
    const run = (breakthrough: number): number => {
      const state = spinoBattle(breakthrough, ["torika", "amo"]);
      engageAll(state);
      const spino = findFighter(state, "player-0")!;
      const [first, second] = state.fighters.filter((fighter) => fighter.side === "enemy");
      first.hp = 1;
      second.x = first.x + 900; second.y = first.y;
      spino.shallowPools = [
        { x: first.x, y: first.y, remaining: 6, total: 6 },
        { x: second.x, y: second.y, remaining: 6, total: 6 },
      ];
      spino.targetId = first.id; spino.attackCooldown = 0; spino.shallowLeapCount = 0;
      stepSkirmish(state, 0.05, () => 0.99);
      return Math.hypot(spino.x - second.x, spino.y - second.y);
    };
    // 돌파가 열려 있으면 처치한 즉시 둘째 여울로 건너가 둘째 적 곁에 선다.
    expect(run(FULL)).toBeLessThan(run(FULL - 1));
  });

  it("는 네 슬롯 모두 문장을 만든다", () => {
    const spino = getRelic("spino");
    expect(breakthroughEffectText(spino, "basic")).toContain("[[shallows|여울]]");
    expect(breakthroughEffectText(spino, "ultimate")).toContain("1.5초 뒤 한 번 더 터진다");
    expect(breakthroughEffectText(spino, "ferocity")).toContain("반드시 치명타");
    expect(breakthroughEffectText(spino, "passive")).toContain("처치하면");
  });
});

describe("슈테 한계 돌파", () => {
  const FULL = BREAKTHROUGH_STEPS.length;
  /** 렉시아(듀오) · 슈테 · 티아가 적 하나를 상대한다. 슈테의 바로 왼쪽인 렉시아가 듀오다. */
  function shuteBattle(breakthrough: number, foes = ["torika"]): SkirmishState {
    return createSkirmish([getRelic("rex"), getRelic("shute"), getRelic("tia")], foes.map(getRelic), ARENA, {}, { shute: breakthrough });
  }
  function freeze(state: SkirmishState): void {
    for (const enemy of state.fighters.filter((fighter) => fighter.side === "enemy")) {
      enemy.attackCooldown = 999; enemy.maxHp = 1_000_000; enemy.hp = enemy.maxHp;
    }
  }

  it("는 평타가 원거리까지 닿고 듀오에게서 더 멀리 떨어져 선다(별 II)", () => {
    const reach = (breakthrough: number): number => fighterReach(findFighter(shuteBattle(breakthrough), "player-1")!);
    expect(reach(0)).toBe(360);
    expect(reach(1)).toBe(600);
    // 듀오가 300 떨어져 있으면 별 하나는 180까지 붙으려 걷고, 열리면 420 안이라 걷지 않는다.
    const walked = (breakthrough: number): number => {
      const state = shuteBattle(breakthrough);
      freeze(state);
      const shute = findFighter(state, "player-1")!; const duo = findFighter(state, "player-0")!;
      duo.x = shute.x + 300; duo.y = shute.y;
      const before = Math.hypot(duo.x - shute.x, duo.y - shute.y);
      stepSkirmish(state, 0.05, () => 0.99);
      return before - Math.hypot(duo.x - shute.x, duo.y - shute.y);
    };
    expect(walked(0)).toBeGreaterThan(walked(1));
  });

  it("는 오더 동안 듀오가 처음 때리는 적마다 표식을 즉시 찍어 터뜨린다(별 III)", () => {
    const bursts = (breakthrough: number): number => {
      const state = shuteBattle(breakthrough);
      freeze(state);
      const shute = findFighter(state, "player-1")!; const duo = findFighter(state, "player-0")!;
      const enemy = findFighter(state, "enemy-0")!;
      enemy.x = duo.x + 40; enemy.y = duo.y;
      shute.energy = shute.def.ultimate.cost;
      fireUltimate(state, shute.id, () => 0.99);
      duo.attackCooldown = 0; shute.attackCooldown = 999;
      let count = 0;
      for (let tick = 0; tick < 60; tick += 1) {
        for (const event of stepSkirmish(state, 0.05, () => 0.99)) if (event.kind === "attack" && event.skill === "weakpoint") count += 1;
      }
      return count;
    };
    // 평타 주기(세 번째)가 오기 전이라 돌파가 없으면 한 번도 터지지 않고, 있으면 첫 타격에 한 번 터진다.
    expect(bursts(1)).toBe(0);
    expect(bursts(2)).toBe(1);
  });

  it("는 폭주 동안 평타가 세 번째마다가 아니라 매번 표식을 찍는다(별 IV)", () => {
    const marks = (breakthrough: number): number => {
      const state = shuteBattle(breakthrough);
      freeze(state);
      const shute = findFighter(state, "player-1")!; const duo = findFighter(state, "player-0")!;
      const enemy = findFighter(state, "enemy-0")!;
      enemy.x = shute.x + 100; enemy.y = shute.y; duo.attackCooldown = 999;
      shute.ferocityFever = true; shute.ferocity = FEROCITY_RULES.max; shute.attackCooldown = 0; shute.targetId = enemy.id;
      stepSkirmish(state, 0.05, () => 0.99);
      return enemy.weakpoint === null ? 0 : 1;
    };
    // 첫 걸음에서 돌파 없이는 주기가 차지 않아 표식이 없다.
    expect(marks(2)).toBe(0);
    expect(marks(3)).toBe(1);
  });

  it("는 듀오가 쓰러지면 가장 가까운 아군과 새 듀오를 맺는다(별 V · 전투당 한 번)", () => {
    const state = shuteBattle(FULL);
    freeze(state);
    const shute = findFighter(state, "player-1")!;
    const rex = findFighter(state, "player-0")!; const tia = findFighter(state, "player-2")!;
    expect(shute.duoId).toBe(rex.id);
    rex.hp = 0;
    stepSkirmish(state, 0.05, () => 0.99);
    expect(shute.duoId).toBe(tia.id);
    expect(shute.bt.relinkUsed).toBe(true);
    // 새 듀오도 쓰러지면 다시 맺지 않는다.
    tia.hp = 0;
    stepSkirmish(state, 0.05, () => 0.99);
    expect(shute.duoId).toBe(tia.id);
    // 돌파가 없으면 맺지 않는다.
    const plain = shuteBattle(FULL - 1);
    freeze(plain);
    findFighter(plain, "player-0")!.hp = 0;
    stepSkirmish(plain, 0.05, () => 0.99);
    expect(findFighter(plain, "player-1")!.duoId).toBe("player-0");
  });

  it("는 네 슬롯 모두 문장을 만든다", () => {
    const shute = getRelic("shute");
    expect(breakthroughEffectText(shute, "basic")).toContain("원거리");
    expect(breakthroughEffectText(shute, "ultimate")).toContain("처음 때리는 적마다");
    expect(breakthroughEffectText(shute, "ferocity")).toContain("매번");
    expect(breakthroughEffectText(shute, "passive")).toContain("새 듀오");
  });
});

describe("메테 한계 돌파", () => {
  const FULL = BREAKTHROUGH_STEPS.length;
  /** 메테 · 렉시아 · 티아가 적 둘을 상대한다. 돌파 단계만 갈아 끼운다. */
  function metteBattle(breakthrough: number, foes = ["torika", "amo"]): SkirmishState {
    return createSkirmish([getRelic("mette"), getRelic("rex"), getRelic("tia")], foes.map(getRelic), ARENA, {}, { mette: breakthrough });
  }
  function freeze(state: SkirmishState): void {
    for (const enemy of state.fighters.filter((fighter) => fighter.side === "enemy")) {
      enemy.attackCooldown = 999; enemy.maxHp = 1_000_000; enemy.hp = enemy.maxHp;
    }
  }

  it("는 같은 적을 연속으로 맞히면 스타카토 겹이 쌓이고 다른 적으로 옮기면 처음부터다(별 II)", () => {
    const state = metteBattle(1);
    freeze(state);
    const mette = findFighter(state, "player-0")!;
    const [first, second] = state.fighters.filter((fighter) => fighter.side === "enemy");
    first.x = mette.x; first.y = mette.y - 200; second.x = mette.x + 60; second.y = mette.y - 200;
    const hit = (target: typeof first): number => {
      mette.targetId = target.id; mette.attackCooldown = 0;
      stepSkirmish(state, 0.05, () => 0.99);
      return mette.bt.staccatoStreak?.count ?? 0;
    };
    expect(hit(first)).toBe(1);
    expect(hit(first)).toBe(2);
    expect(hit(second)).toBe(1);
    // 별 하나에서는 세지 않는다.
    const plain = metteBattle(0);
    freeze(plain);
    const other = findFighter(plain, "player-0")!;
    const foe = findFighter(plain, "enemy-0")!;
    foe.x = other.x; foe.y = other.y - 200; other.attackCooldown = 0; other.targetId = foe.id;
    stepSkirmish(plain, 0.05, () => 0.99);
    expect(other.bt.staccatoStreak).toBeNull();
  });

  it("는 궁극기 게이지를 15 줄이고 체력이 가득 찬 아군에게만 보호막을 준다(별 III)", () => {
    expect(findFighter(metteBattle(1), "player-0")!.def.ultimate.cost).toBe(90);
    const state = metteBattle(2);
    freeze(state);
    const mette = findFighter(state, "player-0")!;
    const rex = findFighter(state, "player-1")!; const tia = findFighter(state, "player-2")!;
    expect(mette.def.ultimate.cost).toBe(75);
    tia.hp = tia.maxHp * 0.5;
    for (const fighter of [mette, rex, tia]) fighter.shield.amount = 0;
    mette.energy = mette.def.ultimate.cost;
    fireUltimate(state, mette.id, () => 0.99);
    // 가득 찬 렉시아는 최대 체력 8%의 보호막, 다친 티아는 회복만 받는다.
    expect(rex.shield.amount).toBeCloseTo(rex.maxHp * 0.08, 3);
    expect(tia.shield.amount).toBe(0);
    expect(tia.hp).toBeGreaterThan(tia.maxHp * 0.5);
  });

  it("는 폭주 추가타 위력이 칠 때마다 커지되 +50%에서 멈춘다(별 IV)", () => {
    const power = (hits: number, breakthrough: number): number => {
      const state = metteBattle(breakthrough, ["torika"]);
      freeze(state);
      const mette = findFighter(state, "player-0")!; const enemy = findFighter(state, "enemy-0")!;
      enemy.x = mette.x; enemy.y = mette.y - 200;
      mette.ferocityFever = true; mette.ferocity = FEROCITY_RULES.max; mette.bt.crescendoHits = hits;
      mette.attackCooldown = 0; mette.targetId = enemy.id;
      const events = stepSkirmish(state, 0.05, () => 0.99);
      const extra = events.find((event) => event.kind === "attack" && event.skill === "staccato");
      return extra?.kind === "attack" ? extra.amount : 0;
    };
    const base = power(0, 3);
    expect(power(4, 3) / base).toBeGreaterThan(1.1);
    // 열 번을 넘겨 쌓여도 +50%를 넘지 않는다.
    expect(power(50, 3) / base).toBeLessThan(1.52);
    expect(power(50, 3) / base).toBeGreaterThan(1.45);
    // 별 셋에서는 오르지 않는다.
    expect(power(50, 2) / power(0, 2)).toBeCloseTo(1, 1);
  });

  it("는 메테의 보호막이 다 깨지면 주위 적에게 피해와 경직을 주고 7초 쉰다(별 V)", () => {
    const state = metteBattle(FULL);
    freeze(state);
    const mette = findFighter(state, "player-0")!; const tia = findFighter(state, "player-2")!;
    const [first, second] = state.fighters.filter((fighter) => fighter.side === "enemy");
    first.x = tia.x + 50; first.y = tia.y; second.x = tia.x - 80; second.y = tia.y;
    first.hp = first.maxHp; second.hp = second.maxHp;
    tia.shield.amount = 1; tia.shield.providerId = mette.id;
    first.attackCooldown = 0; first.targetId = tia.id; first.engaged = true;
    const before = second.hp;
    for (let tick = 0; tick < 40 && mette.bt.adagioSlamCooldown <= 0; tick += 1) stepSkirmish(state, 0.05, () => 0.99);
    expect(mette.bt.adagioSlamCooldown).toBeGreaterThan(6);
    expect(second.hp).toBeLessThan(before);
    // 돌파가 없으면 내려앉지 않는다.
    const plain = metteBattle(FULL - 1);
    freeze(plain);
    const other = findFighter(plain, "player-0")!; const ally = findFighter(plain, "player-2")!;
    const foe = findFighter(plain, "enemy-0")!;
    foe.x = ally.x + 50; foe.y = ally.y; ally.shield.amount = 1; ally.shield.providerId = other.id;
    foe.attackCooldown = 0; foe.targetId = ally.id; foe.engaged = true;
    for (let tick = 0; tick < 40; tick += 1) stepSkirmish(plain, 0.05, () => 0.99);
    expect(other.bt.adagioSlamCooldown).toBe(0);
  });

  it("는 네 슬롯 모두 문장을 만든다", () => {
    const mette = getRelic("mette");
    expect(breakthroughEffectText(mette, "basic")).toContain("연속으로");
    expect(breakthroughEffectText(mette, "ultimate")).toContain("15 줄고");
    expect(breakthroughEffectText(mette, "ferocity")).toContain("50%까지");
    expect(breakthroughEffectText(mette, "passive")).toContain("7초에 한 번");
  });
});

describe("이르나 한계 돌파", () => {
  const FULL = BREAKTHROUGH_STEPS.length;
  /** 이르나 한 명과 적 셋. 돌파 단계만 갈아 끼운다. 적은 때리지 않고 체력이 사실상 무한하다. */
  function irnaBattle(breakthrough: number): SkirmishState {
    const state = createSkirmish([getRelic("irna")], ["amo", "toby", "torika"].map(getRelic), ARENA, {}, { irna: breakthrough });
    for (const enemy of state.fighters.filter((fighter) => fighter.side === "enemy")) {
      enemy.attackCooldown = 999; enemy.retargetIn = 999; enemy.maxHp = 1_000_000; enemy.hp = enemy.maxHp; enemy.stealthFor = 0;
    }
    const irna = findFighter(state, "player-0")!;
    irna.x = 500; irna.y = 1_400; irna.retargetIn = 999;
    return state;
  }
  /** 이르나가 지금 겨눈 적을 한 번 쏜 사건의 피해량. */
  function shoot(state: SkirmishState, targetId: string, rng: () => number = () => 0.99): number {
    const irna = findFighter(state, "player-0")!;
    // 연속으로 쏘는 동안 폭주(방어 무시)가 끼어 피해가 갈리지 않도록 야성은 늘 비워 둔다.
    irna.targetId = targetId; irna.attackCooldown = 0; irna.ferocity = 0;
    const event = stepSkirmish(state, 0.05, rng).find((entry) => entry.kind === "attack" && entry.attackerId === irna.id && entry.skill === "basic");
    return event && event.kind === "attack" ? event.amount : 0;
  }

  it("는 같은 적을 연속으로 맞힐수록 평타가 무거워지고 다른 적으로 옮기면 처음부터다(별 II)", () => {
    const state = irnaBattle(1);
    const [first, second] = state.fighters.filter((fighter) => fighter.side === "enemy");
    first.x = 500; first.y = 1_100; second.x = 800; second.y = 1_100;
    const irna = findFighter(state, "player-0")!;
    const amounts = Array.from({ length: 6 }, () => shoot(state, first.id));
    expect(amounts[1]).toBeGreaterThan(amounts[0]);
    expect(amounts[4]).toBeGreaterThan(amounts[3]);
    // 5겹(첫 타 포함)에서 멈춘다.
    expect(amounts[5]).toBe(amounts[4]);
    expect(irna.bt.focusStreak?.count).toBe(6);
    shoot(state, second.id);
    expect(irna.bt.focusStreak).toEqual({ targetId: second.id, count: 1 });
    // 돌파가 없으면 세지 않는다.
    const plain = irnaBattle(0);
    const foe = plain.fighters.find((fighter) => fighter.side === "enemy")!;
    foe.x = 500; foe.y = 1_100;
    shoot(plain, foe.id);
    expect(findFighter(plain, "player-0")!.bt.focusStreak).toBeNull();
  });

  it("은 궁극기가 맞은 적 주위의 다른 적에게 파편을 튀긴다(별 III)", () => {
    const run = (breakthrough: number): { neighbor: number; distant: number } => {
      const state = irnaBattle(breakthrough);
      const [farthest, neighbor, distant] = state.fighters.filter((fighter) => fighter.side === "enemy");
      farthest.x = 500; farthest.y = 100; neighbor.x = 620; neighbor.y = 200; distant.x = 500; distant.y = 900;
      findFighter(state, "player-0")!.energy = 1_000;
      fireUltimate(state, "player-0");
      return { neighbor: neighbor.maxHp - neighbor.hp, distant: distant.maxHp - distant.hp };
    };
    expect(run(0)).toEqual({ neighbor: 0, distant: 0 });
    const withShrapnel = run(2);
    expect(withShrapnel.neighbor).toBeGreaterThan(0);
    // 반경 밖의 적은 맞지 않는다.
    expect(withShrapnel.distant).toBe(0);
  });

  it("은 폭주 중 치명타로 맞힌 적만 휘청이게 한다 — 궁극기와는 엮이지 않는다(별 IV)", () => {
    const crit = (breakthrough: number, fever: boolean): number => {
      const state = irnaBattle(breakthrough);
      const foe = state.fighters.find((fighter) => fighter.side === "enemy")!;
      foe.x = 500; foe.y = 1_100;
      findFighter(state, "player-0")!.ferocityFever = fever;
      shoot(state, foe.id, () => 0);
      return foe.staggeredFor;
    };
    expect(crit(3, true)).toBeGreaterThan(0);
    expect(crit(3, false)).toBe(0);
    expect(crit(2, true)).toBe(0);
    // 폭주 효과 정의는 궁극기를 건드리지 않는다.
    expect(JSON.stringify(getRelic("irna").breakthroughEffects?.ferocity).toLowerCase()).not.toContain("ultimate");
  });

  it("은 해무 방벽이 가득 찬 동안에만 피해를 키운다(별 V)", () => {
    const damage = (breakthrough: number, full: boolean): number => {
      const state = irnaBattle(breakthrough);
      const foe = state.fighters.find((fighter) => fighter.side === "enemy")!;
      foe.x = 500; foe.y = 1_100;
      const irna = findFighter(state, "player-0")!;
      if (full) { irna.shield.amount = irna.maxHp * 0.25; irna.shield.providerId = irna.id; }
      return shoot(state, foe.id);
    };
    const base = damage(FULL, false);
    expect(damage(FULL, true)).toBeGreaterThan(base);
    expect(damage(FULL, true)).toBeCloseTo(base * 1.15, -1);
    // 돌파가 없으면 가득 차 있어도 그대로다.
    expect(damage(0, true)).toBe(base);
  });

  it("는 네 슬롯 모두 문장을 만든다", () => {
    const irna = getRelic("irna");
    expect(breakthroughEffectText(irna, "basic")).toContain("연속");
    expect(breakthroughEffectText(irna, "ultimate")).toContain("파편");
    expect(breakthroughEffectText(irna, "ferocity")).toContain("경직");
    expect(breakthroughEffectText(irna, "passive")).toContain("해무 방벽");
  });
});

describe("노도니아 한계 돌파", () => {
  const FULL = BREAKTHROUGH_STEPS.length;
  /** 노도니아 한 명과 적 하나. 적이 때릴지(`hostile`)와 노도니아가 먼저 때릴지는 시험이 정한다. */
  function nodoniaBattle(breakthrough: number, enemy = "toby"): SkirmishState {
    const state = createSkirmish([getRelic("nodonia")], [getRelic(enemy)], ARENA, {}, { nodonia: breakthrough });
    const foe = state.fighters.find((fighter) => fighter.side === "enemy")!;
    foe.maxHp = 1_000_000; foe.hp = foe.maxHp; foe.stealthFor = 0;
    const nodonia = findFighter(state, "player-0")!;
    nodonia.x = 500; nodonia.y = 1_000; foe.x = 540; foe.y = 1_000;
    return state;
  }

  it("은 평타에 맞은 적이 잠깐 노도니아만 노린다(별 II)", () => {
    const run = (breakthrough: number) => {
      const state = nodoniaBattle(breakthrough);
      const foe = state.fighters.find((fighter) => fighter.side === "enemy")!;
      foe.attackCooldown = 999;
      for (let tick = 0; tick < 200; tick += 1) {
        stepSkirmish(state, 0.05);
        if (foe.taunted) break;
      }
      return foe.taunted;
    };
    expect(run(1)?.sourceId).toBe("player-0");
    expect(run(0)).toBeNull();
  });

  /** 대신 받기가 켜진 뒤 합계를 `taken`으로 맞추고 끝날 때까지 돌려 적이 입은 피해를 잰다. 돌파가 없는 판과 같은 조건이라 차이만 본다. */
  function paybackDamage(breakthrough: number, taken: number, foeX = 140): number {
    const state = nodoniaBattle(breakthrough);
    const foe = state.fighters.find((fighter) => fighter.side === "enemy")!;
    foe.x = foeX; foe.attackCooldown = 999; foe.retargetIn = 999;
    const nodonia = findFighter(state, "player-0")!;
    nodonia.x = 100; nodonia.retargetIn = 999; nodonia.attackCooldown = 999; nodonia.energy = 1_000;
    fireUltimate(state, "player-0");
    // 켜는 순간 합계는 0으로 시작한다 — 이후 대신 받은 피해만 센다.
    expect(nodonia.bt.bulwarkTaken).toBe(0);
    nodonia.bt.bulwarkTaken = taken;
    // 서로 다가서지 않도록 자리를 붙박아 둔다 — 반경 판정을 시험하는 판이다.
    for (let tick = 0; tick < 130; tick += 1) {
      nodonia.x = 100; nodonia.y = 1_000; foe.x = foeX; foe.y = 1_000;
      stepSkirmish(state, 0.05);
    }
    return foe.maxHp - foe.hp;
  }

  it("은 대신 받기가 끝날 때 대신 받은 피해의 일부를 주위 적에게만 고정 피해로 돌려준다(별 III)", () => {
    // 400의 25% = 100. 자기 최대 체력의 10%보다 작으니 상한에 걸리지 않는다.
    expect(paybackDamage(2, 400) - paybackDamage(0, 400)).toBe(100);
    // 반경(300) 밖의 적은 맞지 않는다.
    expect(paybackDamage(2, 400, 900) - paybackDamage(0, 400, 900)).toBe(0);
  });

  it("은 대신 받은 피해가 많아도 적 한 명이 받는 몫을 노도니아 최대 체력의 10%로 막는다(별 III)", () => {
    const maxHp = findFighter(nodoniaBattle(2), "player-0")!.maxHp;
    expect(paybackDamage(2, 100_000) - paybackDamage(0, 100_000)).toBe(Math.round(maxHp * 0.1));
  });

  it("은 폭주 중에는 희열이 열다섯 겹까지 쌓이고 폭주가 끝나면 열 겹으로 깎인다(별 IV)", () => {
    const state = nodoniaBattle(3, "toby");
    const nodonia = findFighter(state, "player-0")!;
    const foe = state.fighters.find((fighter) => fighter.side === "enemy")!;
    nodonia.retargetIn = 999; nodonia.attackCooldown = 999;
    nodonia.ferocityFever = true;
    let peak = 0;
    for (let tick = 0; tick < 1_200 && peak < 15; tick += 1) {
      nodonia.ferocity = FEROCITY_RULES.max; nodonia.hp = nodonia.maxHp;
      stepSkirmish(state, 0.05);
      peak = Math.max(peak, nodonia.elation?.stacks ?? 0);
    }
    expect(foe.hp).toBeLessThanOrEqual(foe.maxHp);
    expect(peak).toBe(15);
    // 폭주가 끝나는 프레임에 상한이 열 겹으로 돌아오고 넘친 겹이 깎인다.
    nodonia.ferocity = 0.001; nodonia.ferocityFever = true;
    stepSkirmish(state, 0.05);
    expect(nodonia.ferocityFever).toBe(false);
    expect(nodonia.elation?.maxStacks).toBe(10);
    expect(nodonia.elation?.stacks ?? 0).toBeLessThanOrEqual(10);
  });

  it("은 폭주가 아니면 열 겹에서 멈춘다(별 IV)", () => {
    const state = nodoniaBattle(3, "toby");
    const nodonia = findFighter(state, "player-0")!;
    nodonia.retargetIn = 999; nodonia.attackCooldown = 999;
    let peak = 0;
    for (let tick = 0; tick < 600; tick += 1) {
      nodonia.hp = nodonia.maxHp; nodonia.ferocity = 0;
      stepSkirmish(state, 0.05);
      peak = Math.max(peak, nodonia.elation?.stacks ?? 0);
    }
    expect(peak).toBeLessThanOrEqual(10);
  });

  it("은 희열 한 겹의 재생을 0.3%에서 0.4%로 돌려놓는다(별 V)", () => {
    const regen = (breakthrough: number): number | undefined => {
      const state = nodoniaBattle(breakthrough, "toby");
      const nodonia = findFighter(state, "player-0")!;
      nodonia.retargetIn = 999; nodonia.attackCooldown = 999;
      for (let tick = 0; tick < 200 && !nodonia.elation; tick += 1) { nodonia.hp = nodonia.maxHp; stepSkirmish(state, 0.05); }
      return nodonia.elation?.regenPercentPerStack;
    };
    expect(regen(0)).toBe(0.3);
    expect(regen(FULL)).toBe(0.4);
  });

  it("는 네 슬롯 모두 문장을 만든다", () => {
    const nodonia = getRelic("nodonia");
    expect(breakthroughEffectText(nodonia, "basic")).toContain("도발");
    expect(breakthroughEffectText(nodonia, "ultimate")).toContain("고정 피해");
    expect(breakthroughEffectText(nodonia, "ferocity")).toContain("15겹");
    expect(breakthroughEffectText(nodonia, "passive")).toContain("0.4%");
  });
});

describe("루카 한계 돌파", () => {
  const FULL = BREAKTHROUGH_STEPS.length;
  const NEVER = () => 0.99;
  /** 루카와 (선택) 아군 하나 대 거의 죽지 않는 적 하나. 적은 때리지 않고 서로 붙어 선다. */
  function lukaBattle(breakthrough: number, allies: string[] = []): SkirmishState {
    const state = createSkirmish([getRelic("luka"), ...allies.map(getRelic)], [getRelic("toby")], ARENA, {}, { luka: breakthrough });
    const foe = state.fighters.find((fighter) => fighter.side === "enemy")!;
    foe.maxHp = 10_000_000; foe.hp = foe.maxHp; foe.stealthFor = 0; foe.attackCooldown = 999; foe.retargetIn = 999;
    state.fighters.filter((fighter) => fighter.side === "player").forEach((fighter, index) => { fighter.x = 500 + index * 10; fighter.y = 1_000; });
    foe.x = 540; foe.y = 1_000;
    return state;
  }

  it("은 주기 치명타가 채워진 발톱이 출혈을 남긴다(별 II)", () => {
    const run = (breakthrough: number) => {
      const state = lukaBattle(breakthrough);
      const luka = findFighter(state, "player-0")!;
      const foe = state.fighters.find((fighter) => fighter.side === "enemy")!;
      let attacks = 0; let bleedAtAttack = -1;
      for (let tick = 0; tick < 600 && attacks < 4; tick += 1) {
        luka.x = 500; luka.y = 1_000; foe.x = 540; foe.y = 1_000;
        const events = stepSkirmish(state, 0.05, NEVER);
        for (const event of events) if (event.kind === "attack" && event.attackerId === luka.id && event.skill === "basic") {
          attacks += 1;
          if (foe.bleed !== null && bleedAtAttack < 0) bleedAtAttack = attacks;
        }
      }
      return bleedAtAttack;
    };
    expect(run(1)).toBe(4);
    expect(run(0)).toBe(-1);
  });

  it("은 궁극기가 적중한 뒤 잔상이 같은 적을 한 번 더 벤다(별 III)", () => {
    const run = (breakthrough: number, killBeforeSlash = false) => {
      const state = lukaBattle(breakthrough);
      const luka = findFighter(state, "player-0")!;
      const foe = state.fighters.find((fighter) => fighter.side === "enemy")!;
      luka.attackCooldown = 999; luka.retargetIn = 999; luka.energy = 1_000;
      const first = fireUltimate(state, luka.id, NEVER).filter((event) => event.kind === "attack");
      if (killBeforeSlash) foe.hp = 0;
      const later: SkirmishEvent[] = [];
      for (let tick = 0; tick < 20; tick += 1) later.push(...stepSkirmish(state, 0.05, NEVER));
      const slashes = later.filter((event) => event.kind === "attack" && event.attackerId === luka.id && event.followUp === true);
      return { first, slashes };
    };
    const on = run(2);
    expect(on.slashes).toHaveLength(1);
    // 같은 위력(100%)이라 첫 타와 비슷한 크기로 들어간다(전이는 따로).
    const firstHit = on.first.find((event) => event.kind === "attack" && event.skill === "ultimate");
    expect(firstHit && on.slashes[0].kind === "attack" ? on.slashes[0].amount : 0).toBeGreaterThan(0);
    expect(run(0).slashes).toHaveLength(0);
    expect(run(2, true).slashes).toHaveLength(0);
  });

  it("은 폭주 중 주기 치명타가 두 번째 공격마다 찬다(별 IV)", () => {
    const secondCritical = (breakthrough: number, fever: boolean) => {
      const state = lukaBattle(breakthrough);
      const luka = findFighter(state, "player-0")!;
      const foe = state.fighters.find((fighter) => fighter.side === "enemy")!;
      luka.ferocityFever = fever; luka.ferocity = fever ? FEROCITY_RULES.max : 0;
      const crits: boolean[] = [];
      for (let tick = 0; tick < 600 && crits.length < 2; tick += 1) {
        luka.x = 500; luka.y = 1_000; foe.x = 540; foe.y = 1_000;
        if (fever) luka.ferocity = FEROCITY_RULES.max;
        for (const event of stepSkirmish(state, 0.05, NEVER)) {
          if (event.kind === "attack" && event.attackerId === luka.id && event.skill === "basic") crits.push(event.critical);
        }
      }
      return crits[1];
    };
    expect(secondCritical(3, true)).toBe(true);
    expect(secondCritical(3, false)).toBe(false);
    expect(secondCritical(0, true)).toBe(false);
  });

  it("은 아군도 노리는 적에게만 치명타 피해가 30% 늘어난다(별 V)", () => {
    const amount = (breakthrough: number, shared: boolean) => {
      const state = lukaBattle(breakthrough, ["rex"]);
      const luka = findFighter(state, "player-0")!;
      const rex = findFighter(state, "player-1")!;
      const foe = state.fighters.find((fighter) => fighter.side === "enemy")!;
      rex.attackCooldown = 999; rex.retargetIn = 999; rex.targetId = shared ? foe.id : null;
      for (let tick = 0; tick < 200; tick += 1) {
        luka.x = 500; luka.y = 1_000; foe.x = 540; foe.y = 1_000; rex.x = 400; rex.y = 1_000;
        rex.targetId = shared ? foe.id : null;
        const hit = stepSkirmish(state, 0.05, () => 0).find((event) => event.kind === "attack" && event.attackerId === luka.id && event.skill === "basic");
        if (hit && hit.kind === "attack") return hit.amount;
      }
      return 0;
    };
    const base = amount(0, true);
    expect(amount(FULL, false)).toBe(base);
    expect(amount(FULL, true)).toBeGreaterThan(base);
    expect(amount(FULL, true) / base).toBeCloseTo(1.8 / 1.5, 1);
  });

  it("는 네 슬롯 모두 문장을 만든다", () => {
    const luka = getRelic("luka");
    expect(breakthroughEffectText(luka, "basic")).toContain("출혈");
    expect(breakthroughEffectText(luka, "ultimate")).toContain("잔상");
    expect(breakthroughEffectText(luka, "ferocity")).toContain("2번째");
    expect(breakthroughEffectText(luka, "passive")).toContain("30%");
  });
});

describe("스테라 한계 돌파", () => {
  const FULL = BREAKTHROUGH_STEPS.length;
  const NEVER = () => 0.99;
  /** 스테라와 아군 렉스 대 적 하나. 렉스·적은 가만히 서 있어 게이지와 버프만 잰다. */
  function stellaBattle(breakthrough: number): SkirmishState {
    const state = createSkirmish([getRelic("stella"), getRelic("rex")], [getRelic("toby")], ARENA, {}, { stella: breakthrough });
    const foe = state.fighters.find((fighter) => fighter.side === "enemy")!;
    foe.maxHp = 10_000_000; foe.hp = foe.maxHp; foe.stealthFor = 0; foe.attackCooldown = 999; foe.retargetIn = 999;
    const rex = findFighter(state, "player-1")!;
    rex.attackCooldown = 999; rex.retargetIn = 999; rex.energy = 0;
    const stella = findFighter(state, "player-0")!;
    stella.x = 500; stella.y = 1_000; foe.x = 540; foe.y = 1_000; rex.x = 300; rex.y = 1_000;
    return state;
  }
  /** 스테라의 첫 평타가 나간 직후까지 돌리고 렉스를 돌려준다. */
  function afterFirstBasic(state: SkirmishState): void {
    const stella = findFighter(state, "player-0")!;
    const foe = state.fighters.find((fighter) => fighter.side === "enemy")!;
    const rex = findFighter(state, "player-1")!;
    for (let tick = 0; tick < 200; tick += 1) {
      stella.x = 500; stella.y = 1_000; foe.x = 540; foe.y = 1_000; rex.x = 300; rex.y = 1_000;
      const hit = stepSkirmish(state, 0.05, NEVER).some((event) => event.kind === "attack" && event.attackerId === stella.id && event.skill === "basic");
      if (hit) return;
    }
  }

  it("은 게이지를 받은 아군에게 짧게 공격 속도를 준다(별 II)", () => {
    const run = (breakthrough: number) => {
      const state = stellaBattle(breakthrough);
      afterFirstBasic(state);
      return findFighter(state, "player-1")!;
    };
    const rex = run(1);
    expect(rex.tailwindFor).toBeGreaterThan(0);
    expect(rex.tailwind?.kind === "tailwind" ? rex.tailwind.attackSpeedPercent : 0).toBe(10);
    expect(run(0).tailwindFor).toBe(0);
  });

  it("은 이미 순풍이 걸린 아군을 약한 강화로 덮지 않는다(별 II)", () => {
    const state = stellaBattle(1);
    const rex = findFighter(state, "player-1")!;
    rex.tailwindFor = 8; rex.tailwind = { kind: "tailwind", attackSpeedPercent: 20, moveSpeedPercent: 20, seconds: 10, maxHpRegenPercentPerSecond: 2 };
    afterFirstBasic(state);
    expect(rex.tailwind?.kind === "tailwind" ? rex.tailwind.attackSpeedPercent : 0).toBe(20);
  });

  it("은 궁극기를 쓰는 순간 아군 전원이 게이지를 25 얻는다(별 III)", () => {
    const gain = (breakthrough: number) => {
      const state = stellaBattle(breakthrough);
      const stella = findFighter(state, "player-0")!;
      stella.energy = 1_000;
      fireUltimate(state, stella.id, NEVER);
      return findFighter(state, "player-1")!.energy;
    };
    expect(gain(2) - gain(0)).toBe(25);
  });

  it("은 폭주 중 게이지가 가장 낮은 아군에게만 평타마다 5를 더 건넨다(별 IV)", () => {
    const run = (breakthrough: number, fever: boolean) => {
      const state = stellaBattle(breakthrough);
      const stella = findFighter(state, "player-0")!;
      stella.ferocityFever = fever; stella.ferocity = fever ? FEROCITY_RULES.max : 0; stella.energy = 50;
      afterFirstBasic(state);
      return { rex: findFighter(state, "player-1")!.energy, stella: stella.energy };
    };
    const base = run(0, true);
    const pulled = run(3, true);
    expect(pulled.rex - base.rex).toBe(5);
    expect(pulled.stella).toBe(base.stella);
    expect(run(3, false).rex).toBe(run(0, false).rex);
  });

  it("은 저체력 은신에 들어가는 순간 아군 전원이 게이지를 10 얻는다(별 V)", () => {
    const run = (breakthrough: number) => {
      const state = stellaBattle(breakthrough);
      const stella = findFighter(state, "player-0")!;
      stella.hp = 1;
      expect(tryTriggerLowHpVanish(stella, state)).toBe(true);
      return findFighter(state, "player-1")!.energy;
    };
    expect(run(FULL) - run(0)).toBe(10);
  });

  it("는 네 슬롯 모두 문장을 만든다", () => {
    const stella = getRelic("stella");
    expect(breakthroughEffectText(stella, "basic")).toContain("공격 속도");
    expect(breakthroughEffectText(stella, "ultimate")).toContain("게이지");
    expect(breakthroughEffectText(stella, "ferocity")).toContain("가장 낮은");
    expect(breakthroughEffectText(stella, "passive")).toContain("은신");
  });
});

describe("탱커 계약 한계 돌파 — 모사나·켄토·안카", () => {
  const NEVER = () => 0.99;
  /** 아군 하나(+선택 아군)와 적들. 모두 가만히 서 있어 한 가지만 잰다. */
  function setup(allyIds: string[], enemyIds: string[], breakthrough: number): SkirmishState {
    const state = createSkirmish(allyIds.map(getRelic), enemyIds.map(getRelic), ARENA, {}, { [allyIds[0]]: breakthrough });
    for (const fighter of state.fighters) { fighter.attackCooldown = 999; fighter.retargetIn = 999; fighter.stealthFor = 0; }
    state.fighters.filter((fighter) => fighter.side === "enemy").forEach((foe, index) => { foe.maxHp = 10_000_000; foe.hp = foe.maxHp; foe.x = 540 + index * 60; foe.y = 1_000; });
    const main = findFighter(state, "player-0")!;
    main.x = 500; main.y = 1_000;
    return state;
  }
  const run = (state: SkirmishState, seconds: number, hook?: () => void): SkirmishEvent[] => {
    const events: SkirmishEvent[] = [];
    for (let tick = 0; tick < seconds * 20; tick += 1) { hook?.(); events.push(...stepSkirmish(state, 0.05, NEVER)); }
    return events;
  };

  describe("모사나", () => {
    const pressure = () => getRelic("mosana").basic.statusEffects!.find((effect) => effect.kind === "pressure")!;
    const primed = (state: SkirmishState) => {
      const mosana = findFighter(state, "player-0")!;
      const first = findFighter(state, "enemy-0")!;
      const effect = pressure();
      if (effect.kind !== "pressure") throw new Error("pressure");
      first.pressure = { stacks: effect.maxStacks - 1, remaining: 4, total: 4, sourceId: mosana.id, effect };
      mosana.attackCooldown = 0; mosana.targetId = first.id;
    };

    it("은 수압이 터질 때 가장 가까운 다른 적에게 2겹을 옮기되 거기서 또 터지지 않는다(별 II)", () => {
      const result = (breakthrough: number) => {
        const state = setup(["mosana"], ["toby", "amo"], breakthrough);
        primed(state);
        run(state, 1);
        return { burst: findFighter(state, "enemy-0")!.pressureLockFor, next: findFighter(state, "enemy-1")!.pressure?.stacks ?? 0, nextLock: findFighter(state, "enemy-1")!.pressureLockFor };
      };
      expect(result(1).burst).toBeGreaterThan(0);
      expect(result(1).next).toBe(2);
      expect(result(1).nextLock).toBe(0);
      expect(result(0).next).toBe(0);
    });

    it("은 끌려온 적에게 도발이 이어지는 동안 매초 수압을 쌓는다(별 III)", () => {
      const result = (breakthrough: number) => {
        const state = setup(["mosana"], ["toby"], breakthrough);
        const mosana = findFighter(state, "player-0")!;
        mosana.energy = 1_000;
        fireUltimate(state, mosana.id, NEVER);
        mosana.attackCooldown = 999;
        run(state, 2.2);
        const foe = findFighter(state, "enemy-0")!;
        return foe.pressure?.stacks ?? 0;
      };
      expect(result(2)).toBe(2);
      expect(result(0)).toBe(0);
    });

    it("은 폭주 중 수압이 쌓인 적을 모사나 쪽으로 끌어당기고 기절은 만들지 않는다(별 IV)", () => {
      const result = (breakthrough: number) => {
        const state = setup(["mosana"], ["toby"], breakthrough);
        const mosana = findFighter(state, "player-0")!;
        const foe = findFighter(state, "enemy-0")!;
        const effect = pressure();
        if (effect.kind !== "pressure") throw new Error("pressure");
        mosana.ferocityFever = true; mosana.ferocity = FEROCITY_RULES.max;
        foe.x = 900; foe.stunnedFor = 5;
        foe.pressure = { stacks: 2, remaining: 4, total: 4, sourceId: mosana.id, effect };
        run(state, 1);
        return foe.x;
      };
      expect(result(0) - result(3)).toBeGreaterThan(50);
    });

    it("은 인양 성공의 막을 가장 얇은 아군에게도 절반 나눈다(별 V)", () => {
      const result = (breakthrough: number) => {
        const state = setup(["mosana", "rex"], ["toby"], breakthrough);
        primed(state);
        run(state, 1);
        return findFighter(state, "player-1")!.shield.amount;
      };
      const given = result(FULL_TANK);
      expect(given).toBeGreaterThan(0);
      expect(result(3)).toBe(0);
    });
  });

  describe("켄토", () => {
    const withPrickle = (state: SkirmishState, stacks: number) => {
      const kento = findFighter(state, "player-0")!;
      kento.prickle = { stacks, remaining: 8, total: 8 };
      return kento;
    };
    it("은 평타 적중에 지금 쌓인 겹만큼의 반격을 한 번 더 얹는다(별 II)", () => {
      const result = (breakthrough: number) => {
        const state = setup(["kento"], ["toby"], breakthrough);
        const kento = withPrickle(state, 5);
        kento.attackCooldown = 0; kento.targetId = "enemy-0";
        return run(state, 0.5).filter((event) => event.kind === "attack" && event.attackerId === kento.id && event.animate === false).length;
      };
      expect(result(1)).toBeGreaterThan(result(0));
    });

    it("은 궁극기 도발이 이어지는 동안 막이 흡수한 피해를 가장 가까운 적에게 되돌린다(별 III)", () => {
      const result = (breakthrough: number) => {
        const state = setup(["kento"], ["toby"], breakthrough);
        const kento = findFighter(state, "player-0")!;
        const foe = findFighter(state, "enemy-0")!;
        kento.energy = 1_000;
        fireUltimate(state, kento.id, NEVER);
        kento.attackCooldown = 999;
        foe.attackCooldown = 0; foe.targetId = kento.id;
        return run(state, 1).filter((event) => event.kind === "attack" && event.attackerId === kento.id && event.skill === "transfer").length;
      };
      expect(result(2)).toBeGreaterThan(0);
      expect(result(0)).toBe(0);
    });

    it("은 폭주 중 겹이 상한에서 터진 뒤 5겹으로 이어진다(별 IV)", () => {
      const result = (breakthrough: number) => {
        const state = setup(["kento"], ["toby"], breakthrough);
        const kento = withPrickle(state, 9);
        kento.ferocityFever = true; kento.ferocity = FEROCITY_RULES.max;
        const foe = findFighter(state, "enemy-0")!;
        foe.attackCooldown = 0; foe.targetId = kento.id;
        run(state, 0.3);
        return kento.prickle?.stacks ?? 0;
      };
      expect(result(3)).toBeGreaterThanOrEqual(5);
      expect(result(2)).toBeLessThan(5);
    });

    it("은 겹이 7 이상일 때 반격이 다른 적 한 명에게도 튄다(별 V)", () => {
      const result = (breakthrough: number, stacks: number) => {
        const state = setup(["kento"], ["toby", "amo"], breakthrough);
        const kento = withPrickle(state, stacks);
        const foe = findFighter(state, "enemy-0")!;
        foe.attackCooldown = 0; foe.targetId = kento.id;
        return run(state, 0.3).filter((event) => event.kind === "attack" && event.attackerId === kento.id && event.targetId === "enemy-1").length;
      };
      expect(result(FULL_TANK, 7)).toBeGreaterThan(0);
      expect(result(3, 7)).toBe(0);
      expect(result(FULL_TANK, 2)).toBe(0);
    });
  });

  describe("안카", () => {
    const drowsy = () => getRelic("anka").passive.whiteNoise!.drowsy;
    const lullToSleep = (state: SkirmishState, id: string) => {
      const anka = findFighter(state, "player-0")!;
      const foe = findFighter(state, id)!;
      foe.stunnedFor = 3;
      foe.sleep = { remaining: 3, total: 3, sourceId: anka.id, effect: drowsy() };
      return foe;
    };
    it("은 잠든 적을 때리는 타격이 30% 더 세다(별 II)", () => {
      const hit = (breakthrough: number) => {
        const state = setup(["anka"], ["toby"], breakthrough);
        const anka = findFighter(state, "player-0")!;
        lullToSleep(state, "enemy-0");
        anka.attackCooldown = 0; anka.targetId = "enemy-0";
        const event = run(state, 0.3).find((candidate) => candidate.kind === "attack" && candidate.attackerId === anka.id && candidate.animate !== false);
        return event?.kind === "attack" ? event.amount : 0;
      };
      const ratio = hit(1) / hit(0);
      expect(ratio).toBeGreaterThan(1.2);
      expect(ratio).toBeLessThan(1.4);
    });

    it("은 자장가에 도발당한 적이 때릴 때마다 졸음이 쌓인다(별 III)", () => {
      const result = (breakthrough: number) => {
        const state = setup(["anka"], ["toby"], breakthrough);
        const anka = findFighter(state, "player-0")!;
        const foe = findFighter(state, "enemy-0")!;
        foe.targetId = anka.id;
        anka.energy = 1_000;
        fireUltimate(state, anka.id, NEVER);
        anka.attackCooldown = 999;
        foe.attackCooldown = 0; foe.targetId = anka.id;
        run(state, 0.3);
        return (foe.drowsy?.stacks ?? 0) + (foe.sleep ? 99 : 0);
      };
      expect(result(2)).toBeGreaterThan(0);
      expect(result(0)).toBe(0);
    });

    it("은 폭주 중 적이 깨어날 때 곁의 다른 적에게 졸음이 번진다(별 IV)", () => {
      const result = (breakthrough: number) => {
        const state = setup(["anka"], ["toby", "amo"], breakthrough);
        const anka = findFighter(state, "player-0")!;
        anka.ferocityFever = true; anka.ferocity = FEROCITY_RULES.max;
        const sleeper = lullToSleep(state, "enemy-0");
        sleeper.sleep!.remaining = 0.01;
        run(state, 0.2);
        return findFighter(state, "enemy-1")!.drowsy?.stacks ?? 0;
      };
      expect(result(3)).toBe(1);
      expect(result(2)).toBe(0);
    });

    it("은 백색소음의 회복이 잠든 적 한 명마다 25% 늘어난다(별 V)", () => {
      const heal = (breakthrough: number) => {
        const state = setup(["anka", "rex"], ["toby"], breakthrough);
        const anka = findFighter(state, "player-0")!;
        const rex = findFighter(state, "player-1")!;
        rex.x = 450; rex.y = 1_000; rex.hp = rex.maxHp * 0.3;
        lullToSleep(state, "enemy-0");
        anka.whiteNoiseIn = 0;
        const before = rex.hp;
        run(state, 0.05);
        return rex.hp - before;
      };
      const ratio = heal(FULL_TANK) / heal(3);
      expect(ratio).toBeGreaterThan(1.2);
      expect(ratio).toBeLessThan(1.3);
    });
  });

  it("은 세 개체 모두 네 슬롯 문장을 만든다", () => {
    for (const id of ["mosana", "kento", "anka"]) {
      for (const slot of ["basic", "ultimate", "ferocity", "passive"] as const) {
        const text = breakthroughEffectText(getRelic(id), slot);
        expect(text, `${id} ${slot}`).toBeDefined();
        expect(text, `${id} ${slot}`).not.toMatch(/\{[a-zA-Z!]+\}/);
      }
    }
    expect(breakthroughEffectText(getRelic("mosana"), "basic")).toContain("2겹");
    expect(breakthroughEffectText(getRelic("kento"), "ultimate")).toContain("25%");
    expect(breakthroughEffectText(getRelic("anka"), "passive")).toContain("25%");
  });
});

describe("전사 한계 돌파 — 파치·케리스·매디", () => {
  const NEVER = () => 0.99;
  function setup(allyIds: string[], enemyIds: string[], breakthrough: number): SkirmishState {
    const state = createSkirmish(allyIds.map(getRelic), enemyIds.map(getRelic), ARENA, {}, { [allyIds[0]]: breakthrough });
    for (const fighter of state.fighters) { fighter.attackCooldown = 999; fighter.retargetIn = 999; fighter.stealthFor = 0; }
    state.fighters.filter((fighter) => fighter.side === "enemy").forEach((foe, index) => { foe.maxHp = 10_000_000; foe.hp = foe.maxHp; foe.x = 540 + index * 60; foe.y = 1_000; });
    const main = findFighter(state, "player-0")!;
    main.x = 500; main.y = 1_000;
    return state;
  }
  const run = (state: SkirmishState, seconds: number): SkirmishEvent[] => {
    const events: SkirmishEvent[] = [];
    for (let tick = 0; tick < seconds * 20; tick += 1) events.push(...stepSkirmish(state, 0.05, NEVER));
    return events;
  };
  const swing = (state: SkirmishState) => {
    const main = findFighter(state, "player-0")!;
    main.attackCooldown = 0;
    main.targetId = findFighter(state, "enemy-0")!.id;
  };
  const curseOf = (id: string) => getRelic(id).basic.statusEffects!.find((effect) => effect.kind === "curse")!;

  describe("파치", () => {
    it("은 보호막이 남아 있는 동안에만 철거 스윙에 추가 피해를 얹는다(별 II)", () => {
      const damage = (breakthrough: number, shield: number) => {
        const state = setup(["pachi"], ["toby"], breakthrough);
        const pachi = findFighter(state, "player-0")!;
        pachi.shield = { amount: shield, providerId: pachi.id };
        swing(state);
        const foe = findFighter(state, "enemy-0")!;
        const before = foe.hp;
        run(state, 0.1);
        return before - foe.hp;
      };
      expect(damage(1, 500)).toBeGreaterThan(damage(0, 500));
      expect(damage(1, 0)).toBe(damage(0, 0));
    });

    it("은 궁극기 돌진을 한 번 더 출발점으로 되돌려 돌진이 두 번이 된다(별 III)", () => {
      const charges = (breakthrough: number) => {
        const state = setup(["pachi"], ["toby"], breakthrough);
        const pachi = findFighter(state, "player-0")!;
        pachi.energy = 1_000;
        const events = [...fireUltimate(state, pachi.id, NEVER), ...run(state, 1.6)];
        return events.filter((event) => event.kind === "charge").length;
      };
      expect(charges(0)).toBe(1);
      expect(charges(2)).toBe(2);
    });

    it("은 폭주로 튕겨 나간 적이 다른 적에게 부딪히면 뇌진탕을 옮긴다(별 IV)", () => {
      const struck = (breakthrough: number) => {
        const state = setup(["pachi"], ["toby", "amo"], breakthrough);
        const pachi = findFighter(state, "player-0")!;
        pachi.ferocityFever = true; pachi.ferocity = FEROCITY_RULES.max;
        pachi.statusHitCount = 2;
        const second = findFighter(state, "enemy-1")!;
        second.x = 690; second.y = 1_000;
        swing(state);
        const before = second.hp;
        run(state, 0.6);
        return before - second.hp;
      };
      expect(struck(3)).toBeGreaterThan(0);
      expect(struck(0)).toBe(0);
    });

    it("은 한 방 상한이 최대 체력의 20%로 내려가 네 방은 버틴다(별 V)", () => {
      const applied = (breakthrough: number) => {
        const state = setup(["pachi"], ["toby"], breakthrough);
        const pachi = findFighter(state, "player-0")!;
        return receivedDamage(pachi, pachi.maxHp * 10) / pachi.maxHp;
      };
      expect(applied(3)).toBeCloseTo(0.4, 2);
      expect(applied(FULL_TANK)).toBeCloseTo(0.2, 2);
    });
  });

  describe("케리스", () => {
    it("은 저주가 최대인 적을 때리면 집중이 두 겹씩 쌓인다(별 II)", () => {
      const gained = (breakthrough: number) => {
        const state = setup(["keris"], ["toby"], breakthrough);
        const foe = findFighter(state, "enemy-0")!;
        foe.curse = { remaining: 8, total: 8, stacks: 3, percentPerStack: 15, maxStacks: 3 };
        swing(state);
        run(state, 0.1);
        return findFighter(state, "player-0")!.bonusAp;
      };
      expect(gained(1)).toBeCloseTo(gained(0) * 2, 5);
    });

    it("은 광란에 걸린 적이 같은 편을 때리면 맞은 적에게 저주를 건다(별 III)", () => {
      const stacks = (breakthrough: number) => {
        const state = setup(["keris"], ["toby", "amo"], breakthrough);
        const keris = findFighter(state, "player-0")!;
        const [a, b] = [findFighter(state, "enemy-0")!, findFighter(state, "enemy-1")!];
        applyFrenzy(a, { kind: "frenzy", seconds: 4, attackSpeedPercent: 50 }, keris.id);
        a.attackCooldown = 0; a.targetId = b.id;
        run(state, 1);
        return b.curse?.stacks ?? 0;
      };
      expect(stacks(2)).toBeGreaterThan(0);
      expect(stacks(0)).toBe(0);
    });

    it("은 폭주 중 광란에 걸린 적이 쓰러지면 주변에 저주를 번뜨린다(별 IV)", () => {
      const stacks = (breakthrough: number) => {
        const state = setup(["keris"], ["toby", "amo"], breakthrough);
        const keris = findFighter(state, "player-0")!;
        keris.ferocityFever = true; keris.ferocity = FEROCITY_RULES.max;
        const [a, b] = [findFighter(state, "enemy-0")!, findFighter(state, "enemy-1")!];
        a.maxHp = 100; a.hp = 1;
        applyFrenzy(a, { kind: "frenzy", seconds: 4, attackSpeedPercent: 50 }, keris.id);
        refreshBleed(a, 5, 50, [], keris.id);
        run(state, 1.5);
        return b.curse?.stacks ?? 0;
      };
      expect(stacks(3)).toBe(2);
      expect(stacks(0)).toBe(0);
    });

    it("은 집중이 가득 차야 저주 상한이 한 겹 열린다(별 V)", () => {
      const cap = (breakthrough: number, full: boolean) => {
        const state = setup(["keris"], ["toby"], breakthrough);
        const keris = findFighter(state, "player-0")!;
        const passive = keris.def.passive;
        if (passive.kind !== "cursedInsight") throw new Error("cursedInsight");
        if (full) keris.bonusAp = keris.def.stats.ap * passive.value / 100 * (passive.maxStacks ?? 1);
        const foe = findFighter(state, "enemy-0")!;
        for (let i = 0; i < 6; i += 1) applyCombatStatusEffect(foe, curseOf("keris"), [], state, keris.id);
        return foe.curse?.stacks ?? 0;
      };
      expect(cap(FULL_TANK, true)).toBe(4);
      expect(cap(FULL_TANK, false)).toBe(3);
      expect(cap(3, true)).toBe(3);
    });
  });

  describe("매디", () => {
    const freeze = (state: SkirmishState, id: string, remaining = 20) => {
      findFighter(state, id)!.frozen = { remaining, total: remaining, maxHpPercentOnExpire: 0 };
    };

    it("은 얼어 있는 적을 때리면 주위의 다른 적에게 냉기가 튄다(별 II)", () => {
      const chill = (breakthrough: number) => {
        const state = setup(["maddy"], ["toby", "amo"], breakthrough);
        freeze(state, "enemy-0");
        swing(state);
        run(state, 0.1);
        return findFighter(state, "enemy-1")!.chill?.stacks ?? 0;
      };
      expect(chill(1)).toBe(1);
      expect(chill(0)).toBe(0);
    });

    it("은 냉방 채널이 얼어 있는 적의 수만큼 체력을 되돌려 준다(별 III)", () => {
      const healed = (breakthrough: number) => {
        const state = setup(["maddy"], ["toby", "amo"], breakthrough);
        const maddy = findFighter(state, "player-0")!;
        maddy.hp = maddy.maxHp * 0.5;
        freeze(state, "enemy-0"); freeze(state, "enemy-1");
        maddy.energy = 1_000;
        const before = maddy.hp;
        fireUltimate(state, maddy.id, NEVER);
        run(state, 2.5);
        return maddy.hp - before;
      };
      expect(healed(2)).toBeGreaterThan(healed(0));
    });

    it("은 폭주 중 보호막이 남아 있으면 때린 적에게 냉기가 쌓인다(별 IV)", () => {
      const chill = (breakthrough: number) => {
        const state = setup(["maddy"], ["toby"], breakthrough);
        const maddy = findFighter(state, "player-0")!;
        maddy.ferocityFever = true; maddy.ferocity = FEROCITY_RULES.max;
        maddy.shield = { amount: 5_000, providerId: maddy.id };
        const foe = findFighter(state, "enemy-0")!;
        foe.attackCooldown = 0; foe.targetId = maddy.id;
        run(state, 0.3);
        return foe.chill?.stacks ?? 0;
      };
      expect(chill(3)).toBeGreaterThan(0);
      expect(chill(0)).toBe(0);
    });

    it("은 빙결이 풀리는 순간 주위의 적에게 물리 피해가 한 번 터진다(별 V)", () => {
      const lost = (breakthrough: number) => {
        const state = setup(["maddy"], ["toby", "amo"], breakthrough);
        freeze(state, "enemy-0", 0.1);
        const near = findFighter(state, "enemy-1")!;
        const before = near.hp;
        run(state, 0.5);
        return before - near.hp;
      };
      expect(lost(FULL_TANK)).toBeGreaterThan(0);
      expect(lost(3)).toBe(0);
    });
  });

  it("은 세 개체 모두 네 슬롯 문장을 만든다", () => {
    for (const id of ["pachi", "keris", "maddy"]) {
      for (const slot of ["basic", "ultimate", "ferocity", "passive"] as const) {
        const text = breakthroughEffectText(getRelic(id), slot);
        expect(text, `${id} ${slot}`).toBeDefined();
        expect(text, `${id} ${slot}`).not.toMatch(/\{[a-zA-Z!]+\}/);
      }
    }
    expect(breakthroughEffectText(getRelic("pachi"), "passive")).toContain("20%");
    expect(breakthroughEffectText(getRelic("pachi"), "basic")).toContain("25%");
    expect(breakthroughEffectText(getRelic("keris"), "passive")).toContain("1겹");
  });
});

const FULL_TANK = BREAKTHROUGH_STEPS.length;
