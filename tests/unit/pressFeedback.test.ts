import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PRESS_FEEDBACK } from "../../src/ui/pressFeedbackStyle";
import { FEED_TAP, feedComboVisible, feedTapDrift } from "../../src/ui/feedTapStyle";

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
  it("의 조각은 난수 없이 좌우로 번갈아 비껴 뜬다", () => {
    const drifts = Array.from({ length: 6 }, (_, index) => feedTapDrift(index));
    expect(drifts).toEqual(Array.from({ length: 6 }, (_, index) => feedTapDrift(index + FEED_TAP.cake.drift.length)));
    expect(drifts.some((value) => value < 0) && drifts.some((value) => value > 0)).toBe(true);
  });

  it("의 연속 표시는 두 번째 누름부터 서고, 조각 수에는 상한이 있다", () => {
    expect(feedComboVisible(1)).toBe(false);
    expect(feedComboVisible(2)).toBe(true);
    expect(FEED_TAP.maxLiveCakes).toBeLessThan(10);
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
