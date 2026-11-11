import { describe, expect, it } from "vitest";
import { FEED_LEVEL_UP, feedBannerLetterDelay, feedLevelUpStatGains, feedSpiralPoint } from "../../src/ui/feedLevelUpStyle";
import type { Stats } from "../../src/core/types";

const stats = (overrides: Partial<Stats>): Stats => ({
  hp: 1000, atk: 100, def: 50, res: 50, ap: 80, attackSpeed: 1, moveSpeed: 1, critChance: 5, critDamage: 150, lifesteal: 0, ultimateCharge: 0, ferocityGain: 0,
  ...overrides,
} as Stats);

describe("급여 레벨업 연출", () => {
  it("오른 능력치만 오각형 순서로 고르고 0은 세우지 않는다", () => {
    const gains = feedLevelUpStatGains(stats({}), stats({ hp: 1040.4, atk: 106, res: 50.2, attackSpeed: 2 }));
    expect(gains).toEqual([{ key: "hp", gain: 40 }, { key: "atk", gain: 6 }]);
  });

  it("나선 불꽃은 위로만 오르고 두 줄기가 서로 마주 본다", () => {
    const height = 240;
    const start = feedSpiralPoint(0, 0, 0, height);
    const end = feedSpiralPoint(0, 0, 1, height);
    expect(end.y).toBeLessThan(start.y - height);
    const a = feedSpiralPoint(0, 0, 0.5, height);
    const b = feedSpiralPoint(1, 0, 0.5, height);
    expect(Math.sign(a.x)).toBe(-Math.sign(b.x));
    // 앞뒤를 오가며 SD를 감는다.
    const depths = Array.from({ length: 21 }, (_, i) => Math.sign(feedSpiralPoint(0, 0, i / 20, height).depth));
    expect(depths).toContain(1);
    expect(depths).toContain(-1);
    expect(end.alpha).toBe(0);
  });

  it("LEVEL UP! 글자는 빈칸에서 시간을 쓰지 않는다", () => {
    const word = "LEVEL UP!";
    expect(feedBannerLetterDelay(word, 6)).toBe(5 * FEED_LEVEL_UP.banner.letterMs);
    expect(feedBannerLetterDelay(word, 5)).toBe(feedBannerLetterDelay(word, 6));
  });

  it("섬광은 상한(0.6)보다 옅다", () => {
    expect(FEED_LEVEL_UP.pillar.flashAlpha).toBeLessThanOrEqual(0.6);
    expect(FEED_LEVEL_UP.hop.glow.alpha).toBeLessThanOrEqual(0.6);
  });
});

describe("전신 원화 레벨업", () => {
  it("원화는 SD보다 낮게 튀고 몸 동작을 틀지 않는다", () => {
    expect(FEED_LEVEL_UP.portrait.hop.height).toBeLessThan(FEED_LEVEL_UP.hop.height);
    expect(FEED_LEVEL_UP.portrait.hop.motion).toBe(false);
    expect(FEED_LEVEL_UP.hop.motion).toBe(true);
  });
});
