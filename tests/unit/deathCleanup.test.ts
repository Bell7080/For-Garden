import { describe, expect, it } from "vitest";
import { createSkirmish, stepSkirmish, type SkirmishEvent } from "../../src/core/skirmish";
import { captureExpeditionRelicSnapshot } from "../../src/core/expeditionSnapshot";
import { createGuildGuardSkirmish, replayGuildGuard, type GuildGuardLineup } from "../../src/core/guildGuardBattle";
import { guildGuardRoster } from "../../src/data/guildGuard";
import { getRelic } from "../../src/data/relics";
import { createInitialRelicProgress } from "../../src/state/session";

const ARENA = { left: 0, right: 600, top: 0, bottom: 1_000 };

const lineup = (ids: readonly (string | null)[], level: number): GuildGuardLineup => ids.map((id) => id === null ? null : {
  relicId: id,
  snapshot: captureExpeditionRelicSnapshot(getRelic(id), { ...createInitialRelicProgress(), level, breakthrough: Math.max(0, Math.ceil((level - 20) / 10)) }, [], null),
});

const deaths = (events: SkirmishEvent[], id: string): number => events.filter((event) => event.kind === "death" && event.fighterId === id).length;

/**
 * 쓰러진 몸은 반드시 사망 사건을 한 번 낸다 — 화면은 그 사건으로만 시체를 날려 보내므로, 빠지면 체력 0인 몸이
 * 전장에 선 채로 남는다(노도니아가 아군 몫을 대신 받다 쓰러질 때 그랬다).
 */
describe("사망 정리", () => {
  it("노도니아가 아군 몫을 대신 받다 쓰러져도 사망 사건이 나온다", () => {
    const state = createSkirmish([getRelic("nodonia"), getRelic("rex")], [getRelic("raitia-grass")], ARENA);
    const [nodonia, rex] = state.fighters.filter(({ side }) => side === "player");
    nodonia.bulwark = { remaining: 5, total: 5, percent: 100, regenPercentPerSecond: 0, passiveHealBonusPercent: 0, tickIn: 1, skillId: "test", name: "test" };
    nodonia.hp = 1;
    rex.maxHp = rex.hp = 1_000_000_000;
    const events: SkirmishEvent[] = [];
    for (let i = 0; i < 400 && nodonia.hp > 0; i += 1) events.push(...stepSkirmish(state, 0.05, () => 0.5));
    for (let i = 0; i < 4; i += 1) events.push(...stepSkirmish(state, 0.05, () => 0.5));
    expect(nodonia.hp).toBe(0);
    expect(deaths(events, nodonia.id)).toBe(1);
  });

  it("어느 길로 쓰러졌든 다음 조각에서 한 번만 알리고, 이미 알린 몸은 다시 알리지 않는다", () => {
    const state = createSkirmish([getRelic("rex")], [getRelic("raitia-grass"), getRelic("raitia-grass")], ARENA);
    const enemy = state.fighters.find(({ side }) => side === "enemy")!;
    stepSkirmish(state, 0.05);
    enemy.hp = 0;
    const first = stepSkirmish(state, 0.05);
    const later = [...stepSkirmish(state, 0.05), ...stepSkirmish(state, 0.05)];
    expect(deaths(first, enemy.id)).toBe(1);
    expect(deaths(later, enemy.id)).toBe(0);
  });

  it("수호전은 점수를 거둔 시체를 판에서 걷어 낸다 — 살아 있는 몸만 남고 점수는 그대로 쌓인다", () => {
    const state = createGuildGuardSkirmish(lineup(["nodonia", "rex", "ark", "terisa", "stella", "mette"], 60), getRelic, guildGuardRoster("fire"));
    let kills = 0;
    for (let i = 0; i < 20 * 120 && state.phase === "fight"; i += 1) stepSkirmish(state, 0.05, () => 0.5);
    kills = state.horde!.kills;
    expect(kills).toBeGreaterThan(20);
    const fallen = state.fighters.filter((fighter) => fighter.side === "enemy" && fighter.hordeCounted);
    expect(fallen).toHaveLength(0);
    // 걷어 낸 몸 대신 살아 있는 몸 + 아군만 남아 몸 수가 처치 수에 묶여 늘지 않는다.
    expect(state.fighters.length).toBeLessThan(40);
  });

  it("같은 시드의 수호전은 늘 같은 점수다", () => {
    const ids = ["nodonia", "rex", "ark", "terisa", "stella", "mette"];
    expect(replayGuildGuard(lineup(ids, 40), getRelic, guildGuardRoster("water"), "seed-c"))
      .toEqual(replayGuildGuard(lineup(ids, 40), getRelic, guildGuardRoster("water"), "seed-c"));
  }, 60_000);
});
