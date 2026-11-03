import Phaser from "phaser";
import { t } from "../i18n";
import type { TextKey } from "../i18n";
import { gameApi } from "../api/FakeServer";
import type { ChestForgeResponse } from "../api/contracts";
import { formatCurrency } from "../core/formatCurrency";
import {
  CHEST_CARDS, CHEST_FORGE, CHEST_GRADE_MAX, CHEST_GRADE_THRESHOLDS, chestCard, chestCardFlair, chestCollectedValue,
  type ChestCard, type ChestCardCurrency, type ChestCardTier, type ChestForgeRun, type ChestForgeStatus,
} from "../core/chestForge";
import { motionPolicy } from "../core/settings";
import { audioManager } from "../managers/AudioManager";
import { logError } from "../managers/ErrorReporter";
import { managerEvents } from "../managers/ManagerEvents";
import { session } from "../state/session";
import { ChestStage, chargeCard, chestFxMotion, flipCard, flyCardToChest, shatterCard, stampCard, waitFx } from "./chestForgeFx";
import { addClippedHit } from "./clippedHit";
import { CURRENCY_ICON_BY_WALLET } from "./currencyIcons";
import { addFramedIcon } from "./itemFrame";
import { playMotion, sdAssetFor, spawnPuppet, type PuppetCreature } from "../puppets/assets";
import { startPuppetHop } from "./puppetHop";
import { addSdFootShadow } from "./SdFootShadow";
import { popupArtShape, popupBodyShapeMask } from "./popupArt";
import type { PopupLayer } from "./PopupLayer";
import { openRewardPopup } from "./RewardPopup";
import { currencyRecordToRewardItems } from "./rewardPopupModel";
import { RouletteSpinButton } from "./RouletteSpinButton";
import { drawSparkle } from "./rouletteWheel";
import { shrinkTextToWidth } from "./textFit";
import { textStyle } from "./theme";

/**
 * 보물상자 창의 자리. 두 쪽이다.
 * - **첫 쪽**: 상자가 없을 때. 코인 → 안내 → 상자 → 대박 카드 미리보기 → 상자 열기 버튼 하나.
 * - **카드 쪽**: 상자를 연 뒤. 몇 번째 선택인지 → 모은 보상 → 앞면으로 놓인 카드 3~4장 → 안내.
 * 카드마다 받을 확률이 앞면에 적혀 있고, 카드가 나오는 확률은 아래 안내 줄이 말한다.
 */
const FORGE = {
  width: 940,
  height: 1540,
  coinY: -684,
  resetY: -640,
  intro: { textY: -560, chestY: -250, chestScale: 0.82, previewY: 180, buttonY: 500, sd: { x: 300, groundY: -92, height: 250 } },
  /** 카드 쪽 — 위에서 카드를 집어 아래 상자에 넣는다. 상자 아래 게이지가 다음 등급까지 얼마 남았는지 말한다. */
  pick: { roundY: -560, cardsY: -290, hintY: -100, chestY: 175, chestScale: 0.8, gaugeY: 190, collectedLabelY: 438, collectedY: 508, sd: { x: 318, groundY: 330, height: 230 },
    /** 다 고른 뒤 상자가 올라서는 자리와 커지는 배율. */
    openY: -40, openGrow: 1.3 },
  rulesY: 650,
  card: { width: 196, height: 300, gap: 18, icon: 112 },
  preview: { width: 168, height: 250, gap: 20 },
  collected: { size: 84, gap: 104 },
  button: { height: 116, wide: 720 },
} as const;

/** 보물상자 전용 이벤트 코인 그림(`currencyIcons`). 코인은 지갑이 아니라 이번 주에 쓴 스테미나에서 나온다. */
const CHEST_COIN_ICON = "currency-treasure-chest-coin";
/** 창 안에서 상자 곁을 지키는 SD — 로비 이벤트 카드와 같은 개체다(`lobbyEvents`의 `chest-forge`). */
/** 반짝이는 것을 주워 와 「보급품」이라 우기는 티아 — 보물을 모으는 상자 이벤트의 얼굴이다. */
const CHEST_FORGE_SD = "tia";

const INK = "#5b3426";
const INK_SOFT = "#8a6150";
const ACCENT = "#e2602a";
const OUTLINE = "#ffffff";

/** 등급의 색 — 바탕과 같은 파스텔 결. 대박만 금빛이다. */
const TIER_TONE: Record<ChestCardTier, { face: number; deep: number; ink: string }> = {
  safe: { face: 0x9fdcc4, deep: 0x4f8f7b, ink: "#3f7a66" },
  mid: { face: 0xa6cdf2, deep: 0x5480ad, ink: "#46709c" },
  risk: { face: 0xf7b08f, deep: 0xb0603f, ink: "#a1532f" },
  big: { face: 0xc6b2f0, deep: 0x7660ad, ink: "#6a52a3" },
  jackpot: { face: 0xffd55e, deep: 0xb07f12, ink: "#9a6c08" },
};
function tierLabel(tier: ChestCardTier): string {
  const keys: Record<ChestCardTier, TextKey> = {
    safe: "chestForge.tier.safe", mid: "chestForge.tier.mid", risk: "chestForge.tier.risk", big: "chestForge.tier.big", jackpot: "chestForge.tier.jackpot",
  };
  return t(keys[tier]);
}

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
  // 사이사이에 이벤트 코인도 몇 닢 섞는다.
  const coins: readonly [number, number, number, number][] = [[-370, -560, 78, 14], [380, -120, 72, -12], [-380, 250, 84, 8], [250, 560, 66, -6]];
  coins.forEach(([x, y, size, angle], index) => {
    const coin = scene.add.image(x, y, CHEST_COIN_ICON).setDisplaySize(size, size).setAngle(angle).setAlpha(0.75).setMask(mask);
    body.add(coin);
    if (motion > 0) scene.tweens.add({ targets: coin, y: y - 12 * motion, angle: angle - 8, duration: 1500 + index * 230, yoyo: true, repeat: -1, ease: "Sine.InOut", delay: 200 + index * 140 });
  });
  spots.forEach(([x, y, currency, size, angle], index) => {
    const icon = scene.add.image(x, y, CURRENCY_ICON_BY_WALLET[currency]).setDisplaySize(size, size).setAngle(angle).setAlpha(0.7).setMask(mask);
    body.add(icon);
    if (motion > 0) scene.tweens.add({ targets: icon, y: y - 10 * motion, angle: angle + 6, duration: 1600 + (index % 5) * 260, yoyo: true, repeat: -1, ease: "Sine.InOut", delay: index * 110 });
  });
}

/**
 * 카드 한 장. 앞면은 등급 띠 → 보상 액자(수량) → 받을 확률. 뒤집은 면은 받았으면 같은 카드가 반짝이고, 놓쳤으면 잿빛으로
 * 가라앉는다. 「획득!」·「꽝」은 면에 적지 않고 그 위에 찍히는 도장이 말한다(`stampCard`).
 */
function paintCard(scene: Phaser.Scene, holder: Phaser.GameObjects.Container, card: ChestCard, width: number, height: number, face: "front" | "win" | "miss"): void {
  holder.removeAll(true);
  const tone = TIER_TONE[card.tier];
  const radius = 26;
  const g = scene.add.graphics();
  const miss = face === "miss";
  g.fillStyle(0x7a3a2a, 0.16).fillRoundedRect(-width / 2 + 4, -height / 2 + 10, width, height, radius);
  g.fillStyle(miss ? 0x9a8f8c : tone.deep, 1).fillRoundedRect(-width / 2 - 4, -height / 2 - 4, width + 8, height + 8, radius + 4);
  g.fillStyle(miss ? 0xd8d2cf : tone.face, 1).fillRoundedRect(-width / 2, -height / 2, width, height, radius);
  g.fillStyle(0xffffff, miss ? 0.55 : 0.88).fillRoundedRect(-width / 2 + 12, -height / 2 + 52, width - 24, height - 64, radius - 10);
  g.fillStyle(0xffffff, 0.6).fillRoundedRect(-width / 2 + 22, -height / 2 + 12, width * 0.36, 8, 4);
  holder.add(g);
  const head = scene.add.text(0, -height / 2 + 30, tierLabel(card.tier), textStyle({ role: "display", size: 26, color: "#ffffff" })).setOrigin(0.5).setStroke(miss ? "#8a7f7c" : tone.ink, 6);
  shrinkTextToWidth(head, width - 30, { minSize: 18 });
  holder.add(head);
  const iconY = -height / 2 + 52 + (height - 64) * 0.4;
  const icon = Math.min(FORGE.card.icon, width * 0.6);
  const frame = addFramedIcon(scene, holder, 0, iconY, icon, CURRENCY_ICON_BY_WALLET[card.currency], { amount: formatCurrency(card.amount), amountRatio: 0.3 });
  if (miss) frame.setAlpha(0.45);
  const footY = height / 2 - 40;
  const pill = scene.add.graphics();
  pill.fillStyle(miss ? 0x9a8f8c : tone.deep, 1).fillRoundedRect(-58, footY - 24, 116, 48, 24);
  holder.add(pill);
  holder.add(scene.add.text(0, footY, `${card.chance}%`, textStyle({ role: "display", size: 30, color: "#ffffff" })).setOrigin(0.5));
  if (miss) return;
  if (card.tier === "jackpot" || face === "win") {
    const sparkle = scene.add.graphics();
    for (const [x, y, size] of [[-width / 2 + 6, -height / 2 + 70, 16], [width / 2 - 8, -height / 2 + 120, 12], [width / 2 - 14, height / 2 - 92, 18]] as const) {
      drawSparkle(sparkle, x, y, size, card.tier === "jackpot" ? 0xffe38a : 0xffffff, 1);
    }
    holder.add(sparkle);
  }
}

/** 첫 쪽 상자가 등급을 하나씩 갈아입으며 보여 주는 간격(ms) — 「모을수록 상자가 바뀐다」를 글 없이 말한다. */
const INTRO_GRADE_CYCLE_MS = 1900;

/** SD 한 기를 창 안에 세운다. 창의 자식이라 창과 함께 사라진다. 장식이라 입력을 받지 않는다. */
function addForgeSd(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, spot: { x: number; groundY: number; height: number }, flipX: boolean): Promise<PuppetCreature | undefined> {
  parent.add(addSdFootShadow(scene, spot.x, spot.groundY, spot.height * 0.62));
  return spawnPuppet(scene, sdAssetFor(CHEST_FORGE_SD), { x: spot.x, groundY: spot.groundY, height: spot.height, depth: 0, flipX })
    .then((puppet) => {
      if (!parent.active) { puppet.destroy(); return undefined; }
      puppet.disableInteractive();
      parent.add(puppet);
      return puppet;
    })
    .catch((error) => { logError("puppet.display", "보물상자 SD 표시 실패", error); return undefined; });
}

/** SD가 한 번 폴짝 뛴다(기쁨). 이미 뛰는 중이면 겹치지 않는다. */
function cheer(scene: Phaser.Scene, puppet: PuppetCreature | undefined, groundY: number, times = 1): void {
  if (!puppet?.active) return;
  scene.tweens.killTweensOf(puppet);
  puppet.setY(groundY);
  const rise = 46 * chestFxMotion().distance;
  scene.tweens.add({ targets: puppet, y: groundY - rise, duration: 170, yoyo: true, repeat: times - 1, ease: "Quad.Out", onComplete: () => puppet.setY(groundY) });
}

/** 보물상자 — 상자 열기·카드 고르기는 모두 서버가 확정한다. 창을 닫아도 진행 중인 상자는 남는다. */
export async function openChestForgePopup(scene: Phaser.Scene, popups: PopupLayer, onChanged: () => void): Promise<void> {
  let status: ChestForgeStatus = await gameApi.getChestForge();
  if (!scene.scene.isActive()) return;
  let busy = false, alive = true;
  let pendingRequest: { key: string; requestId: string } | undefined;
  const motion = (): number => motionPolicy(session.settings).nonEssentialDistanceFactor;
  popups.open({ width: FORGE.width, height: FORGE.height, title: t("event.chestForge.title"), dim: true,
    closeOnBackdrop: true, canClose: () => !busy,
    onClose: () => { alive = false; onChanged(); },
  }, (body) => {
    const shape = popupArtShape(FORGE.width, FORGE.height);
    const mask = popupBodyShapeMask(scene, body, shape);
    paintBackdrop(scene, body, mask, motion());

    // 위 — 코인과 초기화 시각은 두 쪽이 함께 쓴다.
    const coinIcon = scene.add.image(0, FORGE.coinY, CHEST_COIN_ICON).setDisplaySize(52, 52);
    const coinText = scene.add.text(0, FORGE.coinY, "", textStyle({ role: "display", size: 38, color: ACCENT })).setOrigin(0, 0.5).setStroke(OUTLINE, 8);
    const resetText = scene.add.text(0, FORGE.resetY, "", textStyle({ role: "body", size: 21, color: INK_SOFT, align: "center", wrap: 840 })).setOrigin(0.5);
    body.add([coinIcon, coinText, resetText]);

    // 첫 쪽 — 등급을 갈아입는 상자, 그 옆의 SD, 대박 카드 미리보기.
    const introPage = scene.add.container(0, 0);
    body.add(introPage);
    introPage.add(scene.add.text(0, FORGE.intro.textY, t("chestForge.intro"), textStyle({ role: "emphasis", size: 27, color: INK, wrap: 780, align: "center" })).setOrigin(0.5));
    const introChest = new ChestStage(scene, introPage, 0, FORGE.intro.chestY, FORGE.intro.chestScale);
    let introGrade = 0;
    const loops = chestFxMotion().loops;
    if (loops) {
      const cycle = scene.time.addEvent({ delay: INTRO_GRADE_CYCLE_MS, loop: true, callback: () => {
        if (!introPage.active || !introPage.visible) return;
        introGrade = (introGrade + 1) % (CHEST_GRADE_MAX + 1);
        void introChest.setValue(introGrade === 0 ? 0 : CHEST_GRADE_THRESHOLDS[introGrade - 1], { quiet: true });
      } });
      introPage.once(Phaser.GameObjects.Events.DESTROY, () => cycle.remove());
    }
    void addForgeSd(scene, introPage, FORGE.intro.sd, true).then((puppet) => {
      if (puppet && loops) startPuppetHop(scene, puppet, 0);
    });
    const highlights = [...CHEST_CARDS].filter((card) => card.tier === "jackpot" || card.tier === "big").sort((a, b) => Number(b.tier === "jackpot") - Number(a.tier === "jackpot") || b.amount - a.amount).slice(0, 4);
    const { width: pw, height: ph, gap: pg } = FORGE.preview;
    introPage.add(scene.add.text(0, FORGE.intro.previewY - ph / 2 - 34, t("chestForge.jackpotHeader"), textStyle({ role: "display", size: 30, color: INK })).setOrigin(0.5).setStroke(OUTLINE, 8));
    highlights.forEach((card, index) => {
      const holder = scene.add.container((index - (highlights.length - 1) / 2) * (pw + pg), FORGE.intro.previewY);
      paintCard(scene, holder, card, pw, ph, "front");
      holder.setAngle((index - (highlights.length - 1) / 2) * 3);
      introPage.add(holder);
    });
    const enter = new RouletteSpinButton(scene, 0, FORGE.intro.buttonY, { width: FORGE.button.wide, height: FORGE.button.height, label: "", tone: 0xffb36b, iconKey: CHEST_COIN_ICON, onClick: () => void enterBox() });
    introPage.add(enter);

    // 카드 쪽 — 위에 카드, 아래에 상자와 SD, 맨 아래 모은 보상.
    const pickPage = scene.add.container(0, 0);
    body.add(pickPage);
    const roundText = scene.add.text(0, FORGE.pick.roundY, "", textStyle({ role: "display", size: 40, color: INK })).setOrigin(0.5).setStroke(OUTLINE, 10);
    const dots = scene.add.graphics();
    pickPage.add([roundText, dots]);
    const collectedLabel = scene.add.text(0, FORGE.pick.collectedLabelY, t("chestForge.collected"), textStyle({ role: "emphasis", size: 24, color: INK_SOFT })).setOrigin(0.5);
    const collectedRow = scene.add.container(0, FORGE.pick.collectedY);
    const hint = scene.add.text(0, FORGE.pick.hintY, t("chestForge.pickHint"), textStyle({ role: "emphasis", size: 28, color: ACCENT })).setOrigin(0.5).setStroke(OUTLINE, 6);
    const chestLayer = scene.add.container(0, 0);
    const cardsRow = scene.add.container(0, FORGE.pick.cardsY);
    // 상자·SD가 카드 아래에, 날아가는 카드는 그 위에 선다(`flyCardToChest`가 pickPage 맨 위로 옮긴다).
    pickPage.add([collectedLabel, collectedRow, hint, chestLayer, cardsRow]);
    if (motion() > 0) scene.tweens.add({ targets: hint, alpha: { from: 1, to: 0.45 }, duration: 800, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    let pickChest: ChestStage | undefined;
    let pickSd: PuppetCreature | undefined;
    void addForgeSd(scene, chestLayer, FORGE.pick.sd, true).then((puppet) => { pickSd = puppet; });
    const buildPickChest = (): void => {
      pickChest?.destroy();
      pickChest = new ChestStage(scene, chestLayer, 0, FORGE.pick.chestY, FORGE.pick.chestScale, { gaugeY: FORGE.pick.gaugeY });
      chestLayer.sendToBack(pickChest.root);
      void pickChest.setValue(chestCollectedValue(status.run?.collected ?? {}), { animate: false });
    };

    const note = scene.add.text(0, FORGE.rulesY, t("chestForge.rules"), textStyle({ role: "body", size: 21, color: INK_SOFT, wrap: 820, align: "center" })).setOrigin(0.5);
    body.add(note);

    let cardHolders: Phaser.GameObjects.Container[] = [];
    const paintCollected = (collected: ChestForgeRun["collected"], pop?: ChestCardCurrency): void => {
      collectedRow.removeAll(true);
      const entries = Object.entries(collected).filter(([, amount]) => (amount ?? 0) > 0) as [ChestCardCurrency, number][];
      const { size, gap } = FORGE.collected;
      if (!entries.length) {
        collectedRow.add(scene.add.text(0, 0, "—", textStyle({ role: "display", size: 34, color: INK_SOFT })).setOrigin(0.5));
        return;
      }
      entries.forEach(([currency, amount], index) => {
        const frame = addFramedIcon(scene, collectedRow, (index - (entries.length - 1) / 2) * gap, 0, size, CURRENCY_ICON_BY_WALLET[currency], { amount: formatCurrency(amount), amountRatio: 0.3 });
        if (currency === pop && motion() > 0) scene.tweens.add({ targets: frame, scale: { from: 1.3, to: 1 }, duration: 320, ease: "Back.Out" });
      });
    };
    const paintRound = (): void => {
      const round = status.run?.round ?? 0;
      roundText.setText(t("chestForge.round", { round: round + 1, total: CHEST_FORGE.rounds }));
      dots.clear();
      for (let index = 0; index < CHEST_FORGE.rounds; index += 1) {
        const x = (index - (CHEST_FORGE.rounds - 1) / 2) * 34, y = FORGE.pick.roundY + 42;
        dots.fillStyle(index <= round ? 0xff8f6b : 0xffffff, index <= round ? 1 : 0.8).fillCircle(x, y, index === round ? 10 : 8);
      }
    };
    const paintOffer = (enterFrom = false): void => {
      cardsRow.removeAll(true);
      cardHolders = [];
      const offer = status.run?.offer ?? [];
      const { width, height, gap } = FORGE.card;
      offer.forEach((id, index) => {
        const card = chestCard(id);
        if (!card) return;
        const x = (index - (offer.length - 1) / 2) * (width + gap);
        const holder = scene.add.container(x, 0);
        paintCard(scene, holder, card, width, height, "front");
        cardsRow.add(holder);
        // 창이 흐르지 않아 창 전체가 손을 받는 자리다. 카드 면은 뒤집을 때 다시 그려지므로 입력면은 줄에 따로 세운다.
        const hit = addClippedHit(scene, cardsRow, x, 0, width, height, () => ({ left: 0, right: scene.scale.width, top: 0, bottom: scene.scale.height }), { useHandCursor: true });
        hit.on("pointerover", () => { if (!busy) holder.setScale(1.05); });
        hit.on("pointerout", () => { if (!busy) holder.setScale(1); });
        hit.on("pointerup", () => void pick(index));
        cardHolders.push(holder);
        if (enterFrom && motion() > 0) {
          holder.setAlpha(0).setY(60 * motion()).setScale(0.9);
          scene.tweens.add({ targets: holder, alpha: 1, y: 0, scale: 1, duration: 300, delay: index * 80, ease: "Back.Out" });
        }
      });
    };

    const refresh = (): void => {
      coinText.setText(t("chestForge.coins", { count: status.coins.toLocaleString() }));
      const total = 52 + 12 + coinText.width;
      coinIcon.setX(-total / 2 + 26); coinText.setX(-total / 2 + 64);
      resetText.setText(t("chestForge.reset", { date: new Date(status.resetsAt).toLocaleString(undefined, { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) }));
      const running = status.run !== null;
      introPage.setVisible(!running); pickPage.setVisible(running);
      enter.setLabel(t("chestForge.enter", { count: CHEST_FORGE.entryCost }));
      enter.setEnabled(!busy && status.coins >= CHEST_FORGE.entryCost);
      if (running) { paintRound(); paintCollected(status.run?.collected ?? {}); }
    };

    const publish = (): void => managerEvents.publish("wallet", { wallet: session.wallet });
    const request = async (key: string, call: (requestId: string) => Promise<ChestForgeResponse>): Promise<ChestForgeResponse | undefined> => {
      try {
        if (pendingRequest?.key !== key) pendingRequest = { key, requestId: crypto.randomUUID() };
        const result = await call(pendingRequest.requestId);
        pendingRequest = undefined;
        return result;
      } catch (error) {
        logError("chestForge.request", "보물상자 요청 실패", error);
        if (alive) note.setText(t("chestForge.error"));
        return undefined;
      }
    };

    async function enterBox(): Promise<void> {
      if (busy) return;
      busy = true; refresh();
      const result = await request("enter", (requestId) => gameApi.enterChestForge({ requestId }));
      busy = false;
      if (!result) { if (alive) refresh(); return; }
      status = result.status;
      if (!alive) return;
      note.setText(t("chestForge.rules"));
      audioManager?.playUi("roulette.tick");
      hint.setVisible(true);
      collectedLabel.setVisible(true);
      collectedRow.setVisible(true);
      buildPickChest();
      refresh();
      paintOffer(true);
    }

    /** 다 고른 뒤 — 카드 줄을 걷고 상자를 연다. 아무것도 모으지 못했으면 열지 않고 주저앉는다. */
    async function openFinished(total: ChestForgeRun["collected"]): Promise<void> {
      const chest = pickChest;
      const items = currencyRecordToRewardItems(total);
      hint.setVisible(false);
      cardsRow.removeAll(true);
      if (!chest) return;
      if (!items.length) {
        if (pickSd?.active) playMotion(scene, pickSd, "hit");
        await chest.fizzle();
        return;
      }
      const textures = (Object.entries(total).filter(([, amount]) => (amount ?? 0) > 0) as [ChestCardCurrency, number][])
        .map(([currency]) => ({ texture: CURRENCY_ICON_BY_WALLET[currency] }));
      collectedLabel.setVisible(false);
      collectedRow.setVisible(false);
      const opening = chest.open(textures, FORGE.pick.openY, FORGE.pick.openGrow);
      scene.time.delayedCall(1050, () => cheer(scene, pickSd, FORGE.pick.sd.groundY, 2));
      await opening;
      if (!alive) return;
      await new Promise<void>((resolve) => openRewardPopup(scene, popups, { title: t("chestForge.reward"), titleSize: 36, dimAlpha: 0.66, items, onConfirm: resolve }));
    }

    /**
     * 카드 한 장 — 집어 들면 부르르 떨며 빛이 모이고(지이잉), 뒤집히며(핑!) 도장이 찍힌다(쾅!). 받은 카드는 상자로 날아
     * 들어가고 화려할수록 요란하다. 놓친 카드는 그 자리에서 깨진다(파사삭). 서버 요청은 집어 드는 동안 함께 간다.
     */
    async function pick(index: number): Promise<void> {
      if (busy || !status.run) return;
      const card = chestCard(status.run.offer[index] ?? "");
      if (!card) return;
      busy = true;
      const holder = cardHolders[index];
      const { width, height } = FORGE.card;
      const flair = chestCardFlair(card);
      holder?.setScale(1);
      hint.setVisible(false);
      cardHolders.forEach((other, otherIndex) => { if (otherIndex !== index) scene.tweens.add({ targets: other, alpha: 0.3, scale: 0.94, duration: 200 }); });
      const asked = request(`pick-${status.run.round}-${index}`, (requestId) => gameApi.pickChestCard({ requestId, index }));
      const charged = holder ? chargeCard(scene, cardsRow, holder, width, height, TIER_TONE[card.tier].face, flair) : Promise.resolve(undefined);
      const [result, glow] = await Promise.all([asked, charged]);
      if (!result?.pick) {
        glow?.destroy();
        busy = false;
        if (alive) { refresh(); paintOffer(); hint.setVisible(true); }
        return;
      }
      if (!alive) { status = result.status; return; }
      const outcome = result.pick;
      if (outcome.success) publish();
      const collected = result.status.run?.collected ?? outcome.total ?? {};
      if (holder) {
        await flipCard(scene, holder, width, height, () => paintCard(scene, holder, card, width, height, outcome.success ? "win" : "miss"), outcome.success);
        await waitFx(scene, 120);
        await stampCard(scene, holder, width, outcome.success, t(outcome.success ? "chestForge.win" : "chestForge.miss"), flair);
        glow?.destroy();
        if (outcome.success) {
          await waitFx(scene, 260);
          const from = { x: holder.x, y: FORGE.pick.cardsY + holder.y };
          cheer(scene, pickSd, FORGE.pick.sd.groundY, flair >= 3 ? 2 : 1);
          await flyCardToChest(scene, pickPage, holder, from, pickChest?.mouth() ?? { x: 0, y: FORGE.pick.chestY }, flair);
          if (!alive) return;
          pickChest?.gulp(flair);
          paintCollected(collected, card.currency);
          await pickChest?.setValue(chestCollectedValue(collected));
        } else {
          await waitFx(scene, 300);
          if (pickSd?.active) playMotion(scene, pickSd, "hit");
          await shatterCard(scene, cardsRow, holder, width, height);
        }
      }
      if (!alive) { status = result.status; return; }
      await waitFx(scene, 240);
      status = result.status;
      if (status.run) {
        busy = false;
        refresh();
        hint.setVisible(true);
        paintOffer(true);
        return;
      }
      await openFinished(outcome.total ?? {});
      busy = false;
      if (!alive) return;
      refresh();
    }

    refresh();
    if (status.run) { buildPickChest(); paintOffer(); }
  });
}
