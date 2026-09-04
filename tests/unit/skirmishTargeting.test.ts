import { describe, expect, it } from "vitest";
import { SKIRMISH, createSkirmish, stepSkirmish, type Arena } from "../../src/core/skirmish";
import { getRelic } from "../../src/data/relics";

const ARENA: Arena = { left: 130, right: 950, top: 600, bottom: 1360 };

/**
 * 사거리 단계의 값은 그림이 아니라 **먼저 때리는 횟수**다.
 *
 * 250/340, 300/430으로 두 번 고쳤을 때는 눈으로만 골라서 아군이 한 대 치는 사이에 적이 이미
 * 붙었다. 같은 개체의 단계만 바꿔 재면 그 값이 실제로 몇 대를 벌어 주는지가 숫자로 남는다.
 */
describe("사거리 단계", () => {
  function hitsBeforeReply(tier: "melee" | "mid" | "ranged"): number {
    const base = getRelic("keris");
    const state = createSkirmish([{ ...base, reachTier: tier }], [getRelic("husk-shell")], ARENA);
    const [ally, foe] = state.fighters;
    let allyHits = 0;
    for (let frame = 0; frame < 60 * 30 && state.phase === "fight"; frame += 1) {
      for (const event of stepSkirmish(state, 1 / 60, () => 0.99)) {
        if (event.kind !== "attack") continue;
        if (event.attackerId === ally.id) allyHits += 1;
        if (event.attackerId === foe.id) return allyHits;
      }
    }
    return allyHits;
  }

  it("는 뒤로 갈수록 적이 답하기 전에 더 많이 때린다", () => {
    const melee = hitsBeforeReply("melee");
    const mid = hitsBeforeReply("mid");
    const ranged = hitsBeforeReply("ranged");
    expect(melee).toBe(0);
    expect(mid).toBeGreaterThan(melee);
    expect(ranged).toBeGreaterThan(mid);
  });

  it("는 근 → 중 → 원 순서이고 모두 밀어내는 간격보다 넓다", () => {
    expect(SKIRMISH.spacing).toBeLessThan(SKIRMISH.reach);
  });
});

/**
 * 표적은 한 번 정하고 끝이 아니다.
 *
 * 예전에는 죽을 때까지 바꾸지 않아, 전투가 시작되는 순간 저마다 상대를 정하고 바로 옆으로
 * 적이 걸어와도 처음 정한 상대를 향해 전장을 가로질렀다.
 */
describe("표적 재평가", () => {
  it("은 사거리 안에 들어온 적을 지나쳐 걸어가지 않는다", () => {
    const state = createSkirmish([getRelic("anky")], [getRelic("husk-shell"), getRelic("husk-raptor")], ARENA);
    const [ally, far, near] = state.fighters;
    // 처음에는 멀리 있는 적을 노리게 해 두고, 그 사이 다른 적을 코앞에 세운다.
    ally.x = 200; ally.y = 1000;
    far.x = 900; far.y = 1000;
    near.x = 900; near.y = 700;
    stepSkirmish(state, 1 / 60, () => 0.99);
    expect(ally.targetId).toBe(far.id);

    near.x = ally.x + 100; near.y = ally.y;
    for (let frame = 0; frame < 60 * (SKIRMISH.retargetSeconds + 1); frame += 1) {
      stepSkirmish(state, 1 / 60, () => 0.99);
      // 붙어 버리면 좌표가 밀리므로 코앞 자리를 계속 유지해 재평가만 검사한다.
      near.x = ally.x + 100; near.y = ally.y;
    }
    expect(ally.targetId).toBe(near.id);
  });

  it("은 노리던 상대에게 보너스를 줘 매 프레임 표적이 뒤집히지 않게 한다", () => {
    const state = createSkirmish([getRelic("anky")], [getRelic("husk-shell"), getRelic("husk-raptor")], ARENA);
    const [ally, first, second] = state.fighters;
    ally.x = 500; ally.y = 1000;
    first.x = 500; first.y = 700;
    // 거의 같은 거리에 둘을 세워도 한쪽으로 정해진 뒤에는 흔들리지 않는다.
    second.x = 500 + SKIRMISH.targetStickiness / 2; second.y = 700;
    stepSkirmish(state, 1 / 60, () => 0.99);
    const chosen = ally.targetId;
    for (let frame = 0; frame < 60 * 6; frame += 1) {
      stepSkirmish(state, 1 / 60, () => 0.99);
      first.x = 500; first.y = 700;
      second.x = 500 + SKIRMISH.targetStickiness / 2; second.y = 700;
      expect(ally.targetId).toBe(chosen);
    }
  });
});
