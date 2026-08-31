import { describe, expect, it } from "vitest";
import {
  DAMAGE_FLAVOR_COLOR, DAMAGE_TIER_RATIOS, DAMAGE_TIER_SIZES, damagePopupStyle, formatDamageAmount,
} from "../../src/ui/damageNumbers";
import { COLOR } from "../../src/ui/theme";

const target = { maxHp: 10_000 } as const;

describe("전투 수치 표시 규칙", () => {
  it("세기가 클수록 글자가 커지고 오래 남는다", () => {
    const small = damagePopupStyle({ amount: 50, flavor: "physical", ...target });
    const big = damagePopupStyle({ amount: 3_000, flavor: "physical", ...target });
    expect(big.tier).toBeGreaterThan(small.tier);
    expect(big.size).toBeGreaterThan(small.size);
    expect(big.holdMs + big.riseMs).toBeGreaterThan(small.holdMs + small.riseMs);
    expect(big.punch).toBeGreaterThan(small.punch);
  });

  it("등급 표는 크기·외곽선이 함께 커지도록 단조 증가한다", () => {
    for (let tier = 1; tier < DAMAGE_TIER_SIZES.length; tier += 1) {
      expect(DAMAGE_TIER_SIZES[tier]).toBeGreaterThan(DAMAGE_TIER_SIZES[tier - 1]);
    }
    for (let step = 1; step < DAMAGE_TIER_RATIOS.length; step += 1) {
      expect(DAMAGE_TIER_RATIOS[step]).toBeGreaterThan(DAMAGE_TIER_RATIOS[step - 1]);
    }
  });

  it("가장 작은 잔타도 예전 기본 크기(30)보다 크게 뜬다", () => {
    expect(damagePopupStyle({ amount: 1, flavor: "physical", ...target }).size).toBeGreaterThan(30);
  });

  it("등급은 절대 수치가 아니라 대상 최대 체력 대비 비율로 정해진다", () => {
    const weak = damagePopupStyle({ amount: 900, flavor: "physical", maxHp: 3_000 });
    const strong = damagePopupStyle({ amount: 900, flavor: "physical", maxHp: 400_000 });
    expect(weak.tier).toBeGreaterThan(strong.tier);
  });

  it("치명타와 궁극기는 한 등급씩 크고, 경감된 타격은 한 등급 작다", () => {
    const base = damagePopupStyle({ amount: 600, flavor: "physical", ...target });
    expect(damagePopupStyle({ amount: 600, flavor: "physical", critical: true, ...target }).tier).toBe(base.tier + 1);
    expect(damagePopupStyle({ amount: 600, flavor: "physical", ultimate: true, ...target }).tier).toBe(base.tier + 1);
    expect(damagePopupStyle({ amount: 600, flavor: "physical", mitigated: true, ...target }).tier).toBe(base.tier - 1);
  });

  it("피해 종류마다 색이 갈리고 궁극기는 강조색이 앞선다", () => {
    expect(damagePopupStyle({ amount: 100, flavor: "physical", ...target }).color).toBe(DAMAGE_FLAVOR_COLOR.physical);
    expect(damagePopupStyle({ amount: 100, flavor: "magical", ...target }).color).toBe(DAMAGE_FLAVOR_COLOR.magical);
    expect(damagePopupStyle({ amount: 100, flavor: "true", ...target }).color).toBe(DAMAGE_FLAVOR_COLOR.true);
    expect(damagePopupStyle({ amount: 100, flavor: "bleed", ...target }).color).toBe(DAMAGE_FLAVOR_COLOR.bleed);
    expect(damagePopupStyle({ amount: 100, flavor: "magical", ultimate: true, ...target }).color).toBe(COLOR.accentText);
    // 넷은 서로 다른 색이어야 종류가 색만으로 갈린다.
    const colors = new Set([DAMAGE_FLAVOR_COLOR.physical, DAMAGE_FLAVOR_COLOR.magical, DAMAGE_FLAVOR_COLOR.true, DAMAGE_FLAVOR_COLOR.bleed]);
    expect(colors.size).toBe(4);
  });

  it("아군이 받은 피해만 위험색으로 물들고 회복·보호막은 제 색을 지킨다", () => {
    expect(damagePopupStyle({ amount: 100, flavor: "physical", incoming: true, ...target }).color).toBe(COLOR.dangerText);
    expect(damagePopupStyle({ amount: 100, flavor: "heal", incoming: true, ...target }).color).toBe(COLOR.hpText);
    expect(damagePopupStyle({ amount: 100, flavor: "shield", incoming: true, ...target }).color).toBe(DAMAGE_FLAVOR_COLOR.shield);
  });

  it("회복과 보호막만 + 를 달고 상성은 방향 표식으로만 붙는다", () => {
    expect(damagePopupStyle({ amount: 120, flavor: "heal", ...target }).text).toBe("+120");
    expect(damagePopupStyle({ amount: 120, flavor: "shield", ...target }).text).toBe("+120");
    expect(damagePopupStyle({ amount: 120, flavor: "physical", ...target }).text).toBe("120");
    expect(damagePopupStyle({ amount: 120, flavor: "physical", effectiveness: "advantage", ...target }).text).toBe("120▲");
    expect(damagePopupStyle({ amount: 120, flavor: "physical", effectiveness: "disadvantage", ...target }).text).toBe("120▼");
  });

  it("무효는 세기와 무관하게 늘 같은 흐린 표식 하나이며 화면을 흔들지 않는다", () => {
    const blocked = damagePopupStyle({ amount: 0, flavor: "blocked", ...target });
    expect(blocked.text).toBe("무효");
    expect(blocked.shake).toBe(0);
    expect(blocked.sparks).toBe(0);
    expect(damagePopupStyle({ amount: 9_999, flavor: "blocked", ...target })).toEqual(blocked);
  });

  it("큰 한 방만 화면을 흔들고, 아군이 맞을 때는 흔들지 않는다", () => {
    expect(damagePopupStyle({ amount: 100, flavor: "physical", ...target }).shake).toBe(0);
    expect(damagePopupStyle({ amount: 5_000, flavor: "physical", ...target }).shake).toBeGreaterThan(0);
    expect(damagePopupStyle({ amount: 5_000, flavor: "physical", incoming: true, ...target }).shake).toBe(0);
  });

  it("치명타·궁극기만 숫자 뒤로 파편을 뿌린다", () => {
    expect(damagePopupStyle({ amount: 100, flavor: "physical", ...target }).sparks).toBe(0);
    expect(damagePopupStyle({ amount: 100, flavor: "physical", critical: true, ...target }).sparks).toBeGreaterThan(0);
    expect(damagePopupStyle({ amount: 100, flavor: "physical", ultimate: true, ...target }).sparks).toBeGreaterThan(0);
  });

  it("다섯 자리부터만 자릿수를 끊고 소수는 정수로 접는다", () => {
    expect(formatDamageAmount(9_999)).toBe("9999");
    expect(formatDamageAmount(10_000)).toBe("10,000");
    expect(formatDamageAmount(12.6)).toBe("13");
    expect(formatDamageAmount(-5)).toBe("0");
  });
});
