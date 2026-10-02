import { describe, expect, it } from "vitest";
import { createSkirmish, fireUltimate, type Arena, type SkirmishState } from "../../src/core/skirmish";
import { combatPower } from "../../src/core/combatPower";
import { computeDamage } from "../../src/core/damage";
import { withinRarityBand } from "../../src/core/rarityScaling";
import { getRelic } from "../../src/data/relics";
import { findKeyword } from "../../src/data/keywords";
import { ferocityTraitDescription, passiveDescription, skillDescription } from "../../src/ui/skillPresentation";

/**
 * 이르나 — 물 SR 원거리 전사. 한 방이 무거운 저격수이고, 「물때를 읽는 눈」의 흡혈 절반이 보호막(해무 방벽)이 된다.
 * 궁극기는 가장 먼 적 하나를 방어 30%를 지나쳐 쏘고, 처치하면 게이지를 돌려받는다.
 */
const ARENA: Arena = { left: 0, right: 1_000, top: 0, bottom: 1_200 };
const IRNA = getRelic("irna");
const SHIELD_PLAN = IRNA.passive.lifeStealShield!;

function setup() {
  const state: SkirmishState = createSkirmish([getRelic("irna"), getRelic("torika")], [getRelic("amo"), getRelic("toby")], ARENA);
  const irna = state.fighters.find((fighter) => fighter.def.id === "irna")!;
  const [near, far] = state.fighters.filter((fighter) => fighter.side === "enemy");
  for (const fighter of state.fighters) { fighter.attackCooldown = Number.POSITIVE_INFINITY; fighter.retargetIn = Number.POSITIVE_INFINITY; }
  irna.x = 500; irna.y = 1_000;
  near.x = 500; near.y = 800; near.stealthFor = 0;
  far.x = 500; far.y = 200; far.stealthFor = 0;
  irna.energy = 1_000;
  return { state, irna, near, far };
}

describe("이르나 — 정체성", () => {
  it("은 물 SR 원거리 전사이고 시그널 아이 소속이다", () => {
    expect([IRNA.rarity, IRNA.element, IRNA.role, IRNA.reachTier, IRNA.squad]).toEqual(["SR", "water", "warrior", "ranged", "eye"]);
  });

  it("은 SR 띠 안에서 공격력이 가장 몰리고 전사 중 공격 속도가 가장 느리다", () => {
    expect(withinRarityBand(combatPower(IRNA.stats), "SR")).toBe(true);
    expect(IRNA.stats.atk).toBeGreaterThan(IRNA.stats.hp / 10);
    expect(IRNA.stats.ap).toBeLessThan(IRNA.stats.atk / 5);
    for (const id of ["keris", "rex", "maddy", "pachi"]) expect(IRNA.stats.attackSpeed, id).toBeLessThan(getRelic(id).stats.attackSpeed);
  });
});

describe("이르나 — 해무 방벽 태그", () => {
  it("의 수치는 데이터와 같다", () => {
    const description = findKeyword("fog-guard")!.description;
    expect(description).toContain(`${SHIELD_PLAN.convertPercent}%`);
    expect(description).toContain(`${SHIELD_PLAN.capMaxHpPercent}%`);
    expect(passiveDescription(IRNA.passive)).toContain("[[fog-guard|");
    expect(passiveDescription(IRNA.passive)).toContain(`${IRNA.passive.lifeStealPoints}%`);
  });

  it("은 궁극기·야성 문장에 방어 무시 몫을 그대로 적는다", () => {
    expect(skillDescription(IRNA.ultimate)).toMatch(/^가장 먼 적에게 /);
    expect(skillDescription(IRNA.ultimate)).toContain(`${IRNA.ultimate.defenseIgnorePercent}%`);
    expect(ferocityTraitDescription(IRNA.ferocityTrait)).toContain("25%");
  });
});

describe("이르나 — 수평선 저격", () => {
  it("은 가장 가까운 적이 아니라 가장 먼 적을 쏜다", () => {
    const { state, irna, near, far } = setup();
    const [nearHp, farHp] = [near.hp, far.hp];
    fireUltimate(state, irna.id);
    expect(far.hp).toBeLessThan(farHp);
    expect(near.hp).toBe(nearHp);
  });

  it("의 방어 무시는 방어를 그 비율만큼만 깎는다", () => {
    const { irna, near } = setup();
    const base = { power: 100, damageType: "physical" as const, isCritical: false, kind: "basic" as const };
    const none = computeDamage(irna, near, base);
    const half = computeDamage(irna, near, { ...base, defenseIgnorePercent: 50 });
    const all = computeDamage(irna, near, { ...base, defenseIgnorePercent: 100 });
    const fixed = computeDamage(irna, near, { ...base, ignoresDefense: true });
    expect(half).toBeGreaterThan(none);
    expect(half).toBeLessThan(all);
    expect(all).toBe(fixed);
  });
});

describe("이르나 — 흡혈 보호막 전환", () => {
  it("은 흡혈의 일부를 막으로 두르고 나머지는 체력으로 돌린다", () => {
    const { state, irna, far } = setup();
    irna.hp = irna.maxHp * 0.5;
    const before = irna.hp;
    fireUltimate(state, irna.id);
    expect(far.hp).toBeLessThan(far.maxHp);
    expect(irna.shield.amount).toBeGreaterThan(0);
    expect(irna.hp).toBeGreaterThan(before);
    expect(irna.shield.amount).toBeLessThanOrEqual(irna.maxHp * SHIELD_PLAN.capMaxHpPercent / 100 + 1e-6);
  });

  it("은 막이 상한에 닿으면 넘치는 몫을 체력으로 돌려준다", () => {
    const { state, irna } = setup();
    const cap = irna.maxHp * SHIELD_PLAN.capMaxHpPercent / 100;
    irna.shield.amount = cap;
    irna.shield.providerId = irna.id;
    irna.hp = irna.maxHp * 0.5;
    const before = irna.hp;
    fireUltimate(state, irna.id);
    expect(irna.shield.amount).toBeLessThanOrEqual(cap + 1e-6);
    expect(irna.hp).toBeGreaterThan(before);
  });
});
