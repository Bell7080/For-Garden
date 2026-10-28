import { audioManager } from "../managers/AudioManager";
import Phaser from "phaser";
import { t } from "../i18n";
import { gameApi } from "../api/FakeServer";
import { ROULETTE, ROULETTE_REWARDS } from "../core/roulette";
import { completedAdToken } from "../data/adRewards";
import { presentRewardedAd, releaseAdWait } from "../platform/rewardedAds";
import { managerEvents } from "../managers/ManagerEvents";
import { notificationManager } from "../managers/NotificationManager";
import { session } from "../state/session";
import { motionPolicy, powerSavingPolicy } from "../core/settings";
import { sdAssetFor, spawnPuppet, type PuppetCreature } from "../puppets/assets";
import { RouletteSpinButton } from "./RouletteSpinButton";
import { addCurrencyRain, addRouletteWheel, drawSparkle, ROULETTE_TONE, type RouletteWheelParts } from "./rouletteWheel";
import { openRouletteRates } from "./RouletteRatesPopup";
import { addRatesLink } from "./sideShop";
import { popupArtShape, popupBodyShapeMask } from "./popupArt";
import type { PopupLayer } from "./PopupLayer";
import { COLOR, textStyle } from "./theme";
import { currencyRecordToRewardItems } from "./rewardPopupModel";
import { openRewardPopup } from "./RewardPopup";
import { UI_ICON } from "./icons";
import { addSdFootShadow } from "./SdFootShadow";

/**
 * 돌림판 창의 자리. 바퀴가 위 절반을 갖고, 그 아래로 받침 · 남은 횟수 · 돌리기 버튼이 쌓인다.
 * 메론은 바퀴 오른쪽에 붙어 서서 돌릴 때마다 바퀴를 민다.
 */
const WHEEL = {
  width: 940,
  height: 1380,
  centerY: -168,
  radius: 282,
  bulbs: 20,
  /** 바퀴 아래 받침 — 윗변·아랫변 폭과 높이. */
  stand: { top: 112, bottom: 196, topWidth: 150, bottomWidth: 330 },
  meron: { x: 298, groundY: 206, height: 350 },
  remainingY: 262,
  noteY: 308,
  button: { y: 412, width: 720, height: 124 },
  rulesY: 540,
  introY: -618,
  rates: { x: -430, y: -548 },
  /** 기다리는 동안 메론이 바퀴를 한 칸씩 밀어 주는 간격(ms). */
  idlePushMs: 2600,
} as const;

/** 판 바탕 — 어두운 자두빛 단색 위에 사탕 줄무늬와 바퀴 뒤로 도는 햇살, 흩어진 반짝이. 내용보다 먼저 읽히지 않게 옅게. */
function addBackdrop(scene: Phaser.Scene, body: Phaser.GameObjects.Container): Phaser.GameObjects.Graphics {
  const { width, height } = WHEEL;
  const shape = popupArtShape(width, height);
  const mask = popupBodyShapeMask(scene, body, shape);
  const base = scene.add.graphics();
  base.fillStyle(0x2a1426, 0.82).fillPoints(shape.reduce<Phaser.Geom.Point[]>((points, value, index) => {
    if (index % 2 === 0) points.push(new Phaser.Geom.Point(value, shape[index + 1])); return points;
  }, []), true);
  // 비스듬한 사탕 줄무늬.
  base.fillStyle(0xff8fb8, 0.07);
  for (let x = -width - height; x < width + height; x += 120) {
    base.fillPoints([new Phaser.Geom.Point(x, -height / 2), new Phaser.Geom.Point(x + 56, -height / 2), new Phaser.Geom.Point(x + 56 + height * 0.6, height / 2), new Phaser.Geom.Point(x + height * 0.6, height / 2)], true);
  }
  // 물방울 점 — 줄마다 반 칸씩 어긋난다.
  for (let row = 0, y = -height / 2 + 40; y < height / 2; y += 96, row += 1) {
    for (let x = -width / 2 + 30 + (row % 2) * 48; x < width / 2; x += 96) base.fillStyle(0xffe7a3, 0.08).fillCircle(x, y, 5);
  }
  body.add(base.setMask(mask));
  // 바퀴 뒤로 천천히 도는 햇살.
  const burst = scene.add.graphics({ x: 0, y: WHEEL.centerY });
  const rays = 18;
  for (let index = 0; index < rays; index += 1) {
    const angle = index * Math.PI * 2 / rays;
    const spread = Math.PI / rays * 0.55;
    burst.fillStyle(index % 2 ? 0xffc93f : 0xff8fb8, 0.1);
    burst.fillPoints([new Phaser.Geom.Point(0, 0), new Phaser.Geom.Point(Math.cos(angle - spread) * 760, Math.sin(angle - spread) * 760), new Phaser.Geom.Point(Math.cos(angle + spread) * 760, Math.sin(angle + spread) * 760)], true);
  }
  body.add(burst.setMask(mask));
  // 재화 비 — 판 안에서만 내린다.
  addCurrencyRain(scene, body, { left: -width / 2 + 40, right: width / 2 - 40, top: -height / 2 + 10, bottom: height / 2 - 10, count: 16, size: 58, alpha: 0.42, fallMs: 9000 }).setMask(mask);
  // 흩어진 반짝이.
  const sparkles = scene.add.graphics();
  [[-360, -420, 18], [372, -470, 14], [-392, 40, 12], [-300, 200, 16], [400, -120, 11], [-410, -230, 10]].forEach(([x, y, size]) => drawSparkle(sparkles, x, y, size, 0xfff3a6, 0.75));
  body.add(sparkles);
  return burst;
}

/** 바퀴 받침 — 분홍 사다리꼴에 크림 띠 한 줄. */
function addStand(scene: Phaser.Scene, body: Phaser.GameObjects.Container): void {
  const { top, bottom, topWidth, bottomWidth } = WHEEL.stand;
  const stand = scene.add.graphics();
  const trapezoid = (grow: number, dy = 0): Phaser.Geom.Point[] => [
    new Phaser.Geom.Point(-topWidth / 2 - grow, top - grow + dy), new Phaser.Geom.Point(topWidth / 2 + grow, top - grow + dy),
    new Phaser.Geom.Point(bottomWidth / 2 + grow, bottom + grow + dy), new Phaser.Geom.Point(-bottomWidth / 2 - grow, bottom + grow + dy),
  ];
  stand.fillStyle(0x000000, 0.3).fillPoints(trapezoid(0, 10), true);
  stand.fillStyle(ROULETTE_TONE.ink, 1).fillPoints(trapezoid(5), true);
  stand.fillStyle(ROULETTE_TONE.rim, 1).fillPoints(trapezoid(0), true);
  stand.fillStyle(ROULETTE_TONE.cream, 1).fillRect(-bottomWidth * 0.36, bottom - 34, bottomWidth * 0.72, 12);
  body.add(stand);
}

/** 결과·지급은 서버에서 먼저 확정하고 그 결과의 칸까지만 돌린다. 닫아도 지급은 유실되지 않는다. */
export async function openRoulettePopup(scene: Phaser.Scene, popups: PopupLayer, onChanged: () => void): Promise<void> {
  let status = await gameApi.getRouletteStatus();
  if (!scene.scene.isActive()) return;
  let busy = false, alive = true;
  let rotate: Phaser.Tweens.Tween | undefined;
  let idleTurn: Phaser.Tweens.Tween | undefined;
  let idleTimer: Phaser.Time.TimerEvent | undefined;
  let burstSpin: Phaser.Tweens.Tween | undefined;
  let mascotMotion: Phaser.Tweens.Tween | undefined;
  let mascot: PuppetCreature | undefined;
  let mascotShadow: Phaser.GameObjects.Container | undefined;
  let parts: RouletteWheelParts | undefined;
  let visualsDisposed = false;
  let spinRequestId: string | undefined;
  let unlockRequest: { requestId: string; verificationToken?: string } | undefined;
  const loops = (): boolean => motionPolicy(session.settings).nonEssentialRepeatFactor > 0;
  const cleanupVisuals = (): void => {
    if (visualsDisposed) return;
    visualsDisposed = true; alive = false; rotate?.stop(); idleTurn?.stop(); idleTimer?.remove(); burstSpin?.stop(); mascotMotion?.stop();
    parts?.destroy(); mascot?.destroy(); mascotShadow?.destroy();
    mascot = undefined; mascotShadow = undefined;
  };
  popups.open({ width: WHEEL.width, height: WHEEL.height, title: t("event.roulette.title"), dim: true,
    closeOnBackdrop: true, canClose: () => !busy,
    onClose: () => { cleanupVisuals(); onChanged(); },
  }, (body) => {
    body.once(Phaser.GameObjects.Events.DESTROY, cleanupVisuals);
    const burst = addBackdrop(scene, body);
    if (loops()) burstSpin = scene.tweens.add({ targets: burst, angle: 360, duration: 40000, repeat: -1 });
    body.add(scene.add.text(0, WHEEL.introY, t("roulette.intro"), textStyle({ role: "body", size: 26, color: COLOR.ink, wrap: 800, align: "center" })).setOrigin(.5));
    body.add(addRatesLink(scene, WHEEL.rates.x, WHEEL.rates.y, t("lab.rates"), () => openRouletteRates(scene, popups)));

    addStand(scene, body);
    const wheelParts = addRouletteWheel(scene, body, 0, WHEEL.centerY, { radius: WHEEL.radius, amounts: true, bulbs: WHEEL.bulbs });
    parts = wheelParts;
    const { wheel } = wheelParts;

    const remaining = scene.add.text(0, WHEEL.remainingY, "", textStyle({ role: "display", size: 36, color: "#ffe7a3" })).setOrigin(.5).setStroke(ROULETTE_TONE.inkText, 8);
    const note = scene.add.text(0, WHEEL.noteY, "", textStyle({ role: "body", size: 23, color: COLOR.inkDim, wrap: 760, align: "center" })).setOrigin(.5);
    body.add([remaining, note]);
    const { y: buttonY, width: buttonWidth, height: buttonHeight } = WHEEL.button;
    const spin = new RouletteSpinButton(scene, 0, buttonY, { width: buttonWidth, height: buttonHeight, label: t("roulette.spin"), tone: 0x6fd6b0, onClick: () => void doSpin() });
    const ad = new RouletteSpinButton(scene, 0, buttonY, { width: buttonWidth, height: buttonHeight, label: t("roulette.adBonus"), tone: ROULETTE_TONE.rim, iconKey: UI_ICON.ad, onClick: () => void unlockAndSpin() });
    const member = new RouletteSpinButton(scene, 0, buttonY, { width: buttonWidth, height: buttonHeight, label: t("roulette.memberBonus"), tone: ROULETTE_TONE.rim, onClick: () => void unlockAndSpin() });
    body.add([spin, ad, member]);
    body.add(scene.add.text(0, WHEEL.rulesY, t("roulette.rules"), textStyle({ role: "body", size: 21, color: COLOR.inkDim, wrap: 790, align: "center" })).setOrigin(.5));

    const puppetDepth = (body.parentContainer?.depth ?? popups.baseDepth) + 1;
    void spawnPuppet(scene, sdAssetFor("meron"), {
      x: body.x + WHEEL.meron.x, groundY: body.y + WHEEL.meron.groundY, height: WHEEL.meron.height, depth: puppetDepth, flipX: true,
    }).then((figure) => {
      if (!alive || !body.active) { figure.destroy(); return; }
      mascot = figure.setName("roulette-meron"); mascot.disableInteractive(); mascot.setDecorativeUpdateFactor(powerSavingPolicy(session.settings).idlePuppetUpdateFactor);
      mascotShadow = addSdFootShadow(scene, body.x + WHEEL.meron.x, body.y + WHEEL.meron.groundY, 132).setDepth(puppetDepth - 0.1);
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
      const badge = hasSpin ? undefined : `${status.bonusRemaining}/${ROULETTE.adLimit}`;
      ad.setBadge(badge); member.setBadge(badge);
    };
    const publish = (): void => { managerEvents.publish("wallet", { wallet: session.wallet }); void notificationManager.refresh().catch(() => undefined); };
    const fail = (error: unknown): void => {
      console.warn("돌림판 요청 실패", error);
      if (alive) { busy = false; refresh(); note.setText(t("roulette.error")); scheduleIdle(); }
    };
    /** 메론이 바퀴를 민다 — 바퀴 쪽(왼쪽)으로 기울며 한 발 다가섰다 돌아온다. `times`번 되풀이한다. */
    const pushMascot = (times: number): void => {
      if (!mascot) return;
      mascotMotion?.stop();
      const restX = body.x + WHEEL.meron.x;
      mascot.x = restX; mascot.angle = 0;
      mascotMotion = scene.tweens.add({ targets: mascot, angle: -8, x: restX - 18 * motionPolicy(session.settings).nonEssentialDistanceFactor,
        duration: 170, yoyo: true, repeat: times - 1, ease: "Sine.InOut" });
    };
    /** 기다리는 동안 메론이 가끔 바퀴를 한 칸씩 밀어 준다 — 바퀴가 늘 손에 잡혀 있는 장난감으로 읽힌다. */
    const scheduleIdle = (): void => {
      idleTimer?.remove();
      if (!alive || !loops()) return;
      idleTimer = scene.time.delayedCall(WHEEL.idlePushMs, () => {
        if (!alive || busy) return;
        pushMascot(1);
        idleTurn = scene.tweens.add({ targets: wheel, angle: wheel.angle + 360 / ROULETTE_REWARDS.length, duration: 620, delay: 120, ease: "Back.Out",
          onUpdate: wheelParts.sync, onComplete: () => scheduleIdle() });
      });
    };
    const playResult = (result: Awaited<ReturnType<typeof gameApi.spinRoulette>>): void => {
      if (!alive) return;
      idleTimer?.remove(); idleTurn?.stop();
      const target = (360 - result.index * 360 / ROULETTE_REWARDS.length) % 360;
      const angle = wheel.angle + 360 * 6 + ((target - wheel.angle % 360 + 360) % 360);
      const complete = (): void => {
        if (!alive) return;
        busy = false; refresh(); wheelParts.setBulbSpeed(1);
        audioManager?.playUi("roulette.win");
        wheelParts.celebrate(result.index);
        const items = currencyRecordToRewardItems(result.granted);
        if (items.length) scene.time.delayedCall(420, () => {
          if (alive) openRewardPopup(scene, popups, { title: t("roulette.reward"), titleSize: 36, dimAlpha: 0.66, items });
        });
        scheduleIdle();
      };
      pushMascot(4);
      wheelParts.setBulbSpeed(3);
      if (!loops()) {
        wheel.angle = target; wheelParts.sync(); complete();
      } else {
        // 칸 경계를 하나 넘을 때마다 바늘이 걸리는 틱 — 돌아가는 속도가 그대로 소리의 빠르기가 된다.
        const slice = 360 / ROULETTE_REWARDS.length;
        let lastSlice = Math.floor(wheel.angle / slice);
        rotate = scene.tweens.add({ targets: wheel, angle, duration: 3600, ease: "Cubic.Out", onComplete: complete,
          onUpdate: () => {
            wheelParts.sync();
            const current = Math.floor(wheel.angle / slice);
            if (current !== lastSlice) { lastSlice = current; audioManager?.playUi("roulette.tick"); }
          } });
      }
    };
    async function requestSpin(): Promise<void> {
      const result = await gameApi.spinRoulette({ requestId: spinRequestId ??= crypto.randomUUID() });
      spinRequestId = undefined; status = result.status; publish(); playResult(result);
    }
    async function doSpin(): Promise<void> {
      if (busy || !status.active || status.remaining <= 0) return;
      busy = true; refresh(); idleTimer?.remove();
      try { await requestSpin(); } catch (error) { fail(error); }
    }
    async function unlockAndSpin(): Promise<void> {
      if (busy || !status.active || status.remaining > 0 || !status.bonusAvailable) return;
      busy = true; refresh(); idleTimer?.remove();
      try {
        const token = unlockRequest?.verificationToken ?? (status.adFree ? undefined : completedAdToken(await presentRewardedAd(ROULETTE.adSlot)));
        if (!status.adFree && !token) { busy = false; refresh(); scheduleIdle(); return; }
        unlockRequest ??= { requestId: crypto.randomUUID(), verificationToken: token };
        status = await gameApi.unlockRouletteSpins(unlockRequest);
        unlockRequest = undefined; publish();
        if (!alive) return;
        await requestSpin();
      } catch (error) { fail(error); } finally { releaseAdWait(); }
    }
    refresh();
    scheduleIdle();
  });
}
