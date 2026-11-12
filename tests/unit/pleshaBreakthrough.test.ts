import { describe, expect, it } from "vitest";
import { getRelic } from "../../src/data/relics";
import { createSkirmish, fireUltimate, stepSkirmish, type SkirmishEvent, type SkirmishState } from "../../src/core/skirmish";
import { breakthroughEffectText } from "../../src/ui/skillPresentation";

const ARENA = { left: 0, right: 600, top: 0, bottom: 1_000 };
const ALWAYS = () => 0;

function setup(breakthrough: number): SkirmishState {
  return createSkirmish([getRelic("plesha"), getRelic("torika"), getRelic("rex")], [getRelic("amo"), getRelic("ripa")], ARENA, {}, { plesha: breakthrough });
}

function plesha(state: SkirmishState) {
  return state.fighters.find((fighter) => fighter.def.id === "plesha")!;
}

/** 지정 반경의 범위 사건 중 플레샤가 낸 것만 센다. */
function impacts(events: SkirmishEvent[], attackerId: string, radius: number): number {
  return events.filter((event) => event.kind === "areaImpact" && event.attackerId === attackerId
    && event.area.shape === "radial" && Math.abs(event.area.radius - radius) < 1e-6).length;
}

describe("플레샤 한계 돌파", () => {
  it("네 칸 모두 채워지고 문구에 자리 표시가 남지 않는다", () => {
    const effects = getRelic("plesha").breakthroughEffects!;
    for (const slot of ["basic", "ultimate", "ferocity", "passive"] as const) {
      expect(effects[slot]).toBeDefined();
      const text = breakthroughEffectText(getRelic("plesha"), slot);
      expect(text).toBeTruthy();
      expect(text).not.toMatch(/\{\w+\}/);
    }
  });

  it("평타 돌파가 열리면 주기와 무관하게 확률로 유성이 더 떨어진다", () => {
    const count = (breakthrough: number) => {
      const state = setup(breakthrough);
      const self = plesha(state);
      let landed = 0;
      for (let frame = 0; frame < 6 * 60; frame += 1) landed += impacts(stepSkirmish(state, 1 / 60, ALWAYS), self.id, 150);
      return landed;
    };
    expect(count(4)).toBeGreaterThan(count(0));
  });

  it("궁극기 돌파는 유성을 한 번 더 떨어뜨리고 원 안 아군 회복을 키운다", () => {
    const run = (breakthrough: number) => {
      const state = setup(breakthrough);
      const self = plesha(state);
      const ally = state.fighters.find((fighter) => fighter.def.id === "torika")!;
      const foe = state.fighters.find((fighter) => fighter.side === "enemy")!;
      ally.x = foe.x; ally.y = foe.y; ally.hp = Math.round(ally.maxHp * 0.2);
      self.energy = 1_000;
      const events = fireUltimate(state, self.id);
      for (let frame = 0; frame < 3 * 60; frame += 1) events.push(...stepSkirmish(state, 1 / 60));
      const strikes = impacts(events, self.id, self.def.ultimate.radius ?? 0);
      return { strikes, ally };
    };
    expect(run(4).strikes).toBe(run(0).strikes + 1);
  });

  it("궁극기 유성은 기본부터 준 피해로 가장 다친 아군을 회복하고, 원 안 아군 회복은 돌파에서만 붙는다", () => {
    const heals = (breakthrough: number, inCircle: boolean) => {
      const state = setup(breakthrough);
      const self = plesha(state);
      const ally = state.fighters.find((fighter) => fighter.def.id === "torika")!;
      const foe = state.fighters.find((fighter) => fighter.side === "enemy")!;
      ally.hp = Math.round(ally.maxHp * 0.2);
      if (inCircle) { ally.x = foe.x; ally.y = foe.y; }
      self.energy = 1_000;
      const events = fireUltimate(state, self.id);
      return events.filter((event) => event.kind === "heal" && event.fighterId === ally.id && event.amount > 0).length;
    };
    // 원 밖이어도 유성 피해에서 나온 회복이 가장 다친 아군에게 간다.
    expect(heals(0, false)).toBeGreaterThan(0);
    // 기본 궁극기는 원 안에 서 있다고 더 받지 않는다 — 원 안 회복은 돌파 몫이다.
    expect(heals(0, true)).toBe(heals(0, false));
    expect(heals(4, true)).toBeGreaterThan(heals(0, true));
  });

  it("폭주 돌파는 폭주에 들어서는 순간 아군 모두의 공격 속도를 올린다", () => {
    const state = setup(4);
    const self = plesha(state);
    self.ferocity = 99.9;
    for (let frame = 0; frame < 5 * 60 && !self.ferocityFever; frame += 1) stepSkirmish(state, 1 / 60);
    expect(self.ferocityFever).toBe(true);
    for (const ally of state.fighters.filter((fighter) => fighter.side === "player" && fighter.hp > 0)) {
      expect(ally.tailwind?.attackSpeedPercent).toBe(30);
      expect(ally.tailwindFor).toBeGreaterThan(0);
    }
  });

  it("패시브 돌파는 유성 회복을 다친 아군 한 명에게 한 번 더 준다", () => {
    const healedIds = (breakthrough: number) => {
      const state = setup(breakthrough);
      const self = plesha(state);
      for (const ally of state.fighters.filter((fighter) => fighter.side === "player" && fighter.id !== self.id)) ally.hp = Math.round(ally.maxHp * 0.3);
      const ids = new Set<string>();
      for (let frame = 0; frame < 20 * 60; frame += 1) {
        const events = stepSkirmish(state, 1 / 60, ALWAYS);
        if (impacts(events, self.id, 150) === 0) continue;
        for (const event of events) if (event.kind === "heal" && event.source === "passive") ids.add(event.fighterId);
        if (ids.size > 0) break;
      }
      return ids.size;
    };
    expect(healedIds(0)).toBe(1);
    expect(healedIds(4)).toBe(2);
  });
});
