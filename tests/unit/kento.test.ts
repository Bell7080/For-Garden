import { describe, expect, it } from "vitest";
import { activeCombatBuffs, createSkirmish, fireUltimate, isFighterAlive, stepSkirmish, type Arena, type Fighter, type SkirmishEvent, type SkirmishState } from "../../src/core/skirmish";
import { combatPower } from "../../src/core/combatPower";
import { getRelic } from "../../src/data/relics";
import { ferocityTraitDescription, passiveDescription, prickleKeyword, skillDescription } from "../../src/ui/skillPresentation";

/**
 * 켄토 — 불 R 탱커. 맞을수록 「까칠」이 쌓이고 때린 쪽이 겹 수만큼 마법 피해를 되받는다.
 * 지속 피해는 때린 손이 없으므로 겹도 반격도 만들지 않고, 반격은 `strike`를 다시 부르지 않아 고리가 생기지 않는다.
 */
const ARENA: Arena = { left: 0, right: 1_000, top: 0, bottom: 1_200 };

function quiet(state: SkirmishState): void {
  for (const fighter of state.fighters) fighter.attackCooldown = Number.POSITIVE_INFINITY;
}

function setup(enemyIds: string[] = ["amo"]) {
  const state = createSkirmish([getRelic("kento")], enemyIds.map((id) => getRelic(id)), ARENA);
  const kento = state.fighters[0];
  const enemies = state.fighters.filter((fighter) => fighter.side === "enemy");
  quiet(state);
  kento.x = 500; kento.y = 900;
  enemies.forEach((enemy, index) => { enemy.x = 500 + index * 40; enemy.y = 860; enemy.stealthFor = 0; });
  return { state, kento, enemies };
}

function step(state: SkirmishState, seconds: number): SkirmishEvent[] {
  const events: SkirmishEvent[] = [];
  for (let elapsed = 0; elapsed < seconds; elapsed += 0.05) events.push(...stepSkirmish(state, Math.min(0.05, seconds - elapsed)));
  return events;
}

/** 적 한 명이 켄토를 정확히 한 번 때리게 한다. */
function hitOnce(state: SkirmishState, enemy: Fighter, kento: Fighter): void {
  enemy.targetId = kento.id;
  enemy.attackCooldown = 0;
  step(state, 0.1);
  enemy.attackCooldown = Number.POSITIVE_INFINITY;
}

describe("켄토 — 까칠", () => {
  it("은 불 R 탱커이고 시그널 아이 소속이다", () => {
    const kento = getRelic("kento");
    expect([kento.rarity, kento.element, kento.role, kento.squad]).toEqual(["R", "fire", "tank", "eye"]);
    expect(kento.researcherTitle).toBe("담당관");
  });

  it("은 맞을 때마다 한 겹 쌓이고 때린 적이 되받는다", () => {
    const { state, kento, enemies } = setup();
    const [enemy] = enemies;
    const before = enemy.hp;
    hitOnce(state, enemy, kento);
    expect(kento.prickle?.stacks).toBe(1);
    expect(enemy.hp).toBeLessThan(before);
    const afterFirst = enemy.hp;
    hitOnce(state, enemy, kento);
    expect(kento.prickle?.stacks).toBe(2);
    // 겹이 늘어난 만큼 되받는 몫도 커진다.
    expect(afterFirst - enemy.hp).toBeGreaterThan(before - afterFirst);
  });

  it("은 겹이 상한에서 멈추고 시간이 다하면 한꺼번에 사라진다", () => {
    const { state, kento, enemies } = setup();
    kento.prickle = { stacks: 10, remaining: 6, total: 6 };
    hitOnce(state, enemies[0], kento);
    expect(kento.prickle?.stacks).toBe(10);
    kento.hp = kento.maxHp;
    step(state, 6.2);
    expect(kento.prickle).toBeNull();
  });

  it("은 출혈 같은 지속 피해로는 겹이 쌓이지 않는다", () => {
    const { state, kento } = setup();
    kento.bleed = { remaining: 3, total: 3, tickIn: 0.05, percent: 2 };
    step(state, 1);
    expect(kento.prickle).toBeNull();
  });

  it("은 제 평타가 적중해도 한 겹을 쌓는다", () => {
    const { state, kento, enemies } = setup();
    kento.attackCooldown = 0;
    kento.targetId = enemies[0].id;
    step(state, 0.1);
    expect(kento.prickle?.stacks).toBe(1);
  });

  it("은 폭주 중 겹이 두 배로 쌓인다", () => {
    const { state, kento, enemies } = setup();
    kento.ferocityFever = true;
    hitOnce(state, enemies[0], kento);
    expect(kento.prickle?.stacks).toBe(2);
  });

  it("은 쓰러진 반격 상대를 정리하고 사망 사건을 남긴다", () => {
    const { state, kento, enemies } = setup();
    kento.prickle = { stacks: 10, remaining: 6, total: 6 };
    enemies[0].hp = 1;
    enemies[0].targetId = kento.id;
    enemies[0].attackCooldown = 0;
    const events = step(state, 0.1);
    expect(isFighterAlive(enemies[0])).toBe(false);
    expect(events.some((event) => event.kind === "death" && event.fighterId === enemies[0].id)).toBe(true);
  });
});

describe("켄토 — 최전방 전개 부대", () => {
  it("는 도발·보호막·까칠 다섯 겹을 얻고 도발이 끝나는 순간 충격파로 기절시킨다", () => {
    const { state, kento, enemies } = setup();
    kento.energy = 1_000;
    const events = fireUltimate(state, kento.id);
    expect(events.some((event) => event.kind === "shieldGranted" && event.fighterId === kento.id)).toBe(true);
    expect(kento.prickle?.stacks).toBe(5);
    expect(enemies[0].taunted?.sourceId).toBe(kento.id);
    expect(kento.fortress).not.toBeNull();
    expect(enemies[0].stunnedFor).toBe(0);
    const after = step(state, 4.2);
    expect(kento.fortress).toBeNull();
    expect(after.some((event) => event.kind === "areaImpact" && event.status === "stun")).toBe(true);
    expect(enemies[0].stunnedFor).toBeGreaterThan(0);
  });

  it("는 도는 동안 프로필에 남은 시간을 가진 칩으로 서고 까칠은 겹 수를 든다", () => {
    const { state, kento } = setup();
    kento.energy = 1_000;
    fireUltimate(state, kento.id);
    const buffs = activeCombatBuffs(state, kento.id);
    expect(buffs.some((buff) => buff.name === "최전방 전개 부대")).toBe(true);
    expect(buffs.find((buff) => buff.name === "까칠한 성격")?.stacks).toBe(5);
  });
});

describe("켄토 — 표시 계약", () => {
  const kento = getRelic("kento");
  it("의 본문은 데이터에서 조립되고 까칠 태그를 가리킨다", () => {
    expect(kento.basic.desc).toBeUndefined();
    expect(passiveDescription(kento.passive)).toBe("적에게 피격당할 때마다 [[kento-prickle|까칠]]이 한 겹 쌓이고, 때린 적이 겹 수만큼 되받는다.");
    expect(skillDescription(kento.basic)).toContain("[[kento-prickle|까칠]]이 1겹 쌓인다");
    expect(skillDescription(kento.ultimate)).toContain("[[kento-prickle|까칠]]이 5겹 더 쌓인다");
    expect(skillDescription(kento.ultimate)).toContain("충격파");
    expect(ferocityTraitDescription(kento.ferocityTrait)).toBe("폭주에 들어가는 순간 넓은 범위의 적을 3초 동안 [[taunt|도발]]한다. 폭주 중에는 [[kento-prickle|까칠]]이 한 번에 2배로 쌓인다.");
  });

  it("의 태그는 겹 상한·비율·시간을 전투가 읽는 필드에서 짓는다", () => {
    const keyword = prickleKeyword(kento.passive)!;
    expect(keyword.id).toBe("kento-prickle");
    expect(keyword.description).toContain("최대 10겹");
    expect(keyword.description).toContain("30%");
    expect(keyword.description).toContain("6초");
    expect(keyword.description).not.toContain("[[");
  });

  it("은 R 등급 띠 안의 태생 전투력을 갖는다", () => {
    expect(combatPower(kento.stats)).toBeGreaterThanOrEqual(2080);
    expect(combatPower(kento.stats)).toBeLessThanOrEqual(2200);
  });
});
