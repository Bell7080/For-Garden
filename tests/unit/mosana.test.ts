import { describe, expect, it } from "vitest";
import { activeCombatBuffs, attackInterval, createSkirmish, fireUltimate, isFighterAlive, stepSkirmish, type Arena, type Fighter, type SkirmishEvent, type SkirmishState } from "../../src/core/skirmish";
import { combatPower } from "../../src/core/combatPower";
import { withinRarityBand } from "../../src/core/rarityScaling";
import { getRelic } from "../../src/data/relics";
import { findKeyword } from "../../src/data/keywords";
import { ferocityTraitDescription, passiveDescription, skillDescription } from "../../src/ui/skillPresentation";
import { unitStatusViews } from "../../src/ui/unitStatusModel";
import type { CombatStatusEffect } from "../../src/core/types";

/**
 * 모사나 — 물 SR 탱커. 일반 공격이 「수압」을 쌓고, 세 겹이 차면 터져 기절시키며 자기 방어력·저항력에서
 * 나온 물리 피해를 준다. 수압의 기절이 들어갈 때마다 「인양 성공」이 막을 상한까지 채운다.
 */
const ARENA: Arena = { left: 0, right: 1_000, top: 0, bottom: 1_200 };

function quiet(state: SkirmishState): void {
  for (const fighter of state.fighters) fighter.attackCooldown = Number.POSITIVE_INFINITY;
}

function setup(enemyIds: string[] = ["amo"]) {
  const state = createSkirmish([getRelic("mosana")], enemyIds.map((id) => getRelic(id)), ARENA);
  const mosana = state.fighters[0];
  const enemies = state.fighters.filter((fighter) => fighter.side === "enemy");
  quiet(state);
  mosana.x = 500; mosana.y = 900;
  enemies.forEach((enemy, index) => { enemy.x = 500 + index * 40; enemy.y = 860; enemy.stealthFor = 0; });
  return { state, mosana, enemies };
}

function step(state: SkirmishState, seconds: number): SkirmishEvent[] {
  const events: SkirmishEvent[] = [];
  for (let elapsed = 0; elapsed < seconds; elapsed += 0.05) events.push(...stepSkirmish(state, Math.min(0.05, seconds - elapsed)));
  return events;
}

/** 모사나가 정해진 적을 정확히 한 번 때리게 한다. */
function swing(state: SkirmishState, mosana: Fighter, target: Fighter): SkirmishEvent[] {
  mosana.targetId = target.id;
  mosana.attackCooldown = 0;
  const events = step(state, 0.05);
  mosana.attackCooldown = Number.POSITIVE_INFINITY;
  return events;
}

const PRESSURE = getRelic("mosana").basic.statusEffects!.find((effect) => effect.kind === "pressure") as Extract<CombatStatusEffect, { kind: "pressure" }>;

describe("모사나 — 정체성", () => {
  it("은 물 SR 탱커이고 나이트 기어 소속이다", () => {
    const mosana = getRelic("mosana");
    expect([mosana.rarity, mosana.element, mosana.role, mosana.squad]).toEqual(["SR", "water", "tank", "gear"]);
    expect(mosana.researcherTitle).toBe("당신");
  });

  it("은 SR 띠 안의 태생 전투력을 갖는다", () => {
    expect(withinRarityBand(combatPower(getRelic("mosana").stats), "SR")).toBe(true);
  });
});

describe("모사나 — 수압", () => {
  it("은 일반 공격마다 한 겹 쌓이고 겹마다 공격 속도를 깎는다", () => {
    const { state, mosana, enemies } = setup();
    const [enemy] = enemies;
    const before = attackInterval(enemy, state);
    swing(state, mosana, enemy);
    expect(enemy.pressure?.stacks).toBe(1);
    swing(state, mosana, enemy);
    expect(enemy.pressure?.stacks).toBe(2);
    expect(attackInterval(enemy, state)).toBeGreaterThan(before);
    const views = unitStatusViews(enemy);
    expect(views.find((view) => view.id === "pressure")?.stacks).toBe(2);
  });

  it("은 세 겹째에 터져 기절시키고 방어력·저항력에 비례한 물리 피해를 준다", () => {
    const { state, mosana, enemies } = setup();
    const [enemy] = enemies;
    swing(state, mosana, enemy);
    swing(state, mosana, enemy);
    const events = swing(state, mosana, enemy);
    const burst = events.find((event) => event.kind === "pressureBurst");
    expect(burst).toBeDefined();
    expect(enemy.pressure).toBeNull();
    expect(enemy.stunnedFor).toBeGreaterThan(PRESSURE.stunSeconds - 0.2);
    // 방어·저항이 낮으면 같은 터짐도 약하다 — 단단해질수록 세게 누른다.
    const soft = setup();
    soft.mosana.def = { ...soft.mosana.def, stats: { ...soft.mosana.def.stats, def: 10, res: 10 } };
    swing(soft.state, soft.mosana, soft.enemies[0]);
    swing(soft.state, soft.mosana, soft.enemies[0]);
    const softBurst = swing(soft.state, soft.mosana, soft.enemies[0]).find((event) => event.kind === "pressureBurst");
    expect(burst?.kind === "pressureBurst" && softBurst?.kind === "pressureBurst").toBe(true);
    if (burst?.kind === "pressureBurst" && softBurst?.kind === "pressureBurst") expect(softBurst.amount).toBeLessThan(burst.amount);
  });

  it("은 터진 적에게 기절이 풀린 뒤 잠금 시간 동안 다시 쌓이지 않는다", () => {
    const { state, mosana, enemies } = setup();
    const [enemy] = enemies;
    for (let hit = 0; hit < 3; hit += 1) swing(state, mosana, enemy);
    expect(enemy.pressureLockFor).toBeCloseTo(enemy.stunnedFor + PRESSURE.lockoutSeconds, 1);
    swing(state, mosana, enemy);
    expect(enemy.pressure).toBeNull();
    step(state, PRESSURE.stunSeconds + PRESSURE.lockoutSeconds + 0.2);
    expect(enemy.pressureLockFor).toBe(0);
    swing(state, mosana, enemy);
    expect(enemy.pressure?.stacks).toBe(1);
  });

  it("은 시간이 다하면 한꺼번에 사라진다", () => {
    const { state, mosana, enemies } = setup();
    swing(state, mosana, enemies[0]);
    step(state, PRESSURE.seconds + 0.2);
    expect(enemies[0].pressure).toBeNull();
  });

  it("은 쓰러뜨린 적을 정리하고 사망 사건을 남긴다", () => {
    const { state, mosana, enemies } = setup();
    const [enemy] = enemies;
    swing(state, mosana, enemy);
    swing(state, mosana, enemy);
    enemy.hp = 1;
    enemy.shield.amount = 0;
    const events = swing(state, mosana, enemy);
    expect(isFighterAlive(enemy)).toBe(false);
    expect(events.some((event) => event.kind === "death" && event.fighterId === enemy.id)).toBe(true);
  });

  it("의 태그 수치는 일반 공격 정의와 같다", () => {
    const description = findKeyword("pressure")!.description;
    expect(description).toContain(`${PRESSURE.speedPercentPerStack}%`);
    expect(description).toContain(`${PRESSURE.seconds}초`);
    expect(description).toContain(`${PRESSURE.maxStacks}겹째`);
    expect(description).toContain(`${PRESSURE.stunSeconds}초 동안 기절`);
    expect(PRESSURE.defensePower).toBe(PRESSURE.resistancePower);
    expect(description).toContain(`${PRESSURE.defensePower}%씩`);
    expect(description).toContain(`${PRESSURE.lockoutSeconds}초 동안 다시`);
  });
});

describe("모사나 — 인양 성공", () => {
  const passive = getRelic("mosana").passive.salvageCatch!;

  it("은 수압의 기절이 들어갈 때마다 막을 얻는다", () => {
    const { state, mosana, enemies } = setup();
    for (let hit = 0; hit < 3; hit += 1) swing(state, mosana, enemies[0]);
    expect(mosana.shield.amount).toBeCloseTo(mosana.maxHp * passive.shieldMaxHpPercent / 100, 0);
  });

  it("은 지금 두른 막이 상한에 닿아 있으면 그 선까지만 채운다", () => {
    const { state, mosana, enemies } = setup();
    mosana.shield.amount = mosana.maxHp * 0.2;
    for (let hit = 0; hit < 3; hit += 1) swing(state, mosana, enemies[0]);
    expect(mosana.shield.amount).toBeCloseTo(mosana.maxHp * passive.capMaxHpPercent / 100, 0);

    const thick = setup();
    thick.mosana.shield.amount = thick.mosana.maxHp * 0.3;
    for (let hit = 0; hit < 3; hit += 1) swing(thick.state, thick.mosana, thick.enemies[0]);
    expect(thick.mosana.shield.amount).toBeCloseTo(thick.mosana.maxHp * 0.3, 0);
  });
});

describe("모사나 — 심해 인양", () => {
  it("은 가장 먼 적 하나만 끌어와 도발하고 막을 두른다", () => {
    const { state, mosana, enemies } = setup(["amo", "dodo", "tia"]);
    enemies[0].x = 520; enemies[0].y = 850;
    enemies[1].x = 300; enemies[1].y = 500;
    enemies[2].x = 800; enemies[2].y = 100;
    mosana.energy = 1_000;
    const events = fireUltimate(state, mosana.id);
    expect(events.some((event) => event.kind === "shieldGranted" && event.fighterId === mosana.id)).toBe(true);
    expect(Math.hypot(enemies[2].x - mosana.x, enemies[2].y - mosana.y)).toBeCloseTo(150, 0);
    expect(enemies[2].taunted?.sourceId).toBe(mosana.id);
    expect(enemies[0].taunted).toBeNull();
    expect(enemies[1].taunted).toBeNull();
    expect(enemies[1].x).toBe(300);
  });

  it("은 숨은 적보다 보이는 적을 먼저 고른다", () => {
    const { state, mosana, enemies } = setup(["amo", "dodo"]);
    enemies[0].x = 600; enemies[0].y = 700;
    enemies[1].x = 100; enemies[1].y = 100; enemies[1].stealthFor = 5;
    mosana.energy = 1_000;
    fireUltimate(state, mosana.id);
    expect(enemies[0].taunted?.sourceId).toBe(mosana.id);
    expect(enemies[1].taunted).toBeNull();
  });
});

describe("모사나 — 심해 와류", () => {
  it("는 폭주 중 공격 속도를 올리고 평타가 주위 모든 적에게 수압을 쌓는다", () => {
    const { state, mosana, enemies } = setup(["amo", "dodo", "tia"]);
    const calm = attackInterval(mosana, state);
    mosana.ferocityFever = true;
    expect(attackInterval(mosana, state)).toBeLessThan(calm);
    swing(state, mosana, enemies[0]);
    for (const enemy of enemies) expect(enemy.pressure?.stacks, enemy.def.id).toBe(1);
    expect(mosana.shield.amount).toBe(0);
  });
});

describe("모사나 — 표시 계약", () => {
  const mosana = getRelic("mosana");
  it("의 본문은 데이터에서 조립되고 수압 태그를 가리킨다", () => {
    expect(mosana.basic.desc).toBeUndefined();
    expect(skillDescription(mosana.basic)).toContain("[[pressure|수압]]을 한 겹 쌓는다");
    expect(passiveDescription(mosana.passive)).toBe("[[pressure|수압]]으로 적을 [[stun|기절]]시킬 때마다 최대 체력의 6%만큼 [[shield|보호막]]을 얻는다. 지금 두른 보호막이 최대 체력의 24%에 닿아 있으면 그 선까지만 채운다.");
    expect(skillDescription(mosana.ultimate)).toContain("가장 멀리 있는 적 하나를 [[pull|끌어당겨]] 4초 동안 [[taunt|도발]]");
    expect(ferocityTraitDescription(mosana.ferocityTrait)).toBe("[[attack-speed|공격 속도]]가 40% 증가하고, [[basic-attack|기본 공격]]이 자신의 주위 모든 적에게 적중해 맞은 적 모두에게 [[pressure|수압]]을 쌓는다.");
  });

  it("의 폭주는 보호막을 주지 않아 프로필 버프 칩에도 막이 서지 않는다", () => {
    const { state, mosana } = setup();
    mosana.ferocityFever = true;
    expect(activeCombatBuffs(state, mosana.id).some((buff) => buff.name.includes("보호막"))).toBe(false);
  });
});
