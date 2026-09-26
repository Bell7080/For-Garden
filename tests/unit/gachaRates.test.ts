import { describe, expect, it } from "vitest";
import { formatRatePercent, gachaRateTable, RATE_TIERS } from "../../src/core/gachaRateTable";
import { BANNERS, getBanner } from "../../src/data/banners";
import { GACHA_RATES, gachaRatesPopupHeight, gachaRatesRowCount, gachaRatesSlots, gachaRatesTierScreenY } from "../../src/ui/gachaRatesLayout";
import { BACK_BUTTON_SIZE, BACK_SLOT } from "../../src/ui/popupGeometry";

describe("연구 확률표", () => {
  it("등급 네 줄의 합은 1이고, 각 등급의 세부 확률 합은 그 등급 확률과 같다", () => {
    for (const banner of BANNERS) {
      const table = gachaRateTable(banner);
      expect(table.map((row) => row.tier)).toEqual([...RATE_TIERS]);
      expect(table.reduce((sum, row) => sum + row.rate, 0)).toBeCloseTo(1, 10);
      for (const row of table) {
        expect(row.entries.reduce((sum, entry) => sum + entry.rate, 0)).toBeCloseTo(row.rate, 12);
      }
    }
  });

  it("세부 줄은 배너의 풀을 빠짐없이 한 번씩 담는다", () => {
    for (const banner of BANNERS) {
      const table = gachaRateTable(banner);
      for (const tier of ["SSR", "SR", "R"] as const) {
        const ids = table.find((row) => row.tier === tier)!.entries.map((entry) => entry.kind === "relic" ? entry.relicId : "");
        expect([...ids].sort()).toEqual([...banner.relicPools[tier]].sort());
      }
      expect(table.find((row) => row.tier === "GRAY")!.entries).toHaveLength(banner.grayRewards.length);
    }
  });

  it("호박석 연구의 픽업은 맨 위에 서고 SSR 확률의 절반을 혼자 갖는다", () => {
    const banner = getBanner("amber");
    const ssr = gachaRateTable(banner).find((row) => row.tier === "SSR")!;
    const [first, ...rest] = ssr.entries;
    expect(first).toMatchObject({ kind: "relic", relicId: "dian", pickup: true });
    expect(first.rate).toBeCloseTo(banner.slotRates.SSR * banner.pickupRate, 12);
    expect(rest.every((entry) => entry.kind === "relic" && !entry.pickup)).toBe(true);
    expect(formatRatePercent(first.rate)).toBe("1.5");
    expect(formatRatePercent(rest[0].rate)).toBe("0.15");
  });

  it("픽업이 없는 배너는 풀 안이 균등하다", () => {
    const welcome = gachaRateTable(getBanner("welcome")).find((row) => row.tier === "SSR")!;
    expect(new Set(welcome.entries.map((entry) => entry.rate)).size).toBe(1);
    expect(formatRatePercent(welcome.entries[0].rate)).toBe("0.25");
  });

  it("표기는 셋째 자리까지이고 뒤의 0을 지운다", () => {
    expect(formatRatePercent(0.01)).toBe("1");
    expect(formatRatePercent(0.0055)).toBe("0.55");
    expect(formatRatePercent(0.22 / 3)).toBe("7.333");
    expect(formatRatePercent(0)).toBe("0");
    expect(formatRatePercent(0.000001)).toBe("<0.001");
  });

  it("가장 큰 풀을 펼쳐도 창이 세로 화면 안에 든다", () => {
    const largest = Math.max(...BANNERS.flatMap((banner) => gachaRateTable(banner).map((row) => gachaRatesRowCount(row.entries.map((entry) => ({ pickup: entry.kind === "relic" && entry.pickup }))))));
    // 규칙 글은 언어마다 줄 수가 달라 넉넉히 여덟 줄(두 줄로 접히는 줄 포함)을 잡는다.
    const notes = 8 * (GACHA_RATES.notesSize + 10) * 1.3;
    expect(gachaRatesPopupHeight(RATE_TIERS.length, largest, notes)).toBeLessThanOrEqual(GACHA_RATES.maxHeight);
  });
});

describe("확률표 칸 배치", () => {
  it("픽업은 한 줄을 통째로 갖고, 다섯을 넘는 나머지는 두 칸으로 선다", () => {
    const entries = [{ pickup: true }, ...Array.from({ length: 10 }, () => ({ pickup: false }))];
    const slots = gachaRatesSlots(entries);
    expect(slots[0]).toEqual({ index: 0, row: 0, column: 0, span: 2 });
    expect(slots.slice(1).every((slot) => slot.span === 1)).toBe(true);
    expect(gachaRatesRowCount(entries)).toBe(6);
    expect(gachaRatesRowCount([{}, {}, {}])).toBe(3);
  });
});

describe("확률표 창 자리", () => {
  it("판 아랫변은 판 밖 뒤로가기 위에서 끝난다", () => {
    expect(GACHA_RATES.screenTop + GACHA_RATES.maxHeight).toBeLessThan(BACK_SLOT.y - BACK_BUTTON_SIZE / 2);
  });

  it("펼쳐도 그 위의 등급 줄은 제자리에 남는다", () => {
    expect(gachaRatesTierScreenY(0, 0, 6)).toBe(gachaRatesTierScreenY(0, null, 0));
    expect(gachaRatesTierScreenY(1, 0, 6) - gachaRatesTierScreenY(1, null, 0)).toBe(6 * GACHA_RATES.entryStep + GACHA_RATES.entryPad * 2);
  });
});
