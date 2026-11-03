import Phaser from "phaser";
import { t } from "../i18n";
import { gameApi } from "../api/FakeServer";
import type { DelophyHuntResponse } from "../api/contracts";
import { formatCurrency } from "../core/formatCurrency";
import {
  DELOPHY_HUNT, HUNT_DIFFICULTIES, huntBoardColumns, huntDifficulty, huntHeat, huntTreasure,
  type DelophyHuntStatus, type HuntDifficulty, type HuntDifficultyId, type HuntMove, type HuntTier, type HuntTreasure,
} from "../core/delophyHunt";
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
import { playMotion, sdAssetFor, spawnPuppet, type PuppetCreature } from "../puppets/assets";
import { startPuppetHop } from "./puppetHop";
import { addSdFootShadow } from "./SdFootShadow";
import { popupArtShape, popupBodyShapeMask } from "./popupArt";
import type { PopupLayer } from "./PopupLayer";
import { openRewardPopup } from "./RewardPopup";
import { currencyRecordToRewardItems } from "./rewardPopupModel";
import { RouletteSpinButton } from "./RouletteSpinButton";
import { drawSparkle } from "./rouletteWheel";
import { BACKGROUND } from "./backgroundAssets";
import { addEventPopupBackdrop } from "./eventBackdrop";
import { addCurrencyChip } from "./CurrencyChip";
import { pressIn, pressOut } from "./pressFeedback";
import { shrinkTextToWidth } from "./textFit";
import type { TextKey } from "../i18n";
import { textStyle } from "./theme";

/**
 * 델로피의 보물 찾기 창의 자리. 두 쪽이고 가운데에는 늘 카드를 돌리는 델로피가 선다(`DelophyDealer`).
 * - **첫 쪽**: 판이 없을 때. 코인 → 안내 → 델로피 → 난이도 설명 → 「게임 방법!」 → 난이도 단추(좌우로 넘긴다).
 * - **판 쪽**: 위에 남은 기회와 **찾은 보물** → 안내 줄 → 가운데 델로피 → 아래에 카드 두 줄. 카드는 앞면으로 펼쳐졌다가
 *   엎어지고 섞이며, 같은 그림 두 장을 차례로 뒤집어 짝을 맞춘다. 세 번 틀리면 끝난다.
 * 섞이는 길은 서버가 판을 열 때 정해 그대로 보낸다 — 화면은 그 길을 그리기만 하고 정답은 알지 못한다.
 */
const HUNT = {
  width: 940,
  height: 1540,
  coinY: -684,
  resetY: -618,
  /** 가운데 델로피 — 두 쪽이 같은 자리에 서서 카드를 돌린다. */
  dealer: { x: 0, groundY: 118, height: 400, orbitRx: 250, orbitRy: 62, orbitCardWidth: 84 },
  intro: { textY: -500, detailY: 200, noteY: 300, howToY: 384, pickerY: 520, pipsY: 606, arrowX: 392 },
  play: { livesY: -556, collectedLabelY: -492, collectedY: -424, phaseY: -338, boardY: 410, areaWidth: 860, maxCardWidth: 190 },
  button: { width: 620, height: 112 },
  noteY: 738,
  howTo: { width: 820, bubbleWidth: 720, wrap: 600, lineGap: 22, sd: { x: -250, height: 300 } },
} as const;

/** 보물 찾기 전용 이벤트 코인 그림(`currencyIcons`). 코인은 지갑이 아니라 이번 주에 쓴 스테미나에서 나온다. */
const COIN_ICON = "currency-delopi-thief-coin";
/** 창 안에서 판 곁을 지키는 SD — 로비 이벤트 카드와 같은 개체다(`lobbyEvents`의 `delophy-hunt`). */
const HUNT_SD = "delophy";

/** 델로피의 결 — 진홍·검정 줄무늬 커튼, 양피지 바탕, 금빛 열쇠와 마름모 카드. 글은 짙은 자두 검정, 강조는 진홍이다. */
const INK = "#2a1530";
const INK_SOFT = "#7a5a66";
const ACCENT = "#b4233f";
const OUTLINE = "#fff6e4";
const DELO = { cream: 0xfff3da, ink: 0x2a1530, crimson: 0xb4233f, crimsonDeep: 0x7d1630, gold: 0xffd55e, goldDeep: 0xb07f12, shade: 0x2a1530 } as const;

/** 난이도의 색 — 쉬움은 민트, 보통은 하늘, 어려움은 분홍. 버튼의 테와 눌린 두께가 이 색이다. */
const DIFFICULTY_TONE: Record<HuntDifficultyId, number> = { easy: 0x8fd6b4, normal: 0x9fc2f2, hard: 0xf2a0c4 };

/** 보물 등급의 색 — 카드 앞면의 테와 면. 대박만 금빛이다. */
const TIER_TONE: Record<HuntTier, { face: number; deep: number }> = {
  common: { face: 0x9fdcc4, deep: 0x4f8f7b },
  fine: { face: 0xa6cdf2, deep: 0x5480ad },
  rare: { face: 0xd0b8f5, deep: 0x7a5cb8 },
  jackpot: { face: 0xffd55e, deep: 0xb07f12 },
};

const DIFFICULTY_KEY = { easy: "delophyHunt.difficulty.easy", normal: "delophyHunt.difficulty.normal", hard: "delophyHunt.difficulty.hard" } as const;
const HINT_KEY = { easy: "delophyHunt.hint.easy", normal: "delophyHunt.hint.normal", hard: "delophyHunt.hint.hard" } as const;

/** 카드 한 장의 크기 — 판이 가로로 넘치지 않게 쌍의 수(열 수)에서 구한다. */
export function huntCardSize(difficulty: HuntDifficulty): { width: number; height: number; gap: number } {
  const columns = huntBoardColumns(difficulty);
  const gap = columns >= 5 ? 14 : 20;
  const width = Math.min(HUNT.play.maxCardWidth, Math.floor((HUNT.play.areaWidth - gap * (columns - 1)) / columns));
  return { width, height: Math.round(width * 1.42), gap };
}
/** 슬롯 `slot`이 서는 자리(판 가운데 기준). 카드는 두 줄로 깔린다. */
export function huntSlotPosition(difficulty: HuntDifficulty, slot: number): { x: number; y: number } {
  const columns = huntBoardColumns(difficulty);
  const { width, height, gap } = huntCardSize(difficulty);
  const column = slot % columns, row = Math.floor(slot / columns);
  return { x: (column - (columns - 1) / 2) * (width + gap), y: (row - 0.5) * (height + gap) };
}

/** 델로피의 커튼 무대 바탕. 장식은 가장자리에만 둔다. */
function paintBackdrop(scene: Phaser.Scene, body: Phaser.GameObjects.Container, mask: Phaser.Display.Masks.GeometryMask, motion: number): void {
  addEventPopupBackdrop(scene, body, BACKGROUND.eventDelopiPopup, HUNT.width, HUNT.height);
  const coins: readonly [number, number, number][] = [[-400, -360, -12], [400, -100, 12], [-400, 20, 8]];
  coins.forEach(([x, y, angle], index) => {
    const coin = scene.add.image(x, y, COIN_ICON).setDisplaySize(64, 64).setAngle(angle).setAlpha(0.4).setMask(mask);
    body.add(coin);
    if (motion > 0) scene.tweens.add({ targets: coin, y: y - 10 * motion, duration: 1700 + index * 230, yoyo: true, repeat: -1, ease: "Sine.InOut" });
  });
}

const diamond = (cx: number, cy: number, rx: number, ry: number): Phaser.Geom.Point[] =>
  [new Phaser.Geom.Point(cx, cy - ry), new Phaser.Geom.Point(cx + rx, cy), new Phaser.Geom.Point(cx, cy + ry), new Phaser.Geom.Point(cx - rx, cy)];

/**
 * 카드의 뒷면 — 양피지 테두리 안에 진홍·검정 마름모 무늬(커튼·배경 카드와 같은 결), 가운데에 금빛 마름모 문장.
 * 모든 카드가 같아야 정체가 드러나지 않는다.
 */
function paintBack(scene: Phaser.Scene, holder: Phaser.GameObjects.Container, width: number, height: number): void {
  holder.removeAll(true);
  const g = scene.add.graphics();
  const left = -width / 2, top = -height / 2, radius = Math.max(8, width * 0.06), rim = Math.max(8, width * 0.055);
  g.fillStyle(DELO.shade, 0.28).fillRoundedRect(left + 4, top + 10, width, height, radius);
  g.fillStyle(DELO.ink, 1).fillRoundedRect(left - 3, top - 3, width + 6, height + 6, radius + 3);
  g.fillStyle(DELO.cream, 1).fillRoundedRect(left, top, width, height, radius);
  const ix = left + rim, iy = top + rim, iw = width - rim * 2, ih = height - rim * 2;
  g.fillStyle(DELO.ink, 1).fillRect(ix, iy, iw, ih);
  // 마름모 격자 — 칸 안에 온전히 드는 것만 진홍으로 채운다(가장자리는 검정이 남아 틀이 된다).
  const cell = Math.max(24, Math.round(width * 0.2));
  const columns = Math.floor(iw / cell), rows = Math.floor(ih / cell);
  const offsetX = ix + (iw - columns * cell) / 2, offsetY = iy + (ih - rows * cell) / 2;
  for (let row = 0; row < rows; row += 1) for (let column = 0; column < columns; column += 1) {
    if ((row + column) % 2 === 0) g.fillStyle(DELO.crimson, 1).fillPoints(diamond(offsetX + (column + 0.5) * cell, offsetY + (row + 0.5) * cell, cell * 0.5, cell * 0.5), true);
    else g.fillStyle(DELO.crimsonDeep, 1).fillPoints(diamond(offsetX + (column + 0.5) * cell, offsetY + (row + 0.5) * cell, cell * 0.5, cell * 0.5), true);
  }
  g.lineStyle(2, DELO.gold, 0.9).strokeRect(ix + 5, iy + 5, iw - 10, ih - 10);
  const er = Math.min(iw, ih) * 0.3;
  g.fillStyle(DELO.ink, 1).fillPoints(diamond(0, 0, er * 0.9, er * 1.2), true);
  g.fillStyle(DELO.gold, 1).fillPoints(diamond(0, 0, er * 0.78, er * 1.06), true);
  g.fillStyle(DELO.crimson, 1).fillPoints(diamond(0, 0, er * 0.44, er * 0.6), true);
  drawSparkle(g, 0, 0, er * 0.5, 0xffffff, 1);
  holder.add(g);
}

/**
 * 카드의 앞면 — 양피지 면, 등급 색 안쪽 판, 금박 윗띠, 보물 액자(수량), 모서리의 마름모. 맞춘 카드(`found`)는 금빛 테로 반짝인다.
 */
function paintFace(scene: Phaser.Scene, holder: Phaser.GameObjects.Container, treasure: HuntTreasure, width: number, height: number, found: boolean): void {
  holder.removeAll(true);
  const tone = TIER_TONE[treasure.tier];
  const g = scene.add.graphics();
  const left = -width / 2, top = -height / 2, radius = Math.max(8, width * 0.06), rim = Math.max(8, width * 0.055);
  g.fillStyle(DELO.shade, 0.28).fillRoundedRect(left + 4, top + 10, width, height, radius);
  g.fillStyle(found ? DELO.gold : DELO.ink, 1).fillRoundedRect(left - 3, top - 3, width + 6, height + 6, radius + 3);
  g.fillStyle(DELO.cream, 1).fillRoundedRect(left, top, width, height, radius);
  const ix = left + rim, iy = top + rim, iw = width - rim * 2, ih = height - rim * 2;
  g.fillStyle(tone.face, found ? 0.8 : 0.55).fillRect(ix, iy, iw, ih);
  // 안쪽 판의 아래쪽은 한 톤 짙게 — 평평한 색면에 층을 준다.
  g.fillStyle(tone.deep, 0.16).fillRect(ix, iy + ih * 0.62, iw, ih * 0.38);
  g.fillStyle(DELO.gold, 1).fillRect(ix, iy, iw, Math.max(8, ih * 0.05));
  g.lineStyle(2, tone.deep, 1).strokeRect(ix, iy, iw, ih);
  // 가운데를 받치는 큰 마름모 — 액자가 이 위에 선다.
  g.fillStyle(0xffffff, 0.55).fillPoints(diamond(0, -6, iw * 0.46, ih * 0.34), true);
  // 모서리 표시 — 값진 보물일수록 마름모가 많다(어렵게 섞이는 정도를 카드가 미리 알려 준다).
  const heat = huntHeat(treasure.tier);
  for (let index = 0; index < heat; index += 1) {
    const px = ix + 14 + index * 16, py = iy + 26, half = 6;
    g.fillStyle(DELO.ink, 1).fillPoints(diamond(px, py, half + 1, half * 1.4 + 1), true);
    g.fillStyle(treasure.tier === "jackpot" ? DELO.gold : tone.face, 1).fillPoints(diamond(px, py, half - 1, half * 1.4 - 1), true);
  }
  holder.add(g);
  const icon = Math.min(130, width * 0.62);
  addFramedIcon(scene, holder, 0, -6, icon, CURRENCY_ICON_BY_WALLET[treasure.currency], { amount: formatCurrency(treasure.amount), amountRatio: 0.3 });
  if (treasure.tier === "jackpot" || found) {
    const sparkle = scene.add.graphics();
    for (const [x, y, size] of [[left + 12, top + 100, 15], [width / 2 - 12, -30, 12], [width / 2 - 22, height / 2 - 70, 17]] as const) {
      drawSparkle(sparkle, x, y, size, treasure.tier === "jackpot" ? 0xffe38a : 0xffffff, 1);
    }
    holder.add(sparkle);
  }
}

/** SD 한 기를 창 안에 세운다. 창의 자식이라 창과 함께 사라진다. 장식이라 입력을 받지 않는다. */
function addHuntSd(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, spot: { x: number; groundY: number; height: number }, flipX: boolean): Promise<PuppetCreature | undefined> {
  parent.add(addSdFootShadow(scene, spot.x, spot.groundY, spot.height * 0.62));
  return spawnPuppet(scene, sdAssetFor(HUNT_SD), { x: spot.x, groundY: spot.groundY, height: spot.height, depth: 0, flipX })
    .then((puppet) => {
      if (!parent.active) { puppet.destroy(); return undefined; }
      puppet.disableInteractive();
      parent.add(puppet);
      return puppet;
    })
    .catch((error) => { logError("puppet.display", "델로피의 보물 찾기 SD 표시 실패", error); return undefined; });
}

/** 난이도마다 델로피가 돌리는 카드의 수와 속도 — 어려울수록 많이, 빠르게 돌린다(난이도 단추를 넘길 때 바로 읽힌다). */
const DEALER_TEMPO: Record<HuntDifficultyId, { cards: number; speed: number }> = { easy: { cards: 3, speed: 0.9 }, normal: { cards: 4, speed: 1.4 }, hard: { cards: 5, speed: 2 } };
const DEALER_MAX_CARDS = 5;

/**
 * 가운데에 서서 카드를 돌리는 델로피 — 몸 둘레의 타원을 따라 카드가 돈다(뒤쪽 반은 몸 뒤, 앞쪽 반은 몸 앞).
 * 짝을 맞추면 크게 폴짝 뛰며 반짝이를 터뜨리고, 틀리면 움찔한다. 섞는 동안은 카드가 훨씬 빨리 돈다.
 */
interface DealerSpot { x: number; groundY: number; height: number; orbitRx: number; orbitRy: number; orbitCardWidth: number }

class DelophyDealer {
  private puppet?: PuppetCreature;
  private idle?: Phaser.Tweens.Tween;
  private readonly back: Phaser.GameObjects.Container;
  private readonly front: Phaser.GameObjects.Container;
  private readonly cards: Phaser.GameObjects.Container[] = [];
  private angle = 0;
  private baseSpeed = DEALER_TEMPO.normal.speed;
  private boost = 1;
  private shown = DEALER_TEMPO.normal.cards;
  private readonly tick: (time: number, delta: number) => void;
  private readonly spot: DealerSpot;
  constructor(private readonly scene: Phaser.Scene, private readonly parent: Phaser.GameObjects.Container, spot: DealerSpot = HUNT.dealer) {
    this.spot = spot;
    this.back = scene.add.container(0, 0);
    this.front = scene.add.container(0, 0);
    parent.add(this.back);
    const cardWidth = spot.orbitCardWidth, cardHeight = Math.round(cardWidth * 1.42);
    for (let index = 0; index < DEALER_MAX_CARDS; index += 1) {
      const holder = scene.add.container(0, 0);
      paintBack(scene, holder, cardWidth, cardHeight);
      this.cards.push(holder);
      this.back.add(holder);
    }
    void addHuntSd(scene, parent, { x: spot.x, groundY: spot.groundY, height: spot.height }, false).then((puppet) => {
      this.puppet = puppet;
      parent.add(this.front);
      if (puppet && chestFxMotion().loops) this.idle = startPuppetHop(scene, puppet, 0);
    });
    if (!parent.list.includes(this.front)) parent.add(this.front);
    this.tick = (_time, delta) => { if (parent.active) this.step(delta / 1000); };
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.tick);
    parent.once(Phaser.GameObjects.Events.DESTROY, () => scene.events.off(Phaser.Scenes.Events.UPDATE, this.tick));
    this.place();
  }
  /** 난이도 단추를 넘길 때 — 돌리는 카드의 수와 속도가 바뀌고 델로피가 한 번 뛴다. */
  setDifficulty(id: HuntDifficultyId): void {
    const tempo = DEALER_TEMPO[id];
    this.shown = tempo.cards; this.baseSpeed = tempo.speed;
    this.place();
  }
  /** 섞는 동안 카드를 훨씬 빨리 돌린다. */
  setShuffling(on: boolean): void { this.boost = on ? 2.6 : 1; }
  private step(seconds: number): void {
    if (chestFxMotion().loops) this.angle += seconds * this.baseSpeed * this.boost;
    this.place();
  }
  private place(): void {
    const { spot } = this;
    const cx = spot.x, cy = spot.groundY - spot.height * 0.46;
    this.cards.forEach((holder, index) => {
      const visible = index < this.shown;
      holder.setVisible(visible);
      if (!visible) return;
      const a = this.angle + (index / this.shown) * Math.PI * 2;
      const depth = Math.sin(a);
      holder.setPosition(cx + Math.cos(a) * spot.orbitRx, cy + depth * spot.orbitRy - 20);
      holder.setScale(0.82 + 0.22 * depth);
      holder.setRotation(Math.cos(a) * 0.32);
      holder.setAlpha(depth < 0 ? 0.8 : 1);
      const layer = depth > 0 ? this.front : this.back;
      if (holder.parentContainer !== layer) layer.add(holder);
    });
  }
  cheer(times = 1): void {
    const { scene, puppet, spot } = this;
    if (!puppet?.active) return;
    this.idle?.pause();
    scene.tweens.killTweensOf(puppet);
    puppet.setY(spot.groundY);
    const rise = 62 * chestFxMotion().distance;
    burstSparkles(scene, this.parent, spot.x, spot.groundY - spot.height * 0.95, { count: 7 + times * 2, radius: 80, size: 13, colors: [0xffffff, 0xffe38a, 0xff9fb4, 0xffd9f0], seed: times * 17 + 3, rise: 30 });
    scene.tweens.add({ targets: puppet, y: spot.groundY - rise, angle: { from: -6, to: 6 }, duration: 190, yoyo: true, repeat: times - 1, ease: "Quad.Out",
      onComplete: () => { puppet.setY(spot.groundY).setAngle(0); this.idle?.resume(); } });
  }
  flinch(): void {
    if (this.puppet?.active) playMotion(this.scene, this.puppet, "hit");
  }
}

/** 카드 한 장 — 처음 배치의 번호(`card`)가 정체이고, 지금 선 자리는 섞이면서 바뀐다. */
interface HuntCardView { holder: Phaser.GameObjects.Container; treasure: HuntTreasure; slot: number; up: boolean; found: boolean }

/** 델로피의 보물 찾기 — 판 열기·카드 뒤집기는 모두 서버가 확정한다. 창을 닫아도 진행 중인 판은 남는다. */
export async function openDelophyHuntPopup(scene: Phaser.Scene, popups: PopupLayer, onChanged: () => void): Promise<void> {
  let status: DelophyHuntStatus = await gameApi.getDelophyHunt();
  if (!scene.scene.isActive()) return;
  let busy = false, alive = true;
  const pending = new Map<string, string>();
  const motion = (): number => motionPolicy(session.settings).nonEssentialDistanceFactor;
  popups.open({ width: HUNT.width, height: HUNT.height, title: t("event.delophyHunt.title"), dim: true,
    closeOnBackdrop: true, canClose: () => !busy,
    onClose: () => { alive = false; onChanged(); },
  }, (body) => {
    const shape = popupArtShape(HUNT.width, HUNT.height);
    const mask = popupBodyShapeMask(scene, body, shape);
    paintBackdrop(scene, body, mask, motion());

    const coinText = addCurrencyChip(scene, 0, HUNT.coinY, COIN_ICON, { parent: body, width: 280, height: 66, rollKey: "delophyHunt:coins" });
    const resetText = scene.add.text(0, HUNT.resetY, "", textStyle({ role: "body", size: 21, color: INK_SOFT, align: "center", wrap: 840 })).setOrigin(0.5);
    body.add(resetText);

    // 가운데 델로피 — 두 쪽이 함께 쓰는 무대. 카드를 돌리고, 섞는 동안 더 빨리 돌린다.
    const stage = scene.add.container(0, 0);
    body.add(stage);
    const dealer = new DelophyDealer(scene, stage);

    // 첫 쪽 — 위에 안내, 가운데 델로피, 아래에 「게임 방법!」과 난이도 단추(좌우로 넘긴다).
    const introPage = scene.add.container(0, 0);
    body.add(introPage);
    introPage.add(scene.add.text(0, HUNT.intro.textY, t("delophyHunt.intro"), textStyle({ role: "emphasis", size: 27, color: INK, wrap: 780, align: "center" })).setOrigin(0.5).setStroke(OUTLINE, 6));
    const detailText = scene.add.text(0, HUNT.intro.detailY, "", textStyle({ role: "body", size: 23, color: INK, wrap: 800, align: "center" })).setOrigin(0.5).setStroke(OUTLINE, 6);
    introPage.add(detailText);
    introPage.add(scene.add.text(0, HUNT.intro.noteY, t("delophyHunt.jackpotNote"), textStyle({ role: "emphasis", size: 24, color: ACCENT, wrap: 600, align: "center" })).setOrigin(0.5).setStroke(OUTLINE, 6));
    introPage.add(addHowToButton(scene, 0, HUNT.intro.howToY, () => openDelophyHowTo(scene, popups)));

    // 난이도 단추 — 한 개만 서고 좌우로 넘기면 같은 자리에서 다음 난이도로 갈아 끼워진다(가운데 델로피가 돌리는 카드 수·속도도 함께 바뀐다).
    let pick = 1;
    let swiping = false;
    const picker = scene.add.container(0, HUNT.intro.pickerY);
    const buttons = HUNT_DIFFICULTIES.map((entry, index) => {
      const button = new RouletteSpinButton(scene, 0, 0, { width: HUNT.button.width, height: HUNT.button.height, label: "", tone: DIFFICULTY_TONE[entry.id], iconKey: COIN_ICON,
        onClick: () => {
          const pointer = scene.input.activePointer;
          if (Math.abs(pointer.upX - pointer.downX) > 36) return;
          void enterBoard(entry.id);
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
        const x = (index - 1) * 56, y = HUNT.intro.pipsY, on = index === pick;
        const rx = on ? 16 : 10, ry = on ? 22 : 14;
        pips.fillStyle(DELO.ink, 1).fillPoints(diamond(x, y, rx + 3, ry + 3), true);
        pips.fillStyle(on ? DIFFICULTY_TONE[entry.id] : 0xd9c9b8, 1).fillPoints(diamond(x, y, rx, ry), true);
      });
    };
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
      burstSparkles(scene, introPage, 0, HUNT.intro.pickerY, { count: 7, radius: 150, size: 12, colors: [0xffffff, 0xffe38a, DIFFICULTY_TONE[buttons[next].entry.id]], seed: next * 11 + 2, rise: 14 });
      audioManager?.playUi("roulette.tick");
      dealer.setDifficulty(buttons[next].entry.id);
      dealer.cheer(1);
      paintPips(); refresh();
    };
    for (const direction of [-1, 1] as const) {
      const arrow = scene.add.container(direction * HUNT.intro.arrowX, HUNT.intro.pickerY + 6);
      const g = scene.add.graphics();
      g.fillStyle(DELO.shade, 0.28).fillPoints([new Phaser.Geom.Point(-direction * 22 + 3, 0 + 8), new Phaser.Geom.Point(direction * 22 + 3, -38 + 8), new Phaser.Geom.Point(direction * 22 + 3, 38 + 8)], true);
      g.fillStyle(DELO.ink, 1).fillPoints([new Phaser.Geom.Point(-direction * 30, 0), new Phaser.Geom.Point(direction * 26, -46), new Phaser.Geom.Point(direction * 26, 46)], true);
      g.fillStyle(DELO.gold, 1).fillPoints([new Phaser.Geom.Point(-direction * 20, 0), new Phaser.Geom.Point(direction * 18, -34), new Phaser.Geom.Point(direction * 18, 34)], true);
      const zone = addClippedHit(scene, arrow, 0, 0, 110, 150, () => ({ left: 0, right: scene.scale.width, top: 0, bottom: scene.scale.height }), { useHandCursor: true });
      zone.on("pointerdown", () => pressIn(arrow));
      zone.on("pointerout", () => pressOut(arrow, "normal", { pop: false }));
      zone.on("pointerup", () => { pressOut(arrow); shift(direction); });
      arrow.addAt(g, 0);
      arrows.push(arrow);
      introPage.add(arrow);
    }
    // 단추 바깥을 쓸어도 넘어간다 — 손가락이 단추 위가 아니어도 좌우로 밀면 된다.
    const pointerDownAt = { x: 0, y: 0, armed: false };
    const onDown = (pointer: Phaser.Input.Pointer): void => {
      const area = new Phaser.Geom.Rectangle(0, 0, 0, 0);
      const bounds = buttons[pick].slot.getBounds(area);
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

    // 판 쪽 — 위에 남은 기회와 찾은 보물, 가운데 델로피, 아래에 카드.
    const playPage = scene.add.container(0, 0);
    body.add(playPage);
    const lives = scene.add.graphics();
    const phaseText = scene.add.text(0, HUNT.play.phaseY, "", textStyle({ role: "display", size: 38, color: INK, wrap: 820, align: "center" })).setOrigin(0.5).setStroke(OUTLINE, 10);
    const boardLayer = scene.add.container(0, HUNT.play.boardY);
    const collectedLabel = scene.add.text(0, HUNT.play.collectedLabelY, t("delophyHunt.collected"), textStyle({ role: "emphasis", size: 24, color: INK_SOFT })).setOrigin(0.5).setStroke(OUTLINE, 5);
    const collectedRow = scene.add.container(0, HUNT.play.collectedY);
    playPage.add([lives, phaseText, boardLayer, collectedLabel, collectedRow]);
    const note = scene.add.text(0, HUNT.height / 2 - 70, "", textStyle({ role: "body", size: 21, color: INK_SOFT, wrap: 820, align: "center" })).setOrigin(0.5);
    body.add(note);
    const cheer = dealer;

    let difficulty: HuntDifficulty | undefined;
    let views: HuntCardView[] = [];
    let interactive = false;
    const viewAt = (slot: number): HuntCardView | undefined => views.find((view) => view.slot === slot);
    const publish = (): void => managerEvents.publish("wallet", { wallet: session.wallet });

    const paintLives = (misses: number): void => {
      lives.clear();
      for (let index = 0; index < DELOPHY_HUNT.maxMisses; index += 1) {
        const x = (index - (DELOPHY_HUNT.maxMisses - 1) / 2) * 76, y = HUNT.play.livesY;
        const alive = index >= misses;
        lives.fillStyle(DELO.shade, 0.25).fillPoints([new Phaser.Geom.Point(x, y + 30), new Phaser.Geom.Point(x + 32, y + 2), new Phaser.Geom.Point(x, y - 28), new Phaser.Geom.Point(x - 32, y + 2)], true);
        lives.fillStyle(alive ? 0xd8334f : 0xc9bfb4, 1).fillPoints([new Phaser.Geom.Point(x, y + 24), new Phaser.Geom.Point(x + 28, y), new Phaser.Geom.Point(x, y - 26), new Phaser.Geom.Point(x - 28, y)], true);
        if (alive) drawSparkle(lives, x, y - 2, 10, 0xffffff, 0.9);
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

    /** 카드의 가로를 접었다 펴며 앞·뒤를 갈아 끼운다(스스로 도는 착시). */
    const turn = async (view: HuntCardView, up: boolean, found = false): Promise<void> => {
      if (!difficulty) return;
      const { width, height } = huntCardSize(difficulty);
      const duration = 110;
      scene.tweens.add({ targets: view.holder, scaleX: 0.02, duration, ease: "Quad.In" });
      await waitFx(scene, duration);
      if (!view.holder.active) return;
      if (up) paintFace(scene, view.holder, view.treasure, width, height, found); else paintBack(scene, view.holder, width, height);
      view.up = up; view.found = found;
      scene.tweens.add({ targets: view.holder, scaleX: 1, duration, ease: "Quad.Out" });
      await waitFx(scene, duration);
    };
    const turnAll = async (up: boolean): Promise<void> => {
      const stagger = views.map((view, index) => waitFx(scene, index * 45).then(() => turn(view, up)));
      await Promise.all(stagger);
    };

    /** 섞는 움직임 하나 — 두 장이 자리를 바꾼다. 곡선은 한 장이 위로, 뒤로 들어가기는 값진 장이 낮고 작게 다른 카드 뒤를 지난다. */
    const animateMove = (move: HuntMove): Promise<void> => {
      const diff = difficulty!;
      const swaps = move.swaps.map(([a, b]) => ({ first: viewAt(a)!, second: viewAt(b)! }));
      const jobs = swaps.map(({ first, second }) => new Promise<void>((resolve) => {
        const startA = huntSlotPosition(diff, first.slot), startB = huntSlotPosition(diff, second.slot);
        const heatA = huntHeat(first.treasure.tier), heatB = huntHeat(second.treasure.tier);
        const low = heatA >= heatB ? first : second, high = low === first ? second : first;
        const amp = move.style === "slide" ? 0 : move.style === "arc" ? huntCardSize(diff).height * 0.34 : huntCardSize(diff).height * 0.5;
        const dx = startB.x - startA.x, dy = startB.y - startA.y;
        const length = Math.hypot(dx, dy) || 1;
        const nx = -dy / length, ny = dx / length;
        if (move.style === "dive") { boardLayer.sendToBack(low.holder); boardLayer.bringToTop(high.holder); } else { boardLayer.bringToTop(first.holder); }
        const slots: [number, number] = [first.slot, second.slot];
        scene.tweens.addCounter({
          from: 0, to: 1, duration: move.ms, ease: "Sine.InOut",
          onUpdate: (counter) => {
            const t01 = counter.getValue() ?? 0;
            const swing = Math.sin(Math.PI * t01);
            first.holder.setPosition(startA.x + dx * t01 + nx * amp * swing, startA.y + dy * t01 + ny * amp * swing);
            second.holder.setPosition(startB.x - dx * t01 - nx * amp * swing, startB.y - dy * t01 - ny * amp * swing);
            if (move.style === "dive") { low.holder.setScale(1 - 0.28 * swing); high.holder.setScale(1 + 0.1 * swing); }
            else if (move.style === "arc") { first.holder.setScale(1 + 0.08 * swing); second.holder.setScale(1 - 0.06 * swing); }
          },
          onComplete: () => {
            first.slot = slots[1]; second.slot = slots[0];
            first.holder.setPosition(startB.x, startB.y).setScale(1);
            second.holder.setPosition(startA.x, startA.y).setScale(1);
            resolve();
          },
        });
      }));
      return Promise.all(jobs).then(() => undefined);
    };

    const buildBoard = (layout: readonly string[], faceUp: boolean): void => {
      boardLayer.removeAll(true);
      views = [];
      const diff = difficulty!;
      const { width, height } = huntCardSize(diff);
      layout.forEach((id, slot) => {
        const treasure = huntTreasure(id);
        if (!treasure) return;
        const { x, y } = huntSlotPosition(diff, slot);
        const holder = scene.add.container(x, y);
        if (faceUp) paintFace(scene, holder, treasure, width, height, false); else paintBack(scene, holder, width, height);
        boardLayer.add(holder);
        views.push({ holder, treasure, slot, up: faceUp, found: false });
      });
      // 입력면은 판에 따로 세운다 — 카드는 섞이며 움직이므로 슬롯 자리에 고정해 둔다.
      layout.forEach((_, slot) => {
        const { x, y } = huntSlotPosition(diff, slot);
        const hit = addClippedHit(scene, boardLayer, x, y, width, height, () => ({ left: 0, right: scene.scale.width, top: 0, bottom: scene.scale.height }), { useHandCursor: true });
        hit.on("pointerup", () => void flipSlot(slot));
      });
    };

    const refresh = (): void => {
      coinText.setText(status.coins.toLocaleString());
      resetText.setText(t("delophyHunt.reset", { date: new Date(status.resetsAt).toLocaleString(undefined, { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) }));
      const running = status.run !== null;
      introPage.setVisible(!running); playPage.setVisible(running);
      const current = buttons[pick].entry;
      detailText.setText(`${t("delophyHunt.detail", { pairs: current.pairs, misses: DELOPHY_HUNT.maxMisses })} · ${t(HINT_KEY[current.id])}`);
      buttons.forEach(({ entry, button }, index) => {
        button.setLabel(t("delophyHunt.enter", { name: t(DIFFICULTY_KEY[entry.id]), count: entry.entryCost }));
        button.setEnabled(index === pick && !busy && !running && status.coins >= entry.entryCost);
      });
      arrows.forEach((arrow, index) => arrow.setAlpha((index === 0 ? pick > 0 : pick < buttons.length - 1) && !busy ? 1 : 0.3));
    };

    const request = async (key: string, call: (requestId: string) => Promise<DelophyHuntResponse>): Promise<DelophyHuntResponse | undefined> => {
      try {
        if (!pending.has(key)) pending.set(key, crypto.randomUUID());
        const result = await call(pending.get(key)!);
        pending.delete(key);
        return result;
      } catch (error) {
        logError("delophyHunt.request", "델로피의 보물 찾기 요청 실패", error);
        if (alive) note.setText(t("delophyHunt.error"));
        return undefined;
      }
    };

    async function enterBoard(id: HuntDifficultyId): Promise<void> {
      if (busy) return;
      const picked = huntDifficulty(id);
      if (!picked) return;
      busy = true; refresh();
      const result = await request(`enter-${id}`, (requestId) => gameApi.enterDelophyHunt({ requestId, difficulty: id }));
      if (!result?.show) { busy = false; if (alive) refresh(); return; }
      status = result.status;
      if (!alive) { busy = false; return; }
      note.setText("");
      difficulty = picked;
      interactive = false;
      audioManager?.playUi("roulette.tick");
      paintLives(0); paintCollected({});
      buildBoard(result.show.layout, false);
      refresh();
      // 보여 주기 → 엎기 → 섞기 → 찾기. 이 흐름이 도는 동안 창은 닫히지 않는다(busy).
      phaseText.setText(t("delophyHunt.phase.memorize"));
      await turnAll(true);
      await waitFx(scene, picked.memorizeMs);
      if (!alive) { busy = false; return; }
      await turnAll(false);
      await waitFx(scene, 260);
      phaseText.setText(t("delophyHunt.phase.shuffle"));
      dealer.setDifficulty(id); dealer.setShuffling(true);
      for (const move of result.show.moves) {
        if (!alive) { busy = false; return; }
        await animateMove(move);
        await waitFx(scene, 70);
      }
      await waitFx(scene, 180);
      dealer.setShuffling(false);
      phaseText.setText(t("delophyHunt.phase.find"));
      interactive = true;
      busy = false;
      refresh();
    }

    /** 다 끝난 뒤 — 받은 몫을 알리고 첫 쪽으로 돌아간다. 아무것도 못 찾았으면 델로피가 움찔하고 끝난다. */
    async function finish(total: Partial<Record<ChestCardCurrency, number>>, cleared: boolean): Promise<void> {
      interactive = false;
      phaseText.setText(t(cleared ? "delophyHunt.cleared" : "delophyHunt.out"));
      if (cleared) cheer.cheer(3); else cheer.flinch();
      await waitFx(scene, 900);
      if (!alive) return;
      const items = currencyRecordToRewardItems(total);
      if (items.length) await new Promise<void>((resolve) => openRewardPopup(scene, popups, { title: t("delophyHunt.reward"), titleSize: 36, dimAlpha: 0.66, items, onConfirm: resolve }));
    }

    async function flipSlot(slot: number): Promise<void> {
      if (busy || !interactive || !difficulty) return;
      const view = viewAt(slot);
      if (!view || view.up) return;
      busy = true;
      const result = await request(`flip-${status.run?.misses ?? 0}-${status.run?.found.length ?? 0}-${slot}`, (requestId) => gameApi.flipDelophyCard({ requestId, slot }));
      if (!result?.flip) { busy = false; if (alive) refresh(); return; }
      const flip = result.flip;
      if (!alive) { status = result.status; busy = false; return; }
      if (flip.id !== view.treasure.id) view.treasure = huntTreasure(flip.id) ?? view.treasure;
      await turn(view, true);
      if (flip.step === "first") { status = result.status; busy = false; refresh(); return; }
      const other = viewAt(flip.firstSlot ?? -1);
      const { width } = huntCardSize(difficulty);
      if (flip.step === "match") {
        publish();
        if (other) { other.found = true; paintFace(scene, other.holder, other.treasure, huntCardSize(difficulty).width, huntCardSize(difficulty).height, true); }
        view.found = true; paintFace(scene, view.holder, view.treasure, width, huntCardSize(difficulty).height, true);
        for (const matched of [view, other]) if (matched) burstSparkles(scene, boardLayer, matched.holder.x, matched.holder.y, { count: 8, radius: 90, size: 14, colors: [0xffffff, 0xffe38a, 0xe9d4ff], seed: matched.slot + 5, rise: 20 });
        cheer.cheer(view.treasure.tier === "jackpot" ? 3 : 1);
        const collected = { ...(status.run?.collected ?? {}) } as Partial<Record<ChestCardCurrency, number>>;
        if (flip.granted && flip.granted.amount > 0) collected[flip.granted.currency as ChestCardCurrency] = (collected[flip.granted.currency as ChestCardCurrency] ?? 0) + flip.granted.amount;
        paintCollected(flip.total ?? result.status.run?.collected ?? collected, flip.granted?.currency as ChestCardCurrency | undefined);
        await waitFx(scene, 520);
      } else {
        cheer.flinch();
        phaseText.setText(t("delophyHunt.miss"));
        paintLives(flip.misses);
        await waitFx(scene, 900);
        if (alive) { await Promise.all([turn(view, false), other ? turn(other, false) : Promise.resolve()]); phaseText.setText(t("delophyHunt.phase.find")); }
      }
      status = result.status;
      if (flip.finished) { await finish(flip.total ?? {}, flip.cleared); busy = false; if (alive) refresh(); return; }
      busy = false;
      refresh();
    }

    refresh();
    // 닫았다 다시 연 판 — 섞는 길은 다시 보여 주지 않는다(한 번 본 것을 되돌려 보는 길을 막는다). 맞춘 카드와 틀린 횟수만 이어 선다.
    const run = status.run;
    if (run) {
      const picked = huntDifficulty(run.difficulty);
      if (picked) {
        difficulty = picked;
        dealer.setDifficulty(picked.id);
        const layout = run.pairs.flatMap((id) => [id, id]);
        buildBoard(layout, false);
        // 정답 슬롯을 모르므로 맞춘 슬롯에 보물을 입히고, 나머지는 엎어 둔다.
        run.found.forEach(({ slot, id }) => {
          const view = views[slot];
          const treasure = huntTreasure(id);
          if (!view || !treasure) return;
          view.treasure = treasure; view.slot = slot; view.up = true; view.found = true;
          const { width, height } = huntCardSize(picked);
          paintFace(scene, view.holder, treasure, width, height, true);
        });
        if (run.first) {
          const view = views[run.first.slot];
          const treasure = huntTreasure(run.first.id);
          if (view && treasure) { view.treasure = treasure; view.up = true; paintFace(scene, view.holder, treasure, huntCardSize(picked).width, huntCardSize(picked).height, false); }
        }
        paintLives(run.misses); paintCollected(run.collected);
        phaseText.setText(t("delophyHunt.phase.find"));
        interactive = true;
      }
    }
  });
}

/**
 * 「게임 방법!」 — 난이도 단추 위에 앉는 작은 말풍선 단추. 눌러야 하는 조작이 아니라 궁금할 때 여는 안내라 단추보다 한참 가볍다.
 */
function addHowToButton(scene: Phaser.Scene, x: number, y: number, onClick: () => void): Phaser.GameObjects.Container {
  const root = scene.add.container(x, y);
  const label = scene.add.text(0, 0, t("delophyHunt.howTo.button"), textStyle({ role: "emphasis", size: 26, color: INK })).setOrigin(0, 0.5);
  shrinkTextToWidth(label, 300);
  const height = 56, badge = 20, pad = 18;
  const width = pad + badge * 2 + 10 + label.displayWidth + pad;
  const g = scene.add.graphics();
  g.fillStyle(DELO.shade, 0.22).fillRoundedRect(-width / 2 + 3, -height / 2 + 6, width, height, height / 2);
  g.fillStyle(DELO.ink, 1).fillRoundedRect(-width / 2 - 3, -height / 2 - 3, width + 6, height + 6, height / 2 + 3);
  g.fillStyle(DELO.cream, 1).fillRoundedRect(-width / 2, -height / 2, width, height, height / 2);
  const bx = -width / 2 + pad + badge;
  g.fillStyle(DELO.crimson, 1).fillPoints(diamond(bx, 0, badge, badge * 1.2), true);
  const mark = scene.add.text(bx, 1, "?", textStyle({ role: "display", size: 28, color: "#ffffff" })).setOrigin(0.5);
  label.setX(bx + badge + 10);
  const sparkle = scene.add.graphics();
  drawSparkle(sparkle, width / 2 - 2, -height / 2 + 4, 13, DELO.gold);
  root.add([g, mark, label, sparkle]);
  const hit = addClippedHit(scene, root, 0, 0, width + 20, height + 20, () => ({ left: 0, right: scene.scale.width, top: 0, bottom: scene.scale.height }), { useHandCursor: true });
  hit.on("pointerdown", () => pressIn(root));
  hit.on("pointerout", () => pressOut(root, "normal", { pop: false }));
  hit.on("pointerup", () => { pressOut(root); onClick(); });
  if (chestFxMotion().loops) scene.tweens.add({ targets: sparkle, alpha: { from: 1, to: 0.25 }, duration: 700, yoyo: true, repeat: -1, ease: "Sine.InOut" });
  return root;
}

/** 게임 방법 쪽지 — 델로피가 말풍선으로 직접 들려준다. 판 높이는 말풍선 글을 먼저 재서 거꾸로 구한다. */
export function openDelophyHowTo(scene: Phaser.Scene, popups: PopupLayer): void {
  const { width, bubbleWidth, wrap, lineGap, sd } = HUNT.howTo;
  const keys: TextKey[] = ["delophyHunt.howTo.1", "delophyHunt.howTo.2", "delophyHunt.howTo.3", "delophyHunt.howTo.4"];
  const lines = keys.map((key) => scene.add.text(0, 0, t(key), textStyle({ role: "body", size: 27, color: INK, wrap, lineSpacing: 6 })).setOrigin(0, 0));
  const textHeight = lines.reduce((sum, line) => sum + line.height, 0) + lineGap * (lines.length - 1);
  const bubblePad = 40, tail = 46, top = 70;
  const bubbleHeight = textHeight + bubblePad * 2;
  const height = top + bubbleHeight + tail + sd.height + 30;
  popups.open({ width, height, title: t("delophyHunt.howTo.title"), dim: true, dimAlpha: 0.35, closeOnBackdrop: true, closeOnBody: true }, (body) => {
    const shape = popupArtShape(width, height);
    const mask = popupBodyShapeMask(scene, body, shape);
    addEventPopupBackdrop(scene, body, BACKGROUND.eventDelopiPopup, width, height);
    void mask;
    const upper = -height / 2;
    const bx = -bubbleWidth / 2, by = upper + top;
    const tailX = sd.x + 70, tailBase = by + bubbleHeight;
    const bubble = scene.add.graphics();
    bubble.fillStyle(DELO.shade, 0.22).fillRoundedRect(bx + 6, by + 10, bubbleWidth, bubbleHeight, 34);
    bubble.fillStyle(DELO.ink, 1).fillRoundedRect(bx - 4, by - 4, bubbleWidth + 8, bubbleHeight + 8, 38);
    bubble.fillTriangle(tailX - 34, tailBase - 6, tailX + 30, tailBase - 6, tailX - 18, tailBase + tail + 4);
    bubble.fillStyle(DELO.cream, 1).fillRoundedRect(bx, by, bubbleWidth, bubbleHeight, 34);
    bubble.fillTriangle(tailX - 28, tailBase - 8, tailX + 24, tailBase - 8, tailX - 16, tailBase + tail - 4);
    const marks = scene.add.graphics();
    body.add([bubble, marks]);
    let y = by + bubblePad;
    const textX = bx + 84;
    lines.forEach((line, index) => {
      line.setPosition(textX, y);
      body.add(line);
      const cy = y + 18;
      marks.fillStyle(DELO.ink, 1).fillPoints(diamond(textX - 38, cy, 22, 26), true);
      marks.fillStyle(index === 3 ? DELO.goldDeep : DELO.crimson, 1).fillPoints(diamond(textX - 38, cy, 18, 22), true);
      body.add(scene.add.text(textX - 38, cy + 1, String(index + 1), textStyle({ role: "display", size: 22, color: "#ffffff" })).setOrigin(0.5));
      y += line.height + lineGap;
    });
    drawSparkle(marks, bx + bubbleWidth - 18, by + 8, 20, DELO.gold);
    drawSparkle(marks, bx + 14, by + bubbleHeight - 10, 14, 0xffffff);
    // 델로피 — 말풍선 아래에서 카드를 돌리며 설명한다.
    const groundY = height / 2 - 30;
    const stage = scene.add.container(sd.x - sd.x, 0);
    body.add(stage);
    const dealer = new DelophyDealer(scene, stage, { x: sd.x + 200, groundY, height: sd.height, orbitRx: 180, orbitRy: 44, orbitCardWidth: 70 });
    void dealer;
  });
}
