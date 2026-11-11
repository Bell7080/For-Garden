import Phaser from "phaser";
import type { Element, RelicDef } from "../core/types";
import { raidGuide, raidGuideElements, type RaidGuide, type RaidGuidePointKind, type RaidGuideSlot } from "../data/raidGuides";
import { getRelic } from "../data/relics";
import { setDebugRaidGuideAlt, setDebugRaidGuideWhy } from "../debug";
import { t, type TextKey } from "../i18n";
import { settingsManager } from "../managers/SettingsManager";
import { AffinityBadge } from "./AffinityBadge";
import { AFFINITY_GLOW, ELEMENT_ICON, ROLE_ICON } from "./affinityIcons";
import { FaceFrame } from "./FaceFrame";
import { drawGlyph } from "./glyphs";
import { chipPoints, drawLayer, slantedRect } from "./holo";
import { elementLabel } from "./info";
import { PopupLayer } from "./PopupLayer";
import { pressIn, pressOut } from "./pressFeedback";
import { RAID_GUIDE_BUTTON, RAID_GUIDE_POPUP as L } from "./raidLayout";
import { clipHit, containerClip } from "./clippedHit";
import { attachGuideScroll, GUIDE_MASK_BLEED } from "./raidGuideScroll";
import { addSectionTitle } from "./SectionTitle";
import { addSkillIconFrame, skillSlotLabel } from "./SkillIconFrame";
import { COLOR, textStyle } from "./theme";

/**
 * 레이드 공략법 — 시즌 판의 「공략법!」 버튼과 그것이 여는 창.
 *
 * 무엇을 말하나(패턴·추천·이유)는 `data/raidGuides.ts`와 문구 표가 갖고, 이 파일은 **그리기만** 한다.
 * 수치는 보스 정의에서 읽어 문장에 채우므로 스킬을 고치면 공략 문장도 함께 바뀐다.
 */

/** 노랑 버튼의 색 한 벌. 판 위의 다른 조작(붉은 출격·금빛 강조)과 갈려 "읽을거리"로 먼저 읽힌다. */
const BUTTON_TONE = { fill: 0xf2cc4a, shade: 0x8a5a14, ink: "#2a1a06", sparkle: 0xfff6c8 } as const;

/** 유리·불리 줄의 색. 녹색은 "이쪽을 데려가라", 붉은빛은 "이쪽은 피하라"다. */
const ELEMENT_ROW_TONE = { strong: { fill: 0x2f6b45, text: "#a6e6b8" }, weak: { fill: 0x7a2f2f, text: "#f0a9a0" } } as const;

/**
 * 「공략법!」 버튼. 통통 숨 쉬고 반짝이가 톡 켜지는 작은 노랑 칩이다 — 움직임 줄이기에서는 가만히 선다.
 * 누르면 공략법 창을 연다.
 */
export function addRaidGuideButton(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, popups: PopupLayer, bossId: string): void {
  const guide = raidGuide(bossId);
  if (!guide) return;
  const B = RAID_GUIDE_BUTTON;
  const button = scene.add.container(B.x, B.y);
  const shape = slantedRect(B.width, B.height, 18);
  // 아래로 민 짙은 호박 복제가 두께를 만들고, 위에 노랑 면이 얹혀 말랑한 젤리처럼 보인다.
  button.add(drawLayer(scene, 0, 7, shape, { fill: BUTTON_TONE.shade, alpha: 1 }));
  button.add(drawLayer(scene, 0, 0, shape, { fill: BUTTON_TONE.fill, alpha: 1, edge: 0xffffff, edgeAlpha: 0.8, shadow: true }));
  const glyphX = -B.width / 2 + 40;
  button.add(drawGlyph(scene, "magnifier", glyphX, -1, 38, 0x2a1a06, 1, 5));
  const label = scene.add.text(glyphX + 30, -2, t("raid.guide.button"), textStyle({ role: "display", size: 32, color: BUTTON_TONE.ink })).setOrigin(0, 0.5);
  const room = B.width / 2 - 16 - label.x;
  if (label.width > room) label.setScale(Math.max(0.6, room / label.width), 1);
  button.add(label);
  const sparkle = drawSparkle(scene, B.width / 2 - 14, -B.height / 2 + 4, 18);
  button.add(sparkle);
  parent.add(button);

  const hit = scene.add.rectangle(0, 0, B.width + 20, B.height + 24, 0xffffff, 0).setInteractive({ useHandCursor: true });
  button.add(hit);
  hit.on("pointerdown", () => pressIn(button));
  hit.on("pointerout", () => pressOut(button, "normal", { pop: false }));
  hit.on("pointerup", () => { pressOut(button); openRaidGuidePopup(scene, popups, guide); });

  if (settingsManager.get().accessibility.reduceMotion) return;
  // 버튼은 제자리에서 살짝 떠올랐다 내려앉고, 반짝이는 그와 엇갈린 박자로 켜졌다 꺼진다.
  scene.tweens.add({ targets: button, y: B.y - 6, duration: 900, ease: "Sine.easeInOut", yoyo: true, repeat: -1 });
  scene.tweens.add({ targets: sparkle, alpha: { from: 0.15, to: 1 }, scale: { from: 0.6, to: 1.15 }, duration: 520, ease: "Sine.easeInOut", yoyo: true, repeat: -1, repeatDelay: 700 });
}

/** 네 갈래 별 반짝이. 동그라미가 아니라 마름모 두 개를 엇갈려 겹친다. */
function drawSparkle(scene: Phaser.Scene, x: number, y: number, size: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics({ x, y });
  const r = size / 2;
  g.fillStyle(BUTTON_TONE.sparkle, 1);
  g.fillPoints([new Phaser.Math.Vector2(0, -r), new Phaser.Math.Vector2(r * 0.28, 0), new Phaser.Math.Vector2(0, r), new Phaser.Math.Vector2(-r * 0.28, 0)], true);
  g.fillPoints([new Phaser.Math.Vector2(-r, 0), new Phaser.Math.Vector2(0, -r * 0.28), new Phaser.Math.Vector2(r, 0), new Phaser.Math.Vector2(0, r * 0.28)], true);
  return g;
}

function skillName(def: RelicDef, slot: RaidGuideSlot): string {
  if (slot === "passive") return def.passive.name;
  if (slot === "basic") return def.basic.name;
  if (slot === "ultimate") return def.ultimate.name;
  return def.ferocityTrait.name;
}

/** 펼침 상태. 둘은 따로 여닫히고, 갈아 끼운 창은 지난 스크롤을 이어 받는다. */
export interface RaidGuideView {
  /** 추천 렐릭의 이유가 펼쳐져 있는가. */
  why: boolean;
  /** 차선책이 펼쳐져 있는가. */
  alt: boolean;
  /** 지난 창의 스크롤 — 다시 세운 창이 맨 위로 튀지 않게 이어 받는다. */
  scroll?: number;
  /** 방금 펼친 칸. 창이 그 칸이 보이도록 스크롤을 옮긴다. */
  reveal?: "why" | "alt";
}

/** 이유 줄 앞 이름표의 색. 상성만은 그 렐릭의 속성 색을 쓴다 — 같은 색 아이콘이 카드 위에 이미 서 있다. */
const POINT_TONE: Readonly<Record<Exclude<RaidGuidePointKind, "element">, number>> = { control: 0x9db8ff, survive: 0x86dba6, damage: 0xffad78 };


/**
 * 공략법 창. 펼치기는 같은 제목의 창을 다시 여는 갈아 끼우기라 깜빡이지 않는다
 * (`PopupLayer.takeRefreshedLayer`). 이유와 차선책을 모두 펼쳐 화면보다 길어지면 넘치는 만큼 판 안에서 흐른다.
 */
export function openRaidGuidePopup(scene: Phaser.Scene, popups: PopupLayer, guide: RaidGuide, view: RaidGuideView = { why: false, alt: false }): void {
  const boss = getRelic(guide.bossId);
  const rec = getRelic(guide.recommendedRelicId);
  const track = scene.add.container(0, 0);
  const content = track;
  const half = L.inner / 2;
  const tone = AFFINITY_GLOW[ELEMENT_ICON[boss.element]];
  let y = 0;

  // ── 머리: 보스 얼굴 · 이름 · 속성/직군 · 한 줄 별명 ─────────────────
  const heroY = y + L.heroHeight / 2;
  const heroShape = chipPoints(L.inner + 40, L.heroHeight, { bevel: { topLeft: 34, topRight: 0, bottomRight: 34, bottomLeft: 0 } });
  content.add(drawLayer(scene, 0, heroY, heroShape, { fill: 0x0c1118, alpha: 0.94, edge: tone, edgeAlpha: 0.9 }));
  // 속성 색이 왼쪽 얼굴 뒤에서 은은하게 번진다 — 판 전체를 칠하면 글이 묻힌다.
  content.add(drawLayer(scene, -half + L.heroFace / 2 + 10, heroY, slantedRect(L.heroFace + 90, L.heroHeight - 28, 20), { fill: tone, alpha: 0.2 }));
  content.add(new FaceFrame(scene, -half + L.heroFace / 2 + 14, heroY, { portraitAssetId: boss.portraitAssetId, size: L.heroFace, color: tone }));
  const textX = -half + L.heroFace + 50;
  const textWidth = half - textX;
  const name = scene.add.text(textX, heroY - 78, boss.name, textStyle({ role: "display", size: 46, color: COLOR.ink })).setOrigin(0, 0.5);
  content.add(name);
  const badgeX = Math.min(textX + name.width + 40, half - 74);
  content.add(new AffinityBadge(scene, badgeX, heroY - 78, ELEMENT_ICON[boss.element], 50, 0.6));
  content.add(new AffinityBadge(scene, badgeX + 56, heroY - 78, ROLE_ICON[boss.role], 42, 0.6));
  content.add(scene.add.text(textX, heroY - 22, t(`raid.guide.${guide.bossId}.headline` as TextKey), textStyle({ role: "emphasis", size: 30, color: COLOR.accentText, wrap: textWidth })).setOrigin(0, 0.5));
  // 약점 표 — 판 안 아래쪽에 붉은 이름표 + 한 줄.
  const tagY = heroY + 56;
  const tagLabel = scene.add.text(0, 0, t("raid.guide.weakness"), textStyle({ role: "display", size: 24, color: "#ffffff" })).setOrigin(0.5);
  const tagW = tagLabel.width + 34;
  content.add(drawLayer(scene, textX + tagW / 2, tagY, slantedRect(tagW, 40, 10), { fill: 0xb03a3a, alpha: 1 }));
  content.add(tagLabel.setPosition(textX + tagW / 2, tagY));
  content.add(scene.add.text(textX + tagW + 14, tagY, t(`raid.guide.${guide.bossId}.weakness` as TextKey), textStyle({ role: "emphasis", size: 24, color: COLOR.ink, wrap: textWidth - tagW - 14 })).setOrigin(0, 0.5));
  y += L.heroHeight + 26;

  const summary = scene.add.text(-half, y, t(`raid.guide.${guide.bossId}.summary` as TextKey), textStyle({ role: "body", size: 26, color: COLOR.ink, wrap: L.inner })).setOrigin(0, 0);
  content.add(summary);
  y += summary.height + L.sectionGap;

  // ── 속성 상성 ─────────────────────────────────────────────
  addSectionTitle(scene, -half - 10, y, t("raid.guide.section.element"), { size: 30, parent: content });
  y += L.sectionTitleRoom;
  const { strong, weak } = raidGuideElements(boss.element);
  y = addElementRow(scene, content, y, "strong", strong);
  y = addElementRow(scene, content, y + 14, "weak", weak);
  y += L.sectionGap;

  // ── 패턴과 대처 ───────────────────────────────────────────
  addSectionTitle(scene, -half - 10, y, t("raid.guide.section.pattern"), { size: 30, parent: content });
  y += L.sectionTitleRoom;
  guide.patterns.forEach((pattern, index) => {
    if (index > 0) y += L.patternGap;
    const iconX = -half + L.patternIcon / 2;
    const textLeft = -half + L.patternIcon + 26;
    const title = scene.add.text(textLeft, y, skillName(boss, pattern.slot), textStyle({ role: "display", size: 28, color: COLOR.accentText })).setOrigin(0, 0);
    const slot = scene.add.text(title.x + title.width + 14, y + 6, skillSlotLabel(pattern.slot), textStyle({ role: "emphasis", size: 21, color: COLOR.inkDim })).setOrigin(0, 0);
    const desc = scene.add.text(textLeft, y + title.height + 8, t(`raid.guide.${guide.bossId}.pattern.${pattern.slot}` as TextKey, pattern.values(boss)), textStyle({ role: "body", size: 24, color: COLOR.ink, wrap: half - textLeft })).setOrigin(0, 0);
    const rowHeight = Math.max(L.patternIcon, title.height + 8 + desc.height);
    const icon = addSkillIconFrame(scene, { size: L.patternIcon, slot: pattern.slot, relicId: boss.id, element: boss.element, role: boss.role });
    icon.setPosition(iconX, y + Math.min(rowHeight, L.patternIcon) / 2);
    content.add([icon, title, slot, desc]);
    y += rowHeight;
  });
  y += L.sectionGap;

  // ── 추천 렐릭 ─────────────────────────────────────────────
  addSectionTitle(scene, -half - 10, y, t("raid.guide.section.recommend"), { size: 30, parent: content });
  y += L.sectionTitleRoom;
  const cardTop = y;
  const headHeight = L.recommendFace + 32;
  // 이유는 판을 먼저 그려야 그 위에 얹히므로 따로 쌓아 두고 높이부터 잰다.
  const reason = view.why ? buildReasonPoints(scene, guide, rec) : undefined;
  const cardHeight = headHeight + (reason ? reason.height + L.reasonPad * 2 : 0);
  const recTone = AFFINITY_GLOW[ELEMENT_ICON[rec.element]];
  const card = chipPoints(L.inner + 40, cardHeight, { bevel: { topLeft: 26, topRight: 0, bottomRight: 26, bottomLeft: 0 } });
  content.add(drawLayer(scene, 0, cardTop + cardHeight / 2, card, { fill: 0x101720, alpha: 0.94, edge: COLOR.accent, edgeAlpha: 0.6 }));
  const headY = cardTop + headHeight / 2;
  content.add(new FaceFrame(scene, -half + L.recommendFace / 2 + 4, headY, { portraitAssetId: rec.portraitAssetId, size: L.recommendFace, color: recTone }));
  const recX = -half + L.recommendFace + 34;
  const recName = scene.add.text(recX, headY - 26, rec.name, textStyle({ role: "display", size: 40, color: COLOR.ink })).setOrigin(0, 0.5);
  content.add(recName);
  content.add(new AffinityBadge(scene, recX + 26, headY + 30, ELEMENT_ICON[rec.element], 44, 0.6));
  content.add(new AffinityBadge(scene, recX + 78, headY + 30, ROLE_ICON[rec.role], 38, 0.6));
  content.add(scene.add.text(recX + 112, headY + 30, elementLabel(rec.element), textStyle({ role: "emphasis", size: 24, color: COLOR.inkDim })).setOrigin(0, 0.5));

  // 이유 보기 — 누르면 같은 창이 이유를 펼친 채 다시 선다.
  const whyW = 196;
  const why = scene.add.container(half - whyW / 2, headY);
  why.add(drawLayer(scene, 0, 0, slantedRect(whyW, 64, 14), { fill: view.why ? 0x2a3442 : COLOR.accent, alpha: 1, edge: 0xffffff, edgeAlpha: 0.5 }));
  const whyText = scene.add.text(0, 0, `${t(view.why ? "raid.guide.why.close" : "raid.guide.why.open")} ${view.why ? "▴" : "▾"}`, textStyle({ role: "display", size: 25, color: view.why ? COLOR.ink : "#1b1206" })).setOrigin(0.5);
  if (whyText.width > whyW - 20) whyText.setScale((whyW - 20) / whyText.width, 1);
  why.add(whyText);
  const whyHit = scene.add.rectangle(0, 0, whyW + 16, 80, 0xffffff, 0);
  why.add(whyHit);
  content.add(why);
  // 이름이 길면 버튼 앞에서 줄인다.
  const nameRoom = half - whyW - 20 - recX;
  if (recName.width > nameRoom) recName.setScale(Math.max(0.6, nameRoom / recName.width), 1);

  if (reason) {
    const lineY = cardTop + headHeight;
    content.add(scene.add.rectangle(0, lineY, L.inner - 20, 2, COLOR.accent, 0.4));
    reason.node.setY(lineY + L.reasonPad);
    content.add(reason.node);
  }
  y = cardTop + cardHeight;
  const whyRange = { top: cardTop, bottom: y };

  // ── 차선책 — 화살표 줄을 누르면 펼쳐진다 ─────────────────────────
  y += 18;
  const altTop = y;
  const alternatives = guide.alternativeRelicIds.map((id) => getRelic(id));
  const altBar = addAlternativeBar(scene, content, y, alternatives, view.alt);
  y += L.altBar;
  if (view.alt) {
    alternatives.forEach((alt) => {
      y += 12;
      y += addAlternativeRow(scene, content, y, guide, alt);
    });
  }
  const altRange = { top: altTop, bottom: y };

  // ── 창 높이와 스크롤 ───────────────────────────────────────
  const total = y;
  const height = Math.min(L.maxHeight, L.top + total + L.bottom);
  const viewHeight = height - L.top - L.bottom;
  const maxScroll = Math.max(0, total - viewHeight);
  let scroll = Phaser.Math.Clamp(view.scroll ?? 0, 0, maxScroll);
  // 이유를 펼칠 때는 그 아래 차선책 칸까지 함께 보이게 내린다 — 펼친 뒤에도 다음 화살표가 손 닿는 자리에 남는다.
  const range = view.reveal === "why" ? { top: whyRange.top, bottom: altTop + L.altBar } : view.reveal === "alt" ? altRange : undefined;
  if (range) {
    // 펼친 칸의 밑동이 보이게 내리되, 칸의 머리가 창 위로 넘어가지는 않게 한다.
    const lo = range.bottom - viewHeight + 12;
    const hi = range.top - 40;
    scroll = Phaser.Math.Clamp(lo > hi ? hi : Phaser.Math.Clamp(scroll, lo, hi), 0, maxScroll);
  }
  track.setY(-scroll);
  const frame = scene.add.container(0, -height / 2 + L.top);
  frame.add(track);
  // 흐르는 창 밖으로 밀린 버튼은 손을 받지 않는다 — 마스크는 그리기만 자른다.
  const clip = containerClip(frame, -L.width / 2, -GUIDE_MASK_BLEED, L.width / 2, viewHeight + GUIDE_MASK_BLEED);
  clipHit(whyHit, clip);
  clipHit(altBar.hit, clip);

  let dragged = false;
  let close: () => void = () => undefined;
  const reopen = (next: RaidGuideView): void => {
    close();
    openRaidGuidePopup(scene, popups, guide, { ...next, scroll });
  };
  const bindToggle = (target: Phaser.GameObjects.Container, hit: Phaser.GameObjects.GameObject, next: () => RaidGuideView): void => {
    hit.on("pointerdown", () => pressIn(target));
    hit.on("pointerout", () => pressOut(target, "normal", { pop: false }));
    hit.on("pointerup", () => {
      pressOut(target);
      if (dragged) return;
      reopen(next());
    });
  };
  bindToggle(why, whyHit, () => ({ why: !view.why, alt: view.alt, reveal: view.why ? undefined : "why" }));
  bindToggle(altBar.node, altBar.hit, () => ({ why: view.why, alt: !view.alt, reveal: view.alt ? undefined : "alt" }));

  popups.open({ width: L.width, height, title: t("raid.guide.title"), dim: true, dimAlpha: 0.5, closeOnBackdrop: true, backButton: true }, (body, closeFn) => {
    close = closeFn;
    body.add(frame);
    const publishDebug = (): void => {
      const screenY = (local: number): number => scene.scale.height / 2 + frame.y - scroll + local;
      setDebugRaidGuideWhy({ x: scene.scale.width / 2 + why.x, y: screenY(why.y) });
      setDebugRaidGuideAlt({ x: scene.scale.width / 2 + altBar.node.x, y: screenY(altBar.node.y) });
    };
    publishDebug();
    if (maxScroll > 0) attachGuideScroll(scene, frame, track, viewHeight, maxScroll, () => scroll, (value) => { scroll = value; publishDebug(); }, (value) => { dragged = value; });
  });
}

/**
 * 추천 이유 — 갈래별 한 줄. 줄 앞의 같은 폭 색 이름표(상성·제어·생존)가 무엇에 대한 이유인지를 먼저 말하고,
 * 글줄은 이름표 오른쪽 한 세로줄에서 시작한다. 긴 문단 하나였을 때는 끝까지 읽어야 요점이 나왔다.
 */
function buildReasonPoints(scene: Phaser.Scene, guide: RaidGuide, rec: RelicDef): { node: Phaser.GameObjects.Container; height: number } {
  const half = L.inner / 2;
  const node = scene.add.container(0, 0);
  const left = -half + 12;
  const textLeft = left + L.pointTag + 20;
  const wrap = half - 12 - textLeft;
  let y = 0;
  guide.reasonPoints.forEach((kind, index) => {
    if (index > 0) y += L.pointGap;
    const fill = kind === "element" ? AFFINITY_GLOW[ELEMENT_ICON[rec.element]] : POINT_TONE[kind];
    const text = scene.add.text(textLeft, y, t(`raid.guide.${guide.bossId}.reason.${kind}` as TextKey), textStyle({ role: "body", size: 26, color: COLOR.ink, wrap })).setOrigin(0, 0);
    const tagH = 42;
    const tagY = y + Math.min(tagH, text.height) / 2 + 2;
    node.add(drawLayer(scene, left + L.pointTag / 2, tagY, slantedRect(L.pointTag, tagH, 10), { fill, alpha: 1 }));
    const label = scene.add.text(left + L.pointTag / 2, tagY, t(`raid.guide.point.${kind}` as TextKey), textStyle({ role: "display", size: 23, color: "#0d1218" })).setOrigin(0.5);
    if (label.width > L.pointTag - 18) label.setScale((L.pointTag - 18) / label.width, 1);
    node.add([label, text]);
    y += Math.max(tagH, text.height);
  });
  // 컨테이너는 크기를 갖지 않으므로 쌓은 높이를 함께 돌려준다.
  return { node, height: y };
}

/**
 * 차선책 화살표 줄. 접혀 있으면 차선책들의 작은 얼굴이 미리 서서 "누가 있나"를 먼저 말하고, 오른쪽 꺾쇠가
 * 아래(펼치기)·위(접기)를 가리킨다.
 */
function addAlternativeBar(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, top: number, alternatives: readonly RelicDef[], open: boolean): { node: Phaser.GameObjects.Container; hit: Phaser.GameObjects.Rectangle } {
  const half = L.inner / 2;
  const node = scene.add.container(0, top + L.altBar / 2);
  node.add(drawLayer(scene, 0, 0, slantedRect(L.inner + 40, L.altBar, 16), { fill: open ? 0x18222e : 0x101720, alpha: 0.94, edge: COLOR.accent, edgeAlpha: open ? 0.7 : 0.4 }));
  const label = scene.add.text(-half + 8, 0, t("raid.guide.alt.title"), textStyle({ role: "display", size: 30, color: COLOR.accentText })).setOrigin(0, 0.5);
  node.add(label);
  // 꺾쇠 — 글자가 아니라 도형이라 어느 언어에서나 같은 모양이다.
  const arrowX = half - 18;
  const arrow = scene.add.graphics({ x: arrowX, y: 0 });
  arrow.lineStyle(7, COLOR.accent, 1).strokePoints([new Phaser.Math.Vector2(-14, -6), new Phaser.Math.Vector2(0, 7), new Phaser.Math.Vector2(14, -6)]);
  if (open) arrow.setRotation(Math.PI);
  node.add(arrow);
  if (!open) {
    alternatives.forEach((alt, index) => {
      const x = arrowX - 44 - L.altPeek / 2 - (alternatives.length - 1 - index) * (L.altPeek + 10);
      node.add(new FaceFrame(scene, x, 0, { portraitAssetId: alt.portraitAssetId, size: L.altPeek, color: AFFINITY_GLOW[ELEMENT_ICON[alt.element]] }));
    });
  }
  // 입력면은 창이 서고 난 뒤 흐르는 창 안에서만 받게 건다(`clipHit`).
  const hit = scene.add.rectangle(0, 0, L.inner + 40, L.altBar + 12, 0xffffff, 0);
  node.add(hit);
  parent.add(node);
  return { node, hit };
}

/** 펼친 차선책 한 명 — 얼굴 · 이름 · 속성/직군 · 한 줄 이유. 높이를 돌려준다. */
function addAlternativeRow(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, top: number, guide: RaidGuide, alt: RelicDef): number {
  const half = L.inner / 2;
  const faceX = -half + L.altFace / 2 + 8;
  const textLeft = -half + L.altFace + 36;
  const altTone = AFFINITY_GLOW[ELEMENT_ICON[alt.element]];
  const name = scene.add.text(textLeft, top + 18, alt.name, textStyle({ role: "display", size: 32, color: COLOR.ink })).setOrigin(0, 0);
  const badgeY = top + 18 + name.height / 2;
  const badgeX = textLeft + name.width + 30;
  const element = new AffinityBadge(scene, badgeX, badgeY, ELEMENT_ICON[alt.element], 38, 0.6);
  const role = new AffinityBadge(scene, badgeX + 44, badgeY, ROLE_ICON[alt.role], 32, 0.6);
  const text = scene.add.text(textLeft, top + 18 + name.height + 8, t(`raid.guide.${guide.bossId}.alt.${alt.id}` as TextKey), textStyle({ role: "body", size: 24, color: COLOR.ink, wrap: half - 12 - textLeft })).setOrigin(0, 0);
  const rowH = Math.max(L.altFace + 24, 18 + name.height + 8 + text.height + 18);
  const shape = chipPoints(L.inner + 20, rowH, { bevel: { topLeft: 18, topRight: 0, bottomRight: 18, bottomLeft: 0 } });
  parent.add(drawLayer(scene, 0, top + rowH / 2, shape, { fill: 0x0c1218, alpha: 0.9, edge: altTone, edgeAlpha: 0.5 }));
  parent.add(new FaceFrame(scene, faceX, top + rowH / 2, { portraitAssetId: alt.portraitAssetId, size: L.altFace, color: altTone }));
  parent.add([name, element, role, text]);
  return rowH;
}

/** 유리/불리 한 줄: 색 이름표 + 속성 아이콘들 + 그 줄이 말하는 것. */
function addElementRow(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, top: number, kind: "strong" | "weak", elements: readonly Element[]): number {
  const half = L.inner / 2;
  const rowH = 64;
  const cy = top + rowH / 2;
  const toneRow = ELEMENT_ROW_TONE[kind];
  const label = scene.add.text(0, 0, t(kind === "strong" ? "raid.guide.element.strong" : "raid.guide.element.weak"), textStyle({ role: "display", size: 26, color: "#ffffff" })).setOrigin(0.5);
  const labelW = Math.max(96, label.width + 36);
  parent.add(drawLayer(scene, -half + labelW / 2, cy, slantedRect(labelW, 50, 12), { fill: toneRow.fill, alpha: 1 }));
  parent.add(label.setPosition(-half + labelW / 2, cy));
  let x = -half + labelW + 40;
  elements.forEach((element) => {
    parent.add(new AffinityBadge(scene, x, cy, ELEMENT_ICON[element], 48, 0.6));
    const name = scene.add.text(x + 32, cy, elementLabel(element), textStyle({ role: "emphasis", size: 25, color: toneRow.text })).setOrigin(0, 0.5);
    parent.add(name);
    x += 32 + name.width + 44;
  });
  const note = scene.add.text(x - 10, cy, t(kind === "strong" ? "raid.guide.element.strongNote" : "raid.guide.element.weakNote"), textStyle({ role: "body", size: 22, color: COLOR.inkDim, wrap: half - x + 10 })).setOrigin(0, 0.5);
  parent.add(note);
  return top + Math.max(rowH, note.height + 12);
}
