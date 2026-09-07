import { describe, expect, it } from "vitest";
import { createSkirmish, type Fighter } from "../../src/core/skirmish";
import { getRelic } from "../../src/data/relics";
import { unitStatusViews } from "../../src/ui/unitStatusModel";

/**
 * 머리 위 칩과 그 쪽지는 같은 목록을 읽는다. 화면 두 곳이 각자 `Fighter`를 뒤지면 칩에는
 * 뜨는데 쪽지에는 없는 상태가 생기므로, 순서와 내용을 여기서 고정한다.
 */
function enemy(): Fighter {
  const state = createSkirmish([getRelic("anky")], [getRelic("amo")], { left: 130, right: 950, top: 600, bottom: 1360 });
  return state.fighters.find((fighter) => fighter.side === "enemy")!;
}

describe("머리 위 상태 목록", () => {
  it("은 걸린 것이 없으면 비어 있다", () => {
    expect(unitStatusViews(enemy())).toEqual([]);
  });

  it("은 행동을 막는 것부터 기절 · 출혈 · 덧칠 · 손질 순으로 세운다", () => {
    const target = enemy();
    target.stunnedFor = 1; target.stunnedTotal = 2;
    target.bleed = { remaining: 2, total: 3, tickIn: 1, percent: 2 };
    target.overpaint = { remaining: 5, total: 10, stacks: 3, percentPerStack: 6, maxStacks: 4 };
    target.butcher = { stacks: 2, maxStacks: 3, burstPower: 120 };
    expect(unitStatusViews(target).map(({ id }) => id)).toEqual(["stun", "bleed", "overpaint", "butcher"]);
  });

  it("은 겹치는 상태만 겹 수를 갖고, 시간이 도는 상태만 시계 값을 갖는다", () => {
    const target = enemy();
    target.overpaint = { remaining: 5, total: 10, stacks: 3, percentPerStack: 6, maxStacks: 4 };
    target.butcher = { stacks: 2, maxStacks: 3, burstPower: 120 };
    const [paint, butcher] = unitStatusViews(target);
    expect(paint.stacks).toBe(3);
    // 덧칠은 시간이 흐르면 사라지므로 시계가 절반을 가리킨다.
    expect(paint.remaining! / paint.total!).toBeCloseTo(0.5, 6);
    expect(butcher.stacks).toBe(2);
    // 손질은 시간이 흘러 사라지지 않는다 — 없는 시계를 그리면 곧 풀릴 것처럼 읽힌다.
    expect(butcher.remaining).toBeUndefined();
    expect(butcher.total).toBeUndefined();
  });

  it("은 겹 수와 남은 시간을 쪽지 한 줄로 함께 말한다", () => {
    const target = enemy();
    target.overpaint = { remaining: 5, total: 10, stacks: 3, percentPerStack: 6, maxStacks: 4 };
    // 몇 겹인지, 그래서 얼마나 더 아픈지, 언제 풀리는지 — 셋이 한 줄에 있어야 뜻이 선다.
    expect(unitStatusViews(target)[0].detail).toBe("3겹 · 받는 피해 +18% · 5초 남음");
  });

  it("은 늘어난 시계 분모가 남은 시간보다 작아지지 않게 한다", () => {
    const target = enemy();
    // 더 긴 기절로 덮이면 그 길이가 곧 새 한 바퀴다 — 분모가 더 작으면 고리가 넘친다.
    target.stunnedFor = 3; target.stunnedTotal = 1;
    const [stun] = unitStatusViews(target);
    expect(stun.total).toBeGreaterThanOrEqual(stun.remaining!);
  });

  it("은 제공자별 시약을 중독색 세 칸 계약으로 내보내고 반응 뒤 즉시 없앤다", () => {
    const target = enemy();
    target.reagents["player-0"] = { stacks: 1, remaining: 8, total: 8 };
    target.reagents["player-1"] = { stacks: 2, remaining: 7, total: 8 };
    const reagents = unitStatusViews(target).filter(({ id }) => id === "reagent");
    // 색에 의존하지 않고 stackSlots와 stacks 조합만으로 빈칸·1겹·2겹을 그릴 수 있어야 한다.
    expect(reagents).toEqual([
      expect.objectContaining({ key: "reagent:player-0", stacks: 1, stackSlots: 3, color: 0x7a4bab }),
      expect.objectContaining({ key: "reagent:player-1", stacks: 2, stackSlots: 3, color: 0x7a4bab }),
    ]);
    delete target.reagents["player-0"];
    delete target.reagents["player-1"];
    expect(unitStatusViews(target).some(({ id }) => id === "reagent")).toBe(false);
  });
});
