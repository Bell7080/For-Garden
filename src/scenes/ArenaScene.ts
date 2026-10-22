import { t } from "../i18n";
import { subscribeArenaChanges } from "../api/arenaRealtime";
import Phaser from 'phaser';
import { arenaCall, arenaError, type ArenaStatus } from '../api/arenaApi';
import { ARENA_TIERS, arenaTier } from '../core/liveArena';
import { session } from '../state/session';
import { addSceneBackground, BACKGROUND } from '../ui/backgrounds';
import { Button } from '../ui/Button';
import { addBackButton } from '../ui/IconButton';
import { startScene, playSceneEntrance } from '../ui/screenTransition';
import { COLOR, textStyle } from '../ui/theme';
import { chipPoints, drawLayer, drawVignette } from '../ui/holo';
import { addDuelTierEmblem } from '../ui/DuelTierEmblem';
import { ProfileAvatar } from '../ui/ProfileAvatar';
import { playerProfileDisplay, profileAvatarContent } from '../state/playerProfile';
import { PopupLayer } from '../ui/PopupLayer';
import { addArenaMascots } from '../ui/ArenaMascots';
import { setDebugScene } from '../debug';
export class ArenaScene extends Phaser.Scene {
    private view!: Phaser.GameObjects.Container;
    constructor() { super('arena'); }
    create(): void {
        setDebugScene('arena');
        addSceneBackground(this, BACKGROUND.sortieDuel);
        this.add.rectangle(540,960,1080,1920,COLOR.void,.52).setDepth(-29);
        drawVignette(this, 1080, 1920, { depth: -20, strength: .7 });
        this.view = this.add.container(0, 0);
        this.add.text(60, 180, t("arena.title"), textStyle({ role: "display", size: 54, color: COLOR.ink }));
        addBackButton(this, () => startScene(this, 'lobby', { menu: 'duel' }));
        void this.fetchStatus();
        playSceneEntrance(this);
    }
    private async fetchStatus(): Promise<void> {
        try {
            const s = await arenaCall();
            if (this.scene.isActive())
                this.paint(s);
        }
        catch (e) {
            if (this.scene.isActive()) {
                this.view.removeAll(true);
                this.view.add(this.add.text(540, 650, arenaError(e), textStyle({ role: "body", size: 28, color: COLOR.ink, wrap: 850 })).setOrigin(.5));
                this.view.add(new Button(this, 540, 850, { width: 600, height: 105, label: t("arena.reconnect"), onClick: () => void this.fetchStatus() }));
            }
        }
    }
    private paint(s: ArenaStatus): void {
        this.view.removeAll(true);
        const tierId = arenaTier(s.score), tier=t(`duel.tier.${tierId}`), index = ARENA_TIERS.findIndex(row => row.name === tierId);
        const ids = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'master'] as const;
        addDuelTierEmblem(this, this.view, 540, 410, 210, ids[index]);
        this.view.add(this.add.text(540, 570, tier, textStyle({ role: "display", size: 48, color: COLOR.ink })).setOrigin(.5));
        this.view.add(this.add.text(540, 635, `${s.score.toLocaleString()} RP`, textStyle({ role: "display", size: 32, color: COLOR.accentText })).setOrigin(.5));
        const card = this.add.container(540, 930);
        this.view.add(card);
        card.add(drawLayer(this, 0, 0, chipPoints(900, 400), { fill: 0x101720, alpha: .94, edge: COLOR.accent, edgeAlpha: .4 }));
        const profile = playerProfileDisplay(session);
        card.add(new ProfileAvatar(this, -270, -40, { size: 150, frameId: profile.frameId, portraitAssetId: profile.avatar?.portraitAssetId, fallback: profileAvatarContent(profile, () => false).fallback }));
        card.add(this.add.text(-80, -100, profile.displayName, textStyle({ role: "display", size: 36, color: COLOR.ink })));
        card.add(this.add.text(-80, -35, t("arena.record", { p0: profile.level, p1: s.wins, p2: s.losses }), textStyle({ role: "body", size: 28, color: COLOR.inkDim })));
        card.add(this.add.text(-80, 40, t("arena.tier.label", { p0: tier }), textStyle({ role: "display", size: 34, color: COLOR.accentText })));
        card.add(this.add.text(0, 145, t("arena.tier.separate"), textStyle({ role: "body", size: 24, color: COLOR.inkDim })).setOrigin(.5));
        this.view.add(new Button(this, 540, 1240, { width: 650, height: 90, label: t("arena.tier.guideButton"), onClick: () => new PopupLayer(this, 2200).confirm({ title: t("arena.tier.guideTitle"), message: ARENA_TIERS.map(row => `${t(`duel.tier.${row.name}`)}  ${row.score.toLocaleString()} RP`).join('\n'), confirmLabel: t("arena.confirm"), cancelLabel: false }) }));
        this.view.add(this.add.text(540, 1390, t("arena.lobby.rules"), textStyle({ role: "body", size: 28, color: COLOR.inkDim, align: 'center' })).setOrigin(.5));
        const resume = s.room && !['done', 'declined'].includes(s.room.phase);
        this.view.add(new Button(this, 540, 1650, { width: 860, height: 140, label: resume ? t("arena.resume") : t("arena.match.start"), variant: 'primary', onClick: () => startScene(this, resume ? 'arenaRoom' : 'arenaMatch', resume ? { roomId: s.room!.id } : undefined) }));
    }
}
export class ArenaMatchScene extends Phaser.Scene {
    private busy = false;
    private leaving = false;
    private startedAt = 0;
    private label!: Phaser.GameObjects.Text;
    private error!: Phaser.GameObjects.Text;
    constructor() { super('arenaMatch'); }
    create(): void {
        this.busy = false;
        this.leaving = false;
        this.startedAt = Date.now();
        setDebugScene('arenaMatch');
        addSceneBackground(this, BACKGROUND.sortieDuel);
        this.add.rectangle(540,960,1080,1920,COLOR.void,.52).setDepth(-29);
        drawVignette(this, 1080, 1920, { depth: -20, strength: .8 });
        this.add.text(540, 400, t("arena.match.searching"), textStyle({ role: "display", size: 48, color: COLOR.ink })).setOrigin(.5);
        this.label = this.add.text(540, 530, '00:00', textStyle({ role: "display", size: 64, color: COLOR.accentText })).setOrigin(.5);
        const mascots = this.add.container(0, 0);
        addArenaMascots(this, mascots, 540, 1150, 350, false, 10);
        this.add.text(540, 1300, t("arena.match.description"), textStyle({ role: "body", size: 28, color: COLOR.inkDim, align: 'center' })).setOrigin(.5);
        this.error = this.add.text(540, 1420, '', textStyle({ role: "body", size: 25, color: COLOR.ink, wrap: 900, align: 'center' })).setOrigin(.5);
        this.add.existing(new Button(this, 540, 1640, { width: 800, height: 120, label: t("arena.match.cancel"), onClick: () => void this.cancel() }));
        const unsubscribe = subscribeArenaChanges(() => void this.poll());
        this.events.once('shutdown', unsubscribe);
        this.time.addEvent({ delay: 5000, loop: true, callback: () => void this.poll() });
        void this.poll();
        this.events.once('shutdown', () => { this.leaving = true; });
    }
    update(): void { const seconds = Math.floor((Date.now() - this.startedAt) / 1000); this.label?.setText(`${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`); }
    private async poll(): Promise<void> {
        if (this.busy || this.leaving)
            return;
        this.busy = true;
        try {
            const s = await arenaCall('queue');
            if (!this.scene.isActive() || this.leaving)
                return;
            if (s.queuedAt)
                this.startedAt = Date.parse(s.queuedAt);
            if (s.room) {
                this.leaving = true;
                startScene(this, 'arenaRoom', { roomId: s.room.id });
            }
            else
                this.error.setText('');
        }
        catch (e) {
            if (this.scene.isActive())
                this.error.setText(arenaError(e));
        }
        finally {
            this.busy = false;
        }
    }
    private async cancel(): Promise<void> {
        if (this.leaving)
            return;
        this.leaving = true;
        try {
            const s = await arenaCall('cancel');
            if (!this.scene.isActive())
                return;
            if (s.room && !['done', 'declined'].includes(s.room.phase))
                startScene(this, 'arenaRoom', { roomId: s.room.id });
            else
                startScene(this, 'arena');
        }
        catch (e) {
            this.leaving = false;
            if (this.scene.isActive())
                this.error.setText(arenaError(e));
        }
    }
}
