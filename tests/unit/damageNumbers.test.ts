import { describe, expect, it } from "vitest";
import {
  CRITICAL_COLOR, DAMAGE_FLAVOR_COLOR, DAMAGE_TIER_RATIOS, DAMAGE_TIER_SIZES, DEBUFF_TONE,
  INCOMING_DAMAGE_TONE, MITIGATED_COLOR, attackDamagePopupRequest, damagePopupStyle, formatDamageAmount, risingAlpha,
} from "../../src/ui/damageNumbers";
import { COLOR } from "../../src/ui/theme";

const target = { maxHp: 10_000 } as const;

describe("전투 수치 표시 규칙", () => {
  it("공격 사건의 실제 피해만 화면 숫자로 쓰고 정산 기여도·대상 HP·보스 점수는 섞지 않는다", () => {
    // 구조적으로 여분 필드를 허용해 실제 SkirmishEvent와 보스 상태가 건너와도 출력값의 출처를 고정한다.
    const event = {
      amount: 432, contributionAmount: 8_000_000_000, damageType: "magical" as const,
      skill: "ultimate" as const, critical: false, bossScore: 9_000_000_000,
    };
    const request = attackDamagePopupRequest(event, { side: "enemy", maxHp: 7_000_000_000 });
    expect(request.amount).toBe(event.amount);
    expect(damagePopupStyle(request).text).toBe("432");
    // maxHp는 상대적 크기 등급에만 남고 정산 전용 값들은 표현 모델 자체에 존재하지 않는다.
    expect(request.maxHp).toBe(7_000_000_000);
    expect(request).not.toHaveProperty("contributionAmount");
    expect(request).not.toHaveProperty("bossScore");
  });

  it("세기가 클수록 글자가 커지고 오래 남는다", () => {
    const small = damagePopupStyle({ amount: 50, flavor: "damage", ...target });
    const big = damagePopupStyle({ amount: 3_000, flavor: "damage", ...target });
    expect(big.tier).toBeGreaterThan(small.tier);
    expect(big.size).toBeGreaterThan(small.size);
    expect(big.holdMs + big.riseMs).toBeGreaterThan(small.holdMs + small.riseMs);
    expect(big.punch).toBeGreaterThan(small.punch);
  });

  it("등급 표는 크기가 함께 커지도록 단조 증가한다", () => {
    for (let tier = 1; tier < DAMAGE_TIER_SIZES.length; tier += 1) {
      expect(DAMAGE_TIER_SIZES[tier]).toBeGreaterThan(DAMAGE_TIER_SIZES[tier - 1]);
    }
    for (let step = 1; step < DAMAGE_TIER_RATIOS.length; step += 1) {
      expect(DAMAGE_TIER_RATIOS[step]).toBeGreaterThan(DAMAGE_TIER_RATIOS[step - 1]);
    }
  });

  it("가장 큰 한 방도 SD를 덮지 않을 만큼 작다", () => {
    // 화면에 여섯이 서 있고 수치는 그 위로 겹쳐 뜨므로, 읽히는 선에서 최대한 작게 잡는다.
    expect(DAMAGE_TIER_SIZES[DAMAGE_TIER_SIZES.length - 1]).toBeLessThanOrEqual(56);
  });

  it("등급은 절대 수치가 아니라 대상 최대 체력 대비 비율로 정해진다", () => {
    const weak = damagePopupStyle({ amount: 900, flavor: "damage", maxHp: 3_000 });
    const strong = damagePopupStyle({ amount: 900, flavor: "damage", maxHp: 400_000 });
    expect(weak.tier).toBeGreaterThan(strong.tier);
  });

  it("치명타와 궁극기는 한 등급씩 크고, 경감된 타격은 한 등급 작다", () => {
    const base = damagePopupStyle({ amount: 600, flavor: "damage", ...target });
    expect(damagePopupStyle({ amount: 600, flavor: "damage", critical: true, ...target }).tier).toBe(base.tier + 1);
    expect(damagePopupStyle({ amount: 600, flavor: "damage", ultimate: true, ...target }).tier).toBe(base.tier + 1);
    expect(damagePopupStyle({ amount: 600, flavor: "damage", mitigated: true, ...target }).tier).toBe(base.tier - 1);
  });

  it("적에게 입힌 피해는 종류마다 색이 갈린다", () => {
    // 물리·마법은 같은 흰색이고, 고정 피해만 보랏빛으로 갈린다.
    expect(damagePopupStyle({ amount: 100, flavor: "damage", ...target }).color).toBe(DAMAGE_FLAVOR_COLOR.damage);
    expect(damagePopupStyle({ amount: 100, flavor: "true", ...target }).color).toBe(DAMAGE_FLAVOR_COLOR.true);
    expect(damagePopupStyle({ amount: 100, flavor: "heal", ...target }).color).toBe(COLOR.hpText);
    expect(damagePopupStyle({ amount: 100, flavor: "shield", ...target }).color).toBe(DAMAGE_FLAVOR_COLOR.shield);
    expect(damagePopupStyle({ amount: 100, flavor: "damage", critical: true, ...target }).color).toBe(CRITICAL_COLOR);
    // 흰색·보라·연두·푸른빛·노랑 다섯이 서로 달라야 종류가 색만으로 갈린다.
    expect(new Set([
      DAMAGE_FLAVOR_COLOR.damage, DAMAGE_FLAVOR_COLOR.true, DAMAGE_FLAVOR_COLOR.heal, DAMAGE_FLAVOR_COLOR.shield, CRITICAL_COLOR,
    ]).size).toBe(5);
  });

  it("아군이 받은 피해는 종류를 가리지 않고 세기에 따라 짙어지는 붉은 계열 하나로 묶인다", () => {
    for (const flavor of ["damage", "true"] as const) {
      for (const extra of [{}, { critical: true }, { ultimate: true }]) {
        const style = damagePopupStyle({ amount: 100, flavor, incoming: true, ...extra, ...target });
        expect(INCOMING_DAMAGE_TONE).toContain(style.color);
      }
    }
    // 잔타와 한 방이 서로 다른 붉기여야 "지금 누가 크게 맞았나"를 색으로 읽는다.
    const light = damagePopupStyle({ amount: 20, flavor: "damage", incoming: true, ...target });
    const deep = damagePopupStyle({ amount: 4_000, flavor: "damage", incoming: true, ...target });
    expect(light.color).not.toBe(deep.color);
    expect(INCOMING_DAMAGE_TONE.length).toBe(DAMAGE_TIER_SIZES.length);
  });

  it("아군이 받아도 회복·보호막·디버프는 제 색을 지킨다", () => {
    expect(damagePopupStyle({ amount: 100, flavor: "heal", incoming: true, ...target }).color).toBe(COLOR.hpText);
    expect(damagePopupStyle({ amount: 100, flavor: "shield", incoming: true, ...target }).color).toBe(DAMAGE_FLAVOR_COLOR.shield);
    expect(damagePopupStyle({ amount: 100, flavor: "debuff", debuff: "bleed", incoming: true, ...target }).color).toBe(DEBUFF_TONE.bleed);
  });

  it("디버프는 상태마다 제 색을 갖고 새 상태는 색표에만 더한다", () => {
    expect(damagePopupStyle({ amount: 50, flavor: "debuff", debuff: "bleed", ...target }).color).toBe(DEBUFF_TONE.bleed);
    expect(damagePopupStyle({ amount: 50, flavor: "debuff", debuff: "poison", ...target }).color).toBe(DEBUFF_TONE.poison);
    expect(new Set(Object.values(DEBUFF_TONE)).size).toBe(Object.keys(DEBUFF_TONE).length);
  });

  it("경감된 타격은 종류를 가리지 않고 회색 하나로 통일된다", () => {
    for (const flavor of ["damage", "true"] as const) {
      expect(damagePopupStyle({ amount: 100, flavor, mitigated: true, ...target }).color).toBe(MITIGATED_COLOR);
      expect(damagePopupStyle({ amount: 100, flavor, mitigated: true, critical: true, incoming: true, ...target }).color).toBe(MITIGATED_COLOR);
    }
  });

  it("회복과 보호막만 + 를 달고 상성 화살표는 붙지 않는다", () => {
    expect(damagePopupStyle({ amount: 120, flavor: "heal", ...target }).text).toBe("+120");
    expect(damagePopupStyle({ amount: 120, flavor: "shield", ...target }).text).toBe("+120");
    expect(damagePopupStyle({ amount: 120, flavor: "damage", ...target }).text).toBe("120");
    // 유리하면 숫자 자체가 커지므로 화살표는 같은 말을 두 번 하면서 글자 폭만 넓혔다.
    for (const mark of ["▲", "▼", "△", "▽"]) {
      expect(damagePopupStyle({ amount: 120, flavor: "damage", ...target }).text).not.toContain(mark);
    }
  });

  it("수치는 캐릭터 위에서 가장 옅고 떠오르며 또렷해진다", () => {
    const style = damagePopupStyle({ amount: 500, flavor: "damage", ...target });
    expect(style.nearAlpha).toBeLessThan(style.peakAlpha);
    expect(style.nearAlpha).toBeLessThanOrEqual(0.4);
    expect(style.peakAlpha).toBeLessThanOrEqual(1);
    // 캐릭터 키(210)를 넘겨 떠올라야 얼굴 위에 머물지 않는다.
    expect(style.rise).toBeGreaterThan(160);
  });

  it("무효는 세기와 무관하게 늘 같은 흐린 표식 하나이며 화면을 흔들지 않는다", () => {
    const blocked = damagePopupStyle({ amount: 0, flavor: "blocked", ...target });
    expect(blocked.text).toBe("무효");
    expect(blocked.shake).toBe(0);
    expect(blocked.sparks).toBe(0);
    expect(damagePopupStyle({ amount: 9_999, flavor: "blocked", ...target })).toEqual(blocked);
  });

  it("큰 한 방만 화면을 흔들고, 아군이 맞을 때는 흔들지 않는다", () => {
    expect(damagePopupStyle({ amount: 100, flavor: "damage", ...target }).shake).toBe(0);
    expect(damagePopupStyle({ amount: 5_000, flavor: "damage", ...target }).shake).toBeGreaterThan(0);
    expect(damagePopupStyle({ amount: 5_000, flavor: "damage", incoming: true, ...target }).shake).toBe(0);
  });

  it("치명타·궁극기만 숫자 뒤로 파편을 뿌린다", () => {
    expect(damagePopupStyle({ amount: 100, flavor: "damage", ...target }).sparks).toBe(0);
    expect(damagePopupStyle({ amount: 100, flavor: "damage", critical: true, ...target }).sparks).toBeGreaterThan(0);
    expect(damagePopupStyle({ amount: 100, flavor: "damage", ultimate: true, ...target }).sparks).toBeGreaterThan(0);
  });

  it("다섯 자리부터만 자릿수를 끊고 소수는 정수로 접는다", () => {
    expect(formatDamageAmount(9_999)).toBe("9999");
    expect(formatDamageAmount(10_000)).toBe("10,000");
    expect(formatDamageAmount(12.6)).toBe("13");
    expect(formatDamageAmount(-5)).toBe("0");
  });
});

describe("떠오르는 수치의 진하기", () => {
  const near = 0.3;
  const peak = 0.9;

  it("캐릭터 위에서 출발할 때 가장 옅고 떠오르며 또렷해진다", () => {
    // 예쁜 SD를 가리는 순간 수치는 정보가 아니라 방해다.
    expect(risingAlpha(0, near, peak)).toBeCloseTo(near);
    expect(risingAlpha(0.12, near, peak)).toBeGreaterThan(near);
    expect(risingAlpha(0.25, near, peak)).toBeCloseTo(peak);
    expect(risingAlpha(0.5, near, peak)).toBeCloseTo(peak);
  });

  it("끝에서 완전히 사라진다", () => {
    expect(risingAlpha(0.8, near, peak)).toBeLessThan(peak);
    expect(risingAlpha(1, near, peak)).toBeCloseTo(0);
  });

  it("진행 내내 진하기가 범위를 벗어나지 않는다", () => {
    for (let step = 0; step <= 20; step += 1) {
      const alpha = risingAlpha(step / 20, near, peak);
      expect(alpha).toBeGreaterThanOrEqual(0);
      expect(alpha).toBeLessThanOrEqual(peak);
    }
  });
});
