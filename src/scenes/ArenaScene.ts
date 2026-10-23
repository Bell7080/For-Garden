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
import { addArenaBackdrop, ARENA_TONE } from '../ui/arenaTheme';
import { setDebugScene } from '../debug';
export class ArenaScene extends Phaser.Scene {
    private view!: Phaser.GameObjects.Container;
    constructor() { super('arena'); }
    create(): void {
        setDebugScene('arena');
        addSceneBackground(this, BACKGROUND.sortieDuel);
        addArenaBackdrop(this, -29, .72);
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
        this.view.add(this.add.text(540, 635, `${s.score.toLocaleString()} RP`, textStyle({ role: "display", size: 32, color: ARENA_TONE.accentText })).setOrigin(.5));
        const card = this.add.container(540, 930);
        this.view.add(card);
        card.add(drawLayer(this, 0, 0, chipPoints(900, 400), { fill: ARENA_TONE.panel, alpha: .94, edge: ARENA_TONE.accent, edgeAlpha: .7 }));
        const profile = playerProfileDisplay(session);
        card.add(new ProfileAvatar(this, -270, -40, { size: 150, frameId: profile.frameId, portraitAssetId: profile.avatar?.portraitAssetId, fallback: profileAvatarContent(profile, () => false).fallback }));
        card.add(this.add.text(-80, -100, profile.displayName, textStyle({ role: "display", size: 36, color: COLOR.ink })));
        card.add(this.add.text(-80, -35, t("arena.record", { p0: profile.level, p1: s.wins, p2: s.losses }), textStyle({ role: "body", size: 28, color: COLOR.inkDim })));
        card.add(this.add.text(-80, 40, t("arena.tier.label", { p0: tier }), textStyle({ role: "display", size: 34, color: ARENA_TONE.accentText })));
        card.add(this.add.text(0, 145, t("arena.tier.separate"), textStyle({ role: "body", size: 24, color: COLOR.inkDim })).setOrigin(.5));
        this.view.add(new Button(this, 540, 1240, { width: 650, height: 90, label: t("arena.tier.guideButton"), accentColor: ARENA_TONE.accent, onClick: () => new PopupLayer(this, 2200).confirm({ title: t("arena.tier.guideTitle"), message: ARENA_TIERS.map(row => `${t(`duel.tier.${row.name}`)}  ${row.score.toLocaleString()} RP`).join('\n'), confirmLabel: t("arena.confirm"), cancelLabel: false }) }));
        this.view.add(this.add.text(540, 1390, t("arena.lobby.rules"), textStyle({ role: "body", size: 28, color: COLOR.inkDim, align: 'center' })).setOrigin(.5));
        const resume = s.room && !['done', 'declined'].includes(s.room.phase);
        this.view.add(new Button(this, 540, 1650, { width: 860, height: 140, label: resume ? t("arena.resume") : t("arena.match.start"), variant: 'primary', accentColor: ARENA_TONE.accent, accentTextColor: COLOR.ink, fill: ARENA_TONE.confirm, decorDots: true, onClick: () => startScene(this, resume ? 'arenaRoom' : 'arenaMatch', resume ? { roomId: s.room!.id } : undefined) }));
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
        addArenaBackdrop(this, -29, .86);
        drawVignette(this, 1080, 1920, { depth: -20, strength: .8 });
        this.add.text(540, 330, t("arena.match.searching"), textStyle({ role: "display", size: 52, color: COLOR.ink })).setOrigin(.5).setShadow(0, 5, '#000000', 0, true, true);
        // 흐른 시간은 보랏빛 칩 한 장에 크게 선다 — 기다리는 사람이 가장 자주 보는 수다.
        this.add.existing(drawLayer(this, 540, 470, chipPoints(360, 110), { fill: ARENA_TONE.panel, alpha: .92, edge: ARENA_TONE.accent, edgeAlpha: .9 }));
        this.label = this.add.text(540, 470, '00:00', textStyle({ role: "display", size: 66, color: ARENA_TONE.accentText })).setOrigin(.5);
        this.addRadar(540, 1000);
        const mascots = this.add.container(0, 0);
        addArenaMascots(this, mascots, 540, 1090, 380, true, 10, { spread: 0.9 });
        this.add.text(540, 1390, t("arena.match.description"), textStyle({ role: "body", size: 30, color: COLOR.ink, align: 'center' })).setOrigin(.5).setShadow(0, 3, '#000000', 0, true, true);
        this.error = this.add.text(540, 1490, '', textStyle({ role: "body", size: 25, color: ARENA_TONE.sparkText, wrap: 900, align: 'center' })).setOrigin(.5);
        // 취소는 화면에서 가장 큰 조작이다 — 분홍 강조 판에 점 무늬를 깔아 어디서나 먼저 읽힌다.
        this.add.existing(new Button(this, 540, 1640, { width: 820, height: 140, label: t("arena.match.cancel"), fontSize: 46, variant: 'primary', fill: 0xc2387d, accentColor: ARENA_TONE.spark, accentTextColor: COLOR.ink, decorDots: true, onClick: () => void this.cancel() }));
        const unsubscribe = subscribeArenaChanges(() => void this.poll());
        this.events.once('shutdown', unsubscribe);
        this.time.addEvent({ delay: 5000, loop: true, callback: () => void this.poll() });
        void this.poll();
        this.events.once('shutdown', () => { this.leaving = true; });
    }
    /** 맞부딪히는 두 몸 뒤에서 도는 마름모 고리 둘과 훑는 빛. 움직임 줄이기에서는 멈춘 채 선다. */
    private addRadar(x: number, y: number): void {
        // 바닥에 누운 고리로 읽히도록 세로로 누른 판 안에서 돈다 — 타원을 돌리면 찌그러져 보인다.
        const floor = this.add.container(x, y).setScale(1, .5);
        const ring = (radius: number, alpha: number): Phaser.GameObjects.Graphics => {
            const g = this.add.graphics();
            floor.add(g);
            for (let i = 0; i < 24; i += 1) {
                const a = (i / 24) * Math.PI * 2, size = i % 3 === 0 ? 11 : 6;
                const px = Math.cos(a) * radius, py = Math.sin(a) * radius;
                g.fillStyle(i % 3 === 0 ? ARENA_TONE.spark : ARENA_TONE.accent, alpha);
                g.fillPoints([new Phaser.Geom.Point(px, py - size), new Phaser.Geom.Point(px + size * .8, py), new Phaser.Geom.Point(px, py + size), new Phaser.Geom.Point(px - size * .8, py)], true);
            }
            return g;
        };
        const outer = ring(440, .55), inner = ring(320, .4);
        const sweep = this.add.graphics();
        floor.addAt(sweep, 0);
        sweep.fillStyle(ARENA_TONE.glow, .2).fillPoints([new Phaser.Geom.Point(0, 0), new Phaser.Geom.Point(460, -90), new Phaser.Geom.Point(460, 90)], true);
        if (session.settings.accessibility.reduceMotion) return;
        this.tweens.add({ targets: outer, angle: 360, duration: 24000, repeat: -1 });
        this.tweens.add({ targets: inner, angle: -360, duration: 18000, repeat: -1 });
        this.tweens.add({ targets: sweep, angle: 360, duration: 3200, repeat: -1 });
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
