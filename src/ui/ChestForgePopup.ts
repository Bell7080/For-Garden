import Phaser from "phaser";
import { t } from "../i18n";
import type { TextKey } from "../i18n";
import { gameApi } from "../api/FakeServer";
import type { ChestForgeResponse } from "../api/contracts";
import { formatCurrency } from "../core/formatCurrency";
import { CHEST_CARDS, CHEST_FORGE, chestCard, type ChestCard, type ChestCardTier, type ChestForgeStatus } from "../core/chestForge";
import { motionPolicy } from "../core/settings";
import { audioManager } from "../managers/AudioManager";
import { logError } from "../managers/ErrorReporter";
import { managerEvents } from "../managers/ManagerEvents";
import { session } from "../state/session";
import { ensureChestTexture } from "./chestArt";
import { addClippedHit } from "./clippedHit";
import { CURRENCY_ICON_BY_WALLET } from "./currencyIcons";
import { addFramedIcon } from "./itemFrame";
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
  intro: { textY: -560, chestY: -250, chestScale: 0.9, previewY: 180, buttonY: 500 },
  pick: { roundY: -560, collectedLabelY: -480, collectedY: -390, cardsY: 10, hintY: 300, chestY: 450, chestScale: 0.42 },
  rulesY: 650,
  card: { width: 196, height: 300, gap: 18, icon: 112 },
  preview: { width: 168, height: 250, gap: 20 },
  collected: { size: 84, gap: 104 },
  button: { height: 116, wide: 720 },
} as const;

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
  spots.forEach(([x, y, currency, size, angle], index) => {
    const icon = scene.add.image(x, y, CURRENCY_ICON_BY_WALLET[currency]).setDisplaySize(size, size).setAngle(angle).setAlpha(0.7).setMask(mask);
    body.add(icon);
    if (motion > 0) scene.tweens.add({ targets: icon, y: y - 10 * motion, angle: angle + 6, duration: 1600 + (index % 5) * 260, yoyo: true, repeat: -1, ease: "Sine.InOut", delay: index * 110 });
  });
}

/**
 * 카드 한 장. 앞면은 등급 띠 → 보상 액자(수량) → 받을 확률. 뒤집은 면은 받았으면 같은 보상과 「획득!」, 놓쳤으면 잿빛 「꽝」이다.
 * 대박 카드는 둘레에 반짝임이 붙는다.
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
  if (miss) {
    holder.add(scene.add.text(0, iconY + 10, t("chestForge.miss"), textStyle({ role: "display", size: 52, color: "#8a7f7c" })).setOrigin(0.5).setStroke(OUTLINE, 8));
    return;
  }
  const icon = Math.min(FORGE.card.icon, width * 0.6);
  addFramedIcon(scene, holder, 0, iconY, icon, CURRENCY_ICON_BY_WALLET[card.currency], { amount: formatCurrency(card.amount), amountRatio: 0.3 });
  const footY = height / 2 - 40;
  if (face === "win") {
    holder.add(scene.add.text(0, footY, t("chestForge.win"), textStyle({ role: "display", size: 34, color: ACCENT })).setOrigin(0.5).setStroke(OUTLINE, 8));
  } else {
    const pill = scene.add.graphics();
    pill.fillStyle(tone.deep, 1).fillRoundedRect(-58, footY - 24, 116, 48, 24);
    holder.add(pill);
    holder.add(scene.add.text(0, footY, `${card.chance}%`, textStyle({ role: "display", size: 30, color: "#ffffff" })).setOrigin(0.5));
  }
  if (card.tier === "jackpot" || face === "win") {
    const sparkle = scene.add.graphics();
    for (const [x, y, size] of [[-width / 2 + 6, -height / 2 + 70, 16], [width / 2 - 8, -height / 2 + 120, 12], [width / 2 - 14, height / 2 - 92, 18]] as const) {
      drawSparkle(sparkle, x, y, size, card.tier === "jackpot" ? 0xffe38a : 0xffffff, 1);
    }
    holder.add(sparkle);
  }
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
    const coinIcon = scene.add.image(0, FORGE.coinY, "currency-treasure-chest-coin").setDisplaySize(52, 52);
    const coinText = scene.add.text(0, FORGE.coinY, "", textStyle({ role: "display", size: 38, color: ACCENT })).setOrigin(0, 0.5).setStroke(OUTLINE, 8);
    const resetText = scene.add.text(0, FORGE.resetY, "", textStyle({ role: "body", size: 21, color: INK_SOFT, align: "center", wrap: 840 })).setOrigin(0.5);
    body.add([coinIcon, coinText, resetText]);

    // 첫 쪽 — 상자와 대박 카드 미리보기.
    const introPage = scene.add.container(0, 0);
    body.add(introPage);
    introPage.add(scene.add.text(0, FORGE.intro.textY, t("chestForge.intro"), textStyle({ role: "emphasis", size: 27, color: INK, wrap: 780, align: "center" })).setOrigin(0.5));
    const introChest = scene.add.image(0, FORGE.intro.chestY, ensureChestTexture(scene, 7, false)).setScale(FORGE.intro.chestScale);
    introPage.add(introChest);
    if (motion() > 0) scene.tweens.add({ targets: introChest, y: FORGE.intro.chestY - 14 * motion(), duration: 1400, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    const highlights = [...CHEST_CARDS].filter((card) => card.tier === "jackpot" || card.tier === "big").sort((a, b) => Number(b.tier === "jackpot") - Number(a.tier === "jackpot") || b.amount - a.amount).slice(0, 4);
    const { width: pw, height: ph, gap: pg } = FORGE.preview;
    introPage.add(scene.add.text(0, FORGE.intro.previewY - ph / 2 - 34, t("chestForge.jackpotHeader"), textStyle({ role: "display", size: 30, color: INK })).setOrigin(0.5).setStroke(OUTLINE, 8));
    highlights.forEach((card, index) => {
      const holder = scene.add.container((index - (highlights.length - 1) / 2) * (pw + pg), FORGE.intro.previewY);
      paintCard(scene, holder, card, pw, ph, "front");
      holder.setAngle((index - (highlights.length - 1) / 2) * 3);
      introPage.add(holder);
    });
    const enter = new RouletteSpinButton(scene, 0, FORGE.intro.buttonY, { width: FORGE.button.wide, height: FORGE.button.height, label: "", tone: 0xffb36b, onClick: () => void enterBox() });
    introPage.add(enter);

    // 카드 쪽.
    const pickPage = scene.add.container(0, 0);
    body.add(pickPage);
    const roundText = scene.add.text(0, FORGE.pick.roundY, "", textStyle({ role: "display", size: 40, color: INK })).setOrigin(0.5).setStroke(OUTLINE, 10);
    const dots = scene.add.graphics();
    pickPage.add([roundText, dots]);
    pickPage.add(scene.add.text(0, FORGE.pick.collectedLabelY, t("chestForge.collected"), textStyle({ role: "emphasis", size: 24, color: INK_SOFT })).setOrigin(0.5));
    const collectedRow = scene.add.container(0, FORGE.pick.collectedY);
    const cardsRow = scene.add.container(0, FORGE.pick.cardsY);
    const hint = scene.add.text(0, FORGE.pick.hintY, t("chestForge.pickHint"), textStyle({ role: "emphasis", size: 28, color: ACCENT })).setOrigin(0.5).setStroke(OUTLINE, 6);
    const pickChest = scene.add.image(0, FORGE.pick.chestY, ensureChestTexture(scene, 7, true)).setScale(FORGE.pick.chestScale);
    pickPage.add([collectedRow, cardsRow, hint, pickChest]);
    if (motion() > 0) scene.tweens.add({ targets: hint, alpha: { from: 1, to: 0.45 }, duration: 800, yoyo: true, repeat: -1, ease: "Sine.InOut" });

    const note = scene.add.text(0, FORGE.rulesY, t("chestForge.rules"), textStyle({ role: "body", size: 21, color: INK_SOFT, wrap: 820, align: "center" })).setOrigin(0.5);
    body.add(note);

    let cardHolders: Phaser.GameObjects.Container[] = [];
    const paintCollected = (): void => {
      collectedRow.removeAll(true);
      const entries = Object.entries(status.run?.collected ?? {}).filter(([, amount]) => (amount ?? 0) > 0) as [keyof typeof CURRENCY_ICON_BY_WALLET, number][];
      const { size, gap } = FORGE.collected;
      if (!entries.length) {
        collectedRow.add(scene.add.text(0, 0, "—", textStyle({ role: "display", size: 34, color: INK_SOFT })).setOrigin(0.5));
        return;
      }
      entries.forEach(([currency, amount], index) => {
        addFramedIcon(scene, collectedRow, (index - (entries.length - 1) / 2) * gap, 0, size, CURRENCY_ICON_BY_WALLET[currency], { amount: formatCurrency(amount), amountRatio: 0.3 });
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
      if (running) { paintRound(); paintCollected(); }
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
      refresh();
      paintOffer(true);
    }

    /** 카드 한 장을 뒤집는다 — 좁아졌다가 결과 면으로 넓어지고, 나머지 카드는 흐려진다. */
    async function pick(index: number): Promise<void> {
      if (busy || !status.run) return;
      const card = chestCard(status.run.offer[index] ?? "");
      if (!card) return;
      busy = true;
      const holder = cardHolders[index];
      holder?.setScale(1);
      const result = await request(`pick-${status.run.round}-${index}`, (requestId) => gameApi.pickChestCard({ requestId, index }));
      if (!result?.pick) { busy = false; if (alive) refresh(); return; }
      if (!alive) { status = result.status; return; }
      const outcome = result.pick;
      if (outcome.success) publish();
      const { width, height } = FORGE.card;
      const done = (): void => {
        status = result.status;
        busy = false;
        if (!alive) return;
        refresh();
        if (status.run) { paintOffer(true); return; }
        const items = currencyRecordToRewardItems(outcome.total ?? {});
        if (items.length) openRewardPopup(scene, popups, { title: t("chestForge.reward"), titleSize: 36, dimAlpha: 0.66, items });
      };
      const reveal = (): void => {
        if (!holder) return;
        paintCard(scene, holder, card, width, height, outcome.success ? "win" : "miss");
        audioManager?.playUi(outcome.success ? "roulette.win" : "roulette.tick");
        cardHolders.forEach((other, otherIndex) => { if (otherIndex !== index) other.setAlpha(0.35); });
      };
      const distance = motion();
      if (distance <= 0 || !holder) { reveal(); scene.time.delayedCall(700, done); return; }
      scene.tweens.add({ targets: holder, y: -24 * distance, duration: 140, ease: "Sine.Out" });
      scene.tweens.add({ targets: holder, scaleX: 0, duration: 160, delay: 140, ease: "Sine.In", onComplete: () => {
        reveal();
        scene.tweens.add({ targets: holder, scaleX: outcome.success ? 1.12 : 1, scaleY: outcome.success ? 1.12 : 1, duration: 200, ease: "Back.Out", onComplete: () => {
          scene.time.delayedCall(outcome.success ? 750 : 600, done);
        } });
      } });
    }

    refresh();
    if (status.run) paintOffer();
  });
}
