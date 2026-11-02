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
import { CURRENCY_ICON_BY_WALLET } from "./currencyIcons";
import { addFramedIcon } from "./itemFrame";
import { popupArtShape, popupBodyShapeMask } from "./popupArt";
import type { PopupLayer } from "./PopupLayer";
import { openRewardPopup } from "./RewardPopup";
import { currencyRecordToRewardItems } from "./rewardPopupModel";
import { RouletteSpinButton } from "./RouletteSpinButton";
import { drawSparkle } from "./rouletteWheel";
import { COLOR, textStyle } from "./theme";

/**
 * 보물상자 대장간 창의 자리. 위에서부터 안내 → 코인 → 상자 → 지금 단계 → 단계표(사다리) → 버튼이 쌓인다.
 * 단계표가 곧 확률 공개다 — 단계마다 오를 확률과 받는 보상을 늘 보여 준다.
 */
const FORGE = {
  width: 940,
  height: 1540,
  introY: -686,
  coinY: -612,
  resetY: -568,
  chest: { y: -400, size: 230 },
  stageY: -236,
  chanceY: -192,
  ladder: { top: -132, row: 66, width: 820, iconSize: 50 },
  buttonY: 584,
  button: { width: 400, height: 116, gap: 430, wide: 720 },
  rulesY: 696,
} as const;

/** 단계마다 상자의 결 — 나무 → 은 → 금 → 자수정 → 전설. 오를수록 반짝임이 는다. */
const CHEST_TONE: readonly { body: number; band: number; glow: number }[] = [
  { body: 0x8a5a33, band: 0xc79a5a, glow: 0xffd9a0 },
  { body: 0x8a5a33, band: 0xc79a5a, glow: 0xffd9a0 },
  { body: 0x7d8796, band: 0xdde5ef, glow: 0xe6f1ff },
  { body: 0x7d8796, band: 0xdde5ef, glow: 0xe6f1ff },
  { body: 0xb98a1e, band: 0xffe07a, glow: 0xfff0a8 },
  { body: 0xb98a1e, band: 0xffe07a, glow: 0xfff0a8 },
  { body: 0x6c3fa8, band: 0xd7a8ff, glow: 0xf0d8ff },
  { body: 0xb4306a, band: 0xffd36e, glow: 0xffe6f2 },
];
const INK = 0x2a1426;

/** 상자 한 개를 그린다 — 몸통·뚜껑·띠·자물쇠. `open`이면 뚜껑이 젖혀진다. */
function drawChest(graphics: Phaser.GameObjects.Graphics, stage: number, size: number, open = false): void {
  const tone = CHEST_TONE[Math.max(0, Math.min(CHEST_TONE.length - 1, stage))];
  const w = size, h = size * 0.62, lid = size * 0.34;
  graphics.clear();
  graphics.fillStyle(0x000000, 0.35).fillEllipse(0, h / 2 + 14, w * 1.05, 34);
  // 몸통
  graphics.fillStyle(INK, 1).fillRoundedRect(-w / 2 - 6, -h / 2 - 6, w + 12, h + 12, 16);
  graphics.fillStyle(tone.body, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 12);
  graphics.fillStyle(tone.band, 1).fillRect(-w / 2, -h / 2 + 10, w, 16).fillRect(-w * 0.32, -h / 2, 22, h).fillRect(w * 0.32 - 22, -h / 2, 22, h);
  // 뚜껑
  const lidY = open ? -h / 2 - lid - 34 : -h / 2 - lid + 4;
  graphics.fillStyle(INK, 1).fillRoundedRect(-w / 2 - 6, lidY - 6, w + 12, lid + 12, { tl: 40, tr: 40, bl: 8, br: 8 });
  graphics.fillStyle(tone.body, 1).fillRoundedRect(-w / 2, lidY, w, lid, { tl: 34, tr: 34, bl: 6, br: 6 });
  graphics.fillStyle(tone.band, 1).fillRect(-w * 0.32, lidY, 22, lid).fillRect(w * 0.32 - 22, lidY, 22, lid);
  graphics.fillStyle(0xffffff, 0.22).fillRoundedRect(-w / 2 + 20, lidY + 10, w - 40, 10, 5);
  // 자물쇠
  if (!open) {
    graphics.fillStyle(INK, 1).fillRoundedRect(-24, -h / 2 - 22, 48, 54, 10);
    graphics.fillStyle(tone.band, 1).fillRoundedRect(-18, -h / 2 - 16, 36, 42, 8);
    graphics.fillStyle(INK, 1).fillCircle(0, -h / 2 + 2, 6);
  } else {
    graphics.fillStyle(tone.glow, 0.85).fillTriangle(-w * 0.42, -h / 2, w * 0.42, -h / 2, 0, -h / 2 - size * 0.9);
  }
  for (let index = 0; index < Math.min(stage, 6); index += 1) {
    const angle = index * 1.1 + 0.4;
    drawSparkle(graphics, Math.cos(angle) * w * 0.72, -h * 0.2 + Math.sin(angle) * h * 0.9, 10 + (index % 3) * 4, tone.glow, 0.9);
  }
}

/** 단계표 한 줄 — 단계 · 오를 확률 · 보상 액자 셋. 지금 단계는 강조 띠가 깔린다. */
function addLadderRow(scene: Phaser.Scene, body: Phaser.GameObjects.Container, stage: number, y: number): Phaser.GameObjects.Graphics {
  const { width, row, iconSize } = FORGE.ladder;
  const highlight = scene.add.graphics();
  body.add(highlight);
  const left = -width / 2;
  body.add(scene.add.text(left + 24, y, t("chestForge.stage", { stage }), textStyle({ role: "display", size: 26, color: COLOR.ink })).setOrigin(0, 0.5));
  const chance = CHEST_FORGE_STAGES[stage].chance;
  body.add(scene.add.text(left + 170, y, stage === 0 ? "—" : `${chance}%`, textStyle({ role: "emphasis", size: 25, color: stage === 0 ? COLOR.inkDim : "#ffe7a3" })).setOrigin(0, 0.5));
  const reward = CHEST_FORGE_STAGES[stage].reward;
  const entries = [["gold", reward.gold], ["cheesecake", reward.cheesecake], ["gems", reward.gems]] as const;
  entries.forEach(([currency, amount], index) => {
    addFramedIcon(scene, body, left + 330 + index * 160, y, iconSize, CURRENCY_ICON_BY_WALLET[currency], { amount: formatCurrency(amount), amountRatio: 0.34 });
  });
  highlight.setData("rowY", y).setData("rowHeight", row - 8);
  return highlight;
}

/** 보물상자 대장간 — 받기·강화·보상 받기는 모두 서버가 확정한다. 창을 닫아도 진행 중인 상자는 남는다. */
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
    const backdrop = scene.add.graphics();
    backdrop.fillStyle(0x1d1420, 0.86).fillRect(-FORGE.width / 2, -FORGE.height / 2, FORGE.width, FORGE.height);
    // 화덕의 불빛 — 상자 뒤에서 옅게 번진다.
    for (let ring = 6; ring > 0; ring -= 1) backdrop.fillStyle(0xff9a3c, 0.035).fillEllipse(0, FORGE.chest.y + 20, 260 + ring * 90, 200 + ring * 60);
    body.add(backdrop.setMask(mask));

    body.add(scene.add.text(0, FORGE.introY, t("chestForge.intro"), textStyle({ role: "body", size: 25, color: COLOR.ink, wrap: 820, align: "center" })).setOrigin(0.5));
    const coinIcon = scene.add.image(0, FORGE.coinY, CURRENCY_ICON_BY_WALLET.gold).setDisplaySize(48, 48).setTint(0xffb36b);
    const coinText = scene.add.text(0, FORGE.coinY, "", textStyle({ role: "display", size: 36, color: "#ffe7a3" })).setOrigin(0, 0.5).setStroke("#2a1426", 8);
    const resetText = scene.add.text(0, FORGE.resetY, "", textStyle({ role: "body", size: 21, color: COLOR.inkDim, align: "center" })).setOrigin(0.5);
    body.add([coinIcon, coinText, resetText]);

    const chest = scene.add.graphics({ x: 0, y: FORGE.chest.y });
    body.add(chest);
    const stageText = scene.add.text(0, FORGE.stageY, "", textStyle({ role: "display", size: 40, color: "#ffffff" })).setOrigin(0.5).setStroke("#2a1426", 8);
    const chanceText = scene.add.text(0, FORGE.chanceY, "", textStyle({ role: "emphasis", size: 25, color: "#ffe7a3", align: "center" })).setOrigin(0.5);
    body.add([stageText, chanceText]);

    // 단계표 — 위가 가장 높은 단계다(오를수록 위로 간다).
    const rows: Phaser.GameObjects.Graphics[] = [];
    for (let stage = CHEST_FORGE_MAX_STAGE; stage >= 0; stage -= 1) {
      const y = FORGE.ladder.top + (CHEST_FORGE_MAX_STAGE - stage) * FORGE.ladder.row + FORGE.ladder.row / 2;
      rows[stage] = addLadderRow(scene, body, stage, y);
    }
    const ladderHeader = scene.add.text(-FORGE.ladder.width / 2 + 170, FORGE.ladder.top - 18, t("chestForge.chanceHeader"), textStyle({ role: "emphasis", size: 19, color: COLOR.inkDim })).setOrigin(0, 0.5);
    body.add(ladderHeader);

    const { width, height, gap, wide } = FORGE.button;
    const enter = new RouletteSpinButton(scene, 0, FORGE.buttonY, { width: wide, height, label: "", tone: 0xffb36b, onClick: () => void step("enter") });
    const claim = new RouletteSpinButton(scene, -gap / 2, FORGE.buttonY, { width, height, label: t("chestForge.claim"), tone: 0x6fd6b0, onClick: () => void step("claim") });
    const upgrade = new RouletteSpinButton(scene, gap / 2, FORGE.buttonY, { width, height, label: "", tone: 0xff8fb8, onClick: () => void step("upgrade") });
    body.add([enter, claim, upgrade]);
    const note = scene.add.text(0, FORGE.rulesY, t("chestForge.rules"), textStyle({ role: "body", size: 21, color: COLOR.inkDim, wrap: 820, align: "center" })).setOrigin(0.5);
    body.add(note);

    const paintRows = (): void => {
      rows.forEach((highlight, stage) => {
        const y = highlight.getData("rowY") as number, rowHeight = highlight.getData("rowHeight") as number;
        highlight.clear();
        if (status.stage === stage) {
          highlight.fillStyle(0xffb36b, 0.28).fillRoundedRect(-FORGE.ladder.width / 2, y - rowHeight / 2, FORGE.ladder.width, rowHeight, 12);
          highlight.fillStyle(0xffe7a3, 1).fillRect(-FORGE.ladder.width / 2, y - rowHeight / 2, 8, rowHeight);
        } else highlight.fillStyle(0xffffff, stage % 2 ? 0.035 : 0.06).fillRoundedRect(-FORGE.ladder.width / 2, y - rowHeight / 2, FORGE.ladder.width, rowHeight, 12);
      });
    };
    const refresh = (): void => {
      const coins = status.coins.toLocaleString();
      coinText.setText(t("chestForge.coins", { count: coins }));
      const total = 48 + 12 + coinText.width;
      coinIcon.setX(-total / 2 + 24); coinText.setX(-total / 2 + 60);
      resetText.setText(t("chestForge.reset", { date: new Date(status.resetsAt).toLocaleString(undefined, { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) }));
      const running = status.stage !== null;
      drawChest(chest, status.stage ?? 0, FORGE.chest.size);
      chest.setAlpha(running ? 1 : 0.45);
      stageText.setText(running ? t("chestForge.stage", { stage: status.stage! }) : t("chestForge.noChest"));
      chanceText.setText(running ? (status.nextChance === null ? t("chestForge.max") : t("chestForge.chance", { rate: status.nextChance })) : t("chestForge.entryCost", { count: CHEST_FORGE.entryCost }));
      enter.setVisible(!running); claim.setVisible(running); upgrade.setVisible(running);
      enter.setLabel(t("chestForge.enter", { count: CHEST_FORGE.entryCost }));
      enter.setEnabled(!busy && status.coins >= CHEST_FORGE.entryCost);
      upgrade.setLabel(status.nextChance === null ? t("chestForge.maxShort") : t("chestForge.upgrade", { rate: status.nextChance }));
      upgrade.setEnabled(!busy && running && status.nextChance !== null);
      claim.setEnabled(!busy && running);
      paintRows();
    };

    const publish = (): void => managerEvents.publish("wallet", { wallet: session.wallet });
    /** 강화 성공 — 상자가 부르르 떨다 번쩍인다. 실패 — 떨다 금이 가며 흩어진다. */
    const playUpgrade = (success: boolean, done: () => void): void => {
      const distance = 10 * motion();
      if (distance <= 0) { done(); return; }
      scene.tweens.add({ targets: chest, x: { from: -distance, to: distance }, duration: 60, yoyo: true, repeat: 5, onComplete: () => {
        chest.setX(0);
        if (!alive) return;
        if (success) {
          const flash = scene.add.graphics({ x: 0, y: FORGE.chest.y });
          flash.fillStyle(0xfff3c4, 0.7).fillEllipse(0, 0, 420, 300);
          body.add(flash);
          scene.tweens.add({ targets: flash, alpha: 0, scale: 1.4, duration: 420, onComplete: () => flash.destroy() });
          scene.tweens.add({ targets: chest, scale: { from: 1.18, to: 1 }, duration: 320, ease: "Back.Out", onComplete: done });
        } else {
          scene.tweens.add({ targets: chest, alpha: 0.1, angle: 8, y: FORGE.chest.y + 26, duration: 380, onComplete: () => { chest.setAngle(0).setY(FORGE.chest.y); done(); } });
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
        logError("chestForge.request", "보물상자 대장간 요청 실패", error);
        if (alive) { busy = false; refresh(); note.setText(t("chestForge.error")); }
        return;
      }
      status = result.status;
      if (!alive) return;
      note.setText(t("chestForge.rules"));
      const finish = (): void => { if (!alive) return; busy = false; refresh(); };
      if (kind === "upgrade") {
        audioManager?.playUi(result.success ? "roulette.win" : "roulette.tick");
        drawChest(chest, stageBefore, FORGE.chest.size);
        playUpgrade(result.success === true, () => {
          if (alive) note.setText(t(result.success ? "chestForge.success" : "chestForge.broken"));
          finish();
        });
      } else if (kind === "claim") {
        publish();
        drawChest(chest, stageBefore, FORGE.chest.size, true);
        audioManager?.playUi("roulette.win");
        const items = currencyRecordToRewardItems(result.granted ?? {});
        scene.time.delayedCall(360, () => {
          finish();
          if (alive && items.length) openRewardPopup(scene, popups, { title: t("chestForge.reward"), titleSize: 36, dimAlpha: 0.66, items });
        });
      } else finish();
    }
    refresh();
  });
}
