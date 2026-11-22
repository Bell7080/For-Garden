import { describe, expect, it } from "vitest";
import { createSkirmish, feverRamp, stepSkirmish, type Arena, type SkirmishState } from "../../src/core/skirmish";
import { combatPower } from "../../src/core/combatPower";
import { withinRarityBand } from "../../src/core/rarityScaling";
import { ferocityMaxOf } from "../../src/core/ferocity";
import { getRelic } from "../../src/data/relics";
import { ferocityTraitDescription, passiveDescription, skillDescription } from "../../src/ui/skillPresentation";

/**
 * 아르사 — 불 SR 근거리 전사. 야성을 빨리 채우고(게이지 80 · 평타마다 +6) 폭주를 오래 쥔다:
 * 폭주 중 기본 공격 적중마다 0.5초, 처치마다 4초(응태 2026-11-22) 폭주가 닳지 않는다. 한 번의 폭주에 최대 +6초다.
 */
const ARENA: Arena = { left: 0, right: 2_000, top: 0, bottom: 2_000 };

function setup(): { state: SkirmishState } {
  const state = createSkirmish([getRelic("arsa")], [getRelic("amo"), getRelic("amo")], ARENA);
  for (const fighter of state.fighters) { fighter.attackCooldown = 99; fighter.stealthFor = 0; }
  return { state };
}

function enterFever(state: SkirmishState): void {
  const arsa = state.fighters[0];
  arsa.ferocity = ferocityMaxOf(arsa.def);
  arsa.ferocityFever = true;
  arsa.feverHold = 0;
  arsa.feverHoldGranted = 0;
}

describe("아르사 — 정체성", () => {
  it("은 불 SR 근거리 전사이고 나이트 기어 소속이다", () => {
    const arsa = getRelic("arsa");
    expect([arsa.rarity, arsa.element, arsa.role, arsa.reachTier, arsa.squad]).toEqual(["SR", "fire", "warrior", "melee", "gear"]);
    expect(arsa.portraitAssetId).toBe("arsa");
  });

  it("은 SR 띠 안의 태생 전투력을 갖고, 게이지가 작아 빨리 찬다", () => {
    const arsa = getRelic("arsa");
    expect(withinRarityBand(combatPower(arsa.stats), "SR")).toBe(true);
    expect(ferocityMaxOf(arsa)).toBe(80);
    expect(arsa.stats.ferocityGain).toBe(12);
  });

  it("의 피 냄새는 처치 4초 · 적중 0.5초 · 상한 6초다(응태 2026-11-22)", () => {
    expect(getRelic("arsa").passive.bloodScent).toEqual({ bonusFerocityPerHit: 6, extendPerHitSeconds: 0.5, extendPerKillSeconds: 4, maxExtendSeconds: 6 });
  });
});

describe("아르사 — 피 냄새", () => {
  it("은 폭주 전 평타 한 번에 공통 12 위에 6을 더 끌어온다", () => {
    const { state } = setup();
    const [arsa, foe] = state.fighters;
    arsa.x = 1_000; arsa.y = 1_000; foe.x = 1_000; foe.y = 960;
    foe.maxHp = foe.hp = 1_000_000;
    arsa.targetId = foe.id; arsa.attackCooldown = 0;
    stepSkirmish(state, 1 / 60);
    expect(arsa.ferocity).toBeGreaterThanOrEqual(18);
  });

  it("은 폭주 중 평타 적중마다 폭주를 0.5초 붙잡는다", () => {
    const { state } = setup();
    const [arsa, foe] = state.fighters;
    arsa.x = 1_000; arsa.y = 1_000; foe.x = 1_000; foe.y = 960;
    foe.maxHp = foe.hp = 1_000_000;
    enterFever(state);
    arsa.targetId = foe.id; arsa.attackCooldown = 0;
    stepSkirmish(state, 1 / 60);
    expect(arsa.feverHoldGranted).toBeCloseTo(0.5, 5);
  });

  it("은 폭주 중 처치하면 4초를 붙잡고, 한 번의 폭주에 6초를 넘지 않는다", () => {
    const { state } = setup();
    const [arsa, foe, other] = state.fighters;
    arsa.x = 1_000; arsa.y = 1_000; foe.x = 1_000; foe.y = 960; other.x = 1_500; other.y = 400;
    enterFever(state);
    foe.hp = 1;
    arsa.targetId = foe.id; arsa.attackCooldown = 0;
    stepSkirmish(state, 1 / 60);
    expect(foe.hp).toBe(0);
    // 적중 0.5초 + 처치 4초.
    expect(arsa.feverHoldGranted).toBeCloseTo(4.5, 5);
    // 상한은 6초다 — 더 쌓아도 넘지 않는다.
    for (let index = 0; index < 10; index += 1) {
      foe.hp = 1_000_000; foe.maxHp = 1_000_000;
      arsa.targetId = foe.id; arsa.attackCooldown = 0;
      stepSkirmish(state, 1 / 60);
    }
    expect(arsa.feverHoldGranted).toBeLessThanOrEqual(6 + 1e-9);
  });

  it("이 붙잡은 동안 폭주 게이지는 닳지 않고, 다 흐른 뒤에 닳는다", () => {
    const { state } = setup();
    const [arsa] = state.fighters;
    for (const fighter of state.fighters.slice(1)) { fighter.x = 1_900; fighter.y = 100; }
    arsa.x = 100; arsa.y = 1_900;
    enterFever(state);
    arsa.feverHold = 1;
    arsa.feverHoldGranted = 1;
    const max = arsa.ferocity;
    // 한 번에 흐르는 시간은 코어가 0.25초로 자른다.
    for (let index = 0; index < 4; index += 1) stepSkirmish(state, 0.25);
    expect(arsa.ferocity).toBe(max);
    stepSkirmish(state, 0.25);
    expect(arsa.ferocity).toBeLessThan(max);
    expect(arsa.ferocityFever).toBe(true);
  });

  it("은 새 폭주에 들어서면 연장 몫을 처음부터 다시 센다", () => {
    const { state } = setup();
    const [arsa, foe] = state.fighters;
    arsa.feverHoldGranted = 6;
    arsa.ferocity = ferocityMaxOf(arsa.def) - 1;
    arsa.x = 1_000; arsa.y = 1_000; foe.x = 1_000; foe.y = 960;
    foe.maxHp = foe.hp = 1_000_000;
    arsa.targetId = foe.id; arsa.attackCooldown = 0;
    stepSkirmish(state, 1 / 60);
    expect(arsa.ferocityFever).toBe(true);
    expect(arsa.feverHoldGranted).toBe(0);
  });
});

describe("아르사 — 문구", () => {
  it("의 패시브·궁극기·폭주 문장이 데이터의 수를 그대로 말한다", () => {
    const arsa = getRelic("arsa");
    const passive = passiveDescription(arsa.passive);
    for (const value of ["6", "0.5", "4", "6"]) expect(passive).toContain(value);
    const ultimate = skillDescription(arsa.ultimate);
    expect(ultimate).toContain("40");
    expect(ultimate).toContain("2초");
    const fever = ferocityTraitDescription(arsa.ferocityTrait);
    for (const value of ["10", "5", "50", "1.5", "12"]) expect(fever).toContain(value);
  });
});

describe("아르사 — 끊기지 않을수록 오르는 폭주", () => {
  it("는 폭주에 든 순간 공속 +10%·흡혈 0에서 시작해 매초 오르고, 상한에서 멈춘다", () => {
    const { state } = setup();
    const [arsa] = state.fighters;
    for (const fighter of state.fighters.slice(1)) { fighter.x = 1_900; fighter.y = 100; }
    arsa.x = 100; arsa.y = 1_900;
    enterFever(state);
    arsa.feverElapsed = 0;
    expect(feverRamp(arsa)).toEqual({ attackSpeedPercent: 10, lifeStealPoints: 0 });
    arsa.feverElapsed = 4;
    expect(feverRamp(arsa)).toEqual({ attackSpeedPercent: 30, lifeStealPoints: 6 });
    arsa.feverElapsed = 20;
    expect(feverRamp(arsa)).toEqual({ attackSpeedPercent: 50, lifeStealPoints: 12 });
  });

  it("은 폭주가 끝나면 처음으로 돌아간다", () => {
    const { state } = setup();
    const [arsa] = state.fighters;
    for (const fighter of state.fighters.slice(1)) { fighter.x = 1_900; fighter.y = 100; }
    arsa.x = 100; arsa.y = 1_900;
    enterFever(state);
    for (let index = 0; index < 8; index += 1) stepSkirmish(state, 0.25);
    expect(arsa.feverElapsed).toBeCloseTo(2, 5);
    for (let index = 0; index < 40; index += 1) stepSkirmish(state, 0.25);
    expect(arsa.ferocityFever).toBe(false);
    expect(arsa.feverElapsed).toBe(0);
    expect(feverRamp(arsa)).toEqual({ attackSpeedPercent: 0, lifeStealPoints: 0 });
  });
});
