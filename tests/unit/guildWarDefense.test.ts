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

  it("칸을 고르지 않으면 제 칸을 지키거나 자동 배치 순서의 첫 빈 칸에 선다", async () => {
    const { server } = await setup();
    const free = (input: GuildWarDefenseInput, power = 100): GuildWarDefenseInput => ({
      ...input, slotId: null, deck: input.deck.map((d) => ({ ...d, power })),
    });
    let map = await server.placeWarDefense(actor("b"), free(deck("x")), "a1");
    expect(map.mySlotId).toBe("1:boss:0");
    map = await server.placeWarDefense(actor("c"), free(deck("x")), "a2");
    expect(map.mySlotId).toBe("2:boss:0");
    // 이미 선 칸이면 덱만 바꾼다.
    map = await server.placeWarDefense(actor("b"), free(deck("x"), 500), "a3");
    expect(map.mySlotId).toBe("1:boss:0");
    expect(map.slots.find(({ id }) => id === "1:boss:0")?.power).toBe(1500);
  });

  it("옮기기·자동 배치는 배치 권한만 하고, 자동 배치는 전투력 순으로 다시 세운다", async () => {
    const { server } = await setup();
    const at = (slotId: string, power: number): GuildWarDefenseInput => ({
      ...deck(slotId), deck: deck(slotId).deck.map((d) => ({ ...d, power })),
    });
    await server.placeWarDefense(actor("b"), at("1:boss:0", 100), "m1");
    await server.placeWarDefense(actor("c"), at("2:boss:0", 900), "m2");
    expect(await code(() => server.moveWarSlot(actor("c"), "1:boss:0", "2:boss:0"))).toBe("NO_PERMISSION");
    expect(await code(() => server.autoArrangeWar(actor("b")))).toBe("NO_PERMISSION");
    let map = await server.moveWarSlot(actor("lead"), "1:boss:0", "2:boss:0");
    expect(map.slots.find(({ id }) => id === "1:boss:0")?.holder?.userId).toBe("c");
    expect(map.slots.find(({ id }) => id === "2:boss:0")?.holder?.userId).toBe("b");
    map = await server.moveWarSlot(actor("lead"), "2:boss:0", "3:elite:0");
    expect(map.slots.find(({ id }) => id === "2:boss:0")?.holder).toBeNull();
    await server.placeWarDefense(actor("lead"), at("1:elite:0", 500), "m3");
    map = await server.autoArrangeWar(actor("lead"));
    const who = (id: string) => map.slots.find((slot) => slot.id === id)?.holder?.userId ?? null;
    expect([who("1:boss:0"), who("2:boss:0"), who("3:boss:0")]).toEqual(["c", "lead", "b"]);
  });
});

describe("길드장 자동 위임", () => {
  it("14일 미접속 길드장은 기여도 1위 임원에게 넘어가고, 그 전이나 후계가 없으면 그대로다", async () => {
    const { clock, server } = await setup();
    const roleOf = async (userId: string) => (await server.getMembers(actor("b"))).members.find((m) => m.userId === userId)?.role;
    clock.now += 20 * 86_400_000;
    // 임원이 없으면 아무에게도 넘기지 않는다.
    expect(await roleOf("lead")).toBe("leader");
    await server.setMemberRole(actor("lead"), "c", "officer");
    clock.now += 13 * 86_400_000;
    expect(await roleOf("lead")).toBe("leader");
    clock.now += 2 * 86_400_000;
    expect(await roleOf("c")).toBe("leader");
    expect(await roleOf("lead")).toBe("member");
  });
});
