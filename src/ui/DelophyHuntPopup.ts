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
import { textStyle } from "./theme";

/**
 * 델로피의 보물 찾기 창의 자리. 두 쪽이다.
 * - **첫 쪽**: 판이 없을 때. 코인 → 안내 → 난이도 셋(코인 값·쌍 수·섞이는 정도) → 대박 안내. 델로피가 곁에서 구경한다.
 * - **판 쪽**: 남은 기회 → 안내 줄(기억·섞는 중·찾기) → 카드 두 줄 → 찾은 보물. 카드는 앞면으로 펼쳐졌다가 엎어지고
 *   섞이며, 같은 그림 두 장을 차례로 뒤집어 짝을 맞춘다. 세 번 틀리면 끝난다.
 * 섞이는 길은 서버가 판을 열 때 정해 그대로 보낸다 — 화면은 그 길을 그리기만 하고 정답은 알지 못한다.
 */
const HUNT = {
  width: 940,
  height: 1500,
  coinY: -660,
  resetY: -616,
  intro: { textY: -520, listY: -170, rowGap: 214, noteY: 400, sd: { x: 322, groundY: 590, height: 330 } },
  play: { livesY: -540, phaseY: -450, boardY: -70, collectedLabelY: 330, collectedY: 410, sd: { x: 322, groundY: 640, height: 270 }, areaWidth: 860 },
  button: { width: 720, height: 112 },
} as const;

/** 보물 찾기 전용 이벤트 코인 그림(`currencyIcons`). 코인은 지갑이 아니라 이번 주에 쓴 스테미나에서 나온다. */
const COIN_ICON = "currency-delopi-thief-coin";
/** 창 안에서 판 곁을 지키는 SD — 로비 이벤트 카드와 같은 개체다(`lobbyEvents`의 `delophy-hunt`). */
const HUNT_SD = "delophy";

/** 델로피 SD의 결 — 보랏빛 밤하늘, 연보라 안개, 카드 마술사의 금빛 장식. 글은 깊은 자두빛, 강조는 선명한 보라다. */
const INK = "#2f1f52";
const INK_SOFT = "#6f5a96";
const ACCENT = "#7a4fd0";
const OUTLINE = "#ffffff";
const DELO = { top: 0xf3ecfc, bottom: 0xc9b6ee, mist: 0xe3d6f7, deep: 0x4a2f7a, plum: 0x2f1f52, violet: 0x7a4fd0, gold: 0xffd55e } as const;

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
  const width = Math.min(230, Math.floor((HUNT.play.areaWidth - gap * (columns - 1)) / columns));
  return { width, height: Math.round(width * 1.42), gap };
}
/** 슬롯 `slot`이 서는 자리(판 가운데 기준). 카드는 두 줄로 깔린다. */
export function huntSlotPosition(difficulty: HuntDifficulty, slot: number): { x: number; y: number } {
  const columns = huntBoardColumns(difficulty);
  const { width, height, gap } = huntCardSize(difficulty);
  const column = slot % columns, row = Math.floor(slot / columns);
  return { x: (column - (columns - 1) / 2) * (width + gap), y: (row - 0.5) * (height + gap) };
}

/** 델로피의 보랏빛 바탕. 장식은 가장자리에만 둔다. */
function paintBackdrop(scene: Phaser.Scene, body: Phaser.GameObjects.Container, mask: Phaser.Display.Masks.GeometryMask, motion: number): void {
  addEventPopupBackdrop(scene, body, BACKGROUND.eventDelopiPopup, HUNT.width, HUNT.height);
  const coins: readonly [number, number, number][] = [[-400, -360, -12], [400, -100, 12], [-400, 300, 8]];
  coins.forEach(([x, y, angle], index) => {
    const coin = scene.add.image(x, y, COIN_ICON).setDisplaySize(64, 64).setAngle(angle).setAlpha(0.4).setMask(mask);
    body.add(coin);
    if (motion > 0) scene.tweens.add({ targets: coin, y: y - 10 * motion, duration: 1700 + index * 230, yoyo: true, repeat: -1, ease: "Sine.InOut" });
  });
}

/** 카드의 뒷면 — 보랏빛 판에 흰 테, 가운데 마름모와 반짝이. 모든 카드가 같아야 정체가 드러나지 않는다. */
function paintBack(scene: Phaser.Scene, holder: Phaser.GameObjects.Container, width: number, height: number): void {
  holder.removeAll(true);
  const g = scene.add.graphics();
  const left = -width / 2, top = -height / 2, radius = 10, inset = 11;
  g.fillStyle(DELO.plum, 0.24).fillRoundedRect(left + 5, top + 10, width, height, radius);
  g.fillStyle(DELO.deep, 1).fillRoundedRect(left - 3, top - 3, width + 6, height + 6, radius + 2);
  g.fillStyle(0xffffff, 1).fillRoundedRect(left, top, width, height, radius);
  g.fillStyle(DELO.violet, 1).fillRect(left + inset, top + inset, width - inset * 2, height - inset * 2);
  g.lineStyle(3, 0xe9d4ff, 1).strokeRect(left + inset + 9, top + inset + 9, width - inset * 2 - 18, height - inset * 2 - 18);
  const rx = width / 2 - inset - 26, ry = height / 2 - inset - 40;
  g.fillStyle(0xb394ee, 1).fillPoints([new Phaser.Geom.Point(0, -ry), new Phaser.Geom.Point(rx, 0), new Phaser.Geom.Point(0, ry), new Phaser.Geom.Point(-rx, 0)], true);
  g.fillStyle(DELO.deep, 1).fillPoints([new Phaser.Geom.Point(0, -ry * 0.62), new Phaser.Geom.Point(rx * 0.62, 0), new Phaser.Geom.Point(0, ry * 0.62), new Phaser.Geom.Point(-rx * 0.62, 0)], true);
  drawSparkle(g, 0, 0, Math.min(width, height) * 0.2, DELO.gold, 1);
  holder.add(g);
}

/** 카드의 앞면 — 등급 색 테, 보물 액자(수량), 모서리의 작은 마름모. 맞춘 카드(`found`)는 금빛으로 반짝인다. */
function paintFace(scene: Phaser.Scene, holder: Phaser.GameObjects.Container, treasure: HuntTreasure, width: number, height: number, found: boolean): void {
  holder.removeAll(true);
  const tone = TIER_TONE[treasure.tier];
  const g = scene.add.graphics();
  const left = -width / 2, top = -height / 2, radius = 10, inset = 11;
  g.fillStyle(DELO.plum, 0.24).fillRoundedRect(left + 5, top + 10, width, height, radius);
  g.fillStyle(found ? DELO.gold : tone.deep, 1).fillRoundedRect(left - 3, top - 3, width + 6, height + 6, radius + 2);
  g.fillStyle(0xffffff, 1).fillRoundedRect(left, top, width, height, radius);
  g.fillStyle(tone.face, found ? 0.55 : 0.34).fillRect(left + inset, top + inset, width - inset * 2, height - inset * 2);
  g.lineStyle(3, tone.deep, 1).strokeRect(left + inset, top + inset, width - inset * 2, height - inset * 2);
  const rx = width / 2 - inset - 14, ry = height / 2 - inset - 60;
  g.fillStyle(tone.face, 0.8).fillPoints([new Phaser.Geom.Point(0, -ry), new Phaser.Geom.Point(rx, -8), new Phaser.Geom.Point(0, ry), new Phaser.Geom.Point(-rx, -8)], true);
  // 모서리 표시 — 값진 보물일수록 마름모가 많다(어렵게 섞이는 정도를 카드가 미리 알려 준다).
  const heat = huntHeat(treasure.tier);
  for (let index = 0; index < heat; index += 1) {
    const px = left + inset + 14 + index * 16, py = top + inset + 16, half = 6;
    g.fillStyle(tone.deep, 1).fillPoints([new Phaser.Geom.Point(px, py - half * 1.3), new Phaser.Geom.Point(px + half, py), new Phaser.Geom.Point(px, py + half * 1.3), new Phaser.Geom.Point(px - half, py)], true);
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

/** 판 곁의 델로피 — 통통 뛰며 구경하고, 짝을 맞추면 크게 폴짝 뛰며 반짝이를 터뜨린다. */
class DelophyCheerleader {
  private puppet?: PuppetCreature;
  private idle?: Phaser.Tweens.Tween;
  constructor(private readonly scene: Phaser.Scene, private readonly parent: Phaser.GameObjects.Container, private readonly spot: { x: number; groundY: number; height: number }) {
    void addHuntSd(scene, parent, spot, true).then((puppet) => {
      this.puppet = puppet;
      if (puppet && chestFxMotion().loops) this.idle = startPuppetHop(scene, puppet, 0);
    });
  }
  cheer(times = 1): void {
    const { scene, puppet, spot } = this;
    if (!puppet?.active) return;
    this.idle?.pause();
    scene.tweens.killTweensOf(puppet);
    puppet.setY(spot.groundY);
    const rise = 62 * chestFxMotion().distance;
    burstSparkles(scene, this.parent, spot.x, spot.groundY - spot.height * 0.95, { count: 7 + times * 2, radius: 70, size: 13, colors: [0xffffff, 0xe9d4ff, 0xffe38a, 0xffd9f0], seed: times * 17 + 3, rise: 30 });
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

    const coinIcon = scene.add.image(0, HUNT.coinY, COIN_ICON).setDisplaySize(52, 52);
    const coinText = scene.add.text(0, HUNT.coinY, "", textStyle({ role: "display", size: 38, color: ACCENT })).setOrigin(0, 0.5).setStroke(OUTLINE, 8);
    const resetText = scene.add.text(0, HUNT.resetY, "", textStyle({ role: "body", size: 21, color: INK_SOFT, align: "center", wrap: 840 })).setOrigin(0.5);
    body.add([coinIcon, coinText, resetText]);

    // 첫 쪽 — 난이도 셋.
    const introPage = scene.add.container(0, 0);
    body.add(introPage);
    introPage.add(scene.add.text(0, HUNT.intro.textY, t("delophyHunt.intro"), textStyle({ role: "emphasis", size: 27, color: INK, wrap: 780, align: "center" })).setOrigin(0.5));
    const buttons = new Map<HuntDifficultyId, RouletteSpinButton>();
    HUNT_DIFFICULTIES.forEach((difficulty, index) => {
      const y = HUNT.intro.listY + (index - 1) * HUNT.intro.rowGap;
      const button = new RouletteSpinButton(scene, 0, y, { width: HUNT.button.width, height: HUNT.button.height, label: "", tone: DIFFICULTY_TONE[difficulty.id], iconKey: COIN_ICON, onClick: () => void enterBoard(difficulty.id) });
      buttons.set(difficulty.id, button);
      introPage.add(button);
      introPage.add(scene.add.text(0, y + HUNT.button.height / 2 + 34, `${t("delophyHunt.detail", { pairs: difficulty.pairs, misses: DELOPHY_HUNT.maxMisses })} · ${t(HINT_KEY[difficulty.id])}`,
        textStyle({ role: "body", size: 23, color: INK, wrap: 800, align: "center" })).setOrigin(0.5).setStroke(OUTLINE, 6));
    });
    introPage.add(scene.add.text(0, HUNT.intro.noteY, t("delophyHunt.jackpotNote"), textStyle({ role: "emphasis", size: 24, color: ACCENT, wrap: 820, align: "center" })).setOrigin(0.5).setStroke(OUTLINE, 6));
    new DelophyCheerleader(scene, introPage, HUNT.intro.sd);

    // 판 쪽.
    const playPage = scene.add.container(0, 0);
    body.add(playPage);
    const lives = scene.add.graphics();
    const phaseText = scene.add.text(0, HUNT.play.phaseY, "", textStyle({ role: "display", size: 38, color: INK, wrap: 820, align: "center" })).setOrigin(0.5).setStroke(OUTLINE, 10);
    const boardLayer = scene.add.container(0, HUNT.play.boardY);
    const collectedLabel = scene.add.text(0, HUNT.play.collectedLabelY, t("delophyHunt.collected"), textStyle({ role: "emphasis", size: 24, color: INK_SOFT })).setOrigin(0.5);
    const collectedRow = scene.add.container(0, HUNT.play.collectedY);
    playPage.add([lives, phaseText, boardLayer, collectedLabel, collectedRow]);
    const note = scene.add.text(0, HUNT.height / 2 - 70, "", textStyle({ role: "body", size: 21, color: INK_SOFT, wrap: 820, align: "center" })).setOrigin(0.5);
    body.add(note);
    const cheer = new DelophyCheerleader(scene, playPage, HUNT.play.sd);

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
        lives.fillStyle(DELO.plum, 0.25).fillPoints([new Phaser.Geom.Point(x, y + 30), new Phaser.Geom.Point(x + 32, y + 2), new Phaser.Geom.Point(x, y - 28), new Phaser.Geom.Point(x - 32, y + 2)], true);
        lives.fillStyle(alive ? 0xff7fb0 : 0xc9c2d6, 1).fillPoints([new Phaser.Geom.Point(x, y + 24), new Phaser.Geom.Point(x + 28, y), new Phaser.Geom.Point(x, y - 26), new Phaser.Geom.Point(x - 28, y)], true);
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
      coinText.setText(t("delophyHunt.coins", { count: status.coins.toLocaleString() }));
      const total = 52 + 12 + coinText.width;
      coinIcon.setX(-total / 2 + 26); coinText.setX(-total / 2 + 64);
      resetText.setText(t("delophyHunt.reset", { date: new Date(status.resetsAt).toLocaleString(undefined, { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) }));
      const running = status.run !== null;
      introPage.setVisible(!running); playPage.setVisible(running);
      for (const entry of HUNT_DIFFICULTIES) {
        const button = buttons.get(entry.id)!;
        button.setLabel(t("delophyHunt.enter", { name: t(DIFFICULTY_KEY[entry.id]), count: entry.entryCost }));
        button.setEnabled(!busy && !running && status.coins >= entry.entryCost);
      }
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
      for (const move of result.show.moves) {
        if (!alive) { busy = false; return; }
        await animateMove(move);
        await waitFx(scene, 70);
      }
      await waitFx(scene, 180);
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
