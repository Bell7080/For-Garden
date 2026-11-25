import { describe, expect, it } from "vitest";
import { createSkirmish, currentAttackSpeed, defensiveDefinition, fireUltimate, replayLoggedBossAction, stepSkirmish } from "../../src/core/skirmish";
import { getRelic } from "../../src/data/relics";
import { relicStoryFor } from "../../src/data/relicStories";
import { firstMeetingLine } from "../../src/data/relicFirstMeetings";
import { breakthroughEffectText, passiveDescription, skillDescription } from "../../src/ui/skillPresentation";
import type { RelicDef } from "../../src/core/types";

const his = getRelic("his");
const arena = { left: 0, top: 0, right: 600, bottom: 600 };
const dummy = (id: string, hp: number): RelicDef => {
  const base = getRelic("toby");
  return { ...base, id, stats: { ...base.stats, hp, def: 100, res: 100 },
    passive: { id: "dummy-passive", name: "dummy", kind: "reservedGuest", value: 0, durationSeconds: 0,
      iconAssetId: "skill-icon-buff", effectType: "buff", desc: "" } };
};
const rng = () => 0.99;

function setup(breakthrough = 0) {
  const state = createSkirmish([his], [dummy("small", 8000), dummy("large", 10000)], arena, {}, { his: breakthrough }, {
    playerPositions: [{ x: 300, y: 300 }], enemyPositions: [{ x: 260, y: 300 }, { x: 340, y: 300 }],
  });
  const [owner, small, large] = state.fighters;
  small.attackCooldown = large.attackCooldown = 100;
  return { state, owner, small, large };
}

describe("히스", () => {
  it("최대 체력으로 단골을 고정하고, 교체 때 공속만 초기화한다", () => {
    const { state, owner, small, large } = setup(1);
    expect(owner.reservedGuest?.targetId).toBe(large.id);
    large.hp = 4000;
    const hasteStart = currentAttackSpeed(owner, state);
    owner.attackCooldown = 0;
    stepSkirmish(state, 0.05, rng);
    expect(owner.reservedGuest?.targetId).toBe(large.id);
    expect(currentAttackSpeed(owner, state) / hasteStart).toBeCloseTo(1.05);
    large.hp = 0;
    owner.attackCooldown = 10;
    stepSkirmish(state, 0.05, rng);
    expect(owner.reservedGuest?.targetId).toBe(small.id);
    expect(currentAttackSpeed(owner, state)).toBeCloseTo(hasteStart);
    expect(owner.basicCycleStep).toBe(1);
  });

  it("단골 외의 직접 피격만 방어력·저항력을 누적하고 그 적의 공격에만 적용한다", () => {
    const { state, owner, small, large } = setup();
    owner.attackCooldown = 100;
    small.attackCooldown = large.attackCooldown = 0;
    stepSkirmish(state, 0.05, rng);
    expect(owner.reservedGuest?.guardPoints).toBe(3);
    expect(defensiveDefinition(owner, state, small).def.stats.def).toBe(owner.def.stats.def + 3);
    expect(defensiveDefinition(owner, state, large).def.stats.res).toBe(owner.def.stats.res);
  });

  it("궁극기에는 특별 요금 두 번을 붙이고 다음 평타는 보호막을 먼저 파괴한다", () => {
    const { state, owner, large } = setup(4);
    owner.energy = 120;
    owner.hp = 1;
    const ultimate = fireUltimate(state, owner.id, rng);
    expect(ultimate.flatMap((event) => event.kind === "attack" && event.damageType === "true" ? [event.amount] : [])).toEqual([400, 400]);
    expect(owner.hp).toBe(401);
    expect(owner.serviceBarrier?.amount).toBeCloseTo(owner.maxHp * 0.25);
    expect(owner.basicCycleStep).toBe(2);

    large.shield.amount = 20_000;
    owner.attackCooldown = 0;
    const basic = stepSkirmish(state, 0.05, rng);
    const broken = basic.findIndex((event) => event.kind === "shieldDepleted" && event.fighterId === large.id);
    const hit = basic.findIndex((event) => event.kind === "attack" && event.attackerId === owner.id);
    expect(broken).toBeGreaterThanOrEqual(0);
    expect(hit).toBeGreaterThan(broken);
    expect(large.shield.amount).toBe(0);
    expect(basic.some((event) => event.kind === "attack" && event.basicStep === 2)).toBe(true);
    owner.shield.amount += 44;
    owner.attackCooldown = 100;
    for (let index = 0; index < 41; index++) stepSkirmish(state, 0.1, rng);
    expect(owner.serviceBarrier).toBeUndefined();
    expect(owner.shield.amount).toBeCloseTo(44);
  });

  it("폭주 동안 접수를 생략하고 단골 방어·저항을 깎는다", () => {
    const { state, owner, small, large } = setup(3);
    owner.ferocityFever = true;
    owner.ferocity = 100;
    const speed = currentAttackSpeed(owner, state);
    expect(speed).toBeCloseTo(owner.def.stats.attackSpeed * 1.15);
    expect(defensiveDefinition(large, state).def.stats.def).toBeCloseTo(60);
    expect(defensiveDefinition(small, state).def.stats.res).toBe(100);
    owner.attackCooldown = 0;
    const events = stepSkirmish(state, 0.05, rng);
    expect(events.some((event) => event.kind === "attack" && event.basicStep === 1)).toBe(true);
    expect(owner.basicCycleStep).toBe(2);
  });

  it("레이드 재현에서도 성장 체력과 비례 피해 저항을 쓰고 평타 순번을 넘긴다", () => {
    const boss = { ...dummy("raid-guest", 1_000_000), encounterRole: "boss" as const };
    const state = createSkirmish([his], [boss], arena, {}, {}, {
      boss: { phases: [{ label: "phase", startsAt: 0, damagePerSecond: 0 }], limitSeconds: 60, seasonHp: 1_000_000, percentHpBasis: 5000 },
    });
    const strikes = [0, 1, 2].map(() => replayLoggedBossAction(state, his.id, "basic", rng));
    const fee = strikes[2].find((event) => event.kind === "attack" && event.damageType === "true");
    expect(fee).toMatchObject({ amount: 140 });
    expect(state.fighters[0].basicCycleStep).toBe(0);
    expect(state.boss?.score).toBe(boss.stats.hp - state.fighters[1].hp);
  });

  it("실제 스킬 설명, 첫 대사와 유대 이야기에서 히스를 읽는다", () => {
    expect(passiveDescription(his.passive)).toContain("[[reserved-guest|단골]]");
    expect(skillDescription(his.basic)).toContain("[[special-fee|특별 요금]]");
    expect(breakthroughEffectText(his, "passive")).toContain("파괴");
    expect(firstMeetingLine(his.id)).toContain("손님");
    const story = relicStoryFor(his.id)!;
    expect(story.questions).toHaveLength(3);
    expect(story.bondLines).toHaveLength(11);
    expect(story.bondLines.every((lines) => lines.length >= 3)).toBe(true);
    expect(Object.values(story.bondStories).every((chapter) => chapter.nodes.length >= 10 && chapter.nodes.at(-1)?.speaker === his.name)).toBe(true);
  });
});
