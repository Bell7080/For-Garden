import { describe, expect, it } from "vitest";
import { getBattleStage, getStageEnemies } from "../../src/data/stages";
import { getRelic } from "../../src/data/relics";
import { ANCIENT_DIFFICULTY_BANDS, ANCIENT_STRATA_MAX_FLOOR, ancientFirstClearReward } from "../../src/data/ancientStrataDifficulty";
import { isCleanPaidAmount } from "../../src/core/paidAmountUnit";
import { ancientStrataMultipliers, createAncientStrataSkirmish, getAncientStrataFloor } from "../../src/core/ancientStrataBattle";
import { ancientReferenceParty, ancientReferenceRunes, simulateAncientStrataRun } from "../../src/core/ancientStrataSimulation";
import { assertValidRuneInstance } from "../../src/core/runes";
import { createCcCombatScenario } from "../../src/core/ccAuditScenarios";

/** 1층의 출발점 — 보통 1-5 적 전원의 체력 합. */
const referenceHp = () => getStageEnemies(getBattleStage("normal:1-5")).reduce((sum, e) => sum + e.stats.hp, 0);

describe("고대 지층 200층 난이도 계약", () => {
  it("1층은 보통 1-5 체력 예산에 맞춘 일반 3인으로 시작한다", () => {
    const definition = getAncientStrataFloor(1), reference = referenceHp();
    expect(definition.enemies.map(e => e.encounterRole)).toEqual(["normal", "normal", "normal"]);
    expect(definition.enemies.map(e => e.id)).toEqual(["amo", "toby", "ripa"]);
    // 1층의 시련은 강인(체력 +30%)이고 일반 3인 조우의 체력 몫은 0.91이다 — 보통 1-5 총량 × 1.3 × 0.91.
    expect(definition.trialId).toBe("endurance");
    expect(definition.enemies.reduce((sum,e)=>sum+e.stats.hp,0) / reference).toBeCloseTo(1.183, 2);
    expect(definition.enemyBreakthroughs).toEqual([0,0,0]);
    expect(definition.level).toBe(20);
    expect(definition.multipliers).toEqual({ hp: 1, attack: 1, defense: 1 });
    const party = ancientReferenceParty(["rex", "torika", "mette"], "bare");
    expect(createAncientStrataSkirmish(1, party.players, party).boss).toBeUndefined();
  });

  it("200층은 조우/시련을 매 층 교차시키되 기본 공속/스킬을 배율로 강화하지 않는다", () => {
    const kinds=new Set(), trials=new Set(), templates=new Set();
    let previous=getAncientStrataFloor(1);
    for(let floor=1;floor<=ANCIENT_STRATA_MAX_FLOOR;floor++) {
      const next=getAncientStrataFloor(floor);
      kinds.add(next.encounterKind);trials.add(next.trialId);templates.add(next.encounterId);
      if(floor>1) {
        expect(next.encounterKind).not.toBe(previous.encounterKind);
        expect(next.multipliers.hp).toBeGreaterThan(previous.multipliers.hp);
        expect(next.multipliers.attack).toBeGreaterThan(previous.multipliers.attack);
      }
      for(const enemy of next.enemies) {
        const base=getRelic(enemy.id);
        for(const key of ["hp","atk","ap","def","res"] as const) expect(Number.isSafeInteger(enemy.stats[key])&&enemy.stats[key]>0).toBe(true);
        for(const key of ["attackSpeed","moveSpeed","energyGain","lifeSteal"] as const) expect(enemy.stats[key]).toBe(base.stats[key]);
        expect(enemy.basic).toEqual(base.basic);expect(enemy.ultimate).toEqual(base.ultimate);
      }
      expect(next.firstClearRewards).toHaveLength(1);
      expect(next.repeatClearRewards).toEqual([]);
      previous=next;
    }
    expect(kinds.size).toBe(5);expect(trials.size).toBe(6);expect(templates.size).toBe(10);
    const first20=Array.from({length:20},(_,i)=>getAncientStrataFloor(i+1));
    expect(new Set(first20.map(d=>JSON.stringify([d.encounterKind,d.enemies.map(e=>e.id),d.trialId]))).size).toBe(20);
    expect(ANCIENT_DIFFICULTY_BANDS.at(-1)?.last).toBe(200);
  });

  it("첫 클리어는 한 층에 한 종류이고 10층마다 오르며, 젬은 200층 전부 6,500이다", () => {
    const totals:Record<string,number>={};
    const kinds=Array.from({length:10},(_,i)=>{const r=ancientFirstClearReward(i+1);return r.kind==="rune"?"rune":r.currency;});
    expect(kinds).toEqual(["gold","cheesecake","gems","gold","cheesecake","gems","gold","cheesecake","rune","gems"]);
    for(let floor=1;floor<=ANCIENT_STRATA_MAX_FLOOR;floor++){
      const r=ancientFirstClearReward(floor);
      if(r.kind==="currency"){totals[r.currency]=(totals[r.currency]??0)+r.amount;expect(isCleanPaidAmount(r.amount)).toBe(true);}
      if(floor>10&&r.kind==="currency"){const before=ancientFirstClearReward(floor-10);expect(before.kind==="currency"&&r.amount>=before.amount).toBe(true);}
      if(r.kind==="rune")expect(r.rarity).toBe(floor<=40?"uncommon":floor<=100?"rare":"epic");
    }
    expect(totals.gems).toBe(6_500);
  });

  it("2인 정예는 같은 체력 총량을 나누며 시련 보호막/게이지가 적에게 실제 적용된다", () => {
    const duo=getAncientStrataFloor(5);
    expect(duo.enemies).toHaveLength(2);
    expect(duo.enemies.every(e=>e.encounterRole==="elite")).toBe(true);
    expect(duo.enemies.reduce((sum,e)=>sum+e.stats.hp,0) / (referenceHp()*duo.multipliers.hp)).toBeCloseTo(1,2);
    const party=ancientReferenceParty(["rex","torika","mette"],"bare");
    const shield=createAncientStrataSkirmish(5,party.players,party);
    for(const f of shield.fighters.filter(f=>f.side==="enemy")) expect(f.shield.amount / f.maxHp).toBeCloseTo(.3,2);
    const charge=createAncientStrataSkirmish(6,party.players,party);
    for(const f of charge.fighters.filter(f=>f.side==="enemy")) expect(f.energy / f.def.ultimate.cost).toBeCloseTo(.5,2);
    expect(shield.enemyAugmentEffects).toEqual(duo.enemyAugmentEffects);
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
    expect(scenario.durationSeconds).toBe(getAncientStrataFloor(100).timeLimitSeconds);
    expect(() => createCcCombatScenario({ mode: "ancient", selections: [{ augmentId: "tag-stun-basic", targetRelicId: "rex" }] })).toThrow();
  });
});
