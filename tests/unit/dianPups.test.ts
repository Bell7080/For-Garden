import { describe, expect, it } from "vitest";
import { createSkirmish, findFighter, fireUltimate, isFighterAlive, isPartyFighter, isPupFighter, stepSkirmish, type Arena, type SkirmishState } from "../../src/core/skirmish";
import { PUP } from "../../src/core/pup";
import { getRelic } from "../../src/data/relics";
import { breakthroughEffectText } from "../../src/ui/skillPresentation";

const ARENA: Arena = { left: 0, right: 1_000, top: 0, bottom: 1_600 };
const NEVER = () => 0.99;

function setup(breakthrough: number): SkirmishState {
  const state = createSkirmish([getRelic("dian")], [getRelic("amo")], ARENA, {}, { dian: breakthrough });
  for (const fighter of state.fighters) { fighter.attackCooldown = 999; fighter.retargetIn = 999; }
  const foe = findFighter(state, "enemy-0")!;
  foe.maxHp = 100_000_000; foe.hp = foe.maxHp; foe.x = 540; foe.y = 1_000;
  const dian = findFighter(state, "player-0")!;
  dian.x = 500; dian.y = 1_100;
  return state;
}

const pups = (state: SkirmishState) => state.fighters.filter(isPupFighter);
const standing = (state: SkirmishState) => pups(state).filter(isFighterAlive);

function basic(state: SkirmishState): void {
  const dian = findFighter(state, "player-0")!;
  dian.targetId = "enemy-0"; dian.attackCooldown = 0;
  stepSkirmish(state, 0.05, NEVER);
}

describe("디안 새끼 늑대", () => {
  it("쿠로·시로는 유체화다", () => {
    expect(getRelic("kuro").passive.phasesThroughFighters).toBe(true);
    expect(getRelic("shiro").passive.phasesThroughFighters).toBe(true);
  });

  it("은 평타 돌파를 연 디안만 열 자리를 쓰러진 채로 갖는다", () => {
    expect(pups(setup(0))).toHaveLength(0);
    const open = setup(1);
    expect(pups(open)).toHaveLength(PUP.maxAlive);
    expect(standing(open)).toHaveLength(0);
    expect(pups(open).every((pup) => !isPartyFighter(pup))).toBe(true);
  });

  it("은 평타 여섯 번마다 한 마리, 폭주 중에는 세 번마다 부른다", () => {
    const state = setup(3);
    for (let i = 0; i < 5; i += 1) basic(state);
    expect(standing(state)).toHaveLength(0);
    basic(state);
    expect(standing(state)).toHaveLength(1);
    const dian = findFighter(state, "player-0")!;
    dian.ferocityFever = true;
    for (let i = 0; i < 3; i += 1) basic(state);
    expect(standing(state)).toHaveLength(2);
  });

  it("은 동시에 열 마리를 넘지 않고 10초 뒤 사라진다", () => {
    const state = setup(2);
    const dian = findFighter(state, "player-0")!;
    for (let i = 0; i < 6; i += 1) { dian.energy = 1_000; dian.targetId = "enemy-0"; fireUltimate(state, "player-0", NEVER); }
    expect(standing(state).length).toBeLessThanOrEqual(PUP.maxAlive);
    const first = standing(state);
    expect(first.length).toBeGreaterThan(0);
    for (let t = 0; t < 24; t += 0.5) {
      for (const f of state.fighters) if (f.side === "enemy") { f.hp = f.maxHp; f.attackCooldown = 999; }
      for (const pup of standing(state)) pup.attackCooldown = 999;
      dian.attackCooldown = 999; dian.energy = 0;
      stepSkirmish(state, 0.5, NEVER);
    }
    expect(standing(state)).toHaveLength(0);
  });

  it("은 은신을 대신 지키지 않는다", () => {
    const state = setup(3);
    const dian = findFighter(state, "player-0")!;
    for (const wolf of state.fighters.filter((f) => f.summonOwnerId === "player-0" && !isPupFighter(f))) wolf.hp = 0;
    stepSkirmish(state, 0.05, NEVER);
    for (let i = 0; i < 6; i += 1) basic(state);
    expect(standing(state).length).toBeGreaterThan(0);
    expect(dian.stealthFor).toBe(0);
  });

  it("패시브 돌파는 서 있는 늑대 한 마리마다 피해가 3% 늘어난다", () => {
    const hit = (breakthrough: number): number => {
      const state = setup(breakthrough);
      const foe = findFighter(state, "enemy-0")!;
      basic(state);
      return foe.maxHp - foe.hp;
    };
    // 별 IV(세 번째 칸)까지는 패시브 효과가 없고, 별 V에서 늑대 둘(쿠로·시로)만큼 6%가 붙는다.
    expect(hit(4) / hit(3)).toBeCloseTo(1.06, 1);
  });

  it("문구가 네 슬롯 모두 자리 표시 없이 채워진다", () => {
    for (const slot of ["basic", "ultimate", "ferocity", "passive"] as const) {
      const text = breakthroughEffectText(getRelic("dian"), slot);
      expect(text).toBeTruthy();
      expect(text).not.toMatch(/\{\w+\}/);
    }
  });
});
