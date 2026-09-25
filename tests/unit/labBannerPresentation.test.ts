import { describe, expect, it } from "vitest";
import { BANNERS } from "../../src/data/banners";
import { BANNER_PRESENTATION, bannerTags, bannerTenDiscountPercent } from "../../src/ui/labBannerPresentation";
import { LAB_CHROME, LAB_TITLE } from "../../src/ui/labLayout";

const banner = (id: string) => BANNERS.find((candidate) => candidate.id === id)!;

describe("연구소 모집판의 얼굴", () => {
  it("모든 배너가 제목 블록을 갖는다", () => {
    for (const candidate of BANNERS) expect(BANNER_PRESENTATION[candidate.id], candidate.id).toBeDefined();
  });

  it("픽업 배너의 제목은 픽업 렐릭의 이름이고, 꾸미는 말은 부제다", () => {
    // 이벤트 이름을 제목으로 세우면 누구를 뽑는 판인지가 부제로 밀려난다.
    for (const candidate of BANNERS) {
      const presentation = BANNER_PRESENTATION[candidate.id];
      const hasPickup = Object.values(candidate.pickupRelicIds).flat().length > 0;
      expect(presentation.title.kind, candidate.id).toBe(hasPickup ? "pickup" : "key");
      if (hasPickup) expect(presentation.subtitleKey, candidate.id).toBeDefined();
    }
  });

  it("한정 배너만 반짝이고 가장 크게 선다", () => {
    const sizes = BANNERS.map((candidate) => BANNER_PRESENTATION[candidate.id].titleSize);
    expect(BANNER_PRESENTATION.amber.titleSize).toBe(Math.max(...sizes));
    expect(BANNERS.filter((candidate) => BANNER_PRESENTATION[candidate.id].sparkles).map(({ id }) => id)).toEqual(["amber"]);
  });

  it("라벨은 배너의 성질에서 나온다", () => {
    const keys = (id: string, pity?: Parameters<typeof bannerTags>[1]) => {
      const candidate = banner(id);
      const pickups = Object.values(candidate.pickupRelicIds).flat();
      return bannerTags(candidate, pity, pickups, pickups.length > 0).map((tag) => tag.key);
    };
    expect(keys("fossil")).toEqual(["lab.tag.standard", "lab.tag.tenGuarantee"]);
    expect(keys("amber")).toEqual(["lab.tag.limited", "lab.tag.pickup", "lab.tag.limitedRelic", "lab.tag.tenGuarantee"]);
    expect(keys("welcome")).toEqual(["lab.tag.once", "lab.tag.ssrGuarantee", "lab.tag.remaining"]);
    // SSR을 이미 받았으면 확정 라벨이 사라지고 남은 횟수만 남는다.
    expect(keys("welcome", { pullsSinceSsr: 3, pickupGuaranteed: false, totalPulls: 20 })).toEqual(["lab.tag.once", "lab.tag.remaining"]);
  });

  it("할인 표식은 10연이 싼 배너에만 선다", () => {
    expect(bannerTenDiscountPercent(banner("welcome"))).toBe(20);
    expect(bannerTenDiscountPercent(banner("fossil"))).toBe(0);
    expect(bannerTenDiscountPercent(banner("amber"))).toBe(0);
  });

  it("제목 블록은 상단 줄 아래, 넘김 쪽 마름모 줄은 버튼과 하단 탭 사이에 선다", () => {
    expect(LAB_TITLE.eyebrowY).toBeGreaterThan(150);
    const pullBottom = LAB_CHROME.pull.y + LAB_CHROME.pull.size.height / 2 + 12;
    expect(LAB_TITLE.pages.y - LAB_TITLE.pages.size).toBeGreaterThan(pullBottom);
  });
});
