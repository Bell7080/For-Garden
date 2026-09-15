import { describe, expect, it } from "vitest";
import { CHARGE_AFTERIMAGE, chargeAfterimageSteps } from "../../src/ui/chargeAfterimage";
import { SKIRMISH } from "../../src/core/skirmish";
import { EFFECT_PRESETS } from "../../src/ui/effectPresets";

describe("돌진 잔상", () => {
  /*
   * **3배속에서도 지나간 길이 남아야 한다.** 그림이 출발점에서 끝점까지 따라붙는 시간은
   * 0.34초인데 배속을 그대로 받으므로 3배에서는 0.11초다 — 한 프레임에 몸 하나만 서 있으면
   * 순간이동한 뒤 푹 박은 것으로 보인다. 겹이 여럿이라야 그 한 프레임에 선이 남는다.
   */
  it("한 프레임에 선으로 읽히도록 여러 겹을 세운다", () => {
    expect(SKIRMISH.chargeGlideSeconds / 3).toBeLessThan(0.15);
    expect(chargeAfterimageSteps(-300, 0).length).toBeGreaterThanOrEqual(3);
  });

  it("출발점 쪽으로 고르게 서고 멀수록 옅어진다", () => {
    const steps = chargeAfterimageSteps(-400, 200);
    // 지나온 쪽(변위와 같은 방향)에만 선다 — 반대로 세우면 나아갈 길에 미리 몸이 서 있다.
    for (const step of steps) {
      expect(Math.sign(step.dx)).toBe(-1);
      expect(Math.sign(step.dy)).toBe(1);
    }
    // 거리는 단조 증가, 진하기는 단조 감소다. 뒤섞이면 어느 쪽에서 왔는지 밝기가 말하지 못한다.
    for (let index = 1; index < steps.length; index += 1) {
      expect(Math.hypot(steps[index].dx, steps[index].dy)).toBeGreaterThan(Math.hypot(steps[index - 1].dx, steps[index - 1].dy));
      expect(steps[index].alpha).toBeLessThan(steps[index - 1].alpha);
    }
  });

  /*
   * **가장 먼 겹이 출발점에 정확히 겹치지 않는다.** 겹치면 출발한 자리에 몸이 하나 더 서 있는
   * 것으로 보여, 지나간 잔상이 아니라 분신으로 읽힌다.
   */
  it("가장 먼 겹도 출발점에는 닿지 않는다", () => {
    const steps = chargeAfterimageSteps(-500, 0);
    const farthest = steps[steps.length - 1];
    expect(Math.abs(farthest.dx)).toBeLessThan(500);
    expect(Math.abs(farthest.dx) / 500).toBeCloseTo(CHARGE_AFTERIMAGE.reach, 5);
  });

  /*
   * **검은 실루엣이라 진하면 그 자체가 몸으로 읽힌다.** 섬광 상한과 같은 자리에 두어 정작
   * 봐야 할 SD와 피해 숫자가 잔상 속에 묻히지 않게 한다.
   */
  it("가장 진한 겹도 섬광 상한을 넘지 않는다", () => {
    const brightestFlash = Math.max(...Object.values(EFFECT_PRESETS).map((preset) => preset.flashAlpha));
    expect(CHARGE_AFTERIMAGE.nearAlpha).toBeLessThan(brightestFlash);
    expect(CHARGE_AFTERIMAGE.farAlpha).toBeGreaterThan(0);
  });

  /** 제자리에서는 세우지 않는다 — 겹만 쌓이면 몸이 두꺼워 보인다. */
  it("변위가 없으면 아무것도 세우지 않는다", () => {
    expect(chargeAfterimageSteps(0, 0)).toEqual([]);
    expect(chargeAfterimageSteps(0.4, -0.3)).toEqual([]);
  });
});
