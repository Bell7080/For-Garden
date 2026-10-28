import { describe, expect, it } from "vitest";
import { activeCombatBuffs, createSkirmish, type Fighter } from "../../src/core/skirmish";
import { getRelic } from "../../src/data/relics";
import { combatBuffStatusViews, unitStatusViews } from "../../src/ui/unitStatusModel";

/**
 * 원정 증강·룬·돌파가 얹는 버프는 계산에만 있고 칩에는 없던 것이 많았다. 파치의 4타처럼
 * 다음 한 방까지 몇 대째인지가 칩 우하단에 서야 한다 — 그 목록을 여기서 고정한다.
 */
const ARENA = { left: 130, right: 950, top: 600, bottom: 1360 };

function setup(effects: Parameters<typeof createSkirmish>[5] = {}) {
  const state = createSkirmish([getRelic("torika")], [getRelic("amo")], ARENA, {}, {}, effects);
  const ally = state.fighters.find((fighter) => fighter.side === "player")!;
  const enemy = state.fighters.find((fighter) => fighter.side === "enemy")!;
  return { state, ally, enemy };
}

describe("원정·키트 버프 칩", () => {
  it("은 가속을 시간제 칩으로, 한 바퀴를 시계로 세운다", () => {
    const { state, ally } = setup();
    ally.traitHaste = { remaining: 2, attackSpeedPercent: 20, moveSpeedPercent: 10, total: 4 };
    const chip = activeCombatBuffs(state, ally.id).find((buff) => buff.name === "가속");
    expect(chip?.timing).toEqual({ kind: "timed", remainingSeconds: 2, totalSeconds: 4 });
  });

  it("은 N번째 기본 공격 증강의 카운터를 파치처럼 겹 수로 세운다", () => {
    const { state, ally } = setup({ augmentEffects: [{ kind: "nthBasicBonusPercent", percent: 40, everyN: 4, scope: { kind: "all" } }] });
    ally.traitBasicCount = 6;
    const chip = activeCombatBuffs(state, ally.id).find((buff) => buff.name === "연타 강화");
    expect(chip?.stacks).toBe(2);
    // 방금 터진 순간(나머지 0)에는 칩을 비워 사라졌다 다시 서는 것이 발동으로 읽히게 한다.
    ally.traitBasicCount = 8;
    expect(activeCombatBuffs(state, ally.id).some((buff) => buff.name === "연타 강화")).toBe(false);
  });

  it("은 아무것도 없으면 새 칩을 세우지 않는다", () => {
    const { state, ally } = setup();
    const names = activeCombatBuffs(state, ally.id).map((buff) => buff.name);
    for (const name of ["가속", "처치 가속", "지속 회복", "방어 강화", "연타 강화", "첫 일격"]) expect(names).not.toContain(name);
  });
});

describe("머리 위 디버프 칩", () => {
  function target(): Fighter {
    return setup().enemy;
  }

  it("은 갉인 방어를 겹 수와 시계로 세운다", () => {
    const enemy = target();
    enemy.bt.fangShave = { remaining: 1, stacks: 3, percentPerStack: 5, total: 4 };
    const view = unitStatusViews(enemy).find((entry) => entry.id === "fangShave");
    expect(view?.stacks).toBe(3);
    expect(view!.remaining! / view!.total!).toBeCloseTo(0.25, 6);
  });

  it("은 사냥감 표식과 저항 붕괴를 세운다", () => {
    const enemy = target();
    enemy.bt.quarry = { remaining: 2, percent: 15, total: 5 };
    enemy.reagentResistanceReductions = { a: { amount: 12, remaining: 3, total: 6 } };
    const ids = unitStatusViews(enemy).map(({ id }) => id);
    expect(ids).toContain("quarry");
    expect(ids).toContain("resistShred");
  });

  it("은 프로필이 없는 적의 자기 버프를 머리 위 칩으로 옮긴다", () => {
    const { state, enemy } = setup();
    enemy.traitHaste = { remaining: 2, attackSpeedPercent: 20, moveSpeedPercent: 10, total: 4 };
    const views = combatBuffStatusViews(activeCombatBuffs(state, enemy.id));
    const haste = views.find((view) => view.name === "가속");
    expect(haste?.id).toBe("selfBuff");
    expect(haste?.key?.startsWith("buff:")).toBe(true);
  });
});
