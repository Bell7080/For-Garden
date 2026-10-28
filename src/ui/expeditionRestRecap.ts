import Phaser from "phaser";
import { motionPolicy } from "../core/settings";
import { t } from "../i18n";
import { EffectManager } from "../managers/EffectManager";
import { session } from "../state/session";
import type { BattleProfile } from "./BattleProfile";
import { COLOR, textStyle } from "./theme";

/** 휴식 직전의 한 렐릭 — 런의 퍼센트 체력과 생존 여부. */
export interface ExpeditionRestRecapEntry { relicId: string; currentHp: number; alive: boolean }

/** 휴식 뒤 지도 HUD 연출의 박자와 글자. 회복 수치는 전투의 회복 숫자와 같은 초록이다. */
export const REST_RECAP = {
  /** 화면이 들어오는 연출이 끝난 뒤에 차오르기 시작한다. */
  delayMs: 420,
  /** 렐릭마다 조금씩 어긋나 차오른다(왼쪽부터). */
  staggerMs: 140,
  gain: { size: 46, rise: 92, holdMs: 900, fadeMs: 420 },
  revive: { size: 38, gap: 50 },
  /** 체력 바가 따라오는 동안만 프레임을 돌린다. */
  stepForMs: 1800,
  /** 회복 기운의 세기 — 오른 양이 최대 체력의 몇 %인지(10%가 1)에서 나온다. */
  intensityPerPercent: 0.1,
} as const;

/**
 * 휴식을 마치고 지도가 다시 서면, HUD 카드가 **휴식 전 체력에서 차오르며** 오른 양을 `+N`으로 띄운다.
 * 깨어난 렐릭은 반투명 카드가 밝아지고 「부활!」이 함께 선다. 체력은 이미 서버가 확정했다 — 이 함수는
 * 보여 주기만 하고 값을 바꾸지 않는다.
 */
export function playExpeditionRestRecap(
  scene: Phaser.Scene,
  before: readonly ExpeditionRestRecapEntry[],
  after: readonly ExpeditionRestRecapEntry[],
  resolve: (relicId: string) => { profile: BattleProfile; maxHp: number } | undefined,
): void {
  const motion = motionPolicy(session.settings);
  const effects = new EffectManager(scene, { depth: 1400, damageNumbers: true, motion });
  const profiles: BattleProfile[] = [];
  let index = 0;
  for (const next of after) {
    const prev = before.find(({ relicId }) => relicId === next.relicId);
    const view = resolve(next.relicId);
    if (!prev || !view) continue;
    const { profile, maxHp } = view;
    const fromHp = prev.alive ? Math.round(maxHp * prev.currentHp / 100) : 0;
    const toHp = next.alive ? Math.round(maxHp * next.currentHp / 100) : 0;
    const revived = !prev.alive && next.alive;
    if (toHp <= fromHp && !revived) continue;
    profiles.push(profile);
    const order = index++;
    scene.time.delayedCall(REST_RECAP.delayMs + order * REST_RECAP.staggerMs, () => {
      if (!profile.active) return;
      profile.setMeters(toHp, maxHp, 0, false);
      profile.setHealthTarget(toHp, maxHp, "heal");
      const bounds = profile.card.getBounds();
      const percent = (toHp - fromHp) / maxHp * 100;
      effects.combat("heal", bounds.centerX, bounds.centerY, { color: COLOR.hpFill, intensity: Math.max(0.6, percent * REST_RECAP.intensityPerPercent) });
      const lines: Phaser.GameObjects.Text[] = [];
      lines.push(scene.add.text(bounds.centerX, bounds.top - 18, `+${(toHp - fromHp).toLocaleString()}`, textStyle({ role: "display", size: REST_RECAP.gain.size, color: COLOR.hpText })).setOrigin(0.5, 1).setStroke("#05070a", 8));
      if (revived) lines.push(scene.add.text(bounds.centerX, bounds.top - 18 - REST_RECAP.revive.gap, t("expedition.rest.revived"), textStyle({ role: "display", size: REST_RECAP.revive.size, color: COLOR.accentText })).setOrigin(0.5, 1).setStroke("#05070a", 7));
      lines.forEach((line) => {
        line.setDepth(1500).setScale(0.6).setAlpha(0);
        const rise = REST_RECAP.gain.rise * motion.nonEssentialDistanceFactor;
        scene.tweens.chain({ targets: line, tweens: [
          { scale: 1, alpha: 1, y: line.y - rise * 0.5, duration: 260, ease: "Back.Out" },
          { y: line.y - rise, duration: REST_RECAP.gain.holdMs, ease: "Sine.Out" },
          { alpha: 0, duration: REST_RECAP.gain.fadeMs, onComplete: () => line.destroy() },
        ] });
      });
    });
  }
  if (profiles.length === 0) { effects.destroy(); return; }
  // 지도 화면에는 프레임마다 HUD를 돌리는 일이 없으므로, 바가 따라오는 동안만 걸음을 대신 넘긴다.
  const step = (_time: number, delta: number): void => profiles.forEach((profile) => profile.active && profile.stepHealth(delta));
  scene.events.on(Phaser.Scenes.Events.UPDATE, step);
  const total = REST_RECAP.delayMs + profiles.length * REST_RECAP.staggerMs + REST_RECAP.stepForMs;
  let stopped = false;
  const stop = (): void => { if (stopped) return; stopped = true; scene.events.off(Phaser.Scenes.Events.UPDATE, step); effects.destroy(); };
  scene.time.delayedCall(total, stop);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, stop);
}
