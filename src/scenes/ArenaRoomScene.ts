import { t } from "../i18n";
import { subscribeArenaChanges } from "../api/arenaRealtime";
import Phaser from 'phaser';
import { arenaCall, arenaError, type ArenaStatus } from '../api/arenaApi';
import { ARENA_HIDDEN_BAN, arenaCanAct, arenaPickable, type ArenaAction, type ArenaRoom, type ArenaUnit } from '../core/liveArena';
import { Button } from '../ui/Button';
import { PopupLayer } from '../ui/PopupLayer';
import { textStyle, COLOR } from '../ui/theme';
import { addSceneBackground, BACKGROUND } from '../ui/backgrounds';
import { addBackButton } from '../ui/IconButton';
import { startScene } from '../ui/screenTransition';
import { chipPoints, drawLayer, drawVignette, slantedRect } from '../ui/holo';
import { PortraitCard } from '../ui/PortraitCard';
import { formationRosterGrid, portraitGridContentHeight, portraitGridFirstRowY, PORTRAIT_GRID_MASK_GAP } from '../ui/portraitGrid';
import { addArenaBackdrop, ARENA_TONE } from '../ui/arenaTheme';
import { session } from '../state/session';
import { addClippedHit } from '../ui/clippedHit';
import { ARENA_ROOM_LAYOUT } from '../ui/arenaRoomLayout';

import type { ClipRect } from '../ui/clipRect';
import { setDebugGridCards, setDebugGridOffset, setDebugScene } from '../debug';

/**
 * 밴픽 화면의 자리. 위가 상대, 아래가 나, 가운데가 고를 렐릭 격자, 왼쪽 띠가 서로의 밴이다.
 * 스토리 편성(`PartyScene`)과 같은 카드·같은 세 칸을 쓰되 칸이 위아래로 마주 본다.
 */
const FULL_SCREEN: ClipRect = { left: 0, right: 1080, top: 0, bottom: 1920 };


const GRID = formationRosterGrid(ARENA_ROOM_LAYOUT.grid.right - ARENA_ROOM_LAYOUT.grid.left, ARENA_ROOM_LAYOUT.grid.columns);

interface GridCard { card: PortraitCard; banMark: Phaser.GameObjects.Container; dim: Phaser.GameObjects.Container; dimLabel: Phaser.GameObjects.Text }

/** 붉은 X 한 장. 카드 위에 겹쳐 「밴」을 말한다 — 글자보다 먼저 읽힌다. */
function drawBanX(scene: Phaser.Scene, width: number, height: number): Phaser.GameObjects.Container {
  const root = scene.add.container(0, 0);
  root.add(scene.add.rectangle(0, 0, width, height, ARENA_TONE.ban, 0.28));
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
    addBackButton(this, () => { const p = new PopupLayer(this, 2400); p.confirm({ title: t("arena.room.leave"), message: t("arena.room.leaveConfirm"), confirmLabel: t("arena.room.forfeit"), destructive: true }, () => void this.act({ kind: 'forfeit' })); });
    this.bindGridScroll();
    const unsubscribe = subscribeArenaChanges(() => void this.fetchStatus());
    this.events.once('shutdown', () => { unsubscribe(); setDebugGridCards("arenaRoom", undefined); });
    this.time.addEvent({ delay: 2000, loop: true, callback: () => void this.fetchStatus() });
    void this.fetchStatus();
  }

  update(): void {
    const r = this.status?.room;
    if (!r) return;
    const live = ['ban', 'place', 'invited'].includes(r.phase);
    this.clock.setText(live ? String(Math.max(0, Math.ceil((r.deadline - Date.now()) / 1000))) : '');
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
        line(-80, t("arena.invite.waiting"), 36);
        line(40, this.rulesLine(r), 28, ARENA_TONE.accentText);
        return;
      }
      line(-120, r.phase === 'declined' ? t("arena.invite.closed") : r.winner === null ? t("arena.result.drawLabel") : r.winner === side ? t("arena.result.winLabel") : t("arena.result.lossLabel"), 54, r.winner === side ? ARENA_TONE.allyText : COLOR.ink);
      line(-20, r.ranked ? t("arena.result.applied") : t("arena.result.friendlyNotice"), 28, COLOR.inkDim);
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
    this.paintSlots(r, side, act && !ban);
    this.paintBanColumn(r, side);
    this.ensureGrid(ban ? 'ban' : 'place', ban ? opponent.roster : mine.roster);
    this.refreshGrid(r, side, act);
    this.paintControls(r, side, act);
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

  private unitOf(r: ArenaRoom, id: string): ArenaUnit | undefined {
    return r.players[0].roster.find((u) => u.def.id === id) ?? r.players[1].roster.find((u) => u.def.id === id);
  }

  private addCard(parent: Phaser.GameObjects.Container, x: number, y: number, unit: ArenaUnit | undefined, relicId: string, width: number, height: number): PortraitCard {
    const def = unit?.def;
    const card = new PortraitCard(this, x, y, {
      width, height, relicId, label: def?.name ?? relicId, level: unit?.level, rarity: def?.rarity,
      breakthroughGrade: unit ? unit.breakthrough + 1 : undefined,
      affinity: def ? { element: def.element, role: def.role } : undefined,
      head: 'inside', selectedStyle: 'pressed',
    });
    parent.add(card);
    card.syncMask();
    return card;
  }

  /** 위아래 세 칸. 내 칸은 눌러 고를 수 있고, 고른 칸은 초록빛으로 숨 쉰다. */
  private paintSlots(r: ArenaRoom, side: number, pickable: boolean): void {
    this.slots.removeAll(true);
    const L = ARENA_ROOM_LAYOUT;
    ([[1 - side, L.enemyRow, ARENA_TONE.foe], [side, L.allyRow, ARENA_TONE.ally]] as const).forEach(([owner, y, tone]) => {
      const mineRow = owner === side;
      L.slotX.forEach((x, slot) => {
        const pick = r.picks[owner].find((p, i) => (p.slot ?? i) === slot);
        const chosen = mineRow && pickable && !pick && this.selectedSlot === slot;
        if (chosen) {
          const glow = drawLayer(this, x, y, slantedRect(L.slot.width + 24, L.slot.height + 24), { fill: tone, alpha: .3, edge: tone, edgeAlpha: 1 });
          this.slots.add(glow);
          if (!session.settings.accessibility.reduceMotion) this.tweens.add({ targets: glow, alpha: .45, duration: 480, yoyo: true, repeat: -1 });
        }
        this.slots.add(drawLayer(this, x, y, slantedRect(L.slot.width, L.slot.height), { fill: ARENA_TONE.panel, alpha: .82, edge: tone, edgeAlpha: chosen ? 1 : .55 }));
        if (pick) {
          this.addCard(this.slots, x, y + 6, this.unitOf(r, pick.relicId), pick.relicId, L.slot.card.width, L.slot.card.height);
        } else {
          // 고르는 중인 렐릭은 칸에 흐리게 미리 선다 — 확정하면 그대로 그 자리다.
          if (chosen && this.selectedRelic) {
            const preview = this.addCard(this.slots, x, y + 6, this.unitOf(r, this.selectedRelic), this.selectedRelic, L.slot.card.width, L.slot.card.height);
            preview.setAlpha(.55);
          } else {
            this.slots.add(this.add.text(x, y, String(slot + 1), textStyle({ role: "display", size: 84, color: mineRow ? ARENA_TONE.allyText : ARENA_TONE.foeText })).setOrigin(.5).setAlpha(.38));
          }
        }
        if (mineRow && pickable && !pick) {
          const hit = addClippedHit(this, this.slots, x, y, L.slot.width, L.slot.height, () => FULL_SCREEN);
          hit.setName(`arena-slot-${slot}`);
          hit.on('pointerup', () => { this.selectedSlot = slot; this.repaint(); });
        }
      });
    });
  }

  /** 왼쪽 띠 — 내 밴(위)과 상대 밴(아래). 밴 단계에는 내가 고르는 중인 것이, 상대 칸에는 「?」가 선다. */
  private paintBanColumn(r: ArenaRoom, side: number): void {
    this.banColumn.removeAll(true);
    if (!r.rules.ban || this.revealing) return;
    const L = ARENA_ROOM_LAYOUT.banColumn;
    const entries: [string, string | null][] = [
      [t("arena.ban.mine"), r.bans[side] ?? (r.phase === 'ban' && this.selectedRelic ? this.selectedRelic : null)],
      [t("arena.ban.theirs"), r.bans[1 - side]],
    ];
    entries.forEach(([label, id], index) => {
      const y = L.y[index];
      this.banColumn.add(this.add.text(L.x, y - L.card.height / 2 - 30, label, textStyle({ role: "emphasis", size: 22, color: ARENA_TONE.banText })).setOrigin(.5));
      if (id && id !== ARENA_HIDDEN_BAN) {
        const card = this.addCard(this.banColumn, L.x, y, this.unitOf(r, id), id, L.card.width, L.card.height);
        card.add(drawBanX(this, L.card.width, L.card.height));
        if (r.bans[side] === null && index === 0) card.setAlpha(.7);
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
    const label = ban ? t("arena.ban.confirm") : lockReady ? t("arena.placement.lock") : t("arena.pick.confirm", { p0: placed });
    // 눌러야 할 때만 숨 쉬는 빛이 버튼 뒤에서 번진다(버튼 자체의 눌림 배율과 다투지 않도록 따로 세운다).
    if (ready) {
      const glow = drawLayer(this, L.confirm.x, L.confirm.y, chipPoints(L.confirm.width + 40, L.confirm.height + 34), { fill: ban ? ARENA_TONE.ban : ARENA_TONE.glow, alpha: .45 });
      this.controls.add(glow);
      if (!session.settings.accessibility.reduceMotion) this.tweens.add({ targets: glow, alpha: .05, scaleX: 1.06, scaleY: 1.14, duration: 640, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    const button = new Button(this, L.confirm.x, L.confirm.y, {
      width: L.confirm.width, height: L.confirm.height, label, fontSize: 40, variant: 'primary', decorDots: true,
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
  private ensureGrid(key: string, roster: readonly ArenaUnit[]): void {
    const fullKey = `${key}:${roster.map((u) => u.def.id).join(',')}`;
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
    const startY = portraitGridFirstRowY(G.top, GRID.cardHeight, PORTRAIT_GRID_MASK_GAP);
    const positions: Record<string, { x: number; y: number }> = {};
    roster.forEach((unit, i) => {
      const x = G.left + GRID.columnStep * (i % G.columns + .5);
      const y = startY + Math.floor(i / G.columns) * GRID.rowStep;
      positions[unit.def.id] = { x, y };
      const card = new PortraitCard(this, x, y, {
        width: GRID.cardWidth, height: GRID.cardHeight, relicId: unit.def.id, label: unit.def.name, level: unit.level,
        rarity: unit.def.rarity, breakthroughGrade: unit.breakthrough + 1, affinity: { element: unit.def.element, role: unit.def.role },
        selectedStyle: 'pressed',
      });
      card.setName(`arena-card-${unit.def.id}`);
      const banMark = drawBanX(this, GRID.cardWidth, GRID.cardHeight).setVisible(false);
      const dim = this.add.container(0, 0).setVisible(false);
      dim.add(this.add.rectangle(0, 0, GRID.cardWidth, GRID.cardHeight, 0x000000, .6));
      const dimLabel = this.add.text(0, 0, '', textStyle({ role: "display", size: 30, color: COLOR.ink })).setOrigin(.5).setStroke('#000000', 6);
      dim.add(dimLabel);
      card.add([dim, banMark]);
      card.hit.on('pointerup', () => { if (this.dragged < 12) this.tapCard(unit.def.id); });
      content.add(card);
      this.gridCards.set(unit.def.id, { card, banMark, dim, dimLabel });
    });
    this.gridContent = content;
    this.gridMask = mask;
    const rows = Math.ceil(roster.length / G.columns);
    const height = rows > 0 ? PORTRAIT_GRID_MASK_GAP + portraitGridContentHeight(rows, GRID.rowStep, GRID.cardHeight) : 0;
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
   * 밴 공개. 양쪽이 밴을 확정한 순간 한 번 — 두 카드가 좌우에서 밀려 들어와 붉은 X가 찍히고,
   * 한 박자 뒤 왼쪽 밴 띠의 제자리로 줄어들며 날아간다. 그동안은 손을 막는다.
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
    layer.add(this.add.text(540, 560, t("arena.ban.reveal"), textStyle({ role: "display", size: 64, color: ARENA_TONE.banText })).setOrigin(.5).setStroke('#000000', 8));
    const ids = [r.bans[side]!, r.bans[1 - side]!];
    const cards = ids.map((id, index) => {
      const holder = this.add.container(index === 0 ? -300 : 1380, 960);
      layer.add(holder);
      holder.add(this.add.text(0, -250, index === 0 ? t("arena.ban.mine") : t("arena.ban.theirs"), textStyle({ role: "display", size: 34, color: index === 0 ? ARENA_TONE.allyText : ARENA_TONE.foeText })).setOrigin(.5));
      const unit = this.unitOf(r, id);
      const card = new PortraitCard(this, 0, 0, { width: 300, height: 375, relicId: id, label: unit?.def.name ?? id, level: unit?.level, rarity: unit?.def.rarity, head: 'inside' });
      holder.add(card);
      const x = drawBanX(this, 300, 375).setScale(2.2).setAlpha(0);
      holder.add(x);
      return { holder, card, x };
    });
    const sync = (): void => cards.forEach(({ card }) => card.syncMask());
    const finish = (): void => {
      if (!layer.active || !this.scene.isActive()) return;
      layer.destroy();
      this.revealing = false;
      this.repaint();
    };
    // 박자는 씬 시계로 돌지만 손을 막는 시간은 실제 시간이 지킨다 — 프레임이 굶는 기기에서 씬 타이머가 밀려도
    // 공개 연출이 픽 차례를 붙잡아 시계가 다 가는 일이 없다.
    const guard = window.setTimeout(finish, reduce ? 1600 : 2800);
    layer.once(Phaser.GameObjects.Events.DESTROY, () => window.clearTimeout(guard));
    if (reduce) {
      cards.forEach(({ holder, x }, index) => { holder.setX(index === 0 ? 330 : 750); x.setScale(1).setAlpha(1); });
      sync();
      this.time.delayedCall(1100, finish);
      return;
    }
    this.tweens.add({ targets: cards.map((c) => c.holder), x: (_t: unknown, _k: string, _v: number, index: number) => (index === 0 ? 330 : 750), duration: 360, ease: 'Cubic.easeOut', onUpdate: sync });
    this.tweens.add({ targets: cards.map((c) => c.x), scale: 1, alpha: 1, duration: 200, delay: 460, ease: 'Back.easeOut', onComplete: () => this.cameras.main.shake(160, .006) });
    this.time.delayedCall(1500, () => {
      if (!layer.active) return;
      this.tweens.add({ targets: dim, alpha: 0, duration: 420 });
      cards.forEach(({ holder }, index) => {
        this.tweens.add({ targets: holder, x: L.x, y: L.y[index], scale: L.card.width / 300, duration: 420, ease: 'Cubic.easeInOut', onUpdate: sync });
      });
      this.time.delayedCall(460, finish);
    });
  }
}
