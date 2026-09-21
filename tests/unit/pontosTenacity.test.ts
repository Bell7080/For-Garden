import { describe, expect, it } from "vitest";
import {
  applyFrenzy,
  applyStagger,
  applyStun,
  controlResistPercent,
  createSkirmish,
  receivedDamage,
  stepSkirmish,
  type Fighter,
} from "../../src/core/skirmish";
import { getRelic } from "../../src/data/relics";

const ARENA = { left: 0, right: 600, top: 0, bottom: 1_000 };

function pontos(): Fighter {
  const state = createSkirmish([getRelic("anky")], [getRelic("pontos")], ARENA);
  return state.fighters[1];
}

describe("폰토스의 강인함", () => {
  it("은 태생 저항에서 시작해 제어를 받아 낼 때마다 오른다", () => {
    const boss = pontos();
    // 정의가 적은 태생 저항이 출발선이다. 쌓인 몫은 그 위에 얹힌다.
    expect(controlResistPercent(boss)).toBe(getRelic("pontos").stunResistancePercent);
    applyStun(boss, 1);
    expect(controlResistPercent(boss)).toBe(58);
    applyStun(boss, 1);
    expect(controlResistPercent(boss)).toBe(66);
  });

  it("은 기절·경직·광란을 **한 규칙**으로 센다", () => {
    /*
     * 예전에는 기절만 저항을 지나고 경직은 그대로 다 들어갔다. 행동을 막는 같은 일을 하는
     * 둘이 다른 규칙을 따르면, 제어형 편성이 기절 대신 경직으로 같은 잠금을 다시 만든다.
     */
    const byStun = pontos();
    const byStagger = pontos();
    const byFrenzy = pontos();
    applyStun(byStun, 1);
    applyStagger(byStagger, 1);
    applyFrenzy(byFrenzy, { kind: "frenzy", seconds: 1, attackSpeedPercent: 0 });
    const grown = controlResistPercent(byStun);
    expect(controlResistPercent(byStagger)).toBe(grown);
    expect(controlResistPercent(byFrenzy)).toBe(grown);
  });

  it("은 지속 시간을 그 비율만큼 줄인다", () => {
    const boss = pontos();
    // 태생 50%라 1초짜리 기절은 0.5초만 남는다.
    applyStun(boss, 1);
    expect(boss.stunnedFor).toBeCloseTo(0.5, 6);
  });

  it("은 100%에 닿으면 걸리자마자 풀린다", () => {
    const boss = pontos();
    // 태생 50 + 8씩 일곱 번이면 상한이다.
    for (let count = 0; count < 7; count += 1) applyStun(boss, 1);
    expect(controlResistPercent(boss)).toBe(100);
    boss.stunnedFor = 0;
    applyStun(boss, 5);
    expect(boss.stunnedFor).toBe(0);
    applyStagger(boss, 5);
    expect(boss.staggeredFor).toBe(0);
  });

  it("은 상한을 넘겨 자라지 않는다", () => {
    const boss = pontos();
    for (let count = 0; count < 40; count += 1) applyStun(boss, 1);
    expect(controlResistPercent(boss)).toBe(100);
  });

  it("은 값을 적지 않은 개체에게는 아무 일도 하지 않는다", () => {
    const state = createSkirmish([getRelic("anky")], [getRelic("toby")], ARENA);
    const [ally, foe] = state.fighters;
    applyStun(foe, 1);
    applyStun(foe, 1);
    expect(controlResistPercent(foe)).toBe(0);
    expect(controlResistPercent(ally)).toBe(0);
    // 저항이 없으므로 걸린 시간이 그대로 남는다.
    expect(foe.stunnedFor).toBeCloseTo(1, 6);
  });
});

describe("폰토스의 받는 피해 감소", () => {
  it("는 체력이 많이 남았을 때 완만하게 오른다", () => {
    // 직선이던 때는 체력 75%에서 이미 74.5% 경감이라 초반부터 때릴 맛이 없었다.
    const boss = pontos();
    boss.hp = boss.maxHp * 0.75;
    expect(receivedDamage(boss, 1_000)).toBe(477);
  });

  it("는 체력 절반에서 턱 막히지 않고 끝까지 자란다", () => {
    const boss = pontos();
    const at = (ratio: number): number => { boss.hp = boss.maxHp * ratio; return receivedDamage(boss, 1_000); };
    const half = at(0.5);
    const quarter = at(0.25);
    const tenth = at(0.1);
    // 절반 아래에서도 계속 줄어든다 — 상한에 붙어 멈추지 않는다.
    expect(half).toBeGreaterThan(quarter);
    expect(quarter).toBeGreaterThan(tenth);
    expect(tenth).toBeGreaterThan(0);
  });
});

describe("폰토스전의 원정 점수", () => {
  /** 불사 보스를 세우고 아군이 한 번 때리게 한 뒤, 점수와 실제로 깎인 체력을 함께 돌려준다. */
  function oneHit(bossHpRatio: number) {
    const state = createSkirmish([getRelic("anky")], [getRelic("pontos")], ARENA, {}, {}, {
      boss: { phases: [{ startsAt: 0, damagePerSecond: 0, label: "관측" }], limitSeconds: 1_000 },
    });
    const [ally, boss] = state.fighters;
    ally.x = boss.x = 400; ally.y = boss.y = 900;
    ally.attackCooldown = 0; boss.attackCooldown = 999;
    boss.hp = boss.maxHp * bossHpRatio;
    const before = boss.hp;
    // 한 프레임으로는 평타 한 번이 들어가지 않는 편성이 있다. 맞을 때까지만 돌린다.
    for (let frame = 0; frame < 240 && (state.boss?.score ?? 0) === 0; frame += 1) {
      stepSkirmish(state, 1 / 60, () => 0.99);
      boss.attackCooldown = 999;
    }
    return { score: state.boss?.score ?? 0, hpLost: before - boss.hp };
  }

  it("는 경감에 막히지 않는다", () => {
    /*
     * 점수가 **실제로 깎인 체력**을 세던 때는, 잃은 체력에 따라 받는 피해가 50~99% 줄어드는
     * 폰토스 앞에서 1,000점 언저리에 멈춰 아무리 때려도 오르지 않았다. 경감은 그를 죽지 않는
     * 보스로 만들기 위한 값이지 점수를 막으라고 있는 값이 아니다.
     *
     * 사건의 계약(`contributionAmount`)은 처음부터 "경감 전 기여값"이라고 적혀 있었는데
     * 구현만 그 반대였다 — 고친 것은 구현이지 계약이 아니다.
     */
    const { score, hpLost } = oneHit(1);
    expect(score).toBeGreaterThan(hpLost);
  });

  it("는 체력이 낮아 경감이 커져도 같은 값을 센다", () => {
    /*
     * 경감이 커지면 깎이는 체력만 줄고 **만들어 낸 기여는 그대로**여야 한다. 그것이 이
     * 고침의 전부다.
     *
     * 체력을 더 낮추지 않는 이유가 있다 — 경감이 아주 커지면 최종 피해가 무효화 문턱(10)
     * 아래로 내려가 그 한 방이 *아예 없던 일*이 되고, 그때는 점수도 0이 맞다. 실제 원정의
     * 폰토스는 무한 체력으로 서므로 그 구간에 들어가지 않는다.
     */
    const healthy = oneHit(1);
    const wounded = oneHit(0.5);
    expect(wounded.score).toBeCloseTo(healthy.score, 6);
    expect(wounded.hpLost).toBeLessThan(healthy.hpLost);
  });
});
