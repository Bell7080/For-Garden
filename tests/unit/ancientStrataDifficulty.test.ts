import { describe, expect, it } from "vitest";
import { getBattleStage, getStageEnemies } from "../../src/data/stages";
import { getRelic } from "../../src/data/relics";
import { ANCIENT_DIFFICULTY_BANDS, ANCIENT_STRATA_MAX_FLOOR } from "../../src/data/ancientStrataDifficulty";
import { ancientStrataMultipliers, createAncientStrataSkirmish, getAncientStrataFloor } from "../../src/core/ancientStrataBattle";
import { ancientReferenceParty, ancientReferenceRunes, simulateAncientStrataRun } from "../../src/core/ancientStrataSimulation";
import { assertValidRuneInstance } from "../../src/core/runes";
import { createCcCombatScenario } from "../../src/core/ccAuditScenarios";

describe("고대 지층 200층 난이도 계약", () => {
  it("1층은 쉬움 1-10의 실제 코마이며 숨은 돌파나 불사를 붙이지 않는다", () => {
    const definition = getAncientStrataFloor(1);
    expect(definition.enemies).toEqual(getStageEnemies(getBattleStage("1-10")));
    expect(definition.enemyBreakthroughs).toEqual([0]);
    expect(definition.level).toBe(getBattleStage("1-10").enemies[0].level);
    expect(definition.multipliers).toEqual({ hp: 1, attack: 1, defense: 1 });
    const party = ancientReferenceParty(["rex", "torika", "mette"], "bare");
    expect(createAncientStrataSkirmish(1, party.players, party).boss).toBeUndefined();
  });

  it("모든 층에서 기존 적의 주 능력치가 오르며 전용 배율은 공속/이속/CC 기술을 바꾸지 않는다", () => {
    let previous = getAncientStrataFloor(1);
    for (let floor = 2; floor <= ANCIENT_STRATA_MAX_FLOOR; floor++) {
      const next = getAncientStrataFloor(floor);
      for (const oldEnemy of previous.enemies) {
        const enemy = next.enemies.find(e => e.id === oldEnemy.id)!;
        for (const key of ["hp", "atk", "ap", "def", "res"] as const) {
          expect(enemy.stats[key], `${floor}:${enemy.id}:${key}`).toBeGreaterThanOrEqual(oldEnemy.stats[key]);
          expect(Number.isSafeInteger(enemy.stats[key])).toBe(true);
        }
        expect(enemy.stats.hp).toBeGreaterThan(oldEnemy.stats.hp);
        expect(enemy.stats.atk).toBeGreaterThan(oldEnemy.stats.atk);
        for (const key of ["attackSpeed", "moveSpeed", "energyGain", "lifeSteal"] as const) expect(enemy.stats[key]).toBe(oldEnemy.stats[key]);
        expect(enemy.basic).toEqual(oldEnemy.basic);
        expect(enemy.ultimate).toEqual(oldEnemy.ultimate);
      }
      expect(next.level).toBeLessThanOrEqual(60);
      previous = next;
    }
    expect(ANCIENT_DIFFICULTY_BANDS[0].first).toBe(1);
    expect(ANCIENT_DIFFICULTY_BANDS.at(-1)?.last).toBe(200);
  });

  it("지원 적을 점진적으로 추가하고 기존 적의 예산을 초기화하지 않는다", () => {
    expect([20, 21, 40, 41, 60, 120, 121, 140, 141, 200].map(f => getAncientStrataFloor(f).enemies.length)).toEqual([1, 2, 2, 3, 3, 3, 4, 4, 5, 5]);
    expect(getAncientStrataFloor(21).reinforcementShares[1]).toBeCloseTo(0.0675);
    expect(getAncientStrataFloor(40).reinforcementShares[1]).toBeCloseTo(0.45);
    expect(getAncientStrataFloor(60).reinforcementShares[2]).toBeCloseTo(0.45);
  });

  it("100층 이후 벽을 더 가파르게 하며 200층 계산도 원본과 다른 콘텐츠를 오염시키지 않는다", () => {
    const original = structuredClone(getRelic("koma").stats), story = getStageEnemies(getBattleStage("1-10"));
    const m = ancientStrataMultipliers;
    expect(m(101).attack / m(100).attack).toBeGreaterThan(m(100).attack / m(99).attack);
    expect(m(121).hp / m(120).hp).toBeGreaterThan(m(101).hp / m(100).hp);
    const floor = getAncientStrataFloor(200);
    floor.enemies[0].stats.hp = 1;
    expect(getRelic("koma").stats).toEqual(original);
    expect(getStageEnemies(getBattleStage("1-10"))).toEqual(story);
    expect(getAncientStrataFloor(200).enemies[0].stats.hp).toBeGreaterThan(1);
  });

  it.each([0, -1, 201, 1.5, NaN, Infinity])("잘못된 층 %s를 거절한다", floor => {
    expect(() => getAncientStrataFloor(floor)).toThrow(RangeError);
  });
});

describe("실제 전투 기반 고대 지층 검수", () => {
  it("룬 표본은 실제 획득/세공/특성 규칙을 통과하고 60레벨에는 4돌파를 넘긴다", () => {
    for (const equipment of ["bare", "epic", "ceiling"] as const) {
      const party = ancientReferenceParty(["rex", "torika", "mette"], equipment);
      expect(Object.values(party.breakthroughs)).toEqual([4, 4, 4]);
      for (const { runes } of party.equipped) for (const rune of runes) {
        expect(() => assertValidRuneInstance(rune)).not.toThrow();
        expect(rune.enhancementComplete).toBe(true);
      }
    }
    expect(ancientReferenceRunes("rex", "ceiling")[0].engravings).toHaveLength(1);
    expect(() => ancientReferenceParty(["rex", "rex", "mette"], "bare")).toThrow();
    expect(() => ancientReferenceParty(["dimo", "rex", "mette"], "bare")).toThrow();
    expect(() => ancientReferenceParty(["rex", "torika", "mette"], "bare", 61)).toThrow();
  });

  it("동일 seed는 재현되고 소환수를 원래 파티 생존자/체력 분모에 더하지 않는다", () => {
    const party = ancientReferenceParty(["nodonia", "dian", "meron"], "epic");
    const run = simulateAncientStrataRun(50, party, 1729);
    expect(simulateAncientStrataRun(50, party, 1729)).toEqual(run);
    expect(run.survivors).toBeLessThanOrEqual(3);
    expect(run.playerHpRatio).toBeGreaterThanOrEqual(0);
    expect(run.playerHpRatio).toBeLessThanOrEqual(1);
    expect(run.seconds).toBeLessThanOrEqual(90 + 1e-8);
  });

  it("CC 검수도 동일 층/장비를 사용하고 원정 증강을 끼워 넣지 못한다", () => {
    const scenario = createCcCombatScenario({ mode: "ancient", floor: 100, equipment: "ceiling" });
    const state = scenario.createState();
    expect(state.fighters.filter(f => f.side === "enemy").map(f => f.def.stats)).toEqual(getAncientStrataFloor(100).enemies.map(e => e.stats));
    expect(state.fighters.find(f => f.side === "player")?.breakthrough).toBe(4);
    expect(scenario.durationSeconds).toBe(90);
    expect(() => createCcCombatScenario({ mode: "ancient", selections: [{ augmentId: "tag-stun-basic", targetRelicId: "rex" }] })).toThrow();
  });
});
