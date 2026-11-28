import { describe, expect, it } from "vitest";
import { createSkirmish, feverRamp, stepSkirmish, type Arena, type SkirmishState } from "../../src/core/skirmish";
import { statTotal } from "../../src/core/combatPower";
import { withinRarityBand } from "../../src/core/rarityScaling";
import { ferocityMaxOf } from "../../src/core/ferocity";
import { getRelic } from "../../src/data/relics";
import { ferocityTraitDescription, passiveDescription, skillDescription } from "../../src/ui/skillPresentation";

/**
 * 아르 — 불 SR 근거리 전사. 야성을 빨리 채우고(게이지 80 · 평타마다 +6) 폭주를 오래 쥔다:
 * 폭주 중 기본 공격 적중마다 0.5초, 처치마다 4초(응태 2026-11-22) 폭주가 닳지 않는다. 한 번의 폭주에 최대 +6초다.
 */
const ARENA: Arena = { left: 0, right: 2_000, top: 0, bottom: 2_000 };

function setup(): { state: SkirmishState } {
  const state = createSkirmish([getRelic("ar")], [getRelic("amo"), getRelic("amo")], ARENA);
  for (const fighter of state.fighters) { fighter.attackCooldown = 99; fighter.stealthFor = 0; }
  return { state };
}

function enterFever(state: SkirmishState): void {
  const ar = state.fighters[0];
  ar.ferocity = ferocityMaxOf(ar.def);
  ar.ferocityFever = true;
  ar.feverHold = 0;
  ar.feverHoldGranted = 0;
}

describe("아르 — 정체성", () => {
  it("은 불 SR 근거리 전사이고 나이트 기어 소속이다", () => {
    const ar = getRelic("ar");
    expect([ar.rarity, ar.element, ar.role, ar.reachTier, ar.squad]).toEqual(["SR", "fire", "warrior", "melee", "gear"]);
    expect(ar.portraitAssetId).toBe("ar");
  });

  it("은 SR 띠 안의 태생 전투력을 갖고, 게이지가 작아 빨리 찬다", () => {
    const ar = getRelic("ar");
    expect(withinRarityBand(statTotal(ar.stats), "SR")).toBe(true);
    expect(ferocityMaxOf(ar)).toBe(80);
    expect(ar.stats.ferocityGain).toBe(12);
  });

  it("의 피 냄새는 처치 4초 · 적중 0.5초 · 상한 6초다(응태 2026-11-22)", () => {
    expect(getRelic("ar").passive.bloodScent).toEqual({ bonusFerocityPerHit: 6, extendPerHitSeconds: 0.5, extendPerKillSeconds: 4, maxExtendSeconds: 6 });
  });
});

describe("아르 — 피 냄새", () => {
  it("은 폭주 전 평타 한 번에 공통 12 위에 6을 더 끌어온다", () => {
    const { state } = setup();
    const [ar, foe] = state.fighters;
    ar.x = 1_000; ar.y = 1_000; foe.x = 1_000; foe.y = 960;
    foe.maxHp = foe.hp = 1_000_000;
    ar.targetId = foe.id; ar.attackCooldown = 0;
    stepSkirmish(state, 1 / 60);
    expect(ar.ferocity).toBeGreaterThanOrEqual(18);
  });

  it("은 폭주 중 평타 적중마다 폭주를 0.5초 붙잡는다", () => {
    const { state } = setup();
    const [ar, foe] = state.fighters;
    ar.x = 1_000; ar.y = 1_000; foe.x = 1_000; foe.y = 960;
    foe.maxHp = foe.hp = 1_000_000;
    enterFever(state);
    ar.targetId = foe.id; ar.attackCooldown = 0;
    stepSkirmish(state, 1 / 60);
    expect(ar.feverHoldGranted).toBeCloseTo(0.5, 5);
  });

  it("은 폭주 중 처치하면 4초를 붙잡고, 한 번의 폭주에 6초를 넘지 않는다", () => {
    const { state } = setup();
    const [ar, foe, other] = state.fighters;
    ar.x = 1_000; ar.y = 1_000; foe.x = 1_000; foe.y = 960; other.x = 1_500; other.y = 400;
    enterFever(state);
    foe.hp = 1;
    ar.targetId = foe.id; ar.attackCooldown = 0;
    stepSkirmish(state, 1 / 60);
    expect(foe.hp).toBe(0);
    // 적중 0.5초 + 처치 4초.
    expect(ar.feverHoldGranted).toBeCloseTo(4.5, 5);
    // 상한은 6초다 — 더 쌓아도 넘지 않는다.
    for (let index = 0; index < 10; index += 1) {
      foe.hp = 1_000_000; foe.maxHp = 1_000_000;
      ar.targetId = foe.id; ar.attackCooldown = 0;
      stepSkirmish(state, 1 / 60);
    }
    expect(ar.feverHoldGranted).toBeLessThanOrEqual(6 + 1e-9);
  });

  it("이 붙잡은 동안 폭주 게이지는 닳지 않고, 다 흐른 뒤에 닳는다", () => {
    const { state } = setup();
    const [ar] = state.fighters;
    for (const fighter of state.fighters.slice(1)) { fighter.x = 1_900; fighter.y = 100; }
    ar.x = 100; ar.y = 1_900;
    enterFever(state);
    ar.feverHold = 1;
    ar.feverHoldGranted = 1;
    const max = ar.ferocity;
    // 한 번에 흐르는 시간은 코어가 0.25초로 자른다.
    for (let index = 0; index < 4; index += 1) stepSkirmish(state, 0.25);
    expect(ar.ferocity).toBe(max);
    stepSkirmish(state, 0.25);
    expect(ar.ferocity).toBeLessThan(max);
    expect(ar.ferocityFever).toBe(true);
  });

  it("은 새 폭주에 들어서면 연장 몫을 처음부터 다시 센다", () => {
    const { state } = setup();
    const [ar, foe] = state.fighters;
    ar.feverHoldGranted = 6;
    ar.ferocity = ferocityMaxOf(ar.def) - 1;
    ar.x = 1_000; ar.y = 1_000; foe.x = 1_000; foe.y = 960;
    foe.maxHp = foe.hp = 1_000_000;
    ar.targetId = foe.id; ar.attackCooldown = 0;
    stepSkirmish(state, 1 / 60);
    expect(ar.ferocityFever).toBe(true);
    expect(ar.feverHoldGranted).toBe(0);
  });
});

describe("아르 — 문구", () => {
  it("의 패시브·궁극기·폭주 문장이 데이터의 수를 그대로 말한다", () => {
    const ar = getRelic("ar");
    const passive = passiveDescription(ar.passive);
    for (const value of ["6", "0.5", "4", "6"]) expect(passive).toContain(value);
    const ultimate = skillDescription(ar.ultimate);
    expect(ultimate).toContain("40");
    expect(ultimate).toContain("2초");
    const fever = ferocityTraitDescription(ar.ferocityTrait);
    for (const value of ["10", "5", "50", "1.5", "12"]) expect(fever).toContain(value);
  });
});

describe("아르 — 끊기지 않을수록 오르는 폭주", () => {
  it("는 폭주에 든 순간 공속 +10%·흡혈 0에서 시작해 매초 오르고, 상한에서 멈춘다", () => {
    const { state } = setup();
    const [ar] = state.fighters;
    for (const fighter of state.fighters.slice(1)) { fighter.x = 1_900; fighter.y = 100; }
    ar.x = 100; ar.y = 1_900;
    enterFever(state);
    ar.feverElapsed = 0;
    expect(feverRamp(ar)).toEqual({ attackSpeedPercent: 10, lifeStealPoints: 0 });
    ar.feverElapsed = 4;
    expect(feverRamp(ar)).toEqual({ attackSpeedPercent: 30, lifeStealPoints: 6 });
    ar.feverElapsed = 20;
    expect(feverRamp(ar)).toEqual({ attackSpeedPercent: 50, lifeStealPoints: 12 });
  });

  it("은 폭주가 끝나면 처음으로 돌아간다", () => {
    const { state } = setup();
    const [ar] = state.fighters;
    for (const fighter of state.fighters.slice(1)) { fighter.x = 1_900; fighter.y = 100; }
    ar.x = 100; ar.y = 1_900;
    enterFever(state);
    for (let index = 0; index < 8; index += 1) stepSkirmish(state, 0.25);
    expect(ar.feverElapsed).toBeCloseTo(2, 5);
    for (let index = 0; index < 40; index += 1) stepSkirmish(state, 0.25);
    expect(ar.ferocityFever).toBe(false);
    expect(ar.feverElapsed).toBe(0);
    expect(feverRamp(ar)).toEqual({ attackSpeedPercent: 0, lifeStealPoints: 0 });
  });
});
