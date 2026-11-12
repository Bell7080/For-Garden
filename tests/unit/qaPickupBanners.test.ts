import { describe, expect, it } from "vitest";
import { BANNERS, LIMITED_RELIC_IDS, QA_PICKUP_BANNERS, researchBanners } from "../../src/data/banners";

describe("QA 전용 한정 픽업 배너", () => {
  it("일반 빌드의 목록은 BANNERS 그대로다", () => {
    expect(researchBanners(false)).toBe(BANNERS);
  });

  it("픽업으로 서 있지 않은 한정 렐릭마다 호박석 픽업 하나가 QA에만 선다", () => {
    const featured = new Set(BANNERS.flatMap((banner) => Object.values(banner.pickupRelicIds).flat()));
    const missing = [...LIMITED_RELIC_IDS].filter((id) => !featured.has(id));
    expect(QA_PICKUP_BANNERS.map((banner) => banner.featuredRelicId).sort()).toEqual(missing.sort());
    expect(missing).toContain("plesha");
    const amber = BANNERS.find(({ id }) => id === "amber")!;
    for (const banner of QA_PICKUP_BANNERS) {
      expect(banner.currency).toBe("amber");
      expect(banner.pityGroupId).toBe(amber.pityGroupId);
      expect(banner.startsAt).toBeUndefined();
      expect(banner.endsAt).toBeUndefined();
      expect(Object.values(banner.relicPools).flat()).toContain(banner.featuredRelicId);
    }
    expect(researchBanners(true).map(({ id }) => id)).toEqual([...BANNERS, ...QA_PICKUP_BANNERS].map(({ id }) => id));
  });
});
