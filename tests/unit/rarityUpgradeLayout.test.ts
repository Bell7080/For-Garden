import { describe, expect, it } from "vitest";
import {
  RARITY_UPGRADE_CARD,
  RARITY_UPGRADE_REDUCED_RATIO,
  RARITY_UPGRADE_SIZE,
  RARITY_UPGRADE_TAP_LOCK_MS,
  RARITY_UPGRADE_TIMELINE,
  risingDuration,
  totalDuration,
} from "../../src/ui/rarityUpgradeLayout";

describe("등급 상승 깜짝 연출의 박자", () => {
  it("터지기 전이 터진 뒤보다 길어야 '잠잠하다 팅'이 읽힌다", () => {
    expect(risingDuration(false)).toBeGreaterThan(RARITY_UPGRADE_TIMELINE.ting + RARITY_UPGRADE_TIMELINE.hold);
  });

  it("움직임 줄이기는 앞 막만 줄이고 터지는 순간과 머무는 시간은 그대로다", () => {
    expect(risingDuration(true)).toBe(Math.round(risingDuration(false) * RARITY_UPGRADE_REDUCED_RATIO));
    expect(totalDuration(true) - risingDuration(true)).toBe(totalDuration(false) - risingDuration(false));
  });

  it("터진 뒤 누름 잠금은 머무는 시간 안에 풀린다", () => {
    expect(RARITY_UPGRADE_TAP_LOCK_MS).toBeLessThan(RARITY_UPGRADE_TIMELINE.hold);
  });

  it("카드가 화면 안에 선다", () => {
    expect(RARITY_UPGRADE_CARD.x - RARITY_UPGRADE_CARD.width / 2).toBeGreaterThan(0);
    expect(RARITY_UPGRADE_CARD.x + RARITY_UPGRADE_CARD.width / 2).toBeLessThan(RARITY_UPGRADE_SIZE.width);
    expect(RARITY_UPGRADE_CARD.y + RARITY_UPGRADE_CARD.height / 2).toBeLessThan(RARITY_UPGRADE_SIZE.height);
  });
});
