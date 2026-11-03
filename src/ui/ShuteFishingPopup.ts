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
import { drawSparkle } from "./rouletteWheel";
import { BACKGROUND } from "./backgroundAssets";
import { addEventPopupBackdrop } from "./eventBackdrop";
import { addCurrencyChip } from "./CurrencyChip";
import { pressIn, pressOut } from "./pressFeedback";
import { shrinkTextToWidth } from "./textFit";
import { COLOR, textStyle } from "./theme";

/**
 * 슈테의 리듬 낚시 창의 자리. 두 쪽이다.
 * - **첫 쪽**: 판이 없을 때. 코인 → 안내 → 박자에 맞춰 까딱이는 슈테 → 난이도 설명 → 「게임 방법!」 → 난이도 단추(좌우로 넘긴다).
 * - **판 쪽**: 위에 남은 기회와 **낚은 보물** → 이번 판의 셋리스트(물릴 물고기 차례) → 지금 물고기와 캐치 진행 →
 *   판정 글자 → 게이지(바늘이 좌우로 오간다) → 크게 누르는 「탭!」 단추.
 * 게이지의 구간·속도는 서버가 판을 열 때 정해 그대로 보낸다 — 화면은 같은 삼각파(`gaugePosition`)로 바늘을 그릴 뿐이고,
 * 누른 시간을 보내면 서버가 판정한다.
 */
const FISH = {
  width: 940,
  height: 1540,
  coinY: -684,
  resetY: -618,
  sd: { x: 0, groundY: 150, height: 420 },
  intro: { textY: -500, detailY: 220, noteY: 300, howToY: 384, pickerY: 520, pipsY: 606, arrowX: 366 },
  play: {
    livesY: -556, collectedLabelY: -494, collectedY: -428, setlistY: -318, setlistSize: 74,
    sd: { x: -250, groundY: 110, height: 300 }, fishX: 170, fishY: -110, fishSize: 168, notesY: 22,
    judgeY: 150, gaugeY: 290, gaugeWidth: 800, gaugeHeight: 84, tapY: 500, tap: { width: 640, height: 150 },
  },
  button: { width: 620, height: 112 },
  noteY: 738,
  howTo: { width: 820, bubbleWidth: 720, wrap: 600, lineGap: 26, sd: { x: -250, height: 300 } },
} as const;

/** 리듬 낚시 전용 이벤트 코인 그림(`currencyIcons`). 코인은 지갑이 아니라 이번 주에 쓴 스테미나에서 나온다. */
const COIN_ICON = "currency-shute-rhythm-coin";
/** 창 안에 서는 SD — 로비 이벤트 카드와 같은 개체다(`lobbyEvents`의 `shute-fishing`). */
const FISH_SD = "shute";

/** 슈테의 결 — 노란 후드, 오락실 네온(하늘·분홍), 짙은 남색 화면. 글은 남색, 강조는 분홍이다. */
const INK = "#1b1f3b";
const INK_SOFT = "#5b6488";
const ACCENT = "#e83e8c";
const OUTLINE = "#fdf8ec";
const NEON = { ink: 0x1b1f3b, screen: 0x111632, screenHi: 0x1d2550, yellow: 0xffd23f, yellowDeep: 0xc79a12, cyan: 0x3fe0ff, pink: 0xff4fa8, cream: 0xfdf8ec, shade: 0x1b1f3b } as const;

/** 난이도의 색 — 쉬움 하늘, 보통 노랑, 어려움 분홍, 매우 어려움 보라. 넘김 점과 반짝이가 이 색이다. */
const DIFFICULTY_TONE: Record<FishingDifficultyId, number> = { easy: 0x3fe0ff, normal: 0xffd23f, hard: 0xff4fa8, extreme: 0xa070ff };
/** 물고기 등급의 색 — 게이지의 빛나는 구간과 셋리스트 액자 테. 대박만 금빛이다. */
const TIER_TONE: Record<FishTier, number> = { common: 0x7fe0b8, fine: 0x6fb8ff, rare: 0xc59bff, jackpot: 0xffd23f };

const DIFFICULTY_KEY: Record<FishingDifficultyId, TextKey> = {
  easy: "shuteFishing.difficulty.easy", normal: "shuteFishing.difficulty.normal", hard: "shuteFishing.difficulty.hard", extreme: "shuteFishing.difficulty.extreme",
};
const HINT_KEY: Record<FishingDifficultyId, TextKey> = {
  easy: "shuteFishing.hint.easy", normal: "shuteFishing.hint.normal", hard: "shuteFishing.hint.hard", extreme: "shuteFishing.hint.extreme",
};
const JUDGE_KEY: Record<FishingJudgment, TextKey> = { perfect: "shuteFishing.judge.perfect", good: "shuteFishing.judge.good", miss: "shuteFishing.judge.miss" };
const JUDGE_COLOR: Record<FishingJudgment, string> = { perfect: "#ffd23f", good: "#3fe0ff", miss: "#9aa0b8" };

const diamond = (cx: number, cy: number, rx: number, ry: number): Phaser.Geom.Point[] =>
  [new Phaser.Geom.Point(cx, cy - ry), new Phaser.Geom.Point(cx + rx, cy), new Phaser.Geom.Point(cx, cy + ry), new Phaser.Geom.Point(cx - rx, cy)];
const anywhere = (scene: Phaser.Scene) => () => ({ left: 0, right: scene.scale.width, top: 0, bottom: scene.scale.height });

/** 오락실 바탕 — 가장자리에 박자처럼 떠오르는 음표 마름모. */
function paintBackdrop(scene: Phaser.Scene, body: Phaser.GameObjects.Container, mask: Phaser.Display.Masks.GeometryMask, motion: number): void {
  addEventPopupBackdrop(scene, body, BACKGROUND.eventShutePopup, FISH.width, FISH.height);
  const notes: readonly [number, number, number][] = [[-400, -360, NEON.cyan], [400, -120, NEON.pink], [-400, 40, NEON.yellow]];
  notes.forEach(([x, y, color], index) => {
    const g = scene.add.graphics().setPosition(x, y).setAlpha(0.5).setMask(mask);
    g.fillStyle(NEON.ink, 1).fillPoints(diamond(0, 0, 22, 28), true);
    g.fillStyle(color, 1).fillPoints(diamond(0, 0, 16, 22), true);
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
    burstSparkles(scene, this.parent, spot.x, spot.groundY - spot.height * 0.95, { count: 6 + times * 2, radius: 80, size: 13, colors: [0xffffff, NEON.yellow, NEON.cyan, NEON.pink], seed: times * 13 + 5, rise: 30 });
    scene.tweens.add({ targets: puppet, y: restY - 56 * chestFxMotion().distance, duration: 170, yoyo: true, repeat: times - 1, ease: "Quad.Out", onComplete: () => this.restart() });
  }
  flinch(): void {
    const { scene, puppet, spot } = this;
    if (!puppet?.active || !chestFxMotion().loops) return;
    scene.tweens.add({ targets: puppet, x: { from: spot.x - 9, to: spot.x + 9 }, duration: 55, yoyo: true, repeat: 2, ease: "Sine.InOut", onComplete: () => puppet.setX(spot.x) });
  }
}

/**
 * 난이도 단추 — 오락기 버튼처럼 남색 화면 판에 네온 테, 아래로 두께가 진다. 왼쪽 음표 수가 난이도(1~4)이고 오른쪽
 * 알약이 드는 코인이다. 누를 수 있는 동안 네온 테가 박자처럼 숨 쉰다.
 */
class FishingPickButton extends Phaser.GameObjects.Container {
  private readonly face: Phaser.GameObjects.Container;
  private readonly label: Phaser.GameObjects.Text;
  private readonly priceText: Phaser.GameObjects.Text;
  private readonly pill: Phaser.GameObjects.Graphics;
  private readonly coin: Phaser.GameObjects.Image;
  private readonly glow: Phaser.GameObjects.Graphics;
  private readonly marks: Phaser.GameObjects.Graphics;
  private pulse?: Phaser.Tweens.Tween;
  private enabled = true;
  private static readonly DEPTH = 12;
  constructor(scene: Phaser.Scene, x: number, y: number, private readonly options: { width: number; height: number; level: number; tone: number; onClick: () => void }) {
    super(scene, x, y);
    const { width, height } = options;
    const depth = FishingPickButton.DEPTH, radius = 22, ink = 5;
    const base = scene.add.graphics();
    base.fillStyle(NEON.shade, 0.32).fillRoundedRect(-width / 2 + 6, -height / 2 + depth + 10, width, height, radius);
    base.fillStyle(NEON.ink, 1).fillRoundedRect(-width / 2 - ink, -height / 2 - ink, width + ink * 2, height + depth + ink * 2, radius + ink);
    base.fillStyle(NEON.yellowDeep, 1).fillRoundedRect(-width / 2, -height / 2 + depth, width, height, radius);
    this.add(base);
    this.face = scene.add.container(0, 0);
    const plate = scene.add.graphics();
    plate.fillStyle(NEON.screen, 1).fillRoundedRect(-width / 2, -height / 2, width, height, radius);
    plate.fillStyle(NEON.screenHi, 1).fillRoundedRect(-width / 2, -height / 2, width, height * 0.5, { tl: radius, tr: radius, bl: 0, br: 0 });
    // 주사선 — 오래된 오락기 화면의 결을 아주 옅게.
    plate.fillStyle(0xffffff, 0.04);
    for (let row = -height / 2 + 6; row < height / 2; row += 8) plate.fillRect(-width / 2 + 6, row, width - 12, 2);
    this.face.add(plate);
    this.marks = scene.add.graphics();
    for (let index = 0; index < 4; index += 1) {
      const px = -width / 2 + 30 + index * 18, py = 0;
      this.marks.fillStyle(NEON.ink, 1).fillPoints(diamond(px, py, 8, 12), true);
      this.marks.fillStyle(index < options.level ? options.tone : 0x3a4060, 1).fillPoints(diamond(px, py, 6, 9), true);
    }
    this.face.add(this.marks);
    this.glow = scene.add.graphics();
    this.glow.lineStyle(3, options.tone, 1).strokeRoundedRect(-width / 2 + 9, -height / 2 + 9, width - 18, height - 18, radius - 8);
    this.face.add(this.glow);
    this.label = scene.add.text(0, 0, "", textStyle({ role: "display", size: Math.round(height * 0.36), color: COLOR.accentText })).setOrigin(0.5).setStroke("#05070a", 6);
    this.pill = scene.add.graphics();
    this.coin = scene.add.image(0, 0, COIN_ICON).setDisplaySize(height * 0.42, height * 0.42);
    this.priceText = scene.add.text(0, 0, "", textStyle({ role: "display", size: Math.round(height * 0.28), color: "#ffe38a" })).setOrigin(0, 0.5);
    this.face.add([this.label, this.pill, this.coin, this.priceText]);
    this.add(this.face);
    const hit = addClippedHit(scene, this, 0, depth / 2, width, height + depth, anywhere(scene), { useHandCursor: true });
    hit.on("pointerdown", () => { if (this.enabled) this.face.setY(depth * 0.7); });
    hit.on("pointerout", () => this.face.setY(0));
    hit.on("pointerup", () => { this.face.setY(0); if (this.enabled) options.onClick(); });
    this.setSize(width, height + depth);
    this.once(Phaser.GameObjects.Events.DESTROY, () => this.pulse?.remove());
    this.syncPulse();
  }
  setContent(name: string, price: number): this {
    const { width, height } = this.options;
    this.label.setScale(1).setText(name);
    this.priceText.setText(price.toLocaleString());
    const pillHeight = height * 0.56, coin = height * 0.42, pad = 14;
    const pillWidth = pad + coin + 8 + this.priceText.width + pad + 4;
    const pillRight = width / 2 - 34, pillLeft = pillRight - pillWidth;
    this.pill.clear();
    this.pill.fillStyle(NEON.ink, 0.92).fillRoundedRect(pillLeft, -pillHeight / 2, pillWidth, pillHeight, pillHeight / 2);
    this.pill.lineStyle(2, this.options.tone, 0.8).strokeRoundedRect(pillLeft, -pillHeight / 2, pillWidth, pillHeight, pillHeight / 2);
    this.coin.setPosition(pillLeft + pad + coin / 2, 0);
    this.priceText.setPosition(pillLeft + pad + coin + 8, 1);
    const left = -width / 2 + 104;
    shrinkTextToWidth(this.label, pillLeft - 20 - left);
    this.label.setX((left + pillLeft - 12) / 2);
    return this;
  }
  setEnabled(enabled: boolean): this {
    if (this.enabled === enabled) return this;
    this.enabled = enabled;
    this.setAlpha(enabled ? 1 : 0.55);
    this.syncPulse();
    return this;
  }
  private syncPulse(): void {
    const alive = this.enabled && chestFxMotion().loops;
    if (alive && !this.pulse) this.pulse = this.scene.tweens.add({ targets: this.glow, alpha: { from: 1, to: 0.3 }, duration: 520, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    else if (!alive && this.pulse) { this.pulse.remove(); this.pulse = undefined; this.glow.setAlpha(1); }
  }
}

/** 게이지 한 칸 — 남색 화면 판, 빛나는 구간(가운데의 PERFECT 띠는 더 밝다), 노란 바늘. 바늘은 매 프레임 다시 그린다. */
function paintGauge(g: Phaser.GameObjects.Graphics, spec: FishingCatch | undefined, tier: FishTier, position: number, flash: number): void {
  const { gaugeWidth: width, gaugeHeight: height } = FISH.play;
  const left = -width / 2, top = -height / 2, radius = 18;
  g.clear();
  g.fillStyle(NEON.shade, 0.3).fillRoundedRect(left + 6, top + 12, width, height, radius);
  g.fillStyle(NEON.ink, 1).fillRoundedRect(left - 5, top - 5, width + 10, height + 10, radius + 5);
  g.fillStyle(NEON.screen, 1).fillRoundedRect(left, top, width, height, radius);
  // 박자 눈금 — 여덟 칸.
  g.fillStyle(0xffffff, 0.08);
  for (let index = 1; index < 8; index += 1) g.fillRect(left + (width * index) / 8 - 1, top + 10, 2, height - 20);
  if (spec) {
    const tone = TIER_TONE[tier];
    const zx = left + (spec.center - spec.width / 2) * width, zw = spec.width * width;
    g.fillStyle(tone, 0.42 + 0.4 * flash).fillRect(zx, top + 6, zw, height - 12);
    const pw = zw * 0.4;
    g.fillStyle(tone, 0.95).fillRect(left + spec.center * width - pw / 2, top + 6, pw, height - 12);
    g.lineStyle(3, 0xffffff, 0.9).strokeRect(zx, top + 6, zw, height - 12);
  }
  const nx = left + Math.max(0, Math.min(1, position)) * width;
  g.fillStyle(NEON.ink, 1).fillRect(nx - 8, top - 16, 16, height + 32);
  g.fillStyle(NEON.yellow, 1).fillRect(nx - 5, top - 13, 10, height + 26);
  g.fillStyle(NEON.ink, 1).fillPoints(diamond(nx, top - 22, 16, 14), true);
  g.fillStyle(NEON.yellow, 1).fillPoints(diamond(nx, top - 22, 11, 9), true);
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
    const resetText = scene.add.text(0, FISH.resetY, "", textStyle({ role: "body", size: 21, color: INK_SOFT, align: "center", wrap: 840 })).setOrigin(0.5);
    body.add(resetText);

    // 첫 쪽 — 위에 안내, 가운데 슈테, 아래에 「게임 방법!」과 난이도 단추(좌우로 넘긴다).
    const introPage = scene.add.container(0, 0);
    body.add(introPage);
    const introStage = scene.add.container(0, 0);
    introPage.add(introStage);
    const introShute = new ShuteBeat(scene, introStage, FISH.sd);
    introPage.add(scene.add.text(0, FISH.intro.textY, t("shuteFishing.intro"), textStyle({ role: "emphasis", size: 27, color: INK, wrap: 780, align: "center" })).setOrigin(0.5).setStroke(OUTLINE, 6));
    const detailText = scene.add.text(0, FISH.intro.detailY, "", textStyle({ role: "body", size: 23, color: INK, wrap: 800, align: "center" })).setOrigin(0.5).setStroke(OUTLINE, 6);
    introPage.add(detailText);
    introPage.add(scene.add.text(0, FISH.intro.noteY, t("shuteFishing.jackpotNote"), textStyle({ role: "emphasis", size: 24, color: ACCENT, wrap: 640, align: "center" })).setOrigin(0.5).setStroke(OUTLINE, 6));
    introPage.add(addHowToButton(scene, 0, FISH.intro.howToY, () => openShuteFishingHowTo(scene, popups)));

    let pick = 0;
    let swiping = false;
    const picker = scene.add.container(0, FISH.intro.pickerY);
    const buttons = FISHING_DIFFICULTIES.map((entry, index) => {
      const button = new FishingPickButton(scene, 0, 0, { width: FISH.button.width, height: FISH.button.height, level: index + 1, tone: DIFFICULTY_TONE[entry.id],
        onClick: () => {
          const pointer = scene.input.activePointer;
          if (Math.abs(pointer.upX - pointer.downX) > 36) return;
          void enterRun(entry.id);
        } });
      const slot = scene.add.container(0, 0, [button]);
      slot.setVisible(index === pick);
      picker.add(slot);
      return { entry, button, slot };
    });
    introPage.add(picker);
    const pips = scene.add.graphics();
    introPage.add(pips);
    const paintPips = (): void => {
      pips.clear();
      buttons.forEach(({ entry }, index) => {
        const x = (index - (buttons.length - 1) / 2) * 56, y = FISH.intro.pipsY, on = index === pick;
        const rx = on ? 16 : 10, ry = on ? 22 : 14;
        pips.fillStyle(NEON.ink, 1).fillPoints(diamond(x, y, rx + 3, ry + 3), true);
        pips.fillStyle(on ? DIFFICULTY_TONE[entry.id] : 0xc9cbd8, 1).fillPoints(diamond(x, y, rx, ry), true);
      });
    };
    const tempoOf = (id: FishingDifficultyId): number => fishingDifficulty(id)?.sweepMs ?? 1000;
    const arrows: Phaser.GameObjects.Container[] = [];
    const shift = (direction: -1 | 1): void => {
      const next = pick + direction;
      if (busy || swiping || next < 0 || next >= buttons.length) return;
      swiping = true;
      const from = buttons[pick].slot, to = buttons[next].slot;
      pick = next;
      const distance = 150 * motion();
      to.setVisible(true).setAlpha(0).setX(direction * distance);
      scene.tweens.add({ targets: from, x: -direction * distance, alpha: 0, duration: 170, ease: "Quad.In", onComplete: () => { from.setVisible(false).setX(0).setAlpha(1); } });
      scene.tweens.add({ targets: to, x: 0, alpha: 1, duration: 230, delay: 90, ease: "Back.Out", onComplete: () => { swiping = false; } });
      if (motion() <= 0) { from.setVisible(false).setX(0).setAlpha(1); to.setX(0).setAlpha(1); swiping = false; }
      burstSparkles(scene, introPage, 0, FISH.intro.pickerY, { count: 7, radius: 150, size: 12, colors: [0xffffff, NEON.yellow, DIFFICULTY_TONE[buttons[next].entry.id]], seed: next * 11 + 2, rise: 14 });
      audioManager?.playUi("roulette.tick");
      introShute.setTempo(tempoOf(buttons[next].entry.id));
      paintPips(); refresh();
    };
    for (const direction of [-1, 1] as const) {
      const arrow = scene.add.container(direction * FISH.intro.arrowX, FISH.intro.pickerY + 6);
      const g = scene.add.graphics();
      g.fillStyle(NEON.shade, 0.28).fillPoints([new Phaser.Geom.Point(direction * 30 + 3, 8), new Phaser.Geom.Point(-direction * 24 + 3, -38), new Phaser.Geom.Point(-direction * 24 + 3, 54)], true);
      g.fillStyle(NEON.ink, 1).fillPoints([new Phaser.Geom.Point(direction * 32, 0), new Phaser.Geom.Point(-direction * 26, -48), new Phaser.Geom.Point(-direction * 26, 48)], true);
      g.fillStyle(NEON.yellow, 1).fillPoints([new Phaser.Geom.Point(direction * 20, 0), new Phaser.Geom.Point(-direction * 18, -35), new Phaser.Geom.Point(-direction * 18, 35)], true);
      const zone = addClippedHit(scene, arrow, 0, 0, 110, 150, anywhere(scene), { useHandCursor: true });
      zone.on("pointerdown", () => pressIn(arrow));
      zone.on("pointerout", () => pressOut(arrow, "normal", { pop: false }));
      zone.on("pointerup", () => { pressOut(arrow); shift(direction); });
      arrow.addAt(g, 0);
      arrows.push(arrow);
      introPage.add(arrow);
    }
    // 단추 바깥을 쓸어도 넘어간다.
    const pointerDownAt = { x: 0, y: 0, armed: false };
    const onDown = (pointer: Phaser.Input.Pointer): void => {
      const bounds = buttons[pick].slot.getBounds(new Phaser.Geom.Rectangle(0, 0, 0, 0));
      pointerDownAt.armed = introPage.visible && Phaser.Geom.Rectangle.Contains(new Phaser.Geom.Rectangle(bounds.x - 320, bounds.y - 70, bounds.width + 640, bounds.height + 140), pointer.x, pointer.y);
      pointerDownAt.x = pointer.x; pointerDownAt.y = pointer.y;
    };
    const onUp = (pointer: Phaser.Input.Pointer): void => {
      if (!pointerDownAt.armed) return;
      pointerDownAt.armed = false;
      const dx = pointer.x - pointerDownAt.x;
      if (Math.abs(dx) > 36 && Math.abs(dx) > Math.abs(pointer.y - pointerDownAt.y)) shift(dx < 0 ? 1 : -1);
    };
    scene.input.on("pointerdown", onDown);
    scene.input.on("pointerup", onUp);
    introPage.once(Phaser.GameObjects.Events.DESTROY, () => { scene.input.off("pointerdown", onDown); scene.input.off("pointerup", onUp); });
    paintPips();

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
    const judgeText = scene.add.text(0, FISH.play.judgeY, "", textStyle({ role: "display", size: 64, color: INK })).setOrigin(0.5).setStroke("#1b1f3b", 10);
    const gauge = scene.add.graphics().setPosition(0, FISH.play.gaugeY);
    const tap = scene.add.container(0, FISH.play.tapY);
    playPage.add([lives, collectedLabel, collectedRow, setlistRow, playStage, fishHolder, notes, catchText, gauge, judgeText, tap]);
    const note = scene.add.text(0, FISH.height / 2 - 70, "", textStyle({ role: "body", size: 21, color: INK_SOFT, wrap: 820, align: "center" })).setOrigin(0.5);
    body.add(note);

    // 「탭!」 단추 — 누르는 순간(pointerdown)에 판정한다. 확정 입력은 보통 pointerup이지만 리듬 판정은 손가락이 닿는
    // 순간이 박자라서, 떼는 순간을 쓰면 누르고 떼는 사이(100ms 남짓)만큼 늘 늦게 판정된다.
    {
      const { width, height } = FISH.play.tap;
      const g = scene.add.graphics();
      g.fillStyle(NEON.shade, 0.3).fillRoundedRect(-width / 2 + 6, -height / 2 + 22, width, height, height / 2);
      g.fillStyle(NEON.ink, 1).fillRoundedRect(-width / 2 - 6, -height / 2 - 6, width + 12, height + 26, height / 2 + 6);
      g.fillStyle(NEON.yellowDeep, 1).fillRoundedRect(-width / 2, -height / 2 + 14, width, height, height / 2);
      const face = scene.add.container(0, 0);
      const plate = scene.add.graphics();
      plate.fillStyle(NEON.yellow, 1).fillRoundedRect(-width / 2, -height / 2, width, height, height / 2);
      plate.fillStyle(0xffffff, 0.35).fillRoundedRect(-width / 2 + 24, -height / 2 + 12, width - 48, height * 0.3, height * 0.15);
      const label = scene.add.text(0, 2, t("shuteFishing.tap"), textStyle({ role: "display", size: 62, color: INK })).setOrigin(0.5).setStroke(OUTLINE, 6);
      shrinkTextToWidth(label, width - 80);
      face.add([plate, label]);
      tap.add([g, face]);
      const hit = addClippedHit(scene, tap, 0, 7, width + 120, height + 160, anywhere(scene), { useHandCursor: true });
      hit.on("pointerdown", () => { face.setY(10); void press(); });
      hit.on("pointerup", () => face.setY(0));
      hit.on("pointerout", () => face.setY(0));
    }

    const publish = (): void => managerEvents.publish("wallet", { wallet: session.wallet });
    /** 지금 도는 캐치 — 바늘이 출발한 시각(`performance.now`)과 그 캐치의 게이지. */
    let current: { spec: FishingCatch; tier: FishTier; startedAt: number } | undefined;
    let frozenAt: number | undefined;
    let flash = 0;

    const paintLives = (misses: number): void => {
      lives.clear();
      for (let index = 0; index < SHUTE_FISHING.maxMisses; index += 1) {
        const x = (index - (SHUTE_FISHING.maxMisses - 1) / 2) * 76, y = FISH.play.livesY;
        const on = index >= misses;
        lives.fillStyle(NEON.shade, 0.25).fillPoints(diamond(x, y + 4, 32, 28), true);
        lives.fillStyle(NEON.ink, 1).fillPoints(diamond(x, y, 30, 27), true);
        lives.fillStyle(on ? NEON.pink : 0x5a6080, 1).fillPoints(diamond(x, y, 24, 21), true);
        if (on) drawSparkle(lives, x, y - 2, 10, 0xffffff, 0.9);
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
    /** 셋리스트 — 이번 판에 물릴 물고기가 차례로 선다. 낚은 것은 노란 체크, 지금 것은 크게, 남은 것은 흐리게. */
    const paintSetlist = (fish: readonly string[], index: number): void => {
      setlistRow.removeAll(true);
      const size = FISH.play.setlistSize, gap = 18;
      fish.forEach((id, order) => {
        const treasure = fishTreasure(id);
        if (!treasure) return;
        const x = (order - (fish.length - 1) / 2) * (size + gap);
        const holder = scene.add.container(x, 0);
        const ring = scene.add.graphics();
        ring.fillStyle(NEON.ink, 1).fillPoints(diamond(0, -size * 0.72, 9, 11), true);
        ring.fillStyle(TIER_TONE[treasure.tier], 1).fillPoints(diamond(0, -size * 0.72, 6, 8), true);
        holder.add(ring);
        addFramedIcon(scene, holder, 0, 0, size, CURRENCY_ICON_BY_WALLET[treasure.currency], { amount: formatCurrency(treasure.amount), amountRatio: 0.3 });
        if (order < index) {
          const check = scene.add.graphics();
          check.fillStyle(0x000000, 0.5).fillRect(-size / 2, -size / 2, size, size);
          check.lineStyle(8, NEON.yellow, 1).beginPath().moveTo(-size * 0.22, 0).lineTo(-size * 0.04, size * 0.18).lineTo(size * 0.26, -size * 0.2).strokePath();
          holder.add(check);
        } else if (order > index) holder.setAlpha(0.55);
        else holder.setScale(1.14);
        setlistRow.add(holder);
      });
    };
    /** 지금 물고기 — 큰 보물 액자와 그 아래 캐치 음표(채운 만큼 노랗다). */
    const paintFish = (id: string | undefined, caught: number): void => {
      fishHolder.removeAll(true);
      notes.clear();
      catchText.setText("");
      const treasure = id ? fishTreasure(id) : undefined;
      if (!treasure) return;
      const size = FISH.play.fishSize;
      const halo = scene.add.graphics();
      halo.fillStyle(TIER_TONE[treasure.tier], 0.35).fillPoints(diamond(0, 0, size * 0.78, size * 0.7), true);
      fishHolder.add(halo);
      addFramedIcon(scene, fishHolder, 0, 0, size, CURRENCY_ICON_BY_WALLET[treasure.currency], { amount: formatCurrency(treasure.amount), amountRatio: 0.3 });
      if (treasure.tier === "jackpot") {
        const sparkle = scene.add.graphics();
        for (const [x, y, s] of [[-size * 0.6, -size * 0.4, 16], [size * 0.62, -size * 0.1, 13], [size * 0.5, size * 0.5, 18]] as const) drawSparkle(sparkle, x, y, s, 0xffe38a, 1);
        fishHolder.add(sparkle);
      }
      const need = FISH_TIER_FEEL[treasure.tier].catches;
      for (let index = 0; index < need; index += 1) {
        const x = FISH.play.fishX + (index - (need - 1) / 2) * 40, y = FISH.play.notesY;
        notes.fillStyle(NEON.ink, 1).fillPoints(diamond(x, y, 15, 19), true);
        notes.fillStyle(index < caught ? NEON.yellow : 0x5a6080, 1).fillPoints(diamond(x, y, 11, 15), true);
      }
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
      paintGauge(gauge, current?.spec, current?.tier ?? "common", position, flash);
    };
    scene.events.on(Phaser.Scenes.Events.UPDATE, tick);
    body.once(Phaser.GameObjects.Events.DESTROY, () => scene.events.off(Phaser.Scenes.Events.UPDATE, tick));

    const showJudge = (judgment: FishingJudgment): void => {
      judgeText.setText(t(JUDGE_KEY[judgment])).setColor(JUDGE_COLOR[judgment]).setAlpha(1);
      scene.tweens.killTweensOf(judgeText);
      if (motion() > 0) { judgeText.setScale(1.35); scene.tweens.add({ targets: judgeText, scale: 1, duration: 200, ease: "Back.Out" }); }
      scene.tweens.add({ targets: judgeText, alpha: 0, delay: 520, duration: 260 });
    };

    const refresh = (): void => {
      coinText.setText(status.coins.toLocaleString());
      resetText.setText(t("shuteFishing.reset", { date: new Date(status.resetsAt).toLocaleString(undefined, { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) }));
      const running = status.run !== null;
      introPage.setVisible(!running); playPage.setVisible(running);
      if (running) return;
      const entry = buttons[pick].entry;
      detailText.setText(`${t("shuteFishing.detail", { fish: entry.fish, misses: SHUTE_FISHING.maxMisses })} · ${t(HINT_KEY[entry.id])}`);
      buttons.forEach(({ entry: item, button }, index) => {
        button.setContent(t(DIFFICULTY_KEY[item.id]), item.entryCost);
        button.setEnabled(index === pick && !busy && status.coins >= item.entryCost);
      });
      arrows.forEach((arrow, index) => arrow.setAlpha((index === 0 ? pick > 0 : pick < buttons.length - 1) && !busy ? 1 : 0.3));
    };
    const paintRun = (): void => {
      const run = status.run;
      if (!run) return;
      paintLives(run.misses); paintCollected(run.collected);
      paintSetlist(run.fish, run.index);
      paintFish(run.fish[run.index], run.caught);
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
      busy = false;
      if (!result?.status.run) { if (alive) refresh(); return; }
      status = result.status;
      if (!alive) return;
      note.setText("");
      audioManager?.playUi("roulette.tick");
      refresh(); paintRun();
      showJudge("good"); judgeText.setText(t("shuteFishing.ready")).setColor(JUDGE_COLOR.good);
      await waitFx(scene, 700);
      if (alive) armCatch();
    }

    /** 다 끝난 뒤 — 받은 몫을 알리고 첫 쪽으로 돌아간다. */
    async function finish(total: Partial<Record<ChestCardCurrency, number>>, cleared: boolean): Promise<void> {
      current = undefined;
      judgeText.setText(t(cleared ? "shuteFishing.cleared" : "shuteFishing.out")).setColor(cleared ? JUDGE_COLOR.perfect : "#ff6f8f").setAlpha(1).setScale(1);
      scene.tweens.killTweensOf(judgeText);
      if (cleared) { playShute.cheer(3); audioManager?.playUi("success.fanfare"); } else playShute.flinch();
      await waitFx(scene, 1000);
      if (!alive) return;
      const items = currencyRecordToRewardItems(total);
      if (items.length) await new Promise<void>((resolve) => openRewardPopup(scene, popups, { title: t("shuteFishing.reward"), titleSize: 36, dimAlpha: 0.66, items, onConfirm: resolve }));
    }

    async function press(): Promise<void> {
      if (busy || !current || frozenAt !== undefined) return;
      const pressedAt = performance.now();
      const elapsedMs = Math.round(pressedAt - current.startedAt);
      frozenAt = pressedAt;
      busy = true;
      // 화면이 먼저 같은 규칙으로 판정해 보여 준다 — 답을 기다리는 동안 손이 비어 보이지 않게. 확정은 서버의 답이다.
      const guess = judgeCatch(current.spec, elapsedMs).judgment;
      showJudge(guess);
      if (guess !== "miss") { flash = 1; audioManager?.playUi("ui.tap"); } else audioManager?.playUi("ui.deny");
      const result: ShuteFishingResponse | undefined = await gameApi.reelShuteFishing({ requestId: crypto.randomUUID(), elapsedMs }).catch(fail);
      if (!result?.reel) { busy = false; if (alive && current) { current.startedAt = performance.now(); frozenAt = undefined; } return; }
      const reel = result.reel;
      status = result.status;
      if (!alive) { busy = false; return; }
      if (reel.judgment !== guess) showJudge(reel.judgment);
      if (reel.judgment === "miss") {
        playShute.flinch();
        paintLives(reel.misses);
        if (status.run) await waitFx(scene, 420);
      } else if (reel.landed) {
        publish();
        const treasure = fishTreasure(reel.landed);
        burstSparkles(scene, playPage, FISH.play.fishX, FISH.play.fishY, { count: 10, radius: 110, size: 15, colors: [0xffffff, NEON.yellow, NEON.cyan, NEON.pink], seed: reel.fishIndex + 7, rise: 24 });
        playShute.cheer(treasure?.tier === "jackpot" ? 3 : 1);
        audioManager?.playUi(treasure?.tier === "jackpot" ? "roulette.win" : "ui.reward");
        paintFish(reel.landed, reel.caught);
        paintCollected(reel.total ?? status.run?.collected ?? {}, reel.granted?.currency as ChestCardCurrency | undefined);
        judgeText.setText(t("shuteFishing.landed")).setColor(JUDGE_COLOR.perfect).setAlpha(1);
        await waitFx(scene, 650);
      } else {
        const run = status.run;
        if (run) paintFish(run.fish[run.index], run.caught);
        await waitFx(scene, 260);
      }
      busy = false;
      if (reel.finished) { await finish(reel.total ?? {}, reel.cleared); if (alive) refresh(); return; }
      if (!alive) return;
      paintRun();
      armCatch();
    }

    refresh();
    // 닫았다 다시 연 판 — 낚은 물고기·캐치 수·미스가 그대로 이어지고, 바늘은 지금 캐치의 처음부터 다시 출발한다.
    if (status.run) { paintRun(); armCatch(); }
  });
}

/** 「게임 방법!」 — 난이도 단추 위에 앉는 작은 말풍선 단추. */
function addHowToButton(scene: Phaser.Scene, x: number, y: number, onClick: () => void): Phaser.GameObjects.Container {
  const root = scene.add.container(x, y);
  const label = scene.add.text(0, 0, t("shuteFishing.howTo.button"), textStyle({ role: "emphasis", size: 26, color: INK })).setOrigin(0, 0.5);
  shrinkTextToWidth(label, 300);
  const height = 56, badge = 20, pad = 18;
  const width = pad + badge * 2 + 10 + label.displayWidth + pad;
  const g = scene.add.graphics();
  g.fillStyle(NEON.shade, 0.22).fillRoundedRect(-width / 2 + 3, -height / 2 + 6, width, height, height / 2);
  g.fillStyle(NEON.ink, 1).fillRoundedRect(-width / 2 - 3, -height / 2 - 3, width + 6, height + 6, height / 2 + 3);
  g.fillStyle(NEON.cream, 1).fillRoundedRect(-width / 2, -height / 2, width, height, height / 2);
  const bx = -width / 2 + pad + badge;
  g.fillStyle(NEON.pink, 1).fillPoints(diamond(bx, 0, badge, badge * 1.2), true);
  const mark = scene.add.text(bx, 1, "?", textStyle({ role: "display", size: 28, color: "#ffffff" })).setOrigin(0.5);
  label.setX(bx + badge + 10);
  const sparkle = scene.add.graphics();
  drawSparkle(sparkle, width / 2 - 2, -height / 2 + 4, 13, NEON.yellow);
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
    bubble.fillStyle(NEON.shade, 0.22).fillRoundedRect(bx + 6, by + 10, bubbleWidth, bubbleHeight, 34);
    bubble.fillStyle(NEON.ink, 1).fillRoundedRect(bx - 4, by - 4, bubbleWidth + 8, bubbleHeight + 8, 38);
    bubble.fillTriangle(tailX - 34, tailBase - 6, tailX + 30, tailBase - 6, tailX - 18, tailBase + tail + 4);
    bubble.fillStyle(NEON.cream, 1).fillRoundedRect(bx, by, bubbleWidth, bubbleHeight, 34);
    bubble.fillTriangle(tailX - 28, tailBase - 8, tailX + 24, tailBase - 8, tailX - 16, tailBase + tail - 4);
    const marks = scene.add.graphics();
    body.add([bubble, marks]);
    let y = by + bubblePad;
    const textX = bx + 84;
    lines.forEach((line, index) => {
      line.setPosition(textX, y);
      body.add(line);
      const cy = y + 18;
      marks.fillStyle(NEON.ink, 1).fillPoints(diamond(textX - 38, cy, 22, 26), true);
      marks.fillStyle([NEON.cyan, NEON.yellowDeep, NEON.pink, 0xa070ff][index], 1).fillPoints(diamond(textX - 38, cy, 18, 22), true);
      body.add(scene.add.text(textX - 38, cy + 1, String(index + 1), textStyle({ role: "display", size: 22, color: "#ffffff" })).setOrigin(0.5));
      y += rowHeight(line) + lineGap;
    });
    drawSparkle(marks, bx + bubbleWidth - 18, by + 8, 20, NEON.yellow);
    drawSparkle(marks, bx + 14, by + bubbleHeight - 10, 14, 0xffffff);
    const stage = scene.add.container(0, 0);
    body.add(stage);
    void new ShuteBeat(scene, stage, { x: sd.x + 200, groundY: height / 2 - 30, height: sd.height });
  });
}
