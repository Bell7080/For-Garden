import { describe, expect, it } from "vitest";
import { createSkirmish, currentAttackSpeed, fireUltimate, refillAttackRatio, stepSkirmish, type Arena, type SkirmishEvent, type SkirmishState } from "../../src/core/skirmish";
import { getRelic } from "../../src/data/relics";
import type { AttackSkill } from "../../src/core/types";
import { findKeyword } from "../../src/data/keywords";
import { ferocityTraitDescription, lastDropKeyword, passiveDescription, refillKeyword, skillDescription } from "../../src/ui/skillPresentation";

/**
 * 테쿠 — 풀 SR 중거리 전사. 4발짜리 탄창으로 평타를 쏘고(마지막 발은 확정 치명타 + 흡혈), 공격 속도는
 * 고정이며 추가 공속은 같은 비율의 공격력으로 바뀐다. 궁극기는 다섯 발을 연사한다.
 */
const ARENA: Arena = { left: 0, right: 1_000, top: 0, bottom: 1_200 };
const TEKU = getRelic("teku");
const REFILL = TEKU.passive.refill!;
const BARRAGE = (TEKU.ultimate as AttackSkill).barrage!;

function setup(enemyIds: string[]) {
  const state = createSkirmish([TEKU], enemyIds.map((id) => getRelic(id)), ARENA);
  const teku = state.fighters.find((fighter) => fighter.side === "player")!;
  const enemies = state.fighters.filter((fighter) => fighter.side === "enemy");
  for (const fighter of state.fighters) { fighter.attackCooldown = Number.POSITIVE_INFINITY; fighter.retargetIn = Number.POSITIVE_INFINITY; }
  teku.x = 500; teku.y = 900;
  enemies.forEach((enemy, index) => { enemy.x = 460 + index * 70; enemy.y = 700; enemy.stealthFor = 0; enemy.maxHp *= 50; enemy.hp = enemy.maxHp; enemy.shield.amount = 0; });
  return { state, teku, enemies };
}

function run(state: SkirmishState, seconds: number): SkirmishEvent[] {
  const events: SkirmishEvent[] = [];
  for (let elapsed = 0; elapsed < seconds - 1e-9; elapsed += 0.05) events.push(...stepSkirmish(state, Math.min(0.05, seconds - elapsed)));
  return events;
}

const hits = (events: SkirmishEvent[], skill: "basic" | "ultimate") =>
  events.filter((event): event is Extract<SkirmishEvent, { kind: "attack" }> => event.kind === "attack" && event.skill === skill);

describe("테쿠 — 정체성과 문장", () => {
  it("은 풀 SR 중거리 전사이고 쁘띠 로그에 선다", () => {
    expect([TEKU.name, TEKU.rarity, TEKU.element, TEKU.role, TEKU.reachTier, TEKU.squad]).toEqual(["테쿠", "SR", "grass", "warrior", "mid", "rogue"]);
    expect(TEKU.researcherTitle).toBe("대장님");
    expect(TEKU.basic.cycle).toHaveLength(REFILL.magazine);
    expect(TEKU.basic.cycle!.at(-1)).toMatchObject({ guaranteedCritical: true, keywordId: "teku-last-drop" });
  });

  it("은 태그가 데이터의 수를 그대로 말한다", () => {
    const refill = refillKeyword(TEKU)!;
    expect(refill.id).toBe("teku-refill");
    expect(refill.description).toContain(`${REFILL.magazine}발`);
    expect(refill.description).toContain(`${REFILL.reloadSeconds}초`);
    expect(refill.description).toContain(String(REFILL.fixedAttackSpeed));
    const last = lastDropKeyword(TEKU)!;
    expect(last.description).toContain(`${TEKU.basic.cycle!.at(-1)!.damageHealingPercent}%`);
    expect(findKeyword("teku-refill") ?? refill).toBeDefined();
    expect(passiveDescription(TEKU.passive)).toContain("[[teku-refill|리필]]");
    expect(skillDescription(TEKU.basic)).toContain("[[teku-last-drop|마지막 한 방울]]");
    expect(skillDescription(TEKU.ultimate)).toContain("[[teku-refill|리필]]");
    expect(ferocityTraitDescription(TEKU.ferocityTrait)).toContain("[[teku-last-drop|마지막 한 방울]]");
  });
});

describe("테쿠 — 탄창과 마지막 한 방울", () => {
  it("은 네 발마다 한 번 장전하고 마지막 발만 치명타로 회복한다", () => {
    const { state, teku } = setup(["toby"]);
    teku.attackCooldown = 0;
    teku.hp = teku.maxHp * 0.5;
    const events = run(state, 14);
    const shots = hits(events, "basic").filter((event) => event.attackerId === teku.id);
    expect(shots.length).toBeGreaterThanOrEqual(8);
    shots.slice(0, 8).forEach((shot, index) => expect(shot.critical, `${index + 1}번째 발`).toBe(index % REFILL.magazine === REFILL.magazine - 1));
    // 적은 때리지 않으므로 체력이 오른 것은 마지막 발의 흡혈뿐이다.
    expect(teku.hp).toBeGreaterThan(teku.maxHp * 0.5);
  });

  it("은 공격 속도가 고정이라 추가 공속은 속도가 아니라 공격력이 된다", () => {
    const { state, teku } = setup(["toby"]);
    const base = currentAttackSpeed(teku, state);
    expect(base).toBe(REFILL.fixedAttackSpeed);
    expect(refillAttackRatio(teku, state)).toBe(1);
    teku.bonusAttackSpeed = 50;
    expect(currentAttackSpeed(teku, state)).toBe(base);
    expect(refillAttackRatio(teku, state)).toBeCloseTo(1.5, 5);
    teku.bonusAttackSpeed = 100;
    expect(refillAttackRatio(teku, state)).toBeCloseTo(2, 5);
  });

  it("은 감속은 속도로 받되 공격력은 깎이지 않는다", () => {
    const { state, teku } = setup(["toby"]);
    teku.groggy = { attackSpeedPercent: 40, remaining: 5, total: 5 };
    expect(currentAttackSpeed(teku, state)).toBeCloseTo(REFILL.fixedAttackSpeed * 0.6, 5);
    expect(refillAttackRatio(teku, state)).toBe(1);
  });
});

describe("테쿠 — 궁극기와 폭주", () => {
  it("은 남은 탄과 상관없이 다섯 발을 가까운 적부터 번갈아 쏘고 4발째부터 확정 치명타와 보호막을 얻는다", () => {
    const { state, teku, enemies } = setup(["amo", "toby"]);
    teku.energy = 100;
    teku.basicCycleStep = 2;
    const events = fireUltimate(state, teku.id);
    const shots = hits(events, "ultimate");
    expect(shots).toHaveLength(BARRAGE.shots);
    shots.forEach((shot, index) => expect(shot.critical, `${index + 1}발`).toBe(index + 1 >= BARRAGE.criticalFromShot));
    expect(new Set(shots.map((shot) => shot.targetId))).toEqual(new Set(enemies.map((enemy) => enemy.id)));
    expect(teku.shield.amount).toBeGreaterThan(0);
    expect(teku.shield.amount).toBeLessThanOrEqual(teku.maxHp * BARRAGE.shieldMaxHpPercent / 100 + 1e-6);
    expect(teku.basicCycleStep).toBe(0);
  });

  it("은 폭주에 들어가면 곧바로 리필하고 그 탄창의 모든 발이 마지막 한 방울이다", () => {
    const { state, teku } = setup(["toby"]);
    teku.attackCooldown = 0;
    teku.basicCycleStep = 2;
    teku.ferocity = 99.99;
    const events = run(state, 5);
    // 첫 발이 야성을 채워 폭주가 열린다. 그 순간 탄창이 리필되므로 이어지는 발은 전부 치명타다.
    const shots = hits(events, "basic").filter((event) => event.attackerId === teku.id);
    expect(shots.length).toBeGreaterThanOrEqual(3);
    expect(shots[0].critical).toBe(false);
    for (const shot of shots.slice(1, 3)) expect(shot.critical).toBe(true);
    // 효과는 그 한 탄창뿐이다 — 다 쏘고 나면 꺼진다.
    expect(teku.refillFinisherAll).toBe(false);
  });
});
