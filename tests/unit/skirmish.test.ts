import { describe, expect, it } from "vitest";
import {
  aliveFighters,
  attackInterval,
  canFireUltimate,
  createSkirmish,
  fireUltimate,
  findFighter,
  renderPose,
  SKIRMISH,
  stepSkirmish,
  teamHp,
  type Arena,
  type SkirmishEvent,
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

describe("타격 연출", () => {
  /**
   * 아군만 한 대 때린 직후의 상태.
   * 둘을 사거리 안에 직접 세우고 적의 공격만 늦춰, 누가 누구를 때렸는지가 분명하게 만든다.
   */
  function oneHit() {
    const state = newSkirmish(["rex"], ["husk-shell"]);
    const [ally, foe] = state.fighters;
    ally.x = 400;
    ally.y = 1000;
    // 붙었다고 판정되는 거리(reach * engageRatio) 안쪽에 세운다.
    foe.x = 400 + SKIRMISH.reach * 0.75;
    foe.y = 1000;
    ally.attackCooldown = 0;
    foe.attackCooldown = 99;
    stepSkirmish(state, 1 / 60);
    return state;
  }

  it("은 때린 쪽을 상대 방향으로 밀어 넣는다", () => {
    const [ally] = oneHit().fighters;
    // 상대가 오른쪽에 있으므로 오른쪽으로 튀어나간다.
    expect(ally.dashX).toBeGreaterThan(SKIRMISH.lunge * 0.8);
    expect(Math.abs(ally.dashY)).toBeLessThan(1);
  });

  it("은 맞은 쪽을 반대로 밀려나게 한다", () => {
    const [, foe] = oneHit().fighters;
    // 때린 쪽에서 멀어지는 방향, 즉 같은 오른쪽으로 밀려난다.
    expect(foe.dashX).toBeGreaterThan(SKIRMISH.knockback * 0.8);
  });

  it("은 밀린 만큼을 곧 제자리로 되돌린다", () => {
    const state = oneHit();
    const ally = state.fighters[0];
    state.fighters[1].attackCooldown = 99;
    const pushed = Math.hypot(ally.dashX, ally.dashY);
    // 다음 공격이 나기 전 짧은 시간 안에 거의 돌아온다.
    for (let t = 0; t < 0.4; t += 1 / 60) stepSkirmish(state, 1 / 60);
    expect(Math.hypot(ally.dashX, ally.dashY)).toBeLessThan(pushed * 0.2);
  });

  it("은 달리는 동안에만 통통 튀어 오른다", () => {
    const state = newSkirmish(["rex"], ["husk-shell"]);
    let peak = 0;
    for (let t = 0; t < 2; t += 1 / 60) {
      stepSkirmish(state, 1 / 60);
      peak = Math.max(peak, state.fighters[0].hop);
    }
    expect(peak).toBeGreaterThan(SKIRMISH.hopHeight * 0.5);
    expect(peak).toBeLessThanOrEqual(SKIRMISH.hopHeight);

    // 붙어서 주고받기 시작하면 다시 땅에 내려온다.
    for (let t = 0; t < 20; t += 1 / 60) stepSkirmish(state, 1 / 60);
    expect(state.fighters[0].hop).toBeLessThan(1);
  });

  it("은 그릴 위치에 변위와 높이를 함께 얹는다", () => {
    const state = oneHit();
    const ally = state.fighters[0];
    const pose = renderPose(ally);
    expect(pose.x).toBeCloseTo(ally.x + ally.dashX);
    expect(pose.y).toBeCloseTo(ally.y + ally.dashY - ally.hop);
    // 떠 있어도 그림자는 발밑을 크게 벗어나지 않는다.
    expect(Math.abs(pose.shadowX - ally.x)).toBeLessThanOrEqual(Math.abs(ally.dashX));
  });
});

describe("궁극기", () => {
  /** 게이지를 가득 채운 아군 하나와 적 하나를 붙여 세운다. */
  function charged() {
    const state = newSkirmish(["rex"], ["husk-shell"]);
    const [ally, foe] = state.fighters;
    ally.x = 400;
    ally.y = 1000;
    foe.x = 400 + SKIRMISH.reach * 0.75;
    foe.y = 1000;
    ally.energy = ally.def.ultimate.cost;
    ally.attackCooldown = 99;
    foe.attackCooldown = 99;
    return state;
  }

  it("는 아군 게이지가 차도 저절로 나가지 않는다", () => {
    const state = newSkirmish();
    const events = run(state, 20);
    const autoUltimates = events.filter(
      (event) => event.kind === "attack" && event.skill === "ultimate" && event.attackerId.startsWith("player"),
    );
    expect(autoUltimates).toHaveLength(0);
    // 대신 게이지는 그대로 차 있어 누를 수 있는 상태가 된다.
    const charged = state.fighters.filter((f) => f.side === "player" && f.energy >= f.def.ultimate.cost);
    expect(charged.length).toBeGreaterThan(0);
  });

  it("는 적은 게이지가 차면 알아서 쓴다", () => {
    const state = newSkirmish();
    const events = run(state, 30);
    const enemyUltimates = events.filter(
      (event) => event.kind === "attack" && event.skill === "ultimate" && event.attackerId.startsWith("enemy"),
    );
    expect(enemyUltimates.length).toBeGreaterThan(0);
  });

  it("는 눌렀을 때 게이지를 쓰고 평타보다 크게 때린다", () => {
    const ultimateState = charged();
    const ultimateHit = fireUltimate(ultimateState, "player-0").find((event) => event.kind === "attack");
    expect(ultimateHit).toMatchObject({ skill: "ultimate", targetId: "enemy-0" });

    const basicState = charged();
    basicState.fighters[0].attackCooldown = 0;
    const basicHit = run(basicState, 1 / 30).find((event) => event.kind === "attack");
    expect(basicHit).toMatchObject({ skill: "basic" });

    // 같은 상대를 같은 상태에서 때렸을 때 궁극기 쪽이 더 아프다.
    const damage = (event?: SkirmishEvent) => (event?.kind === "attack" ? event.amount : 0);
    expect(damage(ultimateHit)).toBeGreaterThan(damage(basicHit));
    expect(ultimateState.fighters[0].energy).toBe(0);
  });

  it("는 게이지가 모자라면 아무것도 하지 않는다", () => {
    const state = charged();
    state.fighters[0].energy = state.fighters[0].def.ultimate.cost - 1;
    expect(canFireUltimate(state, state.fighters[0])).toBe(false);
    expect(fireUltimate(state, "player-0")).toHaveLength(0);
    expect(state.fighters[1].hp).toBe(state.fighters[1].maxHp);
  });

  it("는 전투가 끝난 뒤에는 쓸 수 없다", () => {
    const state = charged();
    state.fighters[1].hp = 0;
    state.phase = "victory";
    expect(canFireUltimate(state, state.fighters[0])).toBe(false);
    expect(fireUltimate(state, "player-0")).toHaveLength(0);
  });
});

describe("자리 잡기", () => {
  it("은 붙는 거리와 떨어지는 거리를 다르게 둬 경계에서 떨지 않는다", () => {
    const state = newSkirmish(["rex"], ["husk-shell"]);
    const [ally, foe] = state.fighters;
    ally.x = 400;
    ally.y = 1000;
    // 붙는 기준(reach * engageRatio) 밖, 떨어지는 기준(reach) 안에 세운다.
    foe.x = 400 + SKIRMISH.reach - 4;
    foe.y = 1000;

    stepSkirmish(state, 1 / 60);
    expect(ally.engaged).toBe(false); // 아직 붙지 않았으니 계속 다가간다

    ally.engaged = true;
    stepSkirmish(state, 1 / 60);
    expect(ally.engaged).toBe(true); // 이미 붙었다면 그 자리에서 계속 싸운다
  });

  it("은 세로로 겹쳐 있을 때 좌우가 깜빡이지 않는다", () => {
    const state = newSkirmish(["rex"], ["husk-shell"]);
    const [ally, foe] = state.fighters;
    ally.x = 400;
    ally.y = 1000;
    ally.facing = 1;
    // 상대가 왼쪽으로 아주 조금 치우친 정도로는 방향을 바꾸지 않는다.
    foe.x = 400 - SKIRMISH.facingDeadzone / 2;
    foe.y = 900;
    stepSkirmish(state, 1 / 60);
    expect(ally.facing).toBe(1);

    foe.x = 400 - SKIRMISH.facingDeadzone * 3;
    stepSkirmish(state, 1 / 60);
    expect(ally.facing).toBe(-1);
  });
});
