import { describe, expect, it } from "vitest";
import { canFireUltimate, createSkirmish, defensiveDefinition, isFighterAlive, stepSkirmish, type Arena } from "../../src/core/skirmish";
import { computeDamage } from "../../src/core/damage";
import { getRelic } from "../../src/data/relics";

const ARENA: Arena = { left: 130, right: 950, top: 600, bottom: 1360 };

/**
 * 케리스의 두 새 규칙 — 저주(저항 감소)와 광란(표적 뒤집기).
 *
 * 둘 다 화면이 아니라 코어가 소유하므로 여기서 고정한다. 특히 광란은 표적의 편을 뒤집는
 * 유일한 규칙이라, 회귀가 나면 "적이 아군을 때린다"가 아니라 **아무 일도 일어나지 않는다**로
 * 조용히 사라진다.
 */
describe("저주", () => {
  it("는 겹이 쌓일수록 저항만 깎아 마법 피해를 키운다", () => {
    const state = createSkirmish([getRelic("keris")], [getRelic("anky")], ARENA);
    const [keris, foe] = state.fighters;
    const magic = { power: 100, damageType: "magical" as const, scalingStat: "ap" as const, isCritical: false, kind: "basic" as const };
    const physical = { power: 100, damageType: "physical" as const, scalingStat: "atk" as const, isCritical: false, kind: "basic" as const };
    // 전투가 실제로 읽는 방어 정의를 그대로 쓴다 — 저주는 여기서만 저항을 깎는다.
    const cleanMagic = computeDamage(keris, defensiveDefinition(foe, state), magic, true);
    const cleanPhysical = computeDamage(keris, defensiveDefinition(foe, state), physical, true);

    foe.curse = { remaining: 8, total: 8, stacks: 3, percentPerStack: 15, maxStacks: 3 };
    // 저항만 45% 깎이므로 마법은 더 아프고 물리는 그대로다 — 덧칠과 갈리는 지점이 이것이다.
    expect(computeDamage(keris, defensiveDefinition(foe, state), magic, true)).toBeGreaterThan(cleanMagic);
    expect(computeDamage(keris, defensiveDefinition(foe, state), physical, true)).toBe(cleanPhysical);
  });

  it("는 기본 공격 세 번이면 상한에 닿고 더 쌓이지 않는다", () => {
    const state = createSkirmish([getRelic("keris")], [getRelic("anky")], ARENA);
    const [, foe] = state.fighters;
    for (let frame = 0; frame < 60 * 20 && state.phase === "fight"; frame += 1) stepSkirmish(state, 1 / 60, () => 0.99);
    expect(foe.curse === null || foe.curse.stacks <= 3).toBe(true);
  });
});

describe("저주 전이", () => {
  it("는 저주가 최대인 적을 때렸을 때만 옆으로 이어진다", () => {
    const state = createSkirmish([getRelic("keris")], [getRelic("anky"), getRelic("rex")], ARENA);
    const [keris, primary, neighbour] = state.fighters;
    // 전이는 **이번 타격이 얹기 전**의 겹으로 판정한다. 최대가 아니면 옆 적은 멀쩡하다.
    primary.curse = { remaining: 8, total: 8, stacks: 1, percentPerStack: 15, maxStacks: 3 };
    keris.targetId = primary.id;
    const untouched = neighbour.hp;
    for (let frame = 0; frame < 60 * 3 && state.phase === "fight"; frame += 1) {
      stepSkirmish(state, 1 / 60, () => 0.99);
      if (primary.curse) primary.curse.stacks = 1;
    }
    expect(neighbour.hp).toBe(untouched);

    primary.curse = { remaining: 8, total: 8, stacks: 3, percentPerStack: 15, maxStacks: 3 };
    for (let frame = 0; frame < 60 * 8 && state.phase === "fight"; frame += 1) {
      stepSkirmish(state, 1 / 60, () => 0.99);
      if (primary.curse) primary.curse.stacks = 3;
    }
    // 옆 적은 맞기만 하는 것이 아니라 저주도 함께 받는다 — 이어지는 몫의 값은 그쪽이다.
    expect(neighbour.hp).toBeLessThan(untouched);
    expect(neighbour.curse).not.toBeNull();
  });
});

describe("광란", () => {
  it("은 걸린 개체가 가장 가까운 자기 편을 때리게 만든다", () => {
    const state = createSkirmish([getRelic("keris")], [getRelic("anky"), getRelic("rex")], ARENA);
    const [, first, second] = state.fighters;
    first.frenzy = { remaining: 6, total: 6, attackSpeedPercent: 50, sourceId: state.fighters[0].id };
    const before = second.hp;
    for (let frame = 0; frame < 60 * 6 && state.phase === "fight"; frame += 1) stepSkirmish(state, 1 / 60, () => 0.99);
    expect(second.hp).toBeLessThan(before);
  });

  it("은 때릴 자기 편이 없으면 제자리에서 자신을 공격한다", () => {
    const state = createSkirmish([getRelic("keris")], [getRelic("anky")], ARENA);
    const [, lone] = state.fighters;
    lone.frenzy = { remaining: 30, total: 30, attackSpeedPercent: 50, sourceId: state.fighters[0].id };
    const before = lone.hp;
    for (let frame = 0; frame < 60 * 6 && state.phase === "fight" && isFighterAlive(lone); frame += 1) {
      stepSkirmish(state, 1 / 60, () => 0.99);
      // 광란이 풀려 케리스를 다시 노리지 않도록 시계를 계속 채운다.
      if (lone.frenzy) lone.frenzy.remaining = 30;
    }
    expect(lone.hp).toBeLessThan(before);
  });

  it("중에는 궁극기를 쓰지 못한다", () => {
    const state = createSkirmish([getRelic("keris")], [getRelic("anky")], ARENA);
    const [keris] = state.fighters;
    keris.energy = 999;
    expect(canFireUltimate(state, keris)).toBe(true);
    keris.frenzy = { remaining: 4, total: 4, attackSpeedPercent: 50 };
    // 광란한 개체의 궁극기까지 자기 편에게 꽂히면 한 판이 그 한 번으로 갈린다.
    expect(canFireUltimate(state, keris)).toBe(false);
  });
});
