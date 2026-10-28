import { test, expect as baseExpect } from '@playwright/test';
import { installGameHandleProbe } from './gameDiagnostics';
import { startAfterOpening } from './openingSave';
import { tap, captureGame } from './canvasInput';
// GPU 없는 컨테이너에서는 캔버스 한 장 그리는 데도 수 초가 든다 — 폴링 한도를 넉넉히 둔다.
const expect = baseExpect.configure({ timeout: 30000 });

/**
 * 친선 아레나 — 요청을 보내 놓고 기다리는 판에서 「요청 취소」를 누르면 랭크 아레나가 아니라 친구 화면의
 * 친선전 선택판으로 돌아간다. 대기 판의 글자가 가운데 마스코트 연출 뒤로 묻히지 않는지도 캡처로 남긴다.
 */
test('친선 아레나 요청 대기 → 요청 취소 → 친구 화면 친선전 선택판', async ({ page }, info) => {
  test.skip(process.env.PF_E2E_REMOTE_LOOP !== '1', 'Vite test source mode only');
  test.setTimeout(420000);
  const { createDefaultSession } = await import('../../src/state/session');
  const { saveManager } = await import('../../src/state/SaveManager');
  const { arenaPlayer } = await import('../../src/server/liveArena');
  const { applyArenaAction, publicArenaRoom } = await import('../../src/core/liveArena');
  const errors: string[] = [], calls: string[] = [];
  page.on('pageerror', (e) => { errors.push(e.message); console.error(e.stack); });
  const me = 'browser-arena';
  let room!: import('../../src/core/liveArena').ArenaRoom;
  await page.route('**/api/game', async (route) => {
    const body = route.request().postDataJSON();
    if (!String(body.method).startsWith('arena.')) { await route.continue(); return; }
    const input = body.args[0], kind = input.kind; calls.push(kind);
    if (kind === 'action') { room = applyArenaAction(room, me, input.action, Date.now()); room.version++; }
    await route.fulfill({ json: { ok: true, result: { playerId: me, score: 1000, wins: 0, losses: 0, room: publicArenaRoom(room, me), incoming: [] } } });
  });
  await installGameHandleProbe(page); await startAfterOpening(page);
  // 친구 목록의 첫 친구가 상대다 — 돌아왔을 때 그 친구의 선택판이 열려야 한다.
  const friend = await page.evaluate(async () => { const root = '/src/'; const m = await import(/* @vite-ignore */root + 'api/FakeSocialServer.ts'); const f = (await m.socialApi.getFriends()).friends[0]; return { id: f.id as string, displayName: f.displayName as string }; });
  const own = createDefaultSession();
  const players = [arenaPlayer(me, saveManager.exportData(own)), arenaPlayer(friend.id, saveManager.exportData(own))];
  players[1].name = friend.displayName;
  room = { id: 'browser-friendly', version: 1, ranked: false, rules: { ban: true, order: 'random', placement: 'alternate', unique: true }, players, phase: 'invited', first: 0, bans: [null, null], picks: [[], []], locked: [false, false], deadline: Date.now() + 600000, seed: 'seed' };
  await page.evaluate(async () => { const root = '/src/'; const m = await import(/* @vite-ignore */root + 'api/arenaApi.ts'); m.installArenaApi(async () => 'browser-token'); });
  const cdp = await page.context().newCDPSession(page);
  const fn = await cdp.send('Runtime.evaluate', { expression: "window.__PF_AUDIT_LISTENERS__.find(e=>e.canvas===document.querySelector('canvas')).listener" });
  const props = await cdp.send('Runtime.getProperties', { objectId: fn.result.objectId! });
  const bound = props.internalProperties!.find((p) => p.name === '[[BoundThis]]')!.value!.objectId!;
  await cdp.send('Runtime.callFunctionOn', { objectId: bound, functionDeclaration: `function(){window.__ARENA_GAME=this.game;this.game.scene.stop('title');this.game.scene.start('arenaRoom',{roomId:'browser-friendly',friendId:${JSON.stringify(friend.id)}});}` });
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe('arenaRoom');
  await expect.poll(() => page.evaluate(() => { const s = (window as any).__ARENA_GAME.scene.getScene('arenaRoom'); return s.children.list.filter((o: any) => o.name?.startsWith('arena-mascot-') && o.visible).length; }), { timeout: 90000 }).toBe(2);
  await page.waitForTimeout(1200);
  await captureGame(page, info.outputPath('friendly-invite-waiting.png'));
  const { ARENA_ROOM_LAYOUT } = await import('../../src/ui/arenaRoomLayout');
  await tap(page, ARENA_ROOM_LAYOUT.cancel.x, ARENA_ROOM_LAYOUT.cancel.y);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe('friends');
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles?.join('|') ?? '')).toContain(friend.displayName);
  await page.waitForTimeout(800);
  await captureGame(page, info.outputPath('friendly-cancel-return.png'));
  expect(room.phase).toBe('declined');
  expect(calls).toContain('action');
  expect(errors).toEqual([]);
});
