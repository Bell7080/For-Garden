import { describe, expect, it } from "vitest";
import { FakeServer } from "../../src/api/FakeServer";
import { createDefaultSession } from "../../src/state/session";
import { SaveManager } from "../../src/state/SaveManager";
import { ExpeditionManager } from "../../src/managers/ExpeditionManager";
import { WALLET_CAPS } from "../../src/data/economy";
import { RAID_DIFFICULTY } from "../../src/data/raid";
import { mockSummonRaidDamage, raidBossDef, raidBossGrowth, raidBossPercentHpBasis } from "../../src/core/raid";
import { BOSS_STEP_MS, bossBattleRandom } from "../../src/core/bossSimulation";
import { getRelic } from "../../src/data/relics";
import { battleArena } from "../../src/core/battleArena";
import { createExpeditionBossSkirmishConfig, createRaidSkirmishConfig } from "../../src/core/expeditionBattle";
import { createSkirmish, stepSkirmish } from "../../src/core/skirmish";
import { expeditionBossGrowth, getExpeditionNodeEnemies } from "../../src/data/expeditionEnemies";
import { expeditionBossDamageScore } from "../../src/core/expeditionScore";
import { EXPEDITION_BEST_SCORE_REWARD_STAGES } from "../../src/data/expedition";

const start = Date.parse("2026-10-15T00:00:00Z");
function setup(id = "audit-raid", time = start + 12 * 3600000) {
  const state = createDefaultSession(); state.party = ["rex", "luka", "torika"]; state.party.forEach((id) => state.owned.add(id));
  state.wallet.stamina = 60; state.staminaUpdatedAt = new Date(time).toISOString();
  state.raid.instances = [{ id, kind: "summon", difficulty: "easy", bossRelicId: "sukusuino", openedAt: new Date(start).toISOString(), endsAt: new Date(start + 86400000).toISOString(), summonedByMe: true, myDamage: 0, attemptsUsed: 0, settled: false }];
  let clock = time; let saved: string | null = null; let fail = false;
  const saves = new SaveManager({ getItem: () => saved, setItem: (_key, value) => { if (fail) throw new Error("disk full"); saved = value; }, removeItem: () => { saved = null; } });
  const api = (target = state) => new FakeServer(target, { latencyMs: 0, now: () => new Date(clock), persistSession: (next) => saves.save(next) });
  return { state, api, saves, clock: (time: number) => { clock = time; }, fail: (value: boolean) => { fail = value; } };
}
const basics = ["rex", "luka", "torika"].map((actorId) => ({ actorId, elapsedMs: 0, kind: "basic" as const }));

describe("레이드·원정 정산의 실제 지급량과 재접속", () => {
  it("지갑 상한·제출 재시도·재접속에서 점수와 순위는 유지하고 골드는 중복 지급하지 않는다", async () => {
    const h = setup(); h.state.wallet.gold = WALLET_CAPS.gold - 1;
    await h.api().enterRaid({ raidId: "audit-raid", requestId: "entry" });
    const result = await h.api().submitRaidDamage({ raidId: "audit-raid", requestId: "entry", actions: basics });
    expect(result.runDamage).toBeGreaterThan(0); expect(result.granted.some(({ currency }) => currency === "gold")).toBe(false);
    const loaded = h.saves.load()!;
    const retry = await h.api(loaded).submitRaidDamage({ raidId: "audit-raid", requestId: "entry", actions: basics });
    expect(retry.granted).toEqual(result.granted); expect(retry.runDamage).toBe(result.runDamage);
    expect(retry.raid.entries).toEqual(result.raid.entries); expect(retry.raid.entries.some(({ isMe }) => isMe)).toBe(true);
    expect(loaded.wallet.gold).toBe(WALLET_CAPS.gold - 1);
  });
  it("최종 토벌 보상은 상한 적용 후 증가분이며 재접속 재시도에도 순위를 복원한다", async () => {
    const h = setup(); h.state.raid.instances[0].myDamage = 10000; h.state.wallet.raidSigil = WALLET_CAPS.raidSigil;
    h.clock(start + 86400001);
    const result = await h.api().settleRaid({ raidId: "audit-raid", requestId: "settle" });
    expect(result.granted.map((r) => r.currency)).toEqual(["gems"]); expect(result.raid.settled).toBe(true);
    const retry = await h.api(h.saves.load()!).settleRaid({ raidId: "audit-raid", requestId: "settle" });
    expect(retry.granted.map((r) => r.currency)).toEqual(["gems"]); expect(retry.raid.entries).toEqual(result.raid.entries);
  });
  it("같은 입장·로그는 다른 참가자 처치 직전과 직후에 같은 개인 점수를 받는다", async () => {
    const total = RAID_DIFFICULTY.easy.totalHp;
    const id = Array.from({ length: 100 }, (_, i) => `audit-cross-${i}`).find((id) => mockSummonRaidDamage(id, 1, total) >= total)!;
    expect(id).toBeDefined();
    let lo = start; let hi = start + 86400000;
    while (lo < hi) { const mid = Math.floor((lo + hi) / 2); if (mockSummonRaidDamage(id, (mid - start) / 86400000, total) >= total) hi = mid; else lo = mid + 1; }
    // QA damage curves let another participant kill precisely between these two submissions.
    expect(lo).toBeLessThan(start + 86400000);
    const before = setup(id, lo - 60000); const after = setup(id, lo - 60000);
    await before.api().enterRaid({ raidId: id, requestId: "same-entry" }); await after.api().enterRaid({ raidId: id, requestId: "same-entry" });
    before.clock(lo - 1); after.clock(lo);
    const a = await before.api().submitRaidDamage({ raidId: id, requestId: "same-entry", actions: basics });
    const b = await after.api().submitRaidDamage({ raidId: id, requestId: "same-entry", actions: basics });
    expect(a.runDamage).toBeGreaterThan(0); expect(a.runDamage).toBe(b.runDamage); expect(a.granted).toEqual(b.granted);
    expect(a.raid.dealtDamage).toBeLessThanOrEqual(total); expect(b.raid.remainingHp).toBe(0);
    expect(after.state.raid.instances[0].appliedDamage).toBe(0);
  });
  it("신규 입장은 확정 재현을 사용하고 프로토콜을 바꾸는 제출을 거절한다", async () => {
    const h = setup(); const api = h.api();
    const admission = await api.enterRaid({ raidId: "audit-raid", requestId: "fixed", replayVersion: 2 });
    expect(admission.replayVersion).toBe(2);
    const players = admission.relics!.map(({ relicId, snapshot }) => ({ ...getRelic(relicId), stats: snapshot.stats }));
    const boss = raidBossDef(getRelic(admission.raid.bossRelicId), admission.raid.difficulty);
    const config = createRaidSkirmishConfig(players, boss, raidBossPercentHpBasis(getRelic(admission.raid.bossRelicId), admission.raid.difficulty), admission.raid.remainingHp);
    const state = createSkirmish(players, [boss], battleArena("raid"), Object.fromEntries(admission.relics!.map(({ relicId, snapshot }) => [relicId, snapshot.bondLevel])), Object.fromEntries(admission.relics!.map(({ relicId, snapshot }) => [relicId, snapshot.breakthrough])), { ...config, enemyBreakthroughs: [raidBossGrowth(admission.raid.difficulty).breakthrough] });
    const random = bossBattleRandom("fixed");
    while (state.phase === "fight") stepSkirmish(state, BOSS_STEP_MS / 1000, random);
    await expect(api.submitRaidDamage({ raidId: "audit-raid", requestId: "fixed", actions: basics })).rejects.toMatchObject({ code: "RAID_SCORE_REJECTED" });
    const result = await api.submitRaidDamage({ raidId: "audit-raid", requestId: "fixed", actions: [], replayVersion: 2 });
    expect(result.runDamage).toBe(Math.round(state.boss!.score)); expect(result.endedAtMs).toBe(Math.round(state.elapsed * 1000));
  });
  it("저장 실패한 제출은 피해와 보상을 적용하지 않고 같은 입장으로 재시도한다", async () => {
    const h = setup(); await h.api().enterRaid({ raidId: "audit-raid", requestId: "entry" });
    const gold = h.state.wallet.gold; h.fail(true);
    await expect(h.api().submitRaidDamage({ raidId: "audit-raid", requestId: "entry", actions: basics })).rejects.toMatchObject({ code: "PERSISTENCE_FAILED" });
    expect(h.state.wallet.gold).toBe(gold); expect(h.state.raid.instances[0].myDamage).toBe(0);
    expect(h.state.serverJournal!.raidAdmissions.entry).toBeDefined();
    h.fail(false); expect((await h.api().submitRaidDamage({ raidId: "audit-raid", requestId: "entry", actions: basics })).runDamage).toBeGreaterThan(0);
  });
  it("원정 최고점 보상도 지갑 증가분만 표기하며 다른 단계의 요청 ID 재사용을 막는다", async () => {
    const h = setup(); const stages = EXPEDITION_BEST_SCORE_REWARD_STAGES;
    new ExpeditionManager(h.state, h.saves, () => new Date(start), true).prepareDevelopmentBossShortcut(h.state.party);
    // Roll the period before setting the earned score.
    await h.api().getExpeditionLeaderboard(); h.state.expedition.bestScore = stages[0].threshold;
    const reward = stages[0].reward; h.state.wallet[reward.currency] = WALLET_CAPS[reward.currency] - 1;
    const result = await h.api().claimExpeditionReward({ requestId: "reward", stageId: stages[0].id });
    expect(result.reward.amount).toBe(1);
    const loaded = h.saves.load()!; const api = h.api(loaded);
    expect((await api.claimExpeditionReward({ requestId: "reward", stageId: stages[0].id })).reward.amount).toBe(1);
    expect((await api.claimExpeditionReward({ requestId: "another", stageId: stages[0].id })).reward.amount).toBe(0);
    await expect(api.claimExpeditionReward({ requestId: "reward", stageId: stages[1].id })).rejects.toMatchObject({ code: "INVALID_STATE" });
  });
  it("원정의 일부 사망 편성과 잔여 HP도 화면과 API 확정 점수·시간이 일치한다", async () => {
    const h = setup(); const manager = new ExpeditionManager(h.state, h.saves, () => new Date(start + 12 * 3600000), true);
    manager.prepareDevelopmentBossShortcut(h.state.party);
    const run = h.state.expedition.run!; const node = run.nodes.find(({ type }) => type === "boss")!;
    run.relics[0].alive = false; run.relics[0].currentHp = 0; run.relics[1].currentHp = 60;
    run.normalNodeScoreTotal = 25000;
    const requests = manager.prepareBossRequests(node.id)!;
    const players = run.relics.filter(({ alive }) => alive).map(({ relicId, snapshot }) => ({ ...getRelic(relicId), stats: snapshot!.stats }));
    const boss = getExpeditionNodeEnemies("boss", 20)[0];
    const config = createExpeditionBossSkirmishConfig({ mode: "expeditionBoss", runId: run.runId, nodeId: node.id, floor: 20, relics: run.relics, augments: run.selectedAugments, ...requests }, players, [boss]);
    const state = createSkirmish(config.playerDefs, config.enemyDefs, battleArena("expeditionBoss"), Object.fromEntries(run.relics.map(({ relicId, snapshot }) => [relicId, snapshot!.bondLevel])), Object.fromEntries(run.relics.map(({ relicId, snapshot }) => [relicId, snapshot!.breakthrough])), { ...config, enemyBreakthroughs: [expeditionBossGrowth().breakthrough] });
    const random = bossBattleRandom(JSON.stringify([run.runId, node.id]));
    while (state.phase === "fight") stepSkirmish(state, BOSS_STEP_MS / 1000, random);
    const result = await h.api().submitExpeditionBossScore({ ...requests, runId: run.runId, nodeId: node.id, actions: [] });
    expect(result.bossDamageScore).toBe(expeditionBossDamageScore(Math.round(state.boss!.score)));
    expect(result.runScore).toBe(25000 + expeditionBossDamageScore(Math.round(state.boss!.score)));
    expect(result.verifiedDamage).toBe(Math.round(Object.values(state.contributions).slice(0, players.length).reduce((sum, value) => sum + value.attack.attackPower + value.attack.abilityPower, 0)));
    expect(result.endedAtMs).toBe(Math.round(state.elapsed * 1000));
  });
  it("원정 소탕도 저장 실패·재접속에서 같은 요청이 하루 횟수와 보상을 두 번 쓰지 않는다", async () => {
    const h = setup(); await h.api().getExpeditionLeaderboard();
    h.state.expedition.allTimeBestScore = 50000; h.state.wallet.gold = WALLET_CAPS.gold - 1;
    h.fail(true);
    await expect(h.api().sweepExpedition({ requestId: "sweep" })).rejects.toMatchObject({ code: "PERSISTENCE_FAILED" });
    expect(h.state.expedition.playsToday).toBe(0);
    h.fail(false); const first = await h.api().sweepExpedition({ requestId: "sweep" });
    expect(first.granted.gold).toBe(1); expect(h.state.expedition.playsToday).toBe(1);
    const loaded = h.saves.load()!;
    const second = await h.api(loaded).sweepExpedition({ requestId: "sweep" });
    expect(second.granted).toEqual(first.granted); expect(loaded.expedition.playsToday).toBe(1);
    expect(loaded.wallet).toEqual(h.state.wallet);
  });

});
