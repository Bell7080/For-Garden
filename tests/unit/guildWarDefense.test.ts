import { describe, expect, it } from "vitest";
import { FakeGuildServer } from "../../src/api/FakeGuildServer";
import { GuildApiError, type GuildActor, type GuildWarDefenseInput } from "../../src/api/guildContracts";
import { guildWarDayNumber, guildWarPhase } from "../../src/core/guildWar";

const BADGE = { shape: "shield", shapeColor: "blue", icon: "sword", iconColor: "silver" } as const;
const actor = (userId: string): GuildActor => ({ userId, name: userId, level: 20, avatarRelicId: "torika", frameId: "holo" });
const code = async (run: () => Promise<unknown>) => { try { await run(); } catch (e) { return (e as GuildApiError).code; } return "ok"; };
const deck = (slotId: string): GuildWarDefenseInput => ({
  slotId,
  deck: ["torika", "dodo", "farua"].map((relicId) => ({ relicId, level: 10, breakthrough: 0, power: 100 })),
  lineup: [],
});

/** 정비일 정오 — 길드전 지도는 정비일에만 고친다. */
function prepNoon(): number {
  let ms = Date.UTC(2026, 9, 14, 12);
  if (guildWarPhase(guildWarDayNumber(ms)) !== "prep") ms += 86_400_000;
  return ms;
}

async function setup() {
  const clock = { now: prepNoon() };
  const server = new FakeGuildServer(() => clock.now, { seed: false });
  await server.createGuild(actor("lead"), { name: "별빛", joinMode: "open", badge: BADGE }, "c");
  const id = (await server.getGuild(actor("lead"))).guild!.id;
  await server.joinGuild(actor("b"), id);
  await server.joinGuild(actor("c"), id);
  return { clock, server };
}

describe("길드전 방어진 지도", () => {
  it("빈 칸에만 세우고, 다른 칸에 세우면 옮겨 간다", async () => {
    const { server } = await setup();
    let map = await server.placeWarDefense(actor("b"), deck("1:boss:0"), "p1");
    expect(map.mySlotId).toBe("1:boss:0");
    expect(map.slots.find(({ id }) => id === "1:boss:0")?.power).toBe(300);
    expect(await code(() => server.placeWarDefense(actor("c"), deck("1:boss:0"), "p2"))).toBe("SLOT_TAKEN");
    map = await server.placeWarDefense(actor("b"), deck("2:elite:1"), "p3");
    expect(map.mySlotId).toBe("2:elite:1");
    expect(map.slots.find(({ id }) => id === "1:boss:0")?.holder).toBeNull();
    // 같은 요청 id는 다시 반영되지 않는다.
    map = await server.placeWarDefense(actor("b"), deck("1:boss:0"), "p1");
    expect(map.mySlotId).toBe("2:elite:1");
  });

  it("닫힌 칸·잘못된 덱은 받지 않고, 전투일에는 잠긴다", async () => {
    const { clock, server } = await setup();
    expect(await code(() => server.placeWarDefense(actor("b"), deck("3:grunt:5"), "x1"))).toBe("SLOT_INVALID");
    expect(await code(() => server.placeWarDefense(actor("b"), { ...deck("1:boss:0"), deck: deck("1:boss:0").deck.slice(0, 2) }, "x2"))).toBe("INVALID_REQUEST");
    clock.now += 86_400_000;
    expect((await server.getWarMap(actor("b"))).phase).toBe("battle");
    expect(await code(() => server.placeWarDefense(actor("b"), deck("1:boss:0"), "x3"))).toBe("WAR_LOCKED");
  });

  it("비우기는 자기 칸이거나 배치 권한이 있어야 하고, 떠나면 칸이 빈다", async () => {
    const { server } = await setup();
    await server.placeWarDefense(actor("b"), deck("1:boss:0"), "p1");
    await server.placeWarDefense(actor("c"), deck("1:elite:0"), "p2");
    expect(await code(() => server.clearWarSlot(actor("c"), "1:boss:0"))).toBe("NO_PERMISSION");
    expect((await server.clearWarSlot(actor("lead"), "1:boss:0")).slots.find(({ id }) => id === "1:boss:0")?.holder).toBeNull();
    await server.leaveGuild(actor("c"));
    expect((await server.getWarMap(actor("lead"))).slots.every(({ holder }) => holder === null)).toBe(true);
  });
});
