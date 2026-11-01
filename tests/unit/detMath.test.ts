import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { dAtan2, dCos, dExp, dHypot, dLog, dPow, dSin } from "../../src/core/detMath";

/**
 * 서버 재현 검증은 같은 전투를 V8(서버)과 JavaScriptCore(iOS)에서 따로 돌린다. 엔진마다 마지막 자리가 다를 수 있는
 * Math.hypot·sin·cos·atan2·exp·pow를 전투 코어가 다시 쓰지 못하게 소스 모양으로 지키고, 대체 함수가 참값에 가까운지 본다.
 */
describe("결정적 수학 함수", () => {
  it("전투 코어는 엔진 정의 수학 함수를 쓰지 않는다", () => {
    const source = readFileSync("src/core/skirmish.ts", "utf8");
    expect(source.match(/Math\.(hypot|sin|cos|atan2|exp|pow|log|tan|atan|cbrt)\(/g) ?? []).toEqual([]);
  });
  it("hypot은 sqrt(x²+y²)와 같다", () => {
    for (const [x, y] of [[3, 4], [0, 0], [-7.25, 1e-3], [812.4, -455.9]]) expect(dHypot(x, y)).toBe(Math.sqrt(x * x + y * y));
  });
  it("sin·cos는 넓은 범위에서 1e-12 안으로 맞는다", () => {
    for (let x = -400; x <= 400; x += 0.173) {
      expect(Math.abs(dSin(x) - Math.sin(x))).toBeLessThan(1e-12);
      expect(Math.abs(dCos(x) - Math.cos(x))).toBeLessThan(1e-12);
    }
  });
  it("atan2는 모든 사분면에서 맞는다", () => {
    for (let a = -3.1; a <= 3.1; a += 0.0137) for (const r of [0.01, 1, 340]) {
      const y = Math.sin(a) * r, x = Math.cos(a) * r;
      expect(Math.abs(dAtan2(y, x) - Math.atan2(y, x))).toBeLessThan(1e-12);
    }
    expect(dAtan2(0, 1)).toBe(0);
    expect(dAtan2(1, 0)).toBeCloseTo(Math.PI / 2, 12);
    expect(dAtan2(0, -1)).toBeCloseTo(Math.PI, 12);
  });
  it("exp·log·pow는 상대 오차 1e-12 안이다", () => {
    for (let x = -20; x <= 20; x += 0.37) expect(Math.abs(dExp(x) / Math.exp(x) - 1)).toBeLessThan(1e-12);
    for (const x of [1e-6, 0.3, 1, 2.5, 90, 4e5]) expect(Math.abs(dLog(x) - Math.log(x))).toBeLessThan(1e-12);
    for (const [b, e] of [[0.25, 1.7], [0.9, 0.5], [0.5, 3], [1, 9]]) expect(Math.abs(dPow(b, e) / Math.pow(b, e) - 1)).toBeLessThan(1e-12);
    expect(dPow(0, 2)).toBe(0);
    expect(dPow(7, 0)).toBe(1);
  });
});
