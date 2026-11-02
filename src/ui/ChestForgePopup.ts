import Phaser from "phaser";
import { t } from "../i18n";
import { gameApi } from "../api/FakeServer";
import type { ChestForgeResponse } from "../api/contracts";
import { formatCurrency } from "../core/formatCurrency";
import { CHEST_FORGE, CHEST_FORGE_MAX_STAGE, CHEST_FORGE_STAGES, type ChestForgeStatus } from "../core/chestForge";
import { motionPolicy } from "../core/settings";
import { audioManager } from "../managers/AudioManager";
import { logError } from "../managers/ErrorReporter";
import { managerEvents } from "../managers/ManagerEvents";
import { session } from "../state/session";
import { chestGlowColor, ensureChestTexture } from "./chestArt";
import { CURRENCY_ICON_BY_WALLET } from "./currencyIcons";
import { addFramedIcon } from "./itemFrame";
import { popupArtShape, popupBodyShapeMask } from "./popupArt";
import type { PopupLayer } from "./PopupLayer";
import { openRewardPopup } from "./RewardPopup";
import { currencyRecordToRewardItems } from "./rewardPopupModel";
import { RouletteSpinButton } from "./RouletteSpinButton";
import { drawSparkle } from "./rouletteWheel";
import { textStyle } from "./theme";

/**
 * 보물상자 창의 자리. 두 쪽이다.
 * - **첫 쪽**: 상자가 없을 때. 코인 → 안내 → 상자 → 작은 확률표 → 결제 버튼 하나.
 * - **강화 쪽**: 상자를 받은 뒤. 작은 확률표 → 지금 단계의 보상(상자 위에 떠 있다) → 상자 → 단계·확률 → 보상 받기/강화.
 * 확률표는 단계마다 오를 확률을 늘 공개한다. 바탕은 밝은 크림빛에 보상 그림이 흩어진 무늬다.
 */
const FORGE = {
  width: 940,
  height: 1540,
  coinY: -684,
  resetY: -640,
  intro: { textY: -560, chestY: -150, chestScale: 0.92, ratesY: 250, buttonY: 520 },
  forge: { ratesY: -540, rewardY: -300, chestY: 30, chestScale: 1, stageY: 310, chanceY: 356, buttonY: 520 },
  rulesY: 650,
  rates: { width: 820, height: 92, column: 102 },
  reward: { size: 100, gap: 150 },
  button: { width: 400, height: 116, gap: 430, wide: 720 },
} as const;

const INK = "#5b3426";
const INK_SOFT = "#8a6150";
const ACCENT = "#e2602a";
const OUTLINE = "#ffffff";

/** 바탕 — 크림 → 복숭아 → 분홍으로 흐르는 밝은 면에 물방울과 보상 그림이 흩어진다. */
function paintBackdrop(scene: Phaser.Scene, body: Phaser.GameObjects.Container, mask: Phaser.Display.Masks.GeometryMask, motion: number): void {
  const { width, height } = FORGE;
  const left = -width / 2, top = -height / 2;
  const base = scene.add.graphics();
  base.fillGradientStyle(0xfff4dc, 0xfff4dc, 0xffd3df, 0xffd3df, 1).fillRect(left, top, width, height);
  // 물방울 무늬.
  for (let row = 0; row < 26; row += 1) {
    for (let col = 0; col < 16; col += 1) {
      const x = left + 30 + col * 60 + (row % 2) * 30, y = top + 30 + row * 60;
      base.fillStyle(0xffffff, 0.35).fillCircle(x, y, 5);
    }
  }
  // 상자 뒤로 번지는 햇살.
  for (let ring = 6; ring > 0; ring -= 1) base.fillStyle(0xffffff, 0.08).fillEllipse(0, -60, 300 + ring * 110, 260 + ring * 90);
  body.add(base.setMask(mask));
  // 흩어진 보상들 — 가장자리에만 두어 글과 버튼을 가리지 않는다.
  const spots: readonly [number, number, keyof typeof CURRENCY_ICON_BY_WALLET, number, number][] = [
    [-410, -700, "gold", 105, -18], [410, -690, "gems", 93, 14], [-410, -300, "cheesecake", 99, 12], [410, -260, "gold", 87, -10],
    [-420, -20, "gems", 81, -8], [420, 40, "cheesecake", 105, 16], [-410, 390, "cheesecake", 90, -14], [410, 380, "gems", 99, 10],
    [-360, 470, "gold", 84, 20], [370, 470, "gold", 96, -16], [-250, -470, "gems", 60, 8], [260, -440, "cheesecake", 66, -8],
    [-300, 140, "gold", 63, 6], [300, 170, "gems", 60, -10],
  ];
  spots.forEach(([x, y, currency, size, angle], index) => {
    const icon = scene.add.image(x, y, CURRENCY_ICON_BY_WALLET[currency]).setDisplaySize(size, size).setAngle(angle).setAlpha(0.7).setMask(mask);
    body.add(icon);
    if (motion > 0) scene.tweens.add({ targets: icon, y: y - 10 * motion, angle: angle + 6, duration: 1600 + (index % 5) * 260, yoyo: true, repeat: -1, ease: "Sine.InOut", delay: index * 110 });
  });
}

/** 작은 확률표 — 단계 여덟 칸에 오를 확률. 지금 단계 칸이 물든다. */
function addRateStrip(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, y: number): (stage: number | null) => void {
  const { width, height, column } = FORGE.rates;
  const panel = scene.add.graphics();
  parent.add(panel);
  parent.add(scene.add.text(-width / 2 + 8, y - height / 2 - 22, t("chestForge.chanceHeader"), textStyle({ role: "emphasis", size: 20, color: INK_SOFT })).setOrigin(0, 0.5));
  const left = -(column * (CHEST_FORGE_MAX_STAGE + 1)) / 2;
  const highlight = scene.add.graphics();
  parent.add(highlight);
  for (let stage = 0; stage <= CHEST_FORGE_MAX_STAGE; stage += 1) {
    const x = left + column * stage + column / 2;
    parent.add(scene.add.text(x, y - 18, t("chestForge.stage", { stage }), textStyle({ role: "emphasis", size: 18, color: INK_SOFT })).setOrigin(0.5));
    parent.add(scene.add.text(x, y + 16, stage === 0 ? "—" : `${CHEST_FORGE_STAGES[stage].chance}%`, textStyle({ role: "display", size: 24, color: stage === 0 ? INK_SOFT : INK })).setOrigin(0.5));
  }
  panel.fillStyle(0x000000, 0.06).fillRoundedRect(-width / 2, y - height / 2 + 5, width, height, 22);
  panel.fillStyle(0xffffff, 0.78).fillRoundedRect(-width / 2, y - height / 2, width, height, 22);
  return (current) => {
    highlight.clear();
    if (current === null) return;
    const x = left + column * current;
    highlight.fillStyle(0xffb36b, 0.45).fillRoundedRect(x + 4, y - height / 2 + 6, column - 8, height - 12, 16);
  };
}

/** 보물상자 — 받기·강화·보상 받기는 모두 서버가 확정한다. 창을 닫아도 진행 중인 상자는 남는다. */
export async function openChestForgePopup(scene: Phaser.Scene, popups: PopupLayer, onChanged: () => void): Promise<void> {
  let status: ChestForgeStatus = await gameApi.getChestForge();
  if (!scene.scene.isActive()) return;
  let busy = false, alive = true;
  let pendingRequest: { kind: "enter" | "upgrade" | "claim"; requestId: string } | undefined;
  const motion = (): number => motionPolicy(session.settings).nonEssentialDistanceFactor;
  popups.open({ width: FORGE.width, height: FORGE.height, title: t("event.chestForge.title"), dim: true,
    closeOnBackdrop: true, canClose: () => !busy,
    onClose: () => { alive = false; onChanged(); },
  }, (body) => {
    const shape = popupArtShape(FORGE.width, FORGE.height);
    const mask = popupBodyShapeMask(scene, body, shape);
    paintBackdrop(scene, body, mask, motion());

    // 위 — 코인과 초기화 시각은 두 쪽이 함께 쓴다.
    const coinIcon = scene.add.image(0, FORGE.coinY, CURRENCY_ICON_BY_WALLET.gold).setDisplaySize(52, 52).setTint(0xffb36b);
    const coinText = scene.add.text(0, FORGE.coinY, "", textStyle({ role: "display", size: 38, color: ACCENT })).setOrigin(0, 0.5).setStroke(OUTLINE, 8);
    const resetText = scene.add.text(0, FORGE.resetY, "", textStyle({ role: "body", size: 21, color: INK_SOFT, align: "center", wrap: 840 })).setOrigin(0.5);
    body.add([coinIcon, coinText, resetText]);

    // 첫 쪽.
    const introPage = scene.add.container(0, 0);
    body.add(introPage);
    introPage.add(scene.add.text(0, FORGE.intro.textY, t("chestForge.intro"), textStyle({ role: "emphasis", size: 27, color: INK, wrap: 780, align: "center" })).setOrigin(0.5));
    const introChest = scene.add.image(0, FORGE.intro.chestY, ensureChestTexture(scene, 0, false)).setScale(FORGE.intro.chestScale);
    introPage.add(introChest);
    if (motion() > 0) scene.tweens.add({ targets: introChest, y: FORGE.intro.chestY - 14 * motion(), duration: 1400, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    addRateStrip(scene, introPage, FORGE.intro.ratesY);
    const enter = new RouletteSpinButton(scene, 0, FORGE.intro.buttonY, { width: FORGE.button.wide, height: FORGE.button.height, label: "", tone: 0xffb36b, onClick: () => void step("enter") });
    introPage.add(enter);

    // 강화 쪽.
    const forgePage = scene.add.container(0, 0);
    body.add(forgePage);
    const paintRates = addRateStrip(scene, forgePage, FORGE.forge.ratesY);
    const sparkles = scene.add.graphics({ x: 0, y: FORGE.forge.chestY });
    const chest = scene.add.image(0, FORGE.forge.chestY, ensureChestTexture(scene, 0, false)).setScale(FORGE.forge.chestScale);
    forgePage.add([sparkles, chest]);
    if (motion() > 0) scene.tweens.add({ targets: sparkles, alpha: { from: 1, to: 0.35 }, duration: 700, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    // 지금 단계의 보상 — 상자 위에 말풍선처럼 떠 있다.
    const rewardFloat = scene.add.container(0, FORGE.forge.rewardY);
    forgePage.add(rewardFloat);
    if (motion() > 0) scene.tweens.add({ targets: rewardFloat, y: FORGE.forge.rewardY - 10 * motion(), duration: 1300, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    const stageText = scene.add.text(0, FORGE.forge.stageY, "", textStyle({ role: "display", size: 44, color: INK })).setOrigin(0.5).setStroke(OUTLINE, 10);
    const chanceText = scene.add.text(0, FORGE.forge.chanceY, "", textStyle({ role: "emphasis", size: 26, color: ACCENT, align: "center" })).setOrigin(0.5).setStroke(OUTLINE, 6);
    const claim = new RouletteSpinButton(scene, -FORGE.button.gap / 2, FORGE.forge.buttonY, { width: FORGE.button.width, height: FORGE.button.height, label: t("chestForge.claim"), tone: 0x6fd6b0, onClick: () => void step("claim") });
    const upgrade = new RouletteSpinButton(scene, FORGE.button.gap / 2, FORGE.forge.buttonY, { width: FORGE.button.width, height: FORGE.button.height, label: "", tone: 0xff8fb8, onClick: () => void step("upgrade") });
    forgePage.add([stageText, chanceText, claim, upgrade]);

    const note = scene.add.text(0, FORGE.rulesY, t("chestForge.rules"), textStyle({ role: "body", size: 21, color: INK_SOFT, wrap: 820, align: "center" })).setOrigin(0.5);
    body.add(note);

    const paintRewards = (stage: number): void => {
      rewardFloat.removeAll(true);
      const { size, gap } = FORGE.reward;
      const bubble = scene.add.graphics();
      const w = gap * 2 + size + 60, h = size + 44;
      bubble.fillStyle(0x000000, 0.08).fillRoundedRect(-w / 2, -h / 2 + 6, w, h, 30);
      bubble.fillStyle(0xffffff, 0.9).fillRoundedRect(-w / 2, -h / 2, w, h, 30);
      bubble.fillTriangle(-18, h / 2 - 1, 18, h / 2 - 1, 0, h / 2 + 22);
      rewardFloat.add(bubble);
      const reward = CHEST_FORGE_STAGES[stage].reward;
      ([["gold", reward.gold], ["cheesecake", reward.cheesecake], ["gems", reward.gems]] as const).forEach(([currency, amount], index) => {
        addFramedIcon(scene, rewardFloat, (index - 1) * gap, 0, size, CURRENCY_ICON_BY_WALLET[currency], { amount: formatCurrency(amount), amountRatio: 0.3 });
      });
    };
    const paintSparkles = (stage: number): void => {
      sparkles.clear();
      const color = chestGlowColor(stage);
      const count = 2 + stage;
      for (let index = 0; index < count; index += 1) {
        const angle = -Math.PI / 2 + (index - (count - 1) / 2) * 0.5;
        const radius = 200 + (index % 2) * 40;
        drawSparkle(sparkles, Math.cos(angle) * radius * 1.15, -30 + Math.sin(angle) * radius * 0.7 + 40, 12 + (index % 3) * 6, color, 0.95);
        drawSparkle(sparkles, Math.cos(angle) * radius * 1.15, -30 + Math.sin(angle) * radius * 0.7 + 40, 6 + (index % 3) * 3, 0xffffff, 1);
      }
    };
    const showChest = (stage: number, open = false): void => {
      chest.setTexture(ensureChestTexture(scene, stage, open));
      paintSparkles(stage);
    };

    const refresh = (): void => {
      coinText.setText(t("chestForge.coins", { count: status.coins.toLocaleString() }));
      const total = 52 + 12 + coinText.width;
      coinIcon.setX(-total / 2 + 26); coinText.setX(-total / 2 + 64);
      resetText.setText(t("chestForge.reset", { date: new Date(status.resetsAt).toLocaleString(undefined, { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) }));
      const running = status.stage !== null;
      introPage.setVisible(!running); forgePage.setVisible(running);
      enter.setLabel(t("chestForge.enter", { count: CHEST_FORGE.entryCost }));
      enter.setEnabled(!busy && status.coins >= CHEST_FORGE.entryCost);
      if (running) {
        const stage = status.stage!;
        showChest(stage);
        paintRewards(stage);
        paintRates(stage);
        stageText.setText(t("chestForge.stage", { stage }));
        chanceText.setText(status.nextChance === null ? t("chestForge.max") : t("chestForge.chance", { rate: status.nextChance }));
      }
      upgrade.setLabel(status.nextChance === null ? t("chestForge.maxShort") : t("chestForge.upgrade", { rate: status.nextChance }));
      upgrade.setEnabled(!busy && running && status.nextChance !== null);
      claim.setEnabled(!busy && running);
    };

    const publish = (): void => managerEvents.publish("wallet", { wallet: session.wallet });
    const resetChest = (): void => { chest.setAlpha(1).setAngle(0).setScale(FORGE.forge.chestScale).setPosition(0, FORGE.forge.chestY); };
    /** 상자가 받침 위로 톡 떨어지며 나타난다. */
    const playArrive = (done: () => void): void => {
      const distance = motion();
      if (distance <= 0) { done(); return; }
      chest.setY(FORGE.forge.chestY - 180 * distance).setAlpha(0);
      scene.tweens.add({ targets: chest, y: FORGE.forge.chestY, alpha: 1, duration: 420, ease: "Bounce.Out", onComplete: done });
    };
    /** 강화 성공 — 부르르 떨다 번쩍이며 다음 재질로 바뀐다. 실패 — 떨다 기울며 흐려진다. */
    const playUpgrade = (success: boolean, nextStage: number, done: () => void): void => {
      const distance = 10 * motion();
      if (distance <= 0) { if (success) showChest(nextStage); done(); return; }
      scene.tweens.add({ targets: chest, x: { from: -distance, to: distance }, duration: 55, yoyo: true, repeat: 6, onComplete: () => {
        chest.setX(0);
        if (!alive) return;
        if (success) {
          const flash = scene.add.graphics({ x: 0, y: FORGE.forge.chestY });
          flash.fillStyle(0xffffff, 0.85).fillEllipse(0, 0, 460, 340);
          forgePage.add(flash);
          showChest(nextStage);
          scene.tweens.add({ targets: flash, alpha: 0, scale: 1.5, duration: 460, onComplete: () => flash.destroy() });
          scene.tweens.add({ targets: chest, scale: { from: FORGE.forge.chestScale * 1.2, to: FORGE.forge.chestScale }, duration: 360, ease: "Back.Out", onComplete: done });
        } else {
          scene.tweens.add({ targets: chest, alpha: 0, angle: 10, y: FORGE.forge.chestY + 40, scale: FORGE.forge.chestScale * 0.85, duration: 520, onComplete: done });
        }
      } });
    };

    async function step(kind: "enter" | "upgrade" | "claim"): Promise<void> {
      if (busy) return;
      busy = true; refresh();
      const stageBefore = status.stage ?? 0;
      let result: ChestForgeResponse;
      try {
        if (pendingRequest?.kind !== kind) pendingRequest = { kind, requestId: crypto.randomUUID() };
        const request = { requestId: pendingRequest.requestId };
        result = kind === "enter" ? await gameApi.enterChestForge(request) : kind === "upgrade" ? await gameApi.upgradeChestForge(request) : await gameApi.claimChestForge(request);
        pendingRequest = undefined;
      } catch (error) {
        logError("chestForge.request", "보물상자 요청 실패", error);
        if (alive) { busy = false; refresh(); note.setText(t("chestForge.error")); }
        return;
      }
      if (!alive) { status = result.status; return; }
      note.setText(t("chestForge.rules"));
      const finish = (): void => { if (!alive) return; busy = false; resetChest(); refresh(); };
      if (kind === "enter") {
        status = result.status;
        refresh();
        audioManager?.playUi("roulette.tick");
        playArrive(finish);
      } else if (kind === "upgrade") {
        audioManager?.playUi(result.success ? "roulette.win" : "roulette.tick");
        // 연출이 끝날 때까지 지금 모습을 지킨다 — 실패하면 상자가 사라진 뒤에 첫 쪽으로 돌아간다.
        playUpgrade(result.success === true, result.status.stage ?? stageBefore, () => {
          status = result.status;
          if (alive) note.setText(t(result.success ? "chestForge.success" : "chestForge.broken"));
          finish();
        });
      } else {
        publish();
        showChest(stageBefore, true);
        audioManager?.playUi("roulette.win");
        const items = currencyRecordToRewardItems(result.granted ?? {});
        scene.tweens.add({ targets: rewardFloat, alpha: 0, scale: 1.2, duration: 360 });
        scene.time.delayedCall(520, () => {
          status = result.status;
          rewardFloat.setAlpha(1).setScale(1);
          finish();
          if (alive && items.length) openRewardPopup(scene, popups, { title: t("chestForge.reward"), titleSize: 36, dimAlpha: 0.66, items });
        });
      }
    }
    refresh();
  });
}
