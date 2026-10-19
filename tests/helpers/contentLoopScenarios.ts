import { OPENING_TRAIN } from "../../src/data/dialogues/openingTrain";
import assert from 'node:assert/strict';
import { handleGameCall, GameCallError } from '../../src/server/gameHandler';
import { createDefaultSession, createInitialRelicProgress } from '../../src/state/session';
import { saveManager } from '../../src/state/SaveManager';
import { STAGES } from '../../src/data/stages';
import { STAGE_STORY_LINKS } from '../../src/data/stageStories';
import { combatState } from '../../src/core/combatProtocol';
import { bossBattleRandom } from '../../src/core/bossSimulation';
import { canFireUltimate, fireUltimate, stepSkirmish } from '../../src/core/skirmish';
import { createRemoteGameApi } from '../../src/api/RemoteGameApi';
import { createSkirmish } from '../../src/core/skirmish';
import { getRelic } from '../../src/data/relics';
import { createRaidSkirmishConfig, createExpeditionBossSkirmishConfig } from '../../src/core/expeditionBattle';
import { raidBossDef, raidBossGrowth, raidBossPercentHpBasis } from '../../src/core/raid';
import { battleArena } from '../../src/core/battleArena';
import { expeditionBossGrowth, getExpeditionNodeEnemies } from '../../src/data/expeditionEnemies';
import { partyRuneTraitEffects } from '../../src/core/runeTraitEffects';
import { normalizePlayerLevel, PLAYER_LEVEL_CAP } from '../../src/core/playerLevel';
import { ExpeditionClient, ExpeditionBossSettlementFlow } from '../../src/managers/ExpeditionManager';
import { createSupabaseStore } from '../../src/server/supabaseStore';
export async function run(sql: (query: string) => string) {
    const player = '00000000-0000-0000-0000-000000000010';
    const q = (value: unknown) => value === null ? 'null' : `'${String(typeof value === 'string' ? value : JSON.stringify(value)).replaceAll("'", "''")}'`;
    sql(`insert into auth.users(id) values('${player}');insert into public.players(id) values('${player}') on conflict do nothing;`);
    const state = createDefaultSession();
    state.completedStoryIds.add(OPENING_TRAIN.id);
    state.party = ['rex', 'mette', 'torika'];
    state.wallet.stamina = 1000;
    state.playerResearch = normalizePlayerLevel({ level: PLAYER_LEVEL_CAP });
    for (const id of state.party) {
        state.owned.add(id);
        state.relicProgress[id] = { ...createInitialRelicProgress(), level: 30, breakthrough: 2 };
    }
    for (const s of STAGES)
        if (s.id !== '3-10')
            state.cleared.add(s.id);
    for (const link of Object.values(STAGE_STORY_LINKS))
        for (const id of [link.pre, link.post])
            if (id)
                state.completedStoryIds.add(id);
    const data = saveManager.exportData(state);
    sql(`select public.server_commit_state('${player}',null,${q(data)}::jsonb,'${'a'.repeat(64)}',${data.saveVersion},'{}','seed-fixture',null,'{}');`);
    // 실제 RPC 인자·결과와 JSONB 정규화를 거치고 HTTP 전송만 대체한다.
    const store = createSupabaseStore({ url: 'https://isolated.invalid', serviceKey: 'isolated-test-only', fetchImpl: async (url, init) => {
            const method = String(url).split('/').at(-1)!;
            const args = JSON.parse(String(init?.body));
            try {
                const result = sql(`select public.${method}(${Object.entries(args).map(([key, value]) => `${key} => ${q(value)}`).join(',')});`);
                return new Response(result || 'null', { status: 200 });
            }
            catch (error) {
                throw error;
            }
        } });
    let now = new Date('2026-10-20T00:00:00Z'), sequence = 0;
    let lostMethod = '';
    const faults = new Set<string>(), lostMethods = new Set<string>();
    const transport: typeof fetch = async (_url, init) => {
        const req = JSON.parse(String(init?.body));
        try {
            const result = await handleGameCall(player, req, { store, strict: true, now: () => now });
            if ((req.method === lostMethod || req.method === 'settleExpeditionRun') && !faults.has(req.requestId)) {
                faults.add(req.requestId);
                lostMethods.add(req.method);
                throw Error('lost committed reply');
            }
            return new Response(JSON.stringify(result));
        }
        catch (error) {
            if (error instanceof GameCallError)
                return new Response(JSON.stringify({ ok: false, code: error.code, message: error.message, domainCode: error.domainCode }), { status: error.status });
            throw error;
        }
    };
    const remote = () => createRemoteGameApi({ getAccessToken: async () => 'isolated-test-token', applyState: next => Object.assign(state, next), fetchImpl: transport, newRequestId: () => `content-request-${++sequence}` });
    let api = remote();
    await api.enterStage({ stageId: '3-10', requestId: 'entry-stage-3-10' });
    const lease = (await api.prepareCombat({ input: { mode: 'stage' }, stageId: '3-10' }))!;
    assert(lease);
    const battle = combatState(lease), random = bossBattleRandom(lease.seed), actions: {
        tick: number;
        actorId: string;
    }[] = [];
    let ticks = 0, frame = 0, remainder = 0;
    while (battle.phase === 'fight' && frame++ < 20000) {
        remainder += (frame % 13 === 0 ? 200 : 17) * 2;
        while (remainder >= 20 && battle.phase === 'fight') {
            stepSkirmish(battle, .02, random);
            ticks++;
            remainder -= 20;
        }
        for (const actor of battle.fighters.filter(f => f.side === 'player' && f.summonOwnerId === null))
            if (canFireUltimate(battle, actor)) {
                const energy = actor.energy, events = fireUltimate(battle, actor.id, random);
                if (events.length || actor.energy < energy)
                    actions.push({ tick: ticks, actorId: actor.id });
            }
    }
    assert.equal(battle.phase, 'victory', 'level-30 reported party must clear fixture');
    now = new Date(now.getTime() + 600000);
    const proof = { id: lease.id, ticks, actions };
    lostMethod = 'finishCombat';
    const verdict = await api.finishCombat(proof);
    assert(verdict?.victory);
    lostMethod = 'completeStage';
    const clear = await api.completeStage('3-10', true);
    assert(clear.firstClear);
    assert(state.cleared.has('3-10'));
    api = remote();
    await api.getPlayerState();
    assert(state.cleared.has('3-10'));
    // 다음 검사 계정의 성장만 격리 DB에 준비한다. 실제 컨텐츠 진행은 전부 원격 API를 쓴다.
    for (const id of state.party)
        Object.assign(state.relicProgress[id], { level: 60, breakthrough: 4 });
    const stored = await store.load(player);
    await store.commit({ playerId: player, expectedRevision: stored!.revision, data: saveManager.exportData(state), method: 'seed-growth', requestId: null, response: {} });
    api = remote();
    await api.getPlayerState();
    const stageChecks = [];
    for (const stageId of ['1-2', '1-10', '2-10', '3-10', '4-10']) {
        await api.enterStage({ stageId, requestId: `entry-${stageId}-loop` });
        const issued = (await api.prepareCombat({ input: { mode: 'stage' }, stageId }))!;
        const fight = combatState(issued), rng = bossBattleRandom(issued.seed), log = [];
        let count = 0;
        while (fight.phase === 'fight' && count < 18000) {
            for (const actor of fight.fighters.filter(f => f.side === 'player' && f.summonOwnerId === null))
                if (canFireUltimate(fight, actor)) {
                    const energy = actor.energy, events = fireUltimate(fight, actor.id, rng);
                    if (events.length || actor.energy < energy)
                        log.push({ tick: count, actorId: actor.id });
                }
            if (fight.phase !== 'fight')
                break;
            stepSkirmish(fight, .02, rng);
            count++;
        }
        assert.equal(fight.phase, 'victory', stageId);
        now = new Date(now.getTime() + 600000);
        await api.finishCombat({ id: issued.id, ticks: count, actions: log });
        await api.completeStage(stageId, true);
        api = remote();
        await api.getPlayerState();
        assert(state.cleared.has(stageId));
        stageChecks.push({ stageId, persisted: true });
    }
    // 보스 화면과 같은 20ms 누적 틱/자동 궁극기 입력을 만들어 실제 제출한다.
    function bossFight(battle: ReturnType<typeof createSkirmish>, identity: string) {
        const rng = bossBattleRandom(identity), log = [];
        let frame = 0, remainder = 0;
        while (battle.phase === 'fight' && frame++ < 20000) {
            remainder += (frame % 13 === 0 ? 200 : 17) * 2;
            while (remainder >= 20 && battle.phase === 'fight') {
                stepSkirmish(battle, .02, rng);
                remainder -= 20;
            }
            for (const actor of battle.fighters.filter(f => f.side === 'player' && f.summonOwnerId === null))
                if (canFireUltimate(battle, actor)) {
                    const energy = actor.energy, events = fireUltimate(battle, actor.id, rng);
                    if (events.length || actor.energy < energy)
                        log.push({ elapsedMs: Math.round(battle.elapsed * 1000), actorId: actor.def.id, kind: 'ultimate' as const });
                }
        }
        assert.notEqual(battle.phase, 'fight');
        return log;
    }
    const raid = (await api.getRaids()).raids.find(r => r.kind === 'world' && r.status === 'active')!;
    assert(raid);
    const admission = await api.enterRaid({ raidId: raid.id, requestId: 'loop-raid-entry', replayVersion: 2 });
    const roster = admission.relics!;
    const players = roster.map(r => ({ ...getRelic(r.relicId), stats: r.snapshot.stats }));
    const bonds = Object.fromEntries(roster.map(r => [r.relicId, r.snapshot.bondLevel]));
    const breakthroughs = Object.fromEntries(roster.map(r => [r.relicId, r.snapshot.breakthrough]));
    const traits = partyRuneTraitEffects(roster.map(r => ({ relicId: r.relicId, runes: r.snapshot.runes })));
    const base = getRelic(admission.raid.bossRelicId);
    const config = createRaidSkirmishConfig(players, raidBossDef(base, admission.raid.difficulty), raidBossPercentHpBasis(base, admission.raid.difficulty), admission.raid.remainingHp);
    const raidBattle = createSkirmish(config.playerDefs, config.enemyDefs, battleArena('raid'), bonds, breakthroughs, { ...config, augmentEffects: [...config.augmentEffects, ...traits], enemyBreakthroughs: [raidBossGrowth(admission.raid.difficulty).breakthrough] });
    const raidActions = bossFight(raidBattle, admission.replaySeed!);
    now = new Date(now.getTime() + 600000);
    lostMethod = 'submitRaidDamage';
    const raidScore = await api.submitRaidDamage({ raidId: raid.id, requestId: admission.requestId, replayVersion: 2, actions: raidActions });
    assert.equal(raidScore.runDamage, Math.round(raidBattle.boss!.score));
    assert(raidScore.runDamage > 0);
    api = remote();
    const loadedRaid = (await api.getRaids()).raids.find(r => r.id === raid.id)!;
    assert.equal(loadedRaid.myDamage, raidScore.raid.myDamage);
    now = new Date(Date.parse(raid.endsAt) + 1000);
    lostMethod = 'settleRaid';
    await api.settleRaid({ raidId: raid.id, requestId: 'loop-raid-settle' });
    api = remote();
    assert(!(await api.getRaids()).raids.some(r => r.id === raid.id));
    assert.equal(sql(`select settled from public.server_raid_members where raid_id=${q(raid.id)} and player_id='${player}'`), 't');
    console.log(JSON.stringify({ phase: 'raid', damage: raidScore.runDamage, persisted: true, settled: true }));
    // 원정은 개발 바로가기 없이 1층부터 20층까지 저장하며 돈다.
    const start = await api.startExpeditionRun({ relicIds: state.party });
    assert(start.ok);
    let nodes = 0;
    for (let floor = 1; floor <= 20; floor++) {
        const run = state.expedition.run!;
        assert(run);
        const previous = run.nodes.find(n => n.id === run.currentNodeId);
        const next = run.nodes.filter(n => previous ? previous.successorIds.includes(n.id) : n.floor === 1).sort((a, b) => (a.type === 'rest' ? -1 : 0) - (b.type === 'rest' ? -1 : 0))[0];
        assert(next);
        if (next.type === 'rest') {
            assert((await api.completeExpeditionRest({ nodeId: next.id })).ok);
        }
        else if (next.type === 'boss') {
            const ids = (await api.prepareExpeditionBoss({ nodeId: next.id })).ids!;
            assert(ids);
            const live = state.expedition.run!;
            const allies = live.relics.filter(r => r.alive && r.currentHp > 0).map(r => ({ ...getRelic(r.relicId), stats: r.snapshot!.stats }));
            const input = { mode: 'expeditionBoss' as const, floor: 20 as const, runId: live.runId, nodeId: next.id, relics: live.relics, augments: live.selectedAugments, ...ids };
            const cfg = createExpeditionBossSkirmishConfig(input, allies, getExpeditionNodeEnemies('boss', 20));
            const effects = partyRuneTraitEffects(live.relics.map(r => ({ relicId: r.relicId, runes: r.snapshot!.runes })));
            const fight = createSkirmish(cfg.playerDefs, cfg.enemyDefs, battleArena('expeditionBoss'), Object.fromEntries(live.relics.map(r => [r.relicId, r.snapshot!.bondLevel])), Object.fromEntries(live.relics.map(r => [r.relicId, r.snapshot!.breakthrough])), { ...cfg, augmentEffects: [...cfg.augmentEffects, ...effects], enemyBreakthroughs: [expeditionBossGrowth().breakthrough] });
            const bossActions = bossFight(fight, JSON.stringify([live.runId, next.id]));
            now = new Date(now.getTime() + 600000);
            lostMethod = 'submitExpeditionBossScore';
            const flow = new ExpeditionBossSettlementFlow(api, new ExpeditionClient(state, api, () => now));
            const result = await flow.finish(input, bossActions);
            assert(result.score.runScore > 0);
            assert.equal(result.score.endedAtMs, Math.round(fight.elapsed * 1000));
            const best = state.expedition.bestScore;
            assert(best >= result.score.runScore);
            api = remote();
            const persisted = await api.getExpeditionWeeklyBest();
            assert.equal(persisted.bestScore, best);
            console.log(JSON.stringify({ phase: 'expedition', completed: true, floors: floor, score: result.score.runScore, bestPersisted: best, activeRun: !!state.expedition.run }));
        }
        else {
            // 보물/전투 노드는 같은 증강 선택 계약을 먼저 마친다.
            await api.beginExpeditionAugment({ nodeId: next.id });
            while (state.expedition.run?.pendingAugmentReward) {
                const offer = state.expedition.run.pendingAugmentReward.offers[0];
                assert((await api.chooseExpeditionAugment({ selection: { augmentId: offer.augmentId, ...(offer.eligibleTargetRelicIds.length ? { targetRelicId: offer.eligibleTargetRelicIds[0] } : {}) } })).ok);
            }
            let relicHp = state.expedition.run!.relics.map(r => r.currentHp);
            if (next.type !== 'treasure') {
                const input = { mode: 'expedition' as const, runId: run.runId, nodeId: next.id, nodeType: next.type, floor: next.floor, relics: run.relics, augments: run.selectedAugments };
                const issued = (await api.prepareCombat({ input }))!;
                assert(issued);
                const fight = combatState(issued), rng = bossBattleRandom(issued.seed), actions = [];
                let count = 0;
                while (fight.phase === 'fight' && count < 18000) {
                    for (const actor of fight.fighters.filter(f => f.side === 'player' && f.summonOwnerId === null))
                        if (canFireUltimate(fight, actor)) {
                            const energy = actor.energy, events = fireUltimate(fight, actor.id, rng);
                            if (events.length || actor.energy < energy)
                                actions.push({ tick: count, actorId: actor.id });
                        }
                    if (fight.phase !== 'fight')
                        break;
                    stepSkirmish(fight, .02, rng);
                    count++;
                }
                assert.equal(fight.phase, 'victory', `expedition floor ${floor}`);
                now = new Date(now.getTime() + 600000);
                const verdict = (await api.finishCombat({ id: issued.id, ticks: count, actions }))!;
                relicHp = verdict.relicHp;
            }
            await api.completeExpeditionNode({ requestId: `loop-node-${next.id}`, runId: run.runId, nodeId: next.id, relicHp });
        }
        nodes++;
    }
    assert.equal(nodes, 20);
    console.log(JSON.stringify({ passed: true, scope: 'production strict handler + RemoteGameApi + full migration PostgreSQL RPC', reportedStage: { stage: '3-10', party: state.party, level: 30, speed: 2, ticks, actions: actions.length, clearPersisted: true }, stageChecks, raid: { damage: raidScore.runDamage, scorePersisted: true, settled: true }, replyLostAndRecovered: [...lostMethods] }));
}
