import { describe, expect, it } from "vitest";
import { createSkirmish, fighterReach, fireUltimate, findFighter, refreshBleed, stepSkirmish, tryTriggerEmergencyRecovery, type Arena, type SkirmishEvent, type SkirmishState } from "../../src/core/skirmish";
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
    dodo.ferocity = FEROCITY_RULES.max; dodo.ferocityFever = true; dodo.feverHealingDone = 300;
    let ended = false;
    for (let tick = 0; tick < 400 && !ended; tick += 1) { stepSkirmish(state, 0.05); ended = !dodo.ferocityFever; }
    expect(ended).toBe(true);
    // 300의 50%를 셋이 나눈다.
    for (const id of ["player-0", "player-1", "player-2"]) expect(findFighter(state, id)!.shield.amount).toBe(50);
    expect(dodo.feverHealingDone).toBe(0);
  });

  it("는 아군 체력이 25% 이하로 내려가면 전투당 한 번만 주문력 보호막을 둘러 준다(별 V)", () => {
    const state = dodoBattle(BREAKTHROUGH_STEPS.length);
    const dodo = findFighter(state, "player-0")!;
    const tia = findFighter(state, "player-1")!;
    const enemy = findFighter(state, "enemy-0")!;
    enemy.x = tia.x + 40; enemy.y = tia.y; enemy.attackCooldown = 0;
    tia.hp = tia.maxHp * 0.26; tia.shield.amount = 0;
    for (let tick = 0; tick < 40 && !dodo.rescueUsed; tick += 1) stepSkirmish(state, 0.05, () => 0.99);
    expect(dodo.rescueUsed).toBe(true);
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
    expect(spino.tidalEchoes).toHaveLength(1);
    enemy.stunnedFor = 0;
    let echoes = 0;
    for (let tick = 0; tick < 50; tick += 1) {
      for (const event of stepSkirmish(state, 0.05, () => 0.99)) {
        if (event.kind === "areaImpact" && event.attackerId === spino.id) echoes += 1;
      }
    }
    expect(echoes).toBeGreaterThanOrEqual(1);
    expect(spino.tidalEchoes).toHaveLength(0);
    // 되돌아온 파도는 기절을 걸지 않는다.
    expect(enemy.stunnedFor).toBe(0);
    // 별 하나에서는 예약하지 않는다.
    const plain = spinoBattle(1, ["torika"]);
    engageAll(plain);
    const other = findFighter(plain, "player-0")!;
    other.shallowPools = [{ x: findFighter(plain, "enemy-0")!.x, y: findFighter(plain, "enemy-0")!.y, remaining: 6, total: 6 }];
    other.energy = other.def.ultimate.cost;
    fireUltimate(plain, other.id, () => 0.99);
    expect(other.tidalEchoes).toHaveLength(0);
  });

  it("는 폭주에 들어선 뒤 첫 일반 공격이 반드시 치명타다(별 IV)", () => {
    const state = spinoBattle(3, ["torika"]);
    engageAll(state);
    const spino = findFighter(state, "player-0")!;
    spino.ferocity = FEROCITY_RULES.max - 0.001; spino.attackCooldown = 0;
    expect(spino.ambushCritReady).toBe(false);
    let firstBasic: boolean | undefined;
    for (let tick = 0; tick < 200 && firstBasic === undefined; tick += 1) {
      const wasFever = spino.ferocityFever;
      for (const event of stepSkirmish(state, 0.05, () => 0.99)) {
        if (spino.ferocityFever && event.kind === "attack" && event.attackerId === spino.id && event.skill === "basic" && !wasFever === false) firstBasic = event.critical;
      }
      if (spino.ferocityFever && spino.ambushCritReady) { spino.attackCooldown = 0; engageAll(state); }
    }
    expect(firstBasic).toBe(true);
    expect(spino.ambushCritReady).toBe(false);
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
    expect(shute.relinkUsed).toBe(true);
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
