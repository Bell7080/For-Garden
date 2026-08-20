import { describe, expect, it } from "vitest";
import {
  aliveFighters,
  attackInterval,
  createSkirmish,
  findFighter,
  SKIRMISH,
  stepSkirmish,
  teamHp,
  type Arena,
  type SkirmishState,
} from "../../src/core/skirmish";
import { getRelic } from "../../src/data/relics";

const ARENA: Arena = { left: 130, right: 950, top: 600, bottom: 1360 };

function newSkirmish(player = ["anky", "rex", "dodo"], enemy = ["husk-raptor", "husk-shell", "husk-wing"]): SkirmishState {
  return createSkirmish(player.map(getRelic), enemy.map(getRelic), ARENA);
}

/** 실제 프레임처럼 잘게 나눠 굴린다. */
function run(state: SkirmishState, seconds: number, rng?: () => number) {
  const events = [];
  for (let t = 0; t < seconds; t += 1 / 60) events.push(...stepSkirmish(state, 1 / 60, rng));
  return events;
}

describe("난전 시작 진형", () => {
  it("은 아군을 아래쪽, 적을 위쪽에 세운다", () => {
    const state = newSkirmish();
    const players = aliveFighters(state, "player");
    const enemies = aliveFighters(state, "enemy");
    expect(Math.min(...players.map((f) => f.y))).toBeGreaterThan(Math.max(...enemies.map((f) => f.y)));
    // 아군은 맵을 넓게 쓰도록 아래 끝에서 출발한다.
    expect(Math.max(...players.map((f) => f.y))).toBe(ARENA.bottom);
  });

  it("은 여섯 명 전원을 세운다", () => {
    expect(newSkirmish().fighters).toHaveLength(6);
  });
});

describe("난전 상수", () => {
  it("는 밀어내는 간격보다 사거리를 넓게 잡는다", () => {
    // 반대가 되면 서로 밀려나기만 하고 영원히 때리지 못하는 교착이 생긴다.
    expect(SKIRMISH.reach).toBeGreaterThan(SKIRMISH.spacing);
  });
});

describe("실시간 진행", () => {
  it("은 입력 없이 서로에게 다가간다", () => {
    const state = newSkirmish();
    const ally = state.fighters[0];
    const foe = state.fighters[3];
    const before = Math.hypot(foe.x - ally.x, foe.y - ally.y);
    run(state, 0.5);
    const after = Math.hypot(
      findFighter(state, foe.id)!.x - findFighter(state, ally.id)!.x,
      findFighter(state, foe.id)!.y - findFighter(state, ally.id)!.y,
    );
    expect(after).toBeLessThan(before);
  });

  it("은 붙은 뒤부터 양쪽 체력을 함께 깎는다", () => {
    const state = newSkirmish();
    run(state, 12);
    expect(teamHp(state, "enemy")).toBeLessThan(state.fighters.filter((f) => f.side === "enemy").reduce((t, f) => t + f.maxHp, 0));
    expect(teamHp(state, "player")).toBeLessThan(state.fighters.filter((f) => f.side === "player").reduce((t, f) => t + f.maxHp, 0));
  });

  it("은 한쪽이 전멸하면 끝나고 그 뒤로는 시간이 흐르지 않는다", () => {
    const state = newSkirmish();
    run(state, 200);
    expect(["victory", "defeat"]).toContain(state.phase);
    const frozen = state.elapsed;
    expect(stepSkirmish(state, 1)).toHaveLength(0);
    expect(state.elapsed).toBe(frozen);
  });

  it("은 종료 이벤트를 한 번만 낸다", () => {
    const state = newSkirmish();
    const finishes = run(state, 200).filter((event) => event.kind === "finish");
    expect(finishes).toHaveLength(1);
  });
});

describe("능력치 반영", () => {
  it("은 공격 속도가 빠를수록 공격 간격이 짧다", () => {
    const base = newSkirmish().fighters[0];
    const withSpeed = (attackSpeed: number) => ({ ...base, def: { ...base.def, stats: { ...base.def.stats, attackSpeed } } });
    expect(attackInterval(withSpeed(200))).toBeLessThan(attackInterval(withSpeed(100)));
    // 공속 100이면 기준 간격 그대로다.
    expect(attackInterval(withSpeed(100))).toBeCloseTo(SKIRMISH.attackInterval);
  });

  it("은 이동 속도가 빠른 쪽이 같은 시간에 더 멀리 간다", () => {
    const quick = newSkirmish(["rex"], ["husk-raptor"]);
    const slow = newSkirmish(["rex"], ["husk-raptor"]);
    slow.fighters[0].def = { ...slow.fighters[0].def, stats: { ...slow.fighters[0].def.stats, moveSpeed: 40 } };
    const startY = quick.fighters[0].y;
    run(quick, 0.5);
    run(slow, 0.5);
    expect(startY - quick.fighters[0].y).toBeGreaterThan(startY - slow.fighters[0].y);
  });

  it("은 치명타 판정을 주입된 난수로만 정한다", () => {
    const always = newSkirmish();
    const never = newSkirmish();
    run(always, 12, () => 0);
    run(never, 12, () => 0.999999);
    expect(teamHp(always, "enemy")).toBeLessThan(teamHp(never, "enemy"));
  });
});

describe("자리 정리", () => {
  it("는 서로 겹쳐 서지 않게 밀어낸다", () => {
    const state = newSkirmish();
    run(state, 8);
    const alive = state.fighters.filter((f) => f.hp > 0);
    for (let i = 0; i < alive.length; i += 1) {
      for (let j = i + 1; j < alive.length; j += 1) {
        const gap = Math.hypot(alive[j].x - alive[i].x, alive[j].y - alive[i].y);
        expect(gap).toBeGreaterThan(SKIRMISH.spacing * 0.9);
      }
    }
  });

  it("는 아무도 전장 밖으로 나가지 않게 한다", () => {
    const state = newSkirmish();
    run(state, 10);
    for (const fighter of state.fighters) {
      expect(fighter.x).toBeGreaterThanOrEqual(ARENA.left);
      expect(fighter.x).toBeLessThanOrEqual(ARENA.right);
      expect(fighter.y).toBeGreaterThanOrEqual(ARENA.top);
      expect(fighter.y).toBeLessThanOrEqual(ARENA.bottom);
    }
  });
});
