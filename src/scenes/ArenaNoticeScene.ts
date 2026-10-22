import { t } from "../i18n";
import { subscribeArenaChanges } from "../api/arenaRealtime";
import Phaser from 'phaser';
import { arenaAvailable, arenaCall, arenaError } from '../api/arenaApi';
import { Button } from '../ui/Button';
import { COLOR, textStyle } from '../ui/theme';
import { chipPoints, drawLayer } from '../ui/holo';
import type { ArenaRoom } from '../core/liveArena';
/** Persistent top banner; does not interrupt combat, account entry or another modal. */
export class ArenaNoticeScene extends Phaser.Scene {
    private banner?: Phaser.GameObjects.Container;
    private pending = false;
    private shown = '';
    constructor() { super({ key: 'arenaNotice', active: true }); }
    create(): void { const unsubscribe=subscribeArenaChanges(() => void this.poll());this.events.once('shutdown',unsubscribe); this.time.addEvent({ delay: 8000, loop: true, callback: () => void this.poll() }); }
    private async poll(): Promise<void> {
        if (this.pending)
            return;
        if (!arenaAvailable()) {
            this.banner?.destroy(true);
            this.banner = undefined;
            this.shown = '';
            return;
        }
        const active = this.scene.manager.getScenes(true).map(s => s.scene.key);
        if (!active.some(s => ['lobby', 'friends', 'duel', 'arena', 'arenaMatch', 'arenaRoom', 'relics', 'guild', 'shop', 'lab', 'archaeology', 'stageMap'].includes(s))) {
            this.banner?.setVisible(false);
            return;
        }
        this.pending = true;
        try {
            const status = await arenaCall();
            const invite = status.incoming[0];
            if (!invite) {
                this.banner?.destroy(true);
                this.banner = undefined;
                this.shown = '';
                return;
            }
            if (this.shown === invite.id && this.banner?.active) {
                this.banner.setVisible(true);
                this.scene.bringToTop();
                return;
            }
            this.show(invite);
        }
        catch { /* A notification outage never blocks gameplay. */ }
        finally {
            this.pending = false;
        }
    }
    private show(r: ArenaRoom): void {
        this.banner?.destroy(true);
        this.shown = r.id;
        this.scene.bringToTop();
        const body = this.add.container(540, 185).setDepth(10000);
        this.banner = body;
        body.add(drawLayer(this, 0, 0, chipPoints(1000, 270), { fill: 0x0e2332, alpha: .98, edge: COLOR.accent, edgeAlpha: .8 }));
        body.add(this.add.text(0, -80, t("arena.invite.from",{name:r.players[0].name}), textStyle({ role: "display", size: 32, color: COLOR.ink })).setOrigin(.5));
        body.add(this.add.text(0, -30, t("arena.invite.summary", { p0: r.rules.ban ? t("arena.rules.bannerBan") : t("arena.rules.bannerNoBan"), p1: r.rules.placement === 'alternate' ? t("arena.rules.openAlternate") : t("arena.rules.bannerHidden") }), textStyle({ role: "body", size: 24, color: COLOR.inkDim })).setOrigin(.5));
        let busy = false;
        const respond = async (kind: 'accept' | 'decline'): Promise<void> => {
            if (busy)
                return;
            busy = true;
            try {
                const status = await arenaCall(kind, { roomId: r.id });
                body.destroy(true);
                this.banner = undefined;
                if (kind === 'accept' && status.room) {
                    const source = this.scene.manager.getScenes(true).find(s => s !== this && s.scene.key !== 'effectOverlay');
                    source?.scene.start('arenaRoom', { roomId: r.id });
                }
            }
            catch (e) {
                if (body.active)
                    body.add(this.add.text(0, 115, arenaError(e), textStyle({ role: "body", size: 20, color: COLOR.ink })).setOrigin(.5));
            }
            finally {
                busy = false;
            }
        };
        body.add(new Button(this, -235, 60, { width: 420, height: 80, label: t("arena.invite.decline"), onClick: () => void respond('decline') }));
        body.add(new Button(this, 235, 60, { width: 420, height: 80, label: t("arena.invite.accept"), variant: 'primary', onClick: () => void respond('accept') }));
    }
}
