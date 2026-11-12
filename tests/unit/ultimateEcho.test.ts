import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { echoMarkPoints, laneEchoMarks, radialEchoMarks, ULTIMATE_ECHO, ultimateEchoFrame } from "../../src/ui/ultimateEcho";
import { AREA_IMPACT } from "../../src/ui/effectPresets";

describe("궁극기 잔향", () => {
  it("본 범위보다 훨씬 오래, 실제 시간으로 머문다", () => {
    // 2배속에서도 보이게 한 것이 이 값의 뜻이다 — 본 범위(0.52초)의 세 배를 넘어야 한다.
    expect(ULTIMATE_ECHO.ms).toBeGreaterThanOrEqual(AREA_IMPACT.ultimateMs * 3);
  });

  it("녹아들고 머물다 끝에서 사라진다", () => {
    expect(ultimateEchoFrame(0).alpha).toBe(0);
    expect(ultimateEchoFrame(ULTIMATE_ECHO.fadeInUntil).alpha).toBeCloseTo(1);
    expect(ultimateEchoFrame(ULTIMATE_ECHO.holdUntil).alpha).toBeCloseTo(1);
    expect(ultimateEchoFrame(0.7).alpha).toBeLessThan(1);
    expect(ultimateEchoFrame(1).alpha).toBeCloseTo(0);
    // 빠지는 동안 한 번도 다시 진해지지 않는다.
    let last = 1;
    for (let t = ULTIMATE_ECHO.holdUntil; t <= 1; t += 0.05) {
      const alpha = ultimateEchoFrame(t).alpha;
      expect(alpha).toBeLessThanOrEqual(last + 1e-9);
      last = alpha;
    }
  });

  it("움직임 줄이기에서는 번지지도 가라앉지도 않는다", () => {
    const still = ultimateEchoFrame(0.5, 0);
    expect(still.edgeScale).toBe(1);
    for (const ring of still.settle) expect(ring.scale).toBe(ULTIMATE_ECHO.settle.from);
    const moving = ultimateEchoFrame(0.5, 1);
    expect(moving.edgeScale).toBeGreaterThan(1);
  });

  it("자국은 범위 안에 들고 난수 없이 늘 같은 자리다", () => {
    const radius = 360;
    const marks = radialEchoMarks(radius, AREA_IMPACT.squash);
    expect(marks).toEqual(radialEchoMarks(radius, AREA_IMPACT.squash));
    expect(marks).toHaveLength(ULTIMATE_ECHO.marks.count);
    for (const mark of marks) {
      for (const point of echoMarkPoints(mark, AREA_IMPACT.squash)) {
        // 눌린 마름모 안: |x|/r + |y|/(r·squash) ≤ 1
        expect(Math.abs(point.x) / radius + Math.abs(point.y) / (radius * AREA_IMPACT.squash)).toBeLessThanOrEqual(1);
      }
    }
    const lane = laneEchoMarks({ x: 0, y: 0 }, { x: 400, y: 100 }, 90, AREA_IMPACT.squash);
    expect(lane).toHaveLength(ULTIMATE_ECHO.marks.count);
    for (const mark of lane) expect(mark.x).toBeGreaterThan(-90);
  });

  it("궁극기 범위만 잔향을 남기고, 색은 시전자의 두 색이다", () => {
    const scene = readFileSync("src/scenes/BattleScene.ts", "utf8");
    expect(scene).toMatch(/caster \? \{ key: caster\.fighter\.id, palette: this\.palette\(caster\) \}/);
    const effects = readFileSync("src/managers/EffectManager.ts", "utf8");
    expect(effects).toMatch(/if \(request\.ultimate && echo\) this\.ultimateEcho/);
  });
});
