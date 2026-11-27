import { describe, expect, it } from "vitest";
import { createSkirmish, fireUltimate, gainFerocity, stepSkirmish, type Arena, type SkirmishEvent, type SkirmishState } from "../../src/core/skirmish";
import { ferocityMaxOf } from "../../src/core/ferocity";
import { BREAKTHROUGH_STEPS } from "../../src/core/relicProgression";
import { getRelic } from "../../src/data/relics";
import { breakthroughEffectText, ferocityTraitDescription } from "../../src/ui/skillPresentation";

/**
 * 벨즈·아르의 폭주 손질과 한계 돌파(응태 결정 2026-11-23).
 * 벨즈: 폭주 중 평타가 혀를 0.5초 당긴다 · I 평타 0.25초 · II 뱉을 때 막 15% · III 폭주 진입 즉시 두 배 혀 · IV 위기 즉시 혀(10초 잠금).
 * 아르: I 세 번째 출혈에 둔화 · II 돌진 끝자리 충격 · III 폭주가 +30%에서 시작 · IV 폭주가 끝나도 야성 30%가 남는다.
 */
const ARENA: Arena = { left: 0, right: 2_000, top: 0, bottom: 2_000 };
const MAX = BREAKTHROUGH_STEPS.length;

function belzSetup(breakthrough: number): SkirmishState {
  const state = createSkirmish([getRelic("belz"), getRelic("torika"), getRelic("rexia")], [getRelic("maki")], ARENA, {}, { belz: breakthrough });
  for (const fighter of state.fighters) { fighter.attackCooldown = 99; fighter.stealthFor = 0; }
  const [belz, tank, dealer, foe] = state.fighters;
  belz.x = 1_000; belz.y = 1_700;
  tank.x = 800; tank.y = 1_000;
  dealer.x = 1_200; dealer.y = 1_000;
  foe.x = 1_200; foe.y = 960;
  foe.maxHp = foe.hp = 1_000_000;
  return state;
}

describe("벨즈 — 폭주 「배고파요」", () => {
  it("는 폭주 중 평타 적중마다 혀의 주기를 0.5초 당긴다", () => {
    const state = belzSetup(0);
    const [belz, , , foe] = state.fighters;
    belz.x = 1_200; belz.y = 1_100;
    belz.ferocityFever = true;
    belz.tongueIn = 5;
    belz.targetId = foe.id; belz.attackCooldown = 0;
    stepSkirmish(state, 1 / 60);
    expect(belz.tongueIn).toBeCloseTo(5 - 1 / 60 - 0.5, 5);
  });

  it("의 설명이 공속과 0.5초를 함께 말한다", () => {
    const text = ferocityTraitDescription(getRelic("belz").ferocityTrait);
    expect(text).toContain("40%");
    expect(text).toContain("0.5초");
  });
});

describe("벨즈 — 한계 돌파", () => {
  it("I 「조여드는 족쇄」는 평타가 혀를 0.25초 당긴다", () => {
    const state = belzSetup(1);
    const [belz, , , foe] = state.fighters;
    belz.x = 1_200; belz.y = 1_100;
    belz.tongueIn = 5;
    belz.targetId = foe.id; belz.attackCooldown = 0;
    stepSkirmish(state, 1 / 60);
    expect(belz.tongueIn).toBeCloseTo(5 - 1 / 60 - 0.25, 5);
  });

  it("II 「퉤!」는 꿀꺽이 끝날 때 숨겼던 아군에게 그 최대 체력의 15% 막을 씌운다", () => {
    const state = belzSetup(MAX);
    const [belz, , dealer] = state.fighters;
    // 30% 위에 두어 IV(위기 즉시 혀)가 끼지 않게 한다.
    dealer.hp = dealer.maxHp * 0.4;
    belz.energy = 10_000;
    belz.tongueIn = 99;
    fireUltimate(state, belz.id);
    expect(dealer.shield.amount).toBe(0);
    for (let i = 0; i < 200; i += 1) stepSkirmish(state, 1 / 60);
    expect(dealer.shield.amount).toBeCloseTo(Math.round(dealer.maxHp * 0.15), -1);
  });

  it("II는 열리기 전에는 뱉어도 막이 없다", () => {
    const state = belzSetup(1);
    const [belz, , dealer] = state.fighters;
    dealer.hp = dealer.maxHp * 0.2;
    belz.energy = 10_000;
    belz.tongueIn = 99;
    fireUltimate(state, belz.id);
    for (let i = 0; i < 200; i += 1) stepSkirmish(state, 1 / 60);
    expect(dealer.shield.amount).toBe(0);
  });

  it("III 「덥석」은 폭주에 들어서는 순간 두 배 막의 혀가 나간다", () => {
    const state = belzSetup(MAX);
    const [belz, , dealer] = state.fighters;
    dealer.hp = dealer.maxHp * 0.5;
    belz.tongueIn = 6;
    const events: SkirmishEvent[] = [];
    gainFerocity(belz, ferocityMaxOf(belz.def), state, events);
    expect(belz.ferocityFever).toBe(true);
    expect(dealer.shield.amount).toBeCloseTo(Math.round(dealer.maxHp * 0.24), -1);
    expect(belz.tongueIn).toBe(8);
  });

  it("IV 「아직 계약 기간」은 아군이 30% 아래로 떨어지면 곧바로 혀가 나가고, 10초 동안은 다시 곧바로 나가지 않는다", () => {
    const state = belzSetup(MAX);
    const [belz, tank, dealer] = state.fighters;
    belz.tongueIn = 6;
    dealer.hp = dealer.maxHp * 0.25;
    stepSkirmish(state, 1 / 60);
    expect(dealer.shield.amount).toBeGreaterThan(0);
    expect(belz.tongueIn).toBeGreaterThan(7.9);
    // 곧바로 다른 아군이 위기에 빠져도 잠금 시간 안이면 주기를 기다린다.
    belz.tongueIn = 6;
    tank.hp = tank.maxHp * 0.2;
    stepSkirmish(state, 1 / 60);
    expect(tank.shield.amount).toBe(0);
  });

  it("IV는 열리기 전에는 위기에도 주기를 기다린다", () => {
    const state = belzSetup(3);
    const [belz, , dealer] = state.fighters;
    belz.tongueIn = 6;
    dealer.hp = dealer.maxHp * 0.25;
    stepSkirmish(state, 1 / 60);
    expect(dealer.shield.amount).toBe(0);
  });

  it("의 문장이 데이터의 수를 말한다", () => {
    const belz = getRelic("belz");
    expect(breakthroughEffectText(belz, "basic")).toContain("0.25초");
    expect(breakthroughEffectText(belz, "ultimate")).toContain("15%");
    expect(breakthroughEffectText(belz, "ferocity")).toContain("2배");
    const passive = breakthroughEffectText(belz, "passive")!;
    expect(passive).toContain("30%");
    expect(passive).toContain("10초");
  });
});

function arSetup(breakthrough: number): SkirmishState {
  const state = createSkirmish([getRelic("ar")], [getRelic("amo"), getRelic("amo")], ARENA, {}, { ar: breakthrough });
  for (const fighter of state.fighters) { fighter.attackCooldown = 99; fighter.stealthFor = 0; fighter.maxHp = fighter.hp = 1_000_000; }
  return state;
}

describe("아르 — 한계 돌파", () => {
  it("I은 세 번째 평타의 출혈과 함께 둔화를 건다", () => {
    const state = arSetup(1);
    const [ar, foe] = state.fighters;
    ar.x = 1_000; ar.y = 1_000; foe.x = 1_000; foe.y = 960;
    state.fighters[2].x = 100; state.fighters[2].y = 100;
    for (let hit = 0; hit < 3; hit += 1) {
      ar.targetId = foe.id; ar.attackCooldown = 0;
      stepSkirmish(state, 1 / 60);
    }
    expect(foe.bleed).toBeTruthy();
    expect(foe.chill?.stacks ?? 0).toBeGreaterThan(0);
  });

  it("II는 돌진이 멈춘 자리 주위의 적에게 한 번 더 피해를 준다", () => {
    const run = (breakthrough: number): number => {
      const state = arSetup(breakthrough);
      const [ar, near, far] = state.fighters;
      ar.x = 1_000; ar.y = 1_150;
      near.x = 1_000; near.y = 1_000;
      far.x = 1_120; far.y = 1_000;
      ar.energy = 10_000;
      ar.targetId = near.id;
      fireUltimate(state, ar.id);
      for (let i = 0; i < 60; i += 1) stepSkirmish(state, 1 / 60);
      return far.maxHp - far.hp + near.maxHp - near.hp;
    };
    expect(run(MAX)).toBeGreaterThan(run(1));
  });

  it("III은 폭주의 공속 상승이 30%에서 시작하고 IV는 폭주가 끝나도 야성 30%를 남긴다", () => {
    const state = arSetup(MAX);
    const [ar] = state.fighters;
    const events: SkirmishEvent[] = [];
    gainFerocity(ar, ferocityMaxOf(ar.def), state, events);
    expect(ar.ferocityFever).toBe(true);
    for (let i = 0; i < 60 * 20 && ar.ferocityFever; i += 1) stepSkirmish(state, 1 / 60);
    expect(ar.ferocityFever).toBe(false);
    expect(ar.ferocity).toBeGreaterThanOrEqual(ferocityMaxOf(ar.def) * 0.3 - 0.01);
  });

  it("의 문장이 데이터의 수를 말한다", () => {
    const ar = getRelic("ar");
    expect(breakthroughEffectText(ar, "basic")).toContain("30%");
    expect(breakthroughEffectText(ar, "ferocity")).toContain("30%");
    expect(breakthroughEffectText(ar, "passive")).toContain("30%");
    expect(breakthroughEffectText(ar, "ultimate")).toContain("「포식자의 돌진」");
  });
});
