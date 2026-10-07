import { describe, expect, it } from "vitest";
import { DUEL_DEFAULT_DEFENSE, DUEL_DEFENSE_SIM, duelDefenseWinChance, duelSeasonId } from "../../src/core/duelArena";
import { simulateDuelDefenses } from "../../src/core/duelDefense";
import { duelNpcPool } from "../../src/core/duelNpcPool";
import { createEmptyDuelState, isValidDuelState, normalizeDuelState } from "../../src/core/duelState";

const NOW = new Date("2026-10-07T12:00:00Z");
const HOUR = 3_600_000;
const POOL = duelNpcPool(duelSeasonId(NOW));
const STARTERS = ["parua", "torika", "dodo", "rex"];

describe("기본 방어덱", () => {
  it("비어 있으면 파루아·토리카·도디로 채우고 직접 세우지 않은 것으로 둔다", () => {
    const state = normalizeDuelState({ ...createEmptyDuelState(), defense: [] }, STARTERS);
    expect(state.defense).toEqual([...DUEL_DEFAULT_DEFENSE]);
    expect(state.defenseCustomized).toBe(false);
    expect(isValidDuelState(state, STARTERS)).toBe(true);
  });

  it("v49 전에 덱을 세워 둔 저장은 직접 세운 것으로 옮긴다", () => {
    const legacy = { ...createEmptyDuelState(), defense: ["rex", "torika", "dodo"] } as Record<string, unknown>;
    delete legacy.defenseCustomized;
    expect(normalizeDuelState(legacy, STARTERS)).toMatchObject({ defense: ["rex", "torika", "dodo"], defenseCustomized: true });
  });

  it("빈 덱은 저장 검증을 지나지 못해 마이그레이션이 채운다", () => {
    expect(isValidDuelState({ ...createEmptyDuelState(), defense: [], defenseCustomized: false }, STARTERS)).toBe(false);
  });
});

describe("방어전", () => {
  const base = () => normalizeDuelState({ ...createEmptyDuelState(), seasonId: duelSeasonId(NOW), score: 500, seasonBestScore: 500 }, STARTERS);

  it("시계가 없으면 지금으로 세우기만 한다", () => {
    const result = simulateDuelDefenses(base(), NOW, POOL, 1000, () => 0.5);
    expect(result.entries).toEqual([]);
    expect(result.state.defenseSimAt).toBe(NOW.toISOString());
  });

  it("오래 비워도 쌓이는 판은 한도까지이고, 이기면 오르고 지면 소폭 깎인다", () => {
    const state = { ...base(), defenseSimAt: new Date(NOW.getTime() - 48 * HOUR).toISOString() };
    const won = simulateDuelDefenses(state, NOW, POOL, 1e9, () => 0.1);
    expect(won.entries).toHaveLength(DUEL_DEFENSE_SIM.catchUpLimit);
    expect(won.entries.every((entry) => entry.side === "defense" && entry.won && entry.delta === DUEL_DEFENSE_SIM.win)).toBe(true);
    expect(won.state.score).toBe(500 + DUEL_DEFENSE_SIM.win * DUEL_DEFENSE_SIM.catchUpLimit);
    expect(won.state.history[0].at > won.state.history[1].at).toBe(true);
    expect(won.state.defenseSimAt).toBe(NOW.toISOString());

    const lost = simulateDuelDefenses(state, NOW, POOL, 0, () => 0.99);
    expect(lost.entries.every((entry) => !entry.won && entry.delta === -DUEL_DEFENSE_SIM.loss)).toBe(true);
    // 연승·도전권·공격 전적은 건드리지 않는다.
    expect(lost.state).toMatchObject({ wins: 0, losses: 0, winStreak: 0, attemptsUsed: 0 });
  });

  it("간격이 차기 전에는 아무 판도 들어오지 않는다", () => {
    const state = { ...base(), defenseSimAt: new Date(NOW.getTime() - (DUEL_DEFENSE_SIM.intervalHours * HOUR - 1)).toISOString() };
    expect(simulateDuelDefenses(state, NOW, POOL, 1000, () => 0.5).entries).toEqual([]);
  });

  it("이길 확률은 전투력 몫을 범위 안으로 자른다", () => {
    expect(duelDefenseWinChance(100, 100)).toBe(0.5);
    expect(duelDefenseWinChance(1e9, 1)).toBe(DUEL_DEFENSE_SIM.maxWinChance);
    expect(duelDefenseWinChance(0, 1e9)).toBe(DUEL_DEFENSE_SIM.minWinChance);
  });
});
