import { describe, expect, it } from "vitest";
import { FEED_BULK_PANEL, FEED_BULK_SAFE_GAP, FEED_BULK_TONES, feedBulkSparkles, feedBulkSpots } from "../../src/ui/feedBulkStyle";

const P = FEED_BULK_PANEL;
const rect = (x: number, y: number) => ({ left: x - P.button.width / 2, right: x + P.button.width / 2, top: y - P.button.height / 2, bottom: y + P.button.height / 2 });

describe("한 번에 급여 쪽지", () => {
  it("1 → 5 → 10 → MAX 차례로 위 줄 1·5, 아래 줄 10·MAX에 선다", () => {
    const spots = feedBulkSpots();
    expect(spots.map((spot) => spot.levels)).toEqual([1, 5, 10, "max"]);
    expect(spots[0].y).toBe(spots[1].y);
    expect(spots[2].y).toBe(spots[3].y);
    expect(spots[0].y).toBeLessThan(spots[2].y);
    expect(spots[0].x).toBeLessThan(spots[1].x);
  });

  it("칸 사이에는 누름 여백이 있고 모든 칸이 판 안에 든다", () => {
    const rects = feedBulkSpots().map((spot) => rect(spot.x, spot.y));
    for (let i = 0; i < rects.length; i += 1) {
      const a = rects[i];
      expect(a.left).toBeGreaterThanOrEqual(-P.width / 2 + 40);
      expect(a.right).toBeLessThanOrEqual(P.width / 2 - 40);
      expect(a.top).toBeGreaterThanOrEqual(-P.height / 2 + 40);
      expect(a.bottom).toBeLessThanOrEqual(P.height / 2 - 40);
      for (let j = i + 1; j < rects.length; j += 1) {
        const b = rects[j];
        const gapX = Math.max(b.left - a.right, a.left - b.right);
        const gapY = Math.max(b.top - a.bottom, a.top - b.bottom);
        expect(Math.max(gapX, gapY)).toBeGreaterThanOrEqual(FEED_BULK_SAFE_GAP);
      }
    }
  });

  it("단계마다 색이 다르다", () => {
    const faces = Object.values(FEED_BULK_TONES).map((tone) => tone.cream);
    expect(new Set(faces).size).toBe(4);
  });

  it("반짝이는 칸을 덮지 않고 판 안에 든다", () => {
    const rects = feedBulkSpots().map((spot) => rect(spot.x, spot.y));
    for (const spark of feedBulkSparkles()) {
      expect(Math.abs(spark.x) + spark.size).toBeLessThanOrEqual(P.width / 2);
      expect(Math.abs(spark.y) + spark.size).toBeLessThanOrEqual(P.height / 2);
      for (const r of rects) {
        const inside = spark.x + spark.size > r.left && spark.x - spark.size < r.right && spark.y + spark.size > r.top && spark.y - spark.size < r.bottom + 16;
        expect(inside).toBe(false);
      }
    }
  });
});
