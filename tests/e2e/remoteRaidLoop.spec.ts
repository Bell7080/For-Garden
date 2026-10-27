import { expect, test } from '@playwright/test';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { installGameHandleProbe } from './gameDiagnostics';
import { startAfterOpening } from './openingSave';
import { captureGame, tap } from './canvasInput';
// 이 검사는 Vite source 모듈을 이용해 원격 구현만 주입하므로 명시적 dev-test 서버에서 실행한다.
test('레이드 출격 → 편성 → 실제 전투 → 서버 점수 저장 → 레이드 복귀', async ({ page }, info) => {
    test.skip(process.env.PF_E2E_REMOTE_LOOP !== '1', 'PF_E2E_REMOTE_LOOP=1과 vite --mode test 서버 전용');
    test.setTimeout(420000);
    const dir = await mkdtemp(join(tmpdir(), 'fg-browser-server-'));
    let fixture: ReturnType<typeof import('../helpers/remoteBattleFixture').createFixture> | undefined;
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
        const file = join(dir, 'fixture.mjs');
        await build({ entryPoints: ['tests/helpers/remoteBattleFixture.ts'], outfile: file, bundle: true, platform: 'node', format: 'esm', define: { 'import.meta.env': '{}', 'import.meta.env.MODE': '"production"', 'import.meta.env.DEV': 'false', 'import.meta.env.PROD': 'true' } });
        fixture = (await import(pathToFileURL(file).href)).createFixture("raid");
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
            const raid=(await api.getRaids()).raids.find((raid:any)=>raid.kind==='world'&&raid.status==='active');(window as any).__RAID_ID=raid.id;
        });
        const cdp = await page.context().newCDPSession(page);
        const listener = await cdp.send('Runtime.evaluate', { expression: "window.__PF_AUDIT_LISTENERS__.find(e=>e.canvas===document.querySelector('canvas')).listener" });
        const props = await cdp.send('Runtime.getProperties', { objectId: listener.result.objectId! });
        const bound = props.internalProperties!.find(p => p.name === '[[BoundThis]]')!.value!.objectId!;
        await cdp.send('Runtime.callFunctionOn', { objectId: bound, functionDeclaration: "function(){ this.game.scene.stop('title'); this.game.scene.start('raid',{raidId:window.__RAID_ID}); window.__RAID_GAME=this.game; }" });
        await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene), { timeout: 90000 }).toBe('raid');
        const click = async (scene:string,label:string) => {
            const locate=()=>page.evaluate(({scene,label})=>{const found:any[]=[];const walk=(v:any)=>{if(v.type==='Text'&&v.text===label&&v.parentContainer?.parentContainer?.labelText===v&&v.parentContainer.parentContainer.bg?.input?.enabled){const b=v.getBounds();found.push({x:b.centerX,y:b.centerY});}for(const c of v.list??[])walk(c);};walk({list:(window as any).__RAID_GAME.scene.getScene(scene).children.list});return found.at(-1);},{scene,label});
            await expect.poll(locate,{timeout:30000}).toBeTruthy();const p=await locate();await tap(page,p.x,p.y);
        };
        await click('raid','출격');
        await expect.poll(()=>page.evaluate(()=>window.__PF_DEBUG?.scene)).toBe('party');
        await click('party','전투 시작');
        await expect.poll(()=>page.evaluate(()=>window.__PF_DEBUG?.scene)).toBe('battle');
        await expect.poll(async () => {
            const state = await page.evaluate(() => ({ scene: window.__PF_DEBUG?.scene, battle: window.__PF_DEBUG?.battle, popups: window.__PF_DEBUG?.popupTitles }));
            console.log('[browser loop]', JSON.stringify(state));
            // 실제 컷인 건너뛰기 탭이다. 전투/서버 시간이나 피해 기록은 변경하지 않는다.
            if (state.battle?.ultimateSequenceActive)
                await tap(page, 540, 300);
            return server.calls.filter(c => c.method === 'submitRaidDamage').length;
        }, { timeout: 250000, intervals: [10000] }).toBeGreaterThan(0);
        await info.attach('server-calls', { body: JSON.stringify(server.calls, null, 2), contentType: 'application/json' });
        expect(server.calls.filter((c: {
            status: number;
        }) => c.status !== 200)).toEqual([]);
        const damage=server.state().raid.instances.find(r=>r.myDamage>0)?.myDamage;
        expect(damage).toBeGreaterThan(0);
        await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.rewardPopup), { timeout: 30000 }).toBe(true);
        await captureGame(page, info.outputPath('raid-confirmed-result.png'));
        await tap(page,540,250);
        await expect.poll(()=>page.evaluate(()=>window.__PF_DEBUG?.scene),{timeout:45000}).toBe('raid');
        expect(server.state().raid.instances.find(r=>r.myDamage>0)?.myDamage).toBe(damage);
        expect(errors).toEqual([]);
    }
    finally {
        await info.attach('browser-errors', { body: JSON.stringify(errors), contentType: 'application/json' });
        if (fixture)
            await info.attach('terminal-server-state', { body: JSON.stringify({ calls: fixture.calls, cleared: fixture.state().cleared.has('3-10'), errors }, null, 2), contentType: 'application/json' });
        await rm(dir, { recursive: true, force: true });
    }
});
