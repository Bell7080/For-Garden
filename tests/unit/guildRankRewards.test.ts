import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FakeGuildServer } from "../../src/api/FakeGuildServer";
import type { GuildActor } from "../../src/api/guildContracts";
import { guildGuardDayKey } from "../../src/core/guildGuard";
import { previousGuildWeek, rankGuildScores } from "../../src/core/guildRankRewards";
import { GUILD_GUARD_DAILY_RANK_COINS, GUILD_WEEKLY_RANK_REWARDS, rankRewardGems } from "../../src/data/competitiveRewards";

const BADGE = { shape: "shield", shapeColor: "blue", icon: "sword", iconColor: "silver" } as const;
const actor = (userId: string): GuildActor => ({ userId, name: userId, level: 20, avatarRelicId: "torika", frameId: "holo" });
const DAY = 86_400_000;

describe("길드 순위 줄 세우기", () => {
  it("점수가 있는 길드만 높은 순, 같으면 id 순으로 선다", () => {
    const ranked = rankGuildScores([{ guildId: "b", score: 5 }, { guildId: "a", score: 5 }, { guildId: "c", score: 9 }, { guildId: "d", score: 0 }]);
    expect(ranked.map((entry) => [entry.guildId, entry.rank])).toEqual([["c", 1], ["a", 2], ["b", 3]]);
  });
  it("지난주 키는 7일 앞이다", () => {
    expect(previousGuildWeek("2026-10-26")).toBe("2026-10-19");
  });
});

describe("길드 순위 보상 정산(메모리 서버)", () => {
  it("주가 끝나면 기여한 길드원이 그 길드의 순위 젬을 한 번만 받는다", async () => {
    const t = { now: Date.UTC(2026, 9, 27, 12) }; // 화요일
    const server = new FakeGuildServer(() => t.now, { seed: false });
    await server.createGuild(actor("a"), { name: "별빛", joinMode: "open", badge: BADGE }, "r1");
    await server.createGuild(actor("b"), { name: "달빛", joinMode: "open", badge: BADGE }, "r2");
    await server.stampAttendance(actor("a"), "s1");
    expect(await server.claimWeeklyRankRewards(actor("a"))).toEqual([]); // 이번 주는 아직 마감 전
    const ranking = await server.getRanking(actor("a"));
    expect(ranking.guilds[0].isMine).toBe(true);
    expect(ranking.guilds[0].rank).toBe(1);
    t.now += 7 * DAY;
    const awards = await server.claimWeeklyRankRewards(actor("a"));
    expect(awards).toHaveLength(1);
    expect(awards[0]).toMatchObject({ guildName: "별빛", rank: 1, gems: rankRewardGems(GUILD_WEEKLY_RANK_REWARDS, 1, 1) });
    expect(await server.claimWeeklyRankRewards(actor("a"))).toEqual([]);
    expect(await server.claimWeeklyRankRewards(actor("b"))).toEqual([]); // 기여 0은 받지 않는다
  });

  it("수호전을 한 날이 지나면 길드 코인이 길드원 행에 한 번 들어오고 알림이 실린다", async () => {
    const t = { now: Date.UTC(2026, 9, 27, 12) };
    const server = new FakeGuildServer(() => t.now, { seed: false });
    await server.createGuild(actor("a"), { name: "별빛", joinMode: "open", badge: BADGE }, "r1");
    const day = guildGuardDayKey(t.now);
    const before = (await server.recordGuard(actor("a"), { day, score: 1000, coin: 0 }, "g1")).coin;
    t.now += DAY;
    const state = await server.getGuild(actor("a"));
    const coin = rankRewardGems(GUILD_GUARD_DAILY_RANK_COINS, 1, 1);
    expect(state.me!.coin).toBe(before + coin);
    expect(state.me!.guardReward).toEqual({ day, rank: 1, coin });
    expect((await server.getGuild(actor("a"))).me!.coin).toBe(before + coin);
  });
});

describe("길드 순위 보상 SQL", () => {
  const sql = readFileSync(new URL("../../supabase/migrations/20261112000000_guild_rank_rewards.sql", import.meta.url), "utf8");
  it("수호전 코인 표가 TS 표와 같다(주간 젬 표는 게임 서버가 TS 표를 넘긴다)", () => {
    const embedded = /server_guild_guard_rank_coins\(\) returns jsonb[\s\S]*?select '([^']+)'::jsonb/.exec(sql)![1];
    expect(JSON.parse(embedded)).toEqual(JSON.parse(JSON.stringify(GUILD_GUARD_DAILY_RANK_COINS)));
  });
});
