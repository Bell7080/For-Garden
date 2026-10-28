import { describe, expect, it } from "vitest";
import { applyCombatStatusEffect, createSkirmish, effectiveLocksBroken, fireUltimate, stepSkirmish, type Arena } from "../../src/core/skirmish";
import { getRelic } from "../../src/data/relics";
import { ENEMY_BIRTH_TIERS } from "../../src/core/rarityScaling";

/** 감금조(마가사·노아·라자·카르노) — 지하 감금동에서 풀려난 공멸의 넷째 무리. */
const ARENA: Arena = { left: 0, right: 1_000, top: 0, bottom: 1_200 };

function setup(heroId: string, enemyIds: readonly string[]) {
  const state = createSkirmish([getRelic(heroId)], enemyIds.map((id) => getRelic(id)), ARENA);
  const hero = state.fighters.find((f) => f.def.id === heroId)!;
  const foes = state.fighters.filter((f) => f.side !== hero.side);
  return { state, hero, foes };
}

function run(state: ReturnType<typeof setup>["state"], seconds: number) {
  for (let t = 0; t < seconds; t += 0.05) stepSkirmish(state, 0.05, () => 0.5);
}

describe("감금조 정체성", () => {
  it("넷 모두 공멸이고 태생 층은 감금 3인방 ×1.7 · 카르노 ×3이다", () => {
    for (const id of ["magasa", "noa", "raja", "carno"]) {
      expect(getRelic(id).squad, id).toBe("annihilation");
      expect(getRelic(id).enemyOnly, id).toBe(true);
    }
    expect(ENEMY_BIRTH_TIERS.carno.statFactor).toBe(3);
    expect(getRelic("magasa").element).toBe("fire");
    expect(getRelic("noa").role).toBe("assassin");
    expect(getRelic("raja").role).toBe("tank");
    expect(getRelic("carno").rarity).toBe("SSR");
  });
});

describe("마가사 「오늘의 재료」", () => {
  it("체력 비율이 가장 낮은 적을 재료로 정하고, 다른 적이 더 약해져도 갈아타지 않는다", () => {
    const { state, hero, foes } = setup("magasa", ["amo", "toby", "ripa"]);
    foes[1].hp = foes[1].maxHp * 0.3;
    run(state, 0.3);
    expect(hero.ingredientId).toBe(foes[1].id);
    foes[0].hp = foes[0].maxHp * 0.1;
    run(state, 2.5);
    expect(hero.ingredientId).toBe(foes[1].id);
  });

  it("재료를 쓰러뜨리면 공격력 겹이 쌓이고 다음 재료를 고른다", () => {
    const { state, hero, foes } = setup("magasa", ["toby", "amo"]);
    foes[0].hp = 1;
    foes[0].x = hero.x; foes[0].y = hero.y - 60;
    let guard = 0;
    while (foes[0].hp > 0 && guard++ < 400) run(state, 0.05);
    expect(foes[0].hp).toBeLessThanOrEqual(0);
    run(state, 0.2);
    expect(hero.ingredientStacks).toBe(1);
    expect(hero.ingredientId).toBe(foes[1].id);
  });
});

describe("노아 「움찔」", () => {
  it("문턱을 넘으면 가장 가까운 적의 등 뒤로 뛰고 다음 기본 공격을 강화한다", () => {
    const { state, hero, foes } = setup("noa", ["toby"]);
    hero.x = 500; hero.y = 900; foes[0].x = 500; foes[0].y = 700;
    for (const f of state.fighters) f.attackCooldown = Number.POSITIVE_INFINITY;
    hero.flinch.pending = true;
    run(state, 0.05);
    expect(hero.y).toBeLessThan(foes[0].y);
    expect(hero.empoweredBasic).toBe(true);
    expect(hero.flinch.cooldown).toBeGreaterThan(5);
  });
});

describe("라자 「철권」·「감방 서열」·「철창 부수기」", () => {
  it("기본 공격은 매 타 경직이고 네 번째마다 주위를 도발하며 막을 두른다", () => {
    const def = getRelic("raja");
    expect(def.basic.statusEffectEvery).toBeUndefined();
    expect(def.basic.statusEffects?.[0]?.kind).toBe("stagger");
    const { state, hero, foes } = setup("raja", ["toby", "amo"]);
    foes.forEach((f, i) => { f.x = hero.x + i * 30; f.y = hero.y - 60; f.attackCooldown = Number.POSITIVE_INFINITY; });
    hero.energy = 0;
    let guard = 0;
    while (hero.rallyHitCount < 3 && guard++ < 400) run(state, 0.05);
    expect(foes.every((f) => f.taunted === null)).toBe(true);
    const shieldBefore = hero.shield.amount;
    guard = 0;
    while (hero.rallyHitCount !== 0 && guard++ < 400) run(state, 0.05);
    expect(foes.every((f) => f.taunted?.sourceId === hero.id)).toBe(true);
    expect(hero.shield.amount).toBeGreaterThan(shieldBefore);
  });

  it("궁극기는 끌어당기기만 하고 도발·보호막을 걸지 않는다", () => {
    const def = getRelic("raja");
    const guard = "selfGuard" in def.ultimate ? def.ultimate.selfGuard : undefined;
    expect(guard?.pullOnly).toBe(true);
    const { state, hero, foes } = setup("raja", ["toby"]);
    foes[0].x = hero.x; foes[0].y = hero.y - 300;
    for (const f of state.fighters) f.attackCooldown = Number.POSITIVE_INFINITY;
    hero.energy = 1_000;
    fireUltimate(state, hero.id, () => 0.5);
    expect(foes[0].y).toBeGreaterThan(hero.y - 300);
    expect(foes[0].taunted).toBeNull();
    expect(hero.shield.amount).toBe(0);
  });

  it("제게 도발된 적에게 맞을 때 막을 얻고 그 막은 상한을 넘지 않는다", () => {
    const { state, hero, foes } = setup("raja", ["toby"]);
    foes[0].x = hero.x; foes[0].y = hero.y - 60;
    hero.attackCooldown = Number.POSITIVE_INFINITY; hero.energy = 0;
    foes[0].taunted = { remaining: 60, total: 60, sourceId: hero.id };
    run(state, 20);
    expect(hero.shield.amount).toBeGreaterThan(0);
    expect(hero.shield.amount).toBeLessThanOrEqual(hero.maxHp * 0.15 + 1e-6);
  });
});

describe("마가사 「다지기」 깊은 출혈", () => {
  it("이미 출혈 중인 적에게 다시 걸면 매초 비율이 두 배가 되고 받는 회복이 준다", () => {
    const { state, foes } = setup("magasa", ["toby"]);
    const bleed = getRelic("magasa").basic.statusEffects![0];
    expect(bleed.kind).toBe("bleed");
    applyCombatStatusEffect(foes[0], bleed, [], state, undefined);
    expect(foes[0].bleed?.percent).toBe(2);
    applyCombatStatusEffect(foes[0], bleed, [], state, undefined);
    expect(foes[0].bleed?.percent).toBe(4);
    expect(foes[0].bleed?.healingReceivedReductionPercent).toBe(30);
    applyCombatStatusEffect(foes[0], bleed, [], state, undefined);
    expect(foes[0].bleed?.percent).toBe(4);
  });
});

describe("카르노 「구속복」", () => {
  it("체력 문턱마다 자물쇠가 풀리며 주위 적을 날려버린다", () => {
    const { state, hero, foes } = setup("carno", ["toby"]);
    foes[0].x = hero.x; foes[0].y = hero.y - 80;
    hero.hp = hero.maxHp * 0.55;
    run(state, 0.05);
    expect(hero.locksBroken).toBe(2);
    expect(foes[0].knockback).not.toBeNull();
  });

  it("「구속 붕괴」 폭주 동안은 모든 자물쇠가 풀린 것으로 친다", () => {
    const { hero } = setup("carno", ["toby"]);
    expect(effectiveLocksBroken(hero)).toBe(0);
    hero.ferocityFever = true;
    expect(effectiveLocksBroken(hero)).toBe(4);
  });
});
