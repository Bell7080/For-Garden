import { t } from "../i18n";
import Phaser from 'phaser';
import { arenaCall, arenaError } from '../api/arenaApi';
import type { ArenaRules } from '../core/liveArena';
import { getRelic } from '../data/relics';
import { playerProfileDisplay, profileAvatarContent } from '../state/playerProfile';
import { session } from '../state/session';
import { POPUP_TITLE_SIZE, type PopupLayer } from './PopupLayer';
import { Button } from './Button';
import { textStyle, COLOR } from './theme';
import { startScene } from './screenTransition';
import { ExpeditionEntryButton } from './ExpeditionEntryButton';
import { addArenaMascots } from './ArenaMascots';
import { ARENA_TONE } from './arenaTheme';
import { chipPoints, drawLayer } from './holo';
import { ProfileAvatar } from './ProfileAvatar';
import { squeezeTextToWidth } from './textFit';
import { drawArenaRuleIcon, type ArenaRuleKind } from './arenaRuleChips';
import { ARENA_FRIEND_MENU as M, ARENA_SETUP as S, arenaSetupLayout } from './arenaFriendLayout';

/** 친선전을 건 상대 — 친구 카드가 넘기는 공개 값만 쓴다. */
export interface ArenaFriendTarget { id: string; name: string; frameId: string; favoriteRelicId: string; level: number }

/**
 * 친선전 선택판 — 결투 선택판(`openPvpMenu`)과 같은 판·같은 원화 입구 두 칸이다. 위는 상대의 방어덱과 곧장
 * 붙는 모의전투(결투장 원화), 아래는 규칙을 정해 보내는 실시간 아레나 요청(보랏빛 원화 + 맞부딪히는 마스코트)이다.
 * 아레나 칸은 곧바로 보내지 않고 「아레나 설정」 창을 연다.
 */
export function openArenaFriendPopup(scene: Phaser.Scene, popups: PopupLayer, friend: ArenaFriendTarget): void {
  let busy = false;
  const height = M.pad.top + M.pad.bottom + M.entry.height * 2 + M.gap;
  const centers = [-height / 2 + M.pad.top + M.entry.height / 2, -height / 2 + M.pad.top + M.entry.height * 1.5 + M.gap];
  popups.open({ width: M.width, height, title: t("arena.friend.title", { p0: friend.name }), titleSize: POPUP_TITLE_SIZE.workboard, dim: true, closeOnBackdrop: true, backButton: true }, (body, close) => {
    const error = scene.add.text(0, height / 2 - M.pad.bottom / 2, '', textStyle({ role: "body", size: 24, color: ARENA_TONE.sparkText, wrap: M.entry.width })).setOrigin(.5);
    body.add(error);
    const practice = async (): Promise<void> => {
      if (busy) return;
      busy = true;
      try {
        const status = await arenaCall('practice', { target: friend.id, rules: { ban: true, order: 'random', placement: 'alternate', unique: true } });
        if (!scene.scene.isActive()) return;
        close();
        startScene(scene, 'arenaRoom', { roomId: status.room!.id });
      } catch (e) {
        if (body.active) error.setText(arenaError(e));
      } finally { busy = false; }
    };
    body.add(new ExpeditionEntryButton(scene, 0, centers[0], {
      width: M.entry.width, height: M.entry.height, label: t("arena.friend.practiceTitle"), labelSize: 50, statusSize: 27, statusWrap: 420,
      status: t("arena.friend.practiceStatus", { name: friend.name }), artKey: "content-duel-entry",
      onClick: () => void practice(),
    }));
    const live = new ExpeditionEntryButton(scene, 0, centers[1], {
      width: M.entry.width, height: M.entry.height, label: t("arena.friend.liveTitle"), labelSize: 50, statusSize: 27, statusWrap: 420,
      status: t("arena.friend.liveStatus"), artKey: "content-duel-entry",
      accentColor: ARENA_TONE.accent, accentTextColor: ARENA_TONE.accentText, artTint: 0xb58cff,
      onClick: () => { close(); openArenaSetupPopup(scene, popups, friend); },
    });
    body.add(live);
    // 결투 선택판의 아레나 칸과 같은 그림 — 렉시아 VS 스피나가 칸 안에서 맞부딪힌다.
    addArenaMascots(scene, body, -235, centers[1] + 118, 205, true, (body.parentContainer?.depth ?? popups.baseDepth) + 1, { mask: live.clipMask, spread: 0.95 });
    // 무료 모의전투라는 표식은 칸 오른쪽 위의 작은 칩이 말한다 — 부제를 길게 늘이지 않는다.
    const tagX = M.entry.width / 2 - M.tag.width / 2 - 28, tagY = centers[0] - M.entry.height / 2 + 34;
    body.add(drawLayer(scene, tagX, tagY, chipPoints(M.tag.width, M.tag.height, { bevel: { topLeft: 12, bottomRight: 12 } }), { fill: 0x0b1a12, alpha: .92, edge: ARENA_TONE.ally, edgeAlpha: .9 }));
    body.add(squeezeTextToWidth(scene.add.text(tagX, tagY, t("arena.friend.free"), textStyle({ role: "emphasis", size: 22, color: ARENA_TONE.allyText })).setOrigin(.5), M.tag.width - 24));
  });
}

/** 줄 하나의 고를 것들. 값은 칩마다 짧은 키이고 규칙으로 옮기는 일은 `set`이 한다. */
interface RuleRow { kind: ArenaRuleKind; title: string; options: { value: string; label: string }[]; get: (r: ArenaRules) => string; set: (r: ArenaRules, v: string) => ArenaRules; desc: (r: ArenaRules) => string; disabled?: (r: ArenaRules) => boolean }

function ruleRows(): RuleRow[] {
  return [
    { kind: 'ban', title: t("arena.setup.ban"), options: [{ value: 'on', label: t("arena.rules.oneEach") }, { value: 'off', label: t("arena.rules.off") }], get: (r) => r.ban ? 'on' : 'off', set: (r, v) => ({ ...r, ban: v === 'on' }), desc: (r) => r.ban ? t("arena.setup.ban.on") : t("arena.setup.ban.off") },
    { kind: 'order', title: t("arena.setup.order"), options: [{ value: 'first', label: t("arena.rules.first") }, { value: 'second', label: t("arena.rules.second") }, { value: 'random', label: t("arena.rules.random") }], get: (r) => r.order, set: (r, v) => ({ ...r, order: v as ArenaRules['order'] }), desc: (r) => ({ first: t("arena.setup.order.first"), second: t("arena.setup.order.second"), random: t("arena.setup.order.random") })[r.order] },
    { kind: 'placement', title: t("arena.setup.placement"), options: [{ value: 'alternate', label: t("arena.setup.placement.alternateShort") }, { value: 'hidden', label: t("arena.setup.placement.hiddenShort") }], get: (r) => r.placement, set: (r, v) => ({ ...r, placement: v as ArenaRules['placement'] }), desc: (r) => r.placement === 'alternate' ? t("arena.setup.placement.alternate") : t("arena.setup.placement.hidden") },
    { kind: 'unique', title: t("arena.setup.unique"), options: [{ value: 'blocked', label: t("arena.rules.duplicatesBlocked") }, { value: 'allowed', label: t("arena.rules.duplicatesAllowed") }], get: (r) => r.unique === false ? 'allowed' : 'blocked', set: (r, v) => ({ ...r, unique: v === 'blocked' }), desc: (r) => r.placement === 'hidden' ? t("arena.setup.unique.hidden") : r.unique === false ? t("arena.setup.unique.allowed") : t("arena.setup.unique.blocked"), disabled: (r) => r.placement === 'hidden' },
  ];
}

/**
 * 아레나 설정 — 실시간 대전 요청의 규칙을 고르는 창.
 *
 * 맨 위는 **나 VS 상대** 대치 띠다: 두 얼굴이 마주 보고 그 사이에서 렉시아·스피나가 맞부딪힌다. 그 아래 규칙
 * 넷이 저마다 그림·이름·지금 고른 것의 풀이와 고를 칩을 가진 줄로 선다 — 누를 때마다 돌던 버튼 넷은 무엇을
 * 고를 수 있는지가 눌러 보기 전엔 보이지 않았다. 칩을 누르면 창을 다시 열지 않고 그 줄들만 다시 칠한다.
 */
export function openArenaSetupPopup(scene: Phaser.Scene, popups: PopupLayer, friend: ArenaFriendTarget, initial: ArenaRules = { ban: true, order: 'random', placement: 'alternate', unique: true }): void {
  let rules = initial, busy = false;
  const rows = ruleRows();
  const layout = arenaSetupLayout(rows.length);
  popups.open({ width: S.width, height: layout.height, title: t("arena.setup.title"), titleSize: POPUP_TITLE_SIZE.workboard, dim: true, backButton: true, onClose: () => { if (!busy) openArenaFriendPopup(scene, popups, friend); } }, (body, close) => {
    paintVersusBanner(scene, popups, body, layout.bannerY, friend);
    const rowLayer = scene.add.container(0, 0);
    body.add(rowLayer);
    const paintRows = (): void => {
      rowLayer.removeAll(true);
      rows.forEach((row, index) => paintRuleRow(scene, rowLayer, layout.rowY[index], row, rules, (value) => { rules = row.set(rules, value); paintRows(); }));
    };
    paintRows();
    const error = scene.add.text(0, layout.errorY, '', textStyle({ role: "body", size: 24, color: ARENA_TONE.sparkText, wrap: S.rowWidth, align: 'center' })).setOrigin(.5);
    body.add(error);
    const send = async (): Promise<void> => {
      if (busy) return;
      busy = true;
      try {
        const status = await arenaCall('invite', { target: friend.id, rules });
        if (!scene.scene.isActive()) return;
        close();
        startScene(scene, 'arenaRoom', { roomId: status.room!.id });
      } catch (e) {
        busy = false;
        if (body.active) error.setText(arenaError(e));
      }
    };
    body.add(new Button(scene, 0, layout.sendY, { width: S.send.width, height: S.send.height, fontSize: 44, label: t("arena.invite.send"), variant: 'primary', fill: ARENA_TONE.confirm, accentColor: ARENA_TONE.accent, accentTextColor: COLOR.ink, decorDots: true, onClick: () => void send() }));
  });
}

/** 나 VS 상대 — 판 위쪽의 대치 띠. 비스듬한 보랏빛·분홍 띠가 두 편을 가르고 가운데에서 마스코트가 부딪힌다. */
function paintVersusBanner(scene: Phaser.Scene, popups: PopupLayer, body: Phaser.GameObjects.Container, y: number, friend: ArenaFriendTarget): void {
  const B = S.banner;
  body.add(drawLayer(scene, 0, y, chipPoints(B.width, B.height, { bevel: { topLeft: 40, bottomRight: 40 } }), { fill: ARENA_TONE.deep, alpha: .96, edge: ARENA_TONE.accent, edgeAlpha: .8, glow: { color: ARENA_TONE.glow, strength: .3, height: .9 } }));
  const stripes = scene.add.graphics();
  [[-1, ARENA_TONE.ally], [1, ARENA_TONE.foe]].forEach(([sign, color]) => {
    stripes.fillStyle(color as number, .16);
    const x0 = (sign as number) * B.width * .18;
    stripes.fillPoints([new Phaser.Geom.Point(x0, y - B.height / 2), new Phaser.Geom.Point(x0 + (sign as number) * B.width * .3, y - B.height / 2), new Phaser.Geom.Point(x0 + (sign as number) * B.width * .3 - 70, y + B.height / 2), new Phaser.Geom.Point(x0 - 70, y + B.height / 2)], true);
  });
  body.add(stripes);
  const mine = playerProfileDisplay(session);
  const side = (sign: -1 | 1, name: string, level: number, avatar: ProfileAvatar, tone: string): void => {
    const x = sign * B.faceX;
    avatar.setPosition(x, y - 28);
    body.add(avatar);
    body.add(squeezeTextToWidth(scene.add.text(x, y + B.height / 2 - 66, name, textStyle({ role: "display", size: 32, color: tone })).setOrigin(.5).setStroke('#05070a', 5), B.nameRoom));
    body.add(scene.add.text(x, y + B.height / 2 - 30, `LV.${level}`, textStyle({ role: "emphasis", size: 22, color: COLOR.inkDim })).setOrigin(.5));
  };
  side(-1, mine.displayName, mine.level, new ProfileAvatar(scene, 0, 0, { size: B.face, frameId: mine.frameId, portraitAssetId: mine.avatar?.portraitAssetId, fallback: profileAvatarContent(mine, () => false).fallback }), ARENA_TONE.allyText);
  const portrait = (() => { try { return getRelic(friend.favoriteRelicId).portraitAssetId; } catch { return undefined; } })();
  side(1, friend.name, friend.level, new ProfileAvatar(scene, 0, 0, { size: B.face, frameId: friend.frameId, portraitAssetId: portrait, fallback: friend.name.slice(0, 1) }), ARENA_TONE.foeText);
  addArenaMascots(scene, body, 0, y + B.height / 2 - B.mascotLift, B.mascot, true, (body.parentContainer?.depth ?? popups.baseDepth) + 1, { spread: .78 });
}

/** 규칙 한 줄: 왼쪽 그림 액자 · 이름과 지금 고른 것의 풀이 · 오른쪽 고를 칩. 쓸 수 없는 줄은 가라앉는다. */
function paintRuleRow(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, y: number, row: RuleRow, rules: ArenaRules, pick: (value: string) => void): void {
  const R = S.row, disabled = row.disabled?.(rules) === true;
  const root = scene.add.container(0, y);
  parent.add(root);
  root.add(drawLayer(scene, 0, 0, chipPoints(S.rowWidth, R.height, { bevel: { topLeft: 26, bottomRight: 26 } }), { fill: 0x160b27, alpha: .92, edge: ARENA_TONE.accent, edgeAlpha: disabled ? .15 : .45 }));
  const iconX = -S.rowWidth / 2 + R.iconPad + R.icon / 2;
  root.add(drawLayer(scene, iconX, 0, chipPoints(R.icon, R.icon, { bevel: { topLeft: 16, bottomRight: 16 } }), { fill: 0x2a1543, alpha: 1, edge: ARENA_TONE.accent, edgeAlpha: .8, glow: { color: ARENA_TONE.glow, strength: .35, height: .9 } }));
  root.add(drawArenaRuleIcon(scene, row.kind, iconX, 0, R.icon * .58, disabled ? COLOR.inkDimHex : 0xe6d6ff));
  const textX = iconX + R.icon / 2 + 24;
  root.add(squeezeTextToWidth(scene.add.text(textX, -32, row.title, textStyle({ role: "display", size: 32, color: COLOR.ink })).setOrigin(0, .5), R.textRoom));
  root.add(scene.add.text(textX, 24, row.desc(rules), textStyle({ role: "body", size: 24, color: disabled ? COLOR.inkDim : ARENA_TONE.accentText, wrap: R.textRoom })).setOrigin(0, .5));
  const current = row.get(rules);
  const count = row.options.length, width = count === 3 ? R.chip3 : R.chip2;
  const right = S.rowWidth / 2 - R.chipPad;
  row.options.forEach((option, index) => {
    const x = right - (count - index - 1) * (width + R.chipGap) - width / 2;
    const selected = option.value === current && !disabled;
    const button = new Button(scene, x, 0, {
      width, height: R.chipHeight, fontSize: 25, label: option.label,
      ...(selected ? { variant: 'primary' as const, fill: ARENA_TONE.confirm, accentColor: ARENA_TONE.accent, accentTextColor: COLOR.ink } : {}),
      onClick: () => { if (!disabled && option.value !== current) pick(option.value); },
    });
    if (disabled) button.setEnabled(false);
    root.add(button);
  });
  if (disabled) root.setAlpha(.55);
}
