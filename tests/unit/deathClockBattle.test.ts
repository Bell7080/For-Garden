import { describe, expect, it } from "vitest";
import { aliveFighters, createSkirmish, stepSkirmish } from "../../src/core/skirmish";
import { getRelic } from "../../src/data/relics";
import { BATTLE_DEATH_CLOCK } from "../../src/core/battleClock";
import type { RelicDef } from "../../src/core/types";

/**
 * **정말로 끝나지 않는 판을 세운다.**
 *
 * 실제 개체를 그대로 세우면 어느 한쪽이 결국 이겨 버려 시계가 없어도 판이 닫힌다 — 그러면
 * 이 검사는 아무것도 지키지 못한다(처음 쓴 판이 그랬고, 시계를 꺼도 그대로 통과했다).
 * 그래서 **원정 불사 보스와 같은 경로**(`options.boss`)로 죽지 않는 적을 세우고, 그 적의
 * 위력과 상태이상을 걷어 아군도 제풀에 죽지 않게 둔다. 남은 손잡이는 데스 카운트뿐이다.
 */
function harmless(def: RelicDef): RelicDef {
  /*
   * 스프레드가 판별 유니온의 판별자를 잃어버려 그대로는 `Ultimate`로 좁혀지지 않는다. 여기서
   * 만드는 것은 **검사용 허수아비**이고 바꾸는 값도 위력·상태이상뿐이라, 모양을 다시 짜는
   * 대신 한 번만 단언한다.
   */
  return {
    ...def,
    // 폭주가 켜지면 해구 파동이 **최대 체력 비율**로 깎아 시계와 무관하게 판이 닫힌다.
    // 게이지는 피격으로도 차므로 `ferocityGain`만 0으로 두는 것으로는 막히지 않는다.
    stats: { ...def.stats, ferocityGain: 0 },
    ferocityTrait: { ...def.ferocityTrait, maxHpDamagePercentPerSecond: 0, cancelEnemyHealing: false } as unknown as RelicDef["ferocityTrait"],
    basic: { ...def.basic, power: 0, statusEffects: [] },
    ultimate: { ...def.ultimate, power: 0, statusEffects: [] },
  } as RelicDef;
}

/**
 * 아군의 체력을 아주 크게 준다.
 *
 * 위력을 0으로 만들어도 공용 피해 공식이 **최소 1**을 보장하므로, 평범한 체력으로 두면 그
 * 잔타가 쌓여 시계 없이도 결국 쓰러진다 — 실제로 그래서 시계를 꺼도 이 검사가 통과했다.
 * 잔타로는 절대 닿지 않을 만큼 키워, 판을 닫는 것이 **데스 카운트뿐**이게 만든다.
 */
function unkillable(def: RelicDef): RelicDef {
  return { ...def, stats: { ...def.stats, hp: 1_000_000_000, ferocityGain: 0 } };
}

function undyingStalemate() {
  return createSkirmish(
    [unkillable(getRelic("anky")), unkillable(getRelic("tia"))],
    [harmless(getRelic("pontos"))],
    { left: 0, right: 600, top: 0, bottom: 1000 },
    {}, {},
    { boss: { phases: [{ startsAt: 0, damagePerSecond: 0, label: "관측" }], limitSeconds: 100_000 } },
  );
}

/** 판이 닫힐 때까지 돌리고 걸린 시간을 돌려준다. 닫히지 않으면 상한에서 멈춘다. */
function runUntilDone(limitSeconds: number) {
  const state = undyingStalemate();
  let seconds = 0;
  while (state.phase === "fight" && seconds < limitSeconds) { stepSkirmish(state, 0.05, () => 0.5); seconds += 0.05; }
  return { seconds, phase: state.phase, alive: aliveFighters(state, "player").length, state };
}

describe("데스 카운트가 판을 닫는다", () => {
  it("는 죽지 않는 적을 세운 판도 반드시 끝낸다", () => {
    const result = runUntilDone(900);
    expect(result.phase).not.toBe("fight");
    expect(result.alive).toBe(0);
  });

  it("는 3분 전에는 아무것도 하지 않는다", () => {
    // 시작 전부터 깎으면 평범한 판의 균형까지 함께 바뀐다.
    const state = undyingStalemate();
    for (let seconds = 0; seconds < BATTLE_DEATH_CLOCK.startsAtSeconds - 1; seconds += 0.05) stepSkirmish(state, 0.05, () => 0.5);
    expect(state.phase).toBe("fight");
    expect(state.deathClockTicks).toBe(0);
  });

  it("는 버티는 수단이 0이 되는 시각 안에 끝난다", () => {
    /*
     * 회복·보호막이 0이 되는 시각(3분 + 50초)을 넉넉히 넘겨서도 살아 있으면, 감쇠를 빠뜨린
     * 보호막 경로가 남아 있다는 뜻이다 — `shield.amount +=`가 아홉 군데로 흩어져 있던 것이
     * 그 위험이었고, 그래서 공용 경계 하나로 모았다.
     */
    const zeroAt = BATTLE_DEATH_CLOCK.startsAtSeconds + 100 / BATTLE_DEATH_CLOCK.recoveryLossPercentPerTick;
    expect(runUntilDone(900).seconds).toBeLessThan(zeroAt + 60);
  });
});
