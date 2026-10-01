import { describe, expect, it } from "vitest";
import { applyCombatStatusEffect, attackInterval, createSkirmish, fireUltimate, stepSkirmish, type Arena, type Fighter, type SkirmishEvent, type SkirmishState } from "../../src/core/skirmish";
import { combatPower } from "../../src/core/combatPower";
import { withinRarityBand } from "../../src/core/rarityScaling";
import { getRelic } from "../../src/data/relics";
import { findKeyword } from "../../src/data/keywords";
import { ferocityTraitDescription, passiveDescription, skillDescription } from "../../src/ui/skillPresentation";
import { unitStatusViews } from "../../src/ui/unitStatusModel";

/**
 * 안카 — 땅 R 탱커. 「백색소음」이 몇 초마다 울려 주위 아군을 저항력에 비례해 회복하고, 다른 아군을 노리는
 * 주위 적에게 「졸음」을 건다. 세 겹이면 잠들고, 맞으면 깨며 안카 저항력에 비례한 마법 피해를 더 받는다.
 */
const ARENA: Arena = { left: 0, right: 1_000, top: 0, bottom: 1_200 };
const ANKA = getRelic("anka");
const WHITE_NOISE = ANKA.passive.whiteNoise!;
const DROWSY = WHITE_NOISE.drowsy;

function quiet(state: SkirmishState): void {
  for (const fighter of state.fighters) {
    fighter.attackCooldown = Number.POSITIVE_INFINITY;
    fighter.retargetIn = Number.POSITIVE_INFINITY;
  }
}

function setup(enemyIds: string[] = ["amo", "toby"]) {
  const state = createSkirmish([getRelic("anka"), getRelic("torika")], enemyIds.map((id) => getRelic(id)), ARENA);
  const [anka, ally] = state.fighters.filter((fighter) => fighter.side === "player");
  const enemies = state.fighters.filter((fighter) => fighter.side === "enemy");
  quiet(state);
  anka.x = 500; anka.y = 900;
  ally.x = 560; ally.y = 900;
  enemies.forEach((enemy, index) => { enemy.x = 480 + index * 60; enemy.y = 840; enemy.stealthFor = 0; });
  return { state, anka, ally, enemies };
}

function step(state: SkirmishState, seconds: number): SkirmishEvent[] {
  const events: SkirmishEvent[] = [];
  for (let elapsed = 0; elapsed < seconds - 1e-9; elapsed += 0.05) events.push(...stepSkirmish(state, Math.min(0.05, seconds - elapsed)));
  return events;
}

/** 졸음 세 겹을 곧바로 얹어 재운다. */
function putToSleep(state: SkirmishState, anka: Fighter, enemy: Fighter): void {
  for (let index = 0; index < DROWSY.maxStacks; index += 1) applyCombatStatusEffect(enemy, DROWSY, [], state, anka.id);
}

describe("안카 — 정체성", () => {
  it("은 땅 R 탱커이고 사일런트 룬 소속이다", () => {
    expect([ANKA.rarity, ANKA.element, ANKA.role, ANKA.squad, ANKA.origin]).toEqual(["R", "earth", "tank", "rune", "안킬로사우루스"]);
    expect(ANKA.researcherTitle).toBe("연구원 씨");
  });

  it("은 R 띠 안의 태생 전투력을 갖고, 체력·저항력이 높고 주문력이 낮다", () => {
    expect(withinRarityBand(combatPower(ANKA.stats), "R")).toBe(true);
    expect(ANKA.stats.res).toBeGreaterThan(ANKA.stats.atk);
    expect(ANKA.stats.ap).toBeLessThan(ANKA.stats.atk);
  });

  it("은 토리카의 옛 내부 ID(anky)와 겹치지 않는다", () => {
    expect(ANKA.id).toBe("anka");
    expect(getRelic("torika").name).toBe("토리카");
  });
});

describe("안카 — 백색소음", () => {
  it("은 울릴 때마다 주위 아군을 저항력에 비례해 회복한다", () => {
    const { state, anka, ally } = setup();
    ally.hp = ally.maxHp / 2;
    const before = ally.hp;
    step(state, WHITE_NOISE.intervalSeconds + 0.05);
    expect(ally.hp - before).toBeCloseTo(ANKA.stats.res * WHITE_NOISE.healResistancePercent / 100, 0);
    expect(anka.whiteNoiseIn).toBeGreaterThan(0);
  });

  it("은 안카가 아닌 아군을 노리는 적에게만 졸음을 쌓는다", () => {
    const { state, anka, ally, enemies } = setup();
    const [onAlly, onAnka] = enemies;
    onAlly.targetId = ally.id;
    onAnka.targetId = anka.id;
    step(state, WHITE_NOISE.intervalSeconds + 0.05);
    expect(onAlly.drowsy?.stacks).toBe(1);
    expect(onAnka.drowsy).toBeNull();
    expect(unitStatusViews(onAlly).find((view) => view.id === "drowsy")?.stacks).toBe(1);
  });

  it("은 반경 밖의 적을 건드리지 않는다", () => {
    const { state, anka, ally, enemies } = setup();
    const [enemy] = enemies;
    enemy.targetId = ally.id;
    enemy.y = 900 - WHITE_NOISE.radius - 80;
    // 걸어 들어오기 전에 울리게 한다.
    anka.whiteNoiseIn = 0.05;
    step(state, 0.1);
    expect(enemy.drowsy).toBeNull();
  });
});

describe("안카 — 졸음과 수면", () => {
  it("은 세 겹이 차면 잠들어 행동하지 못하고, 머리 위에는 기절이 아니라 수면으로 선다", () => {
    const { state, anka, enemies } = setup();
    const [enemy] = enemies;
    putToSleep(state, anka, enemy);
    expect(enemy.sleep).not.toBeNull();
    expect(enemy.drowsy).toBeNull();
    expect(enemy.stunnedFor).toBeCloseTo(DROWSY.sleepSeconds, 5);
    const ids = unitStatusViews(enemy).map((view) => view.id);
    expect(ids).toContain("sleep");
    expect(ids).not.toContain("stun");
  });

  it("은 피해를 받으면 깨며 안카 저항력에 비례한 마법 피해를 더 받고, 잠이 덜 깨 공격 속도가 깎인다", () => {
    const { state, anka, enemies } = setup();
    const [enemy] = enemies;
    putToSleep(state, anka, enemy);
    const interval = attackInterval(enemy, state);
    anka.targetId = enemy.id;
    anka.attackCooldown = 0;
    const events = step(state, 0.1);
    expect(enemy.sleep).toBeNull();
    expect(enemy.stunnedFor).toBe(0);
    const wake = events.find((event) => event.kind === "sleepWake");
    expect(wake).toBeDefined();
    if (wake?.kind === "sleepWake") {
      expect(wake.attackerId).toBe(anka.id);
      expect(wake.amount).toBeGreaterThan(0);
    }
    expect(enemy.groggy?.attackSpeedPercent).toBe(DROWSY.groggyAttackSpeedPercent);
    expect(attackInterval(enemy, state)).toBeGreaterThan(interval);
  });

  it("은 시간이 다해 스스로 깨면 추가 피해가 없다", () => {
    const { state, anka, enemies } = setup();
    const [enemy] = enemies;
    putToSleep(state, anka, enemy);
    const events = step(state, DROWSY.sleepSeconds + 0.1);
    expect(enemy.sleep).toBeNull();
    expect(events.some((event) => event.kind === "sleepWake")).toBe(false);
    expect(enemy.groggy).not.toBeNull();
  });

  it("은 잠든 동안 졸음을 더 쌓지 않는다", () => {
    const { state, anka, enemies } = setup();
    const [enemy] = enemies;
    putToSleep(state, anka, enemy);
    applyCombatStatusEffect(enemy, DROWSY, [], state, anka.id);
    expect(enemy.drowsy).toBeNull();
  });

  it("의 태그 수치는 백색소음의 졸음 계약과 같다", () => {
    const drowsy = findKeyword("drowsy")!.description;
    expect(drowsy).toContain(`${DROWSY.maxStacks}겹`);
    expect(drowsy).toContain(`${DROWSY.sleepSeconds}초`);
    expect(drowsy).toContain(`${DROWSY.seconds}초`);
    const sleep = findKeyword("sleep")!.description;
    expect(sleep).toContain(`${DROWSY.wakeResistancePower}%`);
    expect(sleep).toContain(`${DROWSY.groggySeconds}초`);
    expect(sleep).toContain(`${DROWSY.groggyAttackSpeedPercent}%`);
  });
});

describe("안카 — 자장가", () => {
  it("은 아군을 노리던 적을 재우고, 안카를 노리던 적을 도발하며, 저항력에 비례한 보호막을 얻는다", () => {
    const { state, anka, ally, enemies } = setup();
    const [onAlly, onAnka] = enemies;
    onAlly.targetId = ally.id;
    onAnka.targetId = anka.id;
    anka.energy = 1_000;
    const plan = ANKA.ultimate.selfLullaby!;
    fireUltimate(state, anka.id);
    expect(onAlly.sleep).not.toBeNull();
    expect(onAnka.sleep).toBeNull();
    expect(onAnka.taunted?.sourceId).toBe(anka.id);
    expect(onAnka.taunted?.remaining).toBeCloseTo(plan.tauntSeconds, 5);
    expect(anka.shield.amount).toBeCloseTo(ANKA.stats.res * plan.shieldResistancePercent / 100, 0);
  });

  it("은 주위 아군에게 잃은 체력에 비례한 재생을 건다", () => {
    const { state, anka, ally, enemies } = setup(["amo"]);
    enemies[0].y = 0;
    ally.hp = ally.maxHp / 2;
    anka.energy = 1_000;
    const plan = ANKA.ultimate.selfLullaby!;
    fireUltimate(state, anka.id);
    expect(ally.lullabyRegen?.missingHpPercentPerSecond).toBe(plan.regen.missingHpPercentPerSecond);
    const missing = ally.maxHp - ally.hp;
    anka.whiteNoiseIn = Number.POSITIVE_INFINITY;
    step(state, 1.02);
    expect(ally.hp - ally.maxHp / 2).toBeCloseTo(missing * plan.regen.missingHpPercentPerSecond / 100, 0);
    step(state, plan.regen.seconds);
    expect(ally.lullabyRegen).toBeNull();
  });
});

describe("안카 — 잠투정", () => {
  it("은 폭주 중 공격 속도가 오르고 기본 공격이 주위 적을 모두 쳐 짧게 밀어낸다", () => {
    const { state, anka, enemies } = setup();
    const calm = attackInterval(anka, state);
    anka.ferocityFever = true;
    expect(attackInterval(anka, state)).toBeLessThan(calm);
    anka.targetId = enemies[0].id;
    anka.attackCooldown = 0;
    const events = step(state, 0.05);
    const knocked = events.filter((event) => event.kind === "knockback").map((event) => event.kind === "knockback" ? event.fighterId : "");
    expect(new Set(knocked)).toEqual(new Set(enemies.map(({ id }) => id)));
  });
});

describe("안카 — 설명문", () => {
  it("은 패시브·궁극기·폭주를 구조화 필드에서 짓고 실제 값을 태그로 세운다", () => {
    const passive = passiveDescription(ANKA.passive, ANKA.stats.atk, { defense: ANKA.stats.def, resistance: ANKA.stats.res });
    expect(passive).toContain(`[[heal-value|${Math.round(ANKA.stats.res * WHITE_NOISE.healResistancePercent / 100)}]]`);
    expect(passive).toContain("[[drowsy|");
    const ultimate = skillDescription(ANKA.ultimate, { resistance: ANKA.stats.res });
    expect(ultimate).toContain(`[[shield-value|${Math.round(ANKA.stats.res * ANKA.ultimate.selfLullaby!.shieldResistancePercent / 100)}]]`);
    expect(ultimate).toContain("[[sleep|");
    expect(ferocityTraitDescription(ANKA.ferocityTrait)).toContain("40%");
    for (const text of [passive, ultimate]) expect(text).not.toMatch(/undefined|\{\w+\}/);
  });
});
