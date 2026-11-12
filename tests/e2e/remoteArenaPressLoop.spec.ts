import { test, expect as baseExpect } from '@playwright/test';
import { installGameHandleProbe } from './gameDiagnostics';
import { startAfterOpening } from './openingSave';
import { tap, captureGame } from './canvasInput';
const expect = baseExpect.configure({ timeout: 30000 });

/**
 * 아레나 밴픽 — 2초 조회가 묻는 중에 확정을 눌러도 그 한 번이 버려지지 않는다. 조회 응답을 일부러 늦춰 두고
 * 조회를 걸어 놓은 채 확정을 누른다(예전에는 조회와 행동이 같은 `busy`를 써서 누른 손이 그대로 사라졌다).
 * 확정 버튼·되돌리기·고른 칸의 빛이 겹치지 않는지 밴/배치 두 장면을 캡처로 남긴다.
 */
test('아레나 밴픽 확정은 조회 중에도 한 번에 들어간다', async ({ page }, info) => {
  test.skip(process.env.PF_E2E_REMOTE_LOOP !== '1', 'Vite test source mode only');
  test.setTimeout(420000);
  const { createDefaultSession, createInitialRelicProgress } = await import('../../src/state/session');
  const { saveManager } = await import('../../src/state/SaveManager');
  const { arenaPlayer } = await import('../../src/server/liveArena');
  const { applyArenaAction, publicArenaRoom } = await import('../../src/core/liveArena');
  const { ARENA_ROOM_LAYOUT: L } = await import('../../src/ui/arenaRoomLayout');
  const errors: string[] = [], actions: string[] = [];
  page.on('pageerror', (e) => { errors.push(e.message); console.error(e.stack); });
  const me = 'browser-arena', foe = 'browser-foe';
  let room!: import('../../src/core/liveArena').ArenaRoom;
  let slowStatus = false;
  await page.route('**/api/game', async (route) => {
    const body = route.request().postDataJSON();
    if (!String(body.method).startsWith('arena.')) { await route.continue(); return; }
    const input = body.args[0], kind = input.kind;
    if (kind === 'action') { actions.push(input.action.kind); room = applyArenaAction(room, me, input.action, Date.now()); room.version++; }
    else if (slowStatus) await new Promise((r) => setTimeout(r, 2500));
    await route.fulfill({ json: { ok: true, result: { playerId: me, score: 1000, wins: 0, losses: 0, room: publicArenaRoom(room, me), incoming: [] } } });
  });
  await installGameHandleProbe(page); await startAfterOpening(page);
  const { PLAYABLE_RELICS } = await import('../../src/data/relics');
  const own = createDefaultSession();
  // 격자가 두 줄을 넘도록 넉넉히 갖춘다 — 스크롤하는 격자 위에서 고르는 손을 함께 본다.
  for (const def of PLAYABLE_RELICS.slice(0, 12)) { own.owned.add(def.id); own.relicProgress[def.id] ??= createInitialRelicProgress(); }
  const players = [arenaPlayer(me, saveManager.exportData(own)), arenaPlayer(foe, saveManager.exportData(own))];
  players[1].name = '상대 연구원';
  const ids = players[0].roster.map((u) => u.def.id);
  room = { id: 'browser-press', version: 1, ranked: true, rules: { ban: true, order: 'random', placement: 'hidden', unique: true }, players, phase: 'ban', first: 0, bans: [null, null], picks: [[], []], locked: [false, false], deadline: Date.now() + 600000, seed: 'seed' };
  await page.evaluate(async () => { const root = '/src/'; const m = await import(/* @vite-ignore */root + 'api/arenaApi.ts'); m.installArenaApi(async () => 'browser-token'); });
  const cdp = await page.context().newCDPSession(page);
  const fn = await cdp.send('Runtime.evaluate', { expression: "window.__PF_AUDIT_LISTENERS__.find(e=>e.canvas===document.querySelector('canvas')).listener" });
  const props = await cdp.send('Runtime.getProperties', { objectId: fn.result.objectId! });
  const bound = props.internalProperties!.find((p) => p.name === '[[BoundThis]]')!.value!.objectId!;
  await cdp.send('Runtime.callFunctionOn', { objectId: bound, functionDeclaration: `function(){window.__ARENA_GAME=this.game;this.game.scene.stop('title');this.game.scene.start('arenaRoom',{roomId:'browser-press'});}` });
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe('arenaRoom');
  const scene = (expr: string): Promise<unknown> => page.evaluate((e) => { const s = (window as any).__ARENA_GAME.scene.getScene('arenaRoom'); return new Function('s', `return ${e}`)(s); }, expr);
  await expect.poll(() => scene('s.status?.room?.phase')).toBe('ban');

  // 밴: 카드를 고르고, 조회를 늦춰 걸어 둔 채 확정.
  await scene(`s.tapCard(${JSON.stringify(ids[0])})`);
  await page.waitForTimeout(600);
  await captureGame(page, info.outputPath('arena-ban.png'));
  slowStatus = true;
  await scene('void s.fetchStatus()');
  await expect.poll(() => scene('s.busy')).toBe(true);
  await tap(page, L.banConfirm.x, L.banConfirm.y);
  await expect.poll(() => actions.length).toBe(1);
  expect(actions[0]).toBe('ban');

  // 상대도 밴을 마쳐 배치로 넘어간다 — 한 칸을 둔 뒤 되돌리기·확정·고른 칸이 함께 서는 장면.
  slowStatus = false;
  room = applyArenaAction(room, foe, { kind: 'ban', relicId: ids[1] }, Date.now());
  const open = ids.filter((id) => id !== ids[0] && id !== ids[1]);
  // 한 칸은 미리 둔다 — 되돌리기가 서야 확정과의 간격을 함께 본다. 느린 컨테이너에서 시간이 다하지 않게 기한을 늘린다.
  room = applyArenaAction(room, me, { kind: 'place', relicId: open[2], slot: 0 }, Date.now());
  room.deadline = Date.now() + 600000; room.version++;
  // GPU 없는 컨테이너는 1초에 한 프레임이라 씬 시계의 2초 조회가 거의 돌지 않는다 — 실시간 신호 대신 직접 조회를 건다.
  await expect.poll(async () => { await scene('void s.fetchStatus()'); return scene('s.status?.room?.phase'); }, { timeout: 60000 }).toBe('place');
  await expect.poll(() => scene('s.revealing'), { timeout: 60000 }).toBe(false);
  await scene(`s.tapCard(${JSON.stringify(open[0])})`);
  await page.waitForTimeout(800);
  await captureGame(page, info.outputPath('arena-place.png'));
  slowStatus = true;
  await scene('void s.fetchStatus()');
  await expect.poll(() => scene('s.busy')).toBe(true);
  await tap(page, L.confirm.x, L.confirm.y);
  await expect.poll(() => actions.length).toBe(2);
  expect(actions[1]).toBe('place');
  slowStatus = false;
  expect(errors).toEqual([]);
});
