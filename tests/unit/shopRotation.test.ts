import { describe, expect, it } from "vitest";
import { ROTATION_EPOCH, rotationOffer, rotationRoll, type RotationSlot } from "../../src/core/shopRotation";
import { ROTATION_SLOTS } from "../../src/data/runeRotation";
import { PRODUCTS } from "../../src/data/shopCatalog";
import { RUNE_MAIN_STAT_KEYS } from "../../src/core/runes";
import { runeShopChoice, toggleMainKey } from "../../src/core/runeShopChoice";

/** epoch부터 n주의 월요일 키. */
function weekKeys(count: number): string[] {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(`${ROTATION_EPOCH}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + index * 7);
    return date.toISOString().slice(0, 10);
  });
}

describe("상점 로테이션 칸", () => {
  it("은 같은 칸·같은 기간이면 언제나 같은 답이고 난수 상태를 읽지 않는다", () => {
    const slot = ROTATION_SLOTS[0]!;
    expect(rotationOffer(slot, "2026-09-01")).toBe(rotationOffer(slot, "2026-09-01"));
    expect(rotationRoll("a")).toBeGreaterThanOrEqual(0); expect(rotationRoll("a")).toBeLessThan(1);
  });

  it("의 열림 비율은 칸의 확률을 따른다", () => {
    const keys = weekKeys(400);
    for (const slot of ROTATION_SLOTS.filter((candidate) => candidate.period === "weekly" && candidate.pityAfterMisses === undefined)) {
      const opened = keys.filter((key) => rotationOffer(slot, key) !== null).length / keys.length * 100;
      expect(Math.abs(opened - slot.chancePercent), slot.id).toBeLessThan(10);
    }
  });

  it("은 보정이 있는 칸이 연속으로 닫히는 주를 한도 안에 가둔다", () => {
    const slot: RotationSlot = { id: "pity-test", period: "weekly", chancePercent: 0, pityAfterMisses: 4, candidates: ["x"] };
    const open = weekKeys(30).map((key) => rotationOffer(slot, key) !== null);
    // 확률 0이어도 4주 닫히면 다음 주는 열리고, 연 뒤에는 다시 센다.
    expect(open.slice(0, 10)).toEqual([false, false, false, false, true, false, false, false, false, true]);
  });

  it("은 후보를 가진 상품만 가리키고 상품의 칸·주기가 서로 맞는다", () => {
    for (const slot of ROTATION_SLOTS) {
      for (const id of slot.candidates) {
        const product = PRODUCTS.find((candidate) => candidate.id === id);
        expect(product, id).toBeTruthy();
        expect(product!.rotationSlot, id).toBe(slot.id);
        expect(product!.refresh, id).toBe(slot.period);
        expect(product!.grants.some((grant) => grant.kind === "rune"), id).toBe(true);
      }
    }
    for (const product of PRODUCTS.filter((candidate) => candidate.rotationSlot)) {
      expect(ROTATION_SLOTS.find((slot) => slot.id === product.rotationSlot)?.candidates, product.id).toContain(product.id);
    }
  });
});

describe("룬 상품의 값", () => {
  const price = (id: string): number => { const a = PRODUCTS.find((p) => p.id === id)!.acquisition; return a.kind === "currency" ? a.amount : 0; };
  it("은 지정이 랜덤보다, 상위 등급이 하위보다 비싸다", () => {
    expect(price("arch-rune-pick-rare")).toBeGreaterThan(price("arch-rune-daily-rare") * 2);
    expect(price("arch-rune-pick-epic")).toBeGreaterThan(price("arch-rune-weekly-epic"));
    expect(price("arch-rune-weekly-epic")).toBeGreaterThan(price("arch-rune-daily-rare"));
    expect(price("arch-rune-daily-rare")).toBeGreaterThan(price("arch-rune-daily-uncommon"));
  });
  it("은 전설을 팔지 않고 젬(다이아)으로 사지 않는다", () => {
    for (const product of PRODUCTS.filter((candidate) => candidate.grants.some((grant) => grant.kind === "rune"))) {
      expect(product.grants.every((grant) => grant.kind !== "rune" || grant.rarity !== "legendary"), product.id).toBe(true);
      expect(product.acquisition.kind === "currency" && product.acquisition.currency !== "gems", product.id).toBe(true);
    }
  });
});

describe("룬 상품 선택", () => {
  it("은 주 옵션을 둘까지만 고르고 셋째는 먼저 고른 것을 밀어낸다", () => {
    expect(toggleMainKey([], "hp")).toEqual(["hp"]);
    expect(toggleMainKey(["hp", "atk"], "def")).toEqual(["atk", "def"]);
    expect(toggleMainKey(["hp", "atk"], "hp")).toEqual(["atk"]);
  });
  it("은 모자라면 null이다", () => {
    expect(runeShopChoice("part", null, [])).toBeNull();
    expect(runeShopChoice("part", 1, [])).toEqual({ part: 1 });
    expect(runeShopChoice("partMain", 1, ["hp"])).toBeNull();
    expect(runeShopChoice("partMain", 1, [RUNE_MAIN_STAT_KEYS[0]!, RUNE_MAIN_STAT_KEYS[1]!])).toEqual({ part: 1, mainKeys: [RUNE_MAIN_STAT_KEYS[0], RUNE_MAIN_STAT_KEYS[1]] });
  });
});
