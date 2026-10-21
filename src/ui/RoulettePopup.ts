import Phaser from "phaser";
import { t } from "../i18n";
import { gameApi } from "../api/FakeServer";
import { ROULETTE, ROULETTE_REWARDS } from "../core/roulette";
import { completedAdToken } from "../data/adRewards";
import { presentRewardedAd, releaseAdWait } from "../platform/rewardedAds";
import { managerEvents } from "../managers/ManagerEvents";
import { notificationManager } from "../managers/NotificationManager";
import { session } from "../state/session";
import { motionPolicy } from "../core/settings";
import { Button } from "./Button";
import type { PopupLayer } from "./PopupLayer";
import { COLOR, textStyle } from "./theme";
import { CURRENCY_ICON_BY_WALLET } from "./currencyIcons";
import { currencyRecordToRewardItems } from "./rewardPopupModel";
import { openRewardPopup } from "./RewardPopup";

/** 결과·지급은 서버에서 먼저 확정하고 그 결과의 칸까지만 돌린다. 닫아도 지급은 유실되지 않는다. */
export async function openRoulettePopup(scene: Phaser.Scene, popups: PopupLayer, onChanged: () => void): Promise<void> {
  let status = await gameApi.getRouletteStatus();
  if (!scene.scene.isActive()) return;
  let busy = false, alive = true;
  let rotate: Phaser.Tweens.Tween | undefined;
  let spinRequestId: string | undefined;
  let unlockRequest: { requestId: string; verificationToken?: string } | undefined;
  popups.open({ width: 940, height: 1340, title: t("event.roulette.title"), dim: true,
    closeOnBackdrop: true, canClose: () => !busy,
    onClose: () => { alive = false; rotate?.stop(); onChanged(); },
  }, (body) => {
    body.once(Phaser.GameObjects.Events.DESTROY, () => { alive = false; rotate?.stop(); });
    body.add(scene.add.text(0, -580, t("roulette.intro"), textStyle({ role: "body", size: 29, color: COLOR.ink, wrap: 790, align: "center" })).setOrigin(.5));
    const wheel = scene.add.container(0, -170);
    const radius = 330, step = Math.PI * 2 / ROULETTE_REWARDS.length;
    const rim = scene.add.graphics();
    rim.lineStyle(12, COLOR.accent, 1).strokeCircle(0, -170, radius + 10);
    rim.lineStyle(2, 0xf6df9a, .7).strokeCircle(0, -170, radius + 24);
    body.add(rim); body.add(wheel);
    ROULETTE_REWARDS.forEach((reward, index) => {
      const start = -Math.PI / 2 + (index - .5) * step;
      const face = scene.add.graphics();
      face.fillStyle(index % 2 ? 0x222c38 : 0x493c25, 1);
      face.slice(0, 0, radius, start, start + step, false).fillPath();
      face.lineStyle(2, 0xd3ad5f, .8).beginPath().moveTo(0, 0).lineTo(Math.cos(start) * radius, Math.sin(start) * radius).strokePath();
      wheel.add(face);
      const mid = -Math.PI / 2 + index * step;
      const x = Math.cos(mid) * 217, y = Math.sin(mid) * 217;
      wheel.add(scene.add.image(x, y - 22, CURRENCY_ICON_BY_WALLET[reward.currency]).setDisplaySize(66, 66));
      wheel.add(scene.add.text(x, y + 40, reward.amount.toLocaleString(), textStyle({ role: "display", size: 29, color: COLOR.ink })).setOrigin(.5).setStroke("#07090d", 4));
    });
    body.add(scene.add.circle(0, -170, 63, 0x111923).setStrokeStyle(4, COLOR.accent));
    body.add(scene.add.text(0, -170, "✦", textStyle({ role: "display", size: 48, color: COLOR.accentText })).setOrigin(.5));
    body.add(scene.add.triangle(0, -170 - radius + 8, -24, -42, 24, -42, 0, 10, 0xf5ca76).setStrokeStyle(3, 0x0b1019));
    const remaining = scene.add.text(0, 240, "", textStyle({ role: "display", size: 35, color: COLOR.accentText })).setOrigin(.5);
    const note = scene.add.text(0, 290, "", textStyle({ role: "body", size: 25, color: COLOR.inkDim, wrap: 800, align: "center" })).setOrigin(.5);
    body.add([remaining, note]);
    const spin = new Button(scene, 0, 385, { width: 770, height: 98, label: t("roulette.spin"), variant: "primary", fontSize: 35, onClick: () => void doSpin() });
    const ad = new Button(scene, 0, 505, { width: 770, height: 88, label: "", fontSize: 29, onClick: () => void unlock() });
    body.add([spin, ad]);
    body.add(scene.add.text(0, 606, t("roulette.rules"), textStyle({ role: "body", size: 22, color: COLOR.inkDim, wrap: 820, align: "center" })).setOrigin(.5));
    const refresh = (): void => {
      remaining.setText(t("roulette.remaining", { count: status.remaining }));
      note.setText(t(status.active ? "roulette.daily" : "roulette.ended"));
      spin.setEnabled(!busy && status.active && status.remaining > 0);
      ad.setEnabled(!busy && status.active && status.bonusAvailable);
      ad.setLabel(t(!status.bonusAvailable ? "roulette.bonusUsed" : status.adFree ? "roulette.memberBonus" : "roulette.adBonus"));
    };
    const publish = (): void => { managerEvents.publish("wallet", { wallet: session.wallet }); void notificationManager.refresh().catch(() => undefined); };
    const fail = (): void => { if (alive) { busy = false; note.setText(t("roulette.error")); spin.setEnabled(status.active && status.remaining > 0); ad.setEnabled(status.active && status.bonusAvailable); } };
    async function doSpin(): Promise<void> {
      if (busy || !status.active || status.remaining <= 0) return;
      busy = true; refresh();
      try {
        const result = await gameApi.spinRoulette({ requestId: spinRequestId ??= crypto.randomUUID() });
        spinRequestId = undefined;
        status = result.status; publish();
        if (!alive) return;
        const target = (360 - result.index * 360 / ROULETTE_REWARDS.length) % 360;
        const angle = wheel.angle + 360 * 5 + ((target - wheel.angle % 360 + 360) % 360);
        const complete = (): void => {
          if (!alive) return;
          busy = false; refresh();
          const items = currencyRecordToRewardItems(result.granted);
          if (items.length) openRewardPopup(scene, popups, { title: t("roulette.reward"), items });
        };
        if (motionPolicy(session.settings).nonEssentialDistanceFactor === 0) { wheel.angle = target; complete(); }
        else rotate = scene.tweens.add({ targets: wheel, angle, duration: 3200, ease: "Cubic.Out", onComplete: complete });
      } catch { fail(); }
    }
    async function unlock(): Promise<void> {
      if (busy || !status.active || !status.bonusAvailable) return;
      busy = true; refresh();
      try {
        const token = unlockRequest?.verificationToken ?? (status.adFree ? undefined : completedAdToken(await presentRewardedAd(ROULETTE.adSlot)));
        if (!status.adFree && !token) { busy = false; refresh(); return; }
        unlockRequest ??= { requestId: crypto.randomUUID(), verificationToken: token };
        status = await gameApi.unlockRouletteSpins(unlockRequest);
        unlockRequest = undefined;
        publish(); if (alive) { busy = false; refresh(); }
      } catch { fail(); } finally { releaseAdWait(); }
    }
    refresh();
  });
}
