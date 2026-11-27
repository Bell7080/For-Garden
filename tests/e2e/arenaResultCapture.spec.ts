import { test, expect as baseExpect } from '@playwright/test';
import { installGameHandleProbe } from './gameDiagnostics';
import { startAfterOpening } from './openingSave';
import { tap, captureGame } from './canvasInput';
const expect = baseExpect.configure({ timeout: 30000 });

/**
 * 아레나·친선전 결과 화면 캡처 — 친선전(미리보기 → 편성), 결과 팝업(랭크 승·패, 친선), 아레나 로비의 지난 판 알림.
 * 화면을 눈으로 대조하기 위한 캡처 전용이다(Vite test 소스 모드에서만).
 */
test('아레나 결과 팝업 · 친선전 흐름 캡처', async ({ page }, info) => {
  test.skip(process.env.PF_E2E_REMOTE_LOOP !== '1', 'Vite test source mode only');
  test.setTimeout(600000);
  const errors: string[] = [];
  page.on('pageerror', (e) => { errors.push(e.message); console.error(e.stack); });
  const me = 'browser-arena';
  const standing = { score: 1080, wins: 3, losses: 2, winStreak: 0, bestStreak: 2, bestScore: 1120, nextStreakBonus: 0, rank: 42, weekEndsAt: new Date(Date.now() + 3 * 86400000).toISOString(), serverTime: new Date().toISOString(), lastWeek: null };
  await page.route('**/api/game', async (route) => {
    const body = route.request().postDataJSON();
    if (!String(body.method).startsWith('arena.')) { await route.continue(); return; }
    const kind = body.args[0].kind;
    if (kind === 'practicePreview') {
      const units = [{ relicId: 'torika', level: 24, breakthrough: 1, power: 4120 }, { relicId: 'dodi', level: 22, breakthrough: 1, power: 3870 }, { relicId: 'parua', level: 25, breakthrough: 2, power: 4410 }];
      await route.fulfill({ json: { ok: true, result: { units, totalPower: units.reduce((s, u) => s + u.power, 0) } } }); return;
    }
    if (kind === 'ranking') { await route.fulfill({ json: { ok: true, result: { entries: [], me: null, ...standing } } }); return; }
    await route.fulfill({ json: { ok: true, result: { playerId: me, room: null, incoming: [], records: [], ...standing } } });
  });
  await installGameHandleProbe(page); await startAfterOpening(page);
  const friend = await page.evaluate(async () => { const root = '/src/'; const m = await import(/* @vite-ignore */root + 'api/FakeSocialServer.ts'); const f = (await m.socialApi.getFriends()).friends[0]; return { id: f.id as string }; });
  await page.evaluate(async () => { const root = '/src/'; const m = await import(/* @vite-ignore */root + 'api/arenaApi.ts'); m.installArenaApi(async () => 'browser-token'); });
  const cdp = await page.context().newCDPSession(page);
  const fn = await cdp.send('Runtime.evaluate', { expression: "window.__PF_AUDIT_LISTENERS__.find(e=>e.canvas===document.querySelector('canvas')).listener" });
  const props = await cdp.send('Runtime.getProperties', { objectId: fn.result.objectId! });
  const bound = props.internalProperties!.find((p) => p.name === '[[BoundThis]]')!.value!.objectId!;
  await cdp.send('Runtime.callFunctionOn', { objectId: bound, functionDeclaration: `function(){window.__ARENA_GAME=this.game;this.game.scene.stop('title');this.game.scene.start('friends',{arenaFriendId:${JSON.stringify(friend.id)}});}` });
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe('friends');
  await expect.poll(() => page.evaluate(() => (window.__PF_DEBUG?.popupTitles ?? []).length)).toBeGreaterThan(0);
  await page.waitForTimeout(1200);
  const { ARENA_FRIEND_MENU: M } = await import('../../src/ui/arenaFriendLayout');
  const height = M.pad.top + M.pad.bottom + M.entry.height * 2 + M.gap;
  await tap(page, 540, 960 - height / 2 + M.pad.top + M.entry.height / 2);
  await expect.poll(() => page.evaluate(() => (window.__PF_DEBUG?.popupTitles ?? []).join('|'))).toContain('친선전 상대');
  await page.waitForTimeout(2500);
  await captureGame(page, info.outputPath('01-friendly-preview.png'));
  const sortieY = await page.evaluate(async () => { const root = '/src/'; const m = await import(/* @vite-ignore */root + 'ui/DuelDefensePreviewPopup.ts'); return m.duelDefensePreviewLayout().sortieY as number; });
  await tap(page, 540, 960 + sortieY);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe('party');
  await page.waitForTimeout(3500);
  await captureGame(page, info.outputPath('02-friendly-party.png'));

  // 결과 팝업 셋 — 같은 화면 위에 하나씩 연다.
  const open = async (name: string, options: string): Promise<void> => {
    await page.evaluate(async (opts) => {
      const root = '/src/';
      const R = await import(/* @vite-ignore */root + 'ui/ArenaResultPopup.ts');
      const P = await import(/* @vite-ignore */root + 'ui/PopupLayer.ts');
      const g = (window as any).__ARENA_GAME; const scene = g.scene.getScene('party');
      const o = JSON.parse(opts);
      (window as any).__resultPopups = new P.PopupLayer(scene, 2400);
      R.openArenaResultPopup(scene, (window as any).__resultPopups, { ...o, me: R.arenaResultMe(o.me), onClose: () => undefined, onContribution: () => undefined });
    }, options);
    await page.waitForTimeout(8000);
    await captureGame(page, info.outputPath(name));
    await page.evaluate(() => (window as any).__resultPopups.closeAll?.());
    await page.waitForTimeout(800);
  };
  const foe = { name: '라이벌', picks: ['spina', 'mette', 'stella'] };
  await open('03-ranked-win.png', JSON.stringify({ outcome: 'win', ranked: true, reason: 'combat', me: ['torika', 'dodi', 'parua'], foe, mvpRelicId: 'dodi', standing: { before: 1080, after: 1112, streakBonus: 4, winStreak: 3 } }));
  await open('04-ranked-loss-forfeit.png', JSON.stringify({ outcome: 'loss', ranked: true, reason: 'timeout', me: ['torika', 'dodi', 'parua'], foe, standing: { before: 1112, after: 1090, streakBonus: 0, winStreak: 0 } }));
  await open('05-friendly-win.png', JSON.stringify({ outcome: 'win', ranked: false, reason: 'combat', me: ['torika', 'dodi', 'parua'], foe, mvpRelicId: 'parua', onRematch: true }));

  // 로비의 지난 판 알림 — 기기에 남은 전적보다 패가 하나 늘었다.
  await page.evaluate(async (s) => {
    const root = '/src/';
    const S = await import(/* @vite-ignore */root + 'managers/SettingsManager.ts');
    const { session } = await import(/* @vite-ignore */root + 'state/session.ts');
    if (!session.playerCard.uid) session.playerCard.uid = 'capture-uid';
    S.settingsManager.rememberArenaSeen({ owner: session.playerCard.uid, score: s.score + 22, wins: s.wins, losses: s.losses - 1 });
    (window as any).__ARENA_GAME.scene.getScene('party').scene.start('arena');
  }, standing);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe('arena');
  await page.waitForTimeout(4000);
  await captureGame(page, info.outputPath('06-lobby-loss-notice.png'));
  expect(errors).toEqual([]);
});
