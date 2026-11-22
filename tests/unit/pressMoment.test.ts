import { describe, expect, it } from "vitest";
import {
  nextFrameInterval, nextTimingBias, pressMomentMs, shutePressLagMs, SHUTE_PRESS_LAG_MS, SHUTE_TIMING_BIAS_RANGE_MS, timingErrorMs,
} from "../../src/core/pressMoment";
import { gaugePosition } from "../../src/core/shuteFishing";

describe("리듬 판정 시각", () => {
  it("DOM 사건의 timeStamp를 쓰고, 미래·너무 먼 과거·에포크 시간축이면 지금 시각을 쓴다", () => {
    expect(pressMomentMs({ timeStamp: 960 }, 1000)).toBe(960);
    expect(pressMomentMs({ timeStamp: 1200 }, 1000)).toBe(1000);
    expect(pressMomentMs({ timeStamp: 1_700_000_000_000 }, 1000)).toBe(1000);
    expect(pressMomentMs(undefined, 1000)).toBe(1000);
  });

  it("프레임이 느린 기기일수록 더 많이 덜어 낸다 — 30fps가 60fps보다 한 프레임쯤 더 늦다", () => {
    const fps60 = shutePressLagMs(1000 / 60), fps30 = shutePressLagMs(1000 / 30);
    expect(fps60).toBeCloseTo(SHUTE_PRESS_LAG_MS + 1000 / 60, 5);
    expect(fps30 - fps60).toBeGreaterThan(15);
    // 일시 멈춤 같은 터무니없는 간격은 범위 안에 묶인다.
    expect(shutePressLagMs(5000)).toBeLessThanOrEqual(SHUTE_PRESS_LAG_MS + 50);
    expect(shutePressLagMs(1000 / 60, 999)).toBe(shutePressLagMs(1000 / 60, SHUTE_TIMING_BIAS_RANGE_MS.max));
  });

  it("프레임 간격 평균은 탭 전환 같은 긴 멈춤을 버린다", () => {
    let interval = 1000 / 60;
    for (let index = 0; index < 80; index += 1) interval = nextFrameInterval(interval, 1000 / 30);
    expect(interval).toBeGreaterThan(32);
    expect(nextFrameInterval(interval, 900)).toBe(interval);
  });

  it("칸 한가운데를 지난 가장 가까운 순간과의 차이를 잰다 — 바늘이 오가는 두 방향 모두", () => {
    const spec = { center: 0.3, sweepMs: 1000 };
    // 가는 길에 한가운데를 지나는 300ms, 돌아오는 길의 1700ms.
    expect(gaugePosition(spec.sweepMs, 300)).toBeCloseTo(0.3, 6);
    expect(timingErrorMs(spec, 340)).toBeCloseTo(40, 6);
    expect(timingErrorMs(spec, 1680)).toBeCloseTo(-20, 6);
    expect(timingErrorMs(spec, 2310)).toBeCloseTo(10, 6);
  });

  it("맞힌 누름의 쏠림만 조금씩 배우고, 빗나간 누름은 버린다", () => {
    let bias = 0;
    for (let index = 0; index < 40; index += 1) bias = nextTimingBias(bias, 50 - bias, 80);
    expect(bias).toBeGreaterThan(45);
    expect(bias).toBeLessThanOrEqual(50);
    expect(nextTimingBias(10, 200, 80)).toBe(10);
    expect(nextTimingBias(0, 1e9, Infinity)).toBeLessThanOrEqual(SHUTE_TIMING_BIAS_RANGE_MS.max);
  });
});

describe("슈테 리듬 낚시 — 멈춘 바늘이 튀지 않는다", () => {
  it("누르면 마지막으로 그린 바늘 자리 그대로 멈추고 그 값으로 판정한다(누른 시각에서 지연을 덜어 되돌려 그리지 않는다)", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync(new URL("../../src/ui/ShuteFishingPopup.ts", import.meta.url), "utf8");
    expect(source).toContain("Math.round(drawnElapsed ??");
    expect(source).toContain("frozenElapsed = elapsedMs;");
    expect(source).not.toMatch(/frozenAt\s*=\s*current\.startedAt/);
  });
});
