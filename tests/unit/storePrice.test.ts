import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PREMIUM_PRODUCTS } from "../../src/data/premiumProducts";
import { convertStorePrice, currencyForRegion, formatStorePrice, KRW_PER_UNIT, regionFromLanguageTags } from "../../src/core/storePrice";

describe("유료 상품 가격 표기", () => {
  it("한국 기기는 원화 그대로 보인다", () => {
    expect(formatStorePrice(5_500, "KR")).toBe("₩5,500");
  });

  it("지역마다 그 지역 화폐 기호와 자릿수로 찍는다", () => {
    expect(formatStorePrice(5_500, "US")).toBe("$3.93");
    expect(formatStorePrice(5_500, "JP")).toMatch(/^[¥￥]\d+$/);
    expect(formatStorePrice(5_500, "DE")).toContain("€");
    expect(formatStorePrice(5_500, "GB")).toMatch(/^£/);
  });

  it("지역 코드는 언어 태그에서 읽고, 없으면 언어 기본 지역·한국 순이다", () => {
    expect(regionFromLanguageTags(["en-GB", "ko"])).toBe("GB");
    expect(regionFromLanguageTags(["zh-Hant-TW"])).toBe("TW");
    expect(regionFromLanguageTags(["ja"])).toBe("JP");
    expect(regionFromLanguageTags(["ja", "en-US"])).toBe("US");
    expect(regionFromLanguageTags([])).toBeUndefined();
  });

  it("표에 없는 지역은 달러이고, 유로권은 지역이 달라도 유로다", () => {
    expect(currencyForRegion("ZZ")).toBe("USD");
    expect(currencyForRegion("fr")).toBe("EUR");
  });

  it("환산은 비율표 하나만 읽고 소수 자릿수를 지킨다", () => {
    expect(convertStorePrice(1_400, "USD")).toBe(1);
    expect(Number.isInteger(convertStorePrice(5_500, "JPY"))).toBe(true);
    expect(KRW_PER_UNIT.KRW).toBe(1);
  });

  it("모든 유료 상품은 원화 기준 가격을 숫자로 갖는다", () => {
    for (const product of PREMIUM_PRODUCTS) {
      if (product.acquisition.kind !== "platform_payment") continue;
      expect(Number.isInteger(product.acquisition.basePriceKrw), product.id).toBe(true);
      expect(product.acquisition.basePriceKrw, product.id).toBeGreaterThan(0);
    }
  });

  it("화면 코드에는 원화 기호를 직접 적지 않는다 — 표기는 formatStorePrice 하나가 만든다", () => {
    const walk = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? walk(path) : path.endsWith(".ts") ? [path] : [];
    });
    const offenders = [...walk("src/ui"), ...walk("src/scenes")].filter((path) => readFileSync(path, "utf8").includes("₩"));
    expect(offenders).toEqual([]);
  });
});
