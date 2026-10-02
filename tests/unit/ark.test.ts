import { describe, expect, it } from "vitest";
import { applyCombatStatusEffect, createSkirmish, fireUltimate, stepSkirmish, type Arena, type Fighter, type SkirmishEvent, type SkirmishState } from "../../src/core/skirmish";
import { combatPower } from "../../src/core/combatPower";
import { withinRarityBand } from "../../src/core/rarityScaling";
import { getRelic } from "../../src/data/relics";
import { findKeyword } from "../../src/data/keywords";
import { ferocityTraitDescription, passiveDescription, skillDescription } from "../../src/ui/skillPresentation";
import { unitStatusViews } from "../../src/ui/unitStatusModel";

/**
 * 아크 — 땅 SSR 탱커. 「거대한 그림자」가 근접 사거리 안의 적에게 위압을 쌓고, 세 겹이면 공포(건 쪽에게서 달아나며
 * 기본 공격을 못 한다)가 발동한다. 풀린 뒤에는 면역이 켜져 영구 도주가 되지 않는다. 궁극기는 위압 없이 곧바로 공포를
 * 걸고, 실제로 겁먹은 적 수만큼 보호막이 커진다.
 */
const ARENA: Arena = { left: 0, right: 1_000, top: 0, bottom: 1_200 };
const ARK = getRelic("ark");
const LOOMING = ARK.passive.looming!;
const INTIMIDATE = LOOMING.intimidate;
const ROAR = ARK.ultimate.selfRoar!;

function quiet(state: SkirmishState): void {
  for (const fighter of state.fighters) {
    fighter.attackCooldown = Number.POSITIVE_INFINITY;
    fighter.retargetIn = Number.POSITIVE_INFINITY;
  }
}

function setup(enemyIds: string[] = ["amo", "toby"]) {
  const state = createSkirmish([getRelic("ark"), getRelic("torika")], enemyIds.map((id) => getRelic(id)), ARENA);
  const [ark, ally] = state.fighters.filter((fighter) => fighter.side === "player");
  const enemies = state.fighters.filter((fighter) => fighter.side === "enemy");
  quiet(state);
  ark.x = 500; ark.y = 900;
  ally.x = 560; ally.y = 900;
  enemies.forEach((enemy, index) => { enemy.x = 480 + index * 60; enemy.y = 840; enemy.stealthFor = 0; });
  return { state, ark, ally, enemies };
}

function step(state: SkirmishState, seconds: number): SkirmishEvent[] {
  const events: SkirmishEvent[] = [];
  for (let elapsed = 0; elapsed < seconds - 1e-9; elapsed += 0.05) events.push(...stepSkirmish(state, Math.min(0.05, seconds - elapsed)));
  return events;
}

/** 위압 세 겹을 곧바로 얹어 공포를 발동시킨다. */
function intimidateFully(state: SkirmishState, ark: Fighter, enemy: Fighter): void {
  for (let index = 0; index < INTIMIDATE.maxStacks; index += 1) applyCombatStatusEffect(enemy, INTIMIDATE, [], state, ark.id);
}

describe("아크 — 정체성", () => {
  it("은 땅 SSR 근접 탱커이고 앱솔루트 팽 소속, 호칭은 마스터다", () => {
    expect([ARK.rarity, ARK.element, ARK.role, ARK.reachTier, ARK.squad, ARK.origin]).toEqual(["SSR", "earth", "tank", "melee", "fang", "아르크토두스"]);
    expect(ARK.researcherTitle).toBe("마스터");
  });

  it("은 SSR 띠 안의 태생 전투력을 갖고, 탱커 중 가장 느리게 때리며 주문력은 낮다", () => {
    expect(withinRarityBand(combatPower(ARK.stats), "SSR")).toBe(true);
    for (const id of ["ella", "nodonia", "anka", "kento", "mosana"]) expect(ARK.stats.attackSpeed, id).toBeLessThan(getRelic(id).stats.attackSpeed);
    expect(ARK.stats.ap).toBeLessThan(ARK.stats.atk / 4);
  });

  it("은 받는 피해 감소를 쓰지 않고 버티는 값을 눈에 보이는 보호막으로 낸다", () => {
    expect(JSON.stringify(ARK)).not.toContain("damageReduction");
    expect(ROAR.shieldMaxHpPercent + ROAR.shieldPerFearedMaxHpPercent * ROAR.shieldMaxFeared).toBeLessThanOrEqual(40);
  });
});

describe("아크 — 규칙어 계약", () => {
  it("의 위압·공포 태그는 계약의 수와 같다", () => {
    const intimidation = findKeyword("intimidation")!.description;
    const fear = findKeyword("fear")!.description;
    expect(intimidation).toContain(`${INTIMIDATE.seconds}초`);
    expect(intimidation).toContain(`${INTIMIDATE.maxStacks}겹`);
    expect(fear).toContain(`${INTIMIDATE.fearSeconds}초`);
    expect(fear).toContain(`${INTIMIDATE.immunitySeconds}초`);
  });

  it("의 일반 공격은 패시브와 같은 위압 계약을 쓴다", () => {
    expect(ARK.basic.statusEffects).toEqual([INTIMIDATE]);
    expect(ROAR.fear.seconds).toBe(INTIMIDATE.fearSeconds);
  });

  it("의 스킬 본문은 태그로 위압·공포를 가리킨다", () => {
    expect(passiveDescription(ARK.passive)).toContain("[[intimidation|");
    expect(skillDescription(ARK.basic)).toContain("[[intimidation|");
    expect(skillDescription(ARK.ultimate)).toContain("[[fear|");
    expect(ferocityTraitDescription(ARK.ferocityTrait)).toContain("[[fear|");
  });
});

describe("아크 — 거대한 그림자", () => {
  it("은 간격마다 반경 안의 모든 적에게 위압을 한 겹 쌓고 피해는 주지 않는다", () => {
    const { state, enemies } = setup();
    const far = enemies[1];
    far.x = 500; far.y = 0;
    const [near] = enemies;
    const hp = near.hp;
    step(state, LOOMING.intervalSeconds + 0.05);
    expect(near.intimidation?.stacks).toBe(1);
    expect(far.intimidation).toBeNull();
    expect(near.hp).toBe(hp);
  });

  it("은 세 겹이 차면 공포를 발동하고 겹을 비우며, 머리 위에는 기절이 아니라 공포로 선다", () => {
    const { state, ark, enemies } = setup();
    const [enemy] = enemies;
    intimidateFully(state, ark, enemy);
    expect(enemy.fear).not.toBeNull();
    expect(enemy.intimidation).toBeNull();
    expect(enemy.fear!.remaining).toBeLessThanOrEqual(INTIMIDATE.fearSeconds);
    expect(enemy.stunnedFor).toBe(0);
    const ids = unitStatusViews(enemy).map((view) => view.id);
    expect(ids).toContain("fear");
    expect(ids).not.toContain("stun");
  });

  it("은 공포가 풀린 뒤 면역 동안 새 위압·공포를 받지 않는다", () => {
    const { state, ark, enemies } = setup();
    const [enemy] = enemies;
    intimidateFully(state, ark, enemy);
    step(state, INTIMIDATE.fearSeconds + 0.2);
    expect(enemy.fear).toBeNull();
    expect(enemy.fearImmuneFor).toBeGreaterThan(0);
    intimidateFully(state, ark, enemy);
    expect(enemy.intimidation).toBeNull();
    expect(enemy.fear).toBeNull();
    step(state, INTIMIDATE.immunitySeconds + 0.1);
    expect(enemy.fearImmuneFor).toBe(0);
  });

  it("은 쌓인 위압 겹이 시간이 다하면 사라진다", () => {
    const { state, ark, enemies } = setup();
    const [enemy] = enemies;
    ark.loomingIn = Number.POSITIVE_INFINITY;
    applyCombatStatusEffect(enemy, INTIMIDATE, [], state, ark.id);
    expect(enemy.intimidation?.stacks).toBe(1);
    step(state, INTIMIDATE.seconds + 0.1);
    expect(enemy.intimidation).toBeNull();
  });
});

describe("아크 — 공포", () => {
  it("에 빠진 적은 건 쪽에게서 달아나며 일반 공격을 하지 않는다", () => {
    const { state, ark, ally, enemies } = setup(["amo"]);
    const [enemy] = enemies;
    ark.loomingIn = Number.POSITIVE_INFINITY;
    enemy.x = 500; enemy.y = 840; ally.x = 500; ally.y = 800;
    intimidateFully(state, ark, enemy);
    enemy.attackCooldown = 0;
    enemy.retargetIn = 0;
    const before = Math.hypot(enemy.x - ark.x, enemy.y - ark.y);
    const events = step(state, INTIMIDATE.fearSeconds * 0.5);
    expect(events.some((event) => event.kind === "attack" && event.attackerId === enemy.id)).toBe(false);
    expect(Math.hypot(enemy.x - ark.x, enemy.y - ark.y)).toBeGreaterThan(before);
  });

  it("은 벽에 닿아도 구석에 서 있지 않고 아레나 밖으로 나가지 않는다", () => {
    const { state, ark, enemies } = setup(["amo"]);
    const [enemy] = enemies;
    ark.loomingIn = Number.POSITIVE_INFINITY;
    ark.x = 500; ark.y = 900;
    enemy.x = 500; enemy.y = 20;
    intimidateFully(state, ark, enemy);
    step(state, INTIMIDATE.fearSeconds + 0.1);
    expect(enemy.y).toBeGreaterThanOrEqual(ARENA.top - 1);
    expect(enemy.x).toBeGreaterThanOrEqual(ARENA.left);
    expect(enemy.x).toBeLessThanOrEqual(ARENA.right);
  });
});

describe("아크 — 포식자의 포효", () => {
  it("는 위압 없이 반경 안의 모든 적을 곧바로 공포에 빠뜨리고, 면역 중인 적에게도 들어간다", () => {
    const { state, ark, enemies } = setup();
    const [immune] = enemies;
    immune.fearImmuneFor = 5;
    ark.energy = 1_000;
    fireUltimate(state, ark.id);
    expect(enemies.every((enemy) => enemy.fear !== null)).toBe(true);
    expect(immune.fear!.immunitySeconds).toBe(ROAR.fear.immunitySeconds);
  });

  it("의 보호막은 기본 몫에 실제로 겁먹은 적 한 명당 몫을 더하고, 반경 밖의 적은 세지 않는다", () => {
    const { state, ark, enemies } = setup();
    enemies[1].x = 500; enemies[1].y = 900 - ROAR.radius - 200;
    ark.energy = 1_000;
    fireUltimate(state, ark.id);
    const percent = ROAR.shieldMaxHpPercent + ROAR.shieldPerFearedMaxHpPercent * 1;
    expect(ark.shield.amount).toBeCloseTo(ark.maxHp * percent / 100, 0);
    expect(enemies[1].fear).toBeNull();
  });

  it("의 보호막은 세는 적 수의 상한을 넘지 않는다", () => {
    const ids = Array.from({ length: ROAR.shieldMaxFeared + 3 }, () => "amo");
    const { state, ark, enemies } = setup(ids);
    enemies.forEach((enemy, index) => { enemy.x = 440 + index * 20; enemy.y = 860; });
    ark.energy = 1_000;
    fireUltimate(state, ark.id);
    const max = ROAR.shieldMaxHpPercent + ROAR.shieldPerFearedMaxHpPercent * ROAR.shieldMaxFeared;
    expect(ark.shield.amount).toBeLessThanOrEqual(Math.round(ark.maxHp * max / 100) + 1);
  });

  it("는 피해를 주지 않는다", () => {
    const { state, ark, enemies } = setup();
    const hp = enemies.map((enemy) => enemy.hp);
    ark.energy = 1_000;
    fireUltimate(state, ark.id);
    expect(enemies.map((enemy) => enemy.hp)).toEqual(hp);
  });
});

describe("아크 — 사냥 본능", () => {
  const TRAIT = ARK.ferocityTrait as Extract<typeof ARK.ferocityTrait, { effectId: "huntInstinct" }>;

  it("은 폭주 중 일반 공격이 위압을 더 쌓고 공포 뒤 면역을 짧게 만든다", () => {
    const { state, ark, enemies } = setup();
    const [enemy] = enemies;
    ark.loomingIn = Number.POSITIVE_INFINITY;
    ark.ferocityFever = true;
    applyCombatStatusEffect(enemy, INTIMIDATE, [], state, ark.id);
    expect(enemy.intimidation?.stacks).toBe(1 + TRAIT.intimidateBonusStacks);
    applyCombatStatusEffect(enemy, INTIMIDATE, [], state, ark.id);
    expect(enemy.fear?.immunitySeconds).toBe(TRAIT.fearImmunitySeconds);
  });

  it("은 폭주가 아니면 평소 계약 그대로다", () => {
    const { state, ark, enemies } = setup();
    const [enemy] = enemies;
    ark.loomingIn = Number.POSITIVE_INFINITY;
    applyCombatStatusEffect(enemy, INTIMIDATE, [], state, ark.id);
    expect(enemy.intimidation?.stacks).toBe(1);
  });

  it("은 피해량과 궁극기는 건드리지 않는다", () => {
    expect(JSON.stringify(TRAIT)).not.toMatch(/damage|ultimate/i);
  });
});
