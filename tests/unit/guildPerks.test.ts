import { describe, expect, it } from "vitest";
import { FakeServer } from "../../src/api/FakeServer";
import type { GuildBackend } from "../../src/api/guildContracts";
import { guildDispatchMinutes, guildExcavationBonus, guildLevelUpNotice } from "../../src/core/guild";
import { findInteractionCity } from "../../src/data/interactionCities";
import { createDefaultSession } from "../../src/state/session";

/** 길드 레벨만 돌려주는 길드 저장소 — 혜택 경계가 읽는 것은 레벨 하나다. */
const guildAt = (level: number | null) => ({
  getGuild: async () => ({ guild: level === null ? null : { level }, me: null }),
}) as unknown as GuildBackend;
const broken = { getGuild: async () => { throw new Error("down"); } } as unknown as GuildBackend;

describe("길드 레벨 혜택", () => {
  it("의 계산은 반올림한 분과 내림한 정수다", () => {
    expect(guildDispatchMinutes(240, 10)).toBe(216);
    expect(guildDispatchMinutes(10, 5)).toBe(10);
    expect(guildDispatchMinutes(1, 10)).toBe(1);
    expect(guildExcavationBonus(99, 10)).toBe(9);
    expect(guildExcavationBonus(19, 5)).toBe(0);
  });

  it("교류 파견 시간을 도시 목록과 실제 종료 시각이 같은 값으로 줄인다", async () => {
    const now = new Date("2026-09-03T00:00:00.000Z");
    const server = new FakeServer(createDefaultSession(), { latencyMs: 0, random: () => 0, now: () => now, guild: guildAt(9) });
    const base = findInteractionCity("doppel-parlor")!.durationMinutes;
    const city = (await server.getInteractionCities()).cities.find(({ id }) => id === "doppel-parlor")!;
    expect(city.durationMinutes).toBe(guildDispatchMinutes(base, 10));
    const [dispatch] = (await server.startInteractionDispatch({ cityId: "doppel-parlor", party: ["torika"] })).dispatches;
    expect(Date.parse(dispatch.completesAt) - now.getTime()).toBe(city.durationMinutes * 60_000);
  });

  it("발굴 수확에 걷은 양의 몇 %를 얹고, 길드가 없거나 닿지 않으면 그대로 준다", async () => {
    const harvest = async (guild: GuildBackend) => {
      const state = createDefaultSession(); state.idleExcavation.unclaimed = { gold: 1_000, cheesecake: 40, rawStone: 9, gems: 0 };
      return (await new FakeServer(state, { latencyMs: 0, now: () => new Date("2026-08-20T00:00:00Z"), guild }).harvestExcavation({ requestId: "h" })).granted;
    };
    expect(await harvest(guildAt(null))).toMatchObject({ gold: 1_000, cheesecake: 40, rawStone: 9 });
    expect(await harvest(broken)).toMatchObject({ gold: 1_000, cheesecake: 40, rawStone: 9 });
    expect(await harvest(guildAt(3))).toMatchObject({ gold: 1_050, cheesecake: 42, rawStone: 9 });
    expect(await harvest(guildAt(7))).toMatchObject({ gold: 1_100, cheesecake: 44, rawStone: 9 });
  });
});

describe("길드 레벨업 알림", () => {
  it("은 같은 길드에서 본 레벨보다 올랐을 때만 서고, 처음 보는 길드는 적어 두기만 한다", () => {
    expect(guildLevelUpNotice("", "g-1", 3)).toEqual({ key: "g-1:3", from: null });
    expect(guildLevelUpNotice("g-1:3", "g-1", 3).from).toBeNull();
    expect(guildLevelUpNotice("g-1:3", "g-1", 5).from).toBe(3);
    expect(guildLevelUpNotice("g-2:3", "g-1", 5).from).toBeNull();
    expect(guildLevelUpNotice("g-1:9", "g-1", 5).from).toBeNull();
  });
});
