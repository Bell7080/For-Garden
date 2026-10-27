import { describe, expect, it } from "vitest";
import { getRelic } from "../../src/data/relics";
import { battleArena } from "../../src/core/battleArena";
import { applyCombatStatusEffect, applyStun, createSkirmish, stepSkirmish, type SkirmishEvent } from "../../src/core/skirmish";

function readyEnemy(id = "amo", allies: string[] = []) {
  const state = createSkirmish([getRelic("dodo")], [id, ...allies].map(getRelic), battleArena("stage"));
  const [player, enemy, ...team] = state.fighters;
  player.x = 500; player.y = 1000; player.stunnedFor = 99;
  enemy.x = 530; enemy.y = 1000; enemy.attackCooldown = 0; enemy.energy = enemy.def.ultimate.cost;
  for (const ally of team) { ally.x = 560; ally.y = 1000; ally.stunnedFor = 99; }
  return { state, player, enemy, team };
}

function advance(state: ReturnType<typeof createSkirmish>, ticks: number): SkirmishEvent[] {
  return Array.from({ length: ticks }, () => stepSkirmish(state, .02, () => .99)).flat();
}

describe("적 AI의 비공격 궁극기", () => {
  it("아모가 게이지를 소비해 보호막·도발을 적용한다", () => {
    const { state, player, enemy } = readyEnemy();
    const events = advance(state, 1);
    expect(enemy.energy).toBe(0);
    expect(enemy.shield.amount).toBe(Math.round(enemy.maxHp * .35));
    expect(player.taunted?.sourceId).toBe(enemy.id);
    expect(events.filter(e => e.kind === "shieldGranted" && e.fighterId === enemy.id)).toHaveLength(1);
  });

  it("지원 궁극기를 사용한 뒤 공회전하지 않고 평타를 이어간다", () => {
    const { state, enemy } = readyEnemy();
    const events = advance(state, 120);
    expect(events.some(e => e.kind === "attack" && e.attackerId === enemy.id && e.skill === "basic")).toBe(true);
    expect(enemy.energy).toBeGreaterThan(0);
    expect(enemy.energy).toBeLessThan(enemy.def.ultimate.cost);
  });

  it("네우리의 순풍은 적 진영 동료에게만 적용한다", () => {
    const { state, player, enemy, team } = readyEnemy("neuri", ["amo"]);
    const events = advance(state, 1);
    expect(enemy.energy).toBe(0);
    expect(enemy.tailwind?.kind).toBe("tailwind");
    expect(team[0].tailwind?.kind).toBe("tailwind");
    expect(player.tailwind).toBeNull();
    expect(events.some(e => e.kind === "teamBuff" && e.fighterId === team[0].id)).toBe(true);
  });

  it("회복 궁극기도 적 동료를 실제로 회복시킨다", () => {
    const { state, player, enemy, team } = readyEnemy("mette", ["amo"]);
    team[0].hp = team[0].maxHp / 2;
    const hpBefore = team[0].hp, playerHp = player.hp;
    const events = advance(state, 1);
    expect(enemy.energy).toBe(0);
    expect(team[0].hp).toBeGreaterThan(hpBefore);
    expect(player.hp).toBe(playerHp);
    expect(events.some(e => e.kind === "heal" && e.fighterId === team[0].id && e.source === "ultimate")).toBe(true);
  });

  it("공포 중 허용된 자동 궁극기도 같은 지원 시전 경로를 쓴다", () => {
    const { state, player, enemy } = readyEnemy();
    applyCombatStatusEffect(enemy, { kind: "fear", seconds: 2, immunitySeconds: 0 }, [], state, player.id);
    advance(state, 1);
    expect(enemy.fear).not.toBeNull();
    expect(enemy.energy).toBe(0);
    expect(enemy.shield.amount).toBeGreaterThan(0);
  });

  it("기절 중에는 지원 궁극기도 차단하고 해제 후 사용한다", () => {
    const { state, enemy } = readyEnemy();
    applyStun(enemy, .1, state);
    advance(state, 1);
    expect(enemy.energy).toBe(enemy.def.ultimate.cost);
    expect(enemy.shield.amount).toBe(0);
    advance(state, 6);
    expect(enemy.energy).toBe(0);
    expect(enemy.shield.amount).toBeGreaterThan(0);
  });

  it("게이지가 부족하면 먼저 평타로 충전하고 다음 행동에서 시전한다", () => {
    const { state, enemy } = readyEnemy();
    enemy.energy -= 1;
    const first = advance(state, 1);
    expect(first.some(e => e.kind === "attack" && e.attackerId === enemy.id && e.skill === "basic")).toBe(true);
    expect(enemy.shield.amount).toBe(0);
    advance(state, 120);
    expect(enemy.shield.amount).toBeGreaterThan(0);
    expect(enemy.energy).toBeLessThan(enemy.def.ultimate.cost);
  });

  it("양 진영 자동 모드에서는 기존 공용 시전과 중복 발동하지 않는다", () => {
    const { state, enemy } = readyEnemy();
    state.automaticUltimates = true;
    enemy.attackCooldown = 10;
    const events = advance(state, 2);
    expect(enemy.energy).toBe(0);
    expect(events.filter(e => e.kind === "shieldGranted" && e.fighterId === enemy.id)).toHaveLength(1);
  });

  it("공격형 궁극기는 기존 적 공격 경로로 한 번만 사용한다", () => {
    const { state, enemy } = readyEnemy("rex");
    const events = advance(state, 1);
    expect(enemy.energy).toBe(0);
    expect(events.filter(e => e.kind === "attack" && e.attackerId === enemy.id && e.skill === "ultimate")).toHaveLength(1);
  });
});
