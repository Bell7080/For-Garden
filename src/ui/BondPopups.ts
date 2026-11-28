import Phaser from "phaser";
import { t, type TextKey } from "../i18n";
import {
  BOND_AWAKENING_LADDER, BOND_AWAKENING_PERCENT, BOND_STAT_LEVEL_CAP, BOND_LEVEL_MAX, BOND_TOTAL_XP_BY_LEVEL, BOND_XP_REWARD,
  bondAwakeningAtLevel, bondAwakeningPoints, bondAwakeningSpent, bondStatPercent, storyVictoryBondXp,
  type BondAwakening, type BondAwakeningKey,
} from "../core/bond";
import { BOND_STORY_GEM_REWARD, type BondStoryLevel } from "../core/relicStory";
import { relicStoryFor } from "../data/relicStories";
import { CHAPTERS } from "../data/stages";
import { relicStories } from "../managers/RelicStoryManager";
import { relicProgression } from "../managers/RelicProgressionManager";
import { gameApi } from "../api/FakeServer";
import { logError } from "../managers/ErrorReporter";
import { audioManager } from "../managers/AudioManager";
import { motionPolicy } from "../core/settings";
import { session } from "../state/session";
import { DIALOGUE_BACKDROP } from "./dialogueStageLayout";
import { chipPoints, drawLayer, HoloBar } from "./holo";
import { drawGlyph } from "./glyphs";
import { addSectionTitle } from "./SectionTitle";
import { paintStoryRowArt } from "./bondStoryRowArt";
import { RewardFrame } from "./RewardFrame";
import { StatRadar } from "./StatRadar";
import { STAT_TONE } from "./statTones";
import { pressIn, pressOut } from "./pressFeedback";
import { shrinkTextToWidth, squeezeTextToWidth } from "./textFit";
import { showContentToast } from "./ContentToast";
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
    glow.fillGradientStyle(BOND_PINK, BOND_PINK, BOND_PINK, BOND_PINK, 0.16, 0.16, 0, 0);
    glow.fillRect(-L.width / 2 + 20, -L.height / 2 + 40, L.width - 40, 420);
    body.add(glow);
    addFloatingHearts(scene, body, L.width, 440, -L.height / 2 + 60);

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

/** 유대 획득 방법 — 스토리 반복 전투를 추천하고 다른 길을 함께 적는다. */
export function openBondGuide(ctx: BondPopupContext): void {
  const { scene, popups } = ctx;
  const width = 800;
  const lastChapter = Math.max(1, CHAPTERS.length);
  const rows: { label: string; amount: string; recommended?: boolean }[] = [
    { label: t("info.bond.storyBattle"), amount: t("info.bond.storyBattleAmount", { from: storyVictoryBondXp(1), to: storyVictoryBondXp(lastChapter) }), recommended: true },
    { label: t("cake.title"), amount: t("info.bond.partyAll", { amount: `${BOND_XP_REWARD.partyVictory} EXP` }) },
    { label: t("info.bond.lobbyInteraction"), amount: t("info.bond.oncePerDay", { amount: `${BOND_XP_REWARD.firstLobbyInteraction} EXP` }) },
    { label: t("info.bond.interview"), amount: t("info.bond.oncePerDay", { amount: `${BOND_XP_REWARD.firstObservationInterview} EXP` }) },
    { label: t("info.bond.firstMeet"), amount: t("info.bond.once", { amount: `${BOND_XP_REWARD.firstAcquisition} EXP` }) },
  ];
  const rowH = 104, gap = 14, top = 150;
  const height = top + rows.length * (rowH + gap) + 90;
  popups.open({ width, height, title: t("info.bond.howToTitle"), dim: true, dimAlpha: 0.4 }, (body) => {
    const startY = -height / 2;
    // 추천 한 줄 — 하트 둘 사이에 분홍 글.
    const tip = scene.add.text(0, startY + 92, t("info.bond.recommendLine"), textStyle({ role: "emphasis", size: 26, color: BOND_PINK_TEXT, align: "center", wrap: width - 120 })).setOrigin(0.5);
    body.add(tip);
    rows.forEach((row, index) => {
      const y = startY + top + index * (rowH + gap) + rowH / 2;
      const shape = chipPoints(width - 80, rowH, { bevel: { topLeft: 22, bottomRight: 22 } });
      body.add(drawLayer(scene, 0, y, shape, { fill: row.recommended ? 0x2a1220 : 0x141b26, alpha: 0.92, edge: row.recommended ? BOND_PINK : COLOR.accent, edgeAlpha: row.recommended ? 0.7 : 0.2 }));
      const left = -(width - 80) / 2 + 40;
      const label = scene.add.text(left, y - 20, row.label, textStyle({ role: "display", size: 28, color: "#ffffff" })).setOrigin(0, 0.5);
      body.add(label);
      if (row.recommended) {
        const badge = scene.add.container(left + label.width + 66, y - 20);
        badge.add(drawLayer(scene, 0, 0, chipPoints(96, 38, { bevel: { topLeft: 10, bottomRight: 10 } }), { fill: BOND_PINK, alpha: 0.95 }));
        badge.add(scene.add.text(0, 0, t("info.bond.recommend"), textStyle({ role: "emphasis", size: 21, color: "#3a0712" })).setOrigin(0.5));
        body.add(badge);
        breathe(scene, badge, 1.08);
      }
      const amount = scene.add.text(left, y + 22, row.amount, textStyle({ role: "body", size: 23, color: row.recommended ? BOND_PINK_TEXT : COLOR.inkDim })).setOrigin(0, 0.5);
      squeezeTextToWidth(amount, width - 160);
      body.add(amount);
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

/**
 * 유대 각성 — 오각형에 지금 능력치를 세우고, 다섯 축 중 하나를 눌러 각성 한 번(+2%)을 쓴다.
 * 어디에 몇 번 썼는지가 아래 줄에 남고, 초기화는 언제나 무료다.
 */
export function openBondAwakening(ctx: BondPopupContext): void {
  const { scene, popups, relicId } = ctx;
  const width = 820, height = 1240;
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

    // 남은 횟수 — 판 머리에 크게.
    const head = scene.add.container(0, top + 120);
    head.add(drawLayer(scene, 0, 0, chipPoints(560, 96, { bevel: { topLeft: 24, bottomRight: 24 } }), { fill: 0x2a1220, alpha: 0.88, edge: 0xffb36b, edgeAlpha: 0.6 }));
    head.add(scene.add.text(0, 0, t("info.bond.awakenPoints", { left, total }), textStyle({ role: "display", size: 38, color: left > 0 ? "#ffd59a" : COLOR.ink })).setOrigin(0.5).setStroke("#2a1205", 6));
    body.add(head);
    if (left > 0 && ctx.mutable) breathe(scene, head, 1.03);
    const hint = total === 0
      ? t("info.bond.awakenLocked", { level: BOND_AWAKENING_LADDER.everyLevelFrom })
      : t("info.bond.awakenHint", { percent: BOND_AWAKENING_PERCENT });
    body.add(scene.add.text(0, top + 196, hint, textStyle({ role: "body", size: 23, color: COLOR.inkDim, align: "center", wrap: width - 100 })).setOrigin(0.5));

    // 오각형 — 지금 능력치. 축 이름을 눌러도 각성한다.
    const radarY = top + 470;
    const radar = new StatRadar(scene, 0, radarY, 170, {
      size: 26,
      colors: Object.fromEntries(AXIS_ORDER.map((key) => [key, hex(STAT_TONE[key])])),
      values: true,
    });
    radar.draw(relicProgression.getFinalStats(relicId), 170);
    body.add(radar);

    const spend = async (key: BondAwakeningKey): Promise<void> => {
      if (busy || !canSpend) return;
      busy = true;
      const nextAwakening: BondAwakening = { ...awakening, [key]: (awakening[key] ?? 0) + 1 };
      try {
        await gameApi.setBondAwakening(relicId, nextAwakening);
        audioManager?.playUi("ui.confirm");
        ctx.onChanged();
        // 같은 제목으로 갈아 끼운다 — 깜빡이지 않고 그 자리에서 수가 바뀐다.
        popups.closeTop();
        openBondAwakening(ctx);
      } catch (error) {
        logError("bond.awaken", "유대 각성 실패", error);
        busy = false;
      }
    };
    AXIS_ORDER.forEach((key) => {
      const anchor = radar.valueAnchor(key);
      if (!anchor || !canSpend) return;
      const hit = scene.add.rectangle(anchor.x, radarY + anchor.y, 150, 90, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on("pointerup", () => void spend(key));
      body.add(hit);
    });

    // 다섯 줄 — 축 이름 · 각성 횟수 · 오른 % · [+].
    const listTop = top + 720, rowH = 74;
    AXIS_ORDER.forEach((key, index) => {
      const y = listTop + index * rowH;
      const count = awakening[key] ?? 0;
      const tone = STAT_TONE[key];
      body.add(drawLayer(scene, 0, y, chipPoints(width - 100, rowH - 10, { bevel: { topLeft: 14, bottomRight: 14 } }), { fill: count > 0 ? 0x1f1a14 : 0x121820, alpha: 0.9, edge: tone, edgeAlpha: count > 0 ? 0.55 : 0.18 }));
      const leftX = -(width - 100) / 2 + 36;
      body.add(scene.add.text(leftX, y, t(AXIS_LABEL[key]), textStyle({ role: "display", size: 28, color: hex(tone) })).setOrigin(0, 0.5));
      body.add(scene.add.text(leftX + 200, y, t("info.bond.awakenTimes", { count }), textStyle({ role: "emphasis", size: 25, color: count > 0 ? COLOR.ink : COLOR.inkDim })).setOrigin(0, 0.5));
      body.add(scene.add.text(leftX + 380, y, `+${awakenPercent(awakening, key)}%`, textStyle({ role: "display", size: 28, color: count > 0 ? "#ffd59a" : COLOR.inkDim })).setOrigin(0, 0.5));
      if (!ctx.mutable) return;
      const plus = scene.add.container((width - 100) / 2 - 58, y);
      plus.add(drawLayer(scene, 0, 0, chipPoints(84, 52, { bevel: { topLeft: 12, bottomRight: 12 } }), { fill: canSpend ? 0xffb36b : 0x2a2f38, alpha: canSpend ? 0.95 : 0.6 }));
      plus.add(scene.add.text(0, -2, "+", textStyle({ role: "display", size: 40, color: canSpend ? "#2a1205" : COLOR.inkDim })).setOrigin(0.5));
      body.add(plus);
      if (!canSpend) return;
      const hit = scene.add.rectangle(plus.x, y, 100, 66, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on("pointerdown", () => pressIn(plus));
      hit.on("pointerout", () => pressOut(plus, "normal", { pop: false }));
      hit.on("pointerup", () => { pressOut(plus); void spend(key); });
      body.add(hit);
    });

    // 투자 내역 · 무료 초기화.
    const footY = listTop + AXIS_ORDER.length * rowH + 20;
    const record = bondAwakeningSummary(awakening);
    body.add(scene.add.text(-width / 2 + 56, footY, t("info.bond.awakenRecord"), textStyle({ role: "emphasis", size: 22, color: COLOR.inkDim })).setOrigin(0, 0.5));
    const recordText = scene.add.text(-width / 2 + 56, footY + 36, record || t("info.bond.awakenNone"), textStyle({ role: "body", size: 23, color: record ? COLOR.ink : COLOR.inkDim })).setOrigin(0, 0.5);
    squeezeTextToWidth(recordText, width - 360);
    body.add(recordText);
    if (ctx.mutable && spent > 0) {
      addPillButton(scene, body, width / 2 - 150, footY + 18, 210, 66, {
        label: t("info.bond.awakenReset"), glyph: "refresh", tone: 0x8fe8ff,
        onTap: () => {
          if (busy) return;
          popups.confirm({ title, message: t("info.bond.awakenResetConfirm"), confirmLabel: t("info.bond.awakenReset") }, () => {
            if (busy) return;
            busy = true;
            void gameApi.setBondAwakening(relicId, {}).then(() => {
              ctx.onChanged();
              showContentToast(scene, t("info.bond.awakenResetDone"), "info");
              popups.closeTop();
              openBondAwakening(ctx);
            }, (error: unknown) => { logError("bond.awakenReset", "유대 각성 초기화 실패", error); busy = false; });
          });
        },
      });
    }
  });
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
  if (options.dot) button.add(scene.add.circle(width / 2 - 12, -height / 2 + 10, 9, COLOR.danger, 1).setStrokeStyle(2, 0x05070a));
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

/** 판 머리에 작은 하트 몇 개가 천천히 떠오른다 — 난수 없이 번호에서 자리·박자를 정한다. */
function addFloatingHearts(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, width: number, height: number, top: number): void {
  const still = motionPolicy(session.settings).nonEssentialDistanceFactor <= 0;
  const count = 7;
  for (let index = 0; index < count; index += 1) {
    const x = -width / 2 + 70 + ((index * 0.61803) % 1) * (width - 140);
    const y = top + height * (0.3 + ((index * 0.381966) % 1) * 0.6);
    const heart = drawGlyph(scene, "heart", x, y, 18 + (index % 3) * 8, BOND_PINK_SOFT, 0.22 + (index % 2) * 0.1, 2);
    parent.add(heart);
    if (still) continue;
    const tween = scene.tweens.add({
      targets: heart, y: y - 60, alpha: 0, duration: 3200 + index * 280, delay: index * 420, repeat: -1, ease: "Sine.Out",
    });
    heart.once(Phaser.GameObjects.Events.DESTROY, () => tween.remove());
  }
}
