import { describe, expect, it } from "vitest";
import { BASE_WIDTH } from "../../src/config/gameConfig";
import { LOCK_COVER, LOCK_DIM, UNLOCK_BURST, LOCK_TOAST, UNLOCK_SEQUENCE, UNLOCK_SEQUENCE_TOTAL_MS, padlockGeometry, toastWidth } from "../../src/ui/lockStyle";

describe("잠금 표", () => {
  it("개방 연출의 총 시간은 다섯 박자의 합이다", () => {
    expect(UNLOCK_SEQUENCE_TOTAL_MS).toBe(Object.values(UNLOCK_SEQUENCE).reduce((a, b) => a + b, 0));
  });

  it("자물쇠는 정사각 안에 들고 고리가 몸통 위에 선다", () => {
    const g = padlockGeometry(100);
    const xs = [g.body.x, g.body.x + g.body.width, ...g.shackle.filter((_, i) => i % 2 === 0), ...g.keyhole.filter((_, i) => i % 2 === 0)];
    const ys = [g.body.y, g.body.y + g.body.height, ...g.shackle.filter((_, i) => i % 2 === 1), ...g.keyhole.filter((_, i) => i % 2 === 1)];
    for (const x of xs) expect(Math.abs(x)).toBeLessThanOrEqual(50);
    for (const y of ys) expect(Math.abs(y)).toBeLessThanOrEqual(50);
    expect(Math.min(...g.shackle.filter((_, i) => i % 2 === 1))).toBeLessThan(g.body.y);
    expect(g.keyhole[1]).toBeGreaterThan(g.body.y);
    expect(g.keyhole[7]).toBeLessThan(g.body.y + g.body.height);
  });

  it("고리 두 다리는 몸통 안에서 끝나고, 열리는 축은 왼쪽 다리 밑동이다", () => {
    const g = padlockGeometry(100);
    const n = g.shackle.length;
    for (const legY of [g.shackle[1], g.shackle[n - 1]]) {
      expect(legY).toBeGreaterThan(g.body.y);
      expect(legY).toBeLessThan(g.body.y + g.body.height);
    }
    expect(g.pivot).toEqual({ x: g.shackle[0], y: g.shackle[1] });
    expect(g.keyslot.y + g.keyslot.height).toBeLessThan(g.body.y + g.body.height - g.body.bevel / 2);
    expect(Math.abs(g.body.x)).toBeGreaterThan(g.body.bevel);
  });

  it("토스트 판은 최소 폭을 지키고 화면 밖으로 나가지 않는다", () => {
    expect(toastWidth(10, false)).toBe(LOCK_TOAST.minWidth);
    expect(toastWidth(5000, true)).toBe(BASE_WIDTH - LOCK_TOAST.edgeMargin * 2);
    expect(toastWidth(400, true)).toBeGreaterThan(toastWidth(400, false));
  });

  it("덮개는 아래 그림이 비칠 만큼만 어둡고 터지는 섬광은 0.6 이하다", () => {
    expect(LOCK_COVER.dimAlpha).toBeLessThan(0.85);
    expect(LOCK_COVER.lockRatio).toBeLessThanOrEqual(0.6);
    expect(LOCK_DIM.plateAlpha).toBeLessThan(1);
    expect(LOCK_DIM.entranceAlpha).toBeLessThan(0.6);
    expect(UNLOCK_BURST.flashAlpha).toBeLessThanOrEqual(0.6);
  });
});
