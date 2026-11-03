import Phaser from "phaser";
import { t, type TextKey } from "../i18n";
import { gameApi } from "../api/FakeServer";
import type { ShuteFishingResponse } from "../api/contracts";
import { formatCurrency } from "../core/formatCurrency";
import {
  FISHING_DIFFICULTIES, FISH_TIER_FEEL, SHUTE_FISHING, fishTreasure, fishingDifficulty, gaugePosition, judgeCatch,
  type FishTier, type FishingCatch, type FishingDifficultyId, type FishingJudgment, type ShuteFishingStatus,
} from "../core/shuteFishing";
import type { ChestCardCurrency } from "../core/chestForge";
import { motionPolicy } from "../core/settings";
import { audioManager } from "../managers/AudioManager";
import { logError } from "../managers/ErrorReporter";
import { managerEvents } from "../managers/ManagerEvents";
import { session } from "../state/session";
import { burstSparkles, chestFxMotion, waitFx } from "./chestForgeFx";
import { addClippedHit } from "./clippedHit";
import { CURRENCY_ICON_BY_WALLET } from "./currencyIcons";
import { addFramedIcon } from "./itemFrame";
import { sdAssetFor, spawnPuppet, type PuppetCreature } from "../puppets/assets";
import { addSdFootShadow } from "./SdFootShadow";
import { popupArtShape, popupBodyShapeMask } from "./popupArt";
import type { PopupLayer } from "./PopupLayer";
import { openRewardPopup } from "./RewardPopup";
import { currencyRecordToRewardItems } from "./rewardPopupModel";
import { addCurrencyRain, drawSparkle } from "./rouletteWheel";
import { BACKGROUND } from "./backgroundAssets";
import { addEventPopupBackdrop } from "./eventBackdrop";
import { addCurrencyChip } from "./CurrencyChip";
import { pressIn, pressOut } from "./pressFeedback";
import { SHUTE_TONE, chamferPoints, drawBulbOutline, drawSignalRings, drawStud, paintShuteGauge, shuteGaugeTrack } from "./shuteFishingStyle";
import { shrinkTextToWidth } from "./textFit";
import { textStyle } from "./theme";

/**
 * 슈테의 리듬 낚시 창의 자리. 두 쪽이다.
 * - **첫 쪽**: 판이 없을 때. 코인 → 안내 → 박자에 맞춰 까딱이는 슈테 → 보스곡 안내 → 「게임 방법!」 →
 *   난이도 단추 넷(2×2, 한눈에 다 보인다 — 넘기는 단추가 아니라 고르는 패드다).
 * - **판 쪽**: 위에 남은 기회와 **낚은 보물** → 이번 판의 셋리스트(들어오면 팅팅팅 정해지고, 마지막이 보스곡) →
 *   지금 물고기와 캐치 진행 → 판정·콤보 → 게이지(바늘이 좌우로 오간다) → 크게 누르는 「탭!」 단추.
 * 게이지의 구간·속도와 셋리스트는 서버가 판을 열 때 정해 그대로 보낸다 — 화면은 같은 삼각파(`gaugePosition`)로
 * 바늘을 그리고 셋리스트가 정해지는 모습을 보여 줄 뿐이며, 누른 시간을 보내면 서버가 판정한다.
 */
const FISH = {
  width: 940,
  height: 1540,
  coinY: -684,
  resetY: -618,
  sd: { x: 0, groundY: 130, height: 400 },
  intro: { textY: -500, noteY: 196, howToY: 270, grid: { x: 218, rows: [404, 560], width: 420, height: 138 } },
  play: {
    livesY: -556, collectedLabelY: -494, collectedY: -428, setlistY: -318, setlistSize: 74, bossSize: 92,
    sd: { x: -250, groundY: 110, height: 300 }, fishX: 170, fishY: -110, fishSize: 168, notesY: 22,
    judgeY: 138, comboY: 198, gaugeY: 290, gaugeWidth: 860, gaugeHeight: 96, tapY: 500, tap: { width: 660, height: 150 },
    card: { width: 150, height: 188 }, lineup: { y: -110, width: 118, height: 148, gap: 14 },
  },
  howTo: { width: 820, bubbleWidth: 720, wrap: 600, lineGap: 26, sd: { x: -250, height: 300 } },
} as const;

/** 리듬 낚시 전용 이벤트 코인 그림(`currencyIcons`). 코인은 지갑이 아니라 이번 주에 쓴 스테미나에서 나온다. */
const COIN_ICON = "currency-shute-rhythm-coin";
/** 창 안에 서는 SD — 로비 이벤트 카드와 같은 개체다(`lobbyEvents`의 `shute-fishing`). */
const FISH_SD = "shute";

/** 글 — 검은 잉크, 흐린 갈빛, 강조는 시안 깊은 색. 테는 아이보리. */
const INK = "#22222a";
const INK_SOFT = "#6b6553";
const ACCENT = "#0e8f97";
const OUTLINE = "#fdf6e3";
const IVORY_TEXT = "#fdf6e3";

/** 난이도의 색 — 쉬움 시안, 보통 노랑, 어려움 주황, 매우 어려움 다홍. 스터드와 반짝이가 이 색이다. */
const DIFFICULTY_TONE: Record<FishingDifficultyId, number> = { easy: 0x5fe6ea, normal: 0xffc93c, hard: 0xff9a3c, extreme: 0xff5a6e };
/** 물고기 등급의 색 — 셋리스트 표식과 낚은 보물 카드의 띠. 대박만 금빛이다. */
const TIER_TONE: Record<FishTier, number> = { common: 0x9fdcb4, fine: 0x5fe6ea, rare: 0xb79cff, jackpot: 0xffc93c };

const DIFFICULTY_KEY: Record<FishingDifficultyId, TextKey> = {
  easy: "shuteFishing.difficulty.easy", normal: "shuteFishing.difficulty.normal", hard: "shuteFishing.difficulty.hard", extreme: "shuteFishing.difficulty.extreme",
};
const HINT_KEY: Record<FishingDifficultyId, TextKey> = {
  easy: "shuteFishing.hint.easy", normal: "shuteFishing.hint.normal", hard: "shuteFishing.hint.hard", extreme: "shuteFishing.hint.extreme",
};
const JUDGE_KEY: Record<FishingJudgment, TextKey> = { perfect: "shuteFishing.judge.perfect", good: "shuteFishing.judge.good", miss: "shuteFishing.judge.miss" };
const JUDGE_COLOR: Record<FishingJudgment, string> = { perfect: "#ffc93c", good: "#5fe6ea", miss: "#9a96a0" };

/** 셋리스트가 팅팅팅 정해지는 동안 칸에서 돌아가는 그림 — 난수 없이 차례로 돈다. */
const SPIN_ICONS = [
  CURRENCY_ICON_BY_WALLET.gems, CURRENCY_ICON_BY_WALLET.gold, CURRENCY_ICON_BY_WALLET.cheesecake, CURRENCY_ICON_BY_WALLET.stamina,
  CURRENCY_ICON_BY_WALLET.fossil, CURRENCY_ICON_BY_WALLET.rawStone, CURRENCY_ICON_BY_WALLET.amber,
] as const;

const diamond = (cx: number, cy: number, rx: number, ry: number): Phaser.Geom.Point[] =>
  [new Phaser.Geom.Point(cx, cy - ry), new Phaser.Geom.Point(cx + rx, cy), new Phaser.Geom.Point(cx, cy + ry), new Phaser.Geom.Point(cx - rx, cy)];
const anywhere = (scene: Phaser.Scene) => () => ({ left: 0, right: scene.scale.width, top: 0, bottom: scene.scale.height });

/** 슈테 바탕 — 원화 위로 리듬 코인이 내리고, 가장자리에 시안 신호 고리와 노란 스터드가 박자처럼 떠오른다. */
function paintBackdrop(scene: Phaser.Scene, body: Phaser.GameObjects.Container, mask: Phaser.Display.Masks.GeometryMask, motion: number): void {
  addEventPopupBackdrop(scene, body, BACKGROUND.eventShutePopup, FISH.width, FISH.height);
  addCurrencyRain(scene, body, { left: -FISH.width / 2 + 40, right: FISH.width / 2 - 40, top: -FISH.height / 2 + 10, bottom: FISH.height / 2 - 10, count: 7, size: 46, alpha: 0.24, fallMs: 8600, keys: [COIN_ICON] }).setMask(mask);
  const marks: readonly [number, number, "rings" | "stud"][] = [[-404, -360, "rings"], [404, -150, "stud"], [-404, 40, "stud"], [404, 60, "rings"]];
  marks.forEach(([x, y, kind], index) => {
    const g = scene.add.graphics().setPosition(x, y).setAlpha(0.55).setMask(mask);
    if (kind === "rings") drawSignalRings(g, 0, 0, 34);
    else drawStud(g, 0, 0, 30, true);
    body.add(g);
    if (motion > 0) scene.tweens.add({ targets: g, y: y - 12 * motion, duration: 600 + index * 120, yoyo: true, repeat: -1, ease: "Sine.InOut" });
  });
}

/** SD 한 기를 창 안에 세운다. 창의 자식이라 창과 함께 사라진다. 장식이라 입력을 받지 않는다. */
function addFishingSd(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, spot: { x: number; groundY: number; height: number }, flipX = false): Promise<PuppetCreature | undefined> {
  parent.add(addSdFootShadow(scene, spot.x, spot.groundY, spot.height * 0.62));
  return spawnPuppet(scene, sdAssetFor(FISH_SD), { x: spot.x, groundY: spot.groundY, height: spot.height, depth: 0, flipX })
    .then((puppet) => {
      if (!parent.active) { puppet.destroy(); return undefined; }
      puppet.disableInteractive();
      parent.add(puppet);
      return puppet;
    })
    .catch((error) => { logError("puppet.display", "슈테의 리듬 낚시 SD 표시 실패", error); return undefined; });
}

/**
 * 박자에 맞춰 까딱이는 슈테 — 고개를 까딱이듯 짧게 튀고, 난이도가 오르면 박자도 빨라진다(BPM). 캐치하면 한 번 크게 뛰고,
 * 미스하면 옆으로 도리질한다.
 */
class ShuteBeat {
  private puppet?: PuppetCreature;
  private beat?: Phaser.Tweens.Tween;
  private beatMs = 520;
  constructor(private readonly scene: Phaser.Scene, private readonly parent: Phaser.GameObjects.Container, private readonly spot: { x: number; groundY: number; height: number }, flipX = false) {
    void addFishingSd(scene, parent, spot, flipX).then((puppet) => { this.puppet = puppet; this.restart(); });
  }
  /** 바늘이 한쪽 끝에서 다른 끝까지 가는 시간이 곧 한 박자다. */
  setTempo(beatMs: number): void { this.beatMs = Math.max(240, beatMs); this.restart(); }
  private restart(): void {
    const { puppet, scene, spot } = this;
    this.beat?.remove(); this.beat = undefined;
    if (!puppet?.active) return;
    puppet.setY(spot.groundY - spot.height / 2).setAngle(0);
    if (!chestFxMotion().loops) return;
    const restY = puppet.y;
    this.beat = scene.tweens.add({ targets: puppet, y: restY - 14 * chestFxMotion().distance, angle: { from: -3, to: 3 }, duration: this.beatMs / 2, yoyo: true, repeat: -1, ease: "Quad.Out" });
  }
  cheer(times = 1): void {
    const { scene, puppet, spot } = this;
    if (!puppet?.active) return;
    this.beat?.remove(); this.beat = undefined;
    scene.tweens.killTweensOf(puppet);
    const restY = spot.groundY - spot.height / 2;
    puppet.setY(restY);
    burstSparkles(scene, this.parent, spot.x, spot.groundY - spot.height * 0.95, { count: 6 + times * 2, radius: 80, size: 13, colors: [0xffffff, SHUTE_TONE.yellow, SHUTE_TONE.cyan], seed: times * 13 + 5, rise: 30 });
    scene.tweens.add({ targets: puppet, y: restY - 56 * chestFxMotion().distance, duration: 170, yoyo: true, repeat: times - 1, ease: "Quad.Out", onComplete: () => this.restart() });
  }
  flinch(): void {
    const { scene, puppet, spot } = this;
    if (!puppet?.active || !chestFxMotion().loops) return;
    scene.tweens.add({ targets: puppet, x: { from: spot.x - 9, to: spot.x + 9 }, duration: 55, yoyo: true, repeat: 2, ease: "Sine.InOut", onComplete: () => puppet.setX(spot.x) });
  }
}

/**
 * 난이도 단추 — 슈테가 쥔 검은 패드처럼 왼쪽 위·오른쪽 아래를 깎은 검은 판, 안쪽에 시안 네온 테, 아래로 노란
 * 두께. 위 줄의 삼각 스터드 수가 난이도(1~4)이고, 이름 아래에 곡 수와 보스곡 안내, 오른쪽 시안 알약이 드는 코인이다.
 * 누를 수 있는 동안 안쪽 시안 테가 박자처럼 숨 쉰다.
 */
class FishingPickButton extends Phaser.GameObjects.Container {
  private readonly face: Phaser.GameObjects.Container;
  private readonly label: Phaser.GameObjects.Text;
  private readonly hint: Phaser.GameObjects.Text;
  private readonly priceText: Phaser.GameObjects.Text;
  private readonly pill: Phaser.GameObjects.Graphics;
  private readonly coin: Phaser.GameObjects.Image;
  private readonly glow: Phaser.GameObjects.Graphics;
  private pulse?: Phaser.Tweens.Tween;
  private enabled = true;
  private static readonly DEPTH = 12;
  constructor(scene: Phaser.Scene, x: number, y: number, private readonly options: { width: number; height: number; level: number; tone: number; onClick: () => void }) {
    super(scene, x, y);
    const { width, height, level, tone } = options;
    const depth = FishingPickButton.DEPTH, cut = 22, left = -width / 2, top = -height / 2;
    const base = scene.add.graphics();
    base.fillStyle(0x000000, 0.3).fillPoints(chamferPoints(left + 6, top + depth + 10, width, height, cut), true);
    base.fillStyle(SHUTE_TONE.ink, 1).fillPoints(chamferPoints(left - 5, top - 5, width + 10, height + depth + 10, cut + 3), true);
    base.fillStyle(SHUTE_TONE.yellowDeep, 1).fillPoints(chamferPoints(left, top + depth, width, height, cut), true);
    this.add(base);
    this.face = scene.add.container(0, 0);
    const plate = scene.add.graphics();
    plate.fillStyle(SHUTE_TONE.ink, 1).fillPoints(chamferPoints(left, top, width, height, cut), true);
    plate.fillStyle(SHUTE_TONE.inkSoft, 1).fillRect(left + 12, top + height * 0.52, width - 24, 2);
    for (let index = 0; index < 4; index += 1) drawStud(plate, left + 34 + index * 30, top + 44, 20, index < level, tone);
    this.face.add(plate);
    this.glow = scene.add.graphics();
    this.glow.lineStyle(3, SHUTE_TONE.cyan, 1).strokePoints(chamferPoints(left + 7, top + 7, width - 14, height - 14, cut - 5), true);
    this.face.add(this.glow);
    this.label = scene.add.text(left + 26, 14, "", textStyle({ role: "display", size: Math.round(height * 0.27), color: IVORY_TEXT })).setOrigin(0, 0.5);
    this.hint = scene.add.text(left + 26, height / 2 - 26, "", textStyle({ role: "emphasis", size: 19, color: "#5fe6ea" })).setOrigin(0, 0.5);
    this.pill = scene.add.graphics();
    this.coin = scene.add.image(0, 0, COIN_ICON).setDisplaySize(height * 0.3, height * 0.3);
    this.priceText = scene.add.text(0, 0, "", textStyle({ role: "display", size: Math.round(height * 0.2), color: INK })).setOrigin(0, 0.5);
    this.face.add([this.label, this.hint, this.pill, this.coin, this.priceText]);
    this.add(this.face);
    const hit = addClippedHit(scene, this, 0, depth / 2, width, height + depth, anywhere(scene), { useHandCursor: true });
    hit.on("pointerdown", () => { if (this.enabled) this.face.setY(depth * 0.7); });
    hit.on("pointerout", () => this.face.setY(0));
    hit.on("pointerup", () => { this.face.setY(0); if (this.enabled) options.onClick(); });
    this.setSize(width, height + depth);
    this.once(Phaser.GameObjects.Events.DESTROY, () => this.pulse?.remove());
    this.syncPulse();
  }
  setContent(name: string, hint: string, price: number): this {
    const { width, height } = this.options;
    this.priceText.setText(price.toLocaleString());
    const pillHeight = height * 0.36, coin = height * 0.3, pad = 12;
    const pillWidth = pad + coin + 6 + this.priceText.width + pad;
    const pillRight = width / 2 - 20, pillLeft = pillRight - pillWidth, pillY = -height / 2 + 44;
    this.pill.clear();
    this.pill.fillStyle(SHUTE_TONE.cyanDeep, 1).fillRoundedRect(pillLeft - 3, pillY - pillHeight / 2 - 3, pillWidth + 6, pillHeight + 6, pillHeight / 2 + 3);
    this.pill.fillStyle(SHUTE_TONE.cyan, 1).fillRoundedRect(pillLeft, pillY - pillHeight / 2, pillWidth, pillHeight, pillHeight / 2);
    this.coin.setPosition(pillLeft + pad + coin / 2, pillY);
    this.priceText.setPosition(pillLeft + pad + coin + 6, pillY + 1);
    const textWidth = width - 52;
    this.label.setScale(1).setText(name);
    shrinkTextToWidth(this.label, textWidth);
    this.hint.setScale(1).setText(hint);
    shrinkTextToWidth(this.hint, textWidth);
    return this;
  }
  setEnabled(enabled: boolean): this {
    if (this.enabled === enabled) return this;
    this.enabled = enabled;
    this.setAlpha(enabled ? 1 : 0.5);
    this.syncPulse();
    return this;
  }
  private syncPulse(): void {
    const alive = this.enabled && chestFxMotion().loops;
    if (alive && !this.pulse) this.pulse = this.scene.tweens.add({ targets: this.glow, alpha: { from: 1, to: 0.25 }, duration: 520, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    else if (!alive && this.pulse) { this.pulse.remove(); this.pulse = undefined; this.glow.setAlpha(1); }
  }
}

/** 낚은 보물 카드 — 아이보리 판에 등급 색 띠, 가운데 보물 그림과 수. 대박이면 금빛 반짝임이 붙는다. */
function addTreasureCard(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, x: number, y: number, size: { width: number; height: number }, id: string): Phaser.GameObjects.Container {
  const treasure = fishTreasure(id);
  const root = scene.add.container(x, y);
  parent.add(root);
  if (!treasure) return root;
  const { width, height } = size;
  const left = -width / 2, top = -height / 2, cut = width * 0.16;
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.3).fillPoints(chamferPoints(left + 5, top + 9, width, height, cut), true);
  g.fillStyle(SHUTE_TONE.ink, 1).fillPoints(chamferPoints(left - 5, top - 5, width + 10, height + 10, cut + 3), true);
  g.fillStyle(SHUTE_TONE.ivory, 1).fillPoints(chamferPoints(left, top, width, height, cut), true);
  g.fillStyle(TIER_TONE[treasure.tier], 1).fillRect(left + cut, top, width - cut, height * 0.12);
  g.fillStyle(SHUTE_TONE.cream, 1).fillRect(left + 8, top + height * 0.2, width - 16, height * 0.5);
  drawSignalRings(g, 0, top + height * 0.45, width * 0.34, 0.35);
  root.add(g);
  const icon = scene.add.image(0, top + height * 0.45, CURRENCY_ICON_BY_WALLET[treasure.currency]).setDisplaySize(width * 0.56, width * 0.56);
  const amount = scene.add.text(0, top + height * 0.84, formatCurrency(treasure.amount), textStyle({ role: "display", size: Math.round(height * 0.16), color: INK })).setOrigin(0.5);
  shrinkTextToWidth(amount, width - 16);
  root.add([icon, amount]);
  if (treasure.tier === "jackpot") {
    const sparkle = scene.add.graphics();
    drawSparkle(sparkle, left + 10, top + height * 0.24, width * 0.1, 0xffe38a, 1);
    drawSparkle(sparkle, -left - 12, top + height * 0.62, width * 0.08, 0xffffff, 1);
    root.add(sparkle);
  }
  return root;
}

/** 슈테의 리듬 낚시 — 판 열기·캐치는 모두 서버가 확정한다. 창을 닫아도 진행 중인 판은 남는다. */
export async function openShuteFishingPopup(scene: Phaser.Scene, popups: PopupLayer, onChanged: () => void): Promise<void> {
  let status: ShuteFishingStatus = await gameApi.getShuteFishing();
  if (!scene.scene.isActive()) return;
  let busy = false, alive = true;
  const pending = new Map<string, string>();
  const motion = (): number => motionPolicy(session.settings).nonEssentialDistanceFactor;
  popups.open({ width: FISH.width, height: FISH.height, title: t("event.shuteFishing.title"), dim: true,
    closeOnBackdrop: true, canClose: () => !busy,
    onClose: () => { alive = false; onChanged(); },
  }, (body) => {
    const shape = popupArtShape(FISH.width, FISH.height);
    const mask = popupBodyShapeMask(scene, body, shape);
    paintBackdrop(scene, body, mask, motion());

    const coinText = addCurrencyChip(scene, 0, FISH.coinY, COIN_ICON, { parent: body, width: 280, height: 66, rollKey: "shuteFishing:coins" });
    const resetText = scene.add.text(0, FISH.resetY, "", textStyle({ role: "body", size: 21, color: INK_SOFT, align: "center", wrap: 840 })).setOrigin(0.5).setStroke(OUTLINE, 4);
    body.add(resetText);

    // 첫 쪽 — 위에 안내, 가운데 슈테, 아래에 보스곡 안내·「게임 방법!」과 난이도 패드 넷.
    const introPage = scene.add.container(0, 0);
    body.add(introPage);
    const introStage = scene.add.container(0, 0);
    introPage.add(introStage);
    const introShute = new ShuteBeat(scene, introStage, FISH.sd);
    introShute.setTempo(FISHING_DIFFICULTIES[0].sweepMs);
    introPage.add(scene.add.text(0, FISH.intro.textY, t("shuteFishing.intro"), textStyle({ role: "emphasis", size: 27, color: INK, wrap: 780, align: "center" })).setOrigin(0.5).setStroke(OUTLINE, 6));
    introPage.add(scene.add.text(0, FISH.intro.noteY, t("shuteFishing.jackpotNote"), textStyle({ role: "emphasis", size: 24, color: ACCENT, wrap: 760, align: "center" })).setOrigin(0.5).setStroke(OUTLINE, 6));
    introPage.add(addHowToButton(scene, 0, FISH.intro.howToY, () => openShuteFishingHowTo(scene, popups)));

    const grid = FISH.intro.grid;
    const buttons = FISHING_DIFFICULTIES.map((entry, index) => {
      const x = (index % 2 === 0 ? -1 : 1) * grid.x, y = grid.rows[Math.floor(index / 2)];
      const button = new FishingPickButton(scene, x, y, { width: grid.width, height: grid.height, level: index + 1, tone: DIFFICULTY_TONE[entry.id], onClick: () => void enterRun(entry.id) });
      introPage.add(button);
      return { entry, button };
    });

    // 판 쪽.
    const playPage = scene.add.container(0, 0);
    body.add(playPage);
    const lives = scene.add.graphics();
    const collectedLabel = scene.add.text(0, FISH.play.collectedLabelY, t("shuteFishing.collected"), textStyle({ role: "emphasis", size: 24, color: INK_SOFT })).setOrigin(0.5).setStroke(OUTLINE, 5);
    const collectedRow = scene.add.container(0, FISH.play.collectedY);
    const setlistRow = scene.add.container(0, FISH.play.setlistY);
    const playStage = scene.add.container(0, 0);
    const playShute = new ShuteBeat(scene, playStage, FISH.play.sd);
    const fishHolder = scene.add.container(FISH.play.fishX, FISH.play.fishY);
    const notes = scene.add.graphics();
    const catchText = scene.add.text(FISH.play.fishX, FISH.play.notesY + 48, "", textStyle({ role: "emphasis", size: 24, color: INK })).setOrigin(0.5).setStroke(OUTLINE, 5);
    const judgeText = scene.add.text(0, FISH.play.judgeY, "", textStyle({ role: "display", size: 64, color: INK })).setOrigin(0.5).setStroke("#22222a", 10);
    const comboText = scene.add.text(0, FISH.play.comboY, "", textStyle({ role: "display", size: 32, color: "#22222a" })).setOrigin(0.5).setStroke(OUTLINE, 6).setAlpha(0);
    const gauge = scene.add.graphics().setPosition(0, FISH.play.gaugeY);
    const fx = scene.add.container(0, 0);
    const tap = scene.add.container(0, FISH.play.tapY);
    playPage.add([lives, collectedLabel, collectedRow, setlistRow, playStage, fishHolder, notes, catchText, gauge, judgeText, comboText, tap, fx]);
    const note = scene.add.text(0, FISH.height / 2 - 70, "", textStyle({ role: "body", size: 21, color: INK_SOFT, wrap: 760, align: "center" })).setOrigin(0.5).setStroke(OUTLINE, 4);
    body.add(note);

    let flowTapBulbs = (): void => undefined;
    // 「탭!」 단추 — 노란 패드 테두리를 따라 전광 전구가 돌고, 누를 때마다 켜진 전구가 한 칸씩 흐른다. 누르는 순간(pointerdown)에 판정한다. 확정 입력은 보통 pointerup이지만
    // 리듬 판정은 손가락이 닿는 순간이 박자라서, 떼는 순간을 쓰면 누르고 떼는 사이(100ms 남짓)만큼 늘 늦게 판정된다.
    {
      const { width, height } = FISH.play.tap;
      const left = -width / 2, top = -height / 2, cut = 34, depth = 14;
      const g = scene.add.graphics();
      g.fillStyle(0x000000, 0.3).fillPoints(chamferPoints(left + 6, top + depth + 10, width, height, cut), true);
      g.fillStyle(SHUTE_TONE.ink, 1).fillPoints(chamferPoints(left - 6, top - 6, width + 12, height + depth + 12, cut + 4), true);
      g.fillStyle(SHUTE_TONE.yellowDeep, 1).fillPoints(chamferPoints(left, top + depth, width, height, cut), true);
      const face = scene.add.container(0, 0);
      const plate = scene.add.graphics();
      plate.fillStyle(SHUTE_TONE.yellow, 1).fillPoints(chamferPoints(left, top, width, height, cut), true);
      plate.fillStyle(0xffffff, 0.3).fillPoints(chamferPoints(left + 26, top + 24, width - 52, height * 0.22, 14), true);
      const bulbs = scene.add.graphics();
      const bulbPath = chamferPoints(left + 14, top + 14, width - 28, height - 28, cut - 10);
      let lit = 0;
      const paintBulbs = (): void => { bulbs.clear(); drawBulbOutline(bulbs, bulbPath, { spacing: 44, size: 7, colors: [SHUTE_TONE.ivory, SHUTE_TONE.cyan], lit }); };
      paintBulbs();
      const label = scene.add.text(0, 2, t("shuteFishing.tap"), textStyle({ role: "display", size: 66, color: INK })).setOrigin(0.5).setStroke(OUTLINE, 6);
      shrinkTextToWidth(label, width - 120);
      face.add([plate, bulbs, label]);
      flowTapBulbs = () => { lit = lit >= 0.5 ? 0 : 1; paintBulbs(); };
      tap.add([g, face]);
      const hit = addClippedHit(scene, tap, 0, 7, width + 120, height + 160, anywhere(scene), { useHandCursor: true });
      hit.on("pointerdown", () => { face.setY(10); flowTapBulbs(); void press(); });
      hit.on("pointerup", () => face.setY(0));
      hit.on("pointerout", () => face.setY(0));
    }

    const publish = (): void => managerEvents.publish("wallet", { wallet: session.wallet });
    /** 지금 도는 캐치 — 바늘이 출발한 시각(`performance.now`)과 그 캐치의 게이지. */
    let current: { spec: FishingCatch; tier: FishTier; startedAt: number } | undefined;
    let frozenAt: number | undefined;
    let flash = 0;
    let combo = 0;
    /** 이번 판에 낚은 물고기 — 끝날 때 카드로 늘어선다. */
    let landedFish: string[] = [];
    const gaugeTrack = shuteGaugeTrack(FISH.play.gaugeWidth, FISH.play.gaugeHeight);

    const paintLives = (misses: number): void => {
      lives.clear();
      for (let index = 0; index < SHUTE_FISHING.maxMisses; index += 1) {
        const x = (index - (SHUTE_FISHING.maxMisses - 1) / 2) * 76, y = FISH.play.livesY;
        drawStud(lives, x, y, 46, index >= misses);
      }
    };
    const paintCollected = (collected: Partial<Record<ChestCardCurrency, number>>, pop?: ChestCardCurrency): void => {
      collectedRow.removeAll(true);
      const entries = Object.entries(collected).filter(([, amount]) => (amount ?? 0) > 0) as [ChestCardCurrency, number][];
      if (!entries.length) { collectedRow.add(scene.add.text(0, 0, "—", textStyle({ role: "display", size: 34, color: INK_SOFT })).setOrigin(0.5)); return; }
      entries.forEach(([currency, amount], index) => {
        const frame = addFramedIcon(scene, collectedRow, (index - (entries.length - 1) / 2) * 104, 0, 84, CURRENCY_ICON_BY_WALLET[currency], { amount: formatCurrency(amount), amountRatio: 0.3 });
        if (currency === pop && motion() > 0) scene.tweens.add({ targets: frame, scale: { from: 1.3, to: 1 }, duration: 320, ease: "Back.Out" });
      });
    };
    const slotX = (fish: readonly string[], order: number): number => {
      const size = FISH.play.setlistSize, boss = FISH.play.bossSize, gap = 18;
      const total = (fish.length - 1) * (size + gap) + (boss - size);
      return -total / 2 + order * (size + gap) + (order === fish.length - 1 ? (boss - size) / 2 : 0);
    };
    /**
     * 셋리스트 — 이번 판에 물릴 물고기가 차례로 선다. 마지막 칸이 보스곡이라 한 뼘 크고 「BOSS」가 붙는다. 낚은 것은
     * 노란 체크, 지금 것은 크게, 남은 것은 흐리게. `reveal`이면 칸마다 그림이 팅팅팅 돌다 차례로 멈춰 정해진다.
     */
    const paintSetlist = (fish: readonly string[], index: number, reveal = false): Promise<void> => {
      setlistRow.removeAll(true);
      const spinning: { holder: Phaser.GameObjects.Container; real: Phaser.GameObjects.Container; image: Phaser.GameObjects.Image; stopAt: number; order: number }[] = [];
      fish.forEach((id, order) => {
        const treasure = fishTreasure(id);
        if (!treasure) return;
        const boss = order === fish.length - 1;
        const size = boss ? FISH.play.bossSize : FISH.play.setlistSize;
        const holder = scene.add.container(slotX(fish, order), boss ? 6 : 0);
        const real = scene.add.container(0, 0);
        holder.add(real);
        const tag = scene.add.graphics();
        tag.fillStyle(SHUTE_TONE.ink, 1).fillPoints(diamond(0, -size * 0.72, 9, 11), true);
        tag.fillStyle(TIER_TONE[treasure.tier], 1).fillPoints(diamond(0, -size * 0.72, 6, 8), true);
        real.add(tag);
        addFramedIcon(scene, real, 0, 0, size, CURRENCY_ICON_BY_WALLET[treasure.currency], { amount: formatCurrency(treasure.amount), amountRatio: 0.3 });
        if (boss) {
          const plate = scene.add.graphics();
          const bw = 92, bh = 30, by = size / 2 + 22;
          plate.fillStyle(SHUTE_TONE.ink, 1).fillPoints(chamferPoints(-bw / 2, by - bh / 2, bw, bh, 8), true);
          plate.lineStyle(2, SHUTE_TONE.yellow, 1).strokePoints(chamferPoints(-bw / 2 + 3, by - bh / 2 + 3, bw - 6, bh - 6, 6), true);
          holder.add(plate);
          holder.add(scene.add.text(0, by + 1, t("shuteFishing.boss"), textStyle({ role: "display", size: 18, color: "#ffc93c" })).setOrigin(0.5));
        }
        if (order < index) {
          const check = scene.add.graphics();
          check.fillStyle(0x000000, 0.5).fillRect(-size / 2, -size / 2, size, size);
          check.lineStyle(8, SHUTE_TONE.yellow, 1).beginPath().moveTo(-size * 0.22, 0).lineTo(-size * 0.04, size * 0.18).lineTo(size * 0.26, -size * 0.2).strokePath();
          real.add(check);
        } else if (order > index) real.setAlpha(0.6);
        else holder.setScale(1.12);
        setlistRow.add(holder);
        if (reveal) {
          real.setVisible(false);
          const spinner = scene.add.graphics();
          spinner.fillStyle(SHUTE_TONE.ink, 1).fillPoints(chamferPoints(-size / 2, -size / 2, size, size, size * 0.18), true);
          spinner.lineStyle(3, SHUTE_TONE.cyan, 1).strokePoints(chamferPoints(-size / 2 + 5, -size / 2 + 5, size - 10, size - 10, size * 0.14), true);
          const image = scene.add.image(0, 0, SPIN_ICONS[order % SPIN_ICONS.length]).setDisplaySize(size * 0.62, size * 0.62);
          const spin = scene.add.container(0, 0, [spinner, image]);
          holder.add(spin);
          spinning.push({ holder, real, image, stopAt: 380 + order * 150 + (boss ? 200 : 0), order });
          real.setData("spin", spin);
        }
      });
      if (!reveal || !spinning.length || motion() <= 0) {
        for (const slot of spinning) { (slot.real.getData("spin") as Phaser.GameObjects.Container).destroy(); slot.real.setVisible(true); }
        return Promise.resolve();
      }
      let frame = 0;
      const ticker = scene.time.addEvent({ delay: 55, loop: true, callback: () => {
        frame += 1;
        for (const slot of spinning) if (slot.image.active) slot.image.setTexture(SPIN_ICONS[(frame + slot.order * 3) % SPIN_ICONS.length]);
      } });
      setlistRow.once(Phaser.GameObjects.Events.DESTROY, () => ticker.remove());
      return new Promise<void>((resolve) => {
        let left = spinning.length;
        for (const slot of spinning) {
          scene.time.delayedCall(slot.stopAt, () => {
            left -= 1;
            if (slot.holder.active) {
              (slot.real.getData("spin") as Phaser.GameObjects.Container).destroy();
              slot.real.setVisible(true);
              const boss = slot.order === fish.length - 1;
              const scale = slot.holder.scale;
              scene.tweens.add({ targets: slot.holder, scale: { from: scale * (boss ? 1.4 : 1.25), to: scale }, duration: 220, ease: "Back.Out" });
              burstSparkles(scene, setlistRow, slot.holder.x, slot.holder.y, { count: boss ? 12 : 5, radius: boss ? 90 : 50, size: boss ? 13 : 9, colors: [0xffffff, SHUTE_TONE.yellow, SHUTE_TONE.cyan], seed: slot.order * 7 + 3, rise: 12 });
              audioManager?.playUi(boss ? "ui.reward" : "roulette.tick");
            }
            if (left === 0) { ticker.remove(); scene.time.delayedCall(220, () => resolve()); }
          });
        }
      });
    };
    /** 지금 물고기 — 큰 보물 액자와 그 아래 캐치 스터드(채운 만큼 노랗다). */
    const paintFish = (id: string | undefined, caught: number): void => {
      fishHolder.removeAll(true);
      notes.clear();
      catchText.setText("");
      const treasure = id ? fishTreasure(id) : undefined;
      if (!treasure) return;
      const size = FISH.play.fishSize;
      const halo = scene.add.graphics();
      halo.fillStyle(TIER_TONE[treasure.tier], 0.32).fillPoints(diamond(0, 0, size * 0.78, size * 0.7), true);
      drawSignalRings(halo, 0, 0, size * 0.62, 0.45);
      fishHolder.add(halo);
      addFramedIcon(scene, fishHolder, 0, 0, size, CURRENCY_ICON_BY_WALLET[treasure.currency], { amount: formatCurrency(treasure.amount), amountRatio: 0.3 });
      if (treasure.tier === "jackpot") {
        const sparkle = scene.add.graphics();
        for (const [x, y, s] of [[-size * 0.6, -size * 0.4, 16], [size * 0.62, -size * 0.1, 13], [size * 0.5, size * 0.5, 18]] as const) drawSparkle(sparkle, x, y, s, 0xffe38a, 1);
        fishHolder.add(sparkle);
      }
      const need = FISH_TIER_FEEL[treasure.tier].catches;
      for (let index = 0; index < need; index += 1) drawStud(notes, FISH.play.fishX + (index - (need - 1) / 2) * 40, FISH.play.notesY, 26, index < caught);
      catchText.setText(t("shuteFishing.catch", { count: caught, need }));
    };

    /** 다음 캐치를 건다 — 판의 지금 물고기·캐치 수에서 게이지를 꺼내 바늘을 0에서 출발시킨다. */
    const armCatch = (): void => {
      const run = status.run;
      const spec = run?.catches[run.index]?.[run.caught];
      const treasure = run ? fishTreasure(run.fish[run.index]) : undefined;
      if (!run || !spec || !treasure) { current = undefined; return; }
      current = { spec, tier: treasure.tier, startedAt: performance.now() };
      frozenAt = undefined;
      playShute.setTempo(spec.sweepMs);
    };
    const tick = (): void => {
      if (!alive || !playPage.visible) return;
      flash = Math.max(0, flash - 0.06);
      const now = frozenAt ?? performance.now();
      const position = current ? gaugePosition(current.spec.sweepMs, now - current.startedAt) : 0;
      paintShuteGauge(gauge, { width: FISH.play.gaugeWidth, height: FISH.play.gaugeHeight, zone: current?.spec, position, flash });
    };
    scene.events.on(Phaser.Scenes.Events.UPDATE, tick);
    body.once(Phaser.GameObjects.Events.DESTROY, () => scene.events.off(Phaser.Scenes.Events.UPDATE, tick));

    const showJudge = (judgment: FishingJudgment): void => {
      judgeText.setText(t(JUDGE_KEY[judgment])).setColor(JUDGE_COLOR[judgment]).setAlpha(1);
      scene.tweens.killTweensOf(judgeText);
      if (motion() > 0) { judgeText.setScale(1.35); scene.tweens.add({ targets: judgeText, scale: 1, duration: 200, ease: "Back.Out" }); }
      scene.tweens.add({ targets: judgeText, alpha: 0, delay: 520, duration: 260 });
    };
    /** 콤보 — 미스 없이 이어 캐치한 수. 둘부터 판정 아래에 서고, 미스하면 사라진다. */
    const showCombo = (): void => {
      scene.tweens.killTweensOf(comboText);
      if (combo < 2) { comboText.setAlpha(0); return; }
      comboText.setText(t("shuteFishing.combo", { count: combo })).setColor(combo >= 10 ? "#ff5a6e" : combo >= 5 ? "#d99a10" : "#22222a").setAlpha(1);
      if (motion() > 0) { comboText.setScale(1.3); scene.tweens.add({ targets: comboText, scale: 1, duration: 180, ease: "Back.Out" }); }
    };
    /** PERFECT — 칸 한가운데에서 시안 마름모 고리가 퍼진다. */
    const perfectRing = (spec: FishingCatch): void => {
      if (motion() <= 0) return;
      const x = gaugeTrack.left + spec.center * gaugeTrack.width;
      const ring = scene.add.graphics().setPosition(x, FISH.play.gaugeY);
      ring.lineStyle(6, SHUTE_TONE.cyan, 1).strokePoints(diamond(0, 0, 70, 54), true);
      ring.lineStyle(3, 0xffffff, 1).strokePoints(diamond(0, 0, 56, 42), true);
      fx.add(ring);
      scene.tweens.add({ targets: ring, scale: { from: 0.6, to: 1.9 }, alpha: { from: 1, to: 0 }, duration: 320, ease: "Quad.Out", onComplete: () => ring.destroy() });
      burstSparkles(scene, fx, x, FISH.play.gaugeY - 30, { count: 6, radius: 70, size: 10, colors: [0xffffff, SHUTE_TONE.cyan, SHUTE_TONE.yellow], seed: Math.round(spec.center * 97), rise: 20 });
    };
    /** 낚은 보물이 카드로 뒤집혀 서고, 위의 「낚은 보물」 줄로 날아 들어간다. */
    const flyCard = async (id: string): Promise<void> => {
      if (motion() <= 0) return;
      const card = addTreasureCard(scene, fx, FISH.play.fishX, FISH.play.fishY, FISH.play.card, id);
      card.setScale(0, 1);
      await new Promise<void>((resolve) => scene.tweens.add({ targets: card, scaleX: 1, duration: 200, ease: "Back.Out", onComplete: () => resolve() }));
      await waitFx(scene, 180);
      if (!card.active) return;
      await new Promise<void>((resolve) => scene.tweens.add({ targets: card, x: 0, y: FISH.play.collectedY, scale: 0.4, alpha: 0.2, duration: 280, ease: "Quad.In", onComplete: () => resolve() }));
      card.destroy();
    };

    const refresh = (): void => {
      coinText.setText(status.coins.toLocaleString());
      resetText.setText(t("shuteFishing.reset", { date: new Date(status.resetsAt).toLocaleString(undefined, { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) }));
      const running = status.run !== null;
      introPage.setVisible(!running); playPage.setVisible(running);
      if (running) return;
      for (const { entry, button } of buttons) {
        button.setContent(t(DIFFICULTY_KEY[entry.id]), t(HINT_KEY[entry.id], { fish: entry.fish }), entry.entryCost);
        button.setEnabled(!busy && status.coins >= entry.entryCost);
      }
    };
    const paintRun = (reveal = false): Promise<void> => {
      const run = status.run;
      if (!run) return Promise.resolve();
      landedFish = run.fish.slice(0, run.index);
      paintLives(run.misses); paintCollected(run.collected);
      paintFish(run.fish[run.index], run.caught);
      return paintSetlist(run.fish, run.index, reveal);
    };

    const fail = (error: unknown): undefined => {
      logError("shuteFishing.request", "슈테의 리듬 낚시 요청 실패", error);
      if (alive) note.setText(t("shuteFishing.error"));
      return undefined;
    };

    async function enterRun(id: FishingDifficultyId): Promise<void> {
      if (busy || !fishingDifficulty(id)) return;
      busy = true; refresh();
      const key = `enter-${id}`;
      if (!pending.has(key)) pending.set(key, crypto.randomUUID());
      const result = await gameApi.enterShuteFishing({ requestId: pending.get(key)!, difficulty: id }).catch(fail);
      if (result) pending.delete(key);
      if (!result?.status.run) { busy = false; if (alive) refresh(); return; }
      status = result.status;
      if (!alive) { busy = false; return; }
      note.setText("");
      combo = 0; showCombo();
      refresh();
      // 셋리스트가 팅팅팅 정해지는 동안은 누를 것이 없다 — 다 정해진 뒤에 첫 캐치를 건다.
      await paintRun(true);
      busy = false;
      if (!alive) return;
      showJudge("good"); judgeText.setText(t("shuteFishing.ready")).setColor(JUDGE_COLOR.good);
      await waitFx(scene, 600);
      if (alive) armCatch();
    }

    /** 다 끝난 뒤 — 이번 판에 낚은 보물이 카드로 늘어서고, 받은 몫을 알린 뒤 첫 쪽으로 돌아간다. */
    async function finish(total: Partial<Record<ChestCardCurrency, number>>, cleared: boolean): Promise<void> {
      current = undefined;
      judgeText.setText(t(cleared ? "shuteFishing.cleared" : "shuteFishing.out")).setColor(cleared ? JUDGE_COLOR.perfect : "#ff5a6e").setAlpha(1).setScale(1);
      scene.tweens.killTweensOf(judgeText);
      if (cleared) { playShute.cheer(3); audioManager?.playUi("success.fanfare"); } else playShute.flinch();
      const lineup = scene.add.container(0, 0);
      fx.add(lineup);
      if (landedFish.length && motion() > 0) {
        const { y, width, height, gap } = FISH.play.lineup;
        const band = scene.add.graphics();
        band.fillStyle(SHUTE_TONE.ink, 0.7).fillPoints(chamferPoints(-FISH.width / 2 + 30, y - height / 2 - 26, FISH.width - 60, height + 52, 26), true);
        drawBulbOutline(band, chamferPoints(-FISH.width / 2 + 42, y - height / 2 - 14, FISH.width - 84, height + 28, 18), { spacing: 52, size: 6 });
        lineup.add(band);
        band.setAlpha(0);
        scene.tweens.add({ targets: band, alpha: 1, duration: 140 });
        const span = landedFish.length * width + (landedFish.length - 1) * gap;
        landedFish.forEach((id, order) => {
          const card = addTreasureCard(scene, lineup, -span / 2 + width / 2 + order * (width + gap), y, { width, height }, id);
          card.setScale(0);
          scene.time.delayedCall(order * 80, () => {
            if (!card.active) return;
            scene.tweens.add({ targets: card, scale: 1, duration: 220, ease: "Back.Out" });
            audioManager?.playUi("roulette.tick");
          });
        });
        await waitFx(scene, landedFish.length * 80 + 760);
      } else await waitFx(scene, 1000);
      if (!alive) return;
      const items = currencyRecordToRewardItems(total);
      if (items.length) await new Promise<void>((resolve) => openRewardPopup(scene, popups, { title: t("shuteFishing.reward"), titleSize: 36, dimAlpha: 0.66, items, onConfirm: resolve }));
      if (lineup.active) lineup.destroy();
      comboText.setAlpha(0);
    }

    async function press(): Promise<void> {
      if (busy || !current || frozenAt !== undefined) return;
      const pressedAt = performance.now();
      const elapsedMs = Math.round(pressedAt - current.startedAt);
      frozenAt = pressedAt;
      busy = true;
      const spec = current.spec;
      // 화면이 먼저 같은 규칙으로 판정해 보여 준다 — 답을 기다리는 동안 손이 비어 보이지 않게. 확정은 서버의 답이다.
      const guess = judgeCatch(spec, elapsedMs).judgment;
      showJudge(guess);
      if (guess !== "miss") { flash = 1; audioManager?.playUi("ui.tap"); if (guess === "perfect") perfectRing(spec); } else audioManager?.playUi("ui.deny");
      const result: ShuteFishingResponse | undefined = await gameApi.reelShuteFishing({ requestId: crypto.randomUUID(), elapsedMs }).catch(fail);
      if (!result?.reel) { busy = false; if (alive && current) { current.startedAt = performance.now(); frozenAt = undefined; } return; }
      const reel = result.reel;
      status = result.status;
      if (!alive) { busy = false; return; }
      if (reel.judgment !== guess) showJudge(reel.judgment);
      combo = reel.judgment === "miss" ? 0 : combo + 1;
      showCombo();
      if (reel.judgment === "miss") {
        playShute.flinch();
        paintLives(reel.misses);
        if (status.run) await waitFx(scene, 420);
      } else if (reel.landed) {
        publish();
        landedFish.push(reel.landed);
        const treasure = fishTreasure(reel.landed);
        burstSparkles(scene, playPage, FISH.play.fishX, FISH.play.fishY, { count: 10, radius: 110, size: 15, colors: [0xffffff, SHUTE_TONE.yellow, SHUTE_TONE.cyan], seed: reel.fishIndex + 7, rise: 24 });
        playShute.cheer(treasure?.tier === "jackpot" ? 3 : 1);
        audioManager?.playUi(treasure?.tier === "jackpot" ? "roulette.win" : "ui.reward");
        paintFish(reel.landed, reel.caught);
        judgeText.setText(t("shuteFishing.landed")).setColor(JUDGE_COLOR.perfect).setAlpha(1);
        await flyCard(reel.landed);
        if (alive) paintCollected(reel.total ?? status.run?.collected ?? {}, reel.granted?.currency as ChestCardCurrency | undefined);
        await waitFx(scene, motion() > 0 ? 120 : 650);
      } else {
        const run = status.run;
        if (run) paintFish(run.fish[run.index], run.caught);
        await waitFx(scene, 260);
      }
      busy = false;
      if (reel.finished) { await finish(reel.total ?? {}, reel.cleared); if (alive) refresh(); return; }
      if (!alive) return;
      void paintRun();
      armCatch();
    }

    refresh();
    // 닫았다 다시 연 판 — 낚은 물고기·캐치 수·미스가 그대로 이어지고, 바늘은 지금 캐치의 처음부터 다시 출발한다.
    if (status.run) { void paintRun(); armCatch(); }
  });
}

/** 「게임 방법!」 — 난이도 패드 위에 앉는 작은 아이보리 단추. */
function addHowToButton(scene: Phaser.Scene, x: number, y: number, onClick: () => void): Phaser.GameObjects.Container {
  const root = scene.add.container(x, y);
  const label = scene.add.text(0, 0, t("shuteFishing.howTo.button"), textStyle({ role: "emphasis", size: 26, color: INK })).setOrigin(0, 0.5);
  shrinkTextToWidth(label, 300);
  const height = 56, badge = 20, pad = 18;
  const width = pad + badge * 2 + 10 + label.displayWidth + pad;
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.22).fillPoints(chamferPoints(-width / 2 + 3, -height / 2 + 6, width, height, 14), true);
  g.fillStyle(SHUTE_TONE.ink, 1).fillPoints(chamferPoints(-width / 2 - 3, -height / 2 - 3, width + 6, height + 6, 16), true);
  g.fillStyle(SHUTE_TONE.ivory, 1).fillPoints(chamferPoints(-width / 2, -height / 2, width, height, 14), true);
  const bx = -width / 2 + pad + badge;
  g.fillStyle(SHUTE_TONE.ink, 1).fillPoints(diamond(bx, 0, badge + 3, badge * 1.2 + 3), true);
  g.fillStyle(SHUTE_TONE.yellow, 1).fillPoints(diamond(bx, 0, badge, badge * 1.2), true);
  const mark = scene.add.text(bx, 1, "?", textStyle({ role: "display", size: 28, color: INK })).setOrigin(0.5);
  label.setX(bx + badge + 10);
  const sparkle = scene.add.graphics();
  drawSparkle(sparkle, width / 2 - 2, -height / 2 + 4, 13, SHUTE_TONE.cyan);
  root.add([g, mark, label, sparkle]);
  const hit = addClippedHit(scene, root, 0, 0, width + 20, height + 20, anywhere(scene), { useHandCursor: true });
  hit.on("pointerdown", () => pressIn(root));
  hit.on("pointerout", () => pressOut(root, "normal", { pop: false }));
  hit.on("pointerup", () => { pressOut(root); onClick(); });
  if (chestFxMotion().loops) scene.tweens.add({ targets: sparkle, alpha: { from: 1, to: 0.25 }, duration: 700, yoyo: true, repeat: -1, ease: "Sine.InOut" });
  return root;
}

/** 게임 방법 쪽지 — 슈테가 말풍선으로 직접 들려준다. 판 높이는 말풍선 글을 먼저 재서 거꾸로 구한다. */
export function openShuteFishingHowTo(scene: Phaser.Scene, popups: PopupLayer): void {
  const { width, bubbleWidth, wrap, lineGap, sd } = FISH.howTo;
  const keys: TextKey[] = ["shuteFishing.howTo.1", "shuteFishing.howTo.2", "shuteFishing.howTo.3", "shuteFishing.howTo.4"];
  const lines = keys.map((key) => scene.add.text(0, 0, t(key), textStyle({ role: "body", size: 27, color: INK, wrap, lineSpacing: 6 })).setOrigin(0, 0));
  const rowHeight = (line: Phaser.GameObjects.Text): number => Math.max(line.height, 56);
  const textHeight = lines.reduce((sum, line) => sum + rowHeight(line), 0) + lineGap * (lines.length - 1);
  const bubblePad = 40, tail = 46, top = 70;
  const bubbleHeight = textHeight + bubblePad * 2;
  const height = top + bubbleHeight + tail + sd.height + 30;
  popups.open({ width, height, title: t("shuteFishing.howTo.title"), dim: true, dimAlpha: 0.35, closeOnBackdrop: true, closeOnBody: true }, (body) => {
    addEventPopupBackdrop(scene, body, BACKGROUND.eventShutePopup, width, height);
    const upper = -height / 2;
    const bx = -bubbleWidth / 2, by = upper + top;
    const tailX = sd.x + 70, tailBase = by + bubbleHeight;
    const bubble = scene.add.graphics();
    bubble.fillStyle(0x000000, 0.22).fillRoundedRect(bx + 6, by + 10, bubbleWidth, bubbleHeight, 34);
    bubble.fillStyle(SHUTE_TONE.ink, 1).fillRoundedRect(bx - 4, by - 4, bubbleWidth + 8, bubbleHeight + 8, 38);
    bubble.fillTriangle(tailX - 34, tailBase - 6, tailX + 30, tailBase - 6, tailX - 18, tailBase + tail + 4);
    bubble.fillStyle(SHUTE_TONE.ivory, 1).fillRoundedRect(bx, by, bubbleWidth, bubbleHeight, 34);
    bubble.fillTriangle(tailX - 28, tailBase - 8, tailX + 24, tailBase - 8, tailX - 16, tailBase + tail - 4);
    const marks = scene.add.graphics();
    body.add([bubble, marks]);
    let y = by + bubblePad;
    const textX = bx + 84;
    lines.forEach((line, index) => {
      line.setPosition(textX, y);
      body.add(line);
      const cy = y + 18;
      marks.fillStyle(SHUTE_TONE.ink, 1).fillPoints(diamond(textX - 38, cy, 22, 26), true);
      marks.fillStyle([SHUTE_TONE.cyan, SHUTE_TONE.yellow, 0xff9a3c, 0xff5a6e][index], 1).fillPoints(diamond(textX - 38, cy, 18, 22), true);
      body.add(scene.add.text(textX - 38, cy + 1, String(index + 1), textStyle({ role: "display", size: 22, color: INK })).setOrigin(0.5));
      y += rowHeight(line) + lineGap;
    });
    drawSparkle(marks, bx + bubbleWidth - 18, by + 8, 20, SHUTE_TONE.cyan);
    drawSparkle(marks, bx + 14, by + bubbleHeight - 10, 14, SHUTE_TONE.yellow);
    const stage = scene.add.container(0, 0);
    body.add(stage);
    void new ShuteBeat(scene, stage, { x: sd.x + 200, groundY: height / 2 - 30, height: sd.height });
  });
}
