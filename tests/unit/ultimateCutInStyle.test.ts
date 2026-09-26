import { describe, expect, it } from "vitest";
import { CUT_IN_HALFTONE, CUT_IN_STREAKS, CUT_IN_SWEEP, CUT_IN_TITLE, cutInPushDirection } from "../../src/ui/ultimateCutInStyle";

describe("궁극기 컷인의 결", () => {
  it("은 왼쪽 아래에서 오른쪽 위로 밀어 올린다", () => {
    const push = cutInPushDirection();
    expect(push.x).toBeGreaterThan(0);
    expect(push.y).toBeLessThan(0);
    expect(Math.hypot(push.x, push.y)).toBeCloseTo(1, 6);
  });

  it("의 도트는 밀어 올리는 방향의 반대로 흐르고, 되감을 때 이음매가 없다", () => {
    const push = cutInPushDirection();
    const { travel } = CUT_IN_HALFTONE;
    // 흐르는 칸 수의 기울기가 밀어 올리는 방향과 같은 사선이다.
    expect(travel.y / travel.x).toBeCloseTo(-push.y / push.x, 1);
    expect(Number.isInteger(travel.x) && Number.isInteger(travel.y)).toBe(true);
  });

  it("의 속도선은 차례로 떠나고 같은 무게로 겹치지 않는다", () => {
    const widths = CUT_IN_STREAKS.lines.map((line) => line.width);
    for (let index = 2; index < widths.length; index += 1) {
      expect(widths[index] === widths[index - 1] && widths[index] === widths[index - 2]).toBe(false);
    }
    expect(CUT_IN_STREAKS.staggerMs).toBeGreaterThan(0);
    expect(Math.max(...CUT_IN_STREAKS.lines.map((line) => line.alpha))).toBeLessThanOrEqual(0.6);
    expect(CUT_IN_SWEEP.alpha).toBeLessThan(0.6);
  });

  it("의 스킬 이름은 개체 이름보다 크고, 이름이 먼저 닦여 나온다", () => {
    expect(CUT_IN_TITLE.skill.size).toBeGreaterThan(CUT_IN_TITLE.name.size * 1.8);
    expect(CUT_IN_TITLE.wipe.nameDelay).toBeLessThan(CUT_IN_TITLE.wipe.skillDelay);
    expect(CUT_IN_TITLE.x + CUT_IN_TITLE.skill.maxWidth).toBeLessThanOrEqual(1080);
  });

  it("의 글자는 제 띠 안에 온전히 선다 — 닦이는 띠가 글자 위를 자르지 않는다", () => {
    const { name, skill, slash, underline, wipe } = CUT_IN_TITLE;
    // 이름은 아래쪽 기준(origin 1), 스킬 이름은 가운데 기준(origin 0.5)이다.
    expect(name.y - name.size * 1.3).toBeGreaterThanOrEqual(wipe.top);
    expect(name.y).toBeLessThanOrEqual(wipe.split);
    expect(skill.y - skill.size * 0.65).toBeGreaterThanOrEqual(wipe.split);
    expect(underline.y + underline.height + 8).toBeLessThanOrEqual(wipe.bottom);
    expect(slash.top).toBeGreaterThanOrEqual(wipe.top);
    expect(slash.bottom).toBeLessThanOrEqual(wipe.bottom);
  });
});
