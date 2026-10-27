import { t } from "../i18n";
import { subscribeArenaChanges } from "../api/arenaRealtime";
import Phaser from 'phaser';
import { arenaCall, arenaError, arenaRanking, type ArenaStatus } from '../api/arenaApi';
import { arenaStanding, arenaTierId, type ArenaTierId } from '../core/arenaStanding';
import { session } from '../state/session';
import { addSceneBackground, BACKGROUND } from '../ui/backgrounds';
import { Button } from '../ui/Button';
import { addBackButton } from '../ui/IconButton';
import { startScene, playSceneEntrance } from '../ui/screenTransition';
import { COLOR, textStyle } from '../ui/theme';
import { chipPoints, drawLayer, drawVignette, slantedRect } from '../ui/holo';
import { addDuelTierEmblem } from '../ui/DuelTierEmblem';
import { ProfileAvatar } from '../ui/ProfileAvatar';
import { playerProfileDisplay, profileAvatarContent } from '../state/playerProfile';
import { PopupLayer } from '../ui/PopupLayer';
import { addArenaMascots } from '../ui/ArenaMascots';
import { addArenaBackdrop, ARENA_TONE } from '../ui/arenaTheme';
import { setDebugScene } from '../debug';
import { ARENA_LOBBY as S } from '../ui/arenaLobbyLayout';
import { DUEL_PROFILE as P, DUEL_TIER_COLOR, duelProfileRowY } from '../ui/duelLayout';
import { HoloBar } from '../ui/holo';
import { addSectionTitle } from '../ui/SectionTitle';
import { squeezeTextToWidth } from '../ui/textFit';
import { addRankChip, addRankRewardChip } from "../ui/RankingChips";
import { DuelRankingPopup, type RankingSource } from '../ui/DuelRankingPopup';
import { openArenaWeeklyRewards } from '../ui/ArenaRewardPopup';

/**
 * 아레나 입구 — 결투장 입구와 같은 구도로 **내 자리**를 보여 준다. 가운데 티어 휘장과 다음 티어까지의 게이지,
 * 그 아래 전투 프로필(얼굴·이름·레벨·전적 · 현재/최고/지난주 티어 · 연승과 다음 판의 연승 효과), 왼쪽 위의
 * 순위 칩과 주간 보상 칩, 맨 아래 매칭이다. 판마다 주는 휘장이 없으므로 보상은 주간 보상 칩이 연다.
 * 값은 서버 상태(`server_arena_standing`) 하나에서 읽고 티어·게이지는 `arenaStanding`이 짓는다.
 */
export class ArenaScene extends Phaser.Scene {
    private view!: Phaser.GameObjects.Container;
    private popups!: PopupLayer;
    constructor() { super('arena'); }
    create(): void {
        setDebugScene('arena');
        addSceneBackground(this, BACKGROUND.sortieDuel);
        addArenaBackdrop(this, -29, .72);
        drawVignette(this, 1080, 1920, { depth: -20, strength: .7 });
        this.popups = new PopupLayer(this, 2200);
        this.view = this.add.container(0, 0);
        this.add.text(S.side, S.title.y, t("arena.title"), textStyle({ role: "display", size: 54, color: COLOR.ink })).setOrigin(0, .5).setShadow(0, 4, '#05070a', 6, false, true);
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
        const tierId = arenaTierId(s.score);
        setDebugScene('arena', `${tierId}:${s.score}`);
        this.paintWeekClock(s);
        this.paintSideChips(s, tierId);
        this.paintStanding(s.score);
        this.paintProfile(s);
        this.view.add(this.add.text(540, S.rules.y, t("arena.lobby.rules"), textStyle({ role: "body", size: 26, color: COLOR.inkDim, align: 'center', wrap: S.rules.wrap })).setOrigin(.5).setShadow(0, 3, '#000000', 0, true, true));
        const resume = s.room && !['done', 'declined'].includes(s.room.phase);
        this.view.add(new Button(this, 540, S.match.y, { width: S.match.width, height: S.match.height, label: resume ? t("arena.resume") : t("arena.match.start"), variant: 'primary', accentColor: ARENA_TONE.accent, accentTextColor: COLOR.ink, fill: ARENA_TONE.confirm, decorDots: true, onClick: () => startScene(this, resume ? 'arenaRoom' : 'arenaMatch', resume ? { roomId: s.room!.id } : undefined) }));
    }
    /** 제목 아래 — 주간 정산까지 남은 시간. 서버 시각으로 잰다(기기 시계를 믿지 않는다). */
    private paintWeekClock(s: ArenaStatus): void {
        if (!s.weekEndsAt || !s.serverTime) return;
        const days = Math.max(0, (Date.parse(s.weekEndsAt) - Date.parse(s.serverTime)) / 86_400_000);
        this.view.add(this.add.text(S.side, S.season.y, t("arena.weekly.endsIn", { days: Math.floor(days), hours: Math.floor((days % 1) * 24) }), textStyle({ role: "body", size: 26, color: COLOR.inkDim })).setOrigin(0, .5));
    }
    /** 왼쪽 칩 둘 — 순위(오른쪽에 내 등수)와 주간 보상(티어 보상 + 순위 보너스 표). */
    private paintSideChips(s: ArenaStatus, tierId: ArenaTierId): void {
        const { rankChip, rewardChip } = S;
        const played = s.wins + s.losses > 0;
        const rank = s.rank ?? null;
        addRankChip(this, this.view, rankChip.x, rankChip.y, { size: rankChip.size, rank, rankColor: ARENA_TONE.accentText, onClick: () => new DuelRankingPopup(this, this.popups, tierId, undefined, this.rankingSource(s)).open() });
        addRankRewardChip(this, this.view, rewardChip.x, rewardChip.y, { period: "weekly", size: rewardChip.size, onClick: () => openArenaWeeklyRewards(this, this.popups, played ? s.score : null, rank) });
    }
    private rankingSource(s: ArenaStatus): RankingSource {
        const played = s.wins + s.losses > 0;
        return {
            title: t("arena.ranking.title"),
            load: async () => {
                const ranking = await arenaRanking();
                const entries = ranking.entries.map((entry) => ({ ...entry, tierId: arenaTierId(entry.score) }));
                const mine = entries.find((entry) => entry.isMe) ?? (ranking.rank !== null && played
                    ? { rank: ranking.rank, displayName: playerProfileDisplay(session).displayName, score: s.score, isMe: true, tierId: arenaTierId(s.score) }
                    : null);
                return { entries, me: mine };
            },
            openRewards: (me) => openArenaWeeklyRewards(this, this.popups, played ? s.score : null, me?.rank ?? null),
            openTiers: () => openArenaWeeklyRewards(this, this.popups, played ? s.score : null, s.rank ?? null),
        };
    }
    /** 가운데 위 — 티어 휘장, 티어 이름, 다음 티어까지의 RP 게이지와 그 끝의 다음 휘장(결투장과 같은 구도). */
    private paintStanding(score: number): void {
        const { emblem, tierName, gauge } = S;
        const standing = arenaStanding(score);
        const tone = DUEL_TIER_COLOR[standing.tier.id];
        addDuelTierEmblem(this, this.view, emblem.x, emblem.y, emblem.size, standing.tier.id);
        this.view.add(this.add.text(emblem.x, tierName.y, t(`duel.tier.${standing.tier.id}`), textStyle({ role: "display", size: 46, color: tone.text })).setOrigin(.5).setShadow(0, 4, '#05070a', 6, false, true));
        const bar = new HoloBar(this, emblem.x - 30, gauge.y, gauge.width, gauge.height, { color: tone.fill, outline: true, ticks: 3, trackAlpha: .82, shadow: {} });
        bar.addTo(this.view);
        bar.setValue(standing.progress);
        const label = standing.nextFloor === null ? t("duel.gauge.max") : `${score.toLocaleString()} / ${standing.nextFloor.toLocaleString()} RP`;
        this.view.add(this.add.text(emblem.x - 30, gauge.y, label, textStyle({ role: "display", size: 24, color: COLOR.ink })).setOrigin(.5).setStroke('#05070a', 5));
        if (standing.nextFloor !== null) addDuelTierEmblem(this, this.view, emblem.x - 30 + gauge.width / 2 + 16 + gauge.nextSize / 2, gauge.y, gauge.nextSize, arenaTierId(standing.nextFloor));
    }
    /**
     * 전투 프로필 — 결투장과 같은 판·같은 줄 규격. 왼쪽이 얼굴·이름·레벨·전적, 오른쪽이 현재 티어 · 최고 기록 ·
     * 지난주(마감 때의 티어와 순위) · 연승이다. 다음 판을 이기면 얹히는 연승 효과는 칩으로 선다.
     */
    private paintProfile(s: ArenaStatus): void {
        const panel = this.add.container(540, P.y);
        this.view.add(panel);
        const halfW = P.width / 2, halfH = P.height / 2;
        panel.add(drawLayer(this, 0, 0, chipPoints(P.width, P.height), { fill: ARENA_TONE.panel, alpha: .9, edge: ARENA_TONE.accent, edgeAlpha: .45 }));
        panel.add(addSectionTitle(this, -halfW, -halfH, t("duel.profile.title"), { size: 28 }));
        const profile = playerProfileDisplay(session);
        const avatar = P.avatar;
        panel.add(new ProfileAvatar(this, avatar.x, avatar.y, { size: avatar.size, frameId: profile.frameId, portraitAssetId: profile.avatar?.portraitAssetId, fallback: profileAvatarContent(profile, () => false).fallback }));
        panel.add(squeezeTextToWidth(this.add.text(avatar.x, avatar.nameY, profile.displayName, textStyle({ role: "display", size: 38, color: COLOR.ink })).setOrigin(.5).setStroke('#05070a', 5), avatar.nameRoom));
        panel.add(this.add.text(avatar.x, avatar.levelY, `LV.${profile.level}`, textStyle({ role: "display", size: 30, color: ARENA_TONE.accentText })).setOrigin(.5));
        panel.add(this.add.text(avatar.x, avatar.recordY, t("duel.record", { wins: s.wins, losses: s.losses }), textStyle({ role: "emphasis", size: 24, color: COLOR.inkDim })).setOrigin(.5));

        const played = s.wins + s.losses > 0;
        const rp = (score: number): string => t("arena.rp", { score: score.toLocaleString() });
        this.paintTierRow(panel, 0, t("duel.profile.current"), arenaTierId(s.score), rp(s.score));
        const best = Math.max(s.bestScore ?? s.score, s.score);
        this.paintTierRow(panel, 1, t("arena.profile.best"), played ? arenaTierId(best) : null, played ? rp(best) : undefined);
        const last = s.lastWeek ?? null;
        this.paintTierRow(panel, 2, t("arena.profile.lastWeek"), last ? arenaTierId(last.score) : null,
            last ? (last.rank !== null ? t("duel.rank.value", { rank: last.rank.toLocaleString() }) : rp(last.score)) : undefined);

        const y = duelProfileRowY(3);
        const streak = s.winStreak ?? 0, bonus = s.nextStreakBonus ?? 0;
        panel.add(this.add.rectangle((P.rows.labelX + halfW - P.padX) / 2, y - P.rows.gap / 2, halfW - P.padX - P.rows.labelX, 1, COLOR.panelEdge, .35));
        panel.add(this.add.text(P.rows.labelX, y, t("duel.profile.streak"), textStyle({ role: "body", size: 24, color: COLOR.inkDim })).setOrigin(0, .5));
        panel.add(this.add.text(P.rows.emblemX - P.rows.emblemSize / 2, y, t("duel.profile.streakValue", { streak }), textStyle({ role: "display", size: 34, color: streak > 0 ? ARENA_TONE.accentText : COLOR.inkDim })).setOrigin(0, .5));
        if (bonus > 0) {
            const chip = P.rows.bonusChip, cx = halfW - P.padX - chip.width / 2;
            panel.add(drawLayer(this, cx, y, slantedRect(chip.width, chip.height), { fill: 0x2a1640, alpha: .94, edge: ARENA_TONE.accent, edgeAlpha: .9, glow: { color: ARENA_TONE.accent, strength: .25, height: .8 } }));
            panel.add(this.add.text(cx, y, t("arena.profile.streakBonus", { bonus }), textStyle({ role: "emphasis", size: 24, color: ARENA_TONE.accentText })).setOrigin(.5));
        } else {
            panel.add(this.add.text(halfW - P.padX, y, t("duel.profile.bestStreak", { streak: s.bestStreak ?? 0 }), textStyle({ role: "body", size: 22, color: COLOR.inkDim })).setOrigin(1, .5));
        }
    }
    /** 프로필의 티어 한 줄. 기록이 없으면 휘장 없이 흐린 「기록 없음」만 선다. */
    private paintTierRow(panel: Phaser.GameObjects.Container, index: number, label: string, tierId: ArenaTierId | null, sub?: string): void {
        const { rows } = P;
        const y = duelProfileRowY(index);
        panel.add(this.add.text(rows.labelX, y, label, textStyle({ role: "body", size: 24, color: COLOR.inkDim })).setOrigin(0, .5));
        if (tierId) addDuelTierEmblem(this, panel, rows.emblemX, y, rows.emblemSize, tierId);
        const value = tierId ? t(`duel.tier.${tierId}`) : t("duel.profile.noRecord");
        const style = tierId ? textStyle({ role: "display", size: 30, color: DUEL_TIER_COLOR[tierId].text }) : textStyle({ role: "emphasis", size: 24, color: COLOR.inkDim });
        panel.add(this.add.text(tierId ? rows.valueX : rows.emblemX - rows.emblemSize / 2, y, value, style).setOrigin(0, .5));
        if (sub) panel.add(this.add.text(P.width / 2 - P.padX, y, sub, textStyle({ role: "emphasis", size: 24, color: COLOR.ink })).setOrigin(1, .5));
        if (index > 0) panel.add(this.add.rectangle((rows.labelX + P.width / 2 - P.padX) / 2, y - rows.gap / 2, P.width / 2 - P.padX - rows.labelX, 1, COLOR.panelEdge, .35));
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
