import { describe, expect, it } from "vitest";
import {
  CRITICAL_COLOR, DAMAGE_FLAVOR_COLOR, DAMAGE_TIER_RATIOS, DAMAGE_TIER_SIZES, DEBUFF_TONE,
  INCOMING_DAMAGE_TONE, MITIGATED_COLOR, DAMAGE_TIER_STROKE, DEBUFF_PACE, POPUP_LANES, VOLLEY_MIN_GAP_MS, VOLLEY_MAX_SPAN_MS,
  attackDamagePopupRequest, damagePopupStyle, formatDamageAmount, popupLaneOffset, popupLifeMs, volleyTickDelayMs,
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

  it("세기가 클수록 글자가 크고 두껍고 오래 머문다", () => {
    const small = damagePopupStyle({ amount: 50, flavor: "damage", ...target });
    const big = damagePopupStyle({ amount: 3_000, flavor: "damage", ...target });
    expect(big.tier).toBeGreaterThan(small.tier);
    expect(big.size).toBeGreaterThan(small.size);
    expect(big.strokeWidth).toBeGreaterThan(small.strokeWidth);
    expect(big.holdMs).toBeGreaterThan(small.holdMs);
    expect(popupLifeMs(big)).toBeGreaterThan(popupLifeMs(small));
    expect(big.punch).toBeGreaterThan(small.punch);
    // 한 방은 잔타보다 확실히 오래 머물러야 "세게 맞았다"가 읽힌다.
    const max = damagePopupStyle({ amount: 9_000, flavor: "damage", critical: true, ...target });
    expect(max.holdMs).toBeGreaterThanOrEqual(small.holdMs * 2.5);
  });

  it("등급 표는 크기가 함께 커지도록 단조 증가한다", () => {
    for (let tier = 1; tier < DAMAGE_TIER_SIZES.length; tier += 1) {
      expect(DAMAGE_TIER_SIZES[tier]).toBeGreaterThan(DAMAGE_TIER_SIZES[tier - 1]);
    }
    for (let tier = 1; tier < DAMAGE_TIER_STROKE.length; tier += 1) {
      expect(DAMAGE_TIER_STROKE[tier]).toBeGreaterThan(DAMAGE_TIER_STROKE[tier - 1]);
    }
    for (let step = 1; step < DAMAGE_TIER_RATIOS.length; step += 1) {
      expect(DAMAGE_TIER_RATIOS[step]).toBeGreaterThan(DAMAGE_TIER_RATIOS[step - 1]);
    }
  });

  it("가장 큰 한 방도 SD를 덮지 않을 만큼 작다", () => {
    // 화면에 여섯이 서 있고 수치는 그 위로 겹쳐 뜨므로, 읽히는 선에서 최대한 작게 잡는다.
    expect(DAMAGE_TIER_SIZES[DAMAGE_TIER_SIZES.length - 1]).toBeLessThanOrEqual(60);
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

  it("수치는 멀리 떠오르지 않고 톡 튀어나와 제자리에 머문다", () => {
    for (const amount of [20, 600, 9_000]) {
      const style = damagePopupStyle({ amount, flavor: "damage", ...target });
      // 예전처럼 SD 키(210)를 넘겨 날아가면 읽기 전에 몸에서 멀어진다.
      expect(style.hop + Math.abs(style.drift)).toBeLessThan(70);
      // 머무는 시간이 사라지는 시간보다 길어야 "머물다 사라진다"가 된다.
      expect(style.holdMs).toBeGreaterThan(style.fadeMs);
      expect(style.alpha).toBeGreaterThanOrEqual(0.9);
    }
  });

  it("박자가 사건의 종류를 가른다 — 지속 피해는 흘러내리고, 회복은 떠오르고, 연타는 짧다", () => {
    const hit = damagePopupStyle({ amount: 300, flavor: "damage", ...target });
    const tick = damagePopupStyle({ amount: 300, flavor: "debuff", debuff: "bleed", ...target });
    const volley = damagePopupStyle({ amount: 300, flavor: "debuff", debuff: "observation", ...target });
    const heal = damagePopupStyle({ amount: 300, flavor: "heal", ...target });
    expect([hit.pace, tick.pace, volley.pace, heal.pace]).toEqual(["hit", "tick", "volley", "restore"]);
    expect(tick.drift).toBeGreaterThan(0);
    expect(heal.drift).toBeLessThan(hit.drift);
    expect(volley.holdMs).toBeLessThan(hit.holdMs);
    expect(tick.size).toBeLessThanOrEqual(hit.size);
    // 잔타는 아무리 커도 한 방만큼 크지 않고 화면을 흔들지 않는다.
    const hugeTick = damagePopupStyle({ amount: 9_000, flavor: "debuff", debuff: "poison", ...target });
    expect(hugeTick.size).toBeLessThan(damagePopupStyle({ amount: 9_000, flavor: "damage", ...target }).size);
    expect(hugeTick.shake).toBe(0);
    // 상한에서 터진 한 방은 디버프 색이라도 한 방의 박자다.
    expect(damagePopupStyle({ amount: 300, flavor: "debuff", debuff: "pressure", ...target }).pace).toBe("hit");
    expect(damagePopupStyle({ amount: 300, flavor: "debuff", debuff: "poison", pace: "hit", ...target }).pace).toBe("hit");
    expect(Object.keys(DEBUFF_PACE).sort()).toEqual(Object.keys(DEBUFF_TONE).sort());
  });

  it("같은 대상의 수치는 정해진 자리를 차례로 돌아 서로 겹치지 않는다", () => {
    for (const [pace, lanes] of Object.entries(POPUP_LANES)) {
      for (let a = 0; a < lanes.length; a += 1) {
        for (let b = a + 1; b < lanes.length; b += 1) {
          const gap = Math.hypot(lanes[a].x - lanes[b].x, lanes[a].y - lanes[b].y);
          expect(gap, `${pace} ${a}-${b}`).toBeGreaterThanOrEqual(26);
        }
      }
      expect(popupLaneOffset(pace as keyof typeof POPUP_LANES, lanes.length)).toEqual(popupLaneOffset(pace as keyof typeof POPUP_LANES, 0));
    }
    // 연타는 왼쪽 아래에서 오른쪽 위로 오르는 계단이다.
    const volley = POPUP_LANES.volley;
    for (let i = 1; i < volley.length; i += 1) {
      expect(volley[i].x).toBeGreaterThan(volley[i - 1].x);
      expect(volley[i].y).toBeLessThan(volley[i - 1].y);
    }
  });

  it("관측 연타는 배속이 올라도 하나하나가 읽히는 간격 아래로 좁아지지 않는다", () => {
    for (const speed of [1, 1.5, 2, 3]) {
      for (const count of [2, 5, 15]) {
        for (let index = 1; index < count; index += 1) {
          const gap = volleyTickDelayMs(index, count, 0.6, speed) - volleyTickDelayMs(index - 1, count, 0.6, speed);
          expect(gap).toBeGreaterThanOrEqual(Math.min(VOLLEY_MIN_GAP_MS, VOLLEY_MAX_SPAN_MS / (count - 1)) - 1);
        }
        expect(volleyTickDelayMs(count - 1, count, 0.6, speed)).toBeLessThanOrEqual(VOLLEY_MAX_SPAN_MS);
      }
    }
    expect(volleyTickDelayMs(0, 15, 0.6, 3)).toBe(0);
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
