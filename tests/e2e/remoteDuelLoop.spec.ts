import { saveManager } from "../../src/state/SaveManager";
import { expect, test } from '@playwright/test';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { installGameHandleProbe } from './gameDiagnostics';
import { E2E_SAVE_STORAGE_KEY, startAfterOpening } from './openingSave';
import { captureGame, tap } from './canvasInput';
// 이 검사는 Vite source 모듈을 이용해 원격 구현만 주입하므로 명시적 dev-test 서버에서 실행한다.
test('실제 게스트 방어덱 PvP → 서버 검증 → 양쪽 기록 → 결투장 복귀', async ({ page }, info) => {
    test.skip(process.env.PF_E2E_REMOTE_LOOP !== '1', 'PF_E2E_REMOTE_LOOP=1과 vite --mode test 서버 전용');
    test.setTimeout(420000);
    const dir = await mkdtemp(join(tmpdir(), 'fg-browser-server-'));
    let fixture: ReturnType<typeof import('../helpers/remoteBattleFixture').createFixture> | undefined;
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
        const file = join(dir, 'fixture.mjs');
        await build({ entryPoints: ['tests/helpers/remoteBattleFixture.ts'], outfile: file, bundle: true, platform: 'node', format: 'esm', define: { 'import.meta.env': '{}', 'import.meta.env.MODE': '"production"', 'import.meta.env.DEV': 'false', 'import.meta.env.PROD': 'true' } });
        fixture = (await import(pathToFileURL(file).href)).createFixture("duel");
        const server = fixture!;
        await page.exposeFunction('__PF_REMOTE_CALL', server.call);
        await installGameHandleProbe(page);
        await startAfterOpening(page);
        await page.evaluate(async () => {
            const root = '/src/';
            const [apiModule, remoteModule, stateModule, savesModule, progressModule] = await Promise.all([
                import(/* @vite-ignore */ root + 'api/FakeServer.ts'), import(/* @vite-ignore */ root + 'api/RemoteGameApi.ts'), import(/* @vite-ignore */ root + 'state/session.ts'), import(/* @vite-ignore */ root + 'state/SaveManager.ts'), import(/* @vite-ignore */ root + 'api/serverProgress.ts'),
            ]);
            const api = remoteModule.createRemoteGameApi({ getAccessToken: async () => 'isolated-browser-token', applyState: (next: unknown) => progressModule.applyServerState(stateModule.session, next, savesModule.saveManager), fetchImpl: async (_url: unknown, init: RequestInit) => {
                    const response = await (window as unknown as {
                        __PF_REMOTE_CALL: (input: unknown) => Promise<{
                            body: unknown;
                            status: number;
                        }>;
                    }).__PF_REMOTE_CALL(JSON.parse(String(init.body)));
                    return new Response(JSON.stringify(response.body), { status: response.status });
                } });
            apiModule.installGameApi(api);
            await api.getPlayerState();
            const status = await api.getDuelStatus();
            if (status.opponents.length !== 1 || status.opponents[0].score !== 0) throw new Error("real zero-score opponent missing");
            const relicIds = ['rex', 'mette', 'torika'];
            const entry = await api.enterDuel({ requestId: 'browser-real-duel', opponentId: status.opponents[0].id, relicIds });
            (window as any).__PF_DUEL_INPUT = { mode: 'duel', requestId: entry.requestId, attack: relicIds, opponentName: entry.opponentName, opponentScore: entry.opponentScore, units: entry.units };
        });
        const cdp = await page.context().newCDPSession(page);
        const listener = await cdp.send('Runtime.evaluate', { expression: "window.__PF_AUDIT_LISTENERS__.find(e=>e.canvas===document.querySelector('canvas')).listener" });
        const props = await cdp.send('Runtime.getProperties', { objectId: listener.result.objectId! });
        const bound = props.internalProperties!.find(p => p.name === '[[BoundThis]]')!.value!.objectId!;
        await cdp.send('Runtime.callFunctionOn', { objectId: bound, functionDeclaration: "function(){ this.game.scene.stop('title'); this.game.scene.start('battle',window.__PF_DUEL_INPUT); window.__PVP_GAME=this.game; }" });
        await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene), { timeout: 90000 }).toBe('battle');
        await expect.poll(()=>page.evaluate(()=>(window as any).__PVP_GAME.scene.getScene('battle').spawned),{timeout:90000}).toBe(true);
        // 소프트웨어 GPU의 그리기 지연을 제외하되 실제 Phaser 시계와 씬 update는 유지한다.
        await page.evaluate(()=>{const game=(window as any).__PVP_GAME;game.__RENDER_CALLBACK=game.loop.callback;game.loop.callback=game.headlessStep.bind(game);});
        await expect.poll(async () => {
            const state = await page.evaluate(() => ({ scene: window.__PF_DEBUG?.scene, battle: window.__PF_DEBUG?.battle, popups: window.__PF_DEBUG?.popupTitles }));
            console.log('[browser loop]', JSON.stringify(state));
            // 실제 컷인 건너뛰기 탭이다. 전투/서버 시간이나 피해 기록은 변경하지 않는다.
            if (state.battle?.ultimateSequenceActive)
                await tap(page, 540, 300);
            return server.calls.filter(c => c.method === 'resolveDuel').length;
        }, { timeout: 250000, intervals: [10000] }).toBeGreaterThan(0);
        const automatic=await page.evaluate(()=>{
          const game=(window as any).__PVP_GAME;game.loop.callback=game.__RENDER_CALLBACK;
          const scene=game.scene.getScene('battle');return {enabled:scene.state.automaticUltimates,manualActions:scene.combatActions.length};
        });
        expect(automatic).toEqual({enabled:true,manualActions:0});
        await info.attach('server-calls', { body: JSON.stringify(server.calls, null, 2), contentType: 'application/json' });
        expect(server.calls.filter((c: {
            status: number;
        }) => c.status !== 200)).toEqual([]);
        expect(server.state().duel!.wins + server.state().duel!.losses).toBe(1);
        expect(server.defense()!.history[0].side).toBe('defense');
        await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.rewardPopup), { timeout: 30000 }).toBe(true);
        await captureGame(page, info.outputPath('pvp-confirmed-result.png'));
        await tap(page, 540, 250);
        await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene), { timeout: 45000 }).toBe('duel');
        await page.reload();
        await page.waitForFunction(() => window.__PF_DEBUG?.ready === true);
        const reloadedSave = await page.evaluate(key => localStorage.getItem(key), E2E_SAVE_STORAGE_KEY);
        expect(saveManager.parse(JSON.parse(reloadedSave!)).duel!.wins + saveManager.parse(JSON.parse(reloadedSave!)).duel!.losses).toBe(1);
        expect(server.state().duel!.wins + server.state().duel!.losses).toBe(1);
        expect(server.defense()!.history[0].side).toBe('defense');
    }
    finally {
        await info.attach('browser-errors', { body: JSON.stringify(errors), contentType: 'application/json' });
        if (fixture)
            await info.attach('terminal-server-state', { body: JSON.stringify({ calls: fixture.calls, duel: fixture.state().duel, defense: fixture.defense(), errors }, null, 2), contentType: 'application/json' });
        await rm(dir, { recursive: true, force: true });
    }
});
