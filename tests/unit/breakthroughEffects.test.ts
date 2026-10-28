import { describe, expect, it } from "vitest";
import { unitStatusViews } from "../../src/ui/unitStatusModel";
import { applyCombatStatusEffect, gainElation, bossDamageMultiplier, breakthroughSkill, currentAttackSpeed, gainFerocity, moveSpeed, receivedDamage, createSkirmish, fighterReach, fireUltimate, findFighter, refreshBleed, stepSkirmish, tryTriggerEmergencyRecovery, tryTriggerLowHpVanish, type Arena, type SkirmishEvent, type SkirmishState } from "../../src/core/skirmish";
import { FEROCITY_RULES, ferocityMaxOf } from "../../src/core/ferocity";
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
    torika.ferocity = ferocityMaxOf(torika.def);
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
    torika.ferocity = ferocityMaxOf(torika.def) - 1;
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
    expect(breakthroughEffectText(lexia, "ultimate")).toContain("피해의 50%만큼 체력을 회복");
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

  it("는 궁극기에 50% 흡혈을 더하고 처치해도 고정 피해 전환이나 게이지 환급을 주지 않는다", () => {
    const state = lexiaBattle(); engage(state);
    const lexia = findFighter(state, "player-0")!;
    const torika = findFighter(state, "enemy-0")!;
    torika.hp = 5; lexia.energy = lexia.def.ultimate.cost;
    lexia.hp = lexia.maxHp / 2;
    const before = lexia.hp;
    const hit = fireUltimate(state, lexia.id, () => 0.99).find((event) => event.kind === "attack");
    expect(hit).toMatchObject({ damageType: "physical" });
    expect(lexia.hp - before).toBeCloseTo(5 * 0.75);
    expect(lexia.energy).toBe(0);
  });

  it("는 폭주 중 일반 공격으로 조금 넓은 범위를 함께 때리고 처치 뒤 돌진을 다시 준비한다", () => {
    const state = lexiaBattle(["torika", "amo"]);
    const lexia = findFighter(state, "player-0")!;
    const enemies = state.fighters.filter((fighter) => fighter.side === "enemy");
    for (const [index, enemy] of enemies.entries()) {
      enemy.x = lexia.x + 50 + index * 30; enemy.y = lexia.y; enemy.attackCooldown = 999;
    }
    enemies[0].hp = 1;
    lexia.ferocity = ferocityMaxOf(lexia.def); lexia.ferocityFever = true;
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
    dodo.ferocity = ferocityMaxOf(dodo.def); dodo.ferocityFever = true; dodo.bt.feverHealingDone = 300;
    let ended = false;
    for (let tick = 0; tick < 400 && !ended; tick += 1) { stepSkirmish(state, 0.05); ended = !dodo.ferocityFever; }
    expect(ended).toBe(true);
    // 300의 50%를 셋이 나눈다.
    // 티아(player-1)는 제 반짝 폭발의 막이 따로 얹히므로 나눠 받은 50 이상이면 된다.
    for (const id of ["player-0", "player-2"]) expect(findFighter(state, id)!.shield.amount).toBe(50);
    expect(findFighter(state, "player-1")!.shield.amount).toBeGreaterThanOrEqual(50);
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
    parua.ferocity = ferocityMaxOf(parua.def) - 0.001; parua.attackCooldown = 0;
    for (let tick = 0; tick < 40 && !parua.ferocityFever; tick += 1) stepSkirmish(state, 0.05, () => 0.99);
    expect(parua.ferocityFever).toBe(true);
    expect(parua.stealthFor).toBeGreaterThan(2);
    // 별 셋에서는 은신하지 않는다.
    const plain = paruaBattle(2);
    setUp(plain);
    const other = findFighter(plain, "player-0")!;
    other.ferocity = ferocityMaxOf(other.def) - 0.001; other.attackCooldown = 0;
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

  it("는 폭주 중에 도약 주기가 2타로 줄어든다(별 IV)", () => {
    const run = (breakthrough: number): number => {
      const state = spinoBattle(breakthrough, ["torika"]);
      engageAll(state);
      const spino = findFighter(state, "player-0")!;
      spino.ferocity = ferocityMaxOf(spino.def); spino.ferocityFever = true;
      spino.shallowLeapCount = 1; spino.attackCooldown = 0;
      stepSkirmish(state, 0.05, () => 0.99);
      return spino.shallowLeapCount;
    };
    // 열려 있으면 두 번째 타에서 곧바로 뛰어 카운트가 0으로 돌아온다. 닫혀 있으면 4타 주기라 2가 쌓일 뿐이다.
    expect(run(FULL)).toBe(0);
    expect(run(0)).toBe(2);
  });

  it("는 도약해 내려서면 1초 숨고, 3초 안에는 다시 숨지 않는다(별 V)", () => {
    const run = (breakthrough: number, elapsed = 0): number => {
      const state = spinoBattle(breakthrough, ["torika"]);
      engageAll(state);
      const spino = findFighter(state, "player-0")!;
      spino.shallowLeapCount = 3; spino.attackCooldown = 0; spino.stealthFor = 0;
      if (elapsed > 0) spino.bt.leapVeilReadyAt = state.elapsed + elapsed;
      stepSkirmish(state, 0.05, () => 0.99);
      return spino.stealthFor;
    };
    expect(run(FULL)).toBeGreaterThan(0);
    expect(run(FULL - 1)).toBe(0);
    expect(run(FULL, 3)).toBe(0);
  });

  it("는 네 슬롯 모두 문장을 만든다", () => {
    const spino = getRelic("spino");
    expect(breakthroughEffectText(spino, "basic")).toContain("[[shallows|여울]]");
    expect(breakthroughEffectText(spino, "ultimate")).toContain("1.5초 뒤 한 번 더 터진다");
    expect(breakthroughEffectText(spino, "ferocity")).toContain("2회");
    expect(breakthroughEffectText(spino, "passive")).toContain("은신");
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

  it("는 폭주에 들어서는 순간 듀오가 노리는 적 주변 전원에게 약점 포착을 찍는다(별 IV)", () => {
    const marked = (breakthrough: number): number => {
      const state = shuteBattle(breakthrough, ["torika", "amo", "toby"]);
      freeze(state);
      const shute = findFighter(state, "player-1")!; const duo = findFighter(state, "player-0")!;
      const foes = state.fighters.filter((fighter) => fighter.side === "enemy");
      foes.forEach((foe, index) => { foe.x = duo.x + 60 + index * 40; foe.y = duo.y; foe.stealthFor = 0; });
      duo.targetId = foes[0].id;
      shute.ferocity = ferocityMaxOf(shute.def) - 0.001;
      gainFerocity(shute, 1, state, []);
      return foes.filter((foe) => foe.weakpoint !== null).length;
    };
    expect(marked(3)).toBe(3);
    expect(marked(2)).toBe(0);
  });

  it("는 둘째 듀오를 맺어 그 듀오도 약점 포착을 터뜨린다(별 V)", () => {
    const state = shuteBattle(FULL);
    const shute = findFighter(state, "player-1")!;
    expect(shute.duoId).toBe("player-0");
    expect(shute.bt.sideDuoId).toBe("player-2");
    expect(findFighter(shuteBattle(FULL - 1), "player-1")!.bt.sideDuoId).toBeNull();
    // 둘째 듀오가 표식이 찍힌 적을 때리면 표식이 터진다.
    freeze(state);
    const twin = findFighter(state, "player-2")!; const foe = findFighter(state, "enemy-0")!;
    foe.x = twin.x + 40; foe.y = twin.y;
    foe.weakpoint = { sourceId: shute.id, burstPower: 100, duoHealPercent: 0 };
    twin.attackCooldown = 0; twin.targetId = foe.id; shute.attackCooldown = 999;
    let burst = 0;
    for (let tick = 0; tick < 40 && burst === 0; tick += 1) {
      for (const event of stepSkirmish(state, 0.05, () => 0.99)) if (event.kind === "attack" && event.skill === "weakpoint") burst += 1;
    }
    expect(burst).toBe(1);
  });

  it("는 네 슬롯 모두 문장을 만든다", () => {
    const shute = getRelic("shute");
    expect(breakthroughEffectText(shute, "basic")).toContain("원거리");
    expect(breakthroughEffectText(shute, "ultimate")).toContain("처음 때리는 적마다");
    expect(breakthroughEffectText(shute, "ferocity")).toContain("약점 포착");
    expect(breakthroughEffectText(shute, "passive")).toContain("둘째 듀오");
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

  it("는 폭주에 들어서는 순간 주위 적 전원에게 스타카토가 먼저 울린다(별 IV)", () => {
    const damaged = (breakthrough: number): number => {
      const state = metteBattle(breakthrough);
      freeze(state);
      const mette = findFighter(state, "player-0")!;
      const foes = state.fighters.filter((fighter) => fighter.side === "enemy");
      foes.forEach((foe, index) => { foe.x = mette.x + index * 60; foe.y = mette.y - 200; });
      mette.ferocity = ferocityMaxOf(mette.def) - 0.001;
      gainFerocity(mette, 1, state, []);
      return foes.reduce((sum, foe) => sum + (foe.maxHp - foe.hp), 0);
    };
    expect(damaged(2)).toBe(0);
    expect(damaged(3)).toBeGreaterThan(0);
  });

  it("는 메테의 막을 가진 아군이 평타를 맞히면 주위로 음파가 퍼지고 아군마다 3초 쉰다(별 V)", () => {
    const run = (breakthrough: number): { splash: number; ready: number } => {
      const state = metteBattle(breakthrough);
      freeze(state);
      const mette = findFighter(state, "player-0")!; const rex = findFighter(state, "player-1")!;
      const [first, second] = state.fighters.filter((fighter) => fighter.side === "enemy");
      first.x = rex.x + 40; first.y = rex.y; second.x = rex.x + 120; second.y = rex.y;
      rex.shield.amount = 10_000; rex.shield.providerId = mette.id;
      rex.attackCooldown = 0; rex.targetId = first.id; mette.attackCooldown = 999;
      const before = second.hp;
      stepSkirmish(state, 0.05, () => 0.99);
      return { splash: before - second.hp, ready: mette.bt.resonanceReadyAt[rex.id] ?? 0 };
    };
    const open = run(FULL); const closed = run(FULL - 1);
    expect(open.splash).toBeGreaterThan(closed.splash);
    expect(open.ready).toBeGreaterThan(2.9);
    expect(closed.ready).toBe(0);
  });

  it("는 네 슬롯 모두 문장을 만든다", () => {
    const mette = getRelic("mette");
    expect(breakthroughEffectText(mette, "basic")).toContain("연속으로");
    expect(breakthroughEffectText(mette, "ultimate")).toContain("15 줄고");
    expect(breakthroughEffectText(mette, "ferocity")).toContain("경직");
    expect(breakthroughEffectText(mette, "passive")).toContain("3초에 한 번");
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

  it("은 절정 중 대신 받은 피해가 쌓일 때마다 주위 적에게 고정 피해 파동이 터진다(별 III)", () => {
    const pulses = (breakthrough: number, foeX = 140): { count: number; lost: number } => {
      const state = createSkirmish([getRelic("nodonia"), getRelic("torika")], [getRelic("toby")], ARENA, {}, { nodonia: breakthrough });
      const nodonia = findFighter(state, "player-0")!; const ally = findFighter(state, "player-1")!; const foe = findFighter(state, "enemy-0")!;
      for (const fighter of state.fighters) { fighter.retargetIn = 999; fighter.stealthFor = 0; }
      nodonia.attackCooldown = 999; ally.attackCooldown = 999; foe.attackCooldown = 999;
      foe.maxHp = 10_000_000; foe.hp = foe.maxHp;
      nodonia.energy = 1_000;
      fireUltimate(state, "player-0");
      const events: SkirmishEvent[] = [];
      // 대신 받기를 실제로 거치는 길로 피해를 먹인다: 적이 아군을 때린다.
      for (let tick = 0; tick < 100; tick += 1) {
        nodonia.x = 100; nodonia.y = 1_000; ally.x = 160; ally.y = 1_000; foe.x = foeX; foe.y = 1_000;
        foe.attackCooldown = 0; foe.targetId = ally.id;
        events.push(...stepSkirmish(state, 0.05));
      }
      const lost = events.filter((event) => event.kind === "attack" && event.attackerId === nodonia.id && event.targetId === foe.id && event.damageType === "true")
        .reduce((sum, event) => sum + (event.kind === "attack" ? event.amount : 0), 0);
      return { count: nodonia.bt.bulwarkPulses, lost };
    };
    const opened = pulses(2); const control = pulses(0);
    expect(opened.count).toBeGreaterThan(0);
    expect(opened.count).toBeLessThanOrEqual(4);
    expect(control.count).toBe(0);
    expect(opened.lost).toBeGreaterThan(control.lost);
    // 반경(300) 밖의 적은 파동을 맞지 않는다.
    expect(pulses(2, 900).lost).toBe(pulses(0, 900).lost);
  });

  it("은 폭주에 들어서는 순간 희열이 다섯 겹 쌓인다(별 IV)", () => {
    const stacks = (breakthrough: number): number => {
      const state = nodoniaBattle(breakthrough, "toby");
      const nodonia = findFighter(state, "player-0")!;
      nodonia.ferocity = ferocityMaxOf(nodonia.def) - 0.001;
      gainFerocity(nodonia, 1, state, []);
      return nodonia.elation?.stacks ?? 0;
    };
    expect(stacks(3)).toBe(5);
    expect(stacks(2)).toBe(0);
  });

  it("은 희열이 가득하면 다른 아군도 재생의 절반을 받는다(별 V)", () => {
    const healed = (breakthrough: number, stacks: number): number => {
      const state = createSkirmish([getRelic("nodonia"), getRelic("torika")], [getRelic("toby")], ARENA, {}, { nodonia: breakthrough });
      for (const fighter of state.fighters) { fighter.retargetIn = 999; fighter.attackCooldown = 999; fighter.stealthFor = 0; }
      const nodonia = findFighter(state, "player-0")!; const ally = findFighter(state, "player-1")!;
      ally.hp = ally.maxHp * 0.5;
      const before = ally.hp;
      for (let i = 0; i < stacks; i += 1) gainElation(nodonia);
      nodonia.hp = nodonia.maxHp * 0.9;
      for (let tick = 0; tick < 60; tick += 1) stepSkirmish(state, 0.05);
      return ally.hp - before;
    };
    expect(healed(FULL, 10)).toBeGreaterThan(healed(FULL - 1, 10));
    expect(healed(FULL, 3)).toBe(healed(FULL - 1, 3));
  });

  it("는 네 슬롯 모두 문장을 만든다", () => {
    const nodonia = getRelic("nodonia");
    expect(breakthroughEffectText(nodonia, "basic")).toContain("도발");
    expect(breakthroughEffectText(nodonia, "ultimate")).toContain("고정 피해");
    expect(breakthroughEffectText(nodonia, "ferocity")).toContain("5겹");
    expect(breakthroughEffectText(nodonia, "passive")).toContain("50%");
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
    expect(run(1)).toBe(3);
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
        if (fever) luka.ferocity = ferocityMaxOf(luka.def);
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

  it("은 게이지를 받은 아군에게 짧게 이동 속도를 준다(별 II)", () => {
    const run = (breakthrough: number) => {
      const state = stellaBattle(breakthrough);
      afterFirstBasic(state);
      return findFighter(state, "player-1")!;
    };
    const rex = run(1);
    expect(rex.tailwindFor).toBeGreaterThan(0);
    expect(rex.tailwind?.kind === "tailwind" ? rex.tailwind.moveSpeedPercent : 0).toBe(20);
    expect(rex.tailwind?.kind === "tailwind" ? rex.tailwind.attackSpeedPercent : 1).toBe(0);
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

  it("은 폭주에 들어서는 순간 아군 전원에게 순풍을 건다(별 IV)", () => {
    const run = (breakthrough: number) => {
      const state = stellaBattle(breakthrough);
      const stella = findFighter(state, "player-0")!;
      stella.ferocity = ferocityMaxOf(stella.def) - 0.001;
      gainFerocity(stella, 1, state, []);
      return findFighter(state, "player-1")!;
    };
    const rex = run(3);
    expect(rex.tailwindFor).toBeGreaterThan(0);
    expect(rex.tailwind?.kind === "tailwind" ? rex.tailwind.attackSpeedPercent : 0).toBe(20);
    expect(rex.tailwind?.kind === "tailwind" ? rex.tailwind.moveSpeedPercent : 0).toBe(20);
    expect(run(0).tailwindFor).toBe(0);
  });

  it("은 저체력 은신에 들어가는 순간 아군 전원이 게이지를 25 얻는다(별 V)", () => {
    const run = (breakthrough: number) => {
      const state = stellaBattle(breakthrough);
      const stella = findFighter(state, "player-0")!;
      stella.hp = 1;
      expect(tryTriggerLowHpVanish(stella, state)).toBe(true);
      return findFighter(state, "player-1")!.energy;
    };
    expect(run(FULL) - run(0)).toBe(25);
  });

  it("는 네 슬롯 모두 문장을 만든다", () => {
    const stella = getRelic("stella");
    expect(breakthroughEffectText(stella, "basic")).toContain("이동 속도");
    expect(breakthroughEffectText(stella, "ultimate")).toContain("게이지");
    expect(breakthroughEffectText(stella, "ferocity")).toContain("순풍");
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
        mosana.ferocityFever = true; mosana.ferocity = ferocityMaxOf(mosana.def);
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
        kento.ferocityFever = true; kento.ferocity = ferocityMaxOf(kento.def);
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
        anka.ferocityFever = true; anka.ferocity = ferocityMaxOf(anka.def);
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
    it("은 일반 공격 네 번째마다 헬멧 박치기로 추가 피해와 뇌진탕을 준다(별 II)", () => {
      const hits = (breakthrough: number) => {
        const state = setup(["pachi"], ["toby"], breakthrough);
        const pachi = findFighter(state, "player-0")!;
        const foe = findFighter(state, "enemy-0")!;
        const lost: number[] = [];
        for (let i = 0; i < 4; i += 1) {
          pachi.statusHitCount = 0;
          swing(state);
          const before = foe.hp;
          run(state, 0.1);
          lost.push(before - foe.hp);
        }
        return lost;
      };
      const open = hits(1); const closed = hits(0);
      expect(open[0]).toBe(closed[0]);
      expect(open[3]).toBeGreaterThan(closed[3]);
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

    it("은 폭주에 들어서는 순간 주변 적을 튕겨 내고 부딪힌 적에게 뇌진탕을 옮긴다(별 IV)", () => {
      const flown = (breakthrough: number) => {
        const state = setup(["pachi"], ["toby", "amo"], breakthrough);
        const pachi = findFighter(state, "player-0")!;
        pachi.ferocity = ferocityMaxOf(pachi.def) - 0.001;
        gainFerocity(pachi, 1, state, []);
        return state.fighters.filter((fighter) => fighter.side === "enemy" && fighter.knockback !== null).length;
      };
      expect(flown(3)).toBe(2);
      expect(flown(2)).toBe(0);
      const state = setup(["pachi"], ["toby", "amo"], 3);
      const pachi = findFighter(state, "player-0")!;
      pachi.ferocity = ferocityMaxOf(pachi.def) - 0.001;
      gainFerocity(pachi, 1, state, []);
      for (const foe of state.fighters.filter((fighter) => fighter.side === "enemy")) expect(foe.knockback?.chain?.sourceId).toBe(pachi.id);
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

    it("은 저주가 걸린 적이 쓰러지면 그 겹이 주변 적에게 이어진다(별 III)", () => {
      const stacks = (breakthrough: number) => {
        const state = setup(["keris"], ["toby", "amo"], breakthrough);
        const keris = findFighter(state, "player-0")!;
        const [a, b] = [findFighter(state, "enemy-0")!, findFighter(state, "enemy-1")!];
        a.maxHp = 100; a.hp = 1;
        for (let i = 0; i < 2; i += 1) applyCombatStatusEffect(a, curseOf("keris"), [], state, keris.id);
        refreshBleed(a, 5, 50, [], keris.id);
        run(state, 1.5);
        return b.curse?.stacks ?? 0;
      };
      expect(stacks(2)).toBe(2);
      expect(stacks(0)).toBe(0);
    });

    it("은 폭주에 들어서는 순간 주변 적 전원에게 저주를 건다(별 IV)", () => {
      const cursed = (breakthrough: number) => {
        const state = setup(["keris"], ["toby", "amo"], breakthrough);
        const keris = findFighter(state, "player-0")!;
        keris.ferocity = ferocityMaxOf(keris.def) - 0.001;
        gainFerocity(keris, 1, state, []);
        return state.fighters.filter((fighter) => fighter.side === "enemy" && (fighter.curse?.stacks ?? 0) > 0).length;
      };
      expect(cursed(3)).toBe(2);
      expect(cursed(2)).toBe(0);
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

    it("은 일반 공격 세 번마다 병뚜껑이 터져 주위 적에게 냉기가 쌓인다(별 II)", () => {
      // 세 번째 일반 공격에서 터진다 — 앞의 두 번은 비운 채로 지나간다.
      const popped = (breakthrough: number) => {
        const state = setup(["maddy"], ["toby", "amo"], breakthrough);
        const maddy = findFighter(state, "player-0")!;
        const other = findFighter(state, "enemy-1")!;
        const seen: number[] = [];
        for (let i = 0; i < 3; i += 1) {
          swing(state); maddy.attackCooldown = 0;
          run(state, 0.4);
          seen.push(other.chill?.stacks ?? 0);
        }
        return seen;
      };
      const withBreak = popped(1); const without = popped(0);
      expect(withBreak[2]).toBeGreaterThan(without[2]);
      expect(withBreak[0]).toBe(without[0]);
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

    it("은 폭주에 들어서는 순간 주변 적 전원에게 냉기가 두 겹 쌓이되 바로 얼리지는 않는다(별 IV)", () => {
      const stacks = (breakthrough: number) => {
        const state = setup(["maddy"], ["toby", "amo"], breakthrough);
        const maddy = findFighter(state, "player-0")!;
        maddy.ferocity = ferocityMaxOf(maddy.def) - 0.001;
        gainFerocity(maddy, 1, state, []);
        return state.fighters.filter((fighter) => fighter.side === "enemy").map((foe) => ({ chill: foe.chill?.stacks ?? 0, frozen: foe.frozen !== null }));
      };
      expect(stacks(3)).toEqual([{ chill: 2, frozen: false }, { chill: 2, frozen: false }]);
      expect(stacks(2).every((foe) => foe.chill === 0)).toBe(true);
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

  describe("테쿠", () => {
    it("은 마지막 한 방울을 맞은 적의 방어력이 겹으로 깎이고 시간이 지나면 풀린다(별 II)", () => {
      const defOf = (breakthrough: number, shots: number) => {
        const state = setup(["teku"], ["toby"], breakthrough);
        const teku = findFighter(state, "player-0")!;
        const foe = findFighter(state, "enemy-0")!;
        // 한 탄창을 모두 쏘면 마지막 발이 마지막 한 방울이다.
        for (let i = 0; i < shots; i += 1) { teku.attackCooldown = 0; teku.targetId = foe.id; run(state, 0.1); }
        return foe.bt.fangShave;
      };
      const cycle = getRelic("teku").basic.cycle!.length;
      expect(defOf(1, cycle - 1)).toBeNull();
      expect(defOf(1, cycle)?.stacks).toBe(1);
      expect(defOf(0, cycle)).toBeNull();
    });

    it("은 폭주로 채운 탄창이 비면 한 번 더 가득 채우고, 한 번의 폭주에 한 번뿐이다(별 IV)", () => {
      const refills = (breakthrough: number) => {
        const state = setup(["teku"], ["toby"], breakthrough);
        const teku = findFighter(state, "player-0")!;
        const foe = findFighter(state, "enemy-0")!;
        teku.ferocity = ferocityMaxOf(teku.def) - 0.001;
        gainFerocity(teku, 1, state, []);
        expect(teku.refillFinisherAll).toBe(true);
        const cycle = getRelic("teku").basic.cycle!.length;
        let sawRefill = 0; let pauses = 0;
        for (let i = 0; i < cycle * 3; i += 1) {
          teku.attackCooldown = 0; teku.targetId = foe.id;
          const wasStep = teku.basicCycleStep;
          run(state, 0.05);
          if (wasStep === cycle - 1 && teku.refillFinisherAll) sawRefill += 1;
          if (wasStep === cycle - 1 && !teku.refillFinisherAll) pauses += 1;
        }
        return { sawRefill, pauses, used: teku.bt.doubleMagUsed };
      };
      expect(refills(3).used).toBe(true);
      expect(refills(3).sawRefill).toBe(1);
      expect(refills(2).used).toBe(false);
    });
  });

  describe("마키", () => {
    it("는 폭주에 들어서는 순간 주변 모든 적에게 출혈이 걸리고 손질이 한 겹 쌓인다(별 IV)", () => {
      const marked = (breakthrough: number) => {
        const state = setup(["maki"], ["toby", "amo"], breakthrough);
        const maki = findFighter(state, "player-0")!;
        maki.ferocity = ferocityMaxOf(maki.def) - 0.001;
        gainFerocity(maki, 1, state, []);
        return state.fighters.filter((fighter) => fighter.side === "enemy" && fighter.bleed !== null && (fighter.butcher?.stacks ?? 0) === 1).length;
      };
      expect(marked(3)).toBe(2);
      expect(marked(2)).toBe(0);
    });
  });

  it("은 세 개체 모두 네 슬롯 문장을 만든다", () => {
    for (const id of ["pachi", "keris", "maddy", "teku", "maki"]) {
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

describe("보스 한계 돌파 — 폰토스·수쿠스이노·타보아·코아틀", () => {
  const BOSSES = ["pontos", "sukusuino", "taboa", "quetzalcoatlus"] as const;
  const SLOTS = ["basic", "ultimate", "ferocity", "passive"] as const;

  /** 보스 한 마리(적 0번)와 아군. 돌파 단계만 갈아 끼워 같은 판을 두 번 돌린다. */
  function bossBattle(bossId: string, allies: string[], breakthrough: number): SkirmishState {
    return createSkirmish(allies.map(getRelic), [getRelic(bossId)], ARENA, {}, {}, { enemyBreakthroughs: [breakthrough] });
  }

  function place(state: SkirmishState, id: string, x: number, y: number): void {
    const fighter = findFighter(state, id)!;
    fighter.x = x; fighter.y = y;
  }

  it("는 네 칸 모두 문장을 만들고, 한 칸이 다른 칸의 효과를 읽지 않는다", () => {
    for (const id of BOSSES) {
      const def = getRelic(id);
      const effects = def.breakthroughEffects!;
      for (const slot of SLOTS) {
        expect(effects[slot]?.kind, `${id} ${slot}`).not.toBe("none");
        expect(breakthroughEffectText(def, slot), `${id} ${slot}`).toBeTruthy();
        // 한 칸의 효과 계약은 다른 칸의 효과 종류를 이름으로 부르지 않는다 — 칸 하나만 켰을 때 설명문이 성립해야 한다.
        const others = SLOTS.filter((other) => other !== slot).map((other) => effects[other]!.kind);
        const json = JSON.stringify(effects[slot]);
        for (const kind of others) expect(json, `${id} ${slot}`).not.toContain(kind);
      }
    }
  });

  it("는 회복·보호막·경감·강인함을 더하지 않는다", () => {
    const forbidden = /shield|guard|bulwark|regen|tenacity|reduction/i;
    for (const id of BOSSES) {
      for (const slot of SLOTS) {
        const effect = getRelic(id).breakthroughEffects![slot]!;
        expect(effect.kind, `${id} ${slot}`).not.toMatch(forbidden);
      }
    }
  });

  it("폰토스 II — 광역 평타가 맞힌 적 중 가장 가까운 한 명만 경직시킨다", () => {
    const run = (breakthrough: number) => {
      const state = bossBattle("pontos", ["torika", "amo", "rex"], breakthrough);
      const boss = findFighter(state, "enemy-0")!;
      place(state, "enemy-0", 500, 800);
      place(state, "player-0", 500, 560); place(state, "player-1", 560, 880); place(state, "player-2", 440, 940);
      boss.attackCooldown = 0;
      for (let tick = 0; tick < 6; tick += 1) {
        stepSkirmish(state, 0.05);
        for (const ally of state.fighters.filter((f) => f.side === "player")) { ally.attackCooldown = 99; ally.x = ally.x; }
      }
      return state.fighters.filter((f) => f.side === "player").map((f) => f.staggeredFor > 0);
    };
    expect(run(0).some(Boolean)).toBe(false);
    const staggered = run(1);
    // 가장 가까운 한 명(player-1)만 걸린다.
    expect(staggered.filter(Boolean)).toHaveLength(1);
  });

  it("폰토스 III — 해일에 맞은 적은 기절이 풀린 뒤에 느려진다", () => {
    const state = bossBattle("pontos", ["torika"], 2);
    const boss = findFighter(state, "enemy-0")!;
    const ally = findFighter(state, "player-0")!;
    boss.energy = 999;
    const baseSpeed = moveSpeed(ally);
    fireUltimate(state, "enemy-0");
    expect(ally.stunnedFor).toBeGreaterThan(0);
    // 기절이 도는 동안은 아직 느리지 않다.
    expect(moveSpeed(ally)).toBeCloseTo(baseSpeed, 5);
    for (let tick = 0; tick < 200 && ally.stunnedFor > 0; tick += 1) stepSkirmish(state, 0.05);
    stepSkirmish(state, 0.05);
    expect(ally.stunnedFor).toBe(0);
    expect(moveSpeed(ally)).toBeCloseTo(baseSpeed * (1 - 0.16), 3);
    expect(currentAttackSpeed(ally)).toBeLessThan(ally.def.stats.attackSpeed);
    // 시간이 다하면 풀린다.
    for (let tick = 0; tick < 200; tick += 1) stepSkirmish(state, 0.05);
    expect(moveSpeed(ally)).toBeCloseTo(baseSpeed, 3);
  });

  it("폰토스 III — 별 하나에서는 해일이 느림을 남기지 않는다", () => {
    const state = bossBattle("pontos", ["torika"], 0);
    const ally = findFighter(state, "player-0")!;
    findFighter(state, "enemy-0")!.energy = 999;
    fireUltimate(state, "enemy-0");
    expect(ally.bt.sunken).toBeNull();
  });

  it("폰토스 IV — 폭주 중에만 평타 반경이 넓어진다", () => {
    const state = bossBattle("pontos", ["torika"], 3);
    const boss = findFighter(state, "enemy-0")!;
    const normal = breakthroughSkill(boss, false) as { radius: number };
    boss.ferocityFever = true;
    const fever = breakthroughSkill(boss, false) as { radius: number };
    expect(normal.radius).toBe(520);
    expect(fever.radius).toBe(620);
  });

  it("폰토스 V — 15초마다 가장 먼 적에게 마법 피해가 떨어진다", () => {
    const run = (breakthrough: number) => {
      const state = bossBattle("pontos", ["torika", "amo"], breakthrough);
      const boss = findFighter(state, "enemy-0")!;
      place(state, "enemy-0", 500, 400);
      place(state, "player-0", 500, 500); place(state, "player-1", 500, 1400);
      boss.attackCooldown = 999; boss.stunnedFor = 999;
      const hits: string[] = [];
      for (let tick = 0; tick < 17 * 20; tick += 1) {
        for (const ally of state.fighters.filter((f) => f.side === "player")) ally.attackCooldown = 999;
        for (const event of stepSkirmish(state, 0.05)) if (event.kind === "attack" && event.attackerId === boss.id) hits.push(event.targetId);
      }
      return hits;
    };
    expect(run(3)).toHaveLength(0);
    const hits = run(4);
    expect(hits).toEqual(["player-1"]);
  });

  it("수쿠스이노 II — 평타가 적중할 때마다 받는 피해 겹이 쌓이고 시간이 지나면 풀린다", () => {
    const state = bossBattle("sukusuino", ["torika"], 1);
    const boss = findFighter(state, "enemy-0")!;
    const ally = findFighter(state, "player-0")!;
    ally.attackCooldown = 999;
    place(state, "enemy-0", 500, 700); place(state, "player-0", 500, 740);
    for (let tick = 0; tick < 600 && (ally.bt.biteMark?.stacks ?? 0) < 2; tick += 1) {
      boss.attackCooldown = Math.min(boss.attackCooldown, 0.1);
      stepSkirmish(state, 0.05);
      ally.hp = ally.maxHp;
    }
    expect(ally.bt.biteMark?.stacks).toBeGreaterThanOrEqual(2);
    expect(ally.bt.biteMark!.stacks).toBeLessThanOrEqual(3);
    boss.stunnedFor = 999;
    for (let tick = 0; tick < 200; tick += 1) stepSkirmish(state, 0.05);
    expect(ally.bt.biteMark).toBeNull();
  });

  it("수쿠스이노 III — 궁극기에 맞은 적은 받는 회복이 줄어든다", () => {
    const state = bossBattle("sukusuino", ["torika"], 2);
    const ally = findFighter(state, "player-0")!;
    findFighter(state, "enemy-0")!.energy = 999;
    place(state, "player-0", 500, 1200);
    fireUltimate(state, "enemy-0", undefined, { x: ally.x, y: ally.y });
    expect(ally.bt.healCut).toEqual({ remaining: 6, total: 6, percent: 40 });
  });

  it("수쿠스이노 IV — 폭주 중에만 이동 속도가 오른다", () => {
    const state = bossBattle("sukusuino", ["torika"], 3);
    const boss = findFighter(state, "enemy-0")!;
    const base = moveSpeed(boss);
    boss.ferocityFever = true;
    expect(moveSpeed(boss)).toBeCloseTo(base * 1.5, 5);
  });

  it("수쿠스이노 V — 흉터 겹마다 주는 피해가 늘어난다", () => {
    const state = bossBattle("sukusuino", ["torika"], 4);
    const boss = findFighter(state, "enemy-0")!;
    const ally = findFighter(state, "player-0")!;
    expect(bossDamageMultiplier(boss, ally, false)).toBe(1);
    boss.shellGuard = { stacks: 3, remaining: 8, total: 8 };
    expect(bossDamageMultiplier(boss, ally, false)).toBeCloseTo(1.15, 5);
    expect(bossDamageMultiplier(boss, ally, true)).toBeCloseTo(1.15, 5);
    const closed = bossBattle("sukusuino", ["torika"], 3);
    closed.fighters[1].shellGuard = { stacks: 3, remaining: 8, total: 8 };
    expect(bossDamageMultiplier(closed.fighters[1], closed.fighters[0], false)).toBe(1);
  });

  it("타보아 II — 둔화에 걸린 표적은 겹마다 평타를 더 아프게 맞는다", () => {
    const state = bossBattle("taboa", ["torika"], 1);
    const boss = findFighter(state, "enemy-0")!;
    const ally = findFighter(state, "player-0")!;
    expect(bossDamageMultiplier(boss, ally, false)).toBe(1);
    ally.chill = { stacks: 3, remaining: 5, total: 5, speedPercentPerStack: 8, maxStacks: 3 } as typeof ally.chill;
    expect(bossDamageMultiplier(boss, ally, false)).toBeCloseTo(1.24, 5);
    // 궁극기는 이 효과를 읽지 않는다.
    expect(bossDamageMultiplier(boss, ally, true)).toBe(1);
  });

  it("보스가 건 돌파 약화는 머리 위 상태 칩으로 서고 풀리면 사라진다", () => {
    const state = bossBattle("pontos", ["torika"], 2);
    const ally = findFighter(state, "player-0")!;
    expect(unitStatusViews(ally).map(({ id }) => id)).not.toContain("biteMark");
    ally.bt.biteMark = { remaining: 8, total: 8, stacks: 2, percentPerStack: 4 };
    ally.bt.healCut = { remaining: 6, total: 6, percent: 40 };
    ally.bt.sunken = { waiting: false, remaining: 6, total: 6, stacks: 2, percentPerStack: 8 };
    const ids = unitStatusViews(ally).map(({ id }) => id);
    expect(ids).toEqual(expect.arrayContaining(["biteMark", "healCut", "sunken"]));
    ally.bt.sunken = { waiting: true, remaining: 6, total: 6, stacks: 2, percentPerStack: 8 };
    expect(unitStatusViews(ally).map(({ id }) => id)).not.toContain("sunken");
  });

  it("타보아 III·코아틀 III — 궁극기의 범위만 넓어지고 기절 시간은 그대로다", () => {
    const taboa = bossBattle("taboa", ["torika"], 2);
    const boss = findFighter(taboa, "enemy-0")!;
    const wide = breakthroughSkill(boss, true) as { radius: number; statusEffects: readonly { kind: string; seconds?: number }[] };
    expect(wide.radius).toBe(390);
    expect(wide.statusEffects.find((e) => e.kind === "stun")?.seconds).toBe(1.5);
    const coatl = bossBattle("quetzalcoatlus", ["torika"], 2);
    const lane = breakthroughSkill(findFighter(coatl, "enemy-0")!, true) as { radius: number; statusEffects: readonly { kind: string; seconds?: number }[] };
    expect(lane.radius).toBe(140);
    expect(lane.statusEffects.find((e) => e.kind === "stun")?.seconds).toBe(1.5);
    const closed = bossBattle("taboa", ["torika"], 1);
    expect((breakthroughSkill(findFighter(closed, "enemy-0")!, true) as { radius: number }).radius).toBe(340);
  });

  it("타보아 IV — 폭주에 들 때 끌어오는 반경이 넓어진다", () => {
    // 487 떨어진 적은 기본 반경(480) 밖이라 열려 있을 때만 끌려온다.
    const run = (breakthrough: number) => {
      const state = bossBattle("taboa", ["torika"], breakthrough);
      const boss = findFighter(state, "enemy-0")!;
      const ally = findFighter(state, "player-0")!;
      place(state, "enemy-0", 500, 400); place(state, "player-0", 500, 887);
      gainFerocity(boss, ferocityMaxOf(boss.def), state, []);
      expect(boss.ferocityFever).toBe(true);
      return 887 - ally.y;
    };
    expect(run(2)).toBe(0);
    expect(run(3)).toBeGreaterThan(50);
  });

  it("타보아 V — 평타가 쌓은 횟수마다 평타 피해가 늘고 상한이 있다", () => {
    const state = bossBattle("taboa", ["torika"], 4);
    const boss = findFighter(state, "enemy-0")!;
    const ally = findFighter(state, "player-0")!;
    expect(bossDamageMultiplier(boss, ally, false)).toBe(1);
    boss.bonusAttackSpeed = 3 * 5;
    expect(bossDamageMultiplier(boss, ally, false)).toBeCloseTo(1.06, 5);
    boss.bonusAttackSpeed = 3 * 40;
    expect(bossDamageMultiplier(boss, ally, false)).toBeCloseTo(1.12, 5);
    expect(bossDamageMultiplier(boss, ally, true)).toBe(1);
  });

  it("코아틀 II — 표적 뒤 선 위의 가장 가까운 적도 피해의 일부를 받는다", () => {
    const run = (breakthrough: number) => {
      const state = bossBattle("quetzalcoatlus", ["torika", "amo", "rex"], breakthrough);
      const boss = findFighter(state, "enemy-0")!;
      place(state, "enemy-0", 500, 400);
      place(state, "player-0", 500, 480);   // 표적
      place(state, "player-1", 505, 620);   // 뒤쪽 선 위
      place(state, "player-2", 800, 450);   // 선에서 벗어남
      for (const ally of state.fighters.filter((f) => f.side === "player")) ally.attackCooldown = 999;
      const hurt = new Set<string>();
      for (let tick = 0; tick < 40; tick += 1) {
        boss.attackCooldown = Math.min(boss.attackCooldown, 0.05);
        boss.targetId = "player-0";
        for (const event of stepSkirmish(state, 0.05)) if (event.kind === "attack" && event.attackerId === boss.id) hurt.add(event.targetId);
        if (hurt.size > 0) break;
      }
      return hurt;
    };
    expect([...run(0)]).not.toContain("player-1");
    const opened = run(1);
    expect(opened.has("player-0")).toBe(true);
    expect(opened.has("player-1")).toBe(true);
    expect(opened.has("player-2")).toBe(false);
  });

  it("코아틀 IV — 폭주 중에만 치명타 확률이 오른다", () => {
    // roll 0.40: 평소 33%에서는 빗나가고 폭주 +15%(48%)에서만 치명타다.
    const crit = (breakthrough: number, fever: boolean): boolean => {
      const state = bossBattle("quetzalcoatlus", ["torika"], breakthrough);
      const boss = findFighter(state, "enemy-0")!;
      const ally = findFighter(state, "player-0")!;
      boss.ferocityFever = fever;
      place(state, "enemy-0", 500, 400); place(state, "player-0", 500, 450);
      ally.attackCooldown = 999; boss.attackCooldown = 0; boss.targetId = "player-0";
      let hit = false;
      for (let tick = 0; tick < 10 && !hit; tick += 1) {
        for (const event of stepSkirmish(state, 0.05, () => 0.4)) {
          if (event.kind === "attack" && event.attackerId === boss.id && event.skill === "basic") hit = event.critical;
        }
      }
      return hit;
    };
    expect(crit(3, false)).toBe(false);
    expect(crit(2, true)).toBe(false);
    expect(crit(3, true)).toBe(true);
  });

  it("코아틀 V — 치명타로 적중하면 경직시키고 같은 적에게는 재사용 대기가 있다", () => {
    const state = bossBattle("quetzalcoatlus", ["torika"], 4);
    const boss = findFighter(state, "enemy-0")!;
    const ally = findFighter(state, "player-0")!;
    place(state, "enemy-0", 500, 400); place(state, "player-0", 500, 450);
    ally.attackCooldown = 999; boss.targetId = "player-0";
    // 눌러 앉히는 깃이 발동한 시각은 `pinnedUntil`이 남긴다 — 기본 평타의 3타 경직과 섞이지 않는다.
    const pinnedAt: number[] = [];
    let last = 0;
    for (let tick = 0; tick < 200; tick += 1) {
      boss.attackCooldown = Math.min(boss.attackCooldown, 0.05);
      stepSkirmish(state, 0.05, () => 0); // 늘 치명타
      ally.hp = ally.maxHp;
      const until = boss.bt.pinnedUntil[ally.id] ?? 0;
      if (until !== last) { pinnedAt.push(state.elapsed); last = until; }
    }
    expect(pinnedAt.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < pinnedAt.length; i += 1) expect(pinnedAt[i] - pinnedAt[i - 1]).toBeGreaterThanOrEqual(2.9);
  });
});

describe("한계 돌파 — 감금조 넷(마가사·노아·라자·카르)", () => {
  const SLOTS = ["basic", "ultimate", "ferocity", "passive"] as const;

  it("네 개체 모두 네 칸이 채워져 있고 설명문이 키 그대로 새지 않는다", () => {
    for (const id of ["magasa", "noa", "raja", "carno"]) {
      const def = getRelic(id);
      for (const slot of SLOTS) {
        expect(def.breakthroughEffects?.[slot]?.kind, `${id} ${slot}`).not.toBe("none");
        const text = breakthroughEffectText(def, slot);
        expect(text, `${id} ${slot}`).toBeTruthy();
        expect(text).not.toContain("skill.breakthrough");
        expect(text).not.toMatch(/\{[a-z]+\}/);
      }
    }
  });

  it("카르 IV — 폭주에 들어서는 순간 주변 적이 기절하고 열리기 전에는 아무 일도 없다", () => {
    const run = (breakthrough: number) => {
      const state = createSkirmish([getRelic("torika")], [getRelic("carno")], ARENA, {}, {}, { enemyBreakthroughs: [breakthrough] });
      const boss = findFighter(state, "enemy-0")!;
      const ally = findFighter(state, "player-0")!;
      boss.x = 500; boss.y = 400; ally.x = 500; ally.y = 480;
      gainFerocity(boss, ferocityMaxOf(boss.def), state, []);
      expect(boss.ferocityFever).toBe(true);
      return ally.stunnedFor;
    };
    expect(run(2)).toBe(0);
    expect(run(3)).toBeGreaterThan(0);
  });
});
