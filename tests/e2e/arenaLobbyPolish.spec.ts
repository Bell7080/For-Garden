import { test, expect as baseExpect } from '@playwright/test';
import { installGameHandleProbe } from './gameDiagnostics';
import { startAfterOpening } from './openingSave';
import { tap, captureGame } from './canvasInput';
const expect = baseExpect.configure({ timeout: 30000 });
test.use({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });

/**
 * 아레나 입구의 「도움말」 쪽지, 매칭 직후의 「나 VS 상대」 연출, 밴 확정 버튼 뒤 발광을 캡처로 남긴다.
 * 서버 대신 아레나 호출을 가로채 순수 규칙(`applyArenaAction`)으로 판을 굴린다.
 */
test('아레나 도움말 → VS 연출 → 밴 확정 발광', async ({ page }, info) => {
  test.skip(process.env.PF_E2E_REMOTE_LOOP !== '1', 'Vite test source mode only');
  test.setTimeout(420000);
  const { createDefaultSession } = await import('../../src/state/session');
  const { saveManager } = await import('../../src/state/SaveManager');
  const { arenaPlayer } = await import('../../src/server/liveArena');
  const { applyArenaAction, publicArenaRoom } = await import('../../src/core/liveArena');
  const errors: string[] = [];
  page.on('pageerror', (e) => { errors.push(e.message); console.error(e.stack); });
  const me = 'browser-arena';
  const own = createDefaultSession();
  const players = [arenaPlayer(me, saveManager.exportData(own)), arenaPlayer('rival', saveManager.exportData(own))];
  players[0].name = '응태 연구원'; players[1].name = '라이벌 연구원';
  let room: import('../../src/core/liveArena').ArenaRoom = { id: 'browser-ranked', version: 1, ranked: true, rules: { ban: true, order: 'random', placement: 'alternate', unique: true }, players, phase: 'ban', first: 0, bans: [null, null], picks: [[], []], locked: [false, false], deadline: Date.now() + 600000, seed: 'seed' };
  await page.route('**/api/game', async (route) => {
    const body = route.request().postDataJSON();
    if (!String(body.method).startsWith('arena.')) { await route.continue(); return; }
    const input = body.args[0] ?? {};
    if (input.kind === 'action') { room = applyArenaAction(room, me, input.action, Date.now()); room.version++; }
    const lobby = !input.roomId && input.kind !== 'action';
    await route.fulfill({ json: { ok: true, result: { playerId: me, score: 1240, wins: 12, losses: 7, winStreak: 2, bestStreak: 4, bestScore: 1300, nextStreakBonus: 2, rank: 31, weekEndsAt: new Date(Date.now() + 3 * 86400000).toISOString(), serverTime: new Date().toISOString(), lastWeek: null, room: lobby ? null : publicArenaRoom(room, me), incoming: [], entries: [] } } });
  });
  await installGameHandleProbe(page); await startAfterOpening(page);
  await page.evaluate(async () => { const root = '/src/'; const m = await import(/* @vite-ignore */root + 'api/arenaApi.ts'); m.installArenaApi(async () => 'browser-token'); });
  const cdp = await page.context().newCDPSession(page);
  const fn = await cdp.send('Runtime.evaluate', { expression: "window.__PF_AUDIT_LISTENERS__.find(e=>e.canvas===document.querySelector('canvas')).listener" });
  const props = await cdp.send('Runtime.getProperties', { objectId: fn.result.objectId! });
  const bound = props.internalProperties!.find((p) => p.name === '[[BoundThis]]')!.value!.objectId!;
  await cdp.send('Runtime.callFunctionOn', { objectId: bound, functionDeclaration: `function(){window.__ARENA_GAME=this.game;this.game.scene.stop('title');this.game.scene.start('arena');}` });
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe('arena');
  await page.waitForTimeout(2500);
  await captureGame(page, info.outputPath('arena-lobby.png'));
  const { ARENA_LOBBY } = await import('../../src/ui/arenaLobbyLayout');
  await tap(page, 540, ARENA_LOBBY.help.y);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles?.length ?? 0)).toBeGreaterThan(0);
  await page.waitForTimeout(900);
  await captureGame(page, info.outputPath('arena-help-popup.png'));

  await cdp.send('Runtime.callFunctionOn', { objectId: bound, functionDeclaration: `function(){this.game.scene.stop('arena');this.game.scene.start('arenaRoom',{roomId:'browser-ranked',intro:true});}` });
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe('arenaRoom');
  for (const [ms, name] of [[250, 'intro-slide'], [450, 'intro-slam'], [500, 'intro-hold'], [420, 'intro-leave']] as const) {
    await page.waitForTimeout(ms);
    await captureGame(page, info.outputPath(`arena-${name}.png`));
  }
  await expect.poll(() => page.evaluate(() => (window as any).__ARENA_GAME.scene.getScene('arenaRoom').children.getByName('arena-match-intro') === null), { timeout: 60000 }).toBe(true);
  await page.waitForTimeout(800);
  const cards = await page.evaluate(() => (window.__PF_DEBUG as any)?.gridCards?.arenaRoom?.cards ?? (window.__PF_DEBUG as any)?.gridCards?.arenaRoom);
  const first = Object.values(cards ?? {})[0] as { x: number; y: number } | undefined;
  expect(first).toBeTruthy();
  await tap(page, first!.x, first!.y);
  await page.waitForTimeout(900);
  await captureGame(page, info.outputPath('arena-ban-glow.png'));
  expect(errors).toEqual([]);
});
