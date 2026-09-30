import { describe, expect, it } from "vitest";
import {
  applyCombatStatusEffect,
  attackInterval,
  createSkirmish,
  defensiveDefinition,
  fireUltimate,
  isFighterAlive,
  moveSpeed,
  stepSkirmish,
  tryTriggerLowHpVanish,
  type Arena,
  type Fighter,
  type SkirmishEvent,
  type SkirmishState,
} from "../../src/core/skirmish";
import { FEROCITY_RULES } from "../../src/core/ferocity";
import { getRelic } from "../../src/data/relics";

/**
 * 모르페 + 디모(A-Dimo). 관측은 피해가 없는 표식이고, 모르페의 일반 공격이 그 겹만큼의 틱으로 켠다.
 * 디모는 쿠로·시로와 같은 귀속 소환수지만 앞을 막는 몸이 아니라 정해진 표적 없이 떠다니는 눈이다.
 */
const ARENA: Arena = { left: 0, right: 1_000, top: 0, bottom: 1_200 };
const OBSERVATION = { kind: "observation", seconds: 8, maxStacks: 25 } as const;

/** 모든 전투원의 자동 행동을 끄고 시계·상태만 흐르게 한다. 시험할 손만 따로 연다. */
function quiet(state: SkirmishState): void {
  for (const fighter of state.fighters) fighter.attackCooldown = Number.POSITIVE_INFINITY;
}

function setup(enemyIds: string[] = ["amo"]) {
  const state = createSkirmish([getRelic("morphe")], enemyIds.map((id) => getRelic(id)), ARENA);
  const morphe = state.fighters[0];
  const dimo = state.fighters.find((fighter) => fighter.summonOwnerId === morphe.id)!;
  const enemies = state.fighters.filter((fighter) => fighter.side === "enemy");
  quiet(state);
  // 서로 사거리 안에 두어 이동이 결과에 끼지 않게 한다.
  morphe.x = 500; morphe.y = 900;
  dimo.x = 500; dimo.y = 700;
  enemies.forEach((enemy, index) => { enemy.x = 400 + index * 200; enemy.y = 640; enemy.stealthFor = 0; });
  return { state, morphe, dimo, enemies };
}

function step(state: SkirmishState, seconds: number): SkirmishEvent[] {
  const events: SkirmishEvent[] = [];
  for (let elapsed = 0; elapsed < seconds; elapsed += 0.05) events.push(...stepSkirmish(state, Math.min(0.05, seconds - elapsed)));
  return events;
}

const observe = (fighter: Fighter, state: SkirmishState, stacks: number): void => {
  for (let count = 0; count < stacks; count += 1) applyCombatStatusEffect(fighter, OBSERVATION, [], state, "player-0:dimo");
};

describe("디모 — 귀속 소환수", () => {
  it("는 전투 시작에 모르페의 공격력에서 파생한 몸으로 서고 승패에는 들지 않는다", () => {
    const { morphe, dimo } = setup();
    expect(dimo.id).toBe("player-0:dimo");
    expect(dimo.def.stats.atk).toBe(Math.round(morphe.def.stats.atk * 0.5));
    expect(dimo.def.summonOnly).toBe(true);
    // 궁극기 게이지를 스스로 채운다 — 늑대와 달리 주인이 빌려주지 않는다.
    expect(dimo.def.stats.energyGain).toBeGreaterThan(0);
    expect(getRelic("kuro").stats.energyGain).toBeGreaterThan(0);
  });

  it("는 절반 이하 체력에서 잠시 숨고, 다시 서면 그 한 번을 새로 쥔다", () => {
    const { state, dimo } = setup();
    dimo.hp = dimo.maxHp * 0.4;
    // 발동은 피해 경계가 부른다 — 시험은 그 경계 함수를 직접 부른다.
    expect(tryTriggerLowHpVanish(dimo, state)).toBe(true);
    expect(dimo.stealthFor).toBeGreaterThan(0);
    // 쓰러졌다 돌아오면 위기 은신을 다시 쓸 수 있다.
    dimo.hp = 0;
    dimo.stealthFor = 0;
    stepSkirmish(state, 0.05);
    dimo.resummonIn = 0.01;
    stepSkirmish(state, 0.1);
    expect(isFighterAlive(dimo)).toBe(true);
    expect(dimo.passiveTriggered).toBe(false);
  });
});

describe("모르페 — 요람 연결", () => {
  it("은 디모가 살아 있는 동안만 방어력·저항력이 비율로 오른다", () => {
    const { state, morphe, dimo } = setup();
    const linked = defensiveDefinition(morphe, state).def.stats;
    expect(linked.def).toBeCloseTo(morphe.def.stats.def * 1.5, 6);
    expect(linked.res).toBeCloseTo(morphe.def.stats.res * 1.5, 6);
    dimo.hp = 0;
    const alone = defensiveDefinition(morphe, state).def.stats;
    expect(alone.def).toBe(morphe.def.stats.def);
    expect(alone.res).toBe(morphe.def.stats.res);
  });

  it("은 디모가 살아 있는 동안 매초 회복하고 잃으면 멈춘다", () => {
    const { state, morphe, dimo } = setup();
    morphe.hp = morphe.maxHp * 0.5;
    const before = morphe.hp;
    step(state, 2.05);
    expect(morphe.hp - before).toBeCloseTo(morphe.maxHp * 0.008 * 2, 0);
    dimo.hp = 0;
    const after = morphe.hp;
    step(state, 2.05);
    expect(morphe.hp).toBe(after);
  });
});

describe("관측", () => {
  it("은 겹이 쌓이고 상한에서 멈추며 다시 걸면 시간이 갱신되고 다하면 통째로 사라진다", () => {
    const { state, enemies } = setup();
    observe(enemies[0], state, 30);
    expect(enemies[0].observation?.stacks).toBe(25);
    step(state, 5);
    expect(enemies[0].observation?.remaining).toBeCloseTo(3, 1);
    observe(enemies[0], state, 1);
    expect(enemies[0].observation?.remaining).toBe(8);
    step(state, 8.2);
    expect(enemies[0].observation).toBeNull();
  });

  it("은 피해가 없다 — 걸리기만 해서는 체력이 그대로다", () => {
    const { state, enemies } = setup();
    const hp = enemies[0].hp;
    observe(enemies[0], state, 10);
    step(state, 2);
    expect(enemies[0].hp).toBe(hp);
  });
});

describe("모르페 — 산개 사격", () => {
  it("은 적중한 적의 겹 수만큼 틱이 박히고 겹은 소모되지 않는다", () => {
    const { state, morphe, enemies } = setup();
    observe(enemies[0], state, 10);
    morphe.attackCooldown = 0;
    morphe.targetId = enemies[0].id;
    const events = step(state, 0.05);
    const ticks = events.filter((event) => event.kind === "observationTick");
    expect(ticks).toHaveLength(10);
    expect(ticks.every((event) => event.kind === "observationTick" && event.count === 10)).toBe(true);
    expect(enemies[0].observation?.stacks).toBe(10);
  });

  it("은 겹이 없으면 틱이 없고, 겹이 많을수록 더 아프다", () => {
    const damageAfter = (stacks: number): number => {
      const { state, morphe, enemies } = setup();
      observe(enemies[0], state, stacks);
      morphe.attackCooldown = 0;
      morphe.targetId = enemies[0].id;
      const hp = enemies[0].hp;
      const events = step(state, 0.05);
      if (stacks === 0) expect(events.some((event) => event.kind === "observationTick")).toBe(false);
      return hp - enemies[0].hp;
    };
    expect(damageAfter(10)).toBeGreaterThan(damageAfter(0));
    expect(damageAfter(25)).toBeGreaterThan(damageAfter(10));
  });

  it("의 틱은 방어를 지나간다 — 방어가 아무리 높아도 겹만큼 들어간다", () => {
    const { state, morphe, enemies } = setup();
    enemies[0].def = { ...enemies[0].def, stats: { ...enemies[0].def.stats, def: 100_000, res: 100_000 } };
    observe(enemies[0], state, 10);
    morphe.attackCooldown = 0;
    morphe.targetId = enemies[0].id;
    const events = step(state, 0.05);
    const total = events.filter((event) => event.kind === "observationTick").reduce((sum, event) => sum + (event.kind === "observationTick" ? event.amount : 0), 0);
    // 공격력 172의 10%가 열 번이다. 방어가 반영되면 1씩밖에 안 들어간다.
    expect(total).toBeGreaterThan(100);
  });
});

describe("모르페 — 정조준 관측", () => {
  it("은 현재 체력이 가장 높은 적을 겨누고 합산이 클수록 세며 겹을 소모하지 않는다", () => {
    const shot = (stacks: number) => {
      const { state, morphe, enemies } = setup(["amo", "toby"]);
      // 체력이 낮은 쪽은 가까운 적이다 — 가장 높은 쪽이 겨눔의 대상이 되어야 한다.
      enemies[0].hp = enemies[0].maxHp * 0.3;
      const highest = enemies.reduce((best, enemy) => enemy.hp > best.hp ? enemy : best);
      observe(highest, state, stacks);
      morphe.energy = 300;
      const hp = highest.hp;
      const events = fireUltimate(state, morphe.id);
      const attack = events.find((event) => event.kind === "attack" && event.skill === "ultimate");
      expect(attack?.kind === "attack" ? attack.targetId : "").toBe(highest.id);
      return { dealt: hp - highest.hp, left: highest.observation?.stacks ?? 0 };
    };
    const none = shot(0);
    const many = shot(20);
    expect(many.dealt).toBeGreaterThan(none.dealt);
    // 겹은 소모되지 않는다.
    expect(many.left).toBe(20);
  });

  it("의 합산은 50겹까지만 인정한다", () => {
    const damageWith = (each: number) => {
      const { state, morphe, enemies } = setup(["amo", "toby", "ripa"]);
      for (const enemy of enemies) { observe(enemy, state, each); enemy.hp = enemy.maxHp; }
      enemies[0].hp = enemies[0].maxHp * 2;
      morphe.energy = 300;
      const hp = enemies[0].hp;
      fireUltimate(state, morphe.id);
      return hp - enemies[0].hp;
    };
    // 3기 × 25겹 = 75겹이든 3기 × 20겹 = 60겹이든 합산 50에서 같다.
    expect(damageWith(25)).toBeGreaterThan(0);
    expect(damageWith(20)).toBe(damageWith(25));
  });
});

describe("디모 — 다중 관측 · 위험 신호 관측", () => {
  it("의 평타는 관측이 없거나 가장 적은 적에게 한 겹을 쌓는다", () => {
    const { state, dimo, enemies } = setup(["amo", "toby"]);
    observe(enemies[0], state, 3);
    dimo.attackCooldown = 0;
    dimo.energy = 0;
    step(state, 0.05);
    expect(enemies[1].observation?.stacks).toBe(1);
    expect(enemies[0].observation?.stacks).toBe(3);
  });

  it("의 궁극기는 게이지가 차면 스스로 나가 체력이 가장 높은 적에게 다섯 겹을 쌓는다", () => {
    const { state, dimo, enemies } = setup(["amo", "toby"]);
    enemies[0].hp = enemies[0].maxHp * 0.2;
    const highest = enemies.reduce((best, enemy) => enemy.hp > best.hp ? enemy : best);
    dimo.energy = dimo.def.ultimate.cost;
    dimo.attackCooldown = 0;
    step(state, 0.05);
    expect(highest.observation?.stacks).toBe(5);
    expect(enemies.find((enemy) => enemy !== highest)?.observation).toBeNull();
  });

  it("는 표적을 향해 곧장 날아들지 않고 사거리 안에서는 전장을 떠돈다", () => {
    const { state, dimo, enemies } = setup();
    enemies[0].x = 500; enemies[0].y = 400;
    dimo.attackCooldown = Number.POSITIVE_INFINITY;
    const start = { x: dimo.x, y: dimo.y };
    step(state, 4);
    // 서서 쏘지 않는다 — 자리가 계속 바뀐다.
    expect(Math.hypot(dimo.x - start.x, dimo.y - start.y)).toBeGreaterThan(20);
  });
});

describe("디모 — 도주 비행", () => {
  it("는 유체화라 밀어내기에 참여하지 않는다", () => {
    expect(getRelic("dimo").passive.phasesThroughFighters).toBe(true);
  });

  it("는 가까이 온 적에게서 멀어진다", () => {
    const { state, dimo, enemies } = setup();
    enemies[0].x = 500; enemies[0].y = 560;
    dimo.x = 500; dimo.y = 700;
    const before = Math.hypot(dimo.x - enemies[0].x, dimo.y - enemies[0].y);
    step(state, 1.5);
    expect(Math.hypot(dimo.x - enemies[0].x, dimo.y - enemies[0].y)).toBeGreaterThan(before + 40);
  });

  it("는 구석에 몰려도 전장 밖으로 나가지 않고 그 자리에 붙어 서지도 않는다", () => {
    const { state, dimo, enemies } = setup();
    dimo.x = 10; dimo.y = 10;
    enemies[0].x = 120; enemies[0].y = 120;
    step(state, 3);
    expect(dimo.x).toBeGreaterThanOrEqual(0);
    expect(dimo.y).toBeGreaterThanOrEqual(0);
    expect(Math.hypot(dimo.x - 10, dimo.y - 10)).toBeGreaterThan(60);
  });

  it("는 적이 멀리 있으면 도망치지 않고 전장을 떠돈다", () => {
    const { state, dimo, enemies } = setup();
    enemies[0].x = 900; enemies[0].y = 100;
    const start = { x: dimo.x, y: dimo.y };
    step(state, 4);
    expect(Math.hypot(dimo.x - start.x, dimo.y - start.y)).toBeGreaterThan(20);
  });
});

describe("모르페 — 오버클럭", () => {
  function enterFever() {
    const context = setup();
    const { state, morphe, enemies } = context;
    morphe.ferocity = FEROCITY_RULES.max - 1;
    morphe.attackCooldown = 0;
    morphe.targetId = enemies[0].id;
    step(state, 0.05);
    return context;
  }

  it("은 모르페와 디모가 함께 끓고 모르페 공격력의 500%를 각자 막으로 두른다", () => {
    const { morphe, dimo } = enterFever();
    expect(morphe.ferocityFever).toBe(true);
    expect(dimo.ferocityFever).toBe(true);
    const expected = Math.round(morphe.def.stats.atk * 5);
    expect(morphe.shield.amount).toBeGreaterThan(expected * 0.9);
    expect(dimo.shield.amount).toBeGreaterThan(expected * 0.9);
  });

  it("의 막은 폭주의 절반이 지나면 다 사라지고 그 사이에 서서히 줄어든다", () => {
    const { state, morphe } = enterFever();
    const start = morphe.shield.amount;
    step(state, 2);
    expect(morphe.shield.amount).toBeLessThan(start);
    expect(morphe.shield.amount).toBeGreaterThan(0);
    step(state, 2.2);
    expect(morphe.shield.amount).toBe(0);
  });

  it("은 공격 속도가 함께 오르고 이동 속도는 디모만 오른다", () => {
    const { state, morphe, dimo } = setup();
    const baseInterval = attackInterval(morphe, state);
    const baseDimoMove = moveSpeed(dimo, state);
    const baseMorpheMove = moveSpeed(morphe, state);
    morphe.ferocityFever = true; dimo.ferocityFever = true;
    expect(attackInterval(morphe, state)).toBeCloseTo(baseInterval / 1.5, 6);
    expect(moveSpeed(dimo, state)).toBeCloseTo(baseDimoMove * 1.5, 6);
    expect(moveSpeed(morphe, state)).toBe(baseMorpheMove);
  });

  it("은 소환수 주위의 적을 매초 지지되 관측은 쌓지 않는다", () => {
    const { state, dimo, enemies } = enterFever();
    // 소환수 바로 옆에 적을 세우고 1초를 흘린다.
    enemies[0].x = dimo.x + 40; enemies[0].y = dimo.y;
    const before = enemies[0].hp;
    const events = step(state, 1.1);
    expect(enemies[0].hp).toBeLessThan(before);
    expect(events.some((event) => event.kind === "areaImpact")).toBe(true);
    expect(enemies[0].observation).toBeNull();
  });

  it("은 회복이 없다 — 폭주 중에도 되찾는 것은 요람 연결뿐이다", () => {
    expect(getRelic("morphe").ferocityTrait.effectId).toBe("overclock");
    expect(JSON.stringify(getRelic("morphe").ferocityTrait)).not.toMatch(/heal|regen/i);
  });
});

describe("모르페 스킬의 디모 태그", () => {
  it("패시브와 폭주 본문이 디모를 누르면 열리는 소환수 태그로 건다", async () => {
    const { passiveDescription, ferocityTraitDescription } = await import("../../src/ui/skillPresentation");
    const morphe = getRelic("morphe");
    const stats = { attack: 100, defense: 50, maxHp: 1000, abilityPower: 0 };
    expect(passiveDescription(morphe.passive)).toContain("[[summon-dimo|디모]]");
    expect(ferocityTraitDescription(morphe.ferocityTrait, stats)).toContain("[[summon-dimo|디모]]");
  });

  it("보호막·방어력·저항력·이동 속도도 규칙어 태그로 열린다", async () => {
    const { passiveDescription, ferocityTraitDescription } = await import("../../src/ui/skillPresentation");
    const { KEYWORDS } = await import("../../src/data/keywords");
    const morphe = getRelic("morphe");
    const stats = { attack: 100, defense: 50, maxHp: 1000, abilityPower: 0 };
    const passive = passiveDescription(morphe.passive, 100, { defense: 50, resistance: 50 });
    expect(passive).toContain("[[def|");
    expect(passive).toContain("[[res|");
    expect(ferocityTraitDescription(morphe.ferocityTrait, stats)).toContain("[[shield|");
    expect(ferocityTraitDescription(getRelic("dimo").ferocityTrait, stats)).toContain("[[move-speed|");
    for (const id of ["res", "move-speed", "shield"]) expect(KEYWORDS.some((keyword) => keyword.id === id), id).toBe(true);
  });
});
