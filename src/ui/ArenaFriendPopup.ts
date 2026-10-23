import { t } from "../i18n";
import type Phaser from 'phaser';
import { arenaCall, arenaError } from '../api/arenaApi';
import type { ArenaRules } from '../core/liveArena';
import { PopupLayer } from './PopupLayer';
import { Button } from './Button';
import { textStyle, COLOR } from './theme';
import { startScene } from './screenTransition';
/** Friendly defense practice is immediate; live arena invites carry the requester's explicit rules. */
export function openArenaFriendPopup(scene: Phaser.Scene, popups: PopupLayer, target: string, name: string): void {
    let rules: ArenaRules = { ban: true, order: 'random', placement: 'alternate', unique: true }, busy = false;
    const show = (): void => {
        popups.open({ width: 900, height: 1150, title: t("arena.friend.title", { p0: name }), dim: true }, (body, close) => {
            const error = scene.add.text(0, 450, '', textStyle({ role: "body", size: 24, color: COLOR.inkDim })).setOrigin(.5);
            body.add(error);
            const run = async (kind: 'practice' | 'invite'): Promise<void> => {
                if (busy)
                    return;
                busy = true;
                try {
                    const status = await arenaCall(kind, { target, rules });
                    if (!scene.scene.isActive())
                        return;
                    close();
                    startScene(scene, 'arenaRoom', { roomId: status.room!.id });
                }
                catch (e) {
                    if (body.active)
                        error.setText(arenaError(e));
                }
                finally {
                    busy = false;
                }
            };
            body.add(new Button(scene, 0, -400, { width: 740, height: 110, label: t("arena.friend.practice"), sub: t("arena.friend.free"), onClick: () => void run('practice') }));
            body.add(scene.add.text(0, -265, t("arena.friend.live"), textStyle({ role: "display", size: 34, color: COLOR.ink })).setOrigin(.5));
            const option = (y: number, label: string, next: () => void): void => { body.add(new Button(scene, 0, y, { width: 740, height: 95, label, onClick: () => { if (busy)
                    return; next(); close(); show(); } })); };
            option(-155, t("arena.rules.bans", { p0: rules.ban ? t("arena.rules.oneEach") : t("arena.rules.off") }), () => { rules = { ...rules, ban: !rules.ban }; });
            option(-45, t("arena.rules.requesterOrder", { p0: { first: t("arena.rules.first"), second: t("arena.rules.second"), random: t("arena.rules.random") }[rules.order] }), () => { rules = { ...rules, order: rules.order === 'first' ? 'second' : rules.order === 'second' ? 'random' : 'first' }; });
            option(65, t("arena.rules.placement", { p0: rules.placement === 'alternate' ? t("arena.rules.alternateOption") : t("arena.rules.hiddenOption") }), () => { rules = { ...rules, placement: rules.placement === 'alternate' ? 'hidden' : 'alternate' }; });
            // 내가 고른 렐릭을 상대도 고를 수 있는가. 번갈아 고를 때만 뜻이 있다(비공개 배치는 서로의 선택을 모른다).
            option(175, t("arena.rules.duplicates", { p0: rules.unique === false ? t("arena.rules.duplicatesAllowed") : t("arena.rules.duplicatesBlocked") }), () => { rules = { ...rules, unique: rules.unique === false }; });
            body.add(new Button(scene, 0, 330, { width: 740, height: 100, label: t("arena.invite.send"), variant: 'primary', onClick: () => void run('invite') }));
        });
    };
    show();
}
