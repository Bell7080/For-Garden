import Phaser from "phaser";
import type { Element, RelicDef } from "../core/types";
import { raidGuide, raidGuideElements, type RaidGuide, type RaidGuideSlot } from "../data/raidGuides";
import { getRelic } from "../data/relics";
import { setDebugRaidGuideWhy } from "../debug";
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
  hit.on("pointerup", () => { pressOut(button); openRaidGuidePopup(scene, popups, guide, false); });

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

/**
 * 공략법 창. `expanded`는 추천 렐릭의 이유가 펼쳐져 있는가 — 펼치기는 같은 제목의 창을 다시 여는
 * 갈아 끼우기라 깜빡이지 않는다(`PopupLayer.takeRefreshedLayer`).
 */
export function openRaidGuidePopup(scene: Phaser.Scene, popups: PopupLayer, guide: RaidGuide, expanded: boolean): void {
  const boss = getRelic(guide.bossId);
  const rec = getRelic(guide.recommendedRelicId);
  const content = scene.add.container(0, 0);
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
  const reason = expanded
    ? scene.add.text(-half + 24, 0, t(`raid.guide.${guide.bossId}.reason` as TextKey), textStyle({ role: "body", size: 24, color: COLOR.ink, wrap: L.inner - 48 })).setOrigin(0, 0)
    : undefined;
  const cardTop = y;
  const headHeight = L.recommendFace + 32;
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
  why.add(drawLayer(scene, 0, 0, slantedRect(whyW, 64, 14), { fill: expanded ? 0x2a3442 : COLOR.accent, alpha: 1, edge: 0xffffff, edgeAlpha: 0.5 }));
  const whyText = scene.add.text(0, 0, `${t(expanded ? "raid.guide.why.close" : "raid.guide.why.open")} ${expanded ? "▴" : "▾"}`, textStyle({ role: "display", size: 25, color: expanded ? COLOR.ink : "#1b1206" })).setOrigin(0.5);
  if (whyText.width > whyW - 20) whyText.setScale((whyW - 20) / whyText.width, 1);
  why.add(whyText);
  const whyHit = scene.add.rectangle(0, 0, whyW + 16, 80, 0xffffff, 0).setInteractive({ useHandCursor: true });
  why.add(whyHit);
  content.add(why);
  // 이름이 길면 버튼 앞에서 줄인다.
  const nameRoom = half - whyW - 20 - recX;
  if (recName.width > nameRoom) recName.setScale(Math.max(0.6, nameRoom / recName.width), 1);

  if (reason) {
    const lineY = cardTop + headHeight;
    const divider = scene.add.rectangle(0, lineY, L.inner - 20, 2, COLOR.accent, 0.4);
    content.add(divider);
    reason.setY(lineY + L.reasonPad);
    content.add(reason);
  }
  y = cardTop + cardHeight;

  const height = L.top + y + L.bottom;
  content.setY(-height / 2 + L.top);
  let close: () => void = () => undefined;
  whyHit.on("pointerdown", () => pressIn(why));
  whyHit.on("pointerout", () => pressOut(why, "normal", { pop: false }));
  whyHit.on("pointerup", () => {
    pressOut(why);
    close();
    openRaidGuidePopup(scene, popups, guide, !expanded);
  });
  popups.open({ width: L.width, height, title: t("raid.guide.title"), dim: true, dimAlpha: 0.5, closeOnBackdrop: true, backButton: true }, (body, closeFn) => {
    close = closeFn;
    body.add(content);
    setDebugRaidGuideWhy({ x: scene.scale.width / 2 + why.x, y: scene.scale.height / 2 + content.y + why.y });
  });
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
