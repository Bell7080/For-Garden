import { describe, expect, it } from "vitest";
import { FakeGuildServer } from "../../src/api/FakeGuildServer";
import { GuildApiError, type GuildActor, type GuildWarDefenseInput } from "../../src/api/guildContracts";
import { GUILD_WAR_BRANCH_SWEEP_BONUS, GUILD_WAR_SCORE, GUILD_WAR_SLOT_SCORE, GUILD_WAR_START_SCORE, guildWarDayNumber, guildWarPhase } from "../../src/core/guildWar";
import { GUILD_WAR_COIN, guildWarAttacksLeft, guildWarCanAttack, guildWarFront, guildWarPoints, guildWarResult } from "../../src/core/guildWarAttack";
import { guildWarMapSlots } from "../../src/core/guildWarMap";
import { getRelic } from "../../src/data/relics";
import { createInitialRelicProgress } from "../../src/state/session";
import { captureExpeditionRelicSnapshot } from "../../src/core/expeditionSnapshot";
import { replayGuildWar } from "../../src/core/guildWarBattle";
import { emptyServerJournal, isValidServerJournal } from "../../src/core/serverJournal";

const DAY = 86_400_000;
const BADGE = { shape: "shield", shapeColor: "blue", icon: "sword", iconColor: "silver" } as const;
const actor = (userId: string): GuildActor => ({ userId, name: userId, level: 20, avatarRelicId: "torika", frameId: "holo" });
const code = async (run: () => Promise<unknown>) => { try { await run(); } catch (e) { return (e as GuildApiError).code; } return "ok"; };
const RELICS = ["torika", "dodo", "parua"];
const unit = (relicId: string) => ({ relicId, snapshot: captureExpeditionRelicSnapshot(getRelic(relicId), { ...createInitialRelicProgress(), level: 10 }, [], null) });
const deck = (slotId: string): GuildWarDefenseInput => ({
  slotId,
  deck: RELICS.map((relicId) => ({ relicId, level: 10, breakthrough: 0, power: 100 })),
  lineup: RELICS.map(unit),
});

describe("길드전 공격 규칙", () => {
  const level = 1;
  const all = guildWarMapSlots(level);
  const defended = new Set(all.map(({ id }) => id));

  it("일반 칸만 처음부터 열리고, 정예는 일반 절반, 우두머리는 정예 둘이 무너져야 열린다", () => {
    const front = guildWarFront(level, defended, new Set());
    // 일반 칸이 없는 지부는 정예가 곧바로 열린다.
    const noGrunts = (branch: number) => !all.some((s) => s.branch === branch && s.kind === "grunt");
    for (const slot of front) expect(slot.open, slot.id).toBe(slot.kind === "grunt" || (slot.kind === "elite" && noGrunts(slot.branch)));
    const grunts = all.filter((s) => s.branch === 1 && s.kind === "grunt");
    const half = grunts.slice(0, Math.ceil(grunts.length / 2)).map(({ id }) => id);
    const elitesOpen = guildWarFront(level, defended, new Set(half)).filter((s) => s.branch === 1 && s.kind === "elite");
    expect(elitesOpen.every(({ open }) => open)).toBe(true);
    const elites = all.filter((s) => s.branch === 1 && s.kind === "elite").map(({ id }) => id);
    const boss = guildWarFront(level, defended, new Set([...half, ...elites])).find((s) => s.branch === 1 && s.kind === "boss")!;
    expect(boss.open).toBe(true);
  });

  it("빈 칸은 무너진 것으로 보되 점수가 없고, 지부 보너스는 직접 격파가 있을 때만 붙는다", () => {
    const branch1 = all.filter((s) => s.branch === 1);
    // 지부 1에 지키는 사람이 없으면 열림·점수 모두 없다.
    const emptyBranch = new Set(all.filter((s) => s.branch !== 1).map(({ id }) => id));
    expect(guildWarPoints(guildWarFront(level, emptyBranch, new Set()))).toBe(0);
    // 지부 1을 모두 격파하면 칸 점수 + 보너스.
    const swept = guildWarFront(level, defended, new Set(branch1.map(({ id }) => id)));
    const slotSum = branch1.reduce((sum, s) => sum + GUILD_WAR_SLOT_SCORE[s.kind], 0);
    expect(guildWarPoints(swept)).toBe(slotSum + GUILD_WAR_BRANCH_SWEEP_BONUS);
    // 격파하지 않은 칸은 점수에 들지 않는다(빈 칸이 격파로 세지지 않는다).
    expect(guildWarFront(level, new Set(), new Set(all.map(({ id }) => id))).some(({ captured }) => captured)).toBe(false);
  });

  it("승패: 안 친 쪽은 기권, 점수가 같으면 먼저 닿은 쪽", () => {
    expect(guildWarResult({ points: 0, attacks: 0, reachedAt: 0 }, { points: 0, attacks: 1, reachedAt: 0 })).toBe("forfeit");
    expect(guildWarResult({ points: 0, attacks: 1, reachedAt: 9 }, { points: 500, attacks: 0, reachedAt: 1 })).toBe("win");
    expect(guildWarResult({ points: 100, attacks: 2, reachedAt: 9 }, { points: 90, attacks: 2, reachedAt: 1 })).toBe("win");
    expect(guildWarResult({ points: 100, attacks: 2, reachedAt: 5 }, { points: 100, attacks: 2, reachedAt: 3 })).toBe("loss");
    expect(guildWarResult({ points: 100, attacks: 2, reachedAt: 3 }, { points: 100, attacks: 2, reachedAt: 5 })).toBe("win");
  });

  it("공격 수와 새 길드원 규칙", () => {
    expect(guildWarAttacksLeft(0)).toBe(3);
    expect(guildWarAttacksLeft(5)).toBe(0);
    expect(guildWarCanAttack(99, 100)).toBe(true);
    expect(guildWarCanAttack(100, 100)).toBe(false);
  });

  it("코인은 승인된 안 A — 승 30 · 패 15 · 부전승 20 · 기권 0", () => {
    expect(GUILD_WAR_COIN).toEqual({ win: 30, loss: 15, bye: 20, forfeit: 0 });
  });
});

describe("길드전 전투 재현", () => {
  it("같은 편성·시드는 늘 같은 결과다", () => {
    const attack = RELICS.map(unit);
    const defense = [...RELICS].reverse().map(unit);
    const a = replayGuildWar(attack, defense, getRelic, "seed-1");
    const b = replayGuildWar(attack, defense, getRelic, "seed-1");
    expect(a).toEqual(b);
  });
});

/** 정비일 정오에서 시작해 두 길드(각 10명)가 방어덱을 세운다. */
async function warSetup() {
  let ms = Date.UTC(2026, 9, 14, 12);
  if (guildWarPhase(guildWarDayNumber(ms)) !== "prep") ms += DAY;
  const clock = { now: ms };
  const server = new FakeGuildServer(() => clock.now, { seed: false });
  for (const g of ["a", "b"]) {
    await server.createGuild(actor(`${g}0`), { name: `길드${g}`, joinMode: "open", badge: BADGE }, `c-${g}`);
    const id = (await server.getGuild(actor(`${g}0`))).guild!.id;
    for (let i = 1; i < 10; i += 1) await server.joinGuild(actor(`${g}${i}`), id);
    const grunts = guildWarMapSlots(1).filter(({ kind }) => kind === "grunt");
    for (let i = 0; i < 3; i += 1) await server.placeWarDefense(actor(`${g}${i}`), deck(grunts[i].id), `p-${g}${i}`);
  }
  return { clock, server };
}

describe("길드전 공격 — 로컬 서버", () => {
  it("전투일에 짝을 짓고, 격파를 한 번만 세며, 정산에서 점수와 코인을 준다", async () => {
    const { clock, server } = await warSetup();
    expect(await code(() => server.beginWarAttack(actor("a1"), "1:grunt:0", "early"))).toBe("WAR_LOCKED");
    clock.now += DAY;
    const front = await server.getWarFront(actor("a1"));
    expect(front.status).toBe("matched");
    expect(front.opponent?.name).toBe("길드b");
    const target = front.slots.find(({ open }) => open)!;

    const ticket = await server.beginWarAttack(actor("a1"), target.id, "t1");
    expect(ticket.defense).toHaveLength(3);
    expect(ticket.attacksLeft).toBe(2);
    // 같은 요청 id는 공격을 한 번 더 쓰지 않는다.
    expect((await server.beginWarAttack(actor("a1"), target.id, "t1")).attacksLeft).toBe(2);
    expect(await code(() => server.recordWarAttack(actor("a1"), { day: ticket.day, slotId: target.id, won: true, entry: "nope" }, "r0"))).toBe("WAR_NOT_ENTERED");
    const done = await server.recordWarAttack(actor("a1"), { day: ticket.day, slotId: target.id, won: true, entry: "t1" }, "r1");
    expect(done.captured).toBe(true);
    expect(done.front.myPoints).toBe(GUILD_WAR_SLOT_SCORE.grunt);
    // 무너진 칸은 다시 칠 수 없다.
    expect(await code(() => server.beginWarAttack(actor("a2"), target.id, "t2"))).toBe("SLOT_CLOSED");

    clock.now += DAY;
    const a = await server.getGuild(actor("a1"));
    const b = await server.getGuild(actor("b1"));
    expect(a.guild!.warScore).toBe(GUILD_WAR_START_SCORE + GUILD_WAR_SCORE.win);
    expect(b.guild!.warScore).toBe(GUILD_WAR_START_SCORE + GUILD_WAR_SCORE.forfeit);
    const last = (await server.getWarFront(actor("a1"))).last!;
    expect(last.outcome).toBe("win");
    expect(last.coin).toBe(GUILD_WAR_COIN.win);
    // 공격하지 않은 길드원은 코인이 없다.
    expect((await server.getWarFront(actor("a2"))).last!.coin).toBe(0);
    expect((await server.getWarFront(actor("b1"))).last!.outcome).toBe("forfeit");
  });

  it("홀수면 마지막 길드는 부전승이고, 전투일 전에 있던 길드원 모두가 코인을 받는다", async () => {
    const { clock, server } = await warSetup();
    await server.createGuild(actor("c0"), { name: "길드c", joinMode: "open", badge: BADGE }, "c-c");
    const id = (await server.getGuild(actor("c0"))).guild!.id;
    for (let i = 1; i < 10; i += 1) await server.joinGuild(actor(`c${i}`), id);
    await server.placeWarDefense(actor("c0"), deck(guildWarMapSlots(1).find(({ kind }) => kind === "grunt")!.id), "p-c0");
    clock.now += DAY;
    const views = await Promise.all(["a1", "b1", "c1"].map((u) => server.getWarFront(actor(u))));
    const bye = views.filter(({ status }) => status === "bye");
    expect(bye).toHaveLength(1);
    const byeUser = ["a1", "b1", "c1"][views.indexOf(bye[0])];
    clock.now += DAY;
    const last = (await server.getWarFront(actor(byeUser))).last!;
    expect(last.outcome).toBe("bye");
    expect(last.coin).toBe(GUILD_WAR_COIN.bye);
  });
});

describe("길드전 입장 영수증 저장 검증", () => {
  const admission = () => ({
    seed: "s", day: 20001, slotId: "1:grunt:0", opponentName: "b", defenderName: "d", expiresAt: new Date(0).toISOString(),
    attack: RELICS.map(unit), defense: RELICS.map(unit),
  });
  it("세 칸 두 편이 있는 영수증만 받는다", () => {
    expect(isValidServerJournal({ ...emptyServerJournal(), guildWarAdmissions: { r1: admission() } })).toBe(true);
    expect(isValidServerJournal({ ...emptyServerJournal(), guildWarAdmissions: { r1: { ...admission(), attack: RELICS.slice(0, 2).map(unit) } } })).toBe(false);
    expect(isValidServerJournal({ ...emptyServerJournal(), guildWarAdmissions: { r1: { ...admission(), day: 1.5 } } })).toBe(false);
  });
});
