import { describe, expect, it } from "vitest";
import { FakeServer } from "../../src/api/FakeServer";
import { expeditionBossSalvage } from "../../src/data/expedition";
import { AttendanceManager } from "../../src/managers/AttendanceManager";
import { InventoryManager } from "../../src/managers/InventoryManager";
import { MailManager } from "../../src/managers/MailManager";
import { ManagerEvents } from "../../src/managers/ManagerEvents";
import { ExpeditionManager } from "../../src/managers/ExpeditionManager";
import { createDefaultSession, type Session } from "../../src/state/session";
import { SAVE_STORAGE_KEY, SaveManager } from "../../src/state/SaveManager";
import { rollExpeditionPeriods } from "../../src/core/expeditionPeriods";

const NOW = new Date("2026-10-01T12:00:00Z");
class Storage {
  value: string | null = null;
  fail = false;
  getItem() { return this.value; }
  setItem(_key: string, value: string) { if (this.fail) throw new Error("quota exceeded"); this.value = value; }
  removeItem() { this.value = null; }
}
function harness() {
  const storage = new Storage(); const saves = new SaveManager(storage);
  const state = createDefaultSession(); state.itemInventory = []; state.wallet.stamina = 60; state.staminaUpdatedAt = NOW.toISOString();
  let time = NOW;
  const api = (target = state) => new FakeServer(target, { latencyMs: 0, now: () => time, random: () => 0.5, persistSession: (next) => saves.save(next) });
  return { state, storage, saves, api, clock: (next: Date) => { time = next; }, now: () => time, reload: () => saves.load()! };
}
function tonicLots(state: Session) {
  state.itemInventory = [{ itemId: "stamina-tonic", quantity: 3, lots: [
    { quantity: 1, expiresAt: "2026-10-05T12:00:00.000Z" }, { quantity: 2, expiresAt: "2026-10-07T12:00:00.000Z" },
  ] }];
}
function bossRun(h: ReturnType<typeof harness>) {
  const manager = new ExpeditionManager(h.state, h.saves, h.now, true);
  expect(manager.prepareDevelopmentBossShortcut(h.state.party).ok).toBe(true);
  const run = h.state.expedition.run!; const node = run.nodes.find(({ type }) => type === "boss")!;
  const requestId = run.bossSubmissionId!;
  const actions = run.relics.map(({ relicId: actorId }) => ({ actorId, elapsedMs: 0, kind: "basic" as const }));
  return { manager, runId: run.runId, nodeId: node.id, requestId, actions };
}

describe("보상과 전투 영수증의 저장·재접속", () => {
  it("기한이 다른 음료를 가진 채 신입→정규 출석·우편·가방 조회를 완료하고 저장한다", async () => {
    const h = harness(); tonicLots(h.state); const api = h.api();
    const attendance = new AttendanceManager(api, h.state, new ManagerEvents());
    await attendance.claim("newcomer", "newcomer"); await attendance.claim("regular", "regular");
    await new MailManager(api, h.state, new ManagerEvents()).claim(["launch-gift"], "mail");
    await new InventoryManager(h.state, new ManagerEvents()).refresh(api);
    expect(h.state.itemInventory).toHaveLength(1); expect(h.state.itemInventory[0].quantity).toBe(3);
    expect(h.state.itemInventory[0].lots).toHaveLength(2);
    h.saves.save(h.state); expect(h.reload().attendance!.regular.claimed).toBe(1);
  });

  it("출석 저장 실패는 보상·도장·영수증을 바꾸지 않고 같은 요청으로 재시도된다", async () => {
    const h = harness(); const api = h.api(); await api.getAttendance();
    const before = structuredClone(h.state); h.storage.fail = true;
    const request = { trackId: "regular" as const, requestId: "regular" };
    await expect(api.claimAttendance(request)).rejects.toMatchObject({ code: "PERSISTENCE_FAILED" });
    expect(h.state).toEqual(before); h.storage.fail = false;
    const response = await api.claimAttendance(request); const wallet = { ...h.state.wallet };
    expect(response.day).toBe(1); await h.api(h.reload()).claimAttendance(request);
    expect(h.reload().wallet).toEqual(wallet);
  });

  it("우편 저장 실패는 수령 기록과 보상을 남기지 않고 재시도된다", async () => {
    const h = harness(); const api = h.api(); await api.getMails();
    const before = structuredClone(h.state); h.storage.fail = true;
    await expect(api.claimMailRewards({ requestId: "mail", mailIds: ["launch-gift"] })).rejects.toMatchObject({ code: "PERSISTENCE_FAILED" });
    expect(h.state).toEqual(before); h.storage.fail = false;
    const result = await api.claimMailRewards({ requestId: "mail", mailIds: ["launch-gift"] });
    expect(result.granted.length).toBeGreaterThan(0);
    await h.api(h.reload()).claimMailRewards({ requestId: "mail", mailIds: ["launch-gift"] });
    expect(h.reload().wallet).toEqual(h.state.wallet);
  });

  it("출석 재응답은 이후 받은 우편 보상을 과거 지갑으로 덮어쓰지 않는다", async () => {
    const h = harness(); const api = h.api(); const manager = new AttendanceManager(api, h.state, new ManagerEvents());
    await manager.claim("newcomer", "n"); await api.claimMailRewards({ mailIds: ["launch-gift"], requestId: "m" });
    const wallet = { ...h.state.wallet }; await manager.claim("newcomer", "n"); expect(h.state.wallet).toEqual(wallet);
  });

  it("저장 왕복 뒤 레이드 입장 영수증과 편성을 복원하고 추가 비용 없이 제출한다", async () => {
    const h = harness(); const api = h.api(); const raidId = "world-2026-10-01";
    const admission = await api.enterRaid({ raidId, requestId: "entry" });
    const reloaded = h.reload(); const wallet = { ...reloaded.wallet }; reloaded.party.reverse();
    const restarted = h.api(reloaded);
    expect((await restarted.getRaids()).raids.find(({ id }) => id === raidId)?.pendingRequestId).toBe("entry");
    const again = await restarted.enterRaid({ raidId, requestId: "entry" });
    expect(again.relics).toEqual(admission.relics); expect(reloaded.wallet).toEqual(wallet);
    const actions = admission.relics!.map(({ relicId: actorId }) => ({ actorId, elapsedMs: 0, kind: "basic" as const }));
    const result = await restarted.submitRaidDamage({ raidId, requestId: "entry", actions });
    expect(result.runDamage).toBeGreaterThan(0); const damage = h.reload().raid.instances.find(({ id }) => id === raidId)!.myDamage;
    await h.api(h.reload()).submitRaidDamage({ raidId, requestId: "entry", actions });
    expect(h.reload().raid.instances.find(({ id }) => id === raidId)!.myDamage).toBe(damage);
  });

  it("종료 직전 입장한 레이드는 유예 중 제출되며 입장 횟수는 한 번이다", async () => {
    const h = harness(); h.clock(new Date("2026-10-01T23:59:59Z")); h.state.staminaUpdatedAt = h.now().toISOString();
    const api = h.api(); const raidId = "world-2026-10-01";
    const admission = await api.enterRaid({ raidId, requestId: "late" }); h.clock(new Date("2026-10-02T00:00:01Z"));
    const actions = admission.relics!.map(({ relicId: actorId }) => ({ actorId, elapsedMs: 0, kind: "basic" as const }));
    const result = await h.api(h.reload()).submitRaidDamage({ raidId, requestId: "late", actions });
    expect(result.runDamage).toBeGreaterThan(0); expect(result.raid.attemptsUsed).toBe(1);
  });

  it("유예를 넘긴 레이드 입장은 점수 제출을 거절한다", async () => {
    const h = harness(); const raidId = "world-2026-10-01"; await h.api().enterRaid({ raidId, requestId: "late" });
    const deadline = h.state.serverJournal!.raidAdmissions.late.expiresAt; h.clock(new Date(Date.parse(deadline) + 1));
    await expect(h.api(h.reload()).submitRaidDamage({ raidId, requestId: "late", actions: [] })).rejects.toMatchObject({ code: "RAID_ENDED" });
  });

  it("원정 노드 완료 영수증을 재접속 뒤 복원하며 점수·전리품을 중복 지급하지 않는다", async () => {
    const h = harness(); new ExpeditionManager(h.state, h.saves, h.now).start(h.state.party);
    const run = h.state.expedition.run!; const node = run.nodes.find(({ floor }) => floor === 1)!;
    const request = { requestId: "node", runId: run.runId, nodeId: node.id, relicHp: [100, 80, 0] };
    const first = await h.api().completeExpeditionNode(request); const before = h.reload().expedition.run!;
    expect(await h.api(h.reload()).completeExpeditionNode(request)).toEqual(first);
    expect(h.reload().expedition.run!.pendingRewards).toEqual(before.pendingRewards);
    expect(h.reload().expedition.run!.normalNodeScoreTotal).toBe(before.normalNodeScoreTotal);
  });

  it("원정 보스 제출·최종 정산의 재접속 재시도는 인양 보상·횟수를 한 번만 반영한다", async () => {
    const h = harness(); const input = bossRun(h); const first = await h.api().submitExpeditionBossScore(input);
    const salvage = h.reload().expedition.run!.pendingRewards.salvageRecord;
    expect(first.bossSalvage).toBe(expeditionBossSalvage(first.bossDamageScore)); expect(await h.api(h.reload()).submitExpeditionBossScore(input)).toEqual(first);
    expect(h.reload().expedition.run!.pendingRewards.salvageRecord).toBe(salvage);
    const request = { runId: input.runId, settlementId: "settle", outcome: "completed" as const };
    const settled = await h.api().settleExpeditionRun(request); const wallet = h.reload().wallet;
    const replay = await h.api(h.reload()).settleExpeditionRun(request);
    expect(replay.granted).toEqual(settled.granted); expect(h.reload().wallet).toEqual(wallet);
    expect(h.reload().expedition.run).toBeNull(); expect(h.reload().expedition.playsToday).toBe(1);
  });

  it("보스 미도달·미제출 런의 정상 완료 요청은 진행 상태를 보존하며 거절한다", async () => {
    const h = harness(); new ExpeditionManager(h.state, h.saves, h.now).start(h.state.party);
    const run = h.state.expedition.run!; const boss = run.nodes.find(({ type }) => type === "boss")!; const before = structuredClone(run);
    await expect(h.api().submitExpeditionBossScore({ requestId: "early-score", runId: run.runId, nodeId: boss.id, actions: [] })).rejects.toMatchObject({ code: "EXPEDITION_SCORE_REJECTED" });
    await expect(h.api().settleExpeditionRun({ runId: run.runId, settlementId: "early", outcome: "completed" })).rejects.toMatchObject({ code: "EXPEDITION_SCORE_REJECTED" });
    expect(h.state.expedition.run).toEqual(before);
  });

  it("두 주의 미수령 순위 보상을 저장하고 각각 우편으로 한 번만 받는다", async () => {
    const h = harness(); h.state.expedition = { ...h.state.expedition, weekKey: "2026-09-21", dayKey: "2026-09-27", bestScore: 100, bestAchievedAt: "2026-09-27T12:00:00Z" };
    const next = rollExpeditionPeriods(h.state.expedition, NOW);
    h.state.expedition = { ...next, bestScore: 200, bestAchievedAt: NOW.toISOString() }; h.clock(new Date("2026-10-05T12:00:00Z"));
    const mails = await h.api().getMails(); const ids = mails.mails.filter(({ id }) => id.startsWith("expedition-rank:")).map(({ id }) => id);
    expect(ids).toHaveLength(2); h.saves.save(h.state);
    const reloaded = h.reload(); const api = h.api(reloaded); await api.claimMailRewards({ requestId: "week-one", mailIds: [ids[0]] });
    expect((await api.getMails()).claimableCount).toBeGreaterThan(0);
    const after = h.reload(); await h.api(after).claimMailRewards({ requestId: "week-two", mailIds: [ids[1]] });
    expect(h.reload().expedition.pendingRankReward).toBeNull(); expect(h.reload().expedition.pendingRankRewards).toEqual([]);
    const wallet = h.reload().wallet; await h.api(h.reload()).claimMailRewards({ requestId: "different-request", mailIds: ids });
    expect(h.reload().wallet).toEqual(wallet);
  });

  it("v49의 복제된 전체 lots 행을 수량 증가 없이 하나의 스택으로 복구한다", () => {
    const h = harness(); tonicLots(h.state); h.saves.save(h.state);
    const data = JSON.parse(h.storage.value!); data.saveVersion = 49;
    const stack = data.itemInventory[0]; data.itemInventory = [{ ...stack, quantity: 1 }, { ...stack, quantity: 2 }];
    h.storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(data)); const restored = h.reload();
    expect(restored.itemInventory).toHaveLength(1); expect(restored.itemInventory[0].quantity).toBe(3);
    expect(restored.itemInventory[0].lots).toHaveLength(2); h.saves.save(restored);
  });
});
