import { describe, expect, it } from "vitest";
import {
  BREAK_BACKDROP, backdropMotes, backdropSafeBox, backdropShards, insideSilhouette, limitCracks, limitLineSegments, limitTicks,
} from "../../src/ui/breakthroughBackdropShape";

// 한계 돌파 확정 창(폭 980)과 공명 창(폭 780)의 대표 크기 — 한계선은 등급 줄(판 위에서 112)을 지난다.
const SIZES = [{ width: 980, height: 900 }, { width: 780, height: 700 }];

describe("한계 돌파 창 뒷배경 도형", () => {
  it("한계선은 가운데가 벌어지고 깨진 끝이 위로 들린다", () => {
    for (const { width, height } of SIZES) {
      const y = -height / 2 + 112;
      const { left, right } = limitLineSegments(width, y);
      const gapEnd = BREAK_BACKDROP.limit.gap / 2;
      expect(Math.min(...left.map((p) => Math.abs(p.x)))).toBeCloseTo(gapEnd);
      expect(Math.min(...right.map((p) => Math.abs(p.x)))).toBeCloseTo(gapEnd);
      expect(left[left.length - 1].y).toBeLessThan(y);
      expect(right[right.length - 1].y).toBeLessThan(y);
      for (const point of [...left, ...right]) expect(insideSilhouette(width, height, point)).toBe(true);
    }
  });

  it("눈금은 틈 근처에 서지 않고 좌우가 마주 본다", () => {
    for (const { width } of SIZES) {
      const ticks = limitTicks(width);
      expect(ticks.length).toBeGreaterThan(4);
      for (const tick of ticks) expect(Math.abs(tick.x)).toBeGreaterThanOrEqual(BREAK_BACKDROP.limit.gap / 2 + 54);
      const xs = ticks.map((tick) => tick.x);
      for (const x of xs) expect(xs).toContain(-x);
    }
  });

  it("조각은 위로 튀고, 난수 없이 늘 같은 자리다", () => {
    const y = -350 + 112;
    const shards = backdropShards(y);
    expect(shards).toHaveLength(BREAK_BACKDROP.shards.count);
    for (const shard of shards) expect(shard.y).toBeLessThan(y);
    expect(backdropShards(y)).toEqual(shards);
    expect(limitCracks(y)).toEqual(limitCracks(y));
  });

  it("떠오르는 알갱이는 깎인 모서리를 피한 안쪽에서만 오르내린다", () => {
    for (const { width, height } of SIZES) {
      const box = backdropSafeBox(width, height);
      const motes = backdropMotes(width, height);
      expect(motes).toHaveLength(BREAK_BACKDROP.motes.count);
      for (const mote of motes) {
        expect(mote.toY).toBeLessThan(mote.fromY);
        for (const point of [{ x: mote.x, y: mote.fromY }, { x: mote.x, y: mote.toY }]) {
          expect(point.x).toBeGreaterThanOrEqual(box.left);
          expect(point.x).toBeLessThanOrEqual(box.right);
          expect(point.y).toBeGreaterThanOrEqual(box.top);
          expect(point.y).toBeLessThanOrEqual(box.bottom);
          expect(insideSilhouette(width, height, point)).toBe(true);
        }
      }
    }
  });
});
