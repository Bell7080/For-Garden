import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PRESS_FEEDBACK } from "../../src/ui/pressFeedbackStyle";
import { FEED_TAP, feedArcPoint, feedBurstPath, feedComboVisible, feedHoldDelay } from "../../src/ui/feedTapStyle";

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? sources(path) : path.endsWith(".ts") ? [path] : [];
  });
}

describe("누르는 손맛", () => {
  it("은 눌려 들어갔다가 튕겨 돌아오고, 세기가 오를수록 더 깊고 더 튄다", () => {
    const { normal, primary, feed } = PRESS_FEEDBACK.tiers;
    for (const tier of [normal, primary, feed]) {
      expect(tier.down).toBeLessThan(1);
      expect(tier.pop).toBeGreaterThan(1);
      // 눌림은 짧게 — 손이 닿은 순간 곧바로 읽혀야 한다.
      expect(tier.downMs).toBeLessThanOrEqual(90);
    }
    expect(primary.down).toBeLessThan(normal.down);
    expect(feed.pop).toBeGreaterThan(primary.pop);
  });

  it("은 한 곳만 지난다 — 누를 때 배율을 손으로 바꾸는 자리를 다시 만들지 않는다", () => {
    const offenders = sources("src").filter((path) => /on\("pointerdown"[^\n]*\.setScale\(/.test(readFileSync(path, "utf8")));
    expect(offenders).toEqual([]);
  });
});

describe("급여 한 번의 손맛", () => {
  it("의 조각은 난수 없이 부채꼴로 벌어지고, 떨어지는 자리는 출발점보다 위다", () => {
    const paths = Array.from({ length: 3 }, (_, index) => feedBurstPath(index, 3, 1));
    expect(paths).toEqual(Array.from({ length: 3 }, (_, index) => feedBurstPath(index, 3, 1)));
    expect(paths.some((path) => path.dx < 0) && paths.some((path) => path.dx > 0)).toBe(true);
    for (const path of paths) {
      expect(path.dy).toBeLessThan(0);
      // 포물선 꼭대기는 출발점보다 높이 솟고, 끝은 착지점에 닿는다.
      expect(feedArcPoint(path, 0.5).y).toBeLessThan(path.dy);
      expect(feedArcPoint(path, 1)).toEqual({ x: path.dx, y: path.dy });
    }
    // 이어 누른 조각은 부채꼴이 비틀려 같은 자리에 겹치지 않는다.
    expect(feedBurstPath(0, 3, 0).dx).not.toBe(feedBurstPath(0, 3, 1).dx);
  });

  it("은 많이 먹일수록 많이 터진다 — 한 번 < 1레벨 < 10레벨", () => {
    const { tap, level, tenLevels } = FEED_TAP.pieces;
    expect(tap).toBeLessThan(level);
    expect(level).toBeLessThan(tenLevels);
    expect(tenLevels).toBeLessThanOrEqual(FEED_TAP.maxLiveCakes);
  });

  it("은 꾹 누를수록 빨라져 하한에서 멈춘다", () => {
    const delays = Array.from({ length: 40 }, (_, index) => feedHoldDelay(index));
    delays.slice(1).forEach((delay, index) => expect(delay).toBeLessThanOrEqual(delays[index]));
    expect(delays[0]).toBe(FEED_TAP.hold.startMs);
    expect(delays.at(-1)).toBe(FEED_TAP.hold.minMs);
  });

  it("의 연속 표시는 두 번째 누름부터 서고, 반짝임은 셋을 넘지 않는다", () => {
    expect(feedComboVisible(1)).toBe(false);
    expect(feedComboVisible(2)).toBe(true);
    expect(FEED_TAP.sparkle.count).toBeLessThanOrEqual(3);
  });
});

describe("누름 연출의 정리", () => {
  it("은 tween을 `remove()`가 아니라 `stop()`으로 멈춘다 — `TweenChain.remove()`는 인자 없이 부르면 터져 게임 루프가 멈춘다", () => {
    const source = readFileSync("src/ui/pressFeedback.ts", "utf8").replace(/\/\*\*[\s\S]*?\*\//g, "");
    expect(source).not.toMatch(/tween\??\.remove\(\)/);
    expect(source).toMatch(/tween\?\.stop\(\)/);
  });
});
