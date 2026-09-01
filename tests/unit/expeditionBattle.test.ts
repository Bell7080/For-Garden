import { describe, expect, it } from "vitest";
import { battleHeaderText, createExpeditionBossSkirmishConfig, createExpeditionSkirmishConfig, expeditionBattleResults, normalizeBattleSceneInput, type BattleSceneInputDto, type ExpeditionBattleInputDto, type ExpeditionBossBattleInputDto } from "../../src/core/expeditionBattle";
import { createSkirmish, spawnSpots, skirmishRelicResults, type Arena } from "../../src/core/skirmish";
import { EXPEDITION_COMBAT_BALANCE } from "../../src/data/expedition";
import { getRelic } from "../../src/data/relics";
import { getExpeditionNodeEnemies } from "../../src/data/expeditionEnemies";

// 실제 씬과 같은 안전 영역으로 5기 배치의 비겹침까지 순수 규칙에서 검증한다.
const ARENA: Arena = { left: 130, right: 950, top: 600, bottom: 1360 };
const players = ["anky", "rex", "dodo"].map(getRelic);
const enemies = ["husk-raptor", "husk-shell", "husk-wing"].map(getRelic);

function input(nodeType: "normal" | "elite" | "horde"): ExpeditionBattleInputDto {
  return {
    mode: "expedition", runId: "run-1", nodeId: `node-${nodeType}`, nodeType, floor: 1,
    relics: [
      { relicId: "anky", currentHp: 40, alive: true },
      { relicId: "rex", currentHp: 0, alive: false },
      { relicId: "dodo", currentHp: 75, alive: true },
    ],
    augments: [{ augmentId: "predator-instinct", targetRelicId: "anky" }, { augmentId: "reinforced-core" }],
  };
}

describe("원정 난전 입력 모델", () => {
  it.each(["normal", "elite", "horde"] as const)("%s 적 수와 수치·몸 배율을 정적 표대로 만든다", (nodeType) => {
    const config = createExpeditionSkirmishConfig(input(nodeType), players, enemies);
    const balance = EXPEDITION_COMBAT_BALANCE[nodeType];
    expect(config.enemyDefs).toHaveLength(balance.enemyCount);
    expect(config.enemyDefs[0].stats.hp).toBeCloseTo(enemies[0].stats.hp * balance.statScale);
    expect(config.enemyBodyScale).toBe(balance.bodyScale);
  });

  it("사망 아군을 제외하고 HP와 대상·파티 증강을 난전에 계승한다", () => {
    const config = createExpeditionSkirmishConfig(input("normal"), players, enemies);
    const state = createSkirmish(config.playerDefs, config.enemyDefs, ARENA, {}, {}, config);
    expect(state.fighters.filter(({ side }) => side === "player").map(({ def }) => def.id)).toEqual(["anky", "dodo"]);
    expect(state.fighters.find(({ def }) => def.id === "anky")?.hp).toBeCloseTo(players[0].stats.hp * 0.4);
    expect(config.augmentEffects).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "attackPowerPercent", percent: 18, scope: { kind: "relic", relicId: "anky" } }),
      expect.objectContaining({ kind: "attackPowerPercent", percent: 8, scope: { kind: "all" } }),
    ]));
  });

  it("불참 사망자의 ID·HP·생존 여부를 종료 DTO에 보존한다", () => {
    const config = createExpeditionSkirmishConfig(input("horde"), players, enemies);
    const state = createSkirmish(config.playerDefs, config.enemyDefs, ARENA, {}, {}, config);
    expect(expeditionBattleResults(input("horde"), skirmishRelicResults(state))).toEqual([
      expect.objectContaining({ relicId: "anky", currentHp: 40, alive: true }),
      { relicId: "rex", currentHp: 0, alive: false },
      expect.objectContaining({ relicId: "dodo", currentHp: 75, alive: true }),
    ]);
  });

  it("5기 좌표가 모두 다르고 안전 영역에 균등하게 놓인다", () => {
    const spots = spawnSpots(ARENA, "enemy", 5);
    expect(new Set(spots.map(({ x, y }) => `${x}:${y}`)).size).toBe(5);
    expect(spots.every(({ x }) => x >= ARENA.left && x <= ARENA.right)).toBe(true);
  });
});

describe("전투 씬 입력 정규화 회귀", () => {
  /** 직전 DTO를 함께 보관해도 다음 입력만 정규화되는 실제 씬 재진입 순서를 재현한다. */
  function transition(previous: BattleSceneInputDto, next?: unknown): [BattleSceneInputDto, BattleSceneInputDto] {
    return [previous, normalizeBattleSceneInput(next)];
  }

  const bossInput: ExpeditionBossBattleInputDto = {
    mode: "expeditionBoss", runId: "run-boss", nodeId: "boss-20", floor: 20,
    relics: input("normal").relics, augments: input("normal").augments,
    requestId: "request-1", settlementId: "settlement-1",
  };

  it("지도와 전투가 같은 유한 폰토스 표시 스탯을 보존하고 불사는 Fighter 계약으로 처리한다", () => {
    const [mapPreview] = getExpeditionNodeEnemies("boss", 20);
    const config = createExpeditionBossSkirmishConfig(bossInput, players, [mapPreview]);
    const state = createSkirmish(config.playerDefs, config.enemyDefs, ARENA, {}, {}, config);
    const fighter = state.fighters.find(({ side }) => side === "enemy")!;
    // 상세창은 이 지도 스냅샷과 LV.20을 사용하므로 MAX_SAFE_INTEGER가 어느 표시 경로에도 없다.
    expect(config.enemyDefs[0].stats).toEqual(mapPreview.stats);
    expect(fighter.def.stats).toEqual(mapPreview.stats);
    expect(fighter.maxHp).toBe(mapPreview.stats.hp);
    expect(fighter.maxHp).not.toBe(Number.MAX_SAFE_INTEGER);
    expect(fighter.immortal).toBe(true);
    expect(20).toBe(bossInput.floor);
  });

  it.each([
    ["원정 일반 전투 → 스토리 전투", input("normal"), undefined],
    ["원정 보스 → 스토리 전투", bossInput, {}],
  ] as const)("%s에서 원정 전용 필드를 남기지 않는다", (_name, previous, next) => {
    const [, normalized] = transition(previous, next);
    expect(normalized).toEqual({ mode: "stage" });
    expect(normalized).not.toBe(previous);
    // 잔여 필드 전체를 열거해 새 스토리 DTO가 원정 실행·정산 문맥을 누출하지 않음을 고정한다.
    expect(normalized).not.toHaveProperty("runId");
    expect(normalized).not.toHaveProperty("nodeId");
    expect(normalized).not.toHaveProperty("relics");
    expect(normalized).not.toHaveProperty("augments");
  });

  it("{ mode: stage }도 매번 새로운 스토리 DTO를 반환한다", () => {
    const supplied = { mode: "stage" } as const;
    expect(normalizeBattleSceneInput(supplied)).toEqual(supplied);
    expect(normalizeBattleSceneInput(supplied)).not.toBe(supplied);
  });

  it("스토리 → 원정 순서에서는 새 원정 DTO를 그대로 보존한다", () => {
    const expedition = input("elite");
    const [, normalized] = transition({ mode: "stage" }, expedition);
    expect(normalized).toBe(expedition);
  });

  it("원정 헤더에 선택된 스토리 이름을 표시하지 않는다", () => {
    const story = { id: "1-5", name: "남아서는 안 되는 이름", enemyLevel: 12 };
    expect(battleHeaderText(input("horde"), story)).toBe("원정 1층 · 군집 전투");
    expect(battleHeaderText({ mode: "stage" }, story)).toContain(story.name);
  });
});
