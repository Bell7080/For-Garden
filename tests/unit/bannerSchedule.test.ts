import { describe, expect, it } from "vitest";
import { BANNERS } from "../../src/data/banners";
import { bannerActive } from "../../src/core/gacha";

describe("배너 기간과 천장", () => {
  it("기간이 없으면 늘 열려 있고, 시작 전·종료 뒤에는 닫힌다", () => {
    expect(bannerActive({}, new Date("2030-01-01T00:00:00Z"))).toBe(true);
    const b = { startsAt: "2026-11-10T00:00:00Z", endsAt: "2026-11-24T00:00:00Z" };
    expect(bannerActive(b, new Date("2026-11-09T23:59:59Z"))).toBe(false);
    expect(bannerActive(b, new Date("2026-11-10T00:00:00Z"))).toBe(true);
    expect(bannerActive(b, new Date("2026-11-24T00:00:00Z"))).toBe(false);
  });

  it("천장은 이월하지 않는다: 픽업 배너마다 천장 그룹이 다르고, 이월은 첫 복원 연구뿐이다", () => {
    const pickups = BANNERS.filter((b) => Object.keys(b.pickupRelicIds).length > 0);
    const groups = pickups.map((b) => b.pityGroupId);
    expect(new Set(groups).size).toBe(groups.length);
    for (const b of pickups) {
      expect(BANNERS.filter((o) => o.pityGroupId === b.pityGroupId)).toHaveLength(1);
    }
    expect(BANNERS.filter((b) => b.carryoverTo !== undefined).map((b) => b.id)).toEqual(["welcome"]);
  });
});
