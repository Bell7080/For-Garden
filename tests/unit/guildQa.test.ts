import { describe, expect, it } from "vitest";
import { FakeGuildServer } from "../../src/api/FakeGuildServer";
import { GUILD_WAR_MIN_MEMBERS } from "../../src/core/guildWar";

const actor = { userId: "qa-me", name: "시험 연구원", level: 40, avatarRelicId: "torika", frameId: "holo" };

describe("QA 표본 길드", () => {
  it("길드전을 해 볼 수 있게 열 명 이상인 길드가 여럿이고 점수·등수가 있다", async () => {
    const server = new FakeGuildServer(() => Date.UTC(2026, 9, 27), { seed: true, levelGate: false });
    const { guilds } = await server.searchGuilds(actor, "");
    expect(guilds.filter((g) => g.memberCount >= GUILD_WAR_MIN_MEMBERS).length).toBeGreaterThanOrEqual(4);
    expect(guilds.every((g) => g.warScore === null || g.warScore > 0)).toBe(true);
  });

  it("표본 길드원은 공개 카드를 갖는다", async () => {
    const server = new FakeGuildServer(() => Date.UTC(2026, 9, 27), { seed: true, levelGate: false });
    const first = server.qaGuilds()[0];
    await server.joinGuild(actor, first.id);
    const { members } = await server.getMembers(actor);
    expect(members.filter((m) => !m.isMe).every((m) => m.card?.favorite)).toBe(true);
  });

  it("길드가 없으면 길드장으로 만들고 인원을 채운다", async () => {
    const server = new FakeGuildServer(() => Date.UTC(2026, 9, 27), { seed: false, levelGate: false });
    const id = server.qaEnsureGuild(actor, { shape: "shield", shapeColor: "violet", icon: "sword", iconColor: "amber" });
    server.qaFillMembers(id, 14);
    expect(server.qaGuilds()[0].memberCount).toBe(14);
    expect(server.qaEnsureGuild(actor, { shape: "shield", shapeColor: "violet", icon: "sword", iconColor: "amber" })).toBe(id);
  });
});
