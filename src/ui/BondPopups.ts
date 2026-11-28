import Phaser from "phaser";
import { t, type TextKey } from "../i18n";
import {
  BOND_AWAKENING_LADDER, BOND_AWAKENING_PERCENT, BOND_STAT_LEVEL_CAP, BOND_LEVEL_MAX, BOND_TOTAL_XP_BY_LEVEL, BOND_XP_REWARD,
  bondAwakeningAtLevel, bondAwakeningPoints, bondAwakeningSpent, bondStatPercent, storyVictoryBondXp,
  type BondAwakening, type BondAwakeningKey,
} from "../core/bond";
import { BOND_STORY_GEM_REWARD, type BondStoryLevel } from "../core/relicStory";
import { relicStoryFor } from "../data/relicStories";
import { getRelic } from "../data/relics";
import { CHAPTERS } from "../data/stages";
import { relicStories } from "../managers/RelicStoryManager";
import { relicProgression } from "../managers/RelicProgressionManager";
import { gameApi } from "../api/FakeServer";
import { logError } from "../managers/ErrorReporter";
import { audioManager } from "../managers/AudioManager";
import { motionPolicy } from "../core/settings";
import { session } from "../state/session";
import { DIALOGUE_BACKDROP } from "./dialogueStageLayout";
import { spawnPuppet, type PuppetAsset } from "../puppets/assets";
import { startPuppetHop } from "./puppetHop";
import { addSdFootShadow } from "./SdFootShadow";
import { chipPoints, drawLayer, fillShapeGradient, HoloBar, toPoints } from "./holo";
import { scaleShape } from "./shapeBands";
import { NotificationDot } from "./NotificationDot";
import { POPUP_BODY_BEVEL_RATIO } from "./popupGeometry";
import { drawGlyph } from "./glyphs";
import { addSectionTitle } from "./SectionTitle";
import { paintStoryRowArt } from "./bondStoryRowArt";
import { RewardFrame } from "./RewardFrame";
import { StatRadar } from "./StatRadar";
import { STAT_TONE } from "./statTones";
import { pressIn, pressOut } from "./pressFeedback";
import { shrinkTextToWidth, squeezeTextToWidth } from "./textFit";
import { showContentToast } from "./ContentToast";
import { addResetChip } from "./ResetChip";
import { openBondAwakenResetPopup } from "./RelicResetPopup";
import { flashRow, playAwakenBurst, playAwakenCharge, playAwakenRefund, popTarget, toWorld, type FxPoint } from "./bondAwakenFx";
import type { PopupLayer } from "./PopupLayer";
import { COLOR, textStyle } from "./theme";

/**
 * 유대 상세 · 획득 방법 · 레벨 사다리 · 유대 각성 — 정보창의 유대 칸이 여는 판 넷(응태 2026-11-28).
 *
 * 위는 「지금 얼마인가」(레벨 · 경험치 · 얻는 능력치)만, 아래는 애착 스토리 네 장이다. 얻는 길은 판에 늘어놓지 않고
 * 「획득 방법!」 버튼이 따로 연다. 레벨 옆 돋보기가 레벨마다 무엇을 받는지 사다리로 펴 보인다.
 * 정보창(`info.ts`)이 하트 그림과 스토리 읽기·갱신을 넘겨 준다 — 이 파일이 정보창을 거꾸로 읽지 않는다.
 */
export interface BondPopupContext {
  scene: Phaser.Scene;
  popups: PopupLayer;
  relicId: string;
  /** 정보창의 유대 하트 한 덩이(그림자·빛무리·주사선). */
  paintHeart: (size: number) => Phaser.GameObjects.Container;
  /** 내 렐릭이라 각성·스토리 보상을 다룰 수 있는가. 친구 창에서는 읽기만 한다. */
  mutable: boolean;
  /** 애착 스토리 한 장을 읽는다(끝나면 정보창이 이 판을 다시 연다). */
  readChapter: (level: BondStoryLevel, storyId: string) => void;
  /** 각성을 바꿨다 — 정보창의 오각형·칩을 다시 칠한다. */
  onChanged: () => void;
  /** 판이 닫힐 때 — 누른 칸을 되돌린다. */
  onClose?: () => void;
  /** 그 렐릭의 SD(입은 외형) — 획득 방법 판의 말하는 사람이다. */
  sdAsset?: PuppetAsset;
}

/** 유대 하트·게이지의 분홍. 정보창의 하트와 같은 색이다. */
const BOND_PINK = COLOR.bond;
const BOND_PINK_TEXT = "#ff9db1";
const BOND_PINK_SOFT = 0xffc2cf;

/** 상세 판의 자리. 높이는 위 영역 + 이야기 네 줄에서 나온다. */
export const BOND_DETAIL_LAYOUT = {
  width: 860, height: 1240,
  heart: { x: -300, y: -500, size: 70 },
  levelX: -196, levelY: -528,
  bar: { y: -466, width: 560, height: 16 },
  barLabelY: -438,
  card: { y: -350, width: 780, height: 120 },
  buttons: { y: -232, width: 360, height: 82, gap: 24 },
  storyTitleY: -148,
  row: { top: -56, width: 780, height: 158, gap: 16, bevel: 30 },
} as const;

/** 이야기 묶음이 없는 개체가 쓰는 예전 네 장(제목만). */
const LEGACY_STEPS: readonly { level: number; titleKey: TextKey }[] = [
  { level: 2, titleKey: "info.story.1" },
  { level: 4, titleKey: "info.story.2" },
  { level: 7, titleKey: "info.story.3" },
  { level: 10, titleKey: "info.story.4" },
];

/** 다섯 축의 이름(정보창의 능력치 칩과 같은 낱말). */
const AXIS_LABEL: Readonly<Record<BondAwakeningKey, TextKey>> = {
  hp: "stat.hp", atk: "stat.atk.short", def: "stat.def.short", res: "stat.res.short", ap: "stat.ap.short",
};
/** 정보창 오각형과 같은 축 순서 — 위부터 시계 방향이 아니라 칩 줄과 같은 차례로 선다. */
const AXIS_ORDER: readonly BondAwakeningKey[] = ["hp", "atk", "def", "res", "ap"];

const hex = (color: number): string => `#${color.toString(16).padStart(6, "0")}`;

/** 그 축 각성의 % 합. */
function awakenPercent(awakening: BondAwakening | undefined, key: BondAwakeningKey): number {
  return (awakening?.[key] ?? 0) * BOND_AWAKENING_PERCENT;
}

/** `체력 +4% · 공격 +2%` — 각성한 축만. 없으면 빈 글. */
export function bondAwakeningSummary(awakening: BondAwakening | undefined): string {
  return AXIS_ORDER.filter((key) => (awakening?.[key] ?? 0) > 0).map((key) => `${t(AXIS_LABEL[key])} +${awakenPercent(awakening, key)}%`).join("  ·  ");
}

/** 남은 각성 횟수. 정보창의 「각성」 칩이 붉은 점을 세울지 같은 값을 읽는다. */
export function bondAwakeningLeft(relicId: string): number {
  const progress = relicProgression.getProgress(relicId);
  return Math.max(0, bondAwakeningPoints(progress.bondLevel) - bondAwakeningSpent(progress.bondAwakening));
}

/** 유대 상세 판. */
export function openBondDetail(ctx: BondPopupContext): void {
  const { scene, popups, relicId } = ctx;
  const L = BOND_DETAIL_LAYOUT;
  const progress = relicProgression.getProgress(relicId);
  const level = progress.bondLevel;
  popups.open({ width: L.width, height: L.height, title: t("info.section.bond"), dim: true, dimAlpha: 0.62, onClose: ctx.onClose }, (body) => {
    // 판 전체에 아주 옅은 분홍 빛 — 사랑스러움은 색과 하트가 말하고 장식을 늘어놓지 않는다.
    const glow = scene.add.graphics();
    fillShapeGradient(glow, popupInnerShape(L.width, L.height), { from: -L.height / 2 + 40, to: -L.height / 2 + 460, color: BOND_PINK, alphaFrom: 0.16 });
    body.add(glow);

    // 하트 + 레벨 수.
    const heart = scene.add.container(L.heart.x, L.heart.y);
    heart.add(ctx.paintHeart(L.heart.size));
    heart.add(scene.add.text(0, 2, String(level), textStyle({ role: "display", size: 44 })).setOrigin(0.5).setStroke("#3a0712", 8));
    body.add(heart);
    breathe(scene, heart, 1.05);
    const levelText = scene.add.text(L.levelX, L.levelY, t("info.bond.level", { level }), textStyle({ role: "display", size: 50, color: "#ffffff" }))
      .setOrigin(0, 0.5).setShadow(0, 4, "#05070a", 6, false, true);
    body.add(levelText);
    // 레벨 옆 돋보기 — 레벨마다 무엇을 받는지 사다리로 편다.
    addSmallMagnifier(scene, body, L.levelX + levelText.width + 44, L.levelY, () => openBondLadder(ctx));

    // 경험치 줄. 상한이 없으므로 「다음 레벨까지」만 말한다.
    const maxed = level >= BOND_LEVEL_MAX;
    const base = BOND_TOTAL_XP_BY_LEVEL[level];
    const next = maxed ? base : BOND_TOTAL_XP_BY_LEVEL[level + 1];
    const barX = L.levelX + L.bar.width / 2;
    const bar = new HoloBar(scene, barX, L.bar.y, L.bar.width, L.bar.height, { color: BOND_PINK, trackAlpha: 0.8, outline: true, glow: { alpha: 0.18 } }).addTo(body);
    bar.setValue(maxed ? 1 : (progress.bondXp - base) / Math.max(1, next - base));
    body.add(scene.add.text(barX + L.bar.width / 2, L.barLabelY, maxed ? "MAX" : `${(progress.bondXp - base).toLocaleString()} / ${(next - base).toLocaleString()} EXP`, textStyle({ role: "emphasis", size: 24, color: COLOR.inkDim })).setOrigin(1, 0));
    if (!maxed) body.add(scene.add.text(L.levelX, L.barLabelY, t("info.bond.xpNext", { xp: (next - progress.bondXp).toLocaleString() }), textStyle({ role: "body", size: 22, color: BOND_PINK_TEXT })).setOrigin(0, 0));

    // 얻는 능력치 — 레벨 몫(모든 능력치)과 각성 몫.
    const card = scene.add.container(0, L.card.y);
    const cardShape = chipPoints(L.card.width, L.card.height, { bevel: { topLeft: 26, bottomRight: 26 } });
    card.add(drawLayer(scene, 0, 0, cardShape, { fill: 0x2a1220, alpha: 0.82, edge: BOND_PINK, edgeAlpha: 0.55 }));
    const left = -L.card.width / 2 + 40;
    card.add(scene.add.text(left, -24, t("info.bond.statGain"), textStyle({ role: "emphasis", size: 24, color: COLOR.inkDim })).setOrigin(0, 0.5));
    card.add(scene.add.text(left, 18, `+${bondStatPercent(level)}%`, textStyle({ role: "display", size: 42, color: BOND_PINK_TEXT })).setOrigin(0, 0.5).setStroke("#3a0712", 6));
    const divider = scene.add.graphics(); divider.lineStyle(2, BOND_PINK, 0.35).lineBetween(-80, -40, -80, 40); card.add(divider);
    const summary = bondAwakeningSummary(progress.bondAwakening);
    const right = -50;
    card.add(scene.add.text(right, -24, t("info.bond.awaken"), textStyle({ role: "emphasis", size: 24, color: COLOR.inkDim })).setOrigin(0, 0.5));
    const awakenLine = summary
      ? scene.add.text(right, 18, summary, textStyle({ role: "emphasis", size: 28, color: COLOR.ink })).setOrigin(0, 0.5)
      : scene.add.text(right, 18, t("info.bond.awakenNone"), textStyle({ role: "body", size: 23, color: COLOR.inkDim })).setOrigin(0, 0.5);
    squeezeTextToWidth(awakenLine, L.card.width / 2 + 50 - 40);
    card.add(awakenLine);
    body.add(card);

    // 버튼 둘 — 획득 방법(분홍 알약) · 유대 각성(남은 횟수가 있으면 숨 쉰다).
    const { buttons } = L;
    const bx = (buttons.width + buttons.gap) / 2;
    addPillButton(scene, body, -bx, buttons.y, buttons.width, buttons.height, { label: t("info.bond.howTo"), glyph: "help", tone: BOND_PINK, onTap: () => openBondGuide(ctx) });
    const left2 = bondAwakeningLeft(relicId);
    const awakenButton = addPillButton(scene, body, bx, buttons.y, buttons.width, buttons.height, {
      label: t("info.bond.awaken"), glyph: "promote", tone: 0xffb36b, dot: ctx.mutable && left2 > 0,
      onTap: () => openBondAwakening(ctx),
    });
    if (ctx.mutable && left2 > 0) breathe(scene, awakenButton, 1.04);

    // 애착 스토리.
    addSectionTitle(scene, -L.row.width / 2 + 10, L.storyTitleY, t("info.bond.story"), { parent: body });
    const chapters = relicStories.chapterViews(relicId);
    const story = relicStoryFor(relicId);
    if (chapters.length > 0 && story) {
      chapters.forEach((chapter, index) => {
        const dialogue = story.bondStories[chapter.level];
        addStoryRow(scene, body, index, {
          relicId, level: chapter.level, title: dialogue.titleCard?.title ?? dialogue.id, backdrop: DIALOGUE_BACKDROP[dialogue.backdrop ?? "relics"],
          storyId: dialogue.id, open: chapter.unlocked, claimed: chapter.claimed, gems: BOND_STORY_GEM_REWARD[chapter.level],
          onTap: chapter.unlocked ? () => ctx.readChapter(chapter.level, chapter.storyId) : undefined,
        });
      });
      return;
    }
    LEGACY_STEPS.forEach((step, index) => {
      addStoryRow(scene, body, index, {
        relicId, level: step.level, title: t(step.titleKey), backdrop: DIALOGUE_BACKDROP.relics, storyId: step.titleKey,
        open: level >= step.level, claimed: true, gems: 0,
      });
    });
  });
}

interface StoryRowSpec {
  relicId: string; level: number; title: string; backdrop: string; storyId: string;
  open: boolean; claimed: boolean; gems: number; onTap?: () => void;
}

/**
 * 애착 스토리 한 줄 — 그 이야기의 무대 원화가 판을 채우고 오른쪽에 그 렐릭이 은은하게 선다(회고 줄과 같은 문법).
 * 잠긴 줄은 원화를 누르고 얼굴을 흐려 「아직」을 말한다.
 */
function addStoryRow(scene: Phaser.Scene, body: Phaser.GameObjects.Container, index: number, spec: StoryRowSpec): void {
  const { row: R } = BOND_DETAIL_LAYOUT;
  const y = R.top + index * (R.height + R.gap) + R.height / 2;
  const row = scene.add.container(0, y);
  body.add(row);
  const { width, height } = R;
  const shape = chipPoints(width, height, { bevel: { topLeft: R.bevel, topRight: 0, bottomRight: R.bevel, bottomLeft: 0 } });
  row.add(drawLayer(scene, 0, 0, shape, { fill: COLOR.void, alpha: 0.92 }));
  paintStoryRowArt(scene, row, { relicId: spec.relicId, backdrop: spec.backdrop, storyId: spec.storyId, open: spec.open, width, height, shape, pink: BOND_PINK });

  const textLeft = -width / 2 + 52;
  row.add(scene.add.text(textLeft, -40, `BOND ${spec.level}`, textStyle({ role: "emphasis", size: 22, color: spec.open ? BOND_PINK_TEXT : COLOR.inkDim }))
    .setOrigin(0, 0.5).setShadow(0, 2, "#05070a", 4, false, true));
  const title = scene.add.text(textLeft, 2, spec.title, textStyle({ role: "display", size: 34, color: spec.open ? "#ffffff" : COLOR.inkDim }))
    .setOrigin(0, 0.5).setShadow(0, 3, "#05070a", 6, false, true);
  shrinkTextToWidth(title, width * 0.56);
  row.add(title);
  const status = spec.open ? t("info.bond.opened") : t("info.bond.required", { level: spec.level });
  row.add(scene.add.text(textLeft, 44, status, textStyle({ role: "body", size: 21, color: spec.open ? COLOR.ink : COLOR.inkDim }))
    .setOrigin(0, 0.5).setAlpha(0.85).setShadow(0, 2, "#05070a", 4, false, true));
  if (!spec.open) row.add(drawGlyph(scene, "lock", width / 2 - 70, 0, 40, COLOR.inkDimHex, 0.8, 3));

  if (spec.gems > 0) {
    const claimable = spec.open && !spec.claimed;
    const reward = new RewardFrame(scene, width / 2 - 76, 0, { icon: "currency-gems", amount: spec.gems, size: 84, state: claimable ? "claimable" : spec.claimed ? "claimed" : "normal" });
    row.add(reward);
    if (claimable && motionPolicy(session.settings).nonEssentialDistanceFactor > 0) {
      const tween = scene.tweens.add({ targets: reward, scale: { from: 1, to: 1.08 }, duration: 620, yoyo: true, repeat: -1, ease: "Sine.InOut" });
      reward.once(Phaser.GameObjects.Events.DESTROY, () => tween.remove());
    }
  }
  if (spec.onTap) {
    const onTap = spec.onTap;
    const hit = scene.add.rectangle(0, 0, width, height, 0xffffff, 0).setInteractive({ useHandCursor: true });
    hit.on("pointerdown", () => pressIn(row));
    hit.on("pointerout", () => pressOut(row, "normal", { pop: false }));
    hit.on("pointerup", () => { pressOut(row); onTap(); });
    row.add(hit);
  }
}

/**
 * 획득 방법 판의 자리 — 위는 그 렐릭이 말하는 말풍선, 왼쪽 아래는 총총 뛰는 SD, 오른쪽은 좁힌 목록이다(응태 2026-11-28).
 * 높이는 말풍선 + 목록 줄 수에서 거꾸로 구한다. 글자는 크고 둥글게 — 읽는 판이 아니라 렐릭이 건네는 쪽지다.
 */
export const BOND_GUIDE_LAYOUT = {
  width: 940,
  pad: 44,
  bubble: { top: 60, height: 184, textSize: 30, tail: 34 },
  sd: { x: -300, height: 430, shadow: 220 },
  list: { width: 540, top: 300, rowH: 124, gap: 18, icon: 76 },
  bottom: 64,
} as const;

/**
 * 획득 방법 판의 줄마다의 결 — 길마다 제 그림·제 색이 「무엇을 하면 되는가」를 먼저 말한다(응태 2026-11-28 — 귀여운 팝업처럼).
 * 줄 판은 그 색의 짙은 결로 물들고, 왼쪽 스티커 칸이 살짝 기울어 그 색으로 서며, 오른쪽에 같은 그림이 큼직한 물무늬로 깔린다.
 */
const GUIDE_ROW_STYLE = [
  { glyph: "sortie", tone: 0xff5d86, deep: 0x3a1428, text: "#ff9db1", tilt: -7 },
  { glyph: "heart", tone: 0xffa36b, deep: 0x33190f, text: "#ffc59a", tilt: 6 },
  { glyph: "scroll", tone: 0x5fdcc0, deep: 0x0f2a26, text: "#9ef0dc", tilt: -5 },
  { glyph: "friends", tone: 0xb79bff, deep: 0x201936, text: "#d3c4ff", tilt: 7 },
] as const;

/** 유대 획득 방법 — 그 렐릭이 말풍선으로 스토리 반복 전투를 권하고, 오른쪽 목록이 길마다 얼마인지 적는다. */
export function openBondGuide(ctx: BondPopupContext): void {
  const { scene, popups } = ctx;
  const L = BOND_GUIDE_LAYOUT;
  const width = L.width;
  const lastChapter = Math.max(1, CHAPTERS.length);
  const rows: { label: string; amount: string; recommended?: boolean }[] = [
    { label: t("info.bond.storyBattle"), amount: t("info.bond.storyBattleAmount", { from: storyVictoryBondXp(1), to: storyVictoryBondXp(lastChapter) }), recommended: true },
    { label: t("info.bond.lobbyInteraction"), amount: t("info.bond.oncePerDay", { amount: `${BOND_XP_REWARD.firstLobbyInteraction} EXP` }) },
    { label: t("info.bond.interview"), amount: t("info.bond.oncePerDay", { amount: `${BOND_XP_REWARD.firstObservationInterview} EXP` }) },
    { label: t("info.bond.firstMeet"), amount: t("info.bond.once", { amount: `${BOND_XP_REWARD.firstAcquisition} EXP` }) },
  ];
  const listHeight = rows.length * L.list.rowH + (rows.length - 1) * L.list.gap;
  const height = L.list.top + listHeight + L.bottom;
  const loops = motionPolicy(session.settings).nonEssentialDistanceFactor > 0;
  popups.open({ width, height, title: t("info.bond.howToTitle"), dim: true, dimAlpha: 0.4 }, (body) => {
    const top = -height / 2;
    const B = L.bubble;
    const B_STAGE_TOP = B.top + B.height + B.tail + 4;
    const listX = width / 2 - L.pad - L.list.width / 2;
    const listTop = top + L.list.top;
    const sdGround = listTop + listHeight - 10;

    // 판 색 — 위는 분홍빛이 옅게 깔리고, SD가 서는 왼쪽 아래에는 따뜻한 무대 빛이 고인다.
    const wash = scene.add.graphics();
    fillShapeGradient(wash, popupInnerShape(width, height), { from: top + 20, to: top + height * 0.6, color: BOND_PINK, alphaFrom: 0.2 });
    body.add(wash);

    // 뒷판 — 말풍선 아래 SD와 목록을 함께 품는 분홍 투영 무대(유대 각성 상태창과 같은 결).
    const stageTop = top + B_STAGE_TOP;
    const stageBottom = listTop + listHeight + 28;
    paintBondStatusScreen(scene, body, 0, (stageTop + stageBottom) / 2, width - 56, stageBottom - stageTop, { ticks: false, brackets: false, glowY: 0.22, glowX: (L.sd.x) / (width - 56) });
    // SD 발밑에 고이는 무대 빛 — 판 안에 머문다.
    const footLight = scene.add.graphics();
    body.add(footLight);
    for (let ring = 3; ring >= 1; ring -= 1) footLight.fillStyle(BOND_PINK_SOFT, 0.04 * (4 - ring)).fillEllipse(L.sd.x, sdGround - 10, 110 * ring, 30 * ring);

    // 말풍선 — 판 폭을 거의 다 쓰는 밝은 판, 꼬리는 왼쪽 아래의 SD를 가리킨다.
    const bubbleWidth = width - L.pad * 2;
    const bubble = scene.add.container(0, top + B.top + B.height / 2);
    const bevel = B.height * 0.22;
    const bubbleShape = chipPoints(bubbleWidth, B.height, { bevel: { topLeft: bevel, bottomRight: bevel } });
    // 말풍선 뒤 발광 — 같은 실루엣을 조금씩 키워 겹쳐, 깎인 모서리까지 그대로 따라 번진다.
    const halo = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    for (let ring = 6; ring >= 1; ring -= 1) {
      const grow = ring * 3.5;
      halo.fillStyle(BOND_PINK, 0.05).fillPoints(toPoints(chipPoints(bubbleWidth + grow * 2, B.height + grow * 2, { bevel: { topLeft: bevel + grow * 0.41, bottomRight: bevel + grow * 0.41 } })), true);
    }
    bubble.add(halo);
    if (loops) {
      const pulse = scene.tweens.add({ targets: halo, alpha: { from: 0.65, to: 1 }, duration: 1400, yoyo: true, repeat: -1, ease: "Sine.InOut" });
      halo.once(Phaser.GameObjects.Events.DESTROY, () => pulse.remove());
    }
    bubble.add(drawLayer(scene, 0, 0, bubbleShape, { fill: 0xfff3f6, alpha: 0.98, shadow: { x: 6, y: 10 } }));
    // 윗변 분홍 띠 한 줄 — 쪽지가 그 렐릭의 것임을 색이 말한다.
    bubble.add(scene.add.rectangle(0, -B.height / 2 + 6, bubbleWidth - bevel * 2.2, 6, BOND_PINK, 0.55));
    const tailX = L.sd.x;
    bubble.add(scene.add.graphics().fillStyle(0xfff3f6, 0.98).fillPoints([
      new Phaser.Math.Vector2(tailX - B.tail, B.height / 2 - 2),
      new Phaser.Math.Vector2(tailX + B.tail, B.height / 2 - 2),
      new Phaser.Math.Vector2(tailX - B.tail * 0.2, B.height / 2 + B.tail * 1.25),
    ], true));
    const tip = scene.add.text(0, 2, t("info.bond.recommendLine"), textStyle({ role: "display", size: B.textSize, color: "#5a1a2e", align: "center", lineSpacing: 10, wrap: bubbleWidth - 90 })).setOrigin(0.5);
    shrinkTextToWidth(tip, bubbleWidth - 80);
    bubble.add(tip);
    body.add(bubble);
    if (loops) {
      bubble.setScale(0.7).setAlpha(0);
      scene.tweens.add({ targets: bubble, scale: 1, alpha: 1, duration: 320, delay: 140, ease: "Back.Out" });
    }

    // SD — 왼쪽 기둥에 발밑 그림자 위로 서서 총총 뛴다.
    body.add(addSdFootShadow(scene, L.sd.x, sdGround, L.sd.shadow));
    if (ctx.sdAsset) {
      void spawnPuppet(scene, ctx.sdAsset, { x: L.sd.x, groundY: sdGround, height: L.sd.height, depth: 0 })
        .then((puppet) => {
          if (!body.active) { puppet.destroy(); return; }
          puppet.disableInteractive();
          body.add(puppet);
          body.bringToTop(bubble);
          const hop = startPuppetHop(scene, puppet, 0);
          puppet.once(Phaser.GameObjects.Events.DESTROY, () => hop.remove());
        })
        .catch((error) => logError("puppet.display", "유대 획득 방법 SD 표시 실패", error));
    }

    // 목록 — 오른쪽 기둥. 줄마다 제 색으로 물든 판, 왼쪽에 기울어진 스티커 그림, 오른쪽에 이름과 얼마인지.
    rows.forEach((row, index) => {
      const style = GUIDE_ROW_STYLE[index] ?? GUIDE_ROW_STYLE[0];
      const y = listTop + index * (L.list.rowH + L.list.gap) + L.list.rowH / 2;
      const card = scene.add.container(listX, y);
      body.add(card);
      const shape = chipPoints(L.list.width, L.list.rowH, { bevel: { topLeft: 24, bottomRight: 24 } });
      card.add(drawLayer(scene, 0, 0, shape, { fill: style.deep, alpha: 0.95, edge: style.tone, edgeAlpha: row.recommended ? 0.95 : 0.6, shadow: { x: 0, y: 7 } }));
      // 안쪽 물들임 — 왼쪽(스티커 쪽)이 그 색으로 밝고 오른쪽으로 잦아든다. 판 실루엣대로 잘린다.
      const tint = scene.add.graphics();
      const inner = scaleShape(shape, (L.list.width - 6) / L.list.width, (L.list.rowH - 6) / L.list.rowH);
      fillShapeGradient(tint, inner, { from: -L.list.rowH / 2, to: L.list.rowH / 2, color: style.tone, alphaFrom: 0.2, alphaTo: 0.04 });
      card.add(tint);
      // 물무늬 — 같은 그림이 오른쪽 끝에 큼직하고 옅게 기울어 깔린다.
      card.add(drawGlyph(scene, style.glyph, L.list.width / 2 - 64, 6, L.list.rowH * 0.86, style.tone, 0.13, 3).setAngle(style.tilt * 2));
      // 작은 점 셋 — 스티커 둘레에 톡톡 찍힌 장식.
      const dots = scene.add.graphics();
      dots.fillStyle(style.tone, 0.55);
      for (const [dx, dy, r] of [[-L.list.width / 2 + 18, -L.list.rowH / 2 + 18, 4], [-L.list.width / 2 + 116, L.list.rowH / 2 - 18, 3], [-L.list.width / 2 + 108, -L.list.rowH / 2 + 14, 2.5]] as const) {
        dots.fillPoints([new Phaser.Math.Vector2(dx, dy - r), new Phaser.Math.Vector2(dx + r, dy), new Phaser.Math.Vector2(dx, dy + r), new Phaser.Math.Vector2(dx - r, dy)], true);
      }
      card.add(dots);

      // 스티커 — 그 색으로 꽉 찬 칸이 살짝 기울어 붙고, 오른쪽 위 모서리에 반짝이 하나.
      const iconSize = L.list.icon;
      const iconX = -L.list.width / 2 + 24 + iconSize / 2;
      const sticker = scene.add.container(iconX, 0).setAngle(style.tilt);
      sticker.add(drawLayer(scene, 0, 0, chipPoints(iconSize, iconSize, { bevel: { topLeft: iconSize * 0.26, bottomRight: iconSize * 0.26 } }), { fill: style.tone, alpha: 0.98, edge: 0xffffff, edgeAlpha: 0.9, shadow: { x: 3, y: 6 } }));
      sticker.add(drawGlyph(scene, style.glyph, 0, 0, iconSize * 0.56, 0xffffff, 1, 3));
      const twinkle = scene.add.graphics({ x: iconSize / 2 - 4, y: -iconSize / 2 + 4 });
      twinkle.fillStyle(0xffffff, 0.95).fillPoints([0, -11, 3, -3, 11, 0, 3, 3, 0, 11, -3, 3, -11, 0, -3, -3].reduce<Phaser.Math.Vector2[]>((points, value, i, all) => (i % 2 === 0 ? [...points, new Phaser.Math.Vector2(value, all[i + 1] ?? 0)] : points), []), true);
      sticker.add(twinkle);
      card.add(sticker);
      if (loops) {
        const wobble = scene.tweens.add({ targets: sticker, angle: { from: style.tilt, to: -style.tilt * 0.4 }, duration: 1300 + index * 170, yoyo: true, repeat: -1, ease: "Sine.InOut", delay: index * 220 });
        const shine = scene.tweens.add({ targets: twinkle, scale: { from: 0.5, to: 1.15 }, alpha: { from: 0.3, to: 1 }, duration: 700, yoyo: true, repeat: -1, delay: index * 300, ease: "Sine.InOut" });
        sticker.once(Phaser.GameObjects.Events.DESTROY, () => { wobble.remove(); shine.remove(); });
      }

      const left = iconX + iconSize / 2 + 22;
      const textWidth = L.list.width / 2 - left - 22;
      const label = scene.add.text(left, -22, row.label, textStyle({ role: "display", size: 32, color: "#ffffff" })).setOrigin(0, 0.5).setStroke("#1a0810", 5);
      squeezeTextToWidth(label, textWidth - (row.recommended ? 104 : 0));
      card.add(label);
      if (row.recommended) {
        const badge = scene.add.container(left + label.displayWidth + 56, -22);
        badge.add(drawLayer(scene, 0, 0, chipPoints(92, 38, { bevel: { topLeft: 10, bottomRight: 10 } }), { fill: 0xffd2dc, alpha: 0.98 }));
        badge.add(scene.add.text(0, 0, t("info.bond.recommend"), textStyle({ role: "display", size: 21, color: "#7a1630" })).setOrigin(0.5));
        card.add(badge);
        breathe(scene, badge, 1.08);
      }
      const amount = scene.add.text(left, 24, row.amount, textStyle({ role: "emphasis", size: 25, color: style.text })).setOrigin(0, 0.5).setStroke("#12060c", 4);
      squeezeTextToWidth(amount, textWidth);
      card.add(amount);
      // 줄이 차례로 톡톡 튀어 들어온다.
      if (loops) {
        card.setAlpha(0).setX(listX + 40);
        scene.tweens.add({ targets: card, alpha: 1, x: listX, duration: 280, delay: 200 + index * 90, ease: "Back.Out" });
      }
    });
  });
}

/** 레벨 사다리 — 1~10은 능력치, 11~20은 레벨마다 각성, 그 뒤 10레벨마다 각성. */
export function openBondLadder(ctx: BondPopupContext): void {
  const { scene, popups, relicId } = ctx;
  const level = relicProgression.getProgress(relicId).bondLevel;
  const { everyLevelFrom, everyLevelTo, stride } = BOND_AWAKENING_LADDER;
  const rungs: { from: number; to: number; text: string }[] = [
    { from: 1, to: BOND_STAT_LEVEL_CAP, text: t("info.bond.ladderStat", { percent: 1, max: bondStatPercent(BOND_STAT_LEVEL_CAP) }) },
  ];
  for (let lv = everyLevelFrom; lv <= everyLevelTo; lv += 1) rungs.push({ from: lv, to: lv, text: t("info.bond.ladderAwaken") });
  for (let lv = everyLevelTo + stride; lv <= everyLevelTo + stride * 3; lv += stride) if (bondAwakeningAtLevel(lv)) rungs.push({ from: lv, to: lv, text: t("info.bond.ladderAwaken") });
  const width = 780, rungH = 66, top = 70, footer = 96;
  const height = top + rungs.length * rungH + footer;
  popups.open({ width, height, title: t("info.bond.ladder"), dim: true, dimAlpha: 0.4 }, (body) => {
    const startY = -height / 2 + top;
    const lineX = -width / 2 + 78;
    const rail = scene.add.graphics();
    rail.lineStyle(3, BOND_PINK, 0.28).lineBetween(lineX, startY + rungH / 2, lineX, startY + (rungs.length - 0.5) * rungH);
    // 지나온 몫만 분홍으로 덧긋는다.
    const reachedCount = rungs.filter((rung) => level >= rung.to).length;
    if (reachedCount > 0) rail.lineStyle(5, BOND_PINK, 0.9).lineBetween(lineX, startY + rungH / 2, lineX, startY + (reachedCount - 0.5) * rungH);
    body.add(rail);
    rungs.forEach((rung, index) => {
      const y = startY + index * rungH + rungH / 2;
      const reached = level >= rung.to;
      const current = !reached && (index === 0 ? true : level >= rungs[index - 1].to);
      if (current) body.add(drawLayer(scene, 30, y, chipPoints(width - 90, rungH - 8, { bevel: { topLeft: 14, bottomRight: 14 } }), { fill: 0x2a1220, alpha: 0.9, edge: BOND_PINK, edgeAlpha: 0.7 }));
      const node = scene.add.graphics({ x: lineX, y });
      const r = current ? 14 : 11;
      node.fillStyle(reached ? BOND_PINK : 0x1a1018, 1).fillPoints([new Phaser.Geom.Point(0, -r), new Phaser.Geom.Point(r, 0), new Phaser.Geom.Point(0, r), new Phaser.Geom.Point(-r, 0)], true);
      node.lineStyle(2.5, reached || current ? BOND_PINK_SOFT : COLOR.inkDimHex, reached || current ? 0.95 : 0.5);
      node.strokePoints([new Phaser.Geom.Point(0, -r), new Phaser.Geom.Point(r, 0), new Phaser.Geom.Point(0, r), new Phaser.Geom.Point(-r, 0)], true);
      body.add(node);
      const label = rung.from === rung.to ? `Lv.${rung.from}` : `Lv.${rung.from} ~ ${rung.to}`;
      body.add(scene.add.text(lineX + 40, y, label, textStyle({ role: "display", size: 26, color: reached || current ? "#ffffff" : COLOR.inkDim })).setOrigin(0, 0.5));
      const text = scene.add.text(lineX + 200, y, rung.text, textStyle({ role: "emphasis", size: 23, color: reached ? BOND_PINK_TEXT : current ? COLOR.ink : COLOR.inkDim })).setOrigin(0, 0.5);
      squeezeTextToWidth(text, 300);
      body.add(text);
      const right = width / 2 - 40;
      if (reached) body.add(drawGlyph(scene, "check", right - 16, y, 30, BOND_PINK, 1, 4));
      else {
        const xp = scene.add.text(right, y, t("info.bond.totalXp", { xp: BOND_TOTAL_XP_BY_LEVEL[Math.min(BOND_LEVEL_MAX, rung.to)].toLocaleString() }), textStyle({ role: "body", size: 20, color: COLOR.inkDim })).setOrigin(1, 0.5);
        squeezeTextToWidth(xp, 200);
        body.add(xp);
      }
    });
    body.add(scene.add.text(0, height / 2 - footer / 2 - 6, t("info.bond.ladderLater", { stride }), textStyle({ role: "body", size: 23, color: COLOR.inkDim, align: "center", wrap: width - 100 })).setOrigin(0.5));
  });
}

/** 유대 각성 판의 자리. 위에서부터 머리(남은 각성 · 각성 레벨 · 초기화) → 상태창(오각형) → 다섯 줄 → 투자 내역. */
export const BOND_AWAKEN_LAYOUT = {
  width: 840, height: 1300,
  headY: 92, hintY: 156,
  screen: { y: 452, height: 520 },
  radar: { radius: 150, size: 26, dy: 26 },
  list: { top: 772, rowH: 74 },
  record: { top: 1150, height: 112 },
} as const;

/**
 * 유대 각성 — 오각형에 지금 능력치를 세우고, 다섯 축 중 하나를 눌러 각성 한 번(+2%)을 쓴다.
 * 오각형은 정보창과 같은 홀로그램 결(전투력 포함)이고, 유대가 올린 몫만 기준선 밖으로 붉게 넘친다.
 * 어디에 몇 번 썼는지가 아래 투자 내역에 남고, 초기화는 언제나 무료다.
 */
/** 판을 다시 열며 한 번 돌릴 연출 — 방금 각성한 축, 또는 방금 돌려받은 각성(투자했던 칸의 월드 좌표). */
type AwakenFx = { kind: "awaken"; key: BondAwakeningKey } | { kind: "reset"; froms: readonly FxPoint[]; refunded: number };

export function openBondAwakening(ctx: BondPopupContext, fx?: AwakenFx): void {
  const { scene, popups, relicId } = ctx;
  const L = BOND_AWAKEN_LAYOUT;
  const { width, height } = L;
  let busy = false;
  const title = t("info.bond.awaken");
  popups.open({ width, height, title, dim: true, dimAlpha: 0.5 }, (body) => {
    const top = -height / 2;
    const progress = relicProgression.getProgress(relicId);
    const total = bondAwakeningPoints(progress.bondLevel);
    const spent = bondAwakeningSpent(progress.bondAwakening);
    const left = Math.max(0, total - spent);
    const awakening = progress.bondAwakening ?? {};
    const canSpend = ctx.mutable && left > 0;
    const showReset = ctx.mutable && spent > 0;

    // 판 색 — 머리 쪽에 분홍빛이 옅게 고인다.
    const wash = scene.add.graphics();
    fillShapeGradient(wash, popupInnerShape(width, height), { from: top + 20, to: top + 300, color: BOND_PINK, alphaFrom: 0.18 });
    body.add(wash);

    // 머리 — 왼쪽에 각성 레벨 칩, 그 오른쪽에 남은 각성 수. 오른쪽 끝은 레벨 초기화와 같은 「초기화」 칩.
    const headY = top + L.headY;
    const head = scene.add.container(-width / 2 + 56, headY);
    const levelLabel = scene.add.text(0, 0, `${t("info.bond.awakenShort")} Lv.${spent}`, textStyle({ role: "display", size: 26, color: "#3a0712" })).setOrigin(0.5);
    squeezeTextToWidth(levelLabel, 180);
    const chipW = levelLabel.displayWidth + 36;
    const levelChip = scene.add.container(chipW / 2, 0);
    levelChip.add(drawLayer(scene, 0, 0, chipPoints(chipW, 48, { bevel: { topLeft: 13, bottomRight: 13 } }), { fill: BOND_PINK_SOFT, alpha: 0.96, shadow: { x: 0, y: 5 } }));
    levelChip.add(levelLabel);
    head.add(levelChip);
    const pointsX = chipW + 24;
    head.add(drawGlyph(scene, "heart", pointsX + 14, 0, 28, BOND_PINK, 1, 3));
    const pointsText = scene.add.text(pointsX + 38, 0, t("info.bond.awakenPoints", { left, total }), textStyle({ role: "display", size: 26, color: left > 0 ? "#ffd2dc" : COLOR.ink })).setOrigin(0, 0.5).setStroke("#2a0812", 5);
    squeezeTextToWidth(pointsText, width - 112 - 160 - pointsX - 38 - 20);
    head.add(pointsText);
    body.add(head);
    if (canSpend) breathe(scene, levelChip, 1.06);
    if (showReset) {
      body.add(addResetChip(scene, width / 2 - 112, headY, { width: 136, height: 54, icon: 24, size: 23 }, () => {
        if (busy) return;
        // 투자했던 줄의 자리를 지금(판이 덮이기 전) 기억해 둔다 — 돌려받은 하트가 거기서 떠오른다.
        const froms = AXIS_ORDER.flatMap((key, index) => (awakening[key] ?? 0) > 0 ? [toWorld(body, rowW / 2 - 58, top + L.list.top + index * L.list.rowH)] : []);
        openBondAwakenResetPopup(scene, popups, { ...(ctx.sdAsset ? { asset: ctx.sdAsset } : {}), level: spent, left }, () => {
          if (busy) return;
          busy = true;
          void gameApi.setBondAwakening(relicId, {}).then(() => {
            audioManager?.playUi("ui.reward");
            ctx.onChanged();
            showContentToast(scene, t("info.bond.awakenResetDone"), "info");
            popups.closeTop();
            openBondAwakening(ctx, { kind: "reset", froms, refunded: spent });
          }, (error: unknown) => { logError("bond.awakenReset", "유대 각성 초기화 실패", error); busy = false; });
        });
      }));
    }
    const hint = total === 0
      ? t("info.bond.awakenLocked", { level: BOND_AWAKENING_LADDER.everyLevelFrom })
      : t("info.bond.awakenHint", { percent: BOND_AWAKENING_PERCENT });
    body.add(scene.add.text(0, top + L.hintY, hint, textStyle({ role: "body", size: 23, color: COLOR.inkDim, align: "center", wrap: width - 100 })).setOrigin(0.5));

    // 홀로그램 상태창 — 정보창과 같은 결의 오각형(전투력 · 일렁임). 유대가 올린 몫은 기준선 밖으로 붉게 넘친다.
    const screenY = top + L.screen.y;
    paintBondStatusScreen(scene, body, 0, screenY, width - 80, L.screen.height);
    const R = L.radar;
    const radarY = screenY + R.dy;
    const radar = new StatRadar(scene, 0, radarY, R.radius, {
      size: R.size,
      colors: Object.fromEntries(AXIS_ORDER.map((key) => [key, hex(STAT_TONE[key])])),
      values: true,
      power: true,
      holo: true,
    });
    radar.draw(relicProgression.getFinalStats(relicId), R.radius, getRelic(relicId).stats);
    radar.setGain(relicProgression.getFinalStats(relicId, { withoutAwakening: true }));
    body.add(radar);

    const fxDepth = popups.baseDepth + 80;
    const spend = async (key: BondAwakeningKey, from: FxPoint): Promise<void> => {
      if (busy || !canSpend) return;
      busy = true;
      // 누르는 순간 — 버튼 둘레가 조여 들고 하트가 그 축으로 날아간다(응답을 기다리는 동안 손이 비지 않는다).
      audioManager?.playUi("ui.feed");
      playAwakenCharge(scene, fxDepth, from, radar.valueAnchor(key), BOND_PINK_SOFT);
      const nextAwakening: BondAwakening = { ...awakening, [key]: (awakening[key] ?? 0) + 1 };
      try {
        await gameApi.setBondAwakening(relicId, nextAwakening);
        audioManager?.playUi("ui.confirm");
        ctx.onChanged();
        // 같은 제목으로 갈아 끼운다 — 깜빡이지 않고 그 자리에서 수가 바뀐다.
        popups.closeTop();
        openBondAwakening(ctx, { kind: "awaken", key });
      } catch (error) {
        logError("bond.awaken", "유대 각성 실패", error);
        busy = false;
      }
    };
    if (canSpend) {
      // 오각형의 축 이름·수치를 눌러도 그 축에 각성한다 — 자리는 레이더가 이름을 세우는 규칙(바깥 31 · 25)과 같다.
      RADAR_AXES.forEach((key, index) => {
        const angle = -Math.PI / 2 + index * Math.PI * 2 / RADAR_AXES.length;
        const lx = Math.cos(angle) * (R.radius + 31);
        const ly = Math.sin(angle) * (R.radius + 25) + (index === 0 ? -(R.size + 8) / 2 : (R.size + 8) / 2);
        const hit = scene.add.rectangle(lx, radarY + ly, 140, 96, 0xffffff, 0).setInteractive({ useHandCursor: true });
        hit.on("pointerup", () => void spend(key, toWorld(body, lx, radarY + ly)));
        body.add(hit);
      });
    }

    // 다섯 줄 — 축 이름 · 각성 횟수 · 오른 % · [+].
    const listTop = top + L.list.top, rowH = L.list.rowH;
    const rowW = width - 80;
    AXIS_ORDER.forEach((key, index) => {
      const y = listTop + index * rowH;
      const count = awakening[key] ?? 0;
      const tone = STAT_TONE[key];
      body.add(drawLayer(scene, 0, y, chipPoints(rowW, rowH - 10, { bevel: { topLeft: 14, bottomRight: 14 } }), { fill: count > 0 ? 0x2a1220 : 0x141a24, alpha: 0.92, edge: count > 0 ? BOND_PINK : tone, edgeAlpha: count > 0 ? 0.6 : 0.18 }));
      body.add(scene.add.rectangle(-rowW / 2 + 12, y, 5, rowH - 30, tone, count > 0 ? 0.95 : 0.4));
      const leftX = -rowW / 2 + 36;
      body.add(scene.add.text(leftX, y, t(AXIS_LABEL[key]), textStyle({ role: "display", size: 28, color: hex(tone) })).setOrigin(0, 0.5));
      body.add(scene.add.text(leftX + 200, y, t("info.bond.awakenTimes", { count }), textStyle({ role: "emphasis", size: 25, color: count > 0 ? COLOR.ink : COLOR.inkDim })).setOrigin(0, 0.5));
      body.add(scene.add.text(leftX + 380, y, `+${awakenPercent(awakening, key)}%`, textStyle({ role: "display", size: 28, color: count > 0 ? BOND_PINK_TEXT : COLOR.inkDim })).setOrigin(0, 0.5));
      if (!ctx.mutable) return;
      const plus = scene.add.container(rowW / 2 - 58, y);
      plus.add(drawLayer(scene, 0, 0, chipPoints(84, 52, { bevel: { topLeft: 12, bottomRight: 12 } }), { fill: canSpend ? BOND_PINK : 0x2a2f38, alpha: canSpend ? 0.95 : 0.6, shadow: canSpend ? { x: 0, y: 5 } : undefined }));
      plus.add(scene.add.text(0, -2, "+", textStyle({ role: "display", size: 40, color: canSpend ? "#ffffff" : COLOR.inkDim })).setOrigin(0.5).setStroke(canSpend ? "#5a0f1c" : "#05070a", 4));
      body.add(plus);
      if (!canSpend) return;
      const hit = scene.add.rectangle(plus.x, y, 100, 66, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on("pointerdown", () => pressIn(plus));
      hit.on("pointerout", () => pressOut(plus, "normal", { pop: false }));
      hit.on("pointerup", () => { pressOut(plus); void spend(key, toWorld(body, plus.x, y)); });
      body.add(hit);
    });

    // 투자 내역 — 제 판에 제목표를 걸고, 각성한 축만 그 축 색의 칩으로 늘어놓는다.
    const recY = top + L.record.top + L.record.height / 2;
    body.add(drawLayer(scene, 0, recY, chipPoints(rowW, L.record.height, { bevel: { topLeft: 22, bottomRight: 22 } }), { fill: 0x1c0d17, alpha: 0.9, edge: BOND_PINK, edgeAlpha: 0.5, shadow: { x: 0, y: 8 } }));
    addSectionTitle(scene, -rowW / 2 + 30, recY - L.record.height / 2, t("info.bond.awakenRecord"), { size: 24, parent: body });
    const spentKeys = AXIS_ORDER.filter((key) => (awakening[key] ?? 0) > 0);
    if (spentKeys.length === 0) {
      body.add(scene.add.text(0, recY + 10, t("info.bond.awakenNone"), textStyle({ role: "emphasis", size: 24, color: COLOR.inkDim })).setOrigin(0.5));
    } else {
      const chips = spentKeys.map((key) => {
        const tone = STAT_TONE[key];
        const chip = scene.add.container(0, recY + 12);
        const text = scene.add.text(0, 0, `${t(AXIS_LABEL[key])} +${awakenPercent(awakening, key)}%`, textStyle({ role: "display", size: 24, color: "#ffffff" })).setOrigin(0.5).setStroke("#05070a", 4);
        const w = text.displayWidth + 34;
        chip.add(drawLayer(scene, 0, 0, chipPoints(w, 46, { bevel: { topLeft: 12, bottomRight: 12 } }), { fill: tone, alpha: 0.34, edge: tone, edgeAlpha: 0.95 }));
        chip.add(text);
        return { chip, w };
      });
      const gap = 14;
      const scale = Math.min(1, (rowW - 60) / (chips.reduce((sum, { w }) => sum + w, 0) + gap * (chips.length - 1)));
      let x = -(chips.reduce((sum, { w }) => sum + w * scale, 0) + gap * (chips.length - 1)) / 2;
      for (const { chip, w } of chips) {
        chip.setScale(scale).setX(x + (w * scale) / 2);
        x += w * scale + gap;
        body.add(chip);
      }
    }

    // 다시 연 판에서 한 번 — 방금 각성한 축이 터지거나, 돌려받은 하트가 남은 각성으로 돌아온다.
    if (fx) {
      scene.time.delayedCall(40, () => {
        if (!body.active) return;
        if (fx.kind === "awaken") {
          const at = radar.valueAnchor(fx.key);
          if (at) playAwakenBurst(scene, fxDepth, at, `+${BOND_AWAKENING_PERCENT}%`, BOND_PINK_SOFT);
          flashRow(scene, body, listTop + AXIS_ORDER.indexOf(fx.key) * rowH, rowW, rowH - 10, BOND_PINK);
          // 숨 쉬는 칩은 그 숨이 이미 말하므로 건드리지 않는다(부풀림이 숨을 끊는다).
          if (!canSpend) popTarget(scene, levelChip, 1.22);
          popTarget(scene, radar, 1.05);
          return;
        }
        flashRow(scene, body, screenY, width - 80, L.screen.height, BOND_PINK);
        let landed = 0;
        playAwakenRefund(scene, fxDepth, fx.froms, toWorld(head, pointsX + 14, 0), BOND_PINK_SOFT, () => {
          landed += 1;
          if (landed % 2 === 1) popTarget(scene, pointsText, 1.12);
        });
      });
    }
  });
}

/** 오각형이 축을 세우는 차례(`StatRadar`의 AXES와 같다) — 축 이름을 누르는 자리를 구할 때만 쓴다. */
const RADAR_AXES: readonly BondAwakeningKey[] = ["hp", "def", "res", "atk", "ap"];

/**
 * 유대 각성의 홀로그램 상태창 — 분홍빛 유리판, 가운데에 고이는 투영 빛, 가는 주사선, 바닥 격자,
 * 네 모서리 꺾쇠, 위에서 아래로 훑는 빛띠. 훑는 빛은 움직임 줄이기에서 서 있기만 한다.
 */
function paintBondStatusScreen(
  scene: Phaser.Scene, parent: Phaser.GameObjects.Container, x: number, y: number, width: number, height: number,
  options: { ticks?: boolean; brackets?: boolean; glowX?: number; glowY?: number } = {},
): void {
  const screen = scene.add.container(x, y);
  parent.add(screen);
  const shape = chipPoints(width, height, { bevel: { topLeft: 36, bottomRight: 36 } });
  screen.add(drawLayer(scene, 0, 0, shape, { fill: 0x170b14, alpha: 0.9, edge: BOND_PINK, edgeAlpha: 0.6, shadow: { x: 0, y: 10 } }));
  const art = scene.add.graphics();
  // 위아래로 분홍이 스며드는 띠 — 판 가장자리가 빛을 머금은 유리처럼 읽힌다.
  // 띠는 판 실루엣대로 잘라 깎인 모서리 밖으로 새지 않는다.
  const inner = scaleShape(shape, (width - 8) / width, (height - 8) / height);
  fillShapeGradient(art, inner, { from: -height / 2 + 4, to: -height / 2 + 100, color: BOND_PINK, alphaFrom: 0.16 });
  fillShapeGradient(art, inner, { from: height / 2 - 4, to: height / 2 - 100, color: BOND_PINK, alphaFrom: 0.14 });
  // 가운데 투영 빛 — 같은 실루엣을 줄여 겹쳐 안쪽에 고인다(모서리가 판과 같은 각으로 깎인다).
  const glowX = (options.glowX ?? 0) * width;
  const glowY = (options.glowY ?? 0.05) * height;
  for (let ring = 6; ring >= 1; ring -= 1) {
    const factor = 0.14 * ring;
    art.fillStyle(BOND_PINK, 0.03).fillPoints(toPoints(scaleShape(shape, factor, factor).map((v, i) => v + (i % 2 === 0 ? glowX * (1 - factor) : glowY * (1 - factor)))), true);
  }
  // 주사선.
  for (let ly = -height / 2 + 10; ly < height / 2 - 6; ly += 6) art.lineStyle(1, BOND_PINK_SOFT, 0.045).lineBetween(-width / 2 + 24, ly, width / 2 - 24, ly);
  // 양옆 세로 눈금 — 계기판 결.
  if (options.ticks !== false) for (const side of [-1, 1] as const) {
    const gx = side * (width / 2 - 34);
    for (let index = 0; index < 13; index += 1) {
      const gy = -height / 2 + 80 + index * ((height - 160) / 12);
      art.lineStyle(2, BOND_PINK_SOFT, index % 4 === 0 ? 0.5 : 0.18).lineBetween(gx, gy, gx - side * (index % 4 === 0 ? 18 : 9), gy);
    }
  }
  screen.add(art);
  const brackets = scene.add.graphics().setVisible(options.brackets !== false);
  const arm = 34, inset = 18;
  brackets.lineStyle(4, BOND_PINK_SOFT, 0.85);
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    // 깎인 두 모서리(왼쪽 위 · 오른쪽 아래)는 빗변 안쪽으로 물린다.
    const cut = (sx === -1 && sy === -1) || (sx === 1 && sy === 1) ? 30 : 0;
    const cx = sx * (width / 2 - inset - cut * 0.5), cy = sy * (height / 2 - inset - cut * 0.5);
    brackets.lineBetween(cx, cy, cx - sx * arm, cy).lineBetween(cx, cy, cx, cy - sy * arm);
  }
  screen.add(brackets);
  const sweep = scene.add.rectangle(0, -height / 2 + 30, width - 60, 3, BOND_PINK_SOFT, 0.28);
  screen.add(sweep);
  if (motionPolicy(session.settings).nonEssentialDistanceFactor <= 0) { sweep.setAlpha(0); return; }
  const tween = scene.tweens.add({ targets: sweep, y: height / 2 - 30, duration: 3200, repeat: -1, repeatDelay: 900, ease: "Sine.InOut",
    onUpdate: () => { const p = (sweep.y + height / 2) / height; sweep.setAlpha(0.32 * Math.sin(Math.PI * Math.min(1, Math.max(0, p)))); } });
  sweep.once(Phaser.GameObjects.Events.DESTROY, () => tween.remove());
}

/** 팝업 몸판과 같은 실루엣을 안쪽으로 한 뼘 줄인 것 — 판 위에 까는 빛이 이 모양을 따른다. */
function popupInnerShape(width: number, height: number, inset = 10): number[] {
  const unit = Math.min(width, height) * POPUP_BODY_BEVEL_RATIO;
  return chipPoints(width - inset * 2, height - inset * 2, { bevel: { topLeft: unit - inset * 0.41, bottomRight: unit - inset * 0.41 } });
}

/** 분홍 결의 알약 버튼 한 장(아이콘 + 글). 판 안의 작은 조작에만 쓴다. */
function addPillButton(
  scene: Phaser.Scene,
  parent: Phaser.GameObjects.Container,
  x: number, y: number, width: number, height: number,
  options: { label: string; glyph: Parameters<typeof drawGlyph>[1]; tone: number; dot?: boolean; onTap: () => void },
): Phaser.GameObjects.Container {
  const button = scene.add.container(x, y);
  const shape = chipPoints(width, height, { bevel: { topLeft: height * 0.3, bottomRight: height * 0.3 } });
  button.add(drawLayer(scene, 0, 0, shape, { fill: options.tone, alpha: 0.2, edge: options.tone, edgeAlpha: 0.9, shadow: { x: 0, y: 6 } }));
  const icon = height * 0.42;
  const label = scene.add.text(0, 0, options.label, textStyle({ role: "display", size: Math.round(height * 0.36), color: "#ffffff" })).setOrigin(0, 0.5).setStroke("#05070a", 5);
  squeezeTextToWidth(label, width - icon - 60);
  const groupWidth = icon + 12 + label.width;
  button.add(drawGlyph(scene, options.glyph, -groupWidth / 2 + icon / 2, 0, icon, options.tone, 1, 3));
  label.setX(-groupWidth / 2 + icon + 12);
  button.add(label);
  // 알림점은 화면 어디서나 같은 공용 점이다(색·크기·그림자를 여기서 다시 정하지 않는다).
  if (options.dot) new NotificationDot(scene, button, { x: width / 2 - 10, y: -height / 2 + 8 });
  parent.add(button);
  const hit = scene.add.rectangle(x, y, width, height, 0xffffff, 0).setInteractive({ useHandCursor: true });
  hit.on("pointerdown", () => pressIn(button));
  hit.on("pointerout", () => pressOut(button, "normal", { pop: false }));
  hit.on("pointerup", () => { pressOut(button); options.onTap(); });
  parent.add(hit);
  return button;
}

/** 레벨 옆 작은 돋보기 칩. */
function addSmallMagnifier(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, x: number, y: number, onTap: () => void): void {
  const size = 50;
  const chip = scene.add.container(x, y);
  chip.add(drawLayer(scene, 0, 0, chipPoints(size, size, { bevel: { topLeft: size * 0.3, bottomRight: size * 0.3 } }), { fill: 0x121820, alpha: 0.9, edge: BOND_PINK, edgeAlpha: 0.7, shadow: { x: 0, y: 5 } }));
  chip.add(drawGlyph(scene, "magnifier", 0, 0, size * 0.58, BOND_PINK, 1, 4));
  parent.add(chip);
  const hit = scene.add.rectangle(x, y, 80, 80, 0xffffff, 0).setInteractive({ useHandCursor: true });
  hit.on("pointerdown", () => pressIn(chip));
  hit.on("pointerout", () => pressOut(chip, "normal", { pop: false }));
  hit.on("pointerup", () => { pressOut(chip); onTap(); });
  parent.add(hit);
}

/** 느리게 숨 쉬기. 움직임 줄이기면 서 있기만 한다. */
function breathe(scene: Phaser.Scene, target: Phaser.GameObjects.Container, to: number): void {
  if (motionPolicy(session.settings).nonEssentialDistanceFactor <= 0) return;
  const tween = scene.tweens.add({ targets: target, scale: { from: 1, to }, duration: 900, yoyo: true, repeat: -1, ease: "Sine.InOut" });
  target.once(Phaser.GameObjects.Events.DESTROY, () => tween.remove());
}
