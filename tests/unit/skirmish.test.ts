import { describe, expect, it } from "vitest";
import {
  aliveFighters,
  BLEED,
  attackInterval,
  canFireUltimate,
  createSkirmish,
  fireUltimate,
  findFighter,
  moveSpeed,
  renderPose,
  SKIRMISH,
  stepSkirmish,
  teamHp,
  type Arena,
  type SkirmishEvent,
  type SkirmishState,
} from "../../src/core/skirmish";
import { getRelic } from "../../src/data/relics";
import { FEROCITY_RULES } from "../../src/core/ferocity";
import { ULTIMATE_ENERGY_MAX } from "../../src/core/ultimate";
import {
  beginNextUltimate, cancelUltimateSequence, createUltimateSequenceState, enqueueUltimate, releaseUltimate,
} from "../../src/core/ultimateSequence";

describe("궁극기 연출 직렬 상태", () => {
  it("는 중복 발동을 막고 올바른 토큰만 잠금을 해제한다", () => {
    const sequence = createUltimateSequenceState();
    expect(enqueueUltimate(sequence, "player-0")).toBe(true);
    expect(enqueueUltimate(sequence, "player-0")).toBe(false);
    const first = beginNextUltimate(sequence)!;
    expect(beginNextUltimate(sequence)).toBeNull();
    expect(releaseUltimate(sequence, first.token + 1)).toBe(false);
    expect(releaseUltimate(sequence, first.token)).toBe(true);
  });

  it("는 전투 종료 취소가 활성 연출과 남은 자동 큐를 모두 비운다", () => {
    const sequence = createUltimateSequenceState();
    enqueueUltimate(sequence, "player-0");
    enqueueUltimate(sequence, "player-1");
    const active = beginNextUltimate(sequence)!;
    cancelUltimateSequence(sequence);
    expect(sequence.activeToken).toBeNull();
    expect(sequence.queue).toEqual([]);
    // 취소 전에 잡은 비동기 완료는 새 상태의 잠금을 건드릴 수 없다.
    expect(releaseUltimate(sequence, active.token)).toBe(false);
  });

  it("는 동시에 준비된 자동 궁극기를 편성 순서대로 한 번씩 꺼낸다", () => {
    const sequence = createUltimateSequenceState();
    ["player-0", "player-1"].forEach((id) => {
      enqueueUltimate(sequence, id);
      enqueueUltimate(sequence, id);
    });
    const fired: string[] = [];
    for (let next = beginNextUltimate(sequence); next; next = beginNextUltimate(sequence)) {
      fired.push(next.fighterId);
      releaseUltimate(sequence, next.token);
    }
    expect(fired).toEqual(["player-0", "player-1"]);
  });
});

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

  it("은 실시간 타격에서 물리·마법 공격력과 대응 방어 능력치를 사용한다", () => {
    /** 한 번의 실시간 공격만 발생시켜 이벤트 피해량을 비교한다. */
    const hit = (player: string, enemy: string) => {
      const state = newSkirmish([player], [enemy]);
      const [attacker, target] = state.fighters;
      attacker.x = 400; attacker.y = 1000; attacker.attackCooldown = 0;
      target.x = 460; target.y = 1000; target.attackCooldown = 99;
      return stepSkirmish(state, 1 / 60).find((event) => event.kind === "attack")?.amount ?? 0;
    };
    // 렉시아의 물리 공격과 케찰의 마법 공격 모두 실제 난전 이벤트를 통해 피해를 만든다.
    expect(hit("rex", "husk-shell")).toBeGreaterThan(0);
    expect(hit("quetz", "husk-shell")).toBeGreaterThan(0);
  });

  it("은 최종 궁극기·야성 충전 보정과 실제 HP 피해 기준 흡혈을 적용한다", () => {
    const state = newSkirmish(["rex"], ["husk-shell"]);
    const [attacker, target] = state.fighters;
    attacker.def = { ...attacker.def, stats: { ...attacker.def.stats, energyGain: 40, ferocityGain: 50, lifeSteal: 25 } };
    attacker.hp = attacker.maxHp - 100;
    attacker.x = 400; attacker.y = 1000; attacker.attackCooldown = 0;
    target.x = 460; target.y = 1000; target.attackCooldown = 99;
    const hpBefore = attacker.hp;
    const targetBefore = target.hp;
    stepSkirmish(state, 1 / 60, () => 0.999999);
    const dealt = targetBefore - target.hp;
    expect(attacker.energy).toBe(40);
    expect(attacker.ferocity).toBeCloseTo(FEROCITY_RULES.basicGain * 1.5);
    expect(attacker.hp - hpBefore).toBeCloseTo(dealt * 0.25);
  });

  it("은 광역 실제 피해에는 흡혈하고 별도 고정 출혈 피해에는 흡혈하지 않는다", () => {
    const state = newSkirmish(["spino"], ["husk-shell", "husk-raptor"]);
    const [attacker, primary, secondary] = state.fighters;
    attacker.def = { ...attacker.def, stats: { ...attacker.def.stats, lifeSteal: 100 } };
    attacker.hp = 1; attacker.ferocity = 100; attacker.ferocityFever = true;
    attacker.x = 400; attacker.y = 1000; attacker.attackCooldown = 0;
    primary.x = 460; primary.y = 1000; primary.attackCooldown = 99;
    secondary.x = 500; secondary.y = 1000; secondary.attackCooldown = 99;
    const totalBefore = primary.hp + secondary.hp;
    stepSkirmish(state, 1 / 60, () => 0.999999);
    expect(attacker.hp).toBeCloseTo(Math.min(attacker.maxHp, 1 + totalBefore - primary.hp - secondary.hp));

    const healed = attacker.hp;
    primary.bleed = { remaining: 1, tickIn: 0, percent: BLEED.percentPerSecond };
    attacker.attackCooldown = 99;
    stepSkirmish(state, 1 / 60);
    expect(attacker.hp).toBe(healed);
  });
});

describe("실시간 야성 공용 규칙", () => {
  /** 공격자와 대상을 붙여 한 번의 실제 난전 타격만 관찰한다. */
  function oneHit(ferocity: number) {
    const state = newSkirmish(["rex"], ["husk-shell"]);
    const [attacker, target] = state.fighters;
    attacker.x = 400; attacker.y = 1000; attacker.attackCooldown = 0; attacker.ferocity = ferocity;
    target.x = 460; target.y = 1000; target.attackCooldown = 99;
    const event = stepSkirmish(state, 1 / 60).find((item) => item.kind === "attack");
    return { attacker, target, amount: event?.kind === "attack" ? event.amount : 0 };
  }

  it("은 50/80/100 경계에서 공격 피해를 올리고 타격 양쪽의 게이지를 채운다", () => {
    const calm = oneHit(49);
    const first = oneHit(50);
    const second = oneHit(80);
    const fever = oneHit(100);
    expect(first.amount).toBeGreaterThan(calm.amount);
    expect(second.amount).toBeGreaterThan(first.amount);
    expect(fever.amount).toBeGreaterThan(second.amount);
    expect(calm.attacker.ferocity).toBe(49 + FEROCITY_RULES.basicGain);
    expect(calm.target.ferocity).toBe(FEROCITY_RULES.hitGain);
  });
});

describe("효과 ID별 야성 특성", () => {
  /** 원하는 둘을 즉시 교전시키고 다른 전투원의 행동은 멈춰 한 번의 효과만 관찰한다. */
  function prepareHit(player: string, enemies = ["husk-shell"]): SkirmishState {
    const state = newSkirmish([player], enemies);
    const [attacker, target] = state.fighters;
    attacker.x = 400; attacker.y = 1000; attacker.attackCooldown = 0; attacker.targetId = target.id;
    target.x = 460; target.y = 1000;
    for (const enemy of state.fighters.slice(1)) enemy.attackCooldown = 99;
    return state;
  }

  it("attackIntervalReduction은 렉시아의 피버 중 공격 간격만 20% 줄인다", () => {
    const state = newSkirmish(["rex"], ["husk-shell"]);
    const rex = state.fighters[0];
    const before = attackInterval(rex);
    rex.ferocity = 99;
    expect(attackInterval(rex)).toBe(before); // 100 미만 경계에서는 설명 효과가 열리지 않는다.
    rex.ferocity = 100; rex.ferocityFever = true;
    expect(attackInterval(rex)).toBeCloseTo(before * 0.8);
  });

  it("damageReduction은 토리카가 피버일 때 최종 피해를 18% 줄인다", () => {
    const hit = (fever: boolean, ferocity: number) => {
      const state = prepareHit("husk-raptor", ["anky"]);
      const target = state.fighters[1];
      target.ferocity = ferocity; target.ferocityFever = fever;
      return (stepSkirmish(state, 1 / 60).find((event) => event.kind === "attack") as Extract<SkirmishEvent, { kind: "attack" }>).amount;
    };
    const before = hit(false, 0);
    expect(hit(false, 99)).toBe(before); // 게이지만 99로 둔 상태에는 경감이 없다.
    expect(hit(true, 100)).toBe(Math.max(1, Math.round(before * 0.82)));
  });

  it("splashDamage는 세이라의 피버 타격을 220px 안의 주변 적에게 35%로 번지게 한다", () => {
    const state = prepareHit("spino", ["husk-shell", "husk-raptor"]);
    const [attacker, primary, nearby] = state.fighters;
    nearby.x = primary.x + 100; nearby.y = primary.y;
    attacker.ferocity = 99;
    expect(stepSkirmish(state, 1 / 60).filter((event) => event.kind === "attack")).toHaveLength(1);

    const fever = prepareHit("spino", ["husk-shell", "husk-raptor"]);
    fever.fighters[2].x = fever.fighters[1].x + 100; fever.fighters[2].y = fever.fighters[1].y;
    fever.fighters[0].ferocity = 100; fever.fighters[0].ferocityFever = true;
    const hits = stepSkirmish(fever, 1 / 60).filter((event) => event.kind === "attack");
    expect(hits).toHaveLength(2);
    expect(hits.some((event) => event.kind === "attack" && event.targetId === fever.fighters[2].id)).toBe(true);
  });

  it("allyEnergyGain은 도도의 피버 공격마다 다른 아군에게 에너지 6을 준다", () => {
    const state = newSkirmish(["dodo", "rex"], ["husk-shell"]);
    const [dodo, ally, target] = state.fighters;
    dodo.x = 400; dodo.y = 1000; target.x = 460; target.y = 1000;
    dodo.attackCooldown = 0; ally.attackCooldown = 99; target.attackCooldown = 99;
    dodo.ferocity = 99;
    stepSkirmish(state, 1 / 60);
    expect(ally.energy).toBe(0);

    dodo.attackCooldown = 0; dodo.ferocity = 100; dodo.ferocityFever = true;
    stepSkirmish(state, 1 / 60);
    expect(ally.energy).toBe(6);
  });

  it("criticalChanceBonus은 스밀라의 피버 중 치명타율을 25%p 올린다", () => {
    const normal = prepareHit("smilo");
    normal.fighters[0].ferocity = 99;
    const normalHit = stepSkirmish(normal, 1 / 60, () => 0.3).find((event) => event.kind === "attack");
    const fever = prepareHit("smilo");
    fever.fighters[0].ferocity = 100; fever.fighters[0].ferocityFever = true;
    const feverHit = stepSkirmish(fever, 1 / 60, () => 0.3).find((event) => event.kind === "attack");
    expect(normalHit).toMatchObject({ critical: false });
    expect(feverHit).toMatchObject({ critical: true });
  });

  it("teamMoveSpeedBonus은 케찰의 피버 중 생존 아군 이동 속도를 18% 올린다", () => {
    const state = newSkirmish(["quetz", "rex"], ["husk-shell"]);
    const [quetz, ally] = state.fighters;
    const before = moveSpeed(ally, state);
    quetz.ferocity = 99;
    expect(moveSpeed(ally, state)).toBe(before);
    quetz.ferocity = 100; quetz.ferocityFever = true;
    expect(moveSpeed(ally, state)).toBeCloseTo(before * 1.18);
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

  it("는 공용 저장 상한 안에서 스킬별 비용만 정확히 소비한다", () => {
    const state = charged();
    const fighter = state.fighters[0];
    // 운영 정의를 바꾸지 않고 이 전투원에게만 저비용 궁극기 계약을 복제한다.
    fighter.def = { ...fighter.def, ultimate: { ...fighter.def.ultimate, cost: 80 } };
    fighter.energy = ULTIMATE_ENERGY_MAX;
    expect(canFireUltimate(state, fighter)).toBe(true);
    fireUltimate(state, fighter.id);
    expect(fighter.energy).toBe(ULTIMATE_ENERGY_MAX - 80);
  });

  it("는 전투가 끝난 뒤에는 쓸 수 없다", () => {
    const state = charged();
    state.fighters[1].hp = 0;
    state.phase = "victory";
    expect(canFireUltimate(state, state.fighters[0])).toBe(false);
    expect(fireUltimate(state, "player-0")).toHaveLength(0);
  });

  it("는 최대 야성에서도 적에게 궁극기를 쓰며 피버 게이지가 자동으로 진정된다", () => {
    const state = charged();
    const [ally, foe] = state.fighters;
    ally.ferocity = 100;
    ally.ferocityFever = true;
    const foeHp = foe.hp;

    const events = fireUltimate(state, ally.id);
    expect(events).toContainEqual(expect.objectContaining({ kind: "attack", attackerId: ally.id, targetId: foe.id, skill: "ultimate" }));
    expect(foe.hp).toBeLessThan(foeHp);
    // 피버는 별도 진압 입력 없이 전투 시간에 맞춰 0까지 줄어든다.
    // 두 전투원의 공격을 늦춰 피버 카운트다운 자체만 정확히 8초 관찰한다.
    ally.attackCooldown = 99;
    foe.attackCooldown = 99;
    for (let tick = 0; tick < 32; tick += 1) stepSkirmish(state, 0.25);
    expect(ally.ferocity).toBe(0);
    expect(ally.ferocityFever).toBe(false);
    expect(events.some((event) => event.kind === "attack" && event.targetId.startsWith("player"))).toBe(false);
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

describe("출혈", () => {
  /** 렉시아와 상대만 세워 연속 공격을 관찰한다. */
  function duel(): SkirmishState {
    const state = createSkirmish([getRelic("rex")], [getRelic("husk-shell")], ARENA);
    const [ally, foe] = state.fighters;
    ally.x = 500; ally.y = 1000; foe.x = 560; foe.y = 1000;
    return state;
  }

  it("은 같은 상대를 다섯 번 이어서 때린 순간 걸린다", () => {
    const state = duel();
    const [ally, foe] = state.fighters;
    // 첫 타는 시작하자마자 나가므로 네 번의 간격이면 다섯 번을 때린다.
    const events = run(state, attackInterval(ally) * 4 + 0.05);
    expect(ally.streakCount).toBe(0); // 다섯 번을 채우면 셈이 처음으로 돌아간다
    expect(foe.bleed).not.toBeNull();
    expect(events.some((event) => event.kind === "bleed" && event.started)).toBe(true);
  });

  it("은 3초 동안 매 초 최대 체력의 2%를 깎고 스스로 끝난다", () => {
    const state = duel();
    const foe = state.fighters[1];
    foe.bleed = { remaining: BLEED.seconds, tickIn: 1, percent: BLEED.percentPerSecond };
    const hpBefore = foe.hp;
    const ticks = run(state, 3.2).filter((event): event is Extract<SkirmishEvent, { kind: "bleed" }> => event.kind === "bleed");
    const bleedDamage = ticks.reduce((sum, event) => sum + event.amount, 0);
    expect(ticks).toHaveLength(BLEED.seconds);
    expect(bleedDamage).toBe(Math.round((foe.maxHp * BLEED.percentPerSecond) / 100) * BLEED.seconds);
    expect(hpBefore - foe.hp).toBeGreaterThanOrEqual(bleedDamage);
    expect(foe.bleed).toBeNull();
  });

  it("은 상대를 바꾸면 셈이 처음으로 돌아간다", () => {
    const state = createSkirmish([getRelic("rex")], [getRelic("husk-shell"), getRelic("husk-wing")], ARENA);
    const ally = state.fighters[0];
    ally.streakTargetId = "enemy-0";
    ally.streakCount = 4;
    ally.x = state.fighters[2].x; ally.y = state.fighters[2].y - 60;
    ally.targetId = "enemy-1";
    run(state, 0.05);
    expect(ally.streakCount).toBe(1);
    expect(state.fighters[1].bleed).toBeNull();
  });
});

describe("각성", () => {
  it("5단계는 전투를 궁극기 준비 상태로 연다", () => {
    const ready = createSkirmish([getRelic("rex")], [getRelic("husk-shell")], ARENA, {}, { rex: 5 });
    const plain = createSkirmish([getRelic("rex")], [getRelic("husk-shell")], ARENA);
    expect(ready.fighters[0].energy).toBe(getRelic("rex").ultimate.cost);
    expect(plain.fighters[0].energy).toBe(0);
  });
});
