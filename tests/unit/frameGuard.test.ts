import { describe, expect, it, vi } from "vitest";
import { guardFrame } from "../../src/core/frameGuard";

describe("프레임 보호", () => {
  it("예외가 나도 던지지 않고 알리며, 다음 프레임은 정상 실행된다", () => {
    let calls = 0;
    const onError = vi.fn();
    const frame = guardFrame(() => { calls += 1; if (calls === 1) throw new Error("한 번"); }, onError, vi.fn());
    expect(() => frame()).not.toThrow();
    frame();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(calls).toBe(2);
  });

  it("연속 실패가 기준에 닿으면 멈춤 신호를 한 번만 내고, 성공하면 다시 센다", () => {
    let fail = true;
    const onStuck = vi.fn();
    const frame = guardFrame(() => { if (fail) throw new Error("계속"); }, vi.fn(), onStuck, 3);
    for (let i = 0; i < 5; i += 1) frame();
    expect(onStuck).toHaveBeenCalledTimes(1);
    fail = false; frame(); fail = true;
    for (let i = 0; i < 3; i += 1) frame();
    expect(onStuck).toHaveBeenCalledTimes(2);
  });

  it("인자를 그대로 넘긴다", () => {
    const seen: number[] = [];
    guardFrame((time: number, delta: number) => { seen.push(time, delta); }, vi.fn(), vi.fn())(10, 16);
    expect(seen).toEqual([10, 16]);
  });
});
