import { describe, expect, it } from "vitest";
import { shouldShowDamagePopup, type DamageFlavor } from "../../src/ui/damageNumbers";

/** 표시 설정의 범위를 Phaser 없이 고정해 새 전투 텍스트가 잘못 함께 숨지 않게 한다. */
describe("전투 효과 표시 정책", () => {
  it("피해 숫자를 끄면 HP를 깎는 일반·고정·지속 피해량만 숨긴다", () => {
    for (const flavor of ["damage", "true", "debuff"] satisfies DamageFlavor[]) {
      expect(shouldShowDamagePopup({ amount: 100, flavor }, false)).toBe(false);
    }
  });

  it("회복·보호막·무효처럼 전투 판단에 필요한 별도 텍스트는 유지한다", () => {
    for (const flavor of ["heal", "shield", "blocked"] satisfies DamageFlavor[]) {
      expect(shouldShowDamagePopup({ amount: 100, flavor }, false)).toBe(true);
    }
  });

  it("피해 숫자를 켜면 모든 전투 텍스트를 표시한다", () => {
    const flavors: DamageFlavor[] = ["damage", "true", "debuff", "heal", "shield", "blocked"];
    for (const flavor of flavors) expect(shouldShowDamagePopup({ amount: 100, flavor }, true)).toBe(true);
  });
});
