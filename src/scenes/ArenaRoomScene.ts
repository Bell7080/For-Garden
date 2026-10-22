import { t } from "../i18n";
import { subscribeArenaChanges } from "../api/arenaRealtime";
import Phaser from 'phaser';
import { arenaCall, arenaError, type ArenaStatus } from '../api/arenaApi';
import { arenaTurn, type ArenaAction, type ArenaRoom } from '../core/liveArena';
import { Button } from '../ui/Button';
import { PopupLayer } from '../ui/PopupLayer';
import { textStyle, COLOR } from '../ui/theme';
import { addSceneBackground, BACKGROUND } from '../ui/backgrounds';
import { addBackButton } from '../ui/IconButton';
import { startScene } from '../ui/screenTransition';
import { chipPoints, drawLayer } from '../ui/holo';
import { setDebugScene } from '../debug';
export class ArenaRoomScene extends Phaser.Scene {
    private roomId = '';
    private status?: ArenaStatus;
    private view!: Phaser.GameObjects.Container;
    private busy = false;
    private transitioning = false;
    private selected = '';
    private page = 0;
    private signature = '';
    private clock!: Phaser.GameObjects.Text;
    private error!: Phaser.GameObjects.Text;
    constructor() { super('arenaRoom'); }
    init(input: {
        roomId: string;
    }): void { this.roomId = input.roomId; }
    create(): void {
        this.status = undefined;
        this.busy = false;
        this.transitioning = false;
        this.selected = '';
        this.page = 0;
        this.signature = '';
        setDebugScene('arenaRoom');
        addSceneBackground(this, BACKGROUND.sortieDuel);
        this.add.rectangle(540,960,1080,1920,COLOR.void,.52).setDepth(-29);
        this.view = this.add.container(0, 0);
        this.clock = this.add.text(540, 270, '', textStyle({ role: "display", size: 34, color: COLOR.accentText })).setOrigin(.5);
        this.error = this.add.text(540, 1510, '', textStyle({ role: "body", size: 25, color: COLOR.ink, wrap: 900, align: 'center' })).setOrigin(.5);
        addBackButton(this, () => { const p = new PopupLayer(this, 2400); p.confirm({ title: t("arena.room.leave"), message: t("arena.room.leaveConfirm"), confirmLabel: t("arena.room.forfeit"), destructive: true }, () => void this.act({ kind: 'forfeit' })); });
        const unsubscribe = subscribeArenaChanges(() => void this.fetchStatus());
        this.events.once('shutdown', unsubscribe);
        this.time.addEvent({ delay: 2000, loop: true, callback: () => void this.fetchStatus() });
        void this.fetchStatus();
    }
    update(): void { const r = this.status?.room; if (r)
        this.clock.setText(['ban', 'place', 'invited'].includes(r.phase) ? t("arena.room.remaining", { p0: Math.max(0, Math.ceil((r.deadline - Date.now()) / 1000)) }) : ''); }
    private async fetchStatus(): Promise<void> {
        if (this.busy || this.transitioning)
            return;
        this.busy = true;
        try {
            const s = await arenaCall('status', { roomId: this.roomId });
            if (this.scene.isActive())
                this.adopt(s);
        }
        catch (e) {
            if (this.scene.isActive())
                this.error.setText(arenaError(e));
        }
        finally {
            this.busy = false;
        }
    }
    private async act(action: ArenaAction): Promise<void> {
        if (this.busy || this.transitioning)
            return;
        this.busy = true;
        try {
            const s = await arenaCall('action', { roomId: this.roomId, action });
            if (this.scene.isActive()) {
                this.selected = '';
                this.adopt(s);
                this.error.setText('');
            }
        }
        catch (e) {
            if (this.scene.isActive())
                this.error.setText(arenaError(e));
        }
        finally {
            this.busy = false;
        }
    }
    private adopt(s: ArenaStatus): void {
        this.status = s;
        const r = s.room;
        if (!r)
            return;
        if ((r.phase === 'battle' || r.phase === 'done') && r.lease && !this.transitioning) {
            this.transitioning = true;
            const a = r.players[0], b = r.players[1], picks = r.picks;
            startScene(this, 'battle', { mode: 'duel', requestId: r.id, attack: picks[0].map(p => p.relicId), opponentName: b.name, opponentScore: 0,
                units: picks[1].map(p => { const u = b.roster.find(u => u.def.id === p.relicId)!; return { relicId: p.relicId, level: u.level, breakthrough: u.breakthrough, stats: u.def.stats }; }),
                arena: { roomId: r.id, side: s.playerId === a.id ? 0 : 1, lease: r.lease, practice: (r as ArenaRoom & {
                        practice?: boolean;
                    }).practice === true } });
            return;
        }
        const signature = JSON.stringify([r.version, r.phase, this.page, this.selected]);
        if (signature === this.signature)
            return;
        this.signature = signature;
        this.paint(r, s.playerId);
    }
    private paint(r: ArenaRoom, playerId: string): void {
        this.view.removeAll(true);
        const side = r.players.findIndex(p => p.id === playerId), enemy = 1 - side;
        const label = (x: number, y: number, text: string, size = 30): void => { this.view.add(this.add.text(x, y, text, textStyle({ role: "display", size, color: COLOR.ink, align: 'center', wrap: 920 })).setOrigin(.5)); };
        label(540, 160, r.ranked ? t("arena.room.ranked") : t("arena.room.friendly"), 48);
        if (r.phase === 'invited') {
            label(540, 700, t("arena.invite.waiting"));
            label(540, 820, `${r.rules.ban ? t("arena.rules.oneBan") : t("arena.rules.noBan")} · ${r.rules.placement === 'alternate' ? t("arena.rules.alternate") : t("arena.rules.hidden")}`, 28);
            return;
        }
        if (r.phase === 'done' || r.phase === 'declined') {
            label(540, 700, r.phase === 'declined' ? t("arena.invite.closed") : r.winner === null ? t("arena.result.drawLabel") : r.winner === side ? t("arena.result.winLabel") : t("arena.result.lossLabel"), 42);
            label(540, 810, r.ranked ? t("arena.result.applied") : t("arena.result.friendlyNotice"), 28);
            this.view.add(new Button(this, 540, 1100, { width: 750, height: 110, label: t("arena.result.return"), onClick: () => startScene(this, 'arena') }));
            return;
        }
        const mine = r.players[side], opponent = r.players[enemy], ban = r.phase === 'ban';
        const myTurn = ban ? arenaTurn(r) === side : r.rules.placement === 'hidden' ? !r.locked[side] : arenaTurn(r) === side;
        label(540, 350, ban ? (myTurn ? t("arena.ban.choose") : t("arena.ban.wait")) : myTurn ? t("arena.placement.choose") : t("arena.placement.wait"), 31);
        label(540, 420, `${mine.name}  VS  ${opponent.name}`, 27);
        if (!ban) {
            const field = this.add.container(540, 770);
            this.view.add(field);
            field.add(drawLayer(this, 0, 0, chipPoints(860, 510), { fill: 0x09151f, alpha: .95, edge: COLOR.accent, edgeAlpha: .6 }));
            const line = this.add.graphics();
            line.lineStyle(2, 0x70bfe0, .4).lineBetween(-410, -10, 410, -10);
            field.add(line);
            field.add(this.add.text(0, -225, r.rules.placement === 'hidden' ? t("arena.placement.opponentHidden") : t("arena.placement.opponent"), textStyle({ role: "body", size: 23, color: COLOR.inkDim })).setOrigin(.5));
            r.picks[enemy].forEach(p => field.add(this.add.text(-365 + p.x * 730, -75 - p.y * 100, opponent.roster.find(u => u.def.id === p.relicId)?.def.name ?? p.relicId, textStyle({ role: "emphasis", size: 26, color: '#ffb4ac' })).setOrigin(.5)));
            r.picks[side].forEach(p => field.add(this.add.text(-365 + p.x * 730, 205 - p.y * 175, mine.roster.find(u => u.def.id === p.relicId)?.def.name ?? p.relicId, textStyle({ role: "emphasis", size: 26, color: '#a4e5ff' })).setOrigin(.5)));
            const hit = this.add.rectangle(0, 140, 760, 200, 0xffffff, 0.001).setInteractive();
            field.add(hit);
            hit.on('pointerdown', (pointer: Phaser.Input.Pointer) => { if (!myTurn || !this.selected)
                return; const x = Math.min(1, Math.max(0, (pointer.x - 175) / 730)), y = Math.min(1, Math.max(0, (975 - pointer.y) / 175)); void this.act({ kind: 'place', relicId: this.selected, x, y }); });
            label(540, 1080, t("arena.placement.summary", { p0: r.picks[side].length, p1: r.bans[side] ?? t("arena.none"), p2: r.bans[enemy] ?? t("arena.noneOther") }), 24);
        }
        const units = ban ? opponent.roster : mine.roster, available = units.filter(u => ban || (!r.picks[side].some(p => p.relicId === u.def.id) && r.bans[enemy] !== u.def.id));
        const pages = Math.max(1, Math.ceil(available.length / 9));
        this.page = Math.min(this.page, pages - 1);
        available.slice(this.page * 9, this.page * 9 + 9).forEach((u, i) => this.view.add(new Button(this, 230 + (i % 3) * 310, (ban ? 700 : 1170) + Math.floor(i / 3) * 105, { width: 290, height: 90, label: `${this.selected === u.def.id ? '✓ ' : ''}${u.def.name}`, sub: `LV.${u.level}`, fontSize: 27, onClick: () => {
                if (!myTurn)
                    return;
                if (ban)
                    void this.act({ kind: 'ban', relicId: u.def.id });
                else {
                    this.selected = u.def.id;
                    this.signature = '';
                    this.adopt(this.status!);
                }
            } })));
        if (pages > 1)
            this.view.add(new Button(this, 540, ban ? 1100 : 1530, { width: 350, height: 80, label: t("arena.roster.next", { p0: this.page + 1, p1: pages }), onClick: () => { this.page = (this.page + 1) % pages; this.signature = ''; this.adopt(this.status!); } }));
        if (!ban && r.rules.placement === 'hidden' && !r.locked[side]) {
            this.view.add(new Button(this, 300, 1670, { width: 400, height: 110, label: t("arena.placement.undo"), onClick: () => void this.act({ kind: 'undo' }) }));
            this.view.add(new Button(this, 770, 1670, { width: 400, height: 110, label: t("arena.placement.lock"), variant: 'primary', onClick: () => void this.act({ kind: 'lock' }) }));
        }
    }
}
