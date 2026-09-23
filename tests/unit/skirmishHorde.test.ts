import { describe, expect, it } from "vitest";
import { createSkirmish, MAX_ENEMY_COUNT, percentHpBasis, spawnSpots, stepSkirmish, type SkirmishState } from "../../src/core/skirmish";
import { BATTLE_ARENA, battleArena } from "../../src/core/battleArena";
import { getRelic } from "../../src/data/relics";
import { CAKE_OPERATION_TIERS, cakeOperationEnemies } from "../../src/data/cakeOperation";

const ARENA = { left: 0, right: 600, top: 0, bottom: 1_000 };

function runToEnd(state: SkirmishState, seconds = 240): void {
  for (let elapsed = 0; elapsed < seconds && state.phase === "fight"; elapsed += 0.05) stepSkirmish(state, 0.05, () => 0.99);
}

/**
 * 물량 계약 — 대작전은 한 판의 적 **전부가 한꺼번에** 맵 끝에서 몰려온다. 셋·넷씩 끊어 오는
 * 웨이브는 "몰려온다"가 아니라 "세 번 나눠 온다"로 읽혀 걷어 냈다.
 */
describe("난전 물량", () => {
  it("적은 다섯을 넘어 한 번에 설 수 있고 아군은 여전히 다섯이 상한이다", () => {
    const sister = getRelic("raitia-grass");
    const state = createSkirmish([getRelic("rex")], Array.from({ length: 15 }, () => sister), ARENA);
    expect(state.fighters.filter(({ side }) => side === "enemy")).toHaveLength(15);
    expect(() => createSkirmish([getRelic("rex")], Array.from({ length: MAX_ENEMY_COUNT + 1 }, () => sister), ARENA)).toThrow(RangeError);
    expect(() => spawnSpots(ARENA, "player", 6)).toThrow(RangeError);
  });

  it("다섯을 넘는 무리는 맵 끝에서 시작해 줄마다 안쪽으로 쌓이고 전장 밖으로 나가지 않는다", () => {
    const spots = spawnSpots(ARENA, "enemy", 15);
    // 첫 줄이 맵 끝에 선다 — 그 너머는 땅이 아니라 배경의 벽이다.
    expect(Math.min(...spots.map(({ y }) => y))).toBe(ARENA.top);
    for (const { x, y } of spots) {
      expect(x).toBeGreaterThanOrEqual(ARENA.left);
      expect(x).toBeLessThanOrEqual(ARENA.right);
      expect(y).toBeGreaterThanOrEqual(ARENA.top);
      expect(y).toBeLessThan((ARENA.top + ARENA.bottom) / 2);
    }
    // 같은 자리에 둘이 겹쳐 서지 않는다.
    expect(new Set(spots.map(({ x, y }) => `${Math.round(x)}:${y}`)).size).toBe(15);
  });

  it("다섯 이하는 예전 진형을 그대로 쓴다", () => {
    expect(spawnSpots(ARENA, "enemy", 3).map(({ y }) => y)).toEqual([0, 70, 0]);
  });

  it("몰려온 적을 모두 쓰러뜨려야 승리하고 승리는 한 번만 선다", () => {
    const tier = CAKE_OPERATION_TIERS[0];
    const players = ["rex", "spino", "anky"].map((id) => getRelic(id));
    const state = createSkirmish(players, cakeOperationEnemies(tier), battleArena("cake"));
    runToEnd(state);
    if (state.phase === "victory") expect(state.fighters.filter(({ side, hp }) => side === "enemy" && hp > 0)).toHaveLength(0);
    expect(state.phase).not.toBe("fight");
  });
});

describe("모드별 전장", () => {
  it("벽 앞에 뜨지 않도록 바닥이 낮게 시작하는 필드는 전장도 그만큼 낮게 시작한다", () => {
    // 스토리 전장보다 위로 올라가는 모드는 없다 — 원화의 바닥은 모두 그보다 아래에서 시작한다.
    for (const arena of Object.values(BATTLE_ARENA)) expect(arena.top).toBeGreaterThanOrEqual(BATTLE_ARENA.stage.top);
    expect(BATTLE_ARENA.cake.top).toBeGreaterThan(BATTLE_ARENA.stage.top);
    expect(BATTLE_ARENA.bounty.top).toBeGreaterThan(BATTLE_ARENA.stage.top);
    expect(BATTLE_ARENA.raid.top).toBeGreaterThan(BATTLE_ARENA.stage.top);
    // 적 무리의 마지막 줄까지 아군 출발선보다 한참 위다.
    const lastRow = Math.max(...spawnSpots(BATTLE_ARENA.cake, "enemy", 15).map(({ y }) => y));
    expect(lastRow).toBeLessThan(BATTLE_ARENA.cake.bottom - 300);
    expect(battleArena("없는-모드")).toEqual(BATTLE_ARENA.stage);
    // 돌려준 값을 고쳐도 표가 바뀌지 않는다.
    battleArena("raid").top = 0;
    expect(BATTLE_ARENA.raid.top).toBeGreaterThan(0);
  });
});

describe("최대 체력 비례 피해의 기준", () => {
  it("공유 체력 보스만 제 기준 체력을 갖는다", () => {
    const boss = { ...getRelic("sukusuino"), stats: { ...getRelic("sukusuino").stats, hp: 100_000 } };
    const state = createSkirmish([getRelic("rex")], [boss], ARENA, {}, {}, {
      boss: { phases: [{ startsAt: 0, damagePerSecond: 0, label: "" }], limitSeconds: 90, percentHpBasis: 5_000 },
    });
    const bossFighter = state.fighters.find(({ id }) => id === "enemy-0")!;
    const ally = state.fighters.find(({ side }) => side === "player")!;
    expect(bossFighter.maxHp).toBe(100_000);
    expect(percentHpBasis(bossFighter)).toBe(5_000);
    expect(percentHpBasis(ally)).toBe(ally.maxHp);
  });

  it("보스에게 들어간 출혈은 기준 체력으로 재고 점수에도 든다", () => {
    const boss = { ...getRelic("sukusuino"), stats: { ...getRelic("sukusuino").stats, hp: 100_000 } };
    const state = createSkirmish([getRelic("parua")], [boss], ARENA, {}, {}, {
      boss: { phases: [{ startsAt: 0, damagePerSecond: 0, label: "" }], limitSeconds: 90, percentHpBasis: 5_000 },
    });
    const bossFighter = state.fighters.find(({ id }) => id === "enemy-0")!;
    // 방패·공격이 섞이지 않게 아군을 멈춰 두고 출혈 한 틱만 본다.
    for (const fighter of state.fighters) fighter.attackCooldown = Number.POSITIVE_INFINITY;
    bossFighter.shield.amount = 0;
    bossFighter.bleed = { remaining: 1, total: 1, tickIn: 0.01, percent: 2 };
    const hpBefore = bossFighter.hp;
    const scoreBefore = state.boss!.score;
    stepSkirmish(state, 0.05, () => 0.5);
    // 2% × 5,000 = 100. 판 안의 최대 체력(10만)으로 재면 2,000이 된다.
    expect(hpBefore - bossFighter.hp).toBeGreaterThan(0);
    expect(hpBefore - bossFighter.hp).toBeLessThanOrEqual(100);
    expect(state.boss!.score - scoreBefore).toBeGreaterThanOrEqual(hpBefore - bossFighter.hp);
  });
});
