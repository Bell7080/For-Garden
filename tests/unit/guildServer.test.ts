import { describe, expect, it } from "vitest";
import { FakeGuildServer } from "../../src/api/FakeGuildServer";
import { FakeServer } from "../../src/api/FakeServer";
import { GuildApiError, type GuildActor } from "../../src/api/guildContracts";
import { GUILD_ATTENDANCE_CYCLE, GUILD_CREATE_GEMS, GUILD_RENAME_GEMS } from "../../src/core/guild";
import { createDefaultSession } from "../../src/state/session";

const BADGE = { shape: "shield", shapeColor: "blue", icon: "sword", iconColor: "silver" } as const;
const actor = (userId: string, name = userId, level = 20): GuildActor => ({ userId, name, level, avatarRelicId: "torika", frameId: "holo" });
const code = async (run: () => Promise<unknown>) => { try { await run(); } catch (e) { return (e as GuildApiError).code; } return "ok"; };
const make = (t = { now: Date.UTC(2026, 9, 14, 12) }) => ({ t, server: new FakeGuildServer(() => t.now, { seed: false }) });

describe("길드 메모리 서버", () => {
  it("만들고 가입하고 직위·떠나기 규칙을 지킨다", async () => {
    const { server } = make();
    await server.createGuild(actor("a"), { name: "별빛", joinMode: "open", badge: BADGE }, "r1");
    expect(await code(() => server.createGuild(actor("b"), { name: "별빛", joinMode: "open", badge: BADGE }, "r2"))).toBe("NAME_TAKEN");
    expect(await code(() => server.createGuild(actor("a"), { name: "다른", joinMode: "open", badge: BADGE }, "r3"))).toBe("ALREADY_IN_GUILD");
    const id = (await server.getGuild(actor("a"))).guild!.id;
    expect(await server.joinGuild(actor("b"), id)).toEqual({ status: "joined" });
    expect(await code(() => server.setMemberRole(actor("b"), "a", "vice"))).toBe("NO_PERMISSION");
    await server.setMemberRole(actor("a"), "b", "vice");
    expect(await code(() => server.leaveGuild(actor("a")))).toBe("LEADER_CANNOT_LEAVE");
    await server.leaveGuild(actor("b"));
    expect(await code(() => server.joinGuild(actor("b"), id))).toBe("LEAVE_COOLDOWN");
  });

  it("같은 요청 id의 생성은 한 번만 반영된다", async () => {
    const { server } = make();
    const first = await server.createGuild(actor("a"), { name: "별빛", joinMode: "open", badge: BADGE }, "same");
    const again = await server.createGuild(actor("a"), { name: "별빛", joinMode: "open", badge: BADGE }, "same");
    expect(again.guild!.id).toBe(first.guild!.id);
  });

  it("출석은 하루 한 번이고 코인·부흥도를 올리며 상점 한도를 센다", async () => {
    const { server } = make();
    await server.createGuild(actor("a"), { name: "별빛", joinMode: "open", badge: BADGE }, "r1");
    const stamped = await server.stampAttendance(actor("a"), "s1");
    expect(stamped.attendance.stampedToday).toBe(true);
    expect(await code(() => server.stampAttendance(actor("a"), "s2"))).toBe("ALREADY_STAMPED");
    const state = await server.getGuild(actor("a"));
    expect(state.me!.coin).toBe(5);
    expect(state.guild!.prosperity).toBe(10);
    expect(await code(() => server.purchase(actor("a"), "guild-gold", "p1"))).toBe("INSUFFICIENT_COINS");
  });
});

describe("길드 출석 순환", () => {
  it("빠진 날이 있어도 이어서 찍고 7일차 다음 날 1일차로 돌아간다", async () => {
    const { t, server } = make();
    await server.createGuild(actor("a"), { name: "별빛", joinMode: "open", badge: BADGE }, "r1");
    const days: number[] = [];
    for (let i = 0; i < 9; i++) {
      days.push((await server.stampAttendance(actor("a"), `s${i}`)).day);
      t.now += (i === 2 ? 3 : 1) * 86_400_000; // 사흘째 뒤에 이틀을 빠진다
    }
    expect(days).toEqual([1, 2, 3, 4, 5, 6, 7, 1, 2]);
    const coin = GUILD_ATTENDANCE_CYCLE.reduce((sum, d) => sum + d.coin, 0) + GUILD_ATTENDANCE_CYCLE[0].coin + GUILD_ATTENDANCE_CYCLE[1].coin;
    expect((await server.getGuild(actor("a"))).me!.coin).toBe(coin);
  });

  it("7일차를 찍은 날은 7칸이 다 찬 판이고 다음 날 빈 판에서 1일차다", async () => {
    const { t, server } = make();
    await server.createGuild(actor("a"), { name: "별빛", joinMode: "open", badge: BADGE }, "r1");
    for (let i = 0; i < 7; i++) { await server.stampAttendance(actor("a"), `s${i}`); if (i < 6) t.now += 86_400_000; }
    expect(await server.getAttendance(actor("a"))).toMatchObject({ filled: 7, day: 7, stampedToday: true });
    t.now += 86_400_000;
    expect(await server.getAttendance(actor("a"))).toMatchObject({ filled: 0, day: 1, stampedToday: false });
  });
});

describe("FakeServer 길드 조작", () => {
  it("생성은 젬 2,000을 한 번만 빼고 출석 보상은 지갑에 든다", async () => {
    const guild = new FakeGuildServer(() => Date.UTC(2026, 9, 14, 12), { seed: false, levelGate: false });
    const state = createDefaultSession();
    state.wallet.gems = 5_000;
    state.playerResearch.level = 20;
    const server = new FakeServer(state, { latencyMs: 0, guild, persistSession: () => undefined });
    await server.createGuild({ name: "별빛", joinMode: "open", badge: { ...BADGE } });
    expect(state.wallet.gems).toBe(5_000 - GUILD_CREATE_GEMS);
    const gold = state.wallet.gold;
    const stamped = await server.stampGuildAttendance({});
    expect(stamped.day).toBe(1);
    expect(state.wallet.gold).toBe(gold + GUILD_ATTENDANCE_CYCLE[0].reward.gold!);
    state.wallet.gems = 10;
    // 첫 변경은 무료, 그 뒤는 젬 500이 든다.
    expect(await code(() => server.changeGuildBadge({ badge: { shape: "hexagon", shapeColor: "crimson", icon: "leaf", iconColor: "ink" } }))).toBe("ok");
    expect(state.wallet.gems).toBe(10);
    expect(await code(() => server.changeGuildBadge({ badge: { shape: "banner", shapeColor: "crimson", icon: "leaf", iconColor: "ink" } }))).toBe("INSUFFICIENT_GEMS");
  });

  it("이름 변경은 길드장만 젬 2,000으로 하고 같은 이름·겹치는 이름은 받지 않는다", async () => {
    const guild = new FakeGuildServer(() => Date.UTC(2026, 9, 14, 12), { seed: false, levelGate: false });
    await guild.createGuild(actor("other"), { name: "달빛", joinMode: "open", badge: BADGE }, "o1");
    const state = createDefaultSession();
    state.wallet.gems = 5_000;
    state.playerResearch.level = 20;
    const server = new FakeServer(state, { latencyMs: 0, guild, persistSession: () => undefined });
    await server.createGuild({ name: "별빛", joinMode: "open", badge: { ...BADGE } });
    const before = state.wallet.gems;
    // 같은 이름은 값을 받지 않는다.
    expect(await code(() => server.renameGuild({ name: "별빛" }))).toBe("ok");
    expect(state.wallet.gems).toBe(before);
    expect(await code(() => server.renameGuild({ name: "달빛" }))).toBe("NAME_TAKEN");
    expect(await code(() => server.renameGuild({ name: "!" }))).toBe("NAME_INVALID");
    expect(state.wallet.gems).toBe(before);
    expect(await code(() => server.renameGuild({ name: "새벽 별" }))).toBe("ok");
    expect(state.wallet.gems).toBe(before - GUILD_RENAME_GEMS);
    expect((await guild.getGuild(actor("local-player"))).guild?.name).toBe("새벽 별");
    state.wallet.gems = 10;
    expect(await code(() => server.renameGuild({ name: "노을" }))).toBe("INSUFFICIENT_GEMS");
    // 길드장이 아니면 못 바꾼다.
    await guild.joinGuild(actor("member"), (await guild.getGuild(actor("other"))).guild!.id);
    expect(await code(() => guild.renameGuild(actor("member"), "바람", "m1"))).toBe("NO_PERMISSION");
  });

  it("젬이 모자라면 길드가 생기지 않는다", async () => {
    const guild = new FakeGuildServer(() => Date.now(), { seed: false, levelGate: false });
    const state = createDefaultSession();
    state.wallet.gems = 100;
    const server = new FakeServer(state, { latencyMs: 0, guild, persistSession: () => undefined });
    expect(await code(() => server.createGuild({ name: "별빛", joinMode: "open", badge: { ...BADGE } }))).toBe("INSUFFICIENT_GEMS");
    expect((await guild.getGuild(actor("local-player"))).guild).toBeNull();
  });
});
