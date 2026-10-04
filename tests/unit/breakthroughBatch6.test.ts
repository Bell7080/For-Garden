import { describe, expect, it } from "vitest";
import { getRelic } from "../../src/data/relics";
import { createSkirmish, stepSkirmish } from "../../src/core/skirmish";
import { breakthroughEffectText } from "../../src/ui/skillPresentation";

describe("엘라·데이·모르페 한계 돌파", () => {
  it("돌파 효과 슬롯이 네 칸 모두 채워진다", () => {
    for (const id of ["ella", "deina", "morphe"]) {
      const effects = getRelic(id).breakthroughEffects!;
      for (const slot of ["basic", "ultimate", "ferocity", "passive"] as const) expect(effects[slot]?.kind).not.toBe("none");
    }
  });

  it("문구가 자리 표시 없이 채워진다", () => {
    for (const id of ["ella", "deina", "morphe"]) for (const slot of ["basic", "ultimate", "ferocity", "passive"] as const) {
      const text = breakthroughEffectText(getRelic(id), slot);
      expect(text).toBeTruthy();
      expect(text).not.toMatch(/\{\w+\}/);
    }
  });
});

describe("티아·테리사 보호막 개편", () => {
  const ARENA = { left: 0, right: 600, top: 0, bottom: 1_000 };

  it("테리사의 강화 평타는 4초마다 한 번이고 자신과 가장 위태로운 아군이 같은 몫을 받는다", () => {
    const state = createSkirmish([getRelic("terisa"), getRelic("torika")], [getRelic("amo")], ARENA);
    const terisa = state.fighters.find((fighter) => fighter.def.id === "terisa")!;
    const torika = state.fighters.find((fighter) => fighter.def.id === "torika")!;
    torika.hp = Math.round(torika.maxHp * 0.3);
    const grants: { at: number; fighterId: string; amount: number }[] = [];
    for (let frame = 0; frame < 15 * 60; frame += 1) {
      for (const event of stepSkirmish(state, 1 / 60)) {
        if (event.kind === "shieldGranted" && event.providerId === terisa.id) grants.push({ at: state.elapsed, fighterId: event.fighterId, amount: event.amount });
      }
    }
    const times = [...new Set(grants.map((grant) => Math.round(grant.at * 10) / 10))];
    // 4초 간격이 지켜지고(첫 발은 4초 뒤), 두 몸이 한 번에 함께 받는다.
    expect(times.length).toBeGreaterThanOrEqual(2);
    expect(times[0]).toBeGreaterThanOrEqual(4);
    for (let i = 1; i < times.length; i += 1) expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(3.9);
    expect(grants.some((grant) => grant.fighterId === terisa.id)).toBe(true);
    expect(grants.some((grant) => grant.fighterId === torika.id)).toBe(true);
  });

  it("티아의 반짝 폭발 막은 맞힌 피해가 아니라 자신의 최대 체력 6%다", () => {
    const state = createSkirmish([getRelic("tia"), getRelic("torika")], [getRelic("amo")], ARENA);
    const tia = state.fighters.find((fighter) => fighter.def.id === "tia")!;
    const amounts: number[] = [];
    for (let frame = 0; frame < 30 * 60 && amounts.length < 3; frame += 1) {
      for (const event of stepSkirmish(state, 1 / 60)) {
        if (event.kind === "shieldGranted" && event.providerId === tia.id && event.fighterId === tia.id) amounts.push(event.amount);
      }
    }
    expect(amounts.length).toBeGreaterThan(0);
    for (const amount of amounts) expect(amount).toBe(Math.round((tia.shieldHpBasis ?? tia.maxHp) * 6 / 100));
  });
});
