import { t } from "../i18n";
import { subscribeArenaChanges } from "../api/arenaRealtime";
import Phaser from 'phaser';
import { arenaAvailable, arenaCall, arenaError } from '../api/arenaApi';
import { Button } from '../ui/Button';
import { COLOR, textStyle } from '../ui/theme';
import { chipPoints, drawLayer, slantedRect } from '../ui/holo';
import { ARENA_TONE } from '../ui/arenaTheme';
import { addArenaRuleChips, arenaClockText } from '../ui/arenaRuleChips';
import { squeezeTextToWidth } from '../ui/textFit';
import { session } from '../state/session';
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
    /**
     * 요청 띠 — 화면 위에서 미끄러져 내려오는 보랏빛 판 한 장. 맨 위 줄은 「아레나 친선전」 표식과 남은 시간,
     * 그 아래 누가 보냈는지, 규칙 칩 한 줄(밴·선공·배치·중복이 저마다 그림을 단다), 맨 아래 거절·수락이다.
     * 규칙을 글 한 줄로 이어 적던 때는 무엇에 수락하는지가 읽히지 않았다.
     */
    private show(r: ArenaRoom): void {
        this.banner?.destroy(true);
        this.shown = r.id;
        this.scene.bringToTop();
        const H = 360;
        const body = this.add.container(540, 210).setDepth(10000);
        this.banner = body;
        body.add(drawLayer(this, 0, 0, chipPoints(1010, H, { bevel: { topLeft: 44, bottomRight: 44 } }), { fill: ARENA_TONE.panel, alpha: .98, edge: ARENA_TONE.accent, edgeAlpha: .9, glow: { color: ARENA_TONE.glow, strength: .35, height: .8 } }));
        const stripes = this.add.graphics();
        [[-120, .1], [60, .06]].forEach(([x0, a]) => { stripes.fillStyle(ARENA_TONE.spark, a); stripes.fillPoints([new Phaser.Geom.Point(x0, -H / 2), new Phaser.Geom.Point(x0 + 120, -H / 2), new Phaser.Geom.Point(x0 + 20, H / 2), new Phaser.Geom.Point(x0 - 100, H / 2)], true); });
        body.add(stripes);
        // 왼쪽 위 표식 — 무엇의 요청인지가 이름보다 먼저 읽힌다.
        const tag = this.add.text(0, 0, t("arena.invite.tag"), textStyle({ role: "display", size: 26, color: COLOR.ink }));
        const tagW = tag.width + 56;
        body.add(drawLayer(this, -470 + tagW / 2, -H / 2 + 44, slantedRect(tagW, 50, 18), { fill: 0xc2387d, alpha: 1, edge: ARENA_TONE.spark, edgeAlpha: 1 }));
        body.add(tag.setOrigin(.5).setPosition(-470 + tagW / 2, -H / 2 + 44));
        // 오른쪽 위 시계 — 요청이 언제 닫히는지.
        body.add(drawLayer(this, 400, -H / 2 + 44, chipPoints(150, 58, { bevel: { topLeft: 14, bottomRight: 14 } }), { fill: ARENA_TONE.deep, alpha: .95, edge: ARENA_TONE.accent, edgeAlpha: .9 }));
        const clock = this.add.text(400, -H / 2 + 44, arenaClockText(r.deadline), textStyle({ role: "display", size: 32, color: ARENA_TONE.accentText })).setOrigin(.5);
        body.add(clock);
        const tick = this.time.addEvent({ delay: 500, loop: true, callback: () => { if (clock.active) clock.setText(arenaClockText(r.deadline)); } });
        body.once('destroy', () => tick.remove());
        body.add(squeezeTextToWidth(this.add.text(0, -48, t("arena.invite.from", { name: r.players[0].name }), textStyle({ role: "display", size: 36, color: COLOR.ink })).setOrigin(.5).setShadow(0, 3, '#000000', 0, true, true), 920));
        addArenaRuleChips(this, body, 0, 22, r.rules, { size: 22, maxWidth: 940 });
        const error = this.add.text(0, H / 2 - 16, '', textStyle({ role: "body", size: 20, color: ARENA_TONE.sparkText })).setOrigin(.5);
        body.add(error);
        if (!session.settings.accessibility.reduceMotion) {
            body.y = -H;
            this.tweens.add({ targets: body, y: 210, duration: 420, ease: 'Back.easeOut' });
        }
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
                    error.setText(arenaError(e));
            }
            finally {
                busy = false;
            }
        };
        body.add(new Button(this, -240, 112, { width: 430, height: 92, fontSize: 34, label: t("arena.invite.decline"), onClick: () => void respond('decline') }));
        body.add(new Button(this, 240, 112, { width: 430, height: 92, fontSize: 34, label: t("arena.invite.accept"), variant: 'primary', fill: ARENA_TONE.confirm, accentColor: ARENA_TONE.accent, accentTextColor: COLOR.ink, decorDots: true, onClick: () => void respond('accept') }));
    }
}
