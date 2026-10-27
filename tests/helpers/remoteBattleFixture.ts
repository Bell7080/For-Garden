import { ExpeditionManager } from "../../src/managers/ExpeditionManager";
import { SaveManager } from "../../src/state/SaveManager";
import { worldRaidDefinitions, type SharedRaidRecord } from "../../src/server/sharedRaids";
import { OPENING_TRAIN } from "../../src/data/dialogues/openingTrain";
import { createCompletedTutorialState } from '../../src/core/tutorial';
import { createDefaultSession, createInitialRelicProgress, type Session } from '../../src/state/session';
import { saveManager } from '../../src/state/SaveManager';
import { handleGameCall, GameCallError, type StateStore, StateConflictError } from '../../src/server/gameHandler';
import { STAGES } from '../../src/data/stages';
import { STAGE_STORY_LINKS } from '../../src/data/stageStories';
import { normalizePlayerLevel, PLAYER_LEVEL_CAP } from '../../src/core/playerLevel';
export function createFixture(mode: "stage" | "duel" | "raid" | "expedition" = "stage", prepare?: (state: Session) => void) {
    const state = createDefaultSession();
    // 일반 전투 검사는 이름을 등록한 계정이다. 첫 이름 등록 검사는 prepare에서 명시적으로 비운다.
    state.playerCard.nickname = "테스트연구원";
    state.completedStoryIds.add(OPENING_TRAIN.id);
    state.party = ['rex', 'mette', 'torika'];
    state.selectedStageId = '3-10';
    state.wallet.stamina = 500;
    state.tutorial = createCompletedTutorialState();
    state.playerResearch = normalizePlayerLevel({ level: PLAYER_LEVEL_CAP });
    state.settings.game.autoUltimate = true;
    state.settings.game.battleSpeed = 2;
    // 종료/저장 경계 검사는 실제 연출 스킵 설정을 쓴다. 전투 규칙과 기록은 그대로다.
    state.settings.game.skipUltimatePresentation = true;
    for (const id of state.party) {
        state.owned.add(id);
        state.relicProgress[id] = { ...createInitialRelicProgress(), level: 30, breakthrough: 2 };
    }
    for (const stage of STAGES)
        if (stage.id !== '3-10')
            state.cleared.add(stage.id);
    for (const link of Object.values(STAGE_STORY_LINKS))
        for (const id of [link.pre, link.post])
            if (id)
                state.completedStoryIds.add(id);
    if (mode === "expedition") {
        const saves = new SaveManager({ getItem: () => null, setItem: () => {}, removeItem: () => {} });
        new ExpeditionManager(state, saves, () => new Date(), true).prepareDevelopmentBossShortcut(state.party);
        state.expedition.run!.normalNodeScoreTotal = 25000;
        state.expedition.run!.pendingRewards.gold = 300;
    }
    prepare?.(state);
    let stored = { revision: '1', data: JSON.parse(JSON.stringify(saveManager.exportData(state))) };
    const receipts = new Map<string, unknown>();
    const calls: {
        method: string;
        status: number;
        message?: string;
    }[] = [];
    const defender = createDefaultSession();
    defender.playerResearch = normalizePlayerLevel({ level: 6 });
    let defenderRevision = "1";
    const raidRecords: SharedRaidRecord[] = worldRaidDefinitions(new Date()).map(instance => ({instance,revision:"1",damage:0,entries:[]}));
    const store: StateStore = {
        ...(mode === "raid" ? {raidContext: async () => ({playerId:"isolated-browser-player", records: structuredClone(raidRecords)})} : {}),
        ...(mode === "duel" ? { duelContext: async () => ({ playerId: "isolated-browser-player", rank: 1, ranking: [], changes: [], records: [{ id: "actual-guest-defender", revision: defenderRevision, data: saveManager.exportData(defender) as unknown as Record<string, unknown> }] }) } : {}), load: async () => structuredClone(stored), findReceipt: async (_id, key) => receipts.get(key), commit: async (input) => {
            if (input.expectedRevision !== stored.revision)
                throw new StateConflictError();
            for (const change of input.duels ?? []) {
                if (change.expectedRevision !== defenderRevision) throw new StateConflictError();
                defender.duel = change.duel; defender.wallet.gems += change.gems; defenderRevision = String(Number(defenderRevision) + 1);
            }
            for (const change of input.raids ?? []) {
                const record = raidRecords.find(row => row.instance.id === change.instance.id);
                if (!record || record.revision !== change.expectedRevision) throw new StateConflictError();
                record.instance = structuredClone(change.instance);record.damage += change.appliedDelta;record.revision=String(Number(record.revision)+1);
                record.entries = change.instance.myDamage > 0 ? [{rank:1,playerId:"isolated-browser-player",displayName:"연구원",damage:change.instance.myDamage,isMe:true}] : [];
            }
            stored = { revision: String(Number(stored.revision) + 1), data: JSON.parse(JSON.stringify(input.data)) };
            if (input.requestId)
                receipts.set(input.requestId, { ...input.response as object, revision: stored.revision });
            return { revision: stored.revision };
        } };
    let failOnceMethod = "";
    let failuresLeft = 0;
    let lostReplyMethod = "";
    return { failNext(method: string, count = 1) { failOnceMethod = method; failuresLeft = count; }, loseNextReply(method: string) { lostReplyMethod = method; }, async call(request: Parameters<typeof handleGameCall>[1]) {
            try {
                if (request.method === failOnceMethod && failuresLeft-- > 0) { throw new GameCallError(503, 'injected_unavailable'); }
                const body = await handleGameCall('isolated-browser-player', request, { store, strict: true });
                if (request.method === lostReplyMethod) { lostReplyMethod = ''; throw new GameCallError(504, 'injected_lost_committed_reply'); }
                calls.push({ method: request.method, status: 200 });
                console.log("[browser server]", request.method, 200);
                return { status: 200, body };
            }
            catch (error) {
                if (!(error instanceof GameCallError))
                    throw error;
                calls.push({ method: request.method, status: error.status, message: error.message });
                console.log("[browser server]", request.method, error.status, error.message);
                return { status: error.status, body: { ok: false, code: error.code, domainCode: error.domainCode, message: error.message } };
            }
        }, state: () => saveManager.parse(stored.data), defense: () => defender.duel, calls };
}
