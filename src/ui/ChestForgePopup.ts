import Phaser from "phaser";
import { openEventCoinGuide } from "./eventCoinGuide";
import { t } from "../i18n";
import type { TextKey } from "../i18n";
import { gameApi } from "../api/FakeServer";
import type { ChestForgeResponse } from "../api/contracts";
import { formatCurrency } from "../core/formatCurrency";
import {
  CHEST_BOXES, CHEST_CARDS, CHEST_FORGE, CHEST_GRADE_MAX, CHEST_GRADE_THRESHOLDS, chestCard, chestCardFlair, chestCollectedValue, chestRunBox,
  type ChestBox, type ChestBoxId, type ChestCard, type ChestCardCurrency, type ChestCardTier, type ChestForgeRun, type ChestForgeStatus,
} from "../core/chestForge";
import { motionPolicy } from "../core/settings";
import { audioManager } from "../managers/AudioManager";
import { logError } from "../managers/ErrorReporter";
import { managerEvents } from "../managers/ManagerEvents";
import { session } from "../state/session";
import { ChestStage, burstSparkles, chargeCard, chestFxMotion, flipCard, flyCardToChest, shatterCard, stampCard, waitFx } from "./chestForgeFx";
import { addClippedHit } from "./clippedHit";
import { addCurrencyChip } from "./CurrencyChip";
import { pressIn, pressOut } from "./pressFeedback";
import { CURRENCY_ICON_BY_WALLET } from "./currencyIcons";
import { addFramedIcon } from "./itemFrame";
import { playMotion, sdAssetFor, spawnPuppet, type PuppetCreature } from "../puppets/assets";
import { startPuppetHop } from "./puppetHop";
import { addSdFootShadow } from "./SdFootShadow";
import { popupArtShape, popupBodyShapeMask } from "./popupArt";
import type { PopupLayer } from "./PopupLayer";
import { openRewardPopup } from "./RewardPopup";
import { currencyRecordToRewardItems } from "./rewardPopupModel";
import { ResearchPullButton } from "./ResearchPullButton";
import { drawSparkle } from "./rouletteWheel";
import { BACKGROUND } from "./backgroundAssets";
import { addEventPopupBackdrop } from "./eventBackdrop";
import { shrinkTextToWidth } from "./textFit";
import { textStyle } from "./theme";

/**
 * 보물상자 창의 자리. 두 쪽이다.
 * - **첫 쪽**: 상자가 없을 때. 코인 → 안내 → 상자 → 대박 카드 미리보기 → 상자 열기 버튼 하나.
 * - **카드 쪽**: 상자를 연 뒤. 몇 번째 선택인지 → 모은 보상 → 상자와 그 곁의 티아 → 앞면으로 놓인 카드 3~4장 → 안내.
 *   카드는 아래에서 집어 위의 상자에 넣고, 모은 보상은 맨 위에서 쌓인다.
 * 카드마다 받을 확률이 앞면에 적혀 있고, 카드가 나오는 확률은 아래 안내 줄이 말한다.
 */
const FORGE = {
  width: 940,
  height: 1540,
  coinY: -684,
  intro: { textY: -560, chestY: -250, chestScale: 0.82, previewY: 140, buttonY: 520, howToY: 334, sd: { x: 286, groundY: -112, height: 330 } },
  /**
   * 카드 쪽 — 위에 모은 보상, 가운데 상자와 그 곁에서 응원하는 티아, 아래에 카드. 아래에서 집은 카드가 위의 상자로 날아
   * 들어간다. 상자 아래 게이지가 다음 등급까지 얼마 남았는지 말한다(상자 몸 밑변은 `chestY` + 130).
   */
  pick: { roundY: -578, collectedLabelY: -478, collectedY: -410, chestY: -176, chestScale: 0.8, gaugeY: 158, sd: { x: 286, groundY: -40, height: 330 },
    hintY: 70, cardsY: 322,
    /** 다 고른 뒤 상자가 올라서는 자리와 커지는 배율. */
    openY: -200, openGrow: 1.3 },
  rulesY: 640,
  card: { width: 196, height: 300, gap: 18, icon: 112 },
  preview: { width: 200, height: 300, gap: 14 },
  collected: { size: 84, gap: 104 },
  /** 상자 세 개(100·200·300 코인) — 나란히 선 연구 버튼, 위에 보상 배율 한 줄. */
  button: { height: 136, width: 272, gap: 18, captionY: -100 },
  /** 상단 이벤트 코인 칸 — 상단 재화 줄과 같은 `addCurrencyChip` 한 칸이다. */
  coinChip: { width: 260, height: 66 },
  howTo: { width: 820, bubbleWidth: 720, wrap: 600, lineGap: 22, sd: { x: -250, height: 300 } },
} as const;

/** 보물상자 전용 이벤트 코인 그림(`currencyIcons`). 코인은 지갑이 아니라 이번 주에 쓴 스테미나에서 나온다. */
const CHEST_COIN_ICON = "currency-treasure-chest-coin";
/** 창 안에서 상자 곁을 지키는 SD — 로비 이벤트 카드와 같은 개체다(`lobbyEvents`의 `chest-forge`). */
/** 반짝이는 것을 주워 와 「보급품」이라 우기는 티아 — 보물을 모으는 상자 이벤트의 얼굴이다. */
const CHEST_FORGE_SD = "tia";

/**
 * 티아 SD의 결 — 은빛 하늘색 머리, 남색 옷, 무지갯빛 베일, 물가. 글은 깊은 남색, 강조는 바닷빛 파랑이다.
 */
const INK = "#22344f";
const INK_SOFT = "#5b7290";
const ACCENT = "#2f6fb4";
const OUTLINE = "#ffffff";
const TIA = { sky: 0xeaf4fb, mist: 0xd9e6f6, lilac: 0xd8d4f2, navy: 0x22344f, deep: 0x324c70, veil: [0xffd9ec, 0xd6f5ec, 0xdcd6ff] } as const;

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

/** 티아의 물빛 베일·은색 별 바탕. 장식은 가장자리에만 둔다. */
function paintBackdrop(scene: Phaser.Scene, body: Phaser.GameObjects.Container, mask: Phaser.Display.Masks.GeometryMask, motion: number): void {
  addEventPopupBackdrop(scene, body, BACKGROUND.eventTiaPopup, FORGE.width, FORGE.height);
  const coins: readonly [number, number, number][] = [[-400, -360, -12], [400, -100, 12], [-400, 300, 8]];
  coins.forEach(([x, y, angle], index) => {
    const coin = scene.add.image(x, y, CHEST_COIN_ICON).setDisplaySize(64, 64).setAngle(angle).setAlpha(0.4).setMask(mask);
    body.add(coin);
    if (motion > 0) scene.tweens.add({ targets: coin, y: y - 10 * motion, duration: 1700 + index * 230, yoyo: true, repeat: -1, ease: "Sine.InOut" });
  });
}

/**
 * 카드 한 장. 앞면은 등급 띠 → 보상 액자(수량) → 받을 확률. 뒤집은 면은 받았으면 같은 카드가 반짝이고, 놓쳤으면 잿빛으로
 * 가라앉는다. 「획득!」·「꽝」은 면에 적지 않고 그 위에 찍히는 도장이 말한다(`stampCard`).
 */
function paintCard(scene: Phaser.Scene, holder: Phaser.GameObjects.Container, card: ChestCard, width: number, height: number, face: "front" | "win" | "miss"): void {
  holder.removeAll(true);
  const tone = TIER_TONE[card.tier];
  const radius = TRUMP.radius;
  const g = scene.add.graphics();
  const miss = face === "miss";
  const edge = miss ? 0x8f97a3 : tone.deep;
  const left = -width / 2, top = -height / 2;
  // 트럼프 카드 — 거의 각진 모서리의 흰 판, 안쪽에 등급 색 테 한 줄, 그 안이 등급 색으로 옅게 물든 면이다.
  g.fillStyle(TIA.navy, 0.22).fillRoundedRect(left + 5, top + 10, width, height, radius);
  g.fillStyle(edge, 1).fillRoundedRect(left - 3, top - 3, width + 6, height + 6, radius + 2);
  g.fillStyle(0xffffff, 1).fillRoundedRect(left, top, width, height, radius);
  const inset = TRUMP.inset;
  g.fillStyle(miss ? 0xe3e6ea : tone.face, miss ? 1 : 0.32).fillRect(left + inset, top + inset, width - inset * 2, height - inset * 2);
  g.lineStyle(3, edge, miss ? 0.6 : 1).strokeRect(left + inset, top + inset, width - inset * 2, height - inset * 2);
  // 가운데 마름모 무늬 — 카드 면이 비어 보이지 않게, 액자 뒤에 옅게 깐다.
  g.fillStyle(miss ? 0xc7ccd3 : tone.face, miss ? 0.6 : 0.75).fillPoints([
    new Phaser.Geom.Point(0, top + inset + 26), new Phaser.Geom.Point(width / 2 - inset - 14, -6),
    new Phaser.Geom.Point(0, height / 2 - inset - 60), new Phaser.Geom.Point(-width / 2 + inset + 14, -6),
  ], true);
  holder.add(g);
  // 모서리 표시 — 왼쪽 위와 (거꾸로 세운) 오른쪽 아래에 등급 이름과 작은 마름모.
  const corner = (x: number, y: number, flip: boolean): void => {
    const mark = scene.add.container(x, y).setAngle(flip ? 180 : 0);
    const label = scene.add.text(0, 0, tierLabel(card.tier), textStyle({ role: "display", size: TRUMP.cornerSize, color: miss ? "#8f97a3" : tone.ink })).setOrigin(0, 0);
    shrinkTextToWidth(label, width * 0.5, { minSize: 14 });
    const pip = scene.add.graphics();
    const py = label.height + 12, half = 8;
    pip.fillStyle(edge, 1).fillPoints([new Phaser.Geom.Point(label.width / 2, py - half * 1.3), new Phaser.Geom.Point(label.width / 2 + half, py), new Phaser.Geom.Point(label.width / 2, py + half * 1.3), new Phaser.Geom.Point(label.width / 2 - half, py)], true);
    mark.add([label, pip]);
    holder.add(mark);
  };
  corner(left + inset + 8, top + inset + 6, false);
  corner(width / 2 - inset - 8, height / 2 - inset - 6, true);
  const iconY = -18;
  const icon = Math.min(FORGE.card.icon, width * 0.58);
  const frame = addFramedIcon(scene, holder, 0, iconY, icon, CURRENCY_ICON_BY_WALLET[card.currency], { amount: formatCurrency(card.amount), amountRatio: 0.3 });
  if (miss) frame.setAlpha(0.45);
  const footY = iconY + icon / 2 + 36;
  const pill = scene.add.graphics();
  pill.fillStyle(edge, 1).fillRoundedRect(-54, footY - 21, 108, 42, 8);
  holder.add(pill);
  holder.add(scene.add.text(0, footY, `${card.chance}%`, textStyle({ role: "display", size: 28, color: "#ffffff" })).setOrigin(0.5));
  if (miss) return;
  if (card.tier === "jackpot" || face === "win") {
    const sparkle = scene.add.graphics();
    for (const [x, y, size] of [[left + 10, -height / 2 + 96, 15], [width / 2 - 10, -40, 12], [width / 2 - 20, height / 2 - 100, 17]] as const) {
      drawSparkle(sparkle, x, y, size, card.tier === "jackpot" ? 0xffe38a : 0xffffff, 1);
    }
    holder.add(sparkle);
  }
}

/**
 * 상자의 등급 게이지가 읽는 값 — 큰 상자는 문턱도 그만큼 높으므로(`chestGradeThresholds`), 모은 몫을 작은 상자 기준으로
 * 되돌려 넘긴다. 상자 연출은 작은 상자의 문턱 하나만 안다.
 */
function stageValue(collected: ChestForgeRun["collected"], box: ChestBox): number {
  return chestCollectedValue(collected) / (box.reward * box.chance);
}

/** 트럼프 카드의 결 — 거의 각진 모서리, 안쪽 테까지의 여백, 모서리 표시 글자 크기. */
const TRUMP = { radius: 9, inset: 11, cornerSize: 22 } as const;

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

/**
 * 상자 곁의 티아 — 늘 통통 뛰며 상자를 응원하고(`idle`), 좋은 일이 생기면 크게 폴짝 뛰며 머리 위로 반짝이를 터뜨린다.
 * 응원 도약은 그동안 평소 도약을 멈춰 두었다가 이어 간다 — 두 움직임이 같은 y를 다투지 않는다.
 */
class TiaCheerleader {
  private puppet?: PuppetCreature;
  private idle?: Phaser.Tweens.Tween;
  constructor(private readonly scene: Phaser.Scene, private readonly parent: Phaser.GameObjects.Container, private readonly spot: { x: number; groundY: number; height: number }) {
    void addForgeSd(scene, parent, spot, true).then((puppet) => {
      this.puppet = puppet;
      if (puppet && chestFxMotion().loops) this.idle = startPuppetHop(scene, puppet, 0);
    });
  }
  /** 크게 폴짝 — `times`번 뛰고 반짝이를 흩뿌린다. */
  cheer(times = 1): void {
    const { scene, puppet, spot } = this;
    if (!puppet?.active) return;
    this.idle?.pause();
    scene.tweens.killTweensOf(puppet);
    puppet.setY(spot.groundY);
    const rise = 62 * chestFxMotion().distance;
    burstSparkles(scene, this.parent, spot.x, spot.groundY - spot.height * 0.95, { count: 7 + times * 2, radius: 70, size: 13, colors: [0xffffff, 0xbfe3ff, 0xffd9ec, 0xd6f5ec], seed: times * 17 + 3, rise: 30 });
    scene.tweens.add({ targets: puppet, y: spot.groundY - rise, angle: { from: -6, to: 6 }, duration: 190, yoyo: true, repeat: times - 1, ease: "Quad.Out",
      onComplete: () => { puppet.setY(spot.groundY).setAngle(0); this.idle?.resume(); } });
  }
  /** 놓쳤을 때 — 움찔. */
  flinch(): void {
    if (this.puppet?.active) playMotion(this.scene, this.puppet, "hit");
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
    const coinText = addCurrencyChip(scene, 0, FORGE.coinY, CHEST_COIN_ICON, { parent: body, ...FORGE.coinChip, rollKey: "chestForge:coins",
      onPress: () => openEventCoinGuide(scene, popups, "tia-treasure-coin", status.coins, status.resetsAt) });

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
    const introTia = new TiaCheerleader(scene, introPage, FORGE.intro.sd);
    if (loops) {
      // 첫 쪽에서도 상자가 등급을 갈아입을 때마다 한 번씩 응원한다.
      const cheerCycle = scene.time.addEvent({ delay: INTRO_GRADE_CYCLE_MS * 2, loop: true, callback: () => { if (introPage.visible) introTia.cheer(1); } });
      introPage.once(Phaser.GameObjects.Events.DESTROY, () => cheerCycle.remove());
    }
    const highlights = [...CHEST_CARDS].filter((card) => card.tier === "jackpot" || card.tier === "big").sort((a, b) => Number(b.tier === "jackpot") - Number(a.tier === "jackpot") || b.amount - a.amount).slice(0, 4);
    const { width: pw, height: ph, gap: pg } = FORGE.preview;
    introPage.add(scene.add.text(0, FORGE.intro.previewY - ph / 2 - 34, t("chestForge.jackpotHeader"), textStyle({ role: "display", size: 30, color: INK })).setOrigin(0.5).setStroke(OUTLINE, 8));
    highlights.forEach((card, index) => {
      const holder = scene.add.container((index - (highlights.length - 1) / 2) * (pw + pg), FORGE.intro.previewY);
      paintCard(scene, holder, card, pw, ph, "front");
      holder.setAngle((index - (highlights.length - 1) / 2) * 3);
      introPage.add(holder);
    });
    // 연구소의 연구 버튼과 같은 한 장을 상자마다 — 위에 상자 이름, 아래에 드는 값(코인 그림 × 100/200/300).
    // 버튼 위의 한 줄이 보상 배율(×1·×2·×3)을 말한다. 카드 확률은 셋이 같다.
    const BOX_LABEL: Record<ChestBoxId, TextKey> = { small: "chestForge.box.small", large: "chestForge.box.large", grand: "chestForge.box.grand" };
    const BOX_TONE: Record<ChestBoxId, number> = { small: 0x9fdcc4, large: 0x8fc6f0, grand: 0xffd36e };
    const enters = CHEST_BOXES.map((box, index) => {
      const x = (index - (CHEST_BOXES.length - 1) / 2) * (FORGE.button.width + FORGE.button.gap);
      const button = new ResearchPullButton(scene, x, FORGE.intro.buttonY, { width: FORGE.button.width, height: FORGE.button.height, label: t(BOX_LABEL[box.id]), tone: BOX_TONE[box.id], onClick: () => void enterBox(box) });
      const caption = scene.add.text(x, FORGE.intro.buttonY + FORGE.button.captionY, t("chestForge.box.reward", { mult: box.reward.toLocaleString() }), textStyle({ role: "display", size: 26, color: box.id === "grand" ? "#9a6c08" : ACCENT })).setOrigin(0.5).setStroke(OUTLINE, 7);
      introPage.add([caption, button]);
      return { box, button };
    });
    introPage.add(addHowToButton(scene, 0, FORGE.intro.howToY, () => openChestHowTo(scene, popups)));

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
    const tia = new TiaCheerleader(scene, chestLayer, FORGE.pick.sd);
    const buildPickChest = (): void => {
      pickChest?.destroy();
      pickChest = new ChestStage(scene, chestLayer, 0, FORGE.pick.chestY, FORGE.pick.chestScale, { gaugeY: FORGE.pick.gaugeY });
      chestLayer.sendToBack(pickChest.root);
      void pickChest.setValue(stageValue(status.run?.collected ?? {}, chestRunBox(status.run)), { animate: false });
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
        dots.fillStyle(index <= round ? 0x4f86c6 : 0xffffff, index <= round ? 1 : 0.8).fillCircle(x, y, index === round ? 10 : 8);
      }
    };
    const paintOffer = (enterFrom = false): void => {
      cardsRow.removeAll(true);
      cardHolders = [];
      const offer = status.run?.offer ?? [];
      const { width, height, gap } = FORGE.card;
      offer.forEach((id, index) => {
        const card = chestCard(id, chestRunBox(status.run));
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
      coinText.setText(status.coins.toLocaleString());
      const running = status.run !== null;
      introPage.setVisible(!running); pickPage.setVisible(running);
      for (const { box, button } of enters) {
        button.setCost([{ iconKey: CHEST_COIN_ICON, amount: box.entryCost, short: status.coins < box.entryCost }]);
        button.setEnabled(!busy && status.coins >= box.entryCost);
      }
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

    async function enterBox(box: ChestBox): Promise<void> {
      if (busy) return;
      busy = true; refresh();
      const result = await request(`enter-${box.id}`, (requestId) => gameApi.enterChestForge({ requestId, box: box.id }));
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
        tia.flinch();
        await chest.fizzle();
        return;
      }
      const textures = (Object.entries(total).filter(([, amount]) => (amount ?? 0) > 0) as [ChestCardCurrency, number][])
        .map(([currency]) => ({ texture: CURRENCY_ICON_BY_WALLET[currency] }));
      collectedLabel.setVisible(false);
      collectedRow.setVisible(false);
      const opening = chest.open(textures, FORGE.pick.openY, FORGE.pick.openGrow);
      scene.time.delayedCall(1050, () => tia.cheer(3));
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
      const box = chestRunBox(status.run);
      const card = chestCard(status.run.offer[index] ?? "", box);
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
        await waitFx(scene, 40);
        await stampCard(scene, holder, width, outcome.success, t(outcome.success ? "chestForge.win" : "chestForge.miss"), flair);
        glow?.destroy();
        if (outcome.success) {
          await waitFx(scene, 90);
          const from = { x: holder.x, y: FORGE.pick.cardsY + holder.y };
          tia.cheer(flair >= 3 ? 2 : 1);
          await flyCardToChest(scene, pickPage, holder, from, pickChest?.mouth() ?? { x: 0, y: FORGE.pick.chestY }, flair);
          if (!alive) return;
          pickChest?.gulp(flair);
          paintCollected(collected, card.currency);
          await pickChest?.setValue(stageValue(collected, box));
        } else {
          await waitFx(scene, 90);
          tia.flinch();
          await shatterCard(scene, cardsRow, holder, width, height);
        }
      }
      if (!alive) { status = result.status; return; }
      await waitFx(scene, 100);
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

/**
 * 「게임 방법!」 — 상자 열기 위에 앉는 작은 말풍선 단추. 눌러야 하는 조작이 아니라 궁금할 때 여는 안내라 열기 버튼보다
 * 한참 작고 가볍다(흰 면 + 남색 테 + 물음표 방울).
 */
function addHowToButton(scene: Phaser.Scene, x: number, y: number, onClick: () => void): Phaser.GameObjects.Container {
  const root = scene.add.container(x, y);
  const label = scene.add.text(0, 0, t("chestForge.howTo.button"), textStyle({ role: "emphasis", size: 26, color: INK })).setOrigin(0, 0.5);
  shrinkTextToWidth(label, 300);
  const height = 56, badge = 20, pad = 18;
  const width = pad + badge * 2 + 10 + label.displayWidth + pad;
  const g = scene.add.graphics();
  g.fillStyle(TIA.navy, 0.18).fillRoundedRect(-width / 2 + 3, -height / 2 + 6, width, height, height / 2);
  g.fillStyle(TIA.navy, 1).fillRoundedRect(-width / 2 - 3, -height / 2 - 3, width + 6, height + 6, height / 2 + 3);
  g.fillStyle(0xffffff, 1).fillRoundedRect(-width / 2, -height / 2, width, height, height / 2);
  const bx = -width / 2 + pad + badge;
  g.fillStyle(0x4f86c6, 1).fillCircle(bx, 0, badge);
  g.fillStyle(0xffffff, 0.45).fillCircle(bx - badge * 0.35, -badge * 0.35, badge * 0.28);
  const mark = scene.add.text(bx, 1, "?", textStyle({ role: "display", size: 28, color: "#ffffff" })).setOrigin(0.5);
  label.setX(bx + badge + 10);
  const sparkle = scene.add.graphics();
  drawSparkle(sparkle, width / 2 - 2, -height / 2 + 4, 13, 0xffd36e);
  root.add([g, mark, label, sparkle]);
  const hit = addClippedHit(scene, root, 0, 0, width + 20, height + 20, () => ({ left: 0, right: scene.scale.width, top: 0, bottom: scene.scale.height }), { useHandCursor: true });
  hit.on("pointerdown", () => pressIn(root));
  hit.on("pointerout", () => pressOut(root, "normal", { pop: false }));
  hit.on("pointerup", () => { pressOut(root); onClick(); });
  if (chestFxMotion().loops) scene.tweens.add({ targets: sparkle, alpha: { from: 1, to: 0.25 }, duration: 700, yoyo: true, repeat: -1, ease: "Sine.InOut" });
  return root;
}

/**
 * 게임 방법 쪽지 — 티아가 말풍선으로 직접 들려준다. 판 높이는 말풍선 글을 먼저 재서 거꾸로 구한다.
 */
export function openChestHowTo(scene: Phaser.Scene, popups: PopupLayer): void {
  const { width, bubbleWidth, wrap, lineGap, sd } = FORGE.howTo;
  const keys: TextKey[] = ["chestForge.howTo.1", "chestForge.howTo.2", "chestForge.howTo.3", "chestForge.howTo.4", "chestForge.howTo.5"];
  const lines = keys.map((key) => scene.add.text(0, 0, t(key, { count: CHEST_BOXES[0].entryCost.toLocaleString() }), textStyle({ role: "body", size: 27, color: INK, wrap, lineSpacing: 6 })).setOrigin(0, 0));
  const textHeight = lines.reduce((sum, line) => sum + line.height, 0) + lineGap * (lines.length - 1);
  const bubblePad = 40, tail = 46, top = 70;
  const bubbleHeight = textHeight + bubblePad * 2;
  const height = top + bubbleHeight + tail + sd.height + 30;
  popups.open({ width, height, title: t("chestForge.howTo.title"), dim: true, dimAlpha: 0.35, closeOnBackdrop: true, closeOnBody: true }, (body) => {
    const shape = popupArtShape(width, height);
    const mask = popupBodyShapeMask(scene, body, shape);
    const left = -width / 2, upper = -height / 2;
    const base = scene.add.graphics();
    base.fillGradientStyle(TIA.sky, TIA.sky, TIA.lilac, TIA.lilac, 1).fillRect(left, upper, width, height);
    TIA.veil.forEach((color, index) => {
      const y0 = upper + 120 + index * 260;
      base.fillStyle(color, 0.4).fillPoints([
        new Phaser.Geom.Point(left, y0), new Phaser.Geom.Point(left + width, y0 - 220), new Phaser.Geom.Point(left + width, y0 - 140), new Phaser.Geom.Point(left, y0 + 80),
      ], true);
    });
    for (let index = 0; index < 14; index += 1) {
      const x = left + 30 + ((index * 0.618034) % 1) * (width - 60);
      const y = upper + 30 + ((index * 0.381966 + index * 0.07) % 1) * (height - 60);
      const r = 5 + (index * 7) % 12;
      base.lineStyle(2, 0xffffff, 0.6).strokeCircle(x, y, r);
    }
    body.add(base.setMask(mask));

    // 말풍선 — 흰 면 + 남색 테, 꼬리는 아래의 티아를 가리킨다.
    const bx = -bubbleWidth / 2, by = upper + top;
    const tailX = sd.x + 70, tailBase = by + bubbleHeight;
    const bubble = scene.add.graphics();
    bubble.fillStyle(TIA.navy, 0.16).fillRoundedRect(bx + 6, by + 10, bubbleWidth, bubbleHeight, 34);
    bubble.fillStyle(TIA.navy, 1).fillRoundedRect(bx - 4, by - 4, bubbleWidth + 8, bubbleHeight + 8, 38);
    bubble.fillTriangle(tailX - 34, tailBase - 6, tailX + 30, tailBase - 6, tailX - 18, tailBase + tail + 4);
    bubble.fillStyle(0xffffff, 1).fillRoundedRect(bx, by, bubbleWidth, bubbleHeight, 34);
    bubble.fillTriangle(tailX - 28, tailBase - 8, tailX + 24, tailBase - 8, tailX - 16, tailBase + tail - 4);
    const stars = scene.add.graphics();
    body.add([bubble, stars]);
    let y = by + bubblePad;
    const textX = bx + 84;
    lines.forEach((line, index) => {
      line.setPosition(textX, y);
      body.add(line);
      const cy = y + 18;
      stars.fillStyle(index === 2 ? 0xff8fb4 : 0x4f86c6, 1).fillCircle(textX - 38, cy, 17);
      body.add(scene.add.text(textX - 38, cy + 1, String(index + 1), textStyle({ role: "display", size: 22, color: "#ffffff" })).setOrigin(0.5));
      y += line.height + lineGap;
    });
    drawSparkle(stars, bx + bubbleWidth - 18, by + 8, 20, 0xffd36e);
    drawSparkle(stars, bx + 14, by + bubbleHeight - 10, 14, 0x9fc3e6);

    // 티아 — 말풍선 아래에서 통통 뛰며 설명한다. 옆에는 이벤트 코인과 작은 상자.
    const groundY = height / 2 - 30;
    const tia = new TiaCheerleader(scene, body, { x: sd.x, groundY, height: sd.height });
    void tia;
    const coin = scene.add.image(sd.x + 230, groundY - 90, CHEST_COIN_ICON).setDisplaySize(110, 110).setAngle(-10);
    const coinSmall = scene.add.image(sd.x + 360, groundY - 50, CHEST_COIN_ICON).setDisplaySize(76, 76).setAngle(14);
    const cards = scene.add.container(sd.x + 470, groundY - 120);
    const sample = [...CHEST_CARDS].find((card) => card.tier === "jackpot") ?? CHEST_CARDS[0];
    paintCard(scene, cards, sample, 120, 180, "front");
    cards.setAngle(8);
    body.add([coin, coinSmall, cards]);
    if (chestFxMotion().loops) {
      scene.tweens.add({ targets: [coin, coinSmall], y: "-=12", duration: 900, yoyo: true, repeat: -1, ease: "Sine.InOut" });
      scene.tweens.add({ targets: cards, angle: 2, duration: 1100, yoyo: true, repeat: -1, ease: "Sine.InOut" });
    }
  });
}
