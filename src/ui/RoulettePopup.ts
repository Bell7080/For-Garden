import Phaser from "phaser";
import { t, type TextKey } from "../i18n";
import { gameApi } from "../api/FakeServer";
import { ROULETTE, ROULETTE_REWARDS } from "../core/roulette";
import { completedAdToken } from "../data/adRewards";
import { presentRewardedAd, releaseAdWait } from "../platform/rewardedAds";
import { managerEvents } from "../managers/ManagerEvents";
import { notificationManager } from "../managers/NotificationManager";
import { session } from "../state/session";
import { motionPolicy, powerSavingPolicy } from "../core/settings";
import { sdAssetFor, spawnPuppet, type PuppetCreature } from "../puppets/assets";
import { Button } from "./Button";
import type { PopupLayer } from "./PopupLayer";
import { COLOR, textStyle } from "./theme";
import { CURRENCY_ICON_BY_WALLET } from "./currencyIcons";
import { currencyRecordToRewardItems } from "./rewardPopupModel";
import { openRewardPopup } from "./RewardPopup";
import { UI_ICON } from "./icons";
import { addSdFootShadow } from "./SdFootShadow";

const WHEEL = {
  centerY: -175,
  radius: 302,
  rewardRadius: 205,
  rewardCard: { width: 136, height: 100 },
  palette: [0x3d263a, 0x173c43, 0x3c3120, 0x26334b, 0x34254a, 0x24402f],
} as const;

/** 유리판 안에만 흐르는 듯 이어지는 물결·점 패턴. 내용보다 먼저 읽히지 않도록 아주 옅게 둔다. */
function addBackdropPattern(scene: Phaser.Scene, body: Phaser.GameObjects.Container): void {
  const pattern = scene.add.graphics();
  pattern.lineStyle(2, 0xe8c875, 0.07);
  for (let row = -610; row <= 590; row += 92) {
    pattern.beginPath();
    for (let x = -410; x <= 410; x += 24) {
      const y = row + Math.sin((x + row) / 95) * 18;
      if (x === -410) pattern.moveTo(x, y); else pattern.lineTo(x, y);
    }
    pattern.strokePath();
  }
  for (let y = -570; y <= 570; y += 88) {
    for (let x = -380 + ((Math.round(y / 88) & 1) ? 44 : 0); x <= 380; x += 88) {
      pattern.fillStyle(0xf2d986, 0.08).fillCircle(x, y, 3);
    }
  }
  body.add(pattern);
}

function addWheelChrome(scene: Phaser.Scene, body: Phaser.GameObjects.Container): void {
  const { centerY, radius } = WHEEL;
  body.add(scene.add.circle(0, centerY + 15, radius + 36, 0x000000, 0.35));
  body.add(scene.add.circle(0, centerY, radius + 24, 0x15202c, 0.9).setStrokeStyle(3, 0xf0cc76, 0.34));
  const ticks = scene.add.graphics();
  for (let index = 0; index < 36; index += 1) {
    const angle = -Math.PI / 2 + index * Math.PI * 2 / 36;
    const inner = radius + (index % 6 === 0 ? 7 : 13);
    const outer = radius + 22;
    ticks.lineStyle(index % 6 === 0 ? 5 : 2, index % 6 === 0 ? 0xffdc82 : 0xb58d51, index % 6 === 0 ? 0.95 : 0.52);
    ticks.lineBetween(Math.cos(angle) * inner, centerY + Math.sin(angle) * inner, Math.cos(angle) * outer, centerY + Math.sin(angle) * outer);
  }
  ticks.lineStyle(7, 0xe9bd62, 0.95).strokeCircle(0, centerY, radius + 3);
  ticks.lineStyle(2, 0xffefb3, 0.72).strokeCircle(0, centerY, radius - 7);
  body.add(ticks);
}

/** 결과·지급은 서버에서 먼저 확정하고 그 결과의 칸까지만 돌린다. 닫아도 지급은 유실되지 않는다. */
export async function openRoulettePopup(scene: Phaser.Scene, popups: PopupLayer, onChanged: () => void): Promise<void> {
  let status = await gameApi.getRouletteStatus();
  if (!scene.scene.isActive()) return;
  let busy = false, alive = true;
  let rotate: Phaser.Tweens.Tween | undefined;
  let mascotMotion: Phaser.Tweens.Tween | undefined;
  let mascot: PuppetCreature | undefined;
  let mascotShadow: Phaser.GameObjects.Container | undefined;
  let visualsDisposed = false;
  let spinRequestId: string | undefined;
  let unlockRequest: { requestId: string; verificationToken?: string } | undefined;
  const cleanupVisuals = (): void => {
    if (visualsDisposed) return;
    visualsDisposed = true; alive = false; rotate?.stop(); mascotMotion?.stop(); mascot?.destroy(); mascotShadow?.destroy();
    mascot = undefined; mascotShadow = undefined;
  };
  popups.open({ width: 940, height: 1380, title: t("event.roulette.title"), dim: true,
    closeOnBackdrop: true, canClose: () => !busy,
    onClose: () => { cleanupVisuals(); onChanged(); },
  }, (body) => {
    body.once(Phaser.GameObjects.Events.DESTROY, cleanupVisuals);
    addBackdropPattern(scene, body);
    body.add(scene.add.text(0, -615, t("roulette.intro"), textStyle({ role: "body", size: 27, color: COLOR.ink, wrap: 780, align: "center" })).setOrigin(.5));

    addWheelChrome(scene, body);
    const wheel = scene.add.container(0, WHEEL.centerY);
    const rewardHolders: Phaser.GameObjects.Container[] = [];
    const step = Math.PI * 2 / ROULETTE_REWARDS.length;
    ROULETTE_REWARDS.forEach((reward, index) => {
      const start = -Math.PI / 2 + (index - .5) * step;
      const face = scene.add.graphics();
      face.fillStyle(WHEEL.palette[index], 0.98);
      face.slice(0, 0, WHEEL.radius, start, start + step, false).fillPath();
      face.lineStyle(2, 0xf1d084, 0.55).beginPath().moveTo(0, 0).lineTo(Math.cos(start) * WHEEL.radius, Math.sin(start) * WHEEL.radius).strokePath();
      wheel.add(face);
      const mid = -Math.PI / 2 + index * step;
      const holder = scene.add.container(Math.cos(mid) * WHEEL.rewardRadius, Math.sin(mid) * WHEEL.rewardRadius);
      const plate = scene.add.rectangle(0, 0, WHEEL.rewardCard.width, WHEEL.rewardCard.height, 0x0a1018, 0.72)
        .setStrokeStyle(2, index === 3 ? 0x80e6ff : 0xe8c676, index === 3 ? 0.9 : 0.55);
      const icon = scene.add.image(0, -18, CURRENCY_ICON_BY_WALLET[reward.currency]).setDisplaySize(53, 53);
      const currency = scene.add.text(0, 18, t(`currency.${reward.currency}` as TextKey), textStyle({ role: "body", size: 16, color: COLOR.inkDim })).setOrigin(.5);
      const amount = scene.add.text(0, 40, reward.amount.toLocaleString(), textStyle({ role: "display", size: 25, color: "#fff2bc" })).setOrigin(.5).setStroke("#07090d", 5);
      holder.add([plate, icon, currency, amount]);
      wheel.add(holder); rewardHolders.push(holder);
    });
    body.add(wheel);
    body.add(scene.add.circle(0, WHEEL.centerY, 68, 0x0b121c, 1).setStrokeStyle(6, 0xe9bd62));
    body.add(scene.add.circle(0, WHEEL.centerY, 46, 0x263446, 1).setStrokeStyle(2, 0xffe6a0));
    body.add(scene.add.text(0, WHEEL.centerY, "✦", textStyle({ role: "display", size: 47, color: COLOR.accentText })).setOrigin(.5));
    const pointerY = WHEEL.centerY - WHEEL.radius - 5;
    body.add(scene.add.triangle(0, pointerY, -27, -50, 27, -50, 0, 10, 0xffd46f).setStrokeStyle(4, 0x090d14));
    body.add(scene.add.circle(0, pointerY - 42, 10, 0xfff0b5, 1));

    const remaining = scene.add.text(0, 190, "", textStyle({ role: "display", size: 34, color: COLOR.accentText })).setOrigin(.5);
    const note = scene.add.text(0, 240, "", textStyle({ role: "body", size: 23, color: COLOR.inkDim, wrap: 760, align: "center" })).setOrigin(.5);
    body.add([remaining, note]);
    const spin = new Button(scene, 0, 350, { width: 770, height: 104, label: t("roulette.spin"), variant: "primary", decorDots: true, fontSize: 34, onClick: () => void doSpin() });
    const ad = new Button(scene, 0, 350, { width: 770, height: 104, label: t("roulette.adBonus"), art: UI_ICON.ad, variant: "primary", decorDots: true, fontSize: 29, onClick: () => void unlockAndSpin() });
    const member = new Button(scene, 0, 350, { width: 770, height: 104, label: t("roulette.memberBonus"), variant: "primary", decorDots: true, fontSize: 29, onClick: () => void unlockAndSpin() });
    const adCount = scene.add.text(326, 350, "", textStyle({ role: "display", size: 24, color: COLOR.accentText })).setOrigin(.5).setStroke("#080b10", 5);
    body.add([spin, ad, member, adCount]);
    body.add(scene.add.text(0, 482, t("roulette.rules"), textStyle({ role: "body", size: 21, color: COLOR.inkDim, wrap: 790, align: "center" })).setOrigin(.5));

    const puppetDepth = (body.parentContainer?.depth ?? popups.baseDepth) + 1;
    void spawnPuppet(scene, sdAssetFor("meron"), {
      x: body.x + 292, groundY: body.y + 184, height: 300, depth: puppetDepth, flipX: true,
    }).then((figure) => {
      if (!alive || !body.active) { figure.destroy(); return; }
      mascot = figure.setName("roulette-meron"); mascot.disableInteractive(); mascot.setDecorativeUpdateFactor(powerSavingPolicy(session.settings).idlePuppetUpdateFactor);
      mascotShadow = addSdFootShadow(scene, body.x + 292, body.y + 184, 132).setDepth(puppetDepth - 0.1);
    }).catch((error) => console.warn("돌림판 메론 SD 표시 실패", error));

    const refresh = (): void => {
      const hasSpin = status.active && status.remaining > 0;
      remaining.setText(t("roulette.remaining", { count: status.remaining }));
      note.setText(t(status.active ? "roulette.daily" : "roulette.ended"));
      spin.setVisible(hasSpin); spin.setEnabled(!busy && hasSpin);
      ad.setVisible(!hasSpin && !status.adFree); member.setVisible(!hasSpin && status.adFree);
      ad.setEnabled(!busy && !hasSpin && !status.adFree && status.active && status.bonusAvailable);
      member.setEnabled(!busy && !hasSpin && status.adFree && status.active && status.bonusAvailable);
      ad.setLabel(t(status.bonusAvailable ? "roulette.adBonus" : "roulette.bonusUsed"));
      member.setLabel(t(status.bonusAvailable ? "roulette.memberBonus" : "roulette.bonusUsed"));
      adCount.setVisible(!hasSpin).setText(`${status.bonusRemaining}/${ROULETTE.adLimit}`);
    };
    const publish = (): void => { managerEvents.publish("wallet", { wallet: session.wallet }); void notificationManager.refresh().catch(() => undefined); };
    const fail = (): void => { if (alive) { busy = false; note.setText(t("roulette.error")); refresh(); } };
    const nudgeMascot = (): void => {
      if (!mascot || motionPolicy(session.settings).nonEssentialDistanceFactor === 0) return;
      mascotMotion?.stop();
      mascotMotion = scene.tweens.add({ targets: mascot, angle: -6, x: mascot.x - 14, duration: 180, yoyo: true, ease: "Sine.InOut" });
    };
    const playResult = (result: Awaited<ReturnType<typeof gameApi.spinRoulette>>): void => {
      if (!alive) return;
      const target = (360 - result.index * 360 / ROULETTE_REWARDS.length) % 360;
      const angle = wheel.angle + 360 * 6 + ((target - wheel.angle % 360 + 360) % 360);
      const complete = (): void => {
        if (!alive) return;
        busy = false; refresh();
        const selected = rewardHolders[result.index];
        scene.tweens.add({ targets: selected, scale: 1.18, duration: 170, yoyo: true, repeat: 1, ease: "Back.Out" });
        const items = currencyRecordToRewardItems(result.granted);
        if (items.length) scene.time.delayedCall(380, () => {
          if (alive) openRewardPopup(scene, popups, { title: t("roulette.reward"), titleSize: 36, dimAlpha: 0.66, items });
        });
      };
      if (motionPolicy(session.settings).nonEssentialDistanceFactor === 0) {
        wheel.angle = target; rewardHolders.forEach((holder) => { holder.angle = -wheel.angle; }); complete();
      } else rotate = scene.tweens.add({
        targets: wheel, angle, duration: 3500, ease: "Cubic.Out",
        onUpdate: () => rewardHolders.forEach((holder) => { holder.angle = -wheel.angle; }), onComplete: complete,
      });
    };
    async function requestSpin(): Promise<void> {
      const result = await gameApi.spinRoulette({ requestId: spinRequestId ??= crypto.randomUUID() });
      spinRequestId = undefined; status = result.status; publish(); nudgeMascot(); playResult(result);
    }
    async function doSpin(): Promise<void> {
      if (busy || !status.active || status.remaining <= 0) return;
      busy = true; refresh();
      try { await requestSpin(); } catch { fail(); }
    }
    async function unlockAndSpin(): Promise<void> {
      if (busy || !status.active || status.remaining > 0 || !status.bonusAvailable) return;
      busy = true; refresh();
      try {
        const token = unlockRequest?.verificationToken ?? (status.adFree ? undefined : completedAdToken(await presentRewardedAd(ROULETTE.adSlot)));
        if (!status.adFree && !token) { busy = false; refresh(); return; }
        unlockRequest ??= { requestId: crypto.randomUUID(), verificationToken: token };
        status = await gameApi.unlockRouletteSpins(unlockRequest);
        unlockRequest = undefined; publish();
        if (!alive) return;
        await requestSpin();
      } catch { fail(); } finally { releaseAdWait(); }
    }
    refresh();
  });
}
