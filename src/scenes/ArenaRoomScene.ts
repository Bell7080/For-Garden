import { t } from "../i18n";
import { subscribeArenaChanges } from "../api/arenaRealtime";
import Phaser from 'phaser';
import { arenaCall, arenaError, arenaForfeitOnExit, type ArenaStatus } from '../api/arenaApi';
import { ARENA_HIDDEN_BAN, arenaCanAct, arenaPickable, type ArenaAction, type ArenaRoom, type ArenaUnit } from '../core/liveArena';
import { Button, DESTRUCTIVE_BUTTON_STYLE } from '../ui/Button';
import { PopupLayer } from '../ui/PopupLayer';
import { textStyle, COLOR } from '../ui/theme';
import { addSceneBackground, BACKGROUND } from '../ui/backgrounds';
import { addBackButton } from '../ui/IconButton';
import { playSceneEntrance, startScene } from '../ui/screenTransition';
import { chipPoints, drawLayer, drawVignette, slantedRect } from '../ui/holo';
import { PortraitCard } from '../ui/PortraitCard';
import { formationRosterGrid, PORTRAIT_GRID_MASK_GAP } from '../ui/portraitGrid';
import { addArenaBackdrop, ARENA_TONE } from '../ui/arenaTheme';
import { session } from '../state/session';
import { addClippedHit, clipHit } from '../ui/clippedHit';
import { ARENA_ROOM_LAYOUT } from '../ui/arenaRoomLayout';
import { addArenaMascots } from '../ui/ArenaMascots';
import { addArenaRuleChips } from '../ui/arenaRuleChips';
import { squeezeTextToWidth } from '../ui/textFit';

import type { ClipRect } from '../ui/clipRect';
import { setDebugGridCards, setDebugGridOffset, setDebugScene } from '../debug';
import { onTap } from "../ui/tapGuard";

/**
 * 밴픽 화면의 자리. 위가 상대, 아래가 나, 가운데가 고를 렐릭 격자, 왼쪽 띠가 서로의 밴이다.
 * 스토리 편성(`PartyScene`)과 같은 카드·같은 세 칸을 쓰되 칸이 위아래로 마주 본다.
 */
const FULL_SCREEN: ClipRect = { left: 0, right: 1080, top: 0, bottom: 1920 };


const GRID = formationRosterGrid(ARENA_ROOM_LAYOUT.grid.right - ARENA_ROOM_LAYOUT.grid.left, ARENA_ROOM_LAYOUT.grid.columns);

interface GridCard { card: PortraitCard; banMark: Phaser.GameObjects.Container; dim: Phaser.GameObjects.Container; dimLabel: Phaser.GameObjects.Text }

/**
 * 카드 실루엣 그대로의 덮개 한 장. 네모를 깔면 깎인 두 모서리 밖으로 뿔이 서므로 카드가 그린 칩 모양을
 * 그대로 받는다(`createPortraitAlphaOverlay` — 몸통은 칩 면, 머리는 원화 알파). 카드의 자식이라 함께 움직인다.
 */
function addCardVeil(card: PortraitCard, color: number, alpha: number, width: number, height: number): Phaser.GameObjects.Container {
  const veil = card.createPortraitAlphaOverlay(color, alpha, Math.hypot(width, height));
  card.add(veil.display);
  card.syncMask();
  return veil.display;
}

/** 붉은 덮개 + X. 카드 위에 겹쳐 「밴」을 말한다 — 글자보다 먼저 읽힌다. */
function addBanMark(scene: Phaser.Scene, card: PortraitCard, width: number, height: number): Phaser.GameObjects.Container {
  const root = scene.add.container(0, 0);
  card.add(root);
  root.add(addCardVeil(card, ARENA_TONE.ban, 0.3, width, height));
  root.add(drawBanX(scene, width, height));
  return root;
}

/** 붉은 X 획 두 줄. 덮개는 `addBanMark`가 카드 모양으로 깐다. */
function drawBanX(scene: Phaser.Scene, width: number, height: number): Phaser.GameObjects.Container {
  const root = scene.add.container(0, 0);
  const g = scene.add.graphics();
  const w = width * 0.38, h = height * 0.32, thick = Math.max(10, width * 0.09);
  [[-1, 1], [1, 1]].forEach(([sx]) => {
    g.fillStyle(0x000000, 0.45);
    g.fillPoints([
      new Phaser.Geom.Point(-w * sx - thick / 2 + 4, -h + 6), new Phaser.Geom.Point(-w * sx + thick / 2 + 4, -h + 6),
      new Phaser.Geom.Point(w * sx + thick / 2 + 4, h + 6), new Phaser.Geom.Point(w * sx - thick / 2 + 4, h + 6),
    ], true);
    g.fillStyle(ARENA_TONE.ban, 1);
    g.fillPoints([
      new Phaser.Geom.Point(-w * sx - thick / 2, -h), new Phaser.Geom.Point(-w * sx + thick / 2, -h),
      new Phaser.Geom.Point(w * sx + thick / 2, h), new Phaser.Geom.Point(w * sx - thick / 2, h),
    ], true);
  });
  root.add(g);
  return root;
}

export class ArenaRoomScene extends Phaser.Scene {
  private roomId = '';
  private status?: ArenaStatus;
  private busy = false;
  private transitioning = false;
  private signature = '';
  private clock!: Phaser.GameObjects.Text;
  /** 밴·배치 동안만 서는 작은 기권 버튼(왼쪽 위). */
  private forfeitButton!: Button;
  private error!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private title!: Phaser.GameObjects.Text;
  /** 다시 그리지 않는 칸·격자 밖의 판(제목·이름). 상태가 바뀔 때마다 갈아 끼운다. */
  private frame!: Phaser.GameObjects.Container;
  private slots!: Phaser.GameObjects.Container;
  private banColumn!: Phaser.GameObjects.Container;
  private controls!: Phaser.GameObjects.Container;
  /** 격자는 단계(밴/픽)가 바뀔 때만 새로 세운다 — 고를 때마다 카드를 다시 세우면 원화가 빠졌다 들어온다. */
  private gridKey = '';
  private gridContent?: Phaser.GameObjects.Container;
  private gridMask?: Phaser.GameObjects.Graphics;
  private gridCards = new Map<string, GridCard>();
  private gridScroll = 0;
  private gridMinScroll = 0;
  private dragOrigin = 0;
  private dragging = false;
  private dragged = 0;
  /** 이번 판에서 고르는 중인 렐릭과 칸. 확정을 누르기 전에는 서버에 가지 않는다. */
  private selectedRelic = '';
  private selectedSlot = -1;
  private lastPhase = '';
  private revealing = false;
  /** 밴이 끝난 뒤 한 번 — 밴 칸이 세 칸으로 갈라지는 연출을 다음 칠에서 돌린다. */
  private unfold = false;
  constructor() { super('arenaRoom'); }
  init(input: { roomId: string }): void { this.roomId = input.roomId; }

  create(): void {
    this.status = undefined;
    this.busy = false;
    this.transitioning = false;
    this.signature = '';
    this.gridKey = '';
    this.gridCards = new Map();
    this.gridContent = undefined;
    this.gridScroll = 0;
    this.selectedRelic = '';
    this.selectedSlot = -1;
    this.lastPhase = '';
    this.revealing = false;
    this.unfold = false;
    setDebugScene('arenaRoom');
    addSceneBackground(this, BACKGROUND.sortieDuel);
    addArenaBackdrop(this, -29, .88);
    drawVignette(this, 1080, 1920, { depth: -20, strength: .6 });
    const L = ARENA_ROOM_LAYOUT;
    // 위는 상대, 아래는 나 — 두 진영의 띠를 옅게 깔아 화면이 위아래로 마주 본다.
    this.add.rectangle(540, L.enemyRow, 1080, 330, ARENA_TONE.foe, .06).setDepth(-10);
    this.add.rectangle(540, L.allyRow, 1080, 330, ARENA_TONE.ally, .06).setDepth(-10);
    this.title = this.add.text(540, L.title.y, '', textStyle({ role: "display", size: 46, color: COLOR.ink })).setOrigin(.5).setShadow(0, 5, '#000000', 0, true, true);
    this.add.existing(drawLayer(this, L.clock.x, L.clock.y, chipPoints(170, 84), { fill: ARENA_TONE.panel, alpha: .94, edge: ARENA_TONE.accent, edgeAlpha: .9 }));
    this.clock = this.add.text(L.clock.x, L.clock.y, '', textStyle({ role: "display", size: 44, color: ARENA_TONE.accentText })).setOrigin(.5);
    this.hint = this.add.text(540, L.hint.y, '', textStyle({ role: "emphasis", size: 29, color: COLOR.ink, align: 'center' })).setOrigin(.5).setShadow(0, 3, '#000000', 0, true, true);
    this.frame = this.add.container(0, 0);
    this.slots = this.add.container(0, 0);
    this.banColumn = this.add.container(0, 0);
    this.controls = this.add.container(0, 0).setDepth(5);
    this.error = this.add.text(470, L.error.y, '', textStyle({ role: "body", size: 24, color: ARENA_TONE.sparkText, wrap: 760, align: 'center' })).setOrigin(.5).setDepth(6);
    addBackButton(this, () => this.confirmForfeit());
    this.forfeitButton = new Button(this, L.forfeit.x, L.forfeit.y, { width: L.forfeit.width, height: L.forfeit.height, fontSize: 24, label: t("arena.room.forfeitShort"), ...DESTRUCTIVE_BUTTON_STYLE, onClick: () => this.confirmForfeit() }).setVisible(false);
    this.bindGridScroll();
    const unsubscribe = subscribeArenaChanges(() => void this.fetchStatus());
    // 창을 닫거나 다른 페이지로 떠나면 밴·배치 중인 판은 기권이다. 앱을 잠깐 내린 것은 서버의 침묵 규칙이 맡는다.
    const onExit = (): void => { const r = this.status?.room; if (r && (r.phase === 'ban' || r.phase === 'place')) arenaForfeitOnExit(r.id); };
    window.addEventListener('pagehide', onExit);
    this.events.once('shutdown', () => { unsubscribe(); window.removeEventListener('pagehide', onExit); setDebugGridCards("arenaRoom", undefined); });
    this.time.addEvent({ delay: 2000, loop: true, callback: () => void this.fetchStatus() });
    void this.fetchStatus();
    playSceneEntrance(this);
  }

  update(): void {
    const r = this.status?.room;
    if (!r) return;
    const live = ['ban', 'place', 'invited'].includes(r.phase);
    this.clock.setText(live ? String(Math.max(0, Math.ceil((r.deadline - Date.now()) / 1000))) : '');
  }

  /** 기권은 되돌릴 수 없어 확인 창을 한 번 지난다 — 랭크전이면 패배로 RP를 잃는다. */
  private confirmForfeit(): void {
    const r = this.status?.room;
    const live = r && ['ban', 'place', 'battle'].includes(r.phase);
    if (!live) { startScene(this, 'arena'); return; }
    const p = new PopupLayer(this, 2400);
    p.confirm({ title: t("arena.room.leave"), message: r.ranked ? t("arena.room.leaveConfirm") : t("arena.room.leaveConfirmFriendly"), confirmLabel: t("arena.room.forfeit"), destructive: true }, () => void this.act({ kind: 'forfeit' }));
  }

  private async fetchStatus(): Promise<void> {
    if (this.busy || this.transitioning) return;
    this.busy = true;
    try {
      const s = await arenaCall('status', { roomId: this.roomId });
      if (this.scene.isActive()) this.adopt(s);
    } catch (e) {
      if (this.scene.isActive()) this.error.setText(arenaError(e));
    } finally { this.busy = false; }
  }

  private async act(action: ArenaAction): Promise<void> {
    if (this.busy || this.transitioning) return;
    this.busy = true;
    try {
      const s = await arenaCall('action', { roomId: this.roomId, action });
      if (this.scene.isActive()) {
        this.selectedRelic = '';
        this.selectedSlot = -1;
        this.signature = '';
        this.adopt(s);
        this.error.setText('');
      }
    } catch (e) {
      if (this.scene.isActive()) this.error.setText(arenaError(e));
    } finally { this.busy = false; }
  }

  private side(r: ArenaRoom, playerId: string): number { return Math.max(0, r.players.findIndex((p) => p.id === playerId)); }

  private adopt(s: ArenaStatus): void {
    this.status = s;
    const r = s.room;
    if (!r) return;
    const side = this.side(r, s.playerId);
    if ((r.phase === 'battle' || r.phase === 'done') && r.lease && !this.transitioning) {
      this.transitioning = true;
      // 전투 화면은 언제나 내 편을 아래에 세운다 — 공격 편은 나, 상대 칸은 상대의 픽이다.
      const me = side, foe = 1 - side, opponent = r.players[foe];
      startScene(this, 'battle', {
        mode: 'duel', requestId: r.id, attack: r.picks[me].map((p) => p.relicId), opponentName: opponent.name, opponentScore: 0,
        units: r.picks[foe].map((p) => { const u = opponent.roster.find((unit) => unit.def.id === p.relicId)!; return { relicId: p.relicId, level: u.level, breakthrough: u.breakthrough, stats: u.def.stats }; }),
        arena: { roomId: r.id, side, lease: r.lease, practice: (r as ArenaRoom & { practice?: boolean }).practice === true },
      });
      return;
    }
    // 밴이 끝나는 순간 한 번 — 서로 무엇을 밴했는지 크게 보여 준 뒤 왼쪽 띠로 보낸다.
    const reveal = this.lastPhase === 'ban' && r.phase === 'place' && r.bans.every((b) => b && b !== ARENA_HIDDEN_BAN);
    if (this.lastPhase === 'ban' && r.phase === 'place' && !reveal) this.unfold = true;
    this.lastPhase = r.phase;
    const signature = JSON.stringify([r.version, r.phase, this.selectedRelic, this.selectedSlot]);
    if (signature === this.signature && !reveal) return;
    this.signature = signature;
    this.paint(r, side);
    if (reveal) this.playBanReveal(r, side);
  }

  /** 지금 이 편이 손을 쓸 수 있는 단계인가. 공개 연출 동안에는 막는다. */
  private canAct(r: ArenaRoom, side: number): boolean { return !this.revealing && arenaCanAct(r, side); }

  private paint(r: ArenaRoom, side: number): void {
    this.frame.removeAll(true);
    this.controls.removeAll(true);
    const L = ARENA_ROOM_LAYOUT;
    const mine = r.players[side], opponent = r.players[1 - side];
    this.forfeitButton.setVisible(r.phase === 'ban' || r.phase === 'place');
    if (r.phase === 'invited' || r.phase === 'done' || r.phase === 'declined') {
      this.clearGrid();
      this.slots.removeAll(true);
      this.banColumn.removeAll(true);
      this.hint.setText('');
      this.title.setText(r.ranked ? t("arena.room.ranked") : t("arena.room.friendly"));
      const panel = this.add.container(540, 900);
      this.frame.add(panel);
      panel.add(drawLayer(this, 0, 0, chipPoints(900, 520), { fill: ARENA_TONE.panel, alpha: .94, edge: ARENA_TONE.accent, edgeAlpha: .8 }));
      const line = (y: number, text: string, size: number, color: string = COLOR.ink): void => { panel.add(this.add.text(0, y, text, textStyle({ role: "display", size, color, align: 'center', wrap: 820 })).setOrigin(.5)); };
      if (r.phase === 'invited') {
        this.paintInviteWaiting(panel, r, side);
        return;
      }
      line(-120, r.phase === 'declined' ? t("arena.invite.closed") : r.winner === null ? t("arena.result.drawLabel") : r.winner === side ? t("arena.result.winLabel") : t("arena.result.lossLabel"), 54, r.winner === side ? ARENA_TONE.allyText : COLOR.ink);
      line(-20, r.ranked ? t("arena.result.applied") : t("arena.result.friendlyNotice"), 28, COLOR.inkDim);
      if (r.phase === 'done' && r.reason === 'forfeit') line(40, r.winner === side ? t("arena.result.foeForfeit") : t("arena.result.selfForfeit"), 26, ARENA_TONE.accentText);
      panel.add(new Button(this, 0, 150, { width: 700, height: 110, label: t("arena.result.return"), variant: 'primary', fill: ARENA_TONE.confirm, accentColor: ARENA_TONE.accent, accentTextColor: COLOR.ink, onClick: () => startScene(this, 'arena') }));
      return;
    }
    const ban = r.phase === 'ban', act = this.canAct(r, side);
    this.title.setText(ban ? t("arena.room.banTitle") : t("arena.room.pickTitle"));
    // 이름표: 위는 상대(붉은빛), 아래는 나(초록빛). 전투에서 체력 바가 같은 색으로 선다.
    this.frame.add(this.add.text(540, L.enemyName.y, opponent.name, textStyle({ role: "display", size: 30, color: ARENA_TONE.foeText })).setOrigin(.5).setShadow(0, 3, '#000000', 0, true, true));
    this.frame.add(this.add.text(540, L.allyName.y, mine.name, textStyle({ role: "display", size: 30, color: ARENA_TONE.allyText })).setOrigin(.5).setShadow(0, 3, '#000000', 0, true, true));
    this.frame.add(this.add.text(540, L.allyName.y + 42, this.rulesLine(r), textStyle({ role: "body", size: 22, color: COLOR.inkDim })).setOrigin(.5));
    // 픽 단계에 들어서면 비어 있는 첫 칸을 미리 골라 둔다 — 카드만 누르고 확정해도 된다.
    if (!ban && act && (this.selectedSlot < 0 || r.picks[side].some((p) => p.slot === this.selectedSlot))) this.selectedSlot = this.firstEmptySlot(r, side);
    this.hint.setText(ban
      ? (act ? t("arena.ban.choose") : t("arena.ban.wait"))
      : (act ? t("arena.pick.choose") : r.locked[side] ? t("arena.pick.locked") : t("arena.placement.wait")));
    this.paintSlots(r, side, act && !ban, ban);
    this.paintBanColumn(r, side);
    // 밴 단계에는 레벨을 감춘다 — 상대 로스터의 성장을 보고 밴할 것을 고르지 않는다. 픽은 내 로스터라 내 레벨이 선다.
    this.ensureGrid(ban ? 'ban' : 'place', ban ? opponent.roster : mine.roster, !ban);
    this.refreshGrid(r, side, act);
    this.paintControls(r, side, act);
  }

  /**
   * 요청을 보내 놓고 기다리는 판 — 나 VS 상대의 이름이 마주 서고 그 사이에서 마스코트가 맞부딪히며, 아래에
   * 고른 규칙이 그림 칩으로 선다. 남은 시간은 화면 위 시계가 말한다. 문장 두 줄만 서던 때는 누구에게 무엇을
   * 걸고 기다리는지가 읽히지 않았다.
   */
  private paintInviteWaiting(panel: Phaser.GameObjects.Container, r: ArenaRoom, side: number): void {
    panel.removeAll(true);
    panel.add(drawLayer(this, 0, 0, chipPoints(940, 700, { bevel: { topLeft: 48, bottomRight: 48 } }), { fill: ARENA_TONE.panel, alpha: .95, edge: ARENA_TONE.accent, edgeAlpha: .85, glow: { color: ARENA_TONE.glow, strength: .3, height: .85 } }));
    const name = (x: number, text: string, color: string, label: string): void => {
      panel.add(this.add.text(x, -250, label, textStyle({ role: "emphasis", size: 22, color: COLOR.inkDim })).setOrigin(.5));
      panel.add(squeezeTextToWidth(this.add.text(x, -205, text, textStyle({ role: "display", size: 38, color })).setOrigin(.5).setStroke('#05070a', 5), 330));
    };
    name(-260, r.players[side].name, ARENA_TONE.allyText, t("arena.invite.me"));
    name(260, r.players[1 - side].name, ARENA_TONE.foeText, t("arena.invite.opponent"));
    addArenaMascots(this, panel, 0, 70, 230, true, 10, { spread: .9 });
    const waiting = this.add.text(0, 140, t("arena.invite.waiting"), textStyle({ role: "display", size: 32, color: COLOR.ink })).setOrigin(.5).setShadow(0, 3, '#000000', 0, true, true);
    panel.add(waiting);
    if (!session.settings.accessibility.reduceMotion) this.tweens.add({ targets: waiting, alpha: .45, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    addArenaRuleChips(this, panel, 0, 240, r.rules, { size: 24, maxWidth: 880 });
  }

  private rulesLine(r: ArenaRoom): string {
    return [
      r.rules.ban ? t("arena.rules.oneBan") : t("arena.rules.noBan"),
      r.rules.placement === 'alternate' ? t("arena.rules.alternate") : t("arena.rules.hidden"),
      r.rules.placement === 'alternate' ? t("arena.rules.duplicates", { p0: r.rules.unique === false ? t("arena.rules.duplicatesAllowed") : t("arena.rules.duplicatesBlocked") }) : '',
    ].filter(Boolean).join(' · ');
  }

  private firstEmptySlot(r: ArenaRoom, side: number): number {
    for (let slot = 0; slot < 3; slot += 1) if (!r.picks[side].some((p, i) => (p.slot ?? i) === slot)) return slot;
    return -1;
  }

  /** 그 편 로스터의 렐릭 — 두 편이 같은 렐릭을 가져도 레벨은 그 주인의 것이다. */
  private unitOf(r: ArenaRoom, id: string, owner: number): ArenaUnit | undefined {
    return r.players[owner]?.roster.find((u) => u.def.id === id);
  }

  private addCard(parent: Phaser.GameObjects.Container, x: number, y: number, unit: ArenaUnit | undefined, relicId: string, width: number, height: number, showLevel = true): PortraitCard {
    const def = unit?.def;
    const card = new PortraitCard(this, x, y, {
      width, height, relicId, label: def?.name ?? relicId, level: showLevel ? unit?.level : undefined, rarity: def?.rarity,
      breakthroughGrade: unit ? unit.breakthrough + 1 : undefined,
      affinity: def ? { element: def.element, role: def.role } : undefined,
      head: 'inside', selectedStyle: 'pressed',
    });
    parent.add(card);
    card.syncMask();
    return card;
  }

  /**
   * 위아래 세 칸. 내 칸은 눌러 고를 수 있고, 고른 칸은 초록빛으로 숨 쉰다.
   *
   * 밴 단계(와 밴 공개가 도는 동안)에는 내 줄이 세 칸이 아니라 **밴 칸 하나**다 — 확정 버튼이 그 안에 선다.
   * 밴이 끝나면 그 판이 세 칸으로 갈라지며(`unfold`) 픽이 시작된다. 칸마다 컨테이너 하나라 함께 움직인다.
   */
  private paintSlots(r: ArenaRoom, side: number, pickable: boolean, ban: boolean): void {
    this.slots.removeAll(true);
    const L = ARENA_ROOM_LAYOUT;
    const reduce = session.settings.accessibility.reduceMotion;
    const banRow = ban || this.revealing;
    ([[1 - side, L.enemyRow, ARENA_TONE.foe], [side, L.allyRow, ARENA_TONE.ally]] as const).forEach(([owner, y, tone]) => {
      const mineRow = owner === side;
      if (mineRow && banRow) {
        if (r.rules.ban) {
          this.slots.add(drawLayer(this, L.banSlot.x, L.banSlot.y, slantedRect(L.banSlot.width, L.banSlot.height), { fill: ARENA_TONE.panel, alpha: .82, edge: ARENA_TONE.ban, edgeAlpha: .7 }));
          return;
        }
      }
      const unfolding = mineRow && this.unfold && !banRow;
      const cells: Phaser.GameObjects.Container[] = [];
      L.slotX.forEach((x, slot) => {
        const cell = this.add.container(x, y);
        this.slots.add(cell);
        cells.push(cell);
        const pick = r.picks[owner].find((p, i) => (p.slot ?? i) === slot);
        const chosen = mineRow && pickable && !pick && this.selectedSlot === slot;
        if (chosen) {
          const glow = drawLayer(this, 0, 0, slantedRect(L.slot.width + 24, L.slot.height + 24), { fill: tone, alpha: .3, edge: tone, edgeAlpha: 1 });
          cell.add(glow);
          if (!reduce) this.tweens.add({ targets: glow, alpha: .45, duration: 480, yoyo: true, repeat: -1 });
        }
        cell.add(drawLayer(this, 0, 0, slantedRect(L.slot.width, L.slot.height), { fill: ARENA_TONE.panel, alpha: .82, edge: tone, edgeAlpha: chosen ? 1 : .55 }));
        if (pick) {
          this.addCard(cell, 0, 6, this.unitOf(r, pick.relicId, owner), pick.relicId, L.slot.card.width, L.slot.card.height);
        } else if (chosen && this.selectedRelic) {
          // 고르는 중인 렐릭은 칸에 흐리게 미리 선다 — 확정하면 그대로 그 자리다.
          this.addCard(cell, 0, 6, this.unitOf(r, this.selectedRelic, side), this.selectedRelic, L.slot.card.width, L.slot.card.height).setAlpha(.55);
        } else {
          cell.add(this.add.text(0, 0, String(slot + 1), textStyle({ role: "display", size: 84, color: mineRow ? ARENA_TONE.allyText : ARENA_TONE.foeText })).setOrigin(.5).setAlpha(.38));
        }
        if (mineRow && pickable && !pick) {
          const hit = addClippedHit(this, cell, 0, 0, L.slot.width, L.slot.height, () => FULL_SCREEN);
          hit.setName(`arena-slot-${slot}`);
          onTap(hit, () => { this.selectedSlot = slot; this.repaint(); });
        }
      });
      if (!unfolding) return;
      this.unfold = false;
      if (reduce) return;
      // 밴 칸이 가운데에서 세 칸으로 갈라진다 — 방금까지 밴 버튼이 섰던 자리가 곧 1·2·3이다.
      const merged = drawLayer(this, L.banSlot.x, L.banSlot.y, slantedRect(L.banSlot.width, L.banSlot.height), { fill: ARENA_TONE.panel, alpha: .82, edge: ARENA_TONE.ban, edgeAlpha: .7 });
      this.slots.addAt(merged, 0);
      this.tweens.add({ targets: merged, alpha: 0, scaleY: .9, duration: 260, ease: 'Sine.easeIn', onComplete: () => merged.destroy() });
      const sync = (): void => cells.forEach((cell) => cell.each((child: Phaser.GameObjects.GameObject) => { if (child instanceof PortraitCard) child.syncMask(); }));
      cells.forEach((cell, slot) => {
        const x = cell.x;
        cell.setX(L.banSlot.x).setScale(.6, .9).setAlpha(0);
        this.tweens.add({ targets: cell, x, scaleX: 1, scaleY: 1, alpha: 1, duration: 420, delay: 80 + Math.abs(slot - 1) * 60, ease: 'Back.easeOut', onUpdate: sync, onComplete: sync });
      });
    });
  }

  /** 왼쪽 띠 — 상대 밴(위)과 내 밴(아래). 밴 단계에는 내가 고르는 중인 것이, 상대 칸에는 「?」가 선다. 레벨은 적지 않는다. */
  private paintBanColumn(r: ArenaRoom, side: number): void {
    this.banColumn.removeAll(true);
    if (!r.rules.ban || this.revealing) return;
    const L = ARENA_ROOM_LAYOUT.banColumn;
    const entries: [string, string, string | null, number][] = [
      [t("arena.ban.theirs"), ARENA_TONE.foeText, r.bans[1 - side], side],
      [t("arena.ban.mine"), ARENA_TONE.allyText, r.bans[side] ?? (r.phase === 'ban' && this.selectedRelic ? this.selectedRelic : null), 1 - side],
    ];
    entries.forEach(([label, color, id, rosterOwner], index) => {
      const y = L.y[index];
      this.banColumn.add(this.add.text(L.x, y - L.card.height / 2 - 30, label, textStyle({ role: "emphasis", size: 22, color })).setOrigin(.5));
      if (id && id !== ARENA_HIDDEN_BAN) {
        // 내 밴은 상대 로스터에서, 상대 밴은 내 로스터에서 고른 것이다.
        const card = this.addCard(this.banColumn, L.x, y, this.unitOf(r, id, rosterOwner), id, L.card.width, L.card.height, false);
        addBanMark(this, card, L.card.width, L.card.height);
        if (r.bans[side] === null && index === 1) card.setAlpha(.7);
      } else {
        this.banColumn.add(drawLayer(this, L.x, y, slantedRect(L.card.width, L.card.height), { fill: ARENA_TONE.panel, alpha: .8, edge: ARENA_TONE.ban, edgeAlpha: .5 }));
        this.banColumn.add(this.add.text(L.x, y, id === ARENA_HIDDEN_BAN ? '?' : '—', textStyle({ role: "display", size: 56, color: ARENA_TONE.banText })).setOrigin(.5).setAlpha(.7));
      }
    });
  }

  private paintControls(r: ArenaRoom, side: number, act: boolean): void {
    const L = ARENA_ROOM_LAYOUT;
    const ban = r.phase === 'ban', hidden = r.rules.placement === 'hidden';
    const placed = r.picks[side].length;
    const lockReady = !ban && hidden && placed >= 3 && !r.locked[side];
    const ready = act && (ban ? this.selectedRelic !== '' : lockReady || (this.selectedRelic !== '' && this.selectedSlot >= 0));
    if (this.revealing) return;
    const label = ban ? t("arena.ban.confirm") : lockReady ? t("arena.placement.lock") : t("arena.pick.confirm", { p0: placed });
    // 밴 확정은 내 1·2·3 칸 자리(밴 칸) 안에, 픽 확정은 격자와 내 칸 사이에 선다.
    const at = ban ? L.banConfirm : L.confirm;
    // 눌러야 할 때만 숨 쉬는 빛이 버튼 뒤에서 번진다(버튼 자체의 눌림 배율과 다투지 않도록 따로 세운다).
    if (ready) {
      const glow = drawLayer(this, at.x, at.y, chipPoints(at.width + 40, at.height + 34), { fill: ban ? ARENA_TONE.ban : ARENA_TONE.glow, alpha: .45 });
      this.controls.add(glow);
      if (!session.settings.accessibility.reduceMotion) this.tweens.add({ targets: glow, alpha: .05, scaleX: 1.04, scaleY: 1.12, duration: 640, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    const button = new Button(this, at.x, at.y, {
      width: at.width, height: at.height, label, fontSize: ban ? 46 : 40, variant: 'primary', decorDots: true,
      fill: ban ? 0xb02844 : ARENA_TONE.confirm, accentColor: ban ? ARENA_TONE.ban : ARENA_TONE.accent, accentTextColor: COLOR.ink,
      onClick: () => this.confirm(r, side),
    });
    button.setName('arena-confirm');
    button.setEnabled(ready);
    this.controls.add(button);
    if (!ban && hidden && placed > 0 && !r.locked[side]) {
      this.controls.add(new Button(this, L.undo.x, L.undo.y, { width: L.undo.width, height: L.undo.height, label: t("arena.placement.undo"), fontSize: 26, onClick: () => void this.act({ kind: 'undo' }) }));
    }
  }

  private confirm(r: ArenaRoom, side: number): void {
    if (!this.canAct(r, side)) return;
    // 「쿵」 — 확정은 되돌릴 수 없는 한 번이라 화면이 짧게 내려앉는다.
    if (!session.settings.accessibility.reduceMotion) this.cameras.main.shake(140, .004);
    if (r.phase === 'ban') { if (this.selectedRelic) void this.act({ kind: 'ban', relicId: this.selectedRelic }); return; }
    if (r.rules.placement === 'hidden' && r.picks[side].length >= 3) { void this.act({ kind: 'lock' }); return; }
    if (this.selectedRelic && this.selectedSlot >= 0) void this.act({ kind: 'place', relicId: this.selectedRelic, slot: this.selectedSlot });
  }

  private repaint(): void {
    this.signature = '';
    if (this.status) this.adopt(this.status);
  }

  private clearGrid(): void {
    this.gridContent?.destroy();
    this.gridContent = undefined;
    this.gridMask?.destroy();
    this.gridMask = undefined;
    this.gridCards.clear();
    this.gridKey = '';
    setDebugGridCards("arenaRoom", undefined);
  }

  /** 격자 카드는 단계마다 한 번만 세운다. 고르고 밴하는 표시는 `refreshGrid`가 제자리에서 바꾼다. */
  private ensureGrid(key: string, roster: readonly ArenaUnit[], showLevel: boolean): void {
    const fullKey = `${key}:${showLevel}:${roster.map((u) => u.def.id).join(',')}`;
    if (fullKey === this.gridKey) return;
    // 새 격자를 먼저 세우고 옛 격자를 걷는다 — 원화는 세운 객체가 사는 동안만 붙잡힌다.
    const previous = this.gridContent, previousMask = this.gridMask;
    this.gridCards = new Map();
    this.gridKey = fullKey;
    const G = ARENA_ROOM_LAYOUT.grid;
    const content = this.add.container(0, 0);
    const mask = this.make.graphics({});
    mask.fillStyle(0xffffff, 1).fillRect(0, G.top, 1080, G.bottom - G.top);
    content.setMask(mask.createGeometryMask());
    // 머리가 칸 안에 있으니 머리 몫의 여유를 따로 비우지 않는다.
    const startY = G.top + PORTRAIT_GRID_MASK_GAP + GRID.cardHeight / 2;
    const positions: Record<string, { x: number; y: number }> = {};
    roster.forEach((unit, i) => {
      const x = G.left + GRID.columnStep * (i % G.columns + .5);
      const y = startY + Math.floor(i / G.columns) * GRID.rowStep;
      positions[unit.def.id] = { x, y };
      // 머리를 칸 안에 가둔다 — 격자 창의 윗변 마스크에 정수리가 잘리지 않고, 덮개·X가 카드 전체를 같은 모양으로 덮는다.
      const card = new PortraitCard(this, x, y, {
        width: GRID.cardWidth, height: GRID.cardHeight, relicId: unit.def.id, label: unit.def.name, level: showLevel ? unit.level : undefined,
        rarity: unit.def.rarity, breakthroughGrade: unit.breakthrough + 1, affinity: { element: unit.def.element, role: unit.def.role },
        head: 'inside', selectedStyle: 'pressed',
      });
      card.setName(`arena-card-${unit.def.id}`);
      // 격자 창(마스크와 같은 사각형) 안에서만 손을 받는다 — 밖으로 흘러간 카드가 위 슬롯·아래 버튼을 덮지 않게.
      clipHit(card.hit, () => ({ left: 0, right: 1080, top: G.top, bottom: G.bottom }));
      content.add(card);
      // 층은 원화 → 이름줄 → 덮개 → 글자/X 순이다. 덮개는 카드가 그린 칩 실루엣을 그대로 받는다.
      const dim = this.add.container(0, 0).setVisible(false);
      card.add(dim);
      dim.add(addCardVeil(card, 0x000000, .62, GRID.cardWidth, GRID.cardHeight));
      const dimLabel = this.add.text(0, 0, '', textStyle({ role: "display", size: 30, color: COLOR.ink })).setOrigin(.5).setStroke('#000000', 6);
      dim.add(dimLabel);
      const banMark = addBanMark(this, card, GRID.cardWidth, GRID.cardHeight).setVisible(false);
      card.hit.on('pointerup', () => { if (this.dragged < 12) this.tapCard(unit.def.id); });
      this.gridCards.set(unit.def.id, { card, banMark, dim, dimLabel });
    });
    this.gridContent = content;
    this.gridMask = mask;
    const rows = Math.ceil(roster.length / G.columns);
    const height = rows > 0 ? PORTRAIT_GRID_MASK_GAP + (rows - 1) * GRID.rowStep + GRID.cardHeight : 0;
    this.gridMinScroll = Math.min(0, G.bottom - G.top - height - 28);
    setDebugGridCards("arenaRoom", positions, 0, { top: G.top, bottom: G.bottom });
    this.scrollGridTo(0);
    previous?.destroy();
    previousMask?.destroy();
  }

  private refreshGrid(r: ArenaRoom, side: number, act: boolean): void {
    const ban = r.phase === 'ban';
    const pickable = new Set(arenaPickable(r, side).map((u) => u.def.id));
    this.gridCards.forEach(({ card, banMark, dim, dimLabel }, id) => {
      const myPick = r.picks[side].find((p) => p.relicId === id);
      let reason = '';
      if (ban) {
        // 밴은 상대 로스터에서 고른다. 확정한 뒤에는 그 카드만 X로 남고 나머지는 가라앉는다.
        if (r.bans[side] !== null && r.bans[side] !== id) reason = ' ';
      } else if (myPick) reason = t("arena.pick.slot", { p0: (myPick.slot ?? r.picks[side].indexOf(myPick)) + 1 });
      else if (r.bans.includes(id) && !pickable.has(id)) reason = t("arena.pick.banned");
      else if (!pickable.has(id)) reason = t("arena.pick.taken");
      const marked = ban && (r.bans[side] === id || (r.bans[side] === null && this.selectedRelic === id));
      banMark.setVisible(marked);
      dim.setVisible(reason !== '' && !marked);
      dimLabel.setText(reason.trim());
      card.setSelected(!ban && this.selectedRelic === id, ARENA_TONE.accent);
      card.setAlpha(act || marked || myPick ? 1 : .82);
    });
  }

  private tapCard(id: string): void {
    const r = this.status?.room;
    if (!r || !this.status) return;
    const side = this.side(r, this.status.playerId);
    if (!this.canAct(r, side)) return;
    if (r.phase === 'ban') {
      this.selectedRelic = this.selectedRelic === id ? '' : id;
      const entry = this.gridCards.get(id);
      // 한 번 누르면 붉은 X가 쿵 하고 찍힌다.
      if (entry && this.selectedRelic === id && !session.settings.accessibility.reduceMotion) {
        entry.banMark.setScale(1.8).setAlpha(0);
        this.tweens.add({ targets: entry.banMark, scale: 1, alpha: 1, duration: 180, ease: 'Back.easeOut' });
      }
    } else {
      if (!arenaPickable(r, side).some((u) => u.def.id === id)) return;
      this.selectedRelic = this.selectedRelic === id ? '' : id;
    }
    this.repaint();
  }

  private bindGridScroll(): void {
    const G = ARENA_ROOM_LAYOUT.grid;
    const inside = (p: Phaser.Input.Pointer): boolean => p.worldY >= G.top && p.worldY <= G.bottom && p.worldX >= G.left - 20;
    const onDown = (p: Phaser.Input.Pointer): void => { if (!inside(p) || this.gridMinScroll === 0) return; this.dragging = true; this.dragged = 0; this.dragOrigin = this.gridScroll - p.y; };
    const onMove = (p: Phaser.Input.Pointer): void => { if (!this.dragging || !p.isDown) return; this.dragged += Math.abs(p.velocity.y); this.scrollGridTo(this.dragOrigin + p.y); };
    const onUp = (): void => { this.dragging = false; this.time.delayedCall(0, () => { this.dragged = 0; }); };
    const onWheel = (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number): void => { if (inside(p)) this.scrollGridTo(this.gridScroll - dy); };
    this.input.on('pointerdown', onDown);
    this.input.on('pointermove', onMove);
    this.input.on('pointerup', onUp);
    this.input.on('pointerupoutside', onUp);
    this.input.on('wheel', onWheel);
    this.events.once('shutdown', () => {
      this.input.off('pointerdown', onDown); this.input.off('pointermove', onMove); this.input.off('pointerup', onUp);
      this.input.off('pointerupoutside', onUp); this.input.off('wheel', onWheel);
    });
  }

  private scrollGridTo(value: number): void {
    this.gridScroll = Phaser.Math.Clamp(value, this.gridMinScroll, 0);
    this.gridContent?.setY(this.gridScroll);
    setDebugGridOffset("arenaRoom", this.gridScroll);
    // PortraitCard의 기하 마스크는 부모 이동을 물려받지 않는다. 창 밖으로 밀린 카드는 손도 받지 않는다 —
    // 마스크는 그리기만 자르므로 그대로 두면 아래의 확정 버튼을 덮는다.
    const G = ARENA_ROOM_LAYOUT.grid;
    this.gridCards.forEach(({ card }) => {
      card.syncMask();
      const y = card.y + this.gridScroll;
      if (card.hit.input) card.hit.input.enabled = y > G.top && y < G.bottom;
    });
  }

  /**
   * 밴 공개. 양쪽이 밴을 확정한 순간 한 번 — 상대 밴은 위(오른쪽에서), 내 밴은 아래(왼쪽에서) 밀려 들어와 붉은 X가
   * 찍히고, 한 박자 뒤 왼쪽 밴 띠의 제자리(위가 상대, 아래가 나)로 줄어들며 날아간다. 그동안은 손을 막고, 끝나면
   * 밴 칸이 세 칸으로 갈라지며 픽이 시작된다.
   */
  private playBanReveal(r: ArenaRoom, side: number): void {
    const reduce = session.settings.accessibility.reduceMotion;
    this.revealing = true;
    this.paintBanColumn(r, side);
    const L = ARENA_ROOM_LAYOUT.banColumn;
    const layer = this.add.container(0, 0).setDepth(3000);
    const dim = this.add.rectangle(540, 960, 1080, 1920, ARENA_TONE.deep, .82);
    layer.add(dim);
    // 공개가 도는 동안 뒤의 격자·버튼이 손을 받지 않게 화면 전체를 막는다.
    addClippedHit(this, layer, 540, 960, 1080, 1920, () => FULL_SCREEN, { useHandCursor: false });
    const title = this.add.text(540, 960, t("arena.ban.reveal"), textStyle({ role: "display", size: 64, color: ARENA_TONE.banText })).setOrigin(.5).setStroke('#000000', 8);
    layer.add(title);
    // [아이디, 고른 렐릭의 주인, 표, 들어오는 쪽, 머무는 y] — 위가 상대, 아래가 나.
    const entries = [
      { id: r.bans[1 - side]!, owner: side, label: t("arena.ban.theirs"), color: ARENA_TONE.foeText, from: 1380, y: 640, slot: 0 },
      { id: r.bans[side]!, owner: 1 - side, label: t("arena.ban.mine"), color: ARENA_TONE.allyText, from: -300, y: 1300, slot: 1 },
    ];
    const cards = entries.map((entry) => {
      const holder = this.add.container(entry.from, entry.y);
      layer.add(holder);
      holder.add(this.add.text(0, -230, entry.label, textStyle({ role: "display", size: 34, color: entry.color })).setOrigin(.5).setStroke('#000000', 6));
      const unit = this.unitOf(r, entry.id, entry.owner);
      const card = new PortraitCard(this, 0, 0, { width: 300, height: 375, relicId: entry.id, label: unit?.def.name ?? entry.id, rarity: unit?.def.rarity, head: 'inside' });
      holder.add(card);
      card.syncMask();
      const mark = addBanMark(this, card, 300, 375);
      mark.setScale(2.2).setAlpha(0);
      return { holder, card, mark, entry };
    });
    const sync = (): void => cards.forEach(({ card }) => card.syncMask());
    const finish = (): void => {
      if (!layer.active || !this.scene.isActive()) return;
      layer.destroy();
      this.revealing = false;
      this.unfold = true;
      this.repaint();
    };
    // 박자는 씬 시계로 돌지만 손을 막는 시간은 실제 시간이 지킨다 — 프레임이 굶는 기기에서 씬 타이머가 밀려도
    // 공개 연출이 픽 차례를 붙잡아 시계가 다 가는 일이 없다.
    const guard = window.setTimeout(finish, reduce ? 1600 : 2800);
    layer.once(Phaser.GameObjects.Events.DESTROY, () => window.clearTimeout(guard));
    if (reduce) {
      cards.forEach(({ holder, mark }) => { holder.setX(540); mark.setScale(1).setAlpha(1); });
      sync();
      this.time.delayedCall(1100, finish);
      return;
    }
    this.tweens.add({ targets: cards.map((c) => c.holder), x: 540, duration: 360, ease: 'Cubic.easeOut', onUpdate: sync });
    // X 덮개는 카드 안의 자식이라 배율 트윈 동안 덮개 마스크를 다시 맞춘다.
    this.tweens.add({ targets: cards.map((c) => c.mark), scale: 1, alpha: 1, duration: 200, delay: 460, ease: 'Back.easeOut', onUpdate: sync, onComplete: () => this.cameras.main.shake(160, .006) });
    this.time.delayedCall(1500, () => {
      if (!layer.active) return;
      this.tweens.add({ targets: [dim, title], alpha: 0, duration: 420 });
      cards.forEach(({ holder, entry }) => {
        this.tweens.add({ targets: holder, x: L.x, y: L.y[entry.slot], scale: L.card.width / 300, duration: 420, ease: 'Cubic.easeInOut', onUpdate: sync });
      });
      this.time.delayedCall(460, finish);
    });
  }
}
