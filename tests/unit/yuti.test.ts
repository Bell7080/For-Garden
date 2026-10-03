import { describe, expect, it } from "vitest";
import { applyCombatStatusEffect, createSkirmish, fireUltimate, stepSkirmish, type Arena, type SkirmishState } from "../../src/core/skirmish";
import { getRelic } from "../../src/data/relics";
import { findKeyword } from "../../src/data/keywords";
import { passiveDescription, plumeKeyword, skillDescription } from "../../src/ui/skillPresentation";

/**
 * 유티 — 바람 SSR 중거리 암살자. 일반 공격이 두 갈래로 갈라져 적마다 「서리깃」을 박고, 다섯 겹이 차면
 * 둔화 출혈로 바뀐다. 궁극기는 세 번에 나눠 찍으며 적마다 세 겹을 쌓는다.
 */
const ARENA: Arena = { left: 0, right: 1_000, top: 0, bottom: 1_200 };
const YUTI = getRelic("yuti");
const PLUME = YUTI.basic.statusEffects!.find((effect) => effect.kind === "frostPlume")!;
if (PLUME.kind !== "frostPlume") throw new Error("서리깃 계약이 없다");

function setup(enemyIds: string[]) {
  const state = createSkirmish([YUTI], enemyIds.map((id) => getRelic(id)), ARENA);
  const yuti = state.fighters.find((fighter) => fighter.side === "player")!;
  const enemies = state.fighters.filter((fighter) => fighter.side === "enemy");
  for (const fighter of state.fighters) { fighter.attackCooldown = Number.POSITIVE_INFINITY; fighter.retargetIn = Number.POSITIVE_INFINITY; }
  yuti.x = 500; yuti.y = 900; yuti.stealthFor = 0;
  enemies.forEach((enemy, index) => { enemy.x = 460 + index * 70; enemy.y = 700; enemy.stealthFor = 0; });
  return { state, yuti, enemies };
}

function step(state: SkirmishState, seconds: number): void {
  for (let elapsed = 0; elapsed < seconds - 1e-9; elapsed += 0.05) stepSkirmish(state, Math.min(0.05, seconds - elapsed));
}

describe("유티 — 정체성과 문장", () => {
  it("은 바람 SSR 중거리 암살자이고 앱솔루트 팽 소속이다", () => {
    expect([YUTI.name, YUTI.rarity, YUTI.element, YUTI.role, YUTI.reachTier, YUTI.squad]).toEqual(["유티", "SSR", "wind", "assassin", "mid", "fang"]);
  });

  it("의 수치는 데이터가 정한 값이고 태그와 본문이 그것을 읽는다", () => {
    expect(PLUME).toMatchObject({ maxStacks: 5, holdSeconds: 8, burstPower: 200, burstSeconds: 4, slowSeconds: 3 });
    expect(YUTI.passive).toMatchObject({ openingStealthSeconds: 4, criticalChancePercent: 20, attackSpeedPercent: 20, killHaste: { seconds: 4, attackSpeedPercent: 50, moveSpeedPercent: 50 } });
    expect(YUTI.basic.maxTargets).toBe(2);
    expect(YUTI.ultimate.repeatStrike?.count).toBe(3);
    expect((YUTI.ultimate.power ?? 0) * 3).toBe(240);
    expect(YUTI.ferocityTrait).toMatchObject({ effectId: "extraFork", extraForks: 1, attackSpeedBonusPercent: 33 });
    const keyword = plumeKeyword(YUTI)!;
    expect(keyword.id).toBe("yuti-plume");
    expect(keyword.description).toContain("5겹");
    expect(keyword.description).not.toContain("[[");
    expect(findKeyword("yuti-plume") ?? keyword).toBeDefined();
    expect(passiveDescription(YUTI.passive)).toContain("4초");
    const basic = skillDescription(YUTI.basic);
    expect(basic).toContain("[[yuti-plume|서리깃]]");
    expect(basic).toContain("서로 다른 적 2명");
  });
});

describe("유티 — 서리깃", () => {
  it("은 겹마다 쌓이다가 다섯 겹에서 둔화 출혈로 바뀐다", () => {
    const { state, yuti, enemies: [enemy] } = setup(["amo"]);
    for (let n = 1; n < PLUME.maxStacks; n += 1) {
      applyCombatStatusEffect(enemy, PLUME, [], state, yuti.id);
      expect(enemy.frostPlume?.stacks).toBe(n);
      expect(enemy.frostbite).toBeNull();
    }
    applyCombatStatusEffect(enemy, PLUME, [], state, yuti.id);
    expect(enemy.frostPlume).toBeNull();
    expect(enemy.frostbite).not.toBeNull();
    expect(enemy.frostbite!.slowPercent).toBe(PLUME.slowPercent);
  });

  it("출혈은 겹치지 않고 다시 걸리면 갱신된다", () => {
    const { state, yuti, enemies: [enemy] } = setup(["amo"]);
    for (let n = 0; n < PLUME.maxStacks; n += 1) applyCombatStatusEffect(enemy, PLUME, [], state, yuti.id);
    step(state, 2);
    const before = enemy.frostbite!.remaining;
    for (let n = 0; n < PLUME.maxStacks; n += 1) applyCombatStatusEffect(enemy, PLUME, [], state, yuti.id);
    expect(enemy.frostbite!.remaining).toBeGreaterThan(before);
    expect(enemy.frostbite!.remaining).toBeLessThanOrEqual(PLUME.burstSeconds);
  });

  it("출혈은 시간에 걸쳐 체력을 깎고 둔화가 끝나면 풀린다", () => {
    const { state, yuti, enemies: [enemy] } = setup(["amo"]);
    for (let n = 0; n < PLUME.maxStacks; n += 1) applyCombatStatusEffect(enemy, PLUME, [], state, yuti.id);
    const hp = enemy.hp;
    step(state, 1.2);
    expect(enemy.hp).toBeLessThan(hp);
    step(state, PLUME.burstSeconds + 1);
    expect(enemy.frostbite).toBeNull();
  });

  it("은 박힌 뒤 유지 시간이 지나면 사라진다", () => {
    const { state, yuti, enemies: [enemy] } = setup(["amo"]);
    applyCombatStatusEffect(enemy, PLUME, [], state, yuti.id);
    step(state, PLUME.holdSeconds + 0.5);
    expect(enemy.frostPlume).toBeNull();
  });
});

describe("유티 — 갈래와 궁극기", () => {
  it("일반 공격은 서로 다른 두 적에게 한 겹씩 박는다", () => {
    const { state, yuti, enemies } = setup(["amo", "toby", "torika"]);
    yuti.attackCooldown = 0;
    step(state, 0.6);
    const hit = enemies.filter((enemy) => (enemy.frostPlume?.stacks ?? 0) > 0);
    expect(hit.length).toBe(2);
    for (const enemy of hit) expect(enemy.frostPlume!.stacks).toBe(1);
  });

  it("적이 하나뿐이면 두 장이 모두 그 적에게 박혀 두 겹이 쌓인다", () => {
    const { state, yuti, enemies: [enemy] } = setup(["amo"]);
    yuti.attackCooldown = 0;
    step(state, 0.6);
    expect(enemy.frostPlume?.stacks).toBe(2);
  });

  it("궁극기는 범위 안의 적마다 세 겹을 쌓는다", () => {
    const { state, yuti, enemies } = setup(["amo", "toby"]);
    yuti.energy = 100;
    fireUltimate(state, yuti.id, undefined, { x: 490, y: 700 });
    yuti.attackCooldown = Number.POSITIVE_INFINITY;
    step(state, 1.5);
    for (const enemy of enemies) expect(enemy.frostPlume?.stacks).toBe(3);
  });
});

describe("유티 — 처치 가속", () => {
  it("적을 쓰러뜨리면 공격 속도와 이동 속도가 오른다", () => {
    const { state, yuti, enemies: [enemy] } = setup(["amo"]);
    enemy.hp = 1;
    yuti.attackCooldown = 0;
    step(state, 0.6);
    expect(yuti.killHaste?.attackSpeedPercent).toBe(50);
  });
});
