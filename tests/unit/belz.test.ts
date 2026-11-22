import { describe, expect, it } from "vitest";
import { createSkirmish, fireUltimate, stepSkirmish, type Arena, type SkirmishState } from "../../src/core/skirmish";
import { combatPower } from "../../src/core/combatPower";
import { withinRarityBand } from "../../src/core/rarityScaling";
import { findKeyword } from "../../src/data/keywords";
import { getRelic } from "../../src/data/relics";
import { passiveDescription, skillDescription } from "../../src/ui/skillPresentation";

/**
 * 벨즈 — 풀 SR 중거리 지원가(B안, 응태 결정 2026-11-22).
 * 「혀 낚아채기」: 8초마다 체력 비율이 가장 낮은 다른 아군을 곁으로 끌어와 막을 두르고, 그 아군을 노리던 적의 표적을 모두 푼다.
 * 「족쇄 채찍」: 적중마다 그 주기를 0.1초 당긴다. 「꿀꺽」: 아군 한 명에게 은신(때려도 풀리지 않음)과 지속 회복을 건다.
 */
const ARENA: Arena = { left: 0, right: 2_000, top: 0, bottom: 2_000 };

function setup(): { state: SkirmishState } {
  const state = createSkirmish([getRelic("belz"), getRelic("torika"), getRelic("rex")], [getRelic("maki")], ARENA);
  for (const fighter of state.fighters) { fighter.attackCooldown = 99; fighter.stealthFor = 0; }
  const [belz, tank, dealer, foe] = state.fighters;
  belz.x = 1_000; belz.y = 1_700;
  tank.x = 800; tank.y = 1_000;
  dealer.x = 1_200; dealer.y = 1_000;
  foe.x = 1_200; foe.y = 960;
  return { state };
}

describe("벨즈 — 정체성", () => {
  it("은 풀 SR 중거리 지원가이고 앱솔루트 팽 소속이다", () => {
    const belz = getRelic("belz");
    expect([belz.rarity, belz.element, belz.role, belz.reachTier, belz.squad]).toEqual(["SR", "grass", "support", "mid", "fang"]);
    expect(belz.researcherTitle).toBe("보스");
  });

  it("은 SR 띠 안의 태생 전투력을 갖는다", () => {
    expect(withinRarityBand(combatPower(getRelic("belz").stats), "SR")).toBe(true);
  });
});

describe("벨즈 — 혀 낚아채기", () => {
  it("은 주기가 되면 체력 비율이 가장 낮은 아군을 곁으로 끌어와 막을 두르고, 그 아군을 노리던 적의 표적을 푼다", () => {
    const { state } = setup();
    const [belz, tank, dealer, foe] = state.fighters;
    tank.hp = tank.maxHp * 0.9;
    dealer.hp = dealer.maxHp * 0.3;
    foe.targetId = dealer.id;
    belz.tongueIn = 0.01;
    stepSkirmish(state, 1 / 30);
    expect(Math.hypot(dealer.x - belz.x, dealer.y - belz.y)).toBeLessThan(150);
    expect(dealer.shield.amount).toBeCloseTo(Math.round(dealer.maxHp * 0.12), -1);
    expect(foe.targetId).not.toBe(dealer.id);
    expect(belz.tongueIn).toBeGreaterThan(7.9);
    // 더 다친 쪽이 아닌 탱커는 그대로다.
    expect(tank.shield.amount).toBe(0);
  });

  it("은 체력이 가득 찬 아군뿐이면 끌어오지 않고 기다린다", () => {
    const { state } = setup();
    const [belz, tank, dealer] = state.fighters;
    const before = { x: dealer.x, y: dealer.y };
    belz.tongueIn = 0.01;
    stepSkirmish(state, 1 / 30);
    expect([dealer.x, dealer.y]).toEqual([before.x, before.y]);
    expect(tank.shield.amount + dealer.shield.amount).toBe(0);
    expect(belz.tongueIn).toBe(0);
  });

  it("의 주기를 족쇄 채찍이 적중마다 0.1초 당긴다", () => {
    const { state } = setup();
    const [belz, , , foe] = state.fighters;
    belz.x = 1_200; belz.y = 1_100; foe.x = 1_200; foe.y = 960;
    foe.maxHp = foe.hp = 1_000_000;
    belz.tongueIn = 5;
    belz.targetId = foe.id; belz.attackCooldown = 0;
    stepSkirmish(state, 1 / 60);
    expect(belz.tongueIn).toBeCloseTo(5 - 1 / 60 - 0.1, 5);
  });
});

describe("벨즈 — 꿀꺽", () => {
  it("은 체력 비율이 가장 낮은 다른 아군 한 명에게만 은신과 지속 회복을 건다", () => {
    const { state } = setup();
    const [belz, tank, dealer, foe] = state.fighters;
    dealer.hp = dealer.maxHp * 0.2;
    foe.targetId = dealer.id;
    belz.energy = 10_000;
    fireUltimate(state, belz.id);
    expect(dealer.stealthFor).toBe(3);
    expect(dealer.stealthBreaksOnBasic).toBe(false);
    expect(dealer.regeneration?.percentPerTick).toBe(6);
    expect(foe.targetId).not.toBe(dealer.id);
    expect(tank.stealthFor).toBe(0);
    expect(belz.stealthFor).toBe(0);
  });

  it("에 걸린 아군은 묶이지 않고 그대로 때린다", () => {
    const { state } = setup();
    const [belz, , dealer, foe] = state.fighters;
    dealer.hp = dealer.maxHp * 0.2;
    belz.energy = 10_000;
    fireUltimate(state, belz.id);
    foe.maxHp = foe.hp = 1_000_000;
    dealer.targetId = foe.id; dealer.attackCooldown = 0;
    stepSkirmish(state, 1 / 60);
    expect(foe.hp).toBeLessThan(foe.maxHp);
    expect(dealer.stealthFor).toBeGreaterThan(2.9);
  });

  it("의 태그 수치가 궁극기 계약과 같다", () => {
    const gulp = getRelic("belz").ultimate.teamBuff;
    expect(gulp).toEqual({ kind: "gulp", seconds: 3, healMaxHpPercentPerSecond: 6 });
    expect(findKeyword("gulp")?.description).toContain("6%");
  });
});

describe("벨즈 — 문구", () => {
  it("의 패시브·평타·궁극기 문장이 데이터의 수를 말한다", () => {
    const belz = getRelic("belz");
    const passive = passiveDescription(belz.passive);
    for (const value of ["8초", "12%"]) expect(passive).toContain(value);
    expect(skillDescription(belz.basic)).toContain("0.1초");
    const ultimate = skillDescription(belz.ultimate);
    expect(ultimate).toContain("3초");
    expect(ultimate).toContain("[[gulp|");
  });
});
