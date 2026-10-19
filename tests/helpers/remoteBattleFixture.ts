import { OPENING_TRAIN } from "../../src/data/dialogues/openingTrain";
import { createCompletedTutorialState } from '../../src/core/tutorial';
import { createDefaultSession, createInitialRelicProgress } from '../../src/state/session';
import { saveManager } from '../../src/state/SaveManager';
import { handleGameCall, GameCallError, type StateStore, StateConflictError } from '../../src/server/gameHandler';
import { STAGES } from '../../src/data/stages';
import { STAGE_STORY_LINKS } from '../../src/data/stageStories';
import { normalizePlayerLevel, PLAYER_LEVEL_CAP } from '../../src/core/playerLevel';
export function createFixture() {
    const state = createDefaultSession();
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
    let stored = { revision: '1', data: JSON.parse(JSON.stringify(saveManager.exportData(state))) };
    const receipts = new Map<string, unknown>();
    const calls: {
        method: string;
        status: number;
        message?: string;
    }[] = [];
    const store: StateStore = { load: async () => structuredClone(stored), findReceipt: async (_id, key) => receipts.get(key), commit: async (input) => {
            if (input.expectedRevision !== stored.revision)
                throw new StateConflictError();
            stored = { revision: String(Number(stored.revision) + 1), data: JSON.parse(JSON.stringify(input.data)) };
            if (input.requestId)
                receipts.set(input.requestId, { ...input.response as object, revision: stored.revision });
            return { revision: stored.revision };
        } };
    return { async call(request: Parameters<typeof handleGameCall>[1]) {
            try {
                const body = await handleGameCall('isolated-browser-player', request, { store, strict: true });
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
        }, state: () => saveManager.parse(stored.data), calls };
}
