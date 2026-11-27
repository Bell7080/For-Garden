import { describe, expect, it } from "vitest";
import {
  createSkirmish, currentAttackSpeed, defensiveDefinition, fireUltimate, gainFerocity,
  moveSpeed, resolveReceivedDamage, stepSkirmish,
} from "../../src/core/skirmish";
import { enemyLevelMultiplier } from "../../src/core/levelDesign";
import { CODEX_RELICS } from "../../src/core/codex";
import { getRelic } from "../../src/data/relics";
import { getBattleStage, getStageEnemies } from "../../src/data/stages";
import { recollectionEntriesOf } from "../../src/data/recollectionCatalog";
import { getRecollectionStory } from "../../src/data/dialogues/recollections";
import { breakthroughEffectText } from "../../src/ui/skillPresentation";
import { unitStatusViews } from "../../src/ui/unitStatusModel";
import type { RelicDef } from "../../src/core/types";

const arena = { left: 0, top: 0, right: 600, bottom: 600 };
const rng = () => 0.99;
const toby = getRelic("toby");
const dummy = (id: string): RelicDef => ({
  ...toby, id,
  stats: { ...toby.stats, hp: 20_000, def: 0, res: 0, atk: 500, critChance: 0, moveSpeed: 0 },
});

function setup(id: "gigano" | "argen", offsets = [35], breakthrough = 4) {
  const state = createSkirmish([getRelic(id)], offsets.map((_, i) => dummy(`dummy-${i}`)),
    arena, {}, { [id]: breakthrough }, {
      playerPositions: [{ x: 200, y: 300 }],
      enemyPositions: offsets.map((dx) => ({ x: 200 + dx, y: 300 })),
    });
  const [boss, ...targets] = state.fighters;
  for (const fighter of state.fighters) fighter.attackCooldown = 100;
  const advance = (seconds: number) => {
    const events = [];
    for (let time = 0; time + 1e-8 < seconds; time += 0.05) {
      events.push(...stepSkirmish(state, Math.min(0.05, seconds - time), rng));
    }
    return events;
  };
  return { state, boss, targets, advance };
}

describe("공멸 대장", () => {
  it("기가노는 회복으로 기세를 얻고, 폭주로 능력치와 속도를 바꾸되 체력 비율을 보존한다", () => {
    const { state, boss, targets, advance } = setup("gigano", [35, 95]);
    boss.hp = boss.maxHp / 2;
    const normalHp = boss.maxHp;
    const normalSpeed = currentAttackSpeed(boss, state);
    const normalMove = moveSpeed(boss, state);
    const normalDefense = defensiveDefinition(boss, state).def.stats.def;
    gainFerocity(boss, 200, state, []);
    expect(boss.maxHp / normalHp).toBeCloseTo(1.8 / 1.4);
    expect(boss.hp / boss.maxHp).toBeCloseTo(0.5);
    expect(currentAttackSpeed(boss, state) / normalSpeed).toBeCloseTo(1.3);
    expect(moveSpeed(boss, state) / normalMove).toBeCloseTo(1.3);
    expect(defensiveDefinition(boss, state).def.stats.def / normalDefense).toBeCloseTo(1.8 / 1.4);
    targets.forEach((target) => { target.shield.amount = 50_000; });
    boss.energy = 300;
    const ult = fireUltimate(state, boss.id, rng);
    expect(ult.filter((event) => event.kind === "shieldDepleted")).toHaveLength(2);
    expect(ult.filter((event) => event.kind === "attack" && event.skill === "ultimate")).toHaveLength(2);
    expect(boss.frontline?.momentum).toBe(1);
    expect(boss.hp / boss.maxHp).toBeGreaterThan(0.5);
    boss.basicCycleStep = 2;
    boss.attackCooldown = 0;
    expect(advance(0.05).some((event) => event.kind === "attack" && event.basicStep === 2)).toBe(true);
    boss.attackCooldown = 100;
    expect(advance(0.45).some((event) => event.kind === "attack")).toBe(false);
    expect(advance(0.05).some((event) => event.kind === "attack" && event.attackerId === boss.id)).toBe(true);
    advance(8.1);
    expect(boss.ferocityFever).toBe(false);
    expect(boss.maxHp).toBeCloseTo(normalHp);
  });

  it("아르겐의 세 번째 타격은 실제 피해만 보호막으로 바꾸고, 충돌한 적을 다시 밀친다", () => {
    const { boss, targets: [first, second, third], advance } = setup("argen", [35, 115, 195]);
    boss.basicCycleStep = 2;
    boss.attackCooldown = 0;
    const firstHp = first.hp;
    const events = advance(0.05);
    expect(events.some((event) => event.kind === "concussion" && event.fighterId === first.id && event.amount === 1200)).toBe(true);
    expect(boss.shield.amount).toBeCloseTo(firstHp - first.hp);
    const shield = boss.shield.amount;
    const chain = advance(0.6);
    for (const target of [second, third]) {
      expect([...events, ...chain].filter((event) => event.kind === "concussion" && event.fighterId === target.id)).toHaveLength(1);
      expect(chain.some((event) => event.kind === "knockback" && event.fighterId === target.id)).toBe(true);
    }
    expect(boss.shield.amount).toBeCloseTo(shield);
  });

  it("아르겐의 폭주는 대상별 세 번째 적중에서 5초 공격 속도 둔화를 새로 건다", () => {
    const { state, boss, targets: [near, late], advance } = setup("argen", [120, 350]);
    const opening: ReturnType<typeof stepSkirmish> = [];
    const baseSpeed = currentAttackSpeed(near, state);
    const baseMove = moveSpeed(near, state);
    gainFerocity(boss, 200, state, opening);
    expect(near.taunted?.sourceId).toBe(boss.id);
    expect(late.taunted).toBeNull();
    advance(1.0);
    expect(near.frontlineSlow).toBeUndefined();
    late.x = near.x + 30;
    const events = advance(0.5);
    expect(events.some((event) => event.kind === "attack" && event.damageType === "true")).toBe(true);
    expect(near.frontlineSlow?.until).toBeCloseTo(6.5);
    expect(currentAttackSpeed(near, state) / baseSpeed).toBeCloseTo(0.8);
    expect(moveSpeed(near, state)).toBeCloseTo(baseMove);
    expect(late.frontlineSlow).toBeUndefined();
    advance(1);
    expect(late.frontlineSlow?.until).toBeCloseTo(7.5);
  });

  it("아르겐의 장갑은 직접 체력 피해로 벗겨지고 마지막 한 겹 보상은 한 번만 서서히 사라진다", () => {
    const { boss, targets: [attacker], advance } = setup("argen");
    expect(resolveReceivedDamage(boss, 1000).applied).toBe(349);
    expect(unitStatusViews(boss).find((status) => status.id === "fixedArmor")?.stacks).toBe(10);
    const cycle = () => {
      boss.hp = boss.maxHp;
      attacker.attackCooldown = 0;
      advance(0.05);
      attacker.attackCooldown = 100;
    };
    cycle();
    cycle();
    expect(boss.frontline?.armor).toBe(9);
    advance(3.05);
    expect(boss.frontline?.armor).toBe(10);
    for (let i = 0; i < 10; i += 1) {
      cycle();
      if (i < 9) advance(1.05);
    }
    expect(boss.frontline?.armor).toBe(0);
    expect(boss.shield.amount / boss.maxHp).toBeCloseTo(1, 1);
    expect(boss.frontline?.lastStandUsed).toBe(true);
    advance(4);
    expect(boss.shield.amount / boss.maxHp).toBeCloseTo(0.5, 1);
    advance(4);
    expect(boss.shield.amount).toBeCloseTo(0);
  });

  it("아르겐 궁극기는 준비 후 한 번 내리치고 장갑을 쓰지 않은 채 시간제 보호막을 준다", () => {
    const { state, boss, targets: [target], advance } = setup("argen");
    boss.energy = 155;
    const startingHp = target.hp;
    expect(fireUltimate(state, boss.id, rng).some((event) => event.kind === "attack")).toBe(false);
    expect(boss.energy).toBe(0);
    advance(0.75);
    expect(target.hp).toBe(startingHp);
    expect(boss.shield.amount).toBe(0);
    expect(advance(0.05).some((event) => event.kind === "attack" && event.skill === "ultimate")).toBe(true);
    expect(target.stunnedFor).toBeCloseTo(1.4);
    expect(boss.frontline?.armor).toBe(10);
    const { def, res } = defensiveDefinition(boss, state).def.stats;
    expect(boss.shield.amount).toBeCloseTo((def + res) * 1.5);
    boss.attackCooldown = 100;
    advance(5.05);
    expect(boss.shield.amount).toBe(0);
  });

  it("아르겐 궁극기의 보호막이 직접 공격으로 소진되면 충격파가 한 번 터진다", () => {
    const { state, boss, targets: [target], advance } = setup("argen");
    boss.energy = 155;
    fireUltimate(state, boss.id, rng);
    advance(0.8);
    boss.attackCooldown = 100;
    target.def = { ...target.def, stats: { ...target.def.stats, atk: 4000 } };
    target.stunnedFor = 0;
    target.attackCooldown = 0;
    const events = advance(0.05);
    expect(events.filter((event) => event.kind === "attack" && event.attackerId === boss.id)).toHaveLength(1);
    expect(boss.frontline?.ultimateShield).toBe(0);
    expect(advance(0.5).some((event) => event.kind === "attack" && event.attackerId === boss.id)).toBe(false);
  });

  it("도감과 회고에 등록하고 모든 난이도 9-10에 4돌 대장 둘을 보낸다", () => {
    expect(CODEX_RELICS.filter(({ id }) => id === "gigano" || id === "argen")).toHaveLength(2);
    expect(recollectionEntriesOf("chapter8")).toHaveLength(7);
    const finale = recollectionEntriesOf("chapter9").filter(({ stageId }) => stageId === "9-10");
    expect(finale).toHaveLength(2);
    const names = getRecollectionStory(finale[0].storyId).nodes.map(({ standing }) => standing);
    expect(names).toContain("gigano");
    expect(names).toContain("argen");
    const easy = getBattleStage("9-10");
    const rampage = getBattleStage("rampage:9-10");
    expect(getStageEnemies(rampage).map(({ id, encounterRole }) => [id, encounterRole])).toEqual([
      ["argen", "elite"], ["gigano", "elite"],
    ]);
    for (const [index, enemy] of rampage.enemies.entries()) {
      const base = easy.enemies[index];
      const rarity = getRelic(base.relicId).rarity;
      expect(enemy.breakthrough).toBe(4);
      expect(enemyLevelMultiplier(enemy.level, rarity) / enemyLevelMultiplier(base.level, rarity)).toBeCloseTo(3, 1);
    }
    expect(breakthroughEffectText(getRelic("argen"), "ferocity")).toContain("5초간");
  });
});
