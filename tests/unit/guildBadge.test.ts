import { describe, expect, it } from "vitest";
import {
  DEFAULT_GUILD_BADGE, GUILD_BADGE_COLOR_IDS, GUILD_BADGE_COMBINATIONS, GUILD_BADGE_ICONS, GUILD_BADGE_ICON_POINTS,
  GUILD_BADGE_SHAPES, GUILD_BADGE_SHAPE_POINTS, isGuildBadge, normalizeGuildBadge,
} from "../../src/core/guildBadge";

describe("길드 뱃지", () => {
  it("은 배경 8 · 아이콘 12 · 색 12종이다", () => {
    expect(GUILD_BADGE_SHAPES).toHaveLength(8);
    expect(GUILD_BADGE_ICONS).toHaveLength(12);
    expect(GUILD_BADGE_COLOR_IDS).toHaveLength(12);
    expect(GUILD_BADGE_COMBINATIONS).toBe(8 * 12 * 12 * 11);
  });

  it("의 모든 도형이 점 셋 이상이고 단위 상자 안에 든다", () => {
    for (const points of [...Object.values(GUILD_BADGE_SHAPE_POINTS), ...Object.values(GUILD_BADGE_ICON_POINTS)]) {
      expect(points.length).toBeGreaterThanOrEqual(3);
      for (const [x, y] of points) {
        expect(Math.abs(x)).toBeLessThanOrEqual(1);
        expect(Math.abs(y)).toBeLessThanOrEqual(1);
      }
    }
    expect(Object.keys(GUILD_BADGE_SHAPE_POINTS).sort()).toEqual([...GUILD_BADGE_SHAPES].sort());
    expect(Object.keys(GUILD_BADGE_ICON_POINTS).sort()).toEqual([...GUILD_BADGE_ICONS].sort());
  });

  it("은 표에 없는 값과 같은 색 조합을 거절한다", () => {
    expect(isGuildBadge(DEFAULT_GUILD_BADGE)).toBe(true);
    expect(isGuildBadge({ ...DEFAULT_GUILD_BADGE, shape: "circle" })).toBe(false);
    expect(isGuildBadge({ ...DEFAULT_GUILD_BADGE, iconColor: DEFAULT_GUILD_BADGE.shapeColor })).toBe(false);
    expect(isGuildBadge(null)).toBe(false);
    expect(normalizeGuildBadge({ shape: "x" })).toEqual(DEFAULT_GUILD_BADGE);
  });
});
